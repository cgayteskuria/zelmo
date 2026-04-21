<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Services\SaleOrderService;
use App\Services\PurchaseOrderService;
use App\Traits\DeletesRelatedDocuments;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceModel extends BizDocumentModel
{
    use HasFactory, DeletesRelatedDocuments;

    protected $table = 'invoice_inv';
    protected $primaryKey = 'inv_id';

    const CREATED_AT = 'inv_created';
    const UPDATED_AT = 'inv_updated';

    protected $guarded = [];


    /**
     * Hook de démarrage du modèle
     */
    protected static function boot()
    {
        parent::boot();

        // Générer le numéro de facture avant la sauvegarde
        static::saving(function ($model) {
            $moduleMapping = [
                self::OPERATION_CUSTOMER_INVOICE => 'custinvoice',
                self::OPERATION_CUSTOMER_REFUND => 'custrefund',
                self::OPERATION_SUPPLIER_INVOICE => 'supplierinvoice',
                self::OPERATION_SUPPLIER_REFUND => 'supplierrefund',
                self::OPERATION_CUSTOMER_DEPOSIT => 'custdeposit',
                self::OPERATION_SUPPLIER_DEPOSIT => 'supplierdeposit',
            ];

            if (empty($model->inv_number)) {
                if ($model->inv_status == self::STATUS_DRAFT) {
                    // Brouillon : numéro provisoire (PROV-FC-XXXX ou PROV-FF-XXXX)
                    $model->inv_number = static::generateProvisionalNumber($model->inv_operation);
                } else {
                    // Facture créée directement finalisée (ex: avoir via createCreditNote)
                    $lastInvoice = static::where('inv_operation', $model->inv_operation)
                        ->where('inv_number', 'not like', 'PROV-%')
                        ->orderBy('inv_id', 'desc')
                        ->first();
                    $lastNumber = $lastInvoice ? $lastInvoice->inv_number : null;
                    $model->inv_number = static::generateSequenceNumber($moduleMapping[$model->inv_operation], '', $lastNumber);
                }
            }

            // Remplacement du numéro provisoire lors du passage DRAFT → FINALIZED
            if ($model->isDirty('inv_status')
                && $model->inv_status == self::STATUS_FINALIZED
                && str_starts_with($model->inv_number ?? '', 'PROV-')
            ) {
                $lastInvoice = static::where('inv_operation', $model->inv_operation)
                    ->where('inv_number', 'not like', 'PROV-%')
                    ->orderBy('inv_id', 'desc')
                    ->first();
                $lastNumber = $lastInvoice ? $lastInvoice->inv_number : null;
                $model->inv_number = static::generateSequenceNumber($moduleMapping[$model->inv_operation], '', $lastNumber);
            }

            // Valider la période comptable si inv_date est défini ou modifié
            if ($model->isDirty('inv_date') && $model->inv_date) {
                AccountModel::validateWritingPeriod($model->inv_date);
            }

            // Valider qu'il y a au moins une ligne produit (inl_prttype=0) pour passer hors brouillon
            if ($model->isDirty('inv_status') && $model->inv_status > self::STATUS_DRAFT) {
                $model->validateHasProductLine();
            }
        });

        // Protéger les factures finalisées et comptabilisées contre la modification
        static::updating(function ($model) {
            $originalStatus = $model->getOriginal('inv_status');

            // Blocage du retour en brouillon depuis FINALIZED
            if ($originalStatus == self::STATUS_FINALIZED && $model->inv_status == self::STATUS_DRAFT) {
                throw new \Exception('Impossible de repasser une facture finalisée en brouillon');
            }

            // Protection totale pour STATUS_ACCOUNTED
            if ($originalStatus == self::STATUS_ACCOUNTED) {
                throw new \Exception('Impossible de modifier une facture comptabilisée');
            }

            // Protection des champs financiers pour STATUS_FINALIZED
            if ($originalStatus == self::STATUS_FINALIZED) {
                $protectedFields = [
                    'inv_date',
                    'inv_duedate',
                    'inv_operation',
                    'fk_ptr_id',
                    'fk_pam_id',
                    'fk_dur_id_payment_condition',
                    'inv_totalht',
                    'inv_totaltax',
                    'inv_totalttc'
                ];

                foreach ($protectedFields as $field) {
                    if ($model->isDirty($field)) {
                        throw new \Exception('Impossible de modifier les champs financiers d\'une facture finalisée');
                    }
                }
            }
            // Valider qu'il y a au moins une ligne produit (inl_prttype=0) pour passer hors brouillon
            if ($model->isDirty('inv_status') && $model->inv_status > self::STATUS_DRAFT) {
                $model->validateHasProductLine();
            }

             // Valider qu'il y a au moins une ligne produit (inl_prttype=0) pour passer hors edition
            if ($model->isDirty('inv_being_edited')) {
                $model->validateHasProductLine();
            }
        });



        // Empêcher la suppression des factures finalisées et comptabilisées
        static::deleting(function ($model) {
            // Exception pour les avoirs non comptabilisés avec montant restant à 0 (non utilisés)
            $isRefund = $model->isRefund();
            $isNotAccounted = $model->inv_status !== self::STATUS_ACCOUNTED;
            $hasNoRemainingAmount = $model->inv_amount_remaining == 0;

            if ($isRefund && $isNotAccounted && $hasNoRemainingAmount) {
                // Autoriser la suppression des avoirs non comptabilisés et non utilisés
                return;
            }

            if (in_array($model->inv_status, [self::STATUS_FINALIZED, self::STATUS_ACCOUNTED])) {
                throw new \Exception('Impossible de supprimer une facture finalisée ou comptabilisée');
            }
        });

        // Après suppression d'une facture, mettre à jour l'état de facturation de la commande
        static::deleted(function ($model) {
            // Les lignes ont été supprimées en cascade par MySQL
            // On recalcule l'état de facturation de la commande associée
            if ($model->fk_ord_id) {
                $saleOrderService = new SaleOrderService();
                $saleOrderService->updateInvoicingState($model->fk_ord_id);
            }

            if ($model->fk_por_id) {
                $purchaseOrderService = new PurchaseOrderService();
                $purchaseOrderService->updateInvoicingState($model->fk_por_id);
            }
        });
    }

    /**
     * Casts
     */

    protected $casts = [
        'inv_date' => 'date',
        'inv_duedate' => 'date',
        'inv_being_edited' => 'boolean',
        'inv_totalht' => 'decimal:2',
        'inv_totaltax' => 'decimal:2',
        'inv_totalttc' => 'decimal:2',
        'inv_amount_remaining' => 'decimal:2',
        'inv_payment_progress' => 'decimal:2',
    ];

    // Constantes de statut
    const STATUS_DRAFT = 0;
    const STATUS_FINALIZED = 1;
    const STATUS_ACCOUNTED = 2;

    /**
     * Constantes métier – type d'opération
     */
    const OPERATION_CUSTOMER_INVOICE   = 1;
    const OPERATION_CUSTOMER_REFUND    = 2;
    const OPERATION_SUPPLIER_INVOICE   = 3;
    const OPERATION_SUPPLIER_REFUND    = 4;
    const OPERATION_CUSTOMER_DEPOSIT   = 5;
    const OPERATION_SUPPLIER_DEPOSIT   = 6;

    /**
     * Relations communes héritées de BizDocumentModel :
     * - author() : Utilisateur auteur
     * - updater() : Utilisateur modificateur
     * - partner() : Partenaire (client/fournisseur)
     * - paymentMode() : Mode de paiement
     * - paymentCondition() : Condition de paiement
     * - taxPosition() : Position fiscale
     */

    /**
     * Relations spécifiques à Invoice
     */
    public function seller(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_seller', 'usr_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id', 'ctc_id');
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function taxPosition(): BelongsTo
    {
        return $this->belongsTo(AccountTaxPositionModel::class, 'fk_tap_id', 'tap_id');
    }

    public function paymentCondition(): BelongsTo
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_payment_condition', 'dur_id');
    }

    public function paymentMode(): BelongsTo
    {
        return $this->belongsTo(PaymentModeModel::class, 'fk_pam_id', 'pam_id');
    }


    public function lines(): HasMany
    {
        return $this->hasMany(InvoiceLineModel::class, 'fk_inv_id', 'inv_id')->orderBy('inl_order');
    }

    public function saleOrder(): BelongsTo
    {
        return $this->belongsTo(SaleOrderModel::class, 'fk_ord_id', 'ord_id');
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderModel::class, 'fk_por_id', 'por_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(DocumentModel::class, 'fk_doc_id', 'doc_id');
    }

    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_inv_id', 'inv_id');
    }

    public function parentInvoice(): BelongsTo
    {
        return $this->belongsTo(self::class, 'fk_inv_id', 'inv_id');
    }

    public function refundInvoices(): HasMany
    {
        return $this->hasMany(self::class, 'fk_inv_id', 'inv_id');
    }


    /**
     * Scopes
     */
    public function scopeCustomerInvoices($query)
    {
        return  $query->whereIn('inv_operation', [
            self::OPERATION_CUSTOMER_INVOICE,
            self::OPERATION_CUSTOMER_REFUND,
            self::OPERATION_CUSTOMER_DEPOSIT
        ]);
    }

    public function scopeSupplierInvoices($query)
    {
        return   $query->whereIn('inv_operation', [
            self::OPERATION_SUPPLIER_INVOICE,
            self::OPERATION_SUPPLIER_REFUND,
            self::OPERATION_SUPPLIER_DEPOSIT
        ]);
    }

    public function scopeActive($query)
    {
        return $query->whereNotIn('inv_status', [self::STATUS_ACCOUNTED]);
    }

    /**
     * Implémentation des méthodes abstraites de BizDocumentModel
     */

    /**
     * Retourne le mapping des champs du document
     */
    protected function getFieldMapping(): array
    {
        return [
            // Document fields
            'id' => 'inv_id',
            'number' => 'inv_number',
            'date' => 'inv_date',
            'status' => 'inv_status',
            'being_edited' => 'inv_being_edited',
            'total_ht' => 'inv_totalht',
            'total_tax' => 'inv_totaltax',
            'total_ttc' => 'inv_totalttc',
            'partner_id' => 'fk_ptr_id',
            'contact_id' => 'fk_ctc_id',
            'author_id' => 'fk_usr_id_author',
            'updater_id' => 'fk_usr_id_updater',
            'payment_mode_id' => 'fk_pam_id',
            'payment_condition_id' => 'fk_dur_id_payment_condition',
            'tax_position_id' => 'fk_tap_id',
            'note' => 'inv_note',

            // Line fields (utilisés par recalculateTotals)
            'line_type' => 'inl_type',
            'line_total_ht' => 'inl_mtht',
            'line_tax_id' => 'fk_tax_id',
        ];
    }

    /**
     * Détermine le type TRL en fonction de l'opération de la facture.
     *
     * inv_operation → trl_document_type :
     *   1 CUSTOMER_INVOICE  → out_invoice
     *   2 CUSTOMER_REFUND   → out_refund
     *   3 SUPPLIER_INVOICE  → in_invoice
     *   4 SUPPLIER_REFUND   → in_refund
     *   5 CUSTOMER_DEPOSIT  → out_invoice
     *   6 SUPPLIER_DEPOSIT  → in_invoice
     */
    protected function getTrlDocumentType(): string
    {
        return match((int) $this->inv_operation) {
            self::OPERATION_CUSTOMER_INVOICE,
            self::OPERATION_CUSTOMER_DEPOSIT  => 'out_invoice',
            self::OPERATION_CUSTOMER_REFUND   => 'out_refund',
            self::OPERATION_SUPPLIER_INVOICE,
            self::OPERATION_SUPPLIER_DEPOSIT  => 'in_invoice',
            self::OPERATION_SUPPLIER_REFUND   => 'in_refund',
            default => throw new \InvalidArgumentException(
                "InvoiceModel : opération de facture inconnue ({$this->inv_operation})."
            ),
        };
    }

    /**
     * Retourne le nom de la relation pour accéder aux lignes
     */
    protected function getLinesRelationship(): string
    {
        return 'lines';
    }


    /**
     * Génère un numéro provisoire pour les factures en brouillon.
     * Format : PROV-FC-0001 (client) ou PROV-FF-0001 (fournisseur)
     *
     * Doit être appelé dans une transaction DB pour garantir l'unicité (lockForUpdate).
     */
    protected static function generateProvisionalNumber(int $operation): string
    {
        $prefix = in_array($operation, [
            self::OPERATION_CUSTOMER_INVOICE,
            self::OPERATION_CUSTOMER_REFUND,
            self::OPERATION_CUSTOMER_DEPOSIT,
        ]) ? 'FC' : 'FF';

        $pattern = "PROV-{$prefix}-%";

        $last = DB::table('invoice_inv')
            ->where('inv_number', 'like', $pattern)
            ->lockForUpdate()
            ->max('inv_number');

        $lastIncrement = 0;
        if ($last && preg_match('/PROV-(?:FC|FF)-(\d+)$/', $last, $m)) {
            $lastIncrement = (int) $m[1];
        }

        $newIncrement = str_pad($lastIncrement + 1, 4, '0', STR_PAD_LEFT);
        return "PROV-{$prefix}-{$newIncrement}";
    }

    protected function getSequenceModule(): string
    {
        //Dois depandre du inv_number
        return '';
    }

    /**
     * Récupère le dernier numéro de séquence utilisé
     * Implémentation requise par le trait HasSequenceNumber
     */
    protected static function getLastSequenceNumber(): string
    {
        //NE PAS UTILISER CAR le numero ddois dependre du inv_operation
        // $lastInvoice = static::orderBy('inv_id', 'DESC')->first();
        //  return $lastInvoice && $lastInvoice->inv_number ? $lastInvoice->inv_number : '';
        return '';
    }

    /**
     * Valide qu'il y a au moins une ligne produit (inl_prttype=0) dans la facture.
     *
     * @throws ValidationException
     */
    protected function validateHasProductLine(): void
    {
        $hasProductLine = $this->lines()->where('inl_type', 0)->exists();

        if (!$hasProductLine) {
            throw ValidationException::withMessages([
                'lines' => ['La facture doit contenir au moins une ligne produit pour être validée.'],
            ]);
        }
    }

    /**
     * Méthodes métier
     */

    public function isPaid(): bool
    {
        return $this->inv_amount_remaining <= 0;
    }

    public function isCustomerInvoice(): bool
    {
        return in_array($this->inv_operation, [
            self::OPERATION_CUSTOMER_INVOICE,
            self::OPERATION_CUSTOMER_DEPOSIT,
        ]);
    }

    public function isRefund(): bool
    {
        return in_array($this->inv_operation, [
            self::OPERATION_CUSTOMER_REFUND,
            self::OPERATION_SUPPLIER_REFUND,
        ]);
    }

    /**
     * Met à jour le montant restant dû et le pourcentage de paiement d'une facture
     *
     * Cette méthode calcule différemment selon le type d'opération :
     * - Pour les AVOIRS (refund) : calcule combien a été "consommé" comme moyen de paiement
     * - Pour les FACTURES DE DOIT : calcule combien a été payé/réglé
     *
     * @param int|null $invId ID de la facture (null = utilise l'instance actuelle)
     * @return void
     */
    public function updateAmountRemaining(?int $invId = null): void
    {
        // Utiliser l'ID fourni ou celui de l'instance actuelle
        $invoiceId = $invId ?? $this->inv_id;

        if (!$invoiceId) {
            return;
        }

        try {
            // Récupérer les informations de la facture
            $invoice = $invId ? static::find($invoiceId) : $this;

            if (!$invoice) {
                return;
            }

            $isRefund = $invoice->isRefund();
            $totalUsedOrPaid = 0;

            if ($isRefund) {
                // Pour les AVOIRS : calculer combien a été utilisé/remboursé
                // Un avoir peut être "consommé" de deux manières :

                // 1. Utilisé comme moyen de paiement pour régler d'autres factures
                $totalUsedAsPayment = PaymentModel::where('fk_inv_id_refund', $invoiceId)
                    ->join('payment_allocation_pal', 'payment_pay.pay_id', '=', 'payment_allocation_pal.fk_pay_id')
                    ->sum('payment_allocation_pal.pal_amount');

                // 2. Remboursé directement en argent au client/fournisseur
                $totalRefunded = PaymentAllocationModel::where('fk_inv_id', $invoiceId)
                    ->sum('pal_amount');

                $totalUsedOrPaid = ($totalUsedAsPayment ?? 0) + ($totalRefunded ?? 0);
            } else {
                // Pour les FACTURES DE DOIT : calculer combien a été payé
                // Une facture est "réglée" quand elle reçoit des paiements via payment_allocation_pal
                $totalUsedOrPaid = PaymentAllocationModel::where('fk_inv_id', $invoiceId)
                    ->sum('pal_amount');
            }

            // Calculer le montant restant et le pourcentage de progression
            $amountRemaining = round($invoice->inv_totalttc - ($totalUsedOrPaid ?? 0), 2);
            $paymentProgress = $invoice->inv_totalttc != 0
                ? round((($totalUsedOrPaid ?? 0) / $invoice->inv_totalttc) * 100, 2)
                : 0;

            // Mettre à jour sans déclencher les événements (évite les boucles infinies)
            $invoice->updateQuietly([
                'inv_amount_remaining' => $amountRemaining,
                'inv_payment_progress' => $paymentProgress,
            ]);
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors de la mise à jour du montant restant : " . $e->getMessage());
        }
    }

    /**
     * Surcharge de recalculateTotals pour inclure la mise à jour du montant restant
     *
     * @return void
     */
    public function recalculateTotals(): void
    {
        // Appel de la méthode parente pour recalculer les totaux HT, TVA, TTC
        parent::recalculateTotals();

        // Mise à jour du montant restant dû après recalcul des totaux
        $this->updateAmountRemaining();
    }

    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_inv_id';
    }
}
