<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\DeletesRelatedDocuments;

class AccountExerciseModel extends BaseModel
{
    use DeletesRelatedDocuments;
    protected $table = 'account_exercise_aex';
    protected $primaryKey = 'aex_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'aex_created';
    const UPDATED_AT = 'aex_updated';

    // Protéger la clé primaire
    protected $guarded = ['aex_id'];

    /**
     * Casts
     */
    protected $casts = [
        'aex_start_date'      => 'date',
        'aex_end_date'        => 'date',
        'aex_closing_date'    => 'date',
        'aex_is_current_exercise' => 'bool',
        'aex_is_next_exercise'    => 'bool',
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

    public function closer()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_closer', 'usr_id');
    }

    /**
     * Scopes utiles
     */
    public function scopeCurrent($query)
    {
        return $query->where('aex_is_current_exercise', true);
    }

    public function scopeNext($query)
    {
        return $query->where('aex_is_next_exercise', true);
    }

    public function scopeOpen($query)
    {
        return $query->whereNull('aex_closing_date');
    }

    /**
     * Relation avec les documents
     */
    public function documents()
    {
        return $this->hasMany(DocumentModel::class, 'fk_aex_id', 'aex_id');
    }
    /**
     * Retourne la clé étrangère pour les documents liés
     * Implémentation requise par le trait DeletesRelatedDocuments
     */
    protected static function getDocumentForeignKey(): string
    {
        return 'fk_aex_id';
    }
}
