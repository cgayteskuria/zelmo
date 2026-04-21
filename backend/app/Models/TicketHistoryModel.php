<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TicketHistoryModel extends Model
{
    protected $table = 'ticket_history_tkh';
    protected $primaryKey = 'tkh_id';
    public $incrementing = true;
    public $timestamps = false;

    protected $guarded = ['tkh_id'];

    public function user()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id', 'usr_id');
    }
}
