<?php

namespace App\Services;

use App\Models\BizDocumentLineModel;
use App\Models\ContractModel;
use App\Models\InvoiceModel;
use App\Models\ContractInvoiceModel;
use App\Models\InvoiceLineModel;
use App\Models\DurationsModel;
use Carbon\Carbon;
use App\Services\InvoiceService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Exception;

class ContractInvoiceService
{
    protected InvoiceService $invoiceService;

    public function __construct()
    {
        $this->invoiceService = new InvoiceService;
    }

    /**
     * Génère une facture à partir d'un contrat d'abonnement
     *
     * @param int $contractId ID du contrat
     * @param int $userId ID de l'utilisateur effectuant l'opération
     * @param array $options Options supplémentaires (date de facture, etc.)
     * @return array ['success' => bool, 'invoice' => InvoiceModel|null, 'message' => string]
     */
    public function generateInvoiceFromContract(int $contractId, int $userId, array $options = []): array
    {
        DB::beginTransaction();

        try {
            // 1. Charger le contrat avec ses relations
            $contract = ContractModel::with(['partner', 'contact', 'lines', 'seller'])
                ->findOrFail($contractId);

            // 2. Valider que le contrat est éligible à la facturation
            $validation = $this->validateContractForInvoicing($contract);
            if (!$validation['valid']) {
                DB::rollBack();
                return [
                    'success' => false,
                    'invoice' => null,
                    'message' => $validation['message']
                ];
            }

            // 3. Préparer les données de la facture
            $invoiceData = $this->prepareInvoiceData($contract, $options);

            // 4. Créer la facture
            $invoice = $this->invoiceService->createInvoice($invoiceData, $userId);

            // 5. Copier les lignes du contrat vers la facture
            // Pour un contrat résilié avec facturation restante, on facture toutes les périodes en une seule fois
            $periodCount = ($contract->con_status === ContractModel::STATUS_TERMINATED && $contract->con_invoice_remaining)
                ? $this->countRemainingPeriods($contract)
                : 1;
            $this->copyContractLinesToInvoice($contract, $invoice, $periodCount);


            // 7. Créer le lien contrat-facture
            $this->createContractInvoiceLink($contract->con_id, $invoice->inv_id);

            // 8. Mettre à jour la prochaine date de facturation du contrat
            $this->updateNextInvoiceDate($contract);

            DB::commit();

            /* Log::info("Facture générée depuis contrat", [
                'contract_id' => $contractId,
                'invoice_id' => $invoice->inv_id,
                'user_id' => $userId
            ]);*/

            return [
                'success' => true,
                'invoice' => $invoice->fresh(),
                'message' => "Facture {$invoice->inv_number} générée avec succès depuis le contrat {$contract->con_number}"
            ];
        } catch (Exception $e) {
            DB::rollBack();

            /*  Log::error("Erreur lors de la génération de facture depuis contrat", [
                'contract_id' => $contractId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);*/

            return [
                'success' => false,
                'invoice' => null,
                'contract' =>  $contract,
                'message' => "Erreur lors de la génération de la facture: " . $e->getMessage()
            ];
        }
    }

    /**
     * Génère plusieurs factures à partir d'une liste de contrats
     *
     * @param array $contractIds Liste des IDs de contrats
     * @param int $userId ID de l'utilisateur
     * @param array $options Options supplémentaires
     * @return array ['success' => bool, 'results' => array, 'summary' => array]
     */
    public function generateInvoicesFromContracts(array $contractIds, int $userId, array $options = []): array
    {
        $results = [];
        $successCount = 0;
        $errorCount = 0;
        $invoiceIds = [];
        $invoiceNumbers = [];
        $errors = [];

        foreach ($contractIds as $contractId) {
            $result = $this->generateInvoiceFromContract($contractId, $userId, $options);
            $results[$contractId] = $result;

            if ($result['success']) {
                $successCount++;
                $invoiceIds[] = $result['invoice']->inv_id;
                $invoiceNumbers[] = $result['invoice']->inv_number;
            } else {
                $errorCount++;
                $errors[] = [
                    'contract_id' => $contractId,
                    'con_number' =>  $result["contract"]->con_number,
                    'message' => $result['message']
                ];
            }
        }

        return [
            'success' => $successCount > 0,
            'results' => $results,
            'summary' => [
                'total' => count($contractIds),
                'success' => $successCount,
                'errors' => $errorCount,
                'invoice_ids' => $invoiceIds,
                'invoice_numbers' => $invoiceNumbers,
                'error_details' => $errors
            ]
        ];
    }

    /**
     * Valide qu'un contrat peut être facturé
     *
     * @param ContractModel $contract
     * @return array ['valid' => bool, 'message' => string]
     */
    protected function validateContractForInvoicing(ContractModel $contract): array
    {
        // Vérifier que c'est un contrat client
        if ($contract->con_operation != 1) {
            return [
                'valid' => false,
                'message' => "Le contrat {$contract->con_number} n'est pas un contrat client"
            ];
        }

        // Vérifier le statut du contrat (ACTIVE=1, TERMINATING=2, ou TERMINATED=3 avec facturation restante)
        $statusAllowed = in_array($contract->con_status, [1, 2])
            || ($contract->con_status === ContractModel::STATUS_TERMINATED && $contract->con_invoice_remaining);
        if (!$statusAllowed) {
            return [
                'valid' => false,
                'message' => "Le contrat {$contract->con_number} n'est pas actif (statut: {$contract->con_status})"
            ];
        }

        // Vérifier la date de prochaine facturation
        if (empty($contract->con_next_invoice_date) || $contract->con_next_invoice_date === '0000-00-00') {
            return [
                'valid' => false,
                'message' => "Le contrat {$contract->con_number} n'a pas de date de prochaine facturation"
            ];
        }

        $nextInvoiceDate = strtotime($contract->con_next_invoice_date);
        $today = strtotime(date('Y-m-d'));

        if ($nextInvoiceDate > $today) {
            return [
                'valid' => false,
                'message' => "Le contrat {$contract->con_number} n'est pas encore à facturer (date: {$contract->con_next_invoice_date})"
            ];
        }

        // Vérifier qu'il y a des lignes d'abonnement actives (col_status = 1)
        $subscriptionLines = $contract->lines
            ->where('col_is_subscription', 1)
            ->where('col_status', \App\Models\ContractLineModel::STATUS_ACTIVE);
        if ($subscriptionLines->isEmpty()) {
            return [
                'valid' => false,
                'message' => "Le contrat {$contract->con_number} n'a pas de lignes d'abonnement actives (toutes en attente d'activation ?)"
            ];
        }

        // Vérifier qu'il y a un partenaire
        if (empty($contract->fk_ptr_id)) {
            return [
                'valid' => false,
                'message' => "Le contrat {$contract->con_number} n'a pas de partenaire associé"
            ];
        }

        return [
            'valid' => true,
            'message' => 'OK'
        ];
    }

    /**
     * Prépare les données pour créer la facture
     *
     * @param ContractModel $contract   
     * @param array $options
     * @return array
     */
    protected function prepareInvoiceData(ContractModel $contract,  array $options = []): array
    {
        $invoiceDate =  $contract->con_next_invoice_date;

        // Calculer la date d'échéance basée sur les conditions de paiement       
        $dueDate = DurationsModel::calculateNextDate($contract->fk_dur_id_payment_condition, $invoiceDate);

        return [
            'inv_operation' => 1, // CUSTOMER_INVOICE
            'inv_status' => 0, // DRAFT
            'inv_date' => $invoiceDate,
            'inv_duedate' => $dueDate,
            'fk_ptr_id' => $contract->fk_ptr_id, //Partners
            'inv_ptr_address' =>  $contract->con_ptr_address,
            'inv_externalreference' => 'Contrat ' . $contract->con_number,
            'fk_ctc_id' => $contract->fk_ctc_id, //Contact
            'fk_usr_id_seller' => $contract->fk_usr_id_seller,
            'fk_dur_id_payment_condition' => $contract->fk_dur_id_payment_condition,
            // 'fk_pyc_id' => $contract->fk_pyc_id ?? null,
            'fk_pam_id' => $contract->fk_pam_id ?? null,
            //  'fk_ccy_id' => $contract->fk_ccy_id ?? 1,
            'inv_label' => $options['label'] ?? "Facturation abonnement - Contrat {$contract->con_number}",
            'inv_note' => $options['note'] ?? "Facture générée automatiquement depuis le contrat {$contract->con_number}",
            'inv_totalht' => 0, // Sera recalculé
            'inv_totaltax' => 0, // Sera recalculé
            'inv_totalttc' => 0, // Sera recalculé
            'inv_amount_remaining' => 0, // Sera recalculé
        ];
    }


    /**
     * Copie les lignes du contrat vers la facture
     *
     * @param ContractModel $contract
     * @param InvoiceModel $invoice
     * @return void
     */
    protected function copyContractLinesToInvoice(ContractModel $contract, InvoiceModel $invoice, int $periodCount = 1): void
    {
        // Calculer les dates de début et fin de période pour le titre
        $periodStart = Carbon::parse($contract->con_next_invoice_date);

        if ($periodCount > 1 && $contract->con_end_commitment) {
            // Solde des mois restants : la période va jusqu'à la fin d'engagement
            $periodEnd = Carbon::parse($contract->con_end_commitment);
        } else {
            // Période normale : prochaine échéance - 1 jour
            $nextRaw = DurationsModel::calculateNextDate($contract->fk_dur_id_invoicing, $contract->con_next_invoice_date, false);
            $periodEnd = $nextRaw
                ? Carbon::parse($nextRaw)->subDay()
                : $periodStart->copy()->endOfMonth();
        }

        $titleLabel = 'Abonnement pour la période du '
            . $periodStart->format('d/m/Y')
            . ' au '
            . $periodEnd->format('d/m/Y');

        InvoiceLineModel::create([
            'fk_inv_id'           => $invoice->inv_id,
            'inl_prtlib'          => $titleLabel,
            'inl_prtdesc'         => null,
            'inl_prttype'         => null,
            'inl_qty'             => 0,
            'inl_priceunitht'     => 0,
            'inl_discount'        => 0,
            'inl_mtht'            => 0,
            'inl_order'           => 0,
            'inl_type'            => BizDocumentLineModel::LINE_TYPE_SEPARATOR,
            'inl_tax_rate'        => 0,
            'fk_tax_id'           => null,
            'inl_purchasepriceunitht' => 0,
        ]);

        // Récupérer uniquement les lignes d'abonnement actives
        $contractLines = $contract->lines()
            ->where('col_is_subscription', 1)
            ->where('col_status', \App\Models\ContractLineModel::STATUS_ACTIVE)
            ->orderBy('col_order')
            ->get();

        foreach ($contractLines as $contractLine) {
            $qty   = $contractLine->col_qty * $periodCount;
            $mtht  = $contractLine->col_mtht * $periodCount;

            $invoiceLineData = [
                'fk_inv_id' => $invoice->inv_id,
                'inl_prtlib' => $contractLine->col_prtlib,
                'inl_prtdesc' => $contractLine->col_prtdesc,
                'inl_prttype' => $contractLine->col_prttype,
                'inl_qty' => $qty,
                'inl_priceunitht' => $contractLine->col_priceunitht,
                'inl_discount' => $contractLine->col_discount,
                'inl_mtht' => $mtht,
                'fk_prt_id' => $contractLine->fk_prt_id,
                'inl_order' => $contractLine->col_order,
                'inl_type' => $contractLine->col_type,
                'inl_purchasepriceunitht' => $contractLine->col_purchasepriceunitht,
                'inl_tax_rate' => $contractLine->col_tax_rate,
                'fk_tax_id' =>  $contractLine->fk_tax_id,
            ];

            InvoiceLineModel::create($invoiceLineData);
        }
    }

    /**
     * Crée le lien entre le contrat et la facture
     *
     * @param int $contractId
     * @param int $invoiceId
     * @return void
     */
    protected function createContractInvoiceLink(int $contractId, int $invoiceId): void
    {
        ContractInvoiceModel::create([
            'fk_con_id' => $contractId,
            'fk_inv_id' => $invoiceId,
        ]);
    }

    /**
     * Met à jour la prochaine date de facturation du contrat
     *
     * @param ContractModel $contract
     * @return void
     */
    protected function updateNextInvoiceDate(ContractModel $contract): void
    {
        // Récupérer la durée de facturation
        if (!$contract->fk_dur_id_invoicing) {
            Log::warning("Contrat sans durée de facturation", ['contract_id' => $contract->con_id]);
            return;
        }

        // Pour un contrat résilié avec facturation restante, toutes les périodes ont été facturées en une fois
        if ($contract->con_status === ContractModel::STATUS_TERMINATED && $contract->con_invoice_remaining) {
            $contract->con_next_invoice_date = null;
            $contract->con_invoice_remaining = 0;
            $contract->save();
            return;
        }

        // Utiliser la méthode calculateNextDate du modèle DurationsModel
        $nextDate = DurationsModel::calculateNextDate(
            $contract->fk_dur_id_invoicing,
            $contract->con_next_invoice_date,
            false // Ce n'est pas la première durée
        );

        if ($nextDate) {
            // Contrat en cours de résiliation avec préavis : vérifier si toutes les périodes sont facturées
            if (
                $contract->con_status === ContractModel::STATUS_TERMINATING
                && $contract->con_terminated_date
                && $nextDate > $contract->con_terminated_date
            ) {
                // Toutes les périodes ont été facturées jusqu'à la date de résiliation
                DB::table('contract_con')->where('con_id', $contract->con_id)->update([
                    'con_next_invoice_date' => null,
                    'con_status' => ContractModel::STATUS_TERMINATED,
                ]);
                return;
            }

            // Utiliser une mise à jour directe pour bypasser le boot hook (TERMINATING ne peut pas être modifié via Eloquent)
            DB::table('contract_con')->where('con_id', $contract->con_id)->update([
                'con_next_invoice_date' => $nextDate,
            ]);
        } else {
            Log::error("Impossible de calculer la prochaine date de facturation", [
                'contract_id' => $contract->con_id,
                'dur_id' => $contract->fk_dur_id_invoicing
            ]);
        }
    }

    /**
     * Compte le nombre de périodes de facturation restantes jusqu'à la fin d'engagement
     */
    public function countRemainingPeriods(ContractModel $contract): int
    {
        if (!$contract->fk_dur_id_invoicing || !$contract->con_next_invoice_date || !$contract->con_end_commitment) {
            return 1;
        }

        $count = 0;
        $currentDate = $contract->con_next_invoice_date;
        $terminatedDate = $contract->con_end_commitment;
        $safetyLimit = 1200;

        while ($currentDate <= $terminatedDate && $safetyLimit-- > 0) {
            $count++;
            $nextDate = DurationsModel::calculateNextDate(
                $contract->fk_dur_id_invoicing,
                $currentDate,
                false
            );
            if (!$nextDate || $nextDate === $currentDate) {
                break;
            }
            $currentDate = $nextDate;
        }

        return max(1, $count);
    }
}
