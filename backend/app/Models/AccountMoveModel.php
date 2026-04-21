<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class AccountMoveModel extends BaseModel
{
    protected $table = 'account_move_amo';
    protected $primaryKey = 'amo_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'amo_created';
    const UPDATED_AT = 'amo_updated';

    // Protéger la clé primaire
    protected $guarded = ['amo_id'];

    /**
     * Cache des exercices comptables par date
     * Format: ['2025-01-15' => 5, '2025-02-20' => 5, ...]
     */
    private static array $exerciseCache = [];

    /**
     * Guard anti-récursion pour la suppression en cascade pay ↔ vat_od.
     * Positionné à true durant la cascade pour éviter les boucles.
     */
    public static bool $cascadeDeleting = false;

    /**
     * Casts
     */
    protected $casts = [
        'amo_date'   => 'date',
        'amo_amount' => 'decimal:2',
        'amo_valid'   => 'date',
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
    public function journal()
    {
        return $this->belongsTo(AccountJournalModel::class, 'fk_ajl_id', 'ajl_id');
    }

    public function exercise()
    {
        return $this->belongsTo(AccountExerciseModel::class, 'fk_aex_id', 'aex_id');
    }

    public function invoice()
    {
        return $this->belongsTo(InvoiceModel::class, 'fk_inv_id', 'inv_id');
    }

    public function payment()
    {
        return $this->belongsTo(PaymentModel::class, 'fk_pay_id', 'pay_id');
    }

    public function expenseReport()
    {
        return $this->belongsTo(ExpenseReportModel::class, 'fk_exr_id', 'exr_id');
    }

    /**
     * Écriture parente (pay) dont cette vat_od dépend.
     * Non null uniquement sur les écritures de type vat_od.
     */
    public function parentMove()
    {
        return $this->belongsTo(self::class, 'fk_amo_id_parent', 'amo_id');
    }

    /**
     * Écritures enfants vat_od liées à ce paiement (pay).
     * Retourne plusieurs éléments si le paiement couvre plusieurs factures.
     */
    public function linkedMoves()
    {
        return $this->hasMany(self::class, 'fk_amo_id_parent', 'amo_id');
    }

    /**
     * Scopes métier
     */
    public function scopeValid($query)
    {
        return $query->whereNotNull('amo_valid');
    }

    public function scopeNotValid($query)
    {
        return $query->whereNull('amo_valid');
    }

    public function scopeForExercise($query, int $exerciseId)
    {
        return $query->where('fk_aex_id', $exerciseId);
    }

    public function scopeForJournal($query, int $journalId)
    {
        return $query->where('fk_ajl_id', $journalId);
    }

    /**
     * Helpers métier
     */
    public function isValid(): bool
    {
        return !is_null($this->amo_valid);
    }

    /**
     * Résout automatiquement le document_type d'une écriture (enum Odoo 4 valeurs).
     *
     * Priorités :
     * 1. Valeur explicite fournie (array_key_exists) → priorité absolue, null inclus
     * 2. Lié à une facture (fk_inv_id) → map direct depuis inv_operation
     * 3. Paiement (fk_pay_id) → 'entry' (pas de TVA directe sur un règlement)
     * 4. Pré-scan des lignes (TaxTagResolver::detectGlobalDocumentType) :
     *    - Priorité aux comptes 6/7 (produit/charge) — signal le plus fiable
     *    - Puis comptes tiers (receivable/payable)
     *    - Couvre aussi les notes de frais sur journal OD (charge au débit → in_invoice)
     * 5. Fallback journal si le scan ne trouve aucun signal :
     *    sale → out_invoice | purchase → in_invoice | autres → entry
     *
     * @param array $linesData Lignes [['fk_acc_id','aml_debit','aml_credit'], ...]
     */
    private static function resolveDocumentType(array $moveData, array $linesData = []): ?string
    {
        // 1. Valeur explicite fournie → priorité absolue (null inclus)
        if (array_key_exists('amo_document_type', $moveData)) {
            return $moveData['amo_document_type'];
        }

        // 2. Lié à une facture → map complet des opérations
        if (!empty($moveData['fk_inv_id'])) {
            $op = DB::table('invoice_inv')
                ->where('inv_id', $moveData['fk_inv_id'])
                ->value('inv_operation');

            return match((int) $op) {
                InvoiceModel::OPERATION_CUSTOMER_INVOICE,
                InvoiceModel::OPERATION_CUSTOMER_DEPOSIT  => 'out_invoice',
                InvoiceModel::OPERATION_CUSTOMER_REFUND   => 'out_refund',
                InvoiceModel::OPERATION_SUPPLIER_INVOICE,
                InvoiceModel::OPERATION_SUPPLIER_DEPOSIT  => 'in_invoice',
                InvoiceModel::OPERATION_SUPPLIER_REFUND   => 'in_refund',
                default                                   => 'entry',
            };
        }

        // 3. Paiement → écriture de règlement, pas de TVA directe
        if (!empty($moveData['fk_pay_id'])) {
            return 'entry';
        }

        // 4. Pré-scan global des lignes (priorité 6/7 > tiers)
        //    Fonctionne pour tous les journaux, y compris OD (note de frais)
        if (!empty($linesData)) {
            $detected = \App\Services\TaxTagResolver::detectGlobalDocumentType($linesData);
            if ($detected !== null) {
                return $detected;
            }
        }

        // 5. Fallback : aucun signal dans les lignes → type de journal
        if (!empty($moveData['fk_ajl_id'])) {
            $journalType = DB::table('account_journal_ajl')
                ->where('ajl_id', $moveData['fk_ajl_id'])
                ->value('ajl_type');

            return match($journalType) {
                AccountJournalModel::TYPE_SALE     => 'out_invoice',
                AccountJournalModel::TYPE_PURCHASE => 'in_invoice',
                default                            => 'entry',
            };
        }

        return null;
    }

    /**
     * Récupère l'ID de l'exercice comptable pour une date donnée
     * Utilise un cache statique pour éviter les appels répétés
     *
     * @param string $date Date au format Y-m-d
     * @return int|null ID de l'exercice ou null si non trouvé
     */
    private static function getExerciseIdForDate(string $date): ?int
    {
        // Vérifier si l'exercice est déjà en cache
        if (isset(self::$exerciseCache[$date])) {
            return self::$exerciseCache[$date];
        }

        // Requête Eloquent pour trouver l'exercice correspondant
        // Utilise value() pour retourner directement la valeur sans créer d'objet
        $exerciseId = AccountExerciseModel::where('aex_start_date', '<=', $date)
            ->where('aex_end_date', '>=', $date)
            ->where(function ($query) {
                $query->where('aex_is_current_exercise', 1)
                    ->orWhere('aex_is_next_exercise', 1);
            })
            ->value('aex_id');

        // Mettre en cache le résultat
        self::$exerciseCache[$date] = $exerciseId;

        return $exerciseId;
    }

    /**
     * Relation vers les lignes
     */
    public function lines()
    {
        return $this->hasMany(AccountMoveLineModel::class, 'fk_amo_id', 'amo_id');
    }

    /**
     * Valide l'équilibre débit/crédit (tolérance 0.00€)
     */
    public function validateBalance(): bool
    {
        $totalDebit = $this->lines()->sum('aml_debit');
        $totalCredit = $this->lines()->sum('aml_credit');
        $difference = abs($totalDebit - $totalCredit);

        if ($difference > 0) {
            throw new \Exception(sprintf(
                'Ecriture déséquilibrée : Débit=%.2f, Crédit=%.2f, Différence=%.2f',
                $totalDebit,
                $totalCredit,
                $difference
            ));
        }
        return true;
    }

    /**
     * Valide le nombre minimum de lignes (2 minimum)
     */
    public function validateMinimumLines(): bool
    {
        $count = $this->lines()->count();
        if ($count < 2) {
            throw new \Exception('Une écriture comptable doit contenir au minimum 2 lignes');
        }
        return true;
    }

    /**
     * Vérifie que la date de l'écriture n'est pas dans un exercice clôturé.
     * Utilise aex_closing_date de l'exercice lié (relation exercise doit être chargée).
     */
    public function validateFiscalLockDate(): bool
    {
        $closingDate = $this->exercise?->aex_closing_date;
        if (!$closingDate || !$this->amo_date) {
            return true;
        }

        if ($this->amo_date <= $closingDate) {
            throw new \Exception(sprintf(
                'La période comptable est clôturée au %s. Impossible de saisir une écriture au %s.',
                $closingDate->format('d/m/Y'),
                $this->amo_date->format('d/m/Y')
            ));
        }
        return true;
    }

    /**
     * Vérifie si une écriture comptable est éditable.
     * Une écriture n'est PAS éditable si elle-même OU une écriture liée (parent pay / enfants vat_od) :
     * - est validée (amo_valid)
     * - contient une ligne lettrée (aml_lettering_code/date)
     * - contient une ligne pointée (aml_abr_code/date)
     * - est rattachée à une déclaration TVA validée (fk_vdl_id)
     *
     * @param int $id
     * @return bool
     */
    public function isEditable($id)
    {
        $idsToCheck = $this->collectLinkedMoveIds($id);

        foreach ($idsToCheck as $checkId) {
            $result = AccountModel::from('account_move_amo as amo')
                ->leftJoin('account_move_line_aml as aml', 'amo.amo_id', '=', 'aml.fk_amo_id')
                ->where('amo.amo_id', $checkId)
                ->select([
                    'amo.amo_valid',
                    'aml.aml_lettering_code',
                    'aml.aml_lettering_date',
                    'aml.aml_abr_code',
                    'aml.aml_abr_date',
                ])
                ->get();

            foreach ($result as $row) {
                if (
                    !empty($row->amo_valid) ||
                    !empty($row->aml_lettering_code) ||
                    !empty($row->aml_lettering_date) ||
                    !empty($row->aml_abr_code) ||
                    !empty($row->aml_abr_date)
                ) {
                    return false;
                }
            }

            // Rattachée à une déclaration TVA validée → intouchable
            $hasVatDeclaration = DB::table('account_move_line_tag_rel_amr as amr')
                ->join('account_move_line_aml as aml', 'amr.fk_aml_id', '=', 'aml.aml_id')
                ->where('aml.fk_amo_id', $checkId)
                ->whereNotNull('amr.fk_vdl_id')
                ->exists();

            if ($hasVatDeclaration) {
                return false;
            }
        }

        return true;
    }

    /**
     * Vérifie l'éditabilité de CETTE écriture uniquement (sans les liées).
     * Utilisé pour distinguer : verrou propre vs verrou provenant d'une écriture liée.
     *
     * @param int $id
     * @return bool
     */
    public function isEditableSelf(int $id): bool
    {
        $result = AccountModel::from('account_move_amo as amo')
            ->leftJoin('account_move_line_aml as aml', 'amo.amo_id', '=', 'aml.fk_amo_id')
            ->where('amo.amo_id', $id)
            ->select([
                'amo.amo_valid',
                'aml.aml_lettering_code',
                'aml.aml_lettering_date',
                'aml.aml_abr_code',
                'aml.aml_abr_date',
            ])
            ->get();

        foreach ($result as $row) {
            if (
                !empty($row->amo_valid) ||
                !empty($row->aml_lettering_code) ||
                !empty($row->aml_lettering_date) ||
                !empty($row->aml_abr_code) ||
                !empty($row->aml_abr_date)
            ) {
                return false;
            }
        }

        return !DB::table('account_move_line_tag_rel_amr as amr')
            ->join('account_move_line_aml as aml', 'amr.fk_aml_id', '=', 'aml.aml_id')
            ->where('aml.fk_amo_id', $id)
            ->whereNotNull('amr.fk_vdl_id')
            ->exists();
    }

    /**
     * Collecte les IDs de l'écriture et de toutes ses écritures liées (parent + enfants vat_od).
     * Utilisé pour propager les vérifications d'éditabilité au groupe pay↔vat_od.
     *
     * @param int $id
     * @return int[]
     */
    private function collectLinkedMoveIds(int $id): array
    {
        $ids = [$id];

        $move = self::select('amo_id', 'fk_amo_id_parent')->find($id);
        if (!$move) return $ids;

        if ($move->fk_amo_id_parent) {
            // Cette écriture est un enfant → ajouter le parent
            $ids[] = $move->fk_amo_id_parent;
            // Ajouter les frères (autres enfants du même parent)
            $siblingIds = self::where('fk_amo_id_parent', $move->fk_amo_id_parent)
                ->where('amo_id', '!=', $id)
                ->pluck('amo_id')
                ->all();
            $ids = array_merge($ids, $siblingIds);
        } else {
            // Cette écriture est un parent → ajouter tous les enfants
            $childIds = self::where('fk_amo_id_parent', $id)->pluck('amo_id')->all();
            $ids = array_merge($ids, $childIds);
        }

        return array_values(array_unique($ids));
    }

    /**
     * Lance une exception descriptive si l'écriture n'est pas éditable.
     * Distingue : déclaration TVA validée / écriture liée verrouillée / lettrage-pointage classique.
     */
    private static function assertEditable(int $moveId, string $action): void
    {
        // 1. Déclaration TVA validée sur cette écriture (message spécifique)
        $hasVatDeclaration = DB::table('account_move_line_tag_rel_amr as amr')
            ->join('account_move_line_aml as aml', 'amr.fk_aml_id', '=', 'aml.aml_id')
            ->where('aml.fk_amo_id', $moveId)
            ->whereNotNull('amr.fk_vdl_id')
            ->exists();

        if ($hasVatDeclaration) {
            throw new \Exception(
                "Impossible de {$action} cette écriture : elle est rattachée à une déclaration de TVA validée."
            );
        }

        // 2. Vérification élargie (inclut les écritures liées pay↔vat_od)
        $accountMove = new AccountMoveModel();
        $idsToCheck  = $accountMove->collectLinkedMoveIds($moveId);

        foreach ($idsToCheck as $checkId) {
            // Déclaration TVA sur une écriture liée
            $linkedVat = DB::table('account_move_line_tag_rel_amr as amr')
                ->join('account_move_line_aml as aml', 'amr.fk_aml_id', '=', 'aml.aml_id')
                ->where('aml.fk_amo_id', $checkId)
                ->whereNotNull('amr.fk_vdl_id')
                ->exists();

            if ($linkedVat) {
                throw new \Exception(
                    "Impossible de {$action} cette écriture : une écriture liée (OD TVA) est rattachée à une déclaration de TVA validée."
                );
            }

            // Lettrage / pointage / validation sur une écriture liée
            $locked = AccountModel::from('account_move_amo as amo')
                ->leftJoin('account_move_line_aml as aml', 'amo.amo_id', '=', 'aml.fk_amo_id')
                ->where('amo.amo_id', $checkId)
                ->where(function ($q) {
                    $q->whereNotNull('amo.amo_valid')
                      ->orWhereNotNull('aml.aml_lettering_code')
                      ->orWhereNotNull('aml.aml_lettering_date')
                      ->orWhereNotNull('aml.aml_abr_code')
                      ->orWhereNotNull('aml.aml_abr_date');
                })
                ->exists();

            if ($locked) {
                $suffix = $checkId !== $moveId
                    ? " (verrou provenant de l'écriture liée #{$checkId})"
                    : '';
                throw new \Exception(
                    "Impossible de {$action} cette écriture : elle contient des lignes lettrées, pointées ou validées{$suffix}."
                );
            }
        }
    }

    /**
     * Valide de manière atomique qu'une écriture comptable est conforme
     * 
     * Cette méthode effectue toutes les validations nécessaires :
     * - Nombre minimum de lignes (2)
     * - Équilibre débit/crédit
     * - Période comptable autorisée
     * - Éditabilité (lettrage, pointage, validation)
     * 
     * @param bool $checkEditability Si true, vérifie si l'écriture est éditable (défaut: true)
     * @param bool $throwException Si true, lance une exception en cas d'erreur (défaut: true)
     * @return array ['valid' => bool, 'errors' => array]
     * @throws \Exception Si throwException est true et qu'une validation échoue
     */
    public function validateCompliance(bool $checkEditability = true, bool $throwException = true): array
    {
        $errors = [];

        // 1. Validation du nombre minimum de lignes
        try {
            $this->validateMinimumLines();
        } catch (\Exception $e) {
            $errors[] = [
                'type' => 'minimum_lines',
                'message' => $e->getMessage()
            ];
        }

        // 2. Validation de l'équilibre débit/crédit
        try {
            $this->validateBalance();
        } catch (\Exception $e) {
            $errors[] = [
                'type' => 'balance',
                'message' => $e->getMessage()
            ];
        }

        // 3. Validation de la période comptable
        try {
            if ($this->amo_date) {
                AccountModel::validateWritingPeriod($this->amo_date);
            }
        } catch (\Exception $e) {
            $errors[] = [
                'type' => 'writing_period',
                'message' => $e->getMessage()
            ];
        }

        // 4. Validation de la date de clôture d'exercice
        try {
            $this->validateFiscalLockDate();
        } catch (\Exception $e) {
            $errors[] = [
                'type' => 'fiscal_lock_date',
                'message' => $e->getMessage()
            ];
        }

        // 5. Validation de l'éditabilité (si demandée)
        /* if ($checkEditability && $this->exists) {
            $editable = $this->isEditable($this->amo_id);
            if (!$editable) {
                $errors[] = [
                    'type' => 'editability',
                    'message' => 'Impossible de modifier une écriture contenant des lignes lettrées, pointées ou validée'
                ];
            }
        }*/

        // Si des erreurs ont été détectées et qu'on doit lancer une exception
        if (!empty($errors) && $throwException) {
            $errorMessages = array_map(function ($error) {
                return $error['message'];
            }, $errors);

            throw new \Exception(
                'Écriture comptable non conforme : ' . implode(' | ', $errorMessages)
            );
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }

    /**
     * Valide de manière atomique une écriture avant sa sauvegarde
     * Cette méthode effectue une transaction pour garantir l'atomicité
     * 
     * @param array $moveData Données de l'écriture (sans les lignes)
     * @param array $linesData Données des lignes
     * @param int|null $moveId ID de l'écriture (null pour création, int pour update)
     * @return AccountMoveModel
     * @throws \Exception Si une validation échoue
     */
    public static function saveWithValidation(array $moveData, array $linesData, ?int $moveId = null): AccountMoveModel
    {
        return DB::transaction(function () use ($moveData, $linesData, $moveId) {
            // 0. Résoudre automatiquement amo_document_type (détecte avoir via acc_type des lignes)
            $moveData['amo_document_type'] = self::resolveDocumentType($moveData, $linesData);

            // 1. Créer ou récupérer l'écriture
            if ($moveId) {
                // MODE UPDATE
                $move = self::findOrFail($moveId);

                // Vérifier l'éditabilité avant modification
                if (!$move->isEditable($moveId)) {
                    throw new \Exception(
                        'Impossible de modifier une écriture contenant des lignes lettrées, pointées ou validée'
                    );
                }

                // Mettre à jour l'écriture
                $move->update($moveData);

                // Casser les auto-références fk_parent_aml_id avant suppression des lignes
                AccountMoveLineModel::where('fk_amo_id', $moveId)->update(['fk_parent_aml_id' => null]);

                // Supprimer les anciennes lignes
                AccountMoveLineModel::where('fk_amo_id', $moveId)->delete();
            } else {
                // MODE CREATE
                $move = self::create($moveData);
            }

            // 2. Créer les nouvelles lignes
            // ── Préparer les lookups TVA en UNE SEULE requête chacun ──────────────
            // Map [acc_id => fk_tax_id] pour les comptes TVA (44571, 44566, …)
            // filtrée sur le document_type de l'écriture afin d'obtenir la bonne taxe.
            $docType = $moveData['amo_document_type'];

            $taxLineMap = DB::table('account_tax_repartition_line_trl')
                ->where('trl_repartition_type', 'tax')
                ->whereNotNull('fk_acc_id')
                ->when($docType, fn($q) => $q->where('trl_document_type', $docType))
                ->pluck('fk_tax_id', 'fk_acc_id')
                ->all(); // [acc_id => tax_id]

            // ── Propagation de fk_tax_id aux lignes de charge/produit ─────────────
            // Collecte toutes les taxes détectées dans l'écriture (TVA lines + lignes
            // dont fk_tax_id est déjà explicitement fourni).
            $allTaxIds = [];
            foreach ($linesData as $ld) {
                $aid = $ld['fk_acc_id'] ?? null;
                if (isset($taxLineMap[$aid])) {
                    $allTaxIds[] = $taxLineMap[$aid];
                } elseif (!empty($ld['fk_tax_id'])) {
                    $allTaxIds[] = (int) $ld['fk_tax_id'];
                }
            }
            $uniqueTaxIds = array_values(array_unique($allTaxIds));

            // Si une seule taxe dans l'écriture : on peut l'attribuer automatiquement
            // aux lignes de charge/produit qui ne l'ont pas encore.
            // Si plusieurs taxes : impossible de deviner quelle taxe va sur quelle ligne →
            // le frontend doit explicitement fournir fk_tax_id par ligne.
            $singleTaxId = count($uniqueTaxIds) === 1 ? $uniqueTaxIds[0] : null;

            // Types de compte "base TVA" (classes 6 et 7) — une seule requête pour tous.
            $baseAccIds = array_values(array_unique(array_filter(
                array_column($linesData, 'fk_acc_id'),
                fn($id) => $id !== null && !isset($taxLineMap[$id])
            )));
            $accTypes = $baseAccIds
                ? DB::table('account_account_acc')
                    ->whereIn('acc_id', $baseAccIds)
                    ->pluck('acc_type', 'acc_id')
                    ->all()
                : [];

            // Communiquer le document_type pré-résolu aux hooks creating/created de l'AML.
            // Évite tout recalcul ligne par ligne (cohérence garantie peu importe l'ordre).
            AccountMoveLineModel::$pendingDocumentType = $docType;

            // Index → aml_id pour la résolution de fk_parent_aml_id (2e passe)
            $createdAmlIds = [];

            try {
                foreach ($linesData as $idx => $lineData) {
                    $accId     = $lineData['fk_acc_id'] ?? null;
                    $isTaxLine = isset($taxLineMap[$accId]);

                    if ($isTaxLine) {
                        // Ligne TVA (445xx) : injecter fk_tax_id si absent
                        if (empty($lineData['fk_tax_id'])) {
                            $lineData['fk_tax_id'] = $taxLineMap[$accId];
                        }
                    } else {
                        // Ligne de charge/produit (6xx/7xx) : propager la taxe si
                        // le compte est de type income/expense et fk_tax_id absent.
                        $accType = $accTypes[$accId] ?? null;
                        $isBaseAccount = in_array($accType, [
                            'income', 'income_other',
                            'expense', 'expense_depreciation', 'expense_direct_cost',
                        ]);
                        if ($isBaseAccount && empty($lineData['fk_tax_id']) && $singleTaxId
                            && empty($lineData['prevent_tax_autofill'])) {
                            $lineData['fk_tax_id'] = $singleTaxId;
                        }
                    }

                    // Propagation du statut de tag (pending pour services on_payment à la facturation)
                    AccountMoveLineModel::$pendingTagStatus = $lineData['tag_status'] ?? 'active';

                    $newLine = AccountMoveLineModel::create(array_merge($lineData, [
                        'fk_ajl_id'       => $move->fk_ajl_id,
                        'fk_amo_id'       => $move->amo_id,
                        'aml_date'        => $moveData['amo_date'] ?? $move->amo_date,
                        'aml_is_tax_line' => $isTaxLine ? 1 : 0,
                    ]));

                    $createdAmlIds[$idx] = $newLine->aml_id;
                }

                // 2e passe : résolution de fk_parent_aml_id via parent_index
                foreach ($linesData as $idx => $lineData) {
                    $parentIndex = $lineData['parent_index'] ?? null;
                    if ($parentIndex !== null && isset($createdAmlIds[$parentIndex]) && isset($createdAmlIds[$idx])) {
                        AccountMoveLineModel::where('aml_id', $createdAmlIds[$idx])
                            ->update(['fk_parent_aml_id' => $createdAmlIds[$parentIndex]]);
                    }
                }
            } finally {
                // Toujours remettre à null/défaut (même en cas d'exception → rollback propre)
                AccountMoveLineModel::$pendingDocumentType = null;
                AccountMoveLineModel::$pendingTagStatus    = 'active';
            }

            // 3. Recharger les lignes et l'exercice (nécessaire pour validateFiscalLockDate)
            $move->load(['lines', 'exercise']);

            // 4. Validation complète et atomique
            $move->validateCompliance(checkEditability: false, throwException: true);

            return $move;
        });
    }

    /**
     * Supprime les lignes AML d'une écriture puis l'écriture elle-même.
     * triggerHooks=true  → delete()      : déclenche deleted() → handleAccountMoveStatusUpdate
     * triggerHooks=false → forceDelete() : bypass hooks (usage cascade vat_od silencieux)
     */
    private static function deleteWithLines(self $move, bool $triggerHooks = false): void
    {
        // Casser les auto-références fk_parent_aml_id avant suppression des lignes
        AccountMoveLineModel::where('fk_amo_id', $move->amo_id)
            ->update(['fk_parent_aml_id' => null]);

        AccountMoveLineModel::where('fk_amo_id', $move->amo_id)->delete();

        if ($triggerHooks) {
            $move->delete();
        } else {
            $move->forceDelete();
        }
    }

    protected static function handleAccountMoveStatusUpdate($accountMove)
    {
        DB::transaction(function () use ($accountMove) {

            // Met à jour le status de invoice
            if (!empty($accountMove->fk_inv_id)) {
                InvoiceModel::where('inv_id', $accountMove->fk_inv_id)
                    ->update(['inv_status' => InvoiceModel::STATUS_FINALIZED]);

                // Si c'est un avoir, remettre à NULL le pay_status des paiements par avoir liés
                $invoice = DB::table('invoice_inv')
                    ->where('inv_id', $accountMove->fk_inv_id)
                    ->first();

                if ($invoice && in_array($invoice->inv_operation, [InvoiceModel::OPERATION_CUSTOMER_REFUND, InvoiceModel::OPERATION_SUPPLIER_REFUND])) {
                    // C'est un avoir (opération 2 = client, 4 = fournisseur)
                    PaymentModel::where('pay_id', $accountMove->fk_pay_id)
                        ->update(['pay_status' => PaymentModel::STATUS_DRAFT]);
                }
            }

            // Met à jour le status du payment
            if (!empty($accountMove->fk_pay_id)) {

                PaymentModel::where('pay_id', $accountMove->fk_pay_id)
                    ->update(['pay_status' => PaymentModel::STATUS_DRAFT]);

                // Récupère les factures liées au paiement
                $paymentAllocations = PaymentModel::leftJoin('payment_allocation_pal', 'payment_pay.pay_id', '=', 'payment_allocation_pal.fk_pay_id')
                    ->where('payment_pay.pay_id', $accountMove->fk_pay_id)
                    ->whereNotNull('payment_allocation_pal.fk_inv_id')
                    ->pluck('payment_allocation_pal.fk_inv_id')
                    ->toArray();

                if (!empty($paymentAllocations)) {
                    // Vérifie si toutes les allocations ne sont plus en compta
                    $hasActiveStatus = PaymentModel::leftJoin('payment_allocation_pal', 'payment_pay.pay_id', '=', 'payment_allocation_pal.fk_pay_id')
                        ->whereIn('payment_allocation_pal.fk_inv_id', $paymentAllocations)
                        ->whereNotNull('payment_pay.pay_status')
                        ->exists();

                    if (!$hasActiveStatus) {
                        // Remet les factures à inv_status=1
                        InvoiceModel::whereIn('inv_id', $paymentAllocations)
                            ->update(['inv_status' => InvoiceModel::STATUS_FINALIZED]);
                    }
                }

            }
        });
    }
    /**
     * Hook boot - Validations critiques
     */
    protected static function boot()
    {
        parent::boot();

        // Définir automatiquement l'exercice comptable à la création
        static::creating(function ($model) {
            if ($model->amo_date && !$model->fk_aex_id) {
                $dateStr = $model->amo_date instanceof \DateTime
                    ? $model->amo_date->format('Y-m-d')
                    : (string) $model->amo_date;

                $exerciseId = self::getExerciseIdForDate($dateStr);
                if ($exerciseId) {
                    $model->fk_aex_id = $exerciseId;
                }
            }
        });

        // Mettre à jour l'exercice comptable si la date change
        static::updating(function ($model) {
            if ($model->isDirty('amo_date') && $model->amo_date) {
                $dateStr = $model->amo_date instanceof \DateTime
                    ? $model->amo_date->format('Y-m-d')
                    : (string) $model->amo_date;

                $exerciseId = self::getExerciseIdForDate($dateStr);
                if ($exerciseId) {
                    $model->fk_aex_id = $exerciseId;
                }
            }
        });

        // Protection écritures lettrées / pointées / déclarées TVA — modification
        // + blocage des écritures liées pay↔vat_od (ne peuvent être modifiées individuellement)
        static::updating(function ($model) {
            if ($model->fk_amo_id_parent || $model->linkedMoves()->exists()) {
                throw new \Exception(
                    "Impossible de modifier cette écriture : elle est liée à une autre écriture (OD TVA encaissements). Supprimez le groupe depuis le règlement."
                );
            }
            self::assertEditable($model->amo_id, 'modifier');
        });

        // Suppression — protection + cascade bidirectionnelle pay↔vat_od
        static::deleting(function ($model) {
            // Hors cascade : vérifier l'éditabilité
            if (!static::$cascadeDeleting) {
                self::assertEditable($model->amo_id, 'supprimer');
            }

            // Déjà en cascade → ne pas boucler
            if (static::$cascadeDeleting) return;

            static::$cascadeDeleting = true;
            try {
                if ($model->fk_amo_id_parent) {
                    // Enfant (vat_od) supprimé → supprimer le parent (pay) + les frères
                    $parent = self::find($model->fk_amo_id_parent);
                    if ($parent) {
                        // Frères : suppression silencieuse (sans hooks → pas de double status update)
                        $parent->linkedMoves()
                            ->where('amo_id', '!=', $model->amo_id)
                            ->each(fn($sibling) => self::deleteWithLines($sibling, false));

                        // Parent : suppression avec hooks → handleAccountMoveStatusUpdate
                        self::deleteWithLines($parent, true);
                    }
                } else {
                    // Parent (pay) supprimé → supprimer silencieusement tous les enfants
                    $model->linkedMoves()
                        ->each(fn($child) => self::deleteWithLines($child, false));
                }
            } finally {
                static::$cascadeDeleting = false;
            }
        });

        static::deleted(function ($accountMove) {
            self::handleAccountMoveStatusUpdate($accountMove);
        });
    }
}
