<?php

namespace App\Models;

class EInvoicingTransmissionModel extends BaseModel
{
    protected $table = 'einvoicing_transmission_eit';
    protected $primaryKey = 'eit_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'eit_created';
    const UPDATED_AT = 'eit_updated';

    protected $guarded = ['eit_id'];

    protected $casts = [
        'eit_transmitted_at' => 'datetime',
        'eit_last_event_at'  => 'datetime',
    ];

    // Statuts reflétant le cycle de vie PDP/PPF
    public const STATUS_PENDING      = 'PENDING';
    public const STATUS_DEPOSEE      = 'DEPOSEE';
    public const STATUS_QUALIFIEE    = 'QUALIFIEE';
    public const STATUS_MISE_A_DISPO = 'MISE_A_DISPO';
    public const STATUS_ACCEPTEE     = 'ACCEPTEE';
    public const STATUS_REFUSEE      = 'REFUSEE';
    public const STATUS_EN_PAIEMENT  = 'EN_PAIEMENT';
    public const STATUS_PAYEE        = 'PAYEE';
    public const STATUS_LITIGE       = 'LITIGE';
    public const STATUS_ERROR        = 'ERROR';

    public static function getStatusLabel(string $status): string
    {
        return match ($status) {
            self::STATUS_PENDING      => 'En attente',
            self::STATUS_DEPOSEE      => 'Déposée',
            self::STATUS_QUALIFIEE    => 'Qualifiée',
            self::STATUS_MISE_A_DISPO => 'Mise à disposition',
            self::STATUS_ACCEPTEE     => 'Acceptée',
            self::STATUS_REFUSEE      => 'Refusée',
            self::STATUS_EN_PAIEMENT  => 'En paiement',
            self::STATUS_PAYEE        => 'Payée',
            self::STATUS_LITIGE       => 'En litige',
            self::STATUS_ERROR        => 'Erreur',
            default                   => $status,
        };
    }

    public static function getStatusColor(string $status): string
    {
        return match ($status) {
            self::STATUS_PENDING                                                => 'default',
            self::STATUS_DEPOSEE, self::STATUS_QUALIFIEE                        => 'processing',
            self::STATUS_MISE_A_DISPO                                           => 'processing',
            self::STATUS_ACCEPTEE, self::STATUS_PAYEE                           => 'success',
            self::STATUS_REFUSEE, self::STATUS_ERROR                            => 'error',
            self::STATUS_EN_PAIEMENT                                            => 'warning',
            self::STATUS_LITIGE                                                  => 'error',
            default                                                              => 'default',
        };
    }

    public function invoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id', 'inv_id');
    }

    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }
}
