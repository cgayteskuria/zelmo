<?php

namespace App\Services;

use App\Models\InvoiceModel;
use App\Models\AccountModel;
use App\Models\EInvoicingTransmissionModel;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    /**
     * Créer une nouvelle facture avec validation
     *
     * @param array $data - Données de la facture
     * @param int $userId - ID de l'utilisateur
     * @return InvoiceModel
     * @throws \Exception
     */
    public function createInvoice(array $data, int $userId): InvoiceModel
    {
        try {
            DB::beginTransaction();

            // Validation de la période comptable
            if (isset($data['inv_date'])) {
                AccountModel::validateWritingPeriod($data['inv_date']);
            }

            // Créer la facture
            $invoice = new InvoiceModel();

            // Champs requis
            $invoice->inv_date = $data['inv_date'];
            $invoice->inv_operation = $data['inv_operation'];
            $invoice->fk_ptr_id = $data['fk_ptr_id'];
            $invoice->inv_status = $data['inv_status'] ?? InvoiceModel::STATUS_DRAFT;

            // Champs optionnels
            if (isset($data['inv_duedate'])) $invoice->inv_duedate = $data['inv_duedate'];
            if (isset($data['fk_ctc_id'])) $invoice->fk_ctc_id = $data['fk_ctc_id'];
            if (isset($data['fk_pam_id'])) $invoice->fk_pam_id = $data['fk_pam_id'];
            if (isset($data['fk_dur_id_payment_condition'])) $invoice->fk_dur_id_payment_condition = $data['fk_dur_id_payment_condition'];
            if (isset($data['fk_tap_id'])) $invoice->fk_tap_id = $data['fk_tap_id'];
            if (isset($data['inv_note'])) $invoice->inv_note = $data['inv_note'];
            if (isset($data['inv_externalreference'])) $invoice->inv_externalreference = $data['inv_externalreference'];

            // Totaux (par défaut 0 si non fournis)
            $invoice->inv_totalht = $data['inv_totalht'] ?? 0;
            $invoice->inv_totaltax = $data['inv_totaltax'] ?? 0;
            $invoice->inv_totalttc = $data['inv_totalttc'] ?? 0;

            // Tracking utilisateur
            $invoice->fk_usr_id_author = $userId;
            $invoice->fk_usr_id_updater = $userId;

            // Clés étrangères optionnelles
            if (isset($data['fk_ord_id'])) $invoice->fk_ord_id = $data['fk_ord_id'];
            if (isset($data['fk_por_id'])) $invoice->fk_por_id = $data['fk_por_id'];
            if (isset($data['fk_inv_id'])) $invoice->fk_inv_id = $data['fk_inv_id'];

            // Sauvegarder (déclenche les hooks boot pour génération numéro et validation)
            $invoice->save();

            DB::commit();

            return $invoice;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Créer un avoir (facture de remboursement)
     *
     * @param array $data - Données de l'avoir
     * @param int $userId - ID de l'utilisateur
     * @return InvoiceModel
     * @throws \Exception
     */
    public function createCreditNote(array $data, int $userId): InvoiceModel
    {
        // Préparer les données spécifiques à un avoir
        $invoiceData = [
            'inv_date' => $data['inv_date'],
            'inv_duedate' => $data['inv_duedate'],
            'inv_operation' => $data['inv_operation'], // 2 (client) ou 4 (fournisseur)
            'fk_ptr_id' => $data['fk_ptr_id'],
            'inv_status' => InvoiceModel::STATUS_FINALIZED, // Toujours validé            
            'inv_externalreference' => $data['inv_externalreference'],
            'inv_note' => $data['inv_note'],
        ];

        // Lien vers la facture parente si fourni
        if (isset($data['fk_inv_id'])) {
            $invoiceData['fk_inv_id'] = $data['fk_inv_id'];
        }

        // Utiliser createInvoice avec les données de l'avoir
        return $this->createInvoice($invoiceData, $userId);
    }

    /**
     * Mettre à jour une facture avec protections et validations
     *
     * @param InvoiceModel $invoice - La facture à modifier
     * @param array $data - Les nouvelles données
     * @param int $userId - ID de l'utilisateur
     * @return InvoiceModel
     * @throws \Exception
     */
    public function updateInvoice(InvoiceModel $invoice, array $data, int $userId): InvoiceModel
    {
        try {
            DB::beginTransaction();

            // Bloquer la modification si la facture a été transmise au PDP
            $hasActivePdpTransmission = EInvoicingTransmissionModel::where('fk_inv_id', $invoice->inv_id)
                ->where('eit_status', '!=', EInvoicingTransmissionModel::STATUS_ERROR)
                ->exists();
            if ($hasActivePdpTransmission) {
                throw new \RuntimeException('Cette facture a été transmise au réseau PDP et ne peut plus être modifiée.');
            }

            // Validation de la période comptable si inv_date est modifiée
            if (isset($data['inv_date']) && $data['inv_date'] != $invoice->inv_date) {
                AccountModel::validateWritingPeriod($data['inv_date']);
            }

            // Mise à jour des champs
            $invoice->fill($data);
            $invoice->fk_usr_id_updater = $userId;

            // Sauvegarder (déclenche les hooks boot pour protection et validation)
            $invoice->save();

            DB::commit();

            return $invoice;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Supprimer une facture avec protections
     *
     * @param InvoiceModel $invoice - La facture à supprimer
     * @return bool
     * @throws \Exception
     */
    public function deleteInvoice(InvoiceModel $invoice): bool
    {
        try {
            DB::beginTransaction();

            // Supprimer (déclenche le hook boot pour protection)
            $invoice->delete();

            DB::commit();

            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
