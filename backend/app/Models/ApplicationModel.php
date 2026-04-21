<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApplicationModel extends Model
{
    protected $table = 'application_app';
    protected $primaryKey = 'app_id';

    protected $fillable = [
        'app_lib',
        'app_slug',
        'app_icon',
        'app_color',
        'app_description',
        'app_order',
        'app_permission',
        'app_root_href',
    ];

    public function menus()
    {
        return $this->hasMany(MenuModel::class, 'fk_app_id', 'app_id');
    }
}
