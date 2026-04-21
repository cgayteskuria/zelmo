<?php

namespace App\Models;

class AccountTaxRepartitionLineModel extends BaseModel
{
    protected $table      = 'account_tax_repartition_line_trl';
    protected $primaryKey = 'trl_id';
    public    $incrementing = true;
    protected $keyType    = 'int';

    protected $guarded = ['trl_id'];

    protected $casts = [
        'trl_factor_percent' => 'decimal:4',
        'trl_sign'           => 'integer',
    ];

    // ── Contrainte d'unicité métier ───────────────────────────────────────────
    // Pour trl_repartition_type = 'tax', le triplet (fk_tax_id, trl_document_type, fk_acc_id)
    // doit être unique : un seul compte TVA GL par type de document pour une taxe donnée.

    protected static function boot()
    {
        parent::boot();

        static::creating(function (self $line) {
            self::assertNoDuplicate($line);
        });

        static::updating(function (self $line) {
            self::assertNoDuplicate($line);
        });
    }

    private static function assertNoDuplicate(self $line): void
    {
        if ($line->trl_repartition_type !== 'tax') {
            return; // Contrainte uniquement sur les lignes TVA
        }

        $exists = self::where('fk_tax_id', $line->fk_tax_id)
            ->where('trl_document_type', $line->trl_document_type)
            ->where('fk_acc_id', $line->fk_acc_id)
            ->when($line->exists, fn($q) => $q->where('trl_id', '!=', $line->trl_id))
            ->exists();

        if ($exists) {
            throw new \InvalidArgumentException(
                "Une ligne de type TVA avec ce compte GL existe déjà pour ce document ({$line->trl_document_type})."
            );
        }
    }

    // ── Relations ─────────────────────────────────────────────────────────────

    public function tax()
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id', 'tax_id');
    }

    public function account()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id', 'acc_id');
    }

    /**
     * Tags TVA associés à cette ligne de ventilation (many-to-many).
     */
    public function tags()
    {
        return $this->belongsToMany(
            AccountTaxTagModel::class,
            'account_tax_repartition_line_tag_rel_rtr',
            'fk_trl_id',
            'fk_ttg_id'
        );
    }
}
