<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketLinkModel extends Model
{
    protected $table = 'ticket_link_tkl';
    protected $primaryKey = 'tkl_id';
    public $incrementing = true;
    public $timestamps = false;

    protected $guarded = ['tkl_id'];

    public function ticketFrom()
    {
        return $this->belongsTo(TicketModel::class, 'fk_tkt_id_from', 'tkt_id');
    }

    public function ticketTo()
    {
        return $this->belongsTo(TicketModel::class, 'fk_tkt_id_to', 'tkt_id');
    }
}
