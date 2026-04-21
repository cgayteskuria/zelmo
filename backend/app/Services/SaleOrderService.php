<?php

namespace App\Services;

use App\Models\SaleOrderModel;
use App\Models\SaleOrderLineModel;
use App\Models\InvoiceLineModel;
use App\Models\InvoiceModel;
use Illuminate\Support\Facades\DB;

class SaleOrderService
{
    /**
     * Met à jour l'état de facturation d'une commande client
     *
     * @param int $orderId ID de la commande
     * @return void
     */
    public function updateInvoicingState(int $orderId): void
    {
        $saleOrder = SaleOrderModel::with('lines')->find($orderId);

        if (!$saleOrder) {
            return;
        }

        // Récupérer toutes les lignes normales de la commande et sans abonnement
        $allLinesNormal = $saleOrder->lines()
            ->where('orl_type', SaleOrderLineModel::LINE_TYPE_NORMAL)
            ->where(function ($q) {
                $q->where('orl_is_subscription', 0)
                    ->orWhereNull('orl_is_subscription');
            })
            ->get();

        // Si aucune ligne normale, on ne facture rien
        if ($allLinesNormal->isEmpty()) {
            $saleOrder->ord_invoicing_state = SaleOrderModel::INVOICING_NOT_INVOICED;
            $saleOrder->save();
            return;
        }

        $fullyInvoiced = true;
        $hasAnyInvoiced = false;

        foreach ($allLinesNormal as $line) {
            // Calculer la quantité totale facturée pour cette ligne
            // En excluant les factures annulées
            $totalInvoicedForLine = InvoiceLineModel::where('invoice_line_inl.fk_orl_id', $line->orl_id)
                ->sum('invoice_line_inl.inl_qty');

            if ($totalInvoicedForLine > 0) {
                $hasAnyInvoiced = true;
            }

            if ($totalInvoicedForLine < $line->orl_qty) {
                $fullyInvoiced = false;
            }
        }

        // Déterminer l'état de facturation
        if ($fullyInvoiced) {
            $saleOrder->ord_invoicing_state = SaleOrderModel::INVOICING_FULLY;
        } elseif ($hasAnyInvoiced) {
            $saleOrder->ord_invoicing_state = SaleOrderModel::INVOICING_PARTIALLY;
        } else {
            $saleOrder->ord_invoicing_state = SaleOrderModel::INVOICING_NOT_INVOICED;
        }

        $saleOrder->save();
    }
}
