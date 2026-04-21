<?php

namespace App\Services;

use App\Models\ContractModel;
use App\Models\InvoiceModel;
use App\Models\ContractInvoiceModel;
use App\Models\InvoiceLineModel;
use App\Models\DurationsModel;
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
            $this->copyContractLinesToInvoice($contract, $invoice);


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

        // Vérifier le statut du contrat (ACTIVE=1 ou TERMINATING=2)
        if (!in_array($contract->con_status, [1, 2])) {
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

        // Vérifier qu'il y a des lignes d'abonnement
        $subscriptionLines = $contract->lines->where('col_is_subscription', 1);
        if ($subscriptionLines->isEmpty()) {
            return [
                'valid' => false,
                'message' => "Le contrat {$contract->con_number} n'a pas de lignes d'abonnement"
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
    protected function copyContractLinesToInvoice(ContractModel $contract, InvoiceModel $invoice): void
    {
        // Récupérer uniquement les lignes d'abonnement
        $contractLines = $contract->lines()
            ->where('col_is_subscription', 1)
            ->orderBy('col_order')
            ->get();

        foreach ($contractLines as $contractLine) {
            $invoiceLineData = [
                'fk_inv_id' => $invoice->inv_id,
                'inl_prtlib' => $contractLine->col_prtlib,
                'inl_prtdesc' => $contractLine->col_prtdesc,
                'inl_prttype' => $contractLine->col_prttype,
                'inl_qty' => $contractLine->col_qty,
                'inl_priceunitht' => $contractLine->col_priceunitht,
                'inl_discount' => $contractLine->col_discount,
                'inl_mtht' => $contractLine->col_mtht,
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

        // Utiliser la méthode calculateNextDate du modèle DurationsModel
        $nextDate = DurationsModel::calculateNextDate(
            $contract->fk_dur_id_invoicing,
            $contract->con_next_invoice_date,
            false // Ce n'est pas la première durée
        );

        if ($nextDate) {
            $contract->con_next_invoice_date = $nextDate;
            $contract->save();

            Log::info("Prochaine date de facturation mise à jour", [
                'contract_id' => $contract->con_id,
                'next_invoice_date' => $contract->con_next_invoice_date
            ]);
        } else {
            Log::error("Impossible de calculer la prochaine date de facturation", [
                'contract_id' => $contract->con_id,
                'dur_id' => $contract->fk_dur_id_invoicing
            ]);
        }
    }
}
