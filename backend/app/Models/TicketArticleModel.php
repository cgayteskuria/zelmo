<?php

namespace App\Models;

use App\Traits\DeletesRelatedDocuments;

class TicketArticleModel extends BaseModel
{
    use DeletesRelatedDocuments;

    protected $table = 'ticket_article_tka';
    protected $primaryKey = 'tka_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tka_created';
    const UPDATED_AT = 'tka_updated';

    // Protection de la clé primaire
    protected $guarded = ['tka_id'];

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

    public function user()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id', 'usr_id');
    }

    public function ticket()
    {
        return $this->belongsTo(TicketModel::class, 'tkt_id', 'tkt_id');
    }

    public function contactFrom()
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id_from', 'ctc_id');
    }

    public function contactTo()
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id_to', 'ctc_id');
    }

    public function email()
    {
        return $this->belongsTo(MessageEmailAccountModel::class, 'fk_eml_id', 'eml_id');
    }

    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_tka_id';
    }
}
