<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\DeletesRelatedDocuments;

class AccountBackupModel extends BaseModel
{

     use  DeletesRelatedDocuments;

    protected $table = 'account_backup_aba';
    protected $primaryKey = 'aba_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'aba_created';
    const UPDATED_AT = 'aba_updated';

    // Protéger la clé primaire
    protected $guarded = ['aba_id'];

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

        /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_aba_id';
    }
}
