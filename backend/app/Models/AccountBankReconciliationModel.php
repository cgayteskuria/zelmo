<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\DeletesRelatedDocuments;

class AccountBankReconciliationModel extends BaseModel
{
    use  DeletesRelatedDocuments;

    protected $table = 'account_bank_reconciliation_abr';
    protected $primaryKey = 'abr_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'abr_created';
    const UPDATED_AT = 'abr_updated';

    // Protéger la clé primaire
    protected $guarded = ['abr_id'];

    /**
     * Casts
     */
    protected $casts = [
        'abr_date_start'       => 'date',
        'abr_date_end'         => 'date',
        'abr_initial_balance'  => 'float',
        'abr_final_balance'    => 'float',
        'abr_gap'              => 'float',
        'abr_status'           => 'int',
    ];


    // Constantes de statut
    const STATUS_DRAFT = 0;
    const STATUS_FINALIZED = 1;


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

    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_abr_id', 'abr_id');
    }

    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_abr_id';
    }
}
