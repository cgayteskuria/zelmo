<?php

namespace App\Models;

class DocumentModel extends BaseModel
{
    protected $table = 'document_doc';
    protected $primaryKey = 'doc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'doc_created';
    const UPDATED_AT = 'doc_updated';

    // Protection de la clé primaire
    protected $guarded = ['doc_id'];

    // Champs autorisés en assignation de masse
    protected $fillable = [
        'doc_filename',
        'doc_securefilename',
        'doc_filepath',
        'doc_filetype',
        'doc_filesize',
        'fk_usr_id_author',
        'fk_usr_id_updater',
        'fk_ord_id',
        'fk_inv_id',
        'fk_por_id',
        'fk_con_id',
        'fk_dln_id',
        'fk_ptr_id',
        'fk_che_id',
        'fk_abr_id',
        'fk_tka_id',
        'fk_aba_id',
        'fk_aex_id',
        'fk_aie_id',
        'fk_exp_id',
        'fk_vhc_id',
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
     * Relations métier
     */
    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function invoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id', 'inv_id');
    }

    public function saleOrder()
    {
        return $this->belongsTo(SaleOrderModel::class, 'fk_ord_id', 'ord_id');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrderModel::class, 'fk_por_id', 'por_id');
    }

    public function contract()
    {
        return $this->belongsTo(ContractModel::class, 'fk_con_id', 'con_id');
    }

    public function ticketArticle()
    {
        return $this->belongsTo(TicketArticleModel::class, 'fk_tka_id', 'tka_id');
    }

    public function accountBackup()
    {
        return $this->belongsTo(AccountBackupModel::class, 'fk_aba_id', 'aba_id');
    }

    public function accountExercise()
    {
        return $this->belongsTo(AccountExerciseModel::class, 'fk_aex_id', 'aex_id');
    }

    public function accountImportExport()
    {
        return $this->belongsTo(AccountImportExportModel::class, 'fk_aie_id', 'aie_id');
    }

    public function charge()
    {
        return $this->belongsTo(ChargeModel::class, 'fk_che_id', 'che_id');
    }

    public function bankReconciliation()
    {
        return $this->belongsTo(AccountBankReconciliationModel::class, 'fk_abr_id', 'abr_id');
    }

    public function deliveryNote()
    {
        return $this->belongsTo(DeliveryNoteModel::class, 'fk_dln_id', 'dln_id');
    }

    public function expense()
    {
        return $this->belongsTo(ExpenseModel::class, 'fk_exp_id', 'exp_id');
    }

    public function vehicle()
    {
        return $this->belongsTo(VehicleModel::class, 'fk_vhc_id', 'vhc_id');
    }
}
