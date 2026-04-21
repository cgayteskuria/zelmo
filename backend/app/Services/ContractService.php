<?php

namespace App\Services;

use App\Models\ContractModel;
use App\Models\AccountModel;
use Illuminate\Support\Facades\DB;

class ContractService
{
    /**
     * Créer un nouveau contrat avec validation
     *
     * @param array $data - Données du contrat
     * @param int $userId - ID de l'utilisateur
     * @return ContractModel
     * @throws \Exception
     */
    public function createContract(array $data, int $userId): ContractModel
    {
        try {
            DB::beginTransaction();

            // Validation de la période comptable
            if (isset($data['con_date'])) {
                AccountModel::validateWritingPeriod($data['con_date']);
            }

            // Créer le contrat
            $contract = new ContractModel();

            // Champs requis
            $contract->con_date = $data['con_date'];
            $contract->con_operation = $data['con_operation'];
            $contract->fk_ptr_id = $data['fk_ptr_id'];
            $contract->con_label = $data['con_label'];
            $contract->con_status = $data['con_status'] ?? ContractModel::STATUS_DRAFT;

            // Champs optionnels
            if (isset($data['fk_ctc_id'])) $contract->fk_ctc_id = $data['fk_ctc_id'];
            if (isset($data['fk_pam_id'])) $contract->fk_pam_id = $data['fk_pam_id'];
            if (isset($data['fk_dur_id_payment_condition'])) $contract->fk_dur_id_payment_condition = $data['fk_dur_id_payment_condition'];
            if (isset($data['fk_dur_id_commitment'])) $contract->fk_dur_id_commitment = $data['fk_dur_id_commitment'];
            if (isset($data['fk_dur_id_renew'])) $contract->fk_dur_id_renew = $data['fk_dur_id_renew'];
            if (isset($data['fk_dur_id_notice'])) $contract->fk_dur_id_notice = $data['fk_dur_id_notice'];
            if (isset($data['fk_dur_id_invoicing'])) $contract->fk_dur_id_invoicing = $data['fk_dur_id_invoicing'];
            if (isset($data['fk_tap_id'])) $contract->fk_tap_id = $data['fk_tap_id'];
            if (isset($data['con_note'])) $contract->con_note = $data['con_note'];

            // Totaux (par défaut 0 si non fournis)
            $contract->con_totalht = $data['con_totalht'] ?? 0;
            $contract->con_totaltax = $data['con_totaltax'] ?? 0;
            $contract->con_totalttc = $data['con_totalttc'] ?? 0;

            // Tracking utilisateur
            $contract->fk_usr_id_author = $userId;
            $contract->fk_usr_id_updater = $userId;

            // Clés étrangères optionnelles
            if (isset($data['fk_ord_id'])) $contract->fk_ord_id = $data['fk_ord_id'];

            // Sauvegarder (déclenche les hooks boot pour génération numéro et validation)
            $contract->save();

            DB::commit();

            return $contract;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Mettre à jour un contrat avec protections et validations
     *
     * @param ContractModel $contract - Le contrat à modifier
     * @param array $data - Les nouvelles données
     * @param int $userId - ID de l'utilisateur
     * @return ContractModel
     * @throws \Exception
     */
    public function updateContract(ContractModel $contract, array $data, int $userId): ContractModel
    {
        try {
            DB::beginTransaction();

            // Validation de la période comptable si con_date est modifiée
            if (isset($data['con_date']) && $data['con_date'] != $contract->con_date) {
                AccountModel::validateWritingPeriod($data['con_date']);
            }

            // Mise à jour des champs
            $contract->fill($data);
            $contract->fk_usr_id_updater = $userId;

            // Sauvegarder (déclenche les hooks boot pour protection et validation)
            $contract->save();

            DB::commit();

            return $contract;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Supprimer un contrat avec protections
     *
     * @param ContractModel $contract - Le contrat à supprimer
     * @return bool
     * @throws \Exception
     */
    public function deleteContract(ContractModel $contract): bool
    {
        try {
            DB::beginTransaction();

            // Supprimer (déclenche le hook boot pour protection)
            $contract->delete();

            DB::commit();

            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
