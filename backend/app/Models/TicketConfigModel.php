<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketConfigModel extends BaseModel
{
    protected $table = 'ticket_config_tco';
    protected $primaryKey = 'tco_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tco_created';
    const UPDATED_AT = 'tco_updated';

    // Protéger la clé primaire
    protected $guarded = ['tco_id'];

    /**
     * Casts
     */
    protected $casts = [
        'tco_send_acknowledgment' => 'boolean',
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
     * Relation email account
     */
    public function emailAccount()
    {
        return $this->belongsTo(MessageEmailAccountModel::class, 'fk_eml_id', 'eml_id');
    }

    /**
     * Relations templates
     */
    public function acknowledgmentTemplate()
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_acknowledgment', 'emt_id');
    }

    public function affectationTemplate()
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_affectation', 'emt_id');
    }

    public function answerTemplate()
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_answer', 'emt_id');
    }
}
