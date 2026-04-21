<?php

namespace App\Models;

use App\Services\TaxTagResolver;
use Illuminate\Support\Facades\DB;

class AccountMoveLineModel extends BaseModel
{
    protected $table = 'account_move_line_aml';
    protected $primaryKey = 'aml_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'aml_created';
    const UPDATED_AT = 'aml_updated';

    // Protéger la clé primaire
    protected $guarded = ['aml_id'];

    /**
     * Buffer non-persisté : stocke les tags résolus entre creating et created.
     * DOIT être public pour rester une propriété PHP directe (hors $this->attributes Eloquent).
     * Avec protected, __set() d'Eloquent stockerait la valeur dans $this->attributes,
     * ce qui provoquerait une tentative d'INSERT du tableau comme colonne SQL.
     */
    public ?array $resolvedTagsBuffer = null;

    /**
     * Type de document pré-résolu par AccountMoveModel::saveWithValidation.
     * Positionné AVANT la boucle de création des lignes, remis à null dans le finally.
     * Garantit que toutes les lignes d'une même écriture partagent le même document_type,
     * peu importe leur ordre (ligne TVA en premier, ligne client en dernier, etc.).
     */
    public static ?string $pendingDocumentType = null;

    /**
     * Statut des tags à insérer dans account_move_line_tag_rel_amr pour la prochaine ligne.
     * Positionné par AccountMoveModel::saveWithValidation avant chaque create().
     * - 'active'  : tag comptabilisé dans la CA3 (défaut — on_invoice et OD règlement)
     * - 'pending' : tag différé — service en régime encaissements, activé à l'OD règlement
     * - 'excluded': jamais comptabilisé (cas spéciaux)
     */
    public static string $pendingTagStatus = 'active';

    /**
     * Casts
     */
    protected $casts = [
        'aml_date'              => 'date',
        'aml_credit'            => 'decimal:2',
        'aml_debit'             => 'decimal:2',
        'aml_lettering_date'    => 'date',
        'aml_abr_date'          => 'date',
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
     * Relations métier
     */
    public function move()
    {
        return $this->belongsTo(AccountMoveModel::class, 'fk_amo_id', 'amo_id');
    }

    public function account()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id', 'acc_id');
    }

    public function journal()
    {
        return $this->belongsTo(AccountJournalModel::class, 'fk_ajl_id', 'ajl_id');
    }

    public function bankReconciliation()
    {
        return $this->belongsTo(AccountBankReconciliationModel::class, 'fk_abr_id', 'abr_id');
    }

    /**
     * Taxe ayant généré cette ligne.
     */
    public function tax()
    {
        return $this->belongsTo(AccountTaxModel::class, 'fk_tax_id', 'tax_id');
    }

    /**
     * Tags TVA apposés sur cette ligne (pivot exécution).
     */
    public function taxTags()
    {
        return $this->belongsToMany(
            AccountTaxTagModel::class,
            'account_move_line_tag_rel_amr',
            'fk_aml_id',
            'fk_ttg_id'
        );
    }


    /**
     * Scopes métier
     */
    public function scopeDebit($query)
    {
        return $query->where('aml_debit', '>', 0);
    }

    public function scopeCredit($query)
    {
        return $query->where('aml_credit', '>', 0);
    }

    public function scopeLettered($query)
    {
        return $query->whereNotNull('aml_lettering_code');
    }

    public function scopeNotLettered($query)
    {
        return $query->whereNull('aml_lettering_code');
    }

    public function scopeForAccount($query, int $accountId)
    {
        return $query->where('fk_acc_id', $accountId);
    }

    /**
     * Helpers métier
     */
    public function getBalance(): float
    {
        return ($this->aml_debit ?? 0) - ($this->aml_credit ?? 0);
    }

    public function isDebit(): bool
    {
        return ($this->aml_debit ?? 0) > 0;
    }

    public function isCredit(): bool
    {
        return ($this->aml_credit ?? 0) > 0;
    }

    public function isLettered(): bool
    {
        return !is_null($this->aml_lettering_code);
    }

    /**
     * Met à jour le montant total de l'écriture comptable
     */
    private static function updateMoveAmount(int $moveId): void
    {
        $totalAmount = self::where('fk_amo_id', $moveId)
            ->sum('aml_debit');

        AccountMoveModel::where('amo_id', $moveId)
            ->update(['amo_amount' => $totalAmount]);
    }

    /**
     * Auto-complète fk_tax_id et aml_is_tax_line si absents.
     *
     * Détecte les comptes TVA (44566x, 44571x…) en cherchant dans
     * account_tax_repartition_line_trl (trl_repartition_type = 'tax')
     * l'entrée dont fk_acc_id correspond au compte de la ligne.
     * → fk_tax_id = fk_tax_id de la TRL, aml_is_tax_line = 1.
     *
     * Si $pendingDocumentType est connu, filtre sur trl_document_type pour
     * lever toute ambiguïté quand plusieurs taxes partagent le même compte GL.
     *
     * Si aucune entrée TRL trouvée → ligne sans tag (banque, tiers, etc.) : normal.
     */
    private static function autoFillTaxFields(self $line): void
    {
        if (!empty($line->fk_tax_id) || empty($line->fk_acc_id)) {
            return; // Déjà renseigné ou pas de compte cible
        }

        $accId   = (int) $line->fk_acc_id;
        $docType = static::$pendingDocumentType;

        $query = DB::table('account_tax_repartition_line_trl')
            ->where('fk_acc_id', $accId)
            ->where('trl_repartition_type', 'tax')
            ->whereNotNull('fk_tax_id');

        if ($docType) {
            $query->where('trl_document_type', $docType);
        }

        $trl = $query->first();

        if ($trl) {
            $line->fk_tax_id       = $trl->fk_tax_id;
            $line->aml_is_tax_line = 1;
        }
        // Sinon : ligne sans taxe → pas de tags (comportement normal)
    }

    /**
     * Boot — hooks automatiques
     */
    protected static function boot()
    {
        parent::boot();

        // ── creating : résolution fail-safe des tags TVA ─────────────────────────
        // Si fk_tax_id est présent mais que la config est incomplète → Exception
        // → rollback automatique de la transaction englobante (DB::transaction).
        static::creating(function (self $line) {
            // Auto-complétion de fk_tax_id / aml_is_tax_line AVANT la résolution des tags.
            // Couvre les lignes créées directement sans passer par saveWithValidation.
            self::autoFillTaxFields($line);

            if (empty($line->fk_tax_id)) {
                return; // Pas de taxe → pas de tags (ligne banque, tiers, etc.)
            }

            // Priorité : document_type pré-résolu globalement par saveWithValidation.
            // Toutes les lignes d'une même pièce partagent la même décision,
            // même si la ligne courante est une ligne TVA 445xx sans signal propre.
            // Fallback : détection depuis le compte de la ligne (création directe hors saveWithValidation).
            // Les deux sources retournent le même enum : out_invoice | out_refund | in_invoice | in_refund.
            $documentType = static::$pendingDocumentType
                ?? TaxTagResolver::resolveDocumentTypeFromLine($line);

            // Résout et stocke dans le buffer — lève InvalidArgumentException si config absente.
            // fk_acc_id transmis pour les lignes TVA afin de restreindre à la bonne TRL
            // (évite les doublons quand plusieurs TRL coexistent sur le même tax/document_type).
            $line->resolvedTagsBuffer = TaxTagResolver::resolveTagsForLine(
                (int) $line->fk_tax_id,
                (bool) ($line->aml_is_tax_line ?? 0),
                $documentType,
                $line->aml_is_tax_line ? ((int) $line->fk_acc_id ?: null) : null
            );
        });

        // ── created : insertion des tags résolus ─────────────────────────────────
        // Lit le buffer (déjà résolu — aucune requête supplémentaire).
        // Reset immédiat pour éviter toute réapplication accidentelle.
        static::created(function (self $line) {

            if (empty($line->resolvedTagsBuffer)) {
                // Mise à jour du montant de la move
                if ($line->fk_amo_id) {
                    self::updateMoveAmount($line->fk_amo_id);
                }
                return;
            }

            DB::table('account_move_line_tag_rel_amr')->insert(
                collect($line->resolvedTagsBuffer)->map(fn($tag) => [
                    'fk_aml_id'  => $line->aml_id,
                    'fk_ttg_id'  => $tag['ttg_id'],
                    'fk_trl_id'  => $tag['trl_id'] ?? null,
                    'amr_status' => static::$pendingTagStatus,
                ])->all()
            );

            $line->resolvedTagsBuffer = null; // RESET IMMÉDIAT

            // Mise à jour du montant de la move
            if ($line->fk_amo_id) {
                self::updateMoveAmount($line->fk_amo_id);
            }
        });

        // ── updating : résolution des nouveaux tags si fk_tax_id ou aml_is_tax_line change ──
        static::updating(function (self $line) {
            // Si le compte a changé (ou fk_tax_id absent), tenter l'auto-complétion.
            // Couvre : changement de compte via l'interface sans retransmettre fk_tax_id.
            if ($line->isDirty('fk_acc_id') || empty($line->fk_tax_id)) {
                self::autoFillTaxFields($line);
            }

            if (empty($line->fk_tax_id)) {
                return; // Pas de taxe → pas de tags
            }

            // Ne re-résoudre que si les champs qui influencent les tags ont changé
            if (!$line->isDirty(['fk_tax_id', 'aml_is_tax_line', 'fk_amo_id', 'fk_acc_id'])) {
                return;
            }

            $documentType = static::$pendingDocumentType
                ?? TaxTagResolver::resolveDocumentTypeFromLine($line);

            $line->resolvedTagsBuffer = TaxTagResolver::resolveTagsForLine(
                (int) $line->fk_tax_id,
                (bool) ($line->aml_is_tax_line ?? 0),
                $documentType,
                $line->aml_is_tax_line ? ((int) $line->fk_acc_id ?: null) : null
            );
        });

        // ── updated : remplace les tags si le buffer a été alimenté ──────────────
        static::updated(function (self $line) {
            if ($line->resolvedTagsBuffer !== null) {
                // Supprimer les anciens tags puis insérer les nouveaux
                DB::table('account_move_line_tag_rel_amr')
                    ->where('fk_aml_id', $line->aml_id)
                    ->delete();

                if (!empty($line->resolvedTagsBuffer)) {
                    DB::table('account_move_line_tag_rel_amr')->insert(
                        collect($line->resolvedTagsBuffer)->map(fn($tag) => [
                            'fk_aml_id'  => $line->aml_id,
                            'fk_ttg_id'  => $tag['ttg_id'],
                            'fk_trl_id'  => $tag['trl_id'] ?? null,
                            'amr_status' => static::$pendingTagStatus,
                        ])->all()
                    );
                }

                $line->resolvedTagsBuffer = null; // RESET IMMÉDIAT
            }

            if ($line->fk_amo_id) {
                self::updateMoveAmount($line->fk_amo_id);
            }
        });

        // ── deleted ──────────────────────────────────────────────────────────────
        static::deleted(function ($line) {
            // Les tags sont supprimés par CASCADE FK sur account_move_line_tag_rel_amr.
            if ($line->fk_amo_id) {
                self::updateMoveAmount($line->fk_amo_id);
            }
        });
    }
}
