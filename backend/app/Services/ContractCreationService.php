<?php

namespace App\Services;

use App\Models\ContractLineModel;
use App\Models\ContractModel;
use App\Models\SaleOrderLineModel;
use App\Models\SaleOrderModel;

/**
 * Crée un contrat d'abonnement à partir d'un bon de commande.
 * Utilisé automatiquement à la signature électronique.
 */
class ContractCreationService
{
    public function __construct(private ContractService $contractService) {}

    /**
     * Crée le contrat et ses lignes depuis toutes les lignes d'abonnement du bon de commande.
     * Les lignes de contrat sont initialisées en STATUS_PENDING (En attente d'activation).
     *
     * @param  SaleOrderModel $saleOrder  La commande signée (doit être STATUS_IN_PROGRESS)
     * @param  int            $userId
     * @return ContractModel|null         null si aucune ligne d'abonnement
     */
    public function createFromSaleOrder(SaleOrderModel $saleOrder, int $userId): ?ContractModel
    {
        $allLines = $saleOrder->lines()->orderBy('orl_order')->get();

        // Séparer lignes d'abonnement et titres associés
        $contractLines = $this->resolveContractLines($allLines);

        if (empty($contractLines)) {
            return null;
        }

        // Calculer les totaux (lignes normales uniquement)
        $totalHt  = 0.0;
        $totalTax = 0.0;
        foreach ($contractLines as $entry) {
            if ($entry['line']->orl_type === 0) {
                $lineHt    = $entry['line']->orl_priceunitht * $entry['line']->orl_qty * (1 - $entry['line']->orl_discount / 100);
                $totalHt  += $lineHt;
                $totalTax += $lineHt * $entry['line']->orl_tax_rate / 100;
            }
        }

        $contract = $this->contractService->createContract([
            'con_date'                    => $saleOrder->ord_date,
            'con_operation'               => ContractModel::OPERATION_CUSTOMER_CONTRACT,
            'con_label'                   => $saleOrder->ord_number,
            'fk_ptr_id'                   => $saleOrder->fk_ptr_id,
            'fk_ctc_id'                   => $saleOrder->fk_ctc_id,
            'fk_pam_id'                   => $saleOrder->fk_pam_id,
            'fk_dur_id_payment_condition' => $saleOrder->fk_dur_id_payment_condition,
            'fk_dur_id_commitment'        => $saleOrder->fk_dur_id,       // Engagement
            'fk_dur_id_renew'             => $saleOrder->fk_dur_id_renew,
            'fk_dur_id_notice'            => $saleOrder->fk_dur_id_notice,
            'fk_dur_id_invoicing'         => $saleOrder->fk_dur_id_invoicing,
            'fk_tap_id'                   => $saleOrder->fk_tap_id,
            'con_note'                    => $saleOrder->ord_note,
            'con_totalht'                 => $totalHt,
            'con_totaltax'                => $totalTax,
            'con_totalttc'                => $totalHt + $totalTax,
            'fk_ord_id'                   => $saleOrder->ord_id,
            'con_status'                  => ContractModel::STATUS_DRAFT,
        ], $userId);

        // Copier les lignes avec statut PENDING
        $lineOrder = 1;
        foreach ($contractLines as $entry) {
            $src  = $entry['line'];
            $col  = new ContractLineModel();
            $col->fk_con_id               = $contract->con_id;
            $col->col_order               = $lineOrder++;
            $col->col_type                = $src->orl_type;
            $col->fk_prt_id               = $src->fk_prt_id;
            $col->fk_tax_id               = $src->fk_tax_id;
            $col->col_prtlib              = $src->orl_prtlib;
            $col->col_prtdesc             = $src->orl_prtdesc;
            $col->col_prttype             = in_array($src->orl_prttype, ['conso', 'service']) ? $src->orl_prttype : null;
            $col->col_note                = $src->orl_note;
            $col->col_priceunitht         = $src->orl_priceunitht;
            $col->col_purchasepriceunitht = $src->orl_purchasepriceunitht;
            $col->col_discount            = $src->orl_discount;
            $col->col_tax_rate            = $src->orl_tax_rate;
            $col->fk_usr_id_author        = $userId;
            $col->fk_usr_id_updater       = $userId;

            if ($src->orl_type === 0) {
                $col->col_qty   = $src->orl_qty;
                $col->col_mtht  = $src->orl_priceunitht * $src->orl_qty * (1 - $src->orl_discount / 100);
                $col->col_status = ContractLineModel::STATUS_PENDING;
                $col->fk_orl_id  = $src->orl_id; // Lien vers la ligne source
            } else {
                $col->col_qty    = 1;
                $col->col_mtht   = 0;
                $col->col_status = ContractLineModel::STATUS_PENDING;
            }

            $col->save();
        }

        // Activer le contrat après insertion des lignes (la validation exige au moins une ligne produit)
        $contract->update(['con_status' => ContractModel::STATUS_ACTIVE]);

        return $contract;
    }

    /**
     * Retourne les entrées à mettre dans le contrat :
     * toutes les lignes d'abonnement (orl_type=0, orl_is_subscription=1)
     * plus les titres/sous-totaux qui les encadrent.
     */
    private function resolveContractLines($allLines): array
    {
        $subscriptionIds = $allLines
            ->where('orl_type', 0)
            ->where('orl_is_subscription', 1)
            ->pluck('orl_id')
            ->toArray();

        if (empty($subscriptionIds)) {
            return [];
        }

        $result = [];

        foreach ($allLines as $line) {
            if ($line->orl_type === 0) {
                if (in_array($line->orl_id, $subscriptionIds)) {
                    $result[] = ['line' => $line];
                }
                continue;
            }

            // Titres (type 1) et sous-totaux (type 2)
            $hasSubscription = false;
            if ($line->orl_type === 1) {
                // Chercher les lignes qui suivent ce titre jusqu'au prochain titre
                foreach ($allLines as $next) {
                    if ($next->orl_order <= $line->orl_order) continue;
                    if ($next->orl_type === 1) break;
                    if ($next->orl_type === 0 && in_array($next->orl_id, $subscriptionIds)) {
                        $hasSubscription = true;
                        break;
                    }
                }
            } elseif ($line->orl_type === 2) {
                // Chercher les lignes précédentes depuis le dernier titre
                $sinceTitle = false;
                foreach ($allLines->sortByDesc('orl_order') as $prev) {
                    if ($prev->orl_order >= $line->orl_order) continue;
                    if ($prev->orl_type === 1) break;
                    if ($prev->orl_type === 0 && in_array($prev->orl_id, $subscriptionIds)) {
                        $hasSubscription = true;
                        break;
                    }
                }
            }

            if ($hasSubscription) {
                $result[] = ['line' => $line];
            }
        }

        return $result;
    }
}
