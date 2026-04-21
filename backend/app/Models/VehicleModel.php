<?php

namespace App\Models;

class VehicleModel extends BaseModel
{
    protected $table = 'vehicle_vhc';
    protected $primaryKey = 'vhc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'vhc_created_at';
    const UPDATED_AT = 'vhc_updated_at';

    protected $fillable = [
        'fk_usr_id',
        'vhc_name',
        'vhc_registration',
        'vhc_fiscal_power',
        'vhc_type',
        'vhc_is_active',
        'vhc_is_default',
    ];

    protected $casts = [
        'vhc_fiscal_power' => 'integer',
        'vhc_is_active' => 'boolean',
        'vhc_is_default' => 'boolean',
    ];

    // Relations
    public function user()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id', 'usr_id');
    }

    public function mileageExpenses()
    {
        return $this->hasMany(MileageExpenseModel::class, 'fk_vhc_id', 'vhc_id');
    }

    public function registrationDocument()
    {
        return $this->hasOne(DocumentModel::class, 'fk_vhc_id', 'vhc_id')->latest('doc_created');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('vhc_is_active', 1);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('fk_usr_id', $userId);
    }
}
