<?php

namespace App\Models;

class TimeConfigModel extends BaseModel
{
    protected $table = 'time_config_tmc';
    protected $primaryKey = 'tmc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'tmc_created';
    const UPDATED_AT = 'tmc_updated';

    protected $guarded = ['tmc_id'];

    public function product()
    {
        return $this->belongsTo(ProductModel::class, 'fk_prt_id', 'prt_id');
    }
}
