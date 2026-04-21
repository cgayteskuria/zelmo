<?php

namespace App\Models;

class MessageTemplateModel extends BaseModel
{
    protected $table = 'message_template_emt';
    protected $primaryKey = 'emt_id';
    public $incrementing = true;

    const CREATED_AT = 'emt_created';
    const UPDATED_AT = 'emt_updated';

    protected $guarded = ['emt_id'];
}
