<?php

namespace App\Services;

use App\Models\PurchaseOrderModel;
use App\Models\PurchaseOrderLineModel;
use App\Models\InvoiceLineModel;
use App\Models\InvoiceModel;
use Illuminate\Support\Facades\DB;

class PurchaseOrderService
{
    /**
     * Met à jour l'état de facturation d'une commande fournisseur
     *
     * @param int $porId ID de la commande fournisseur
     * @return void
     */
    public function updateInvoicingState(int $porId): void
    {
        $purchaseOrder = PurchaseOrderModel::with('lines')->find($porId);

        if (!$purchaseOrder) {
            return;
        }

        // Récupérer toutes les lignes normales de la commande
        $allLinesNormal = $purchaseOrder->lines()
            ->where('pol_type', PurchaseOrderLineModel::LINE_TYPE_NORMAL)
            ->get();

        // Si aucune ligne normale, on ne facture rien
        if ($allLinesNormal->isEmpty()) {
            $purchaseOrder->por_invoicing_state = PurchaseOrderModel::INVOICING_NOT_INVOICED;
            $purchaseOrder->save();
            return;
        }

        $fullyInvoiced = true;
        $hasAnyInvoiced = false;

        foreach ($allLinesNormal as $line) {
            // Calculer la quantité totale facturée pour cette ligne
            // En excluant les factures annulées
            $totalInvoicedForLine = InvoiceLineModel::where('invoice_line_inl.fk_pol_id', $line->pol_id)
                ->sum('invoice_line_inl.inl_qty');

            if ($totalInvoicedForLine > 0) {
                $hasAnyInvoiced = true;
            }

            if ($totalInvoicedForLine < $line->pol_qty) {
                $fullyInvoiced = false;
            }
        }

        // Déterminer l'état de facturation
        if ($fullyInvoiced) {
            $purchaseOrder->por_invoicing_state = PurchaseOrderModel::INVOICING_FULLY;
        } elseif ($hasAnyInvoiced) {
            $purchaseOrder->por_invoicing_state = PurchaseOrderModel::INVOICING_PARTIALLY;
        } else {
            $purchaseOrder->por_invoicing_state = PurchaseOrderModel::INVOICING_NOT_INVOICED;
        }

        $purchaseOrder->save();
    }
}
