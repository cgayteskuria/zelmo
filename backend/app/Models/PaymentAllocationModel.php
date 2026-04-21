<?php

namespace App\Models;

class PaymentAllocationModel extends BaseModel
{
    protected $table = 'payment_allocation_pal';
    protected $primaryKey = 'pal_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'pay_created';
    const UPDATED_AT = 'pal_updated';

    // Protection de la clé primaire
    protected $guarded = ['pal_id'];

    protected $casts = [
        'pal_amount' => 'decimal:2',
    ];


    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Hook APRÈS la sauvegarde (create ou update)
        static::saved(function ($allocation) {

            // Mettre à jour le montant restant de la facture concernée
            if ($allocation->fk_inv_id) {
                $invoice = InvoiceModel::find($allocation->fk_inv_id);
                if ($invoice) {
                    $invoice->updateAmountRemaining();
                }
            }

            // Mettre à jour le montant restant de la charge concernée
            if ($allocation->fk_che_id) {
                $charge = ChargeModel::find($allocation->fk_che_id);
                if ($charge) {
                    $charge->updateAmountRemaining();
                }
            }

            // Mettre à jour le montant restant de la note de frais concernée
            if ($allocation->fk_exr_id) {
                $expenseReport = ExpenseReportModel::find($allocation->fk_exr_id);
                if ($expenseReport) {
                    $expenseReport->updateAmountRemaining();
                }
            }

            // Mettre à jour le montant restant de l'avoir (refund) utilisé comme moyen de paiement
            $payment = $allocation->payment;
            if ($payment && $payment->fk_inv_id_refund) {
                $refundInvoice = InvoiceModel::find($payment->fk_inv_id_refund);
                if ($refundInvoice) {
                    $refundInvoice->updateAmountRemaining();
                }
            }

            // Mettre à jour le montant disponible du paiement parent
            if ($allocation->fk_pay_id) {
                self::updatePaymentAmountAvailable($allocation->fk_pay_id);
            }
        });
        // Hook AVANT la suppression 
        static::deleting(function ($payment) {           
            // LETTRAGE : Si c'est un avoir, mettre à jour fk_inv_id pour supprimer la liaison avoir x facture
            // Liaison utilisée par le lettrage automatique pour grouper facture + règlement + avoir
            if ($payment && $payment->fk_inv_id_refund) {
                $refundInvoice = InvoiceModel::find($payment->fk_inv_id_refund);
                if ($refundInvoice) {
                    $refundInvoice->update(['fk_inv_id' => null]);
                }
            }
        });
        // Hook APRÈS la suppression
        static::deleted(function ($allocation) {
            // Mettre à jour le montant restant de la facture concernée
            if ($allocation->fk_inv_id) {
                $invoice = InvoiceModel::find($allocation->fk_inv_id);
                if ($invoice) {
                    $invoice->updateAmountRemaining();
                }
            }

            // Mettre à jour le montant restant de la charge concernée
            if ($allocation->fk_che_id) {
                $charge = ChargeModel::find($allocation->fk_che_id);
                if ($charge) {
                    $charge->updateAmountRemaining();
                }
            }

            // Mettre à jour le montant restant de la note de frais concernée
            if ($allocation->fk_exr_id) {
                $expenseReport = ExpenseReportModel::find($allocation->fk_exr_id);
                if ($expenseReport) {
                    $expenseReport->updateAmountRemaining();
                }
            }

            // Mettre à jour le montant restant de l'avoir (refund) utilisé comme moyen de paiement
            $payment = $allocation->payment;
            if ($payment && $payment->fk_inv_id_refund) {
                $refundInvoice = InvoiceModel::find($payment->fk_inv_id_refund);
                if ($refundInvoice) {
                    $refundInvoice->updateAmountRemaining();
                }
            }

            // Mettre à jour le montant disponible du paiement parent
            if ($allocation->fk_pay_id) {
                self::updatePaymentAmountAvailable($allocation->fk_pay_id);
            }
        });
    }

    /**
     * Met à jour le champ pay_amount_available du paiement parent
     * en calculant la différence entre pay_amount et le total des allocations
     * 
     * @param int $paymentId
     * @return void
     */
    protected static function updatePaymentAmountAvailable($paymentId)
    {
        $payment = PaymentModel::find($paymentId);

        if (!$payment) {
            return;
        }

        // Calculer le total des allocations pour ce paiement
        $totalAllocated = self::where('fk_pay_id', $paymentId)
            ->sum('pal_amount');

        // Calculer le montant disponible
        $amountAvailable = $payment->pay_amount - $totalAllocated;

        // Mettre à jour uniquement si la valeur a changé
        if ($payment->pay_amount_available != $amountAvailable) {
            $payment->pay_amount_available = $amountAvailable;
            $payment->save();
        }
    }
    /**
     * Relations
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    public function parentPayment()
    {
        return $this->belongsTo(PaymentModel::class, 'fk_pay_id', 'pay_id');
    }

    public function invoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id', 'inv_id');
    }

    public function charge()
    {
        return $this->belongsTo(ChargeModel::class, 'fk_che_id', 'che_id');
    }

    public function expenseReport()
    {
        return $this->belongsTo(ExpenseReportModel::class, 'fk_exr_id', 'exr_id');
    }

    public function payment()
    {
        return $this->belongsTo(ChargeModel::class, 'fk_pay_id_source', 'pay_id');
    }
}
