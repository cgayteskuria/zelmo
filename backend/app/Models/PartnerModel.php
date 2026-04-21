<?php

namespace App\Models;

use App\Traits\DeletesRelatedDocuments;

class PartnerModel extends BaseModel
{
    use DeletesRelatedDocuments;

    protected $table = 'partner_ptr';
    protected $primaryKey = 'ptr_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'insert_at';
    const UPDATED_AT = 'updated_at';

    // Protéger la clé primaire
    protected $guarded = ['ptr_id'];

    /**
     * Champs castés
     */
    protected $casts = [
        'ptr_is_active'   => 'boolean',
        'ptr_is_customer' => 'boolean',
        'ptr_is_supplier' => 'boolean',
        'ptr_is_prospect' => 'boolean',
        'insert_at'       => 'datetime',
        'updated_at'      => 'datetime',
    ];

    /**
     * Champs masqués en sérialisation
     */
    protected $hidden = [];

    /**
     * Accesseurs — label lisible du type de partenaire
     */
    public function getTypeLabelsAttribute(): array
    {
        $labels = [];
        if ($this->ptr_is_customer) $labels[] = 'Client';
        if ($this->ptr_is_supplier) $labels[] = 'Fournisseur';
        if ($this->ptr_is_prospect) $labels[] = 'Prospect';
        return $labels;
    }

    /**
     * Accesseur — nom complet formaté (utile pour les selects)
     */
    public function getDisplayNameAttribute(): string
    {
        return $this->ptr_name ?? '';
    }

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('ptr_is_active', 1);
    }

    public function scopeCustomers($query)
    {
        return $query->where('ptr_is_customer', 1);
    }

    public function scopeSuppliers($query)
    {
        return $query->where('ptr_is_supplier', 1);
    }

    public function scopeProspects($query)
    {
        return $query->where('ptr_is_prospect', 1);
    }

    /**
     * Retourne les types du partenaire sous forme de tableau
     * ex: ['customer', 'prospect']
     */
    public function getTypes(): array
    {
        $types = [];
        if ($this->ptr_is_customer) $types[] = 'customer';
        if ($this->ptr_is_supplier) $types[] = 'supplier';
        if ($this->ptr_is_prospect) $types[] = 'prospect';
        return $types;
    }

    /**
     * Vérifie si le partenaire a au moins un type défini
     */
    public function hasType(): bool
    {
        return $this->ptr_is_customer || $this->ptr_is_supplier || $this->ptr_is_prospect;
    }

    /**
     * Relations — Contacts (many-to-many via pivot)
     */
    public function contacts()
    {
        return $this->belongsToMany(ContactModel::class, 'contact_partner_ctp', 'fk_ptr_id', 'fk_ctc_id');
    }

    /**
     * Relations — Utilisateurs
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    public function seller()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_seller', 'usr_id');
    }

    public function referentTech()
    {
        return $this->belongsTo(UserModel::class, 'usr_id_referenttech', 'usr_id');
    }

    /**
     * Relations — Paiement client
     */
    public function customerPaymentMode()
    {
        return $this->belongsTo(PaymentModeModel::class, 'fk_pam_id_customer', 'pam_id');
    }

    public function customerPaymentCondition()
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_payment_condition_customer', 'dur_id');
    }

    public function customerAccount()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_customer', 'acc_id');
    }

    /**
     * Relations — Paiement fournisseur
     */
    public function supplierPaymentMode()
    {
        return $this->belongsTo(PaymentModeModel::class, 'fk_pam_id_supplier', 'pam_id');
    }

    public function supplierPaymentCondition()
    {
        return $this->belongsTo(DurationsModel::class, 'fk_dur_id_payment_condition_supplier', 'dur_id');
    }

    public function supplierAccount()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_supplier', 'acc_id');
    }

    /**
     * Relations — Divers
     */
    public function taxPosition()
    {
        return $this->belongsTo(AccountTaxPositionModel::class, 'fk_tap_id', 'tap_id');
    }

    public function logo()
    {
        return $this->belongsTo(DocumentModel::class, 'fk_doc_id_logo', 'doc_id');
    }

    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function opportunities()
    {
        return $this->hasMany(ProspectOpportunityModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function prospectActivities()
    {
        return $this->hasMany(ProspectActivityModel::class, 'fk_ptr_id', 'ptr_id');
    }

    /**
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_ptr_id';
    }
}