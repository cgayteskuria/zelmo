<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\DeletesRelatedDocuments;

class AccountImportExportModel extends BaseModel
{

     use  DeletesRelatedDocuments;

    protected $table = 'account_import_export_aie';
    protected $primaryKey = 'aie_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'aie_created';
    const UPDATED_AT = 'aie_updated';

    // Protéger la clé primaire
    protected $guarded = ['aie_id'];

    /**
     * Casts
     */
    protected $casts = [
        'aie_sens'           => 'int',   // 1 = import, -1 = export (à documenter côté métier)
        'aie_transfer_start' => 'date',
        'aie_transfer_end'   => 'date',
        'aie_moves_number'   => 'int',
        'aie_moves'          => 'array', // Parsing automatique JSON
    ];

    /**
     * Relations utilisateurs
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }

    /**
     * Relation avec les documents
     */
    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_aie_id', 'aie_id');
    }

    /**
     * Scopes utiles
     */
    public function scopeImports($query)
    {
        return $query->where('aie_sens', 1);
    }

    public function scopeExports($query)
    {
        return $query->where('aie_sens', -1);
    }

    public function scopeBetween($query, $start, $end)
    {
        return $query->whereBetween('aie_transfer_start', [$start, $end]);
    }

    /**
     * Helpers métier
     */
    public function isImport(): bool
    {
        return $this->aie_sens === 1;
    }

    public function isExport(): bool
    {
        return $this->aie_sens === -1;
    }

            /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_aie_id';
    }
}
