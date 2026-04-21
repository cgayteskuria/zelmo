<?php

namespace App\Models;

use App\Traits\HasSequenceNumber;

class TicketModel extends BaseModel
{
    use HasSequenceNumber;

    protected $table = 'ticket_tkt';
    protected $primaryKey = 'tkt_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tkt_created';
    const UPDATED_AT = 'tkt_updated';

    // Protection de la clé primaire
    protected $guarded = ['tkt_id'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->tkt_number)) {
                $lastTicket = static::whereNotNull('tkt_number')
                    ->orderBy('tkt_id', 'desc')
                    ->first();
                $lastNumber = $lastTicket?->tkt_number ?? '';
                $model->tkt_number = static::generateSequenceNumber('ticket', '', $lastNumber);
            }
        });
    }

    protected static function getLastSequenceNumber(): string
    {
        $last = static::whereNotNull('tkt_number')->orderBy('tkt_id', 'DESC')->first();
        return $last?->tkt_number ?? '';
    }

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

    public function assignedTo()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_assignedto', 'usr_id');
    }

    /**
     * Relations contacts
     */
    public function openBy()
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id_openby', 'ctc_id');
    }

    public function openTo()
    {
        return $this->belongsTo(ContactModel::class, 'fk_ctc_id_opento', 'ctc_id');
    }

    /**
     * Relations ticket
     */
    public function status()
    {
        return $this->belongsTo(TicketStatusModel::class, 'fk_tke_id', 'tke_id');
    }

    public function priority()
    {
        return $this->belongsTo(TicketPriorityModel::class, 'fk_tkp_id', 'tkp_id');
    }

    public function source()
    {
        return $this->belongsTo(TicketSourceModel::class, 'fk_tks_id', 'tks_id');
    }

    public function category()
    {
        return $this->belongsTo(TicketCategoryModel::class, 'fk_tkc_id', 'tkc_id');
    }

    public function grade()
    {
        return $this->belongsTo(TicketGradeModel::class, 'fk_tkg_id', 'tkg_id');
    }

    /**
     * Relations optionnelles
     */
    public function partner()
    {
        return $this->belongsTo(PartnerModel::class, 'fk_ptr_id', 'ptr_id');
    }

    public function contract()
    {
        return $this->belongsTo(ContractModel::class, 'fk_con_id', 'con_id');
    }

    /**
     * Articles liés au ticket
     */
    public function articles()
    {
        return $this->hasMany(TicketArticleModel::class, 'tkt_id', 'tkt_id');
    }
}
