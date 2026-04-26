<?php

namespace App\Models;

class EInvoicingConfigModel extends BaseModel
{
    protected $table = 'einvoicing_config_eic';
    protected $primaryKey = 'eic_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'eic_created';
    const UPDATED_AT = 'eic_updated';

    protected $guarded = ['eic_id'];

    protected $casts = [
        'eic_entity_registered'    => 'boolean',
        'eic_auto_transmit'        => 'boolean',
        'eic_validate_before_send' => 'boolean',
        'eic_oauth_expires_at'     => 'datetime',
    ];

    // Champs sensibles masqués dans les réponses JSON
    protected $hidden = ['eic_client_secret', 'eic_webhook_secret', 'eic_oauth_token'];

    // Profils pré-configurés (URL + adaptateur, sans nommer les PA explicitement)
    public static array $PROFILES = [
        'custom' => [
            'label'       => 'Personnalisé',
            'api_url'     => '',
            'pdp_adapter' => 'generic',
        ],
    ];

    // Statuts de transmission possibles
    public const STATUS_PENDING     = 'PENDING';
    public const STATUS_DEPOSEE     = 'DEPOSEE';
    public const STATUS_QUALIFIEE   = 'QUALIFIEE';
    public const STATUS_MISE_A_DISPO = 'MISE_A_DISPO';
    public const STATUS_ACCEPTEE    = 'ACCEPTEE';
    public const STATUS_REFUSEE     = 'REFUSEE';
    public const STATUS_EN_PAIEMENT = 'EN_PAIEMENT';
    public const STATUS_PAYEE       = 'PAYEE';
    public const STATUS_LITIGE      = 'LITIGE';
    public const STATUS_ERROR       = 'ERROR';

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }
}
