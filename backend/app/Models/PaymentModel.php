<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
//use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\HasSequenceNumber;


class PaymentModel extends BaseModel
{
    use HasSequenceNumber;

    protected $table = 'payment_pay';
    protected $primaryKey = 'pay_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'pay_created';
    const UPDATED_AT = 'pay_updated';

    // Protection de la clé primaire
    protected $guarded = ['pay_id'];

    // Constantes pour les types d'opération
    const OPERATION_CUSTOMER_PAYMENT = 1;  // Paiement client
    const OPERATION_SUPPLIER_PAYMENT = 2;  // Paiement fournisseur
    const OPERATION_CHARGE_PAYMENT = 3;    // Paiement charge
    const OPERATION_EXPENSE_REPORT_PAYMENT = 4;  // Paiement note de frais

    // Constantes de statut
    const STATUS_DRAFT = 0;
    const STATUS_ACCOUNTED = 2;

    protected $casts = [
        'pay_date' => 'date',
        'pay_amount' => 'decimal:2',
        'pay_amount_available' => 'decimal:2',
    ];

    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Générer le numéro de paiement avant la sauvegarde
        static::saving(function ($model) {
            if (empty($model->pay_number)) {
                // Mapping des types d'opération vers les modules
                $moduleMapping = [
                    self::OPERATION_CUSTOMER_PAYMENT => 'custpayment',
                    self::OPERATION_SUPPLIER_PAYMENT => 'supplierpayment',
                    self::OPERATION_CHARGE_PAYMENT => 'chargepayment',
                    self::OPERATION_EXPENSE_REPORT_PAYMENT => 'expensepayment',
                ];

                // Récupère le dernier numéro généré pour le même type d'opération
                $lastPayment = static::where('pay_operation', $model->pay_operation)
                    ->orderBy('pay_id', 'desc')
                    ->first();
                $lastNumber = $lastPayment ? $lastPayment->pay_number : null;
                $model->pay_number = static::generateSequenceNumber($moduleMapping[$model->pay_operation], '', $lastNumber);
            }
        });

        // Hook AVANT la suppression du paiement
        static::deleting(function ($payment) {
            // Récupérer toutes les allocations pour pouvoir déclencher leurs hooks deleted()
            // (car la cascade DB ne déclenche pas les hooks Eloquent)
            $allocations = PaymentAllocationModel::where('fk_pay_id', $payment->pay_id)->get();

            // Supprimer chaque allocation individuellement pour déclencher les hooks
            foreach ($allocations as $allocation) {
                $allocation->delete();
            }
        });
    }

    /**
     * Récupère le dernier numéro de séquence utilisé
     * Implémentation requise par le trait HasSequenceNumber
     */
    protected static function getLastSequenceNumber(): string
    {
        // NE PAS UTILISER CAR le numéro doit dépendre du pay_operation
        // Le dernier numéro est récupéré dans la méthode boot() selon le type d'opération
        return '';
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

    public function bankDetails()
    {
        return $this->belongsTo(BankDetailsModel::class, 'fk_bts_id', 'bts_id');
    }

    public function paymentMode()
    {
        return $this->belongsTo(PaymentModeModel::class, 'fk_pam_id', 'pam_id');
    }

    public function depositInvoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id_deposit', 'inv_id');
    }

    public function refundInvoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id_refund', 'inv_id');
    }

    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function allocations()
    {
        return $this->hasMany(PaymentAllocationModel::class, 'fk_pay_id', 'pay_id');
    }
}
