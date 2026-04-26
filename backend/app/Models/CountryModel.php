<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CountryModel extends Model
{
    protected $table      = 'country_cty';
    protected $primaryKey = 'cty_code';
    protected $keyType    = 'string';
    public    $incrementing = false;
    public    $timestamps   = false;

    protected $fillable = ['cty_code', 'cty_name', 'cty_is_eu'];

    protected $casts = [
        'cty_is_eu' => 'boolean',
    ];
}
