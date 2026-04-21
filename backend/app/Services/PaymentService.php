<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use App\Models\PaymentModel;
use App\Models\PaymentAllocationModel;
use App\Models\InvoiceModel;
use App\Models\InvoiceLineModel;
use App\Models\PurchaseOrderConfigModel;
use App\Models\AccountModel;
use App\Services\InvoiceService;
use Illuminate\Http\Request;


class PaymentService
{
    /**
     * Sauvegarde un paiement (création ou modification)
     *
     * @param array $data - Données du paiement
     * @param string $module - Module ('invoice' ou 'contract')
     * @param int $userId - ID de l'utilisateur
     * @return array
     * @throws \Exception
     */
    public function savePayment(Request $request): array
    {

        try {
            DB::beginTransaction();

            $data = $request->all();
            $userId = $request->user()->usr_id;

            // Vérifier que le paiement est bien dans la période comptable
            AccountModel::validateWritingPeriod($data['pay_date']);

            $module = $data['module'];
            $param = [];
            if (isset($data['inv_operation'])) {
                $param["inv_operation"] = $data['inv_operation'];
                $param["fk_ptr_id"] = $data['fk_ptr_id'];
            }
            $config = $this->getModuleConfig($module, $param);
            $payId = $data['pay_id'] ?? null;

            // Vérifier si modification ou création
            if ($payId) {
                // lockForUpdate : évite la race condition si deux onglets modifient
                // le même paiement au moment où il est transféré en comptabilité.
                $payment = PaymentModel::lockForUpdate()->findOrFail($payId);

                // Vérifier si le paiement n'est pas comptabilisé
                if ($payment->pay_status == PaymentModel::STATUS_ACCOUNTED) {
                    throw new \Exception('Impossible de modifier un paiement déjà transféré en comptabilité.');
                }

                // Supprimer les anciennes allocations
                PaymentAllocationModel::where('fk_pay_id', $payId)->delete();

                $payment->pay_date = $data['pay_date'];
                $payment->pay_amount = $data['pay_amount'];
                $payment->fk_bts_id = $data['fk_bts_id'];
                $payment->fk_pam_id = $data['fk_pam_id'];
                $payment->pay_reference = $data['pay_reference'] ?? null;
                $payment->fk_usr_id_updater = $userId;
                // Si invoice on rend obligatoire la saisi du tiers
                if ($module == "invoice") {
                    $payment->fk_ptr_id = $config['fk_ptr_id'];
                }
                if ($module == "expense-reports") {
                    $payment->fk_usr_id = $data['employeeId'];
                }
                $payment->save();
            } else {
                // Créer le paiement
                $payment = new PaymentModel();
                $payment->pay_date = $data['pay_date'];
                $payment->pay_amount = $data['pay_amount'];
                $payment->fk_bts_id = $data['fk_bts_id'];
                $payment->fk_pam_id = $data['fk_pam_id'];
                $payment->pay_reference = $data['pay_reference'] ?? null;
                $payment->pay_status = 0; // Brouillon
                $payment->pay_operation = $config['pay_operation']; // Défini selon le module               
                $payment->fk_usr_id_updater = $userId;
                // Si invoice on rend obligatoire la saisi du tiers
                if ($module == "invoice") {
                    $payment->fk_ptr_id = $config['fk_ptr_id'];
                }
                // Si invoice on rend obligatoire la saisi du tiers
                if ($module == "expense-reports") {
                    $payment->fk_usr_id = $data['employeeId'];
                }
                // Le numéro sera généré automatiquement par le hook boot() dans PaymentModel
                $payment->save();
            }

            // Créer les allocations
            $affectedDocuments = [];
            $allocations = $data['allocations'];

            foreach ($allocations as $allocation) {
                $paymentAllocation = new PaymentAllocationModel();
                $paymentAllocation->fk_pay_id = $payment->pay_id;
                $paymentAllocation->{$config['foreign_key']} = $allocation[$config['foreign_key']];
                $paymentAllocation->pal_amount = $allocation['amount'];
                $paymentAllocation->fk_usr_id_author = $userId;
                $paymentAllocation->save();

                $affectedDocuments[] = $allocation[$config['foreign_key']];
            }

            DB::commit();

            return [
                'success' => true,
                'message' => 'Paiement enregistré avec succès',
                'data' => [
                    'pay_id' => $payment->pay_id,
                    'pay_number' => $payment->pay_number,
                ]
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Supprime un paiement
     *
     * @param int $payId - ID du paiement
     * @param string $module - Module ('invoice' ou 'contract')
     * @return array
     * @throws \Exception
     */
    public function deletePayment(int $payId, string $module): array
    {
        try {
            DB::beginTransaction();

            // lockForUpdate : lit le statut à jour et pose un verrou pour éviter
            // qu'un transfert comptable concurrent rende le check obsolète.
            $payment = PaymentModel::lockForUpdate()->findOrFail($payId);

            // Vérifier si le paiement n'est pas comptabilisé AVANT toute suppression
            if ($payment->pay_status == PaymentModel::STATUS_ACCOUNTED) {
                throw new \Exception('Impossible de supprimer un paiement déjà transféré en comptabilité.');
            }

            $payment->delete();

            // Récupérer les documents affectés avant la suppression et les avoirs concernés
            /* $allocations = PaymentAllocationModel::from('payment_allocation_pal as pal')
                ->leftJoin('payment_pay as pay', 'pal.fk_pay_id', '=', 'pay.pay_id')
                ->where('pal.fk_pay_id', $payId)
                ->select('pal.' . $config['foreign_key'], 'pay.fk_inv_id_refund')
                ->get();

            $affectedDocuments = $allocations->pluck($config['foreign_key'])->filter()->toArray();
            $affectedRefunds = $allocations->pluck('fk_inv_id_refund')->filter()->unique()->toArray();

            // LETTRAGE : Si c'est un avoir, mettre à jour fk_inv_id pour supprimer la liaison avoir x facture
            // Liaison utilisée par le lettrage automatique pour grouper facture + règlement + avoir
            if ($module === 'invoice' && !empty($affectedRefunds)) {
                DB::table('invoice_inv')
                    ->whereIn('inv_id', $affectedRefunds)
                    ->update(['fk_inv_id' => null]);
            }

            // Supprimer les allocations
            PaymentAllocationModel::where('fk_pay_id', $payId)->delete();

            // Supprimer le paiement
            $payment->delete();

            // Mettre à jour le montant restant et le pourcentage de paiement des documents affectés
            foreach ($affectedDocuments as $documentId) {
                $this->updateDocumentAmountRemaining($documentId, $module);
            }

            // Recalculer le montant restant de l'avoir source si présent (pour les factures)
            if ($module === 'invoice' && !empty($affectedRefunds)) {
                foreach ($affectedRefunds as $refundId) {
                    $this->updateDocumentAmountRemaining($refundId, $module);
                }
            }*/

            DB::commit();

            return [
                'success' => true,
                'message' => 'Paiement supprimé avec succès'
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }


    /**
     * Utilise un avoir ou un acompte pour régler une facture
     *
     * @param int $invoiceId - ID de la facture à régler
     * @param int $creditId - ID de l'avoir ou de l'acompte
     * @param int $userId - ID de l'utilisateur
     * @return array
     * @throws \Exception
     */
    public function useCredit(int $invoiceId, string $creditId, int $userId): array
    {
        try {
            DB::beginTransaction();

            // Récupérer la facture à régler
            $invoice = InvoiceModel::findOrFail($invoiceId);
            $amountRemaining = $invoice->inv_amount_remaining;

            if ($amountRemaining <= 0) {
                throw new \Exception('La facture est déjà entièrement réglée');
            }

            $explodedCreditId = explode('_', $creditId);
            if (!isset($explodedCreditId[1])) {
                throw new \Exception("ID de crédit invalide");
            }
            switch ($explodedCreditId[0]) {
                case "inv":
                    // Récupérer la source (avoir ou acompte)
                    $credit = InvoiceModel::findOrFail($explodedCreditId[1]);
                    $creditOperation = $credit->inv_operation;
                    // Déterminer le type de source et les filtres
                    if (in_array($creditOperation, [InvoiceModel::OPERATION_CUSTOMER_REFUND, InvoiceModel::OPERATION_SUPPLIER_REFUND])) {
                        $selector = 'fk_inv_id_refund';
                    } else if (in_array($creditOperation, [InvoiceModel::OPERATION_CUSTOMER_DEPOSIT, InvoiceModel::OPERATION_SUPPLIER_DEPOSIT])) {
                        $selector = 'fk_inv_id_deposit';
                    } else {
                        throw new \Exception('Type de crédit non valide');
                    }

                    // Calculer le montant disponible sur l'avoir/acompte
                    $creditBalance = $this->calculateCreditBalance($explodedCreditId[1], $selector);

                    if ($creditBalance <= 0) {
                        throw new \Exception('Aucun montant disponible sur ce crédit');
                    }
                    // Calculer le montant à allouer
                    $payAmount = min($creditBalance, $amountRemaining);

                    // Créer le paiement
                    $payment = new PaymentModel();
                    $payment->pay_date = $credit->inv_date;
                    $payment->pay_amount = $payAmount;
                    $payment->fk_bts_id = null; // Pas de banque pour les avoirs/acomptes
                    $payment->fk_pam_id = $invoice->fk_pam_id; // Utiliser le mode de paiement de la facture
                    $payment->pay_reference = null;
                    $payment->pay_status = 0; // Brouillon
                    $payment->pay_operation = $creditOperation == InvoiceModel::OPERATION_CUSTOMER_REFUND || $creditOperation == InvoiceModel::OPERATION_CUSTOMER_DEPOSIT
                        ? PaymentModel::OPERATION_CUSTOMER_PAYMENT
                        : PaymentModel::OPERATION_SUPPLIER_PAYMENT;
                    $payment->$selector = $explodedCreditId[1];
                    $payment->fk_usr_id_author = $userId;
                    // $payment->fk_usr_id_updater = $userId;
                    $payment->save();

                    // Créer l'allocation
                    $allocation = new PaymentAllocationModel();
                    $allocation->fk_pay_id = $payment->pay_id;
                    $allocation->fk_inv_id = $invoiceId;
                    $allocation->pal_amount = $payAmount;
                    $allocation->fk_usr_id_author = $userId;
                    // $allocation->fk_usr_id_updater = $userId;
                    $allocation->save();

                    // LETTRAGE : Si c'est un avoir, mettre à jour fk_inv_id pour lier l'avoir à la facture
                   // if (in_array($creditOperation, [InvoiceModel::OPERATION_CUSTOMER_REFUND, InvoiceModel::OPERATION_SUPPLIER_REFUND])) {
                    //    $credit->fk_inv_id = $invoiceId;
                       // $credit->save();
                  //  }
                    $credit->updateAmountRemaining();
                    break;
                case "pay":
                    $payment = PaymentModel::find($explodedCreditId[1]);
                    if (!$payment) {
                        throw new \Exception("Paiement introuvable");
                    }
                    $creditBalance = (float) $payment->pay_amount_available;

                    // Calculer le montant à allouer
                    $payAmount = min($creditBalance, $amountRemaining);

                    $allocation = new PaymentAllocationModel();
                    $allocation->fk_pay_id = $payment->pay_id;
                    $allocation->fk_inv_id = $invoiceId;
                    $allocation->pal_amount = $payAmount;
                    $allocation->fk_usr_id_author = $userId;
                    //$allocation->fk_usr_id_updater = $userId;
                    $allocation->save();
                    break;
            }


            // Mettre à jour les montants restants
            $invoice->updateAmountRemaining();


            DB::commit();

            return [
                'success' => true,
                'message' => 'Crédit appliqué avec succès',
                'data' => [
                    'pay_id' => $payment->pay_id,
                    'pay_number' => $payment->pay_number,
                    'amount' => $payAmount,
                ]
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Calcule le montant disponible sur un avoir ou un acompte
     *
     * @param int $creditId
     * @param string $selector
     * @return float
     */
    private function calculateCreditBalance(int $creditId, string $selector): float
    {
        $credit = InvoiceModel::findOrFail($creditId);

        // Calculer le total utilisé via les paiements
        $totalUsed = PaymentModel::where($selector, $creditId)
            ->join('payment_allocation_pal', 'payment_pay.pay_id', '=', 'payment_allocation_pal.fk_pay_id')
            ->sum('payment_allocation_pal.pal_amount');

        $balance = $credit->inv_totalttc - ($totalUsed ?? 0);

        return round($balance, 2);
    }

    /**
     * Retourne la configuration spécifique au module
     *
     * @param string $module
     * @return array
     * @throws \Exception
     */
    private function getModuleConfig(string $module, $param = []): array
    {
        if ($module == 'invoice') {
            $config = [
                'model' => InvoiceModel::class,
                'foreign_key' => 'fk_inv_id',
                'primary_key' => 'inv_id',
            ];
            if (isset($param['inv_operation'])) {
                $invOperation = $param['inv_operation'];

                if ($invOperation  == InvoiceModel::OPERATION_CUSTOMER_DEPOSIT ||  $invOperation == InvoiceModel::OPERATION_CUSTOMER_INVOICE ||  $invOperation  == InvoiceModel::OPERATION_CUSTOMER_REFUND) {
                    $config['pay_operation'] = PaymentModel::OPERATION_CUSTOMER_PAYMENT;
                } else {
                    $config['pay_operation'] = PaymentModel::OPERATION_SUPPLIER_PAYMENT;
                }
                $config['fk_ptr_id'] = $param['fk_ptr_id'];
            }

            return $config;
        } elseif ($module == 'charge') {
            return [
                'model' => \App\Models\ChargeModel::class,
                'foreign_key' => 'fk_che_id',
                'primary_key' => 'che_id',
                'pay_operation' => PaymentModel::OPERATION_CHARGE_PAYMENT, // 3 pour les charges
            ];
        } elseif ($module == 'expense-reports') {
            return [
                'model' => \App\Models\ExpenseReportModel::class,
                'foreign_key' => 'fk_exr_id',
                'primary_key' => 'exr_id',
                'pay_operation' => PaymentModel::OPERATION_EXPENSE_REPORT_PAYMENT, // 4 pour les notes de frais
            ];
        } else {
            throw new \Exception("Module non supporté: {$module}");
        }
    }

    /**
     * Supprime uniquement le lien d'allocation (PAL) entre un règlement et un document parent.
     * Le règlement lui-même n'est pas modifié (utile pour les règlements comptabilisés).
     * Les hooks du modèle PaymentAllocationModel gèrent automatiquement les recalculs.
     *
     * @param int $payId - ID du règlement
     * @param string $parentField - Champ de clé étrangère ('fk_inv_id', 'fk_che_id', 'fk_exr_id')
     * @param int $parentId - ID du document parent
     * @return array
     */
    public function removeAllocation(int $payId, string $parentField, int $parentId): array
    {
        DB::beginTransaction();
        try {
            $pal = PaymentAllocationModel::where('fk_pay_id', $payId)
                ->where($parentField, $parentId)
                ->firstOrFail();
            $pal->delete(); // Les hooks deleted du modèle gèrent tous les recalculs
            DB::commit();
            return ['success' => true];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
