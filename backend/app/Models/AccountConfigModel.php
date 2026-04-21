<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccountConfigModel extends BaseModel
{
    protected $table = 'account_config_aco';
    protected $primaryKey = 'aco_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'aco_created';
    const UPDATED_AT = 'aco_updated';

    // Protéger la clé primaire
    protected $guarded = ['aco_id'];

    protected static function boot(): void
    {
        parent::boot();

        static::saving(function (self $config) {
            if ($config->aco_vat_regime === 'encaissements') {
                if (empty($config->fk_acc_id_sale_vat_waiting)) {
                    throw new \InvalidArgumentException(
                        'Le compte TVA en attente vente (fk_acc_id_sale_vat_waiting) est obligatoire en régime d\'encaissements.'
                    );
                }
                if (empty($config->fk_acc_id_purchase_vat_waiting)) {
                    throw new \InvalidArgumentException(
                        'Le compte TVA en attente achat (fk_acc_id_purchase_vat_waiting) est obligatoire en régime d\'encaissements.'
                    );
                }
            }
        });
    }

    /**
     * Casts
     */
    protected $casts = [
        'aco_account_length'              => 'int',
        'aco_exercise_start'              => 'date',
        'aco_exercise_end'                => 'date',
        'aco_first_exercise_start_date'   => 'date',
        'aco_first_exercise_end_date'     => 'date',
        'aco_vat_prorata'                 => 'float',
        'aco_vat_alert_enabled'           => 'boolean',
        'aco_vat_alert_days'              => 'int',
        'aco_vat_alert_emails'            => 'array',
    ];

    /**
     * Relations utilisateurs
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    /**
     * Relations comptes comptables
     */
    public function saleAccount()              { return $this->belongsTo(AccountModel::class, 'fk_acc_id_sale', 'acc_id'); }
    public function saleIntraAccount()         { return $this->belongsTo(AccountModel::class, 'fk_acc_id_sale_intra', 'acc_id'); }
    public function saleDepositAccount()       { return $this->belongsTo(AccountModel::class, 'fk_acc_id_sale_advance', 'acc_id'); }
    public function saleVatWaitingAccount()    { return $this->belongsTo(AccountModel::class, 'fk_acc_id_sale_vat_waiting', 'acc_id'); }
    public function saleExportAccount()        { return $this->belongsTo(AccountModel::class, 'fk_acc_id_sale_export', 'acc_id'); }

    public function purchaseAccount()          { return $this->belongsTo(AccountModel::class, 'fk_acc_id_purchase', 'acc_id'); }
    public function purchaseIntraAccount()     { return $this->belongsTo(AccountModel::class, 'fk_acc_id_purchase_intra', 'acc_id'); }
    public function purchaseDepositAccount()   { return $this->belongsTo(AccountModel::class, 'fk_acc_id_purchase_advance', 'acc_id'); }
    public function purchaseVatWaitingAccount(){ return $this->belongsTo(AccountModel::class, 'fk_acc_id_purchase_vat_waiting', 'acc_id'); }
    public function purchaseImportAccount()    { return $this->belongsTo(AccountModel::class, 'fk_acc_id_purchase_import', 'acc_id'); }

    public function customerAccount()          { return $this->belongsTo(AccountModel::class, 'fk_acc_id_customer', 'acc_id'); }
    public function supplierAccount()          { return $this->belongsTo(AccountModel::class, 'fk_acc_id_supplier', 'acc_id'); }
    public function employeeAccount()          { return $this->belongsTo(AccountModel::class, 'fk_acc_id_employee', 'acc_id'); }
    public function mileageExpenseAccount()    { return $this->belongsTo(AccountModel::class, 'fk_acc_id_mileage_expense', 'acc_id'); }
    public function bankAccount()              { return $this->belongsTo(AccountModel::class, 'fk_acc_id_bank', 'acc_id'); }
    public function profitAccount()            { return $this->belongsTo(AccountModel::class, 'fk_acc_id_profit', 'acc_id'); }
    public function lossAccount()              { return $this->belongsTo(AccountModel::class, 'fk_acc_id_loss', 'acc_id'); }
    public function carryForwardAccount()      { return $this->belongsTo(AccountModel::class, 'fk_acc_id_carry_forward', 'acc_id'); }

    /**
     * Relations journaux
     */
    public function purchaseJournal()           { return $this->belongsTo(AccountJournalModel::class, 'fk_ajl_id_purchase', 'ajl_id'); }
    public function saleJournal()               { return $this->belongsTo(AccountJournalModel::class, 'fk_ajl_id_sale', 'ajl_id'); }
    public function bankJournal()               { return $this->belongsTo(AccountJournalModel::class, 'fk_ajl_id_bank', 'ajl_id'); }
    public function openingJournal()            { return $this->belongsTo(AccountJournalModel::class, 'fk_ajl_id_an', 'ajl_id'); }
    public function miscJournal()               { return $this->belongsTo(AccountJournalModel::class, 'fk_ajl_id_od', 'ajl_id'); }


    /**
     * Relation TVA
     */
    public function productSaleTax()
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id_product_sale', 'tax_id');
    }

    public function vatPayableAccount()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_vat_payable', 'acc_id');
    }

    public function vatCreditAccount()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_vat_credit', 'acc_id');
    }

    public function vatAlertTemplate()
    {
        return $this->belongsTo(\App\Models\MessageTemplateModel::class, 'fk_emt_id_vat_alert', 'emt_id');
    }

    public function vatRegularisationAccount()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_vat_regularisation', 'acc_id');
    }

    public function vatRefundAccount()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_vat_refund', 'acc_id');
    }

    public function vatAdvanceAccount()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_vat_advance', 'acc_id');
    }
}
