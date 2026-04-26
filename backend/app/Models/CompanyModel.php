<?php

namespace App\Models;

use Illuminate\Support\Facades\Schema;

class CompanyModel extends BaseModel
{
    protected $table = 'company_cop';
    protected $primaryKey = 'cop_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'cop_created';
    const UPDATED_AT = 'cop_updated';

    protected $fillable = [
        'cop_label',
        'cop_address',
        'cop_zip',
        'cop_city',
        'cop_phone',
        'cop_registration_code',
        'cop_legal_status',
        'cop_rcs',
        'cop_capital',
        'cop_naf_code',
        'cop_tva_code',
        'fk_eml_id_sale',
        'fk_doc_id_logo_large',
        'fk_doc_id_logo_square',
        'fk_doc_id_logo_printable',
        'cop_cgv',
        'fk_emt_id_reset_password',
        'fk_emt_id_changed_password',
        'fk_eml_id_default',
        'cop_mail_parser',
        'cop_veryfi_client_id',
        'cop_veryfi_client_secret',
        'cop_veryfi_username',
        'cop_veryfi_api_key',
        'fk_usr_id_author',
        'fk_usr_id_updater',
        'cop_url_site',
        'cop_siret',
        'cop_country_code',
    ];
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

    public function emailSale()
    {
        return $this->belongsTo(MessageEmailAccountModel::class, 'fk_eml_id_sale', 'eml_id');
    }

    public function emailDefault()
    {
        return $this->belongsTo(MessageEmailAccountModel::class, 'fk_eml_id_default', 'eml_id');
    }

    public function logoLarge()
    {
        return $this->belongsTo(DocumentModel::class, 'fk_doc_id_logo_large', 'doc_id');
    }

    public function logoSquare()
    {
        return $this->belongsTo(DocumentModel::class, 'fk_doc_id_logo_square', 'doc_id');
    }

    public function logoPrintable()
    {
        return $this->belongsTo(DocumentModel::class, 'fk_doc_id_logo_printable', 'doc_id');
    }

    public function resetPasswordTemplate()
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_reset_password', 'emt_id');
    }

    public function changedPasswordTemplate()
    {
        return $this->belongsTo(MessageTemplateModel::class, 'fk_emt_id_changed_password', 'emt_id');
    }
}
