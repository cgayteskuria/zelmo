<?php

namespace App\Services;

use App\Models\AccountTaxRepartitionLineModel;
use Illuminate\Support\Facades\DB;

/**
 * Résolution centralisée des tags TVA et des comptes GL.
 *
 * La détection du document_type utilise les 4 valeurs précises du nouvel enum :
 *   out_invoice  — Facture client        (produit 7xx au crédit, client au débit)
 *   out_refund   — Avoir client          (produit 7xx au débit,  client au crédit)
 *   in_invoice   — Facture fournisseur   (charge 6xx au débit,   fournisseur au crédit)
 *   in_refund    — Avoir fournisseur     (charge 6xx au crédit,  fournisseur au débit)
 *
 * La table account_tax_repartition_line_trl utilise ces mêmes 4 valeurs dans
 * trl_document_type (plus de mapping 'invoice'/'refund' nécessaire).
 *
 * Cache statique par requête PHP : évite les N+1 lors des imports massifs.
 */
class TaxTagResolver
{
    /** Cache statique partagé pour toute la durée du script (request-scoped). */
    private static array $cache = [];

    // ─────────────────────────────────────────────────────────────────────────
    // Résolution des tags / comptes GL
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Résout les tags TVA pour une ligne comptable.
     *
     * Retourne un tableau vide si la ligne de répartition n'existe pas ou n'a pas de tags —
     * c'est un cas normal depuis que base HT et TVA peuvent être configurées indépendamment
     * via fk_ttg_id_base / fk_ttg_id_tax dans account_tax_report_mapping_trm.
     *
     * @param  int     $taxId        ID de la taxe (fk_tax_id sur l'AML)
     * @param  bool    $isTaxLine    true = ligne TVA (44571/44566), false = base HT (707/607)
     * @param  string  $documentType out_invoice | out_refund | in_invoice | in_refund
     * @return array   [[ttg_id, ttg_code], ...]  — vide si pas de tag configuré
     */
    /**
     * @param int         $taxId
     * @param bool        $isTaxLine   true = ligne TVA (445xx), false = ligne base HT (6/7xx)
     * @param string      $documentType
     * @param int|null    $accId       Compte GL de la ligne AML — quand fourni, filtre la TRL
     *                                 par fk_acc_id pour éviter les collisions (ex: compte d'attente
     *                                 vs compte TVA définitif sur une même taxe on_payment).
     */
    public static function resolveTagsForLine(int $taxId, bool $isTaxLine, string $documentType, ?int $accId): array
    {
        $repType  = $isTaxLine ? 'tax' : 'base';
        // La clé de cache intègre accId pour les lignes TVA (évite les collisions inter-comptes)
        $cacheKey = "tag_{$taxId}_{$repType}_{$documentType}" . ($isTaxLine && $accId ? "_{$accId}" : '');

        if (!array_key_exists($cacheKey, self::$cache)) {
            $query = AccountTaxRepartitionLineModel::with('tags')
                ->where([
                    'fk_tax_id'            => $taxId,
                    'trl_repartition_type' => $repType,
                    'trl_document_type'    => $documentType,
                ]);

            // Pour les lignes TVA : filtrer par le compte GL de la ligne AML.
            // Garantit que seule la TRL dont fk_acc_id = $accId contribue aux tags,
            // évitant les doublons quand plusieurs TRL existent pour le même type/document_type
            // (ex: compte 44571 définitif ET compte d'attente sur une taxe on_payment).
            if ($isTaxLine && $accId !== null) {
                $query->where('fk_acc_id', $accId);
            }

            self::$cache[$cacheKey] = $query->get();
        }

        $trls = self::$cache[$cacheKey];

        if ($trls->isEmpty()) {
            return [];
        }

        // Agréger les tags de toutes les TRL en conservant le trl_id source pour audit.
        // Un même tag peut apparaître sur plusieurs TRL : on déduplique par ttg_id
        // mais on garde le trl_id de la première TRL qui porte ce tag.
        $seen = [];
        $result = [];
        foreach ($trls as $trl) {
            foreach ($trl->tags as $tag) {
                if (!isset($seen[$tag->ttg_id])) {
                    $seen[$tag->ttg_id] = true;
                    $result[] = [
                        'ttg_id'   => $tag->ttg_id,
                        'ttg_code' => $tag->ttg_code,
                        'trl_id'   => $trl->trl_id,
                    ];
                }
            }
        }
        return $result;
    }

    /**
     * Résout le compte GL TVA (445xx) pour une taxe.
     *
     * @throws \InvalidArgumentException Si aucun compte GL configuré
     */
    public static function resolveGLAccount(int $taxId, string $documentType): array
    {
        $cacheKey = "gl_{$taxId}_{$documentType}";

        if (!array_key_exists($cacheKey, self::$cache)) {
            self::$cache[$cacheKey] = AccountTaxRepartitionLineModel::with('account')
                ->where([
                    'fk_tax_id'            => $taxId,
                    'trl_repartition_type' => 'tax',
                    'trl_document_type'    => $documentType,
                ])->first();
        }

        $trl = self::$cache[$cacheKey];

        if (!$trl || !$trl->fk_acc_id) {
            throw new \InvalidArgumentException(
                "Compte GL (445xx) absent sur la répartition 'tax/{$documentType}' de la taxe #{$taxId}."
            );
        }

        return [
            'id'   => $trl->account->acc_id,
            'code' => $trl->account->acc_code,
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Détection du document_type — source unique de vérité
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Pré-scan global d'un ensemble de lignes pour déterminer le document_type exact.
     *
     * Algorithme à deux phases (priorité classe 6/7 > comptes tiers) :
     *
     * Phase 1 — Comptes de produit / charge (signaux les plus fiables)
     *   income / income_other (7xx)
     *     → au CRÉDIT : out_invoice   (vente normale)
     *     → au DÉBIT  : out_refund    (avoir client / contrepassement de vente)
     *   expense / expense_depreciation / expense_direct_cost (6xx)
     *     → au DÉBIT  : in_invoice    (achat, note de frais)
     *     → au CRÉDIT : in_refund     (avoir fournisseur / contrepassement d'achat)
     *
     * Phase 2 — Comptes tiers (uniquement si aucun compte 6/7 trouvé)
     *   asset_receivable (411xx)
     *     → au DÉBIT  : out_invoice   (le client nous doit)
     *     → au CRÉDIT : out_refund    (on rembourse le client)
     *   liability_payable (401xx)
     *     → au CRÉDIT : in_invoice    (on doit au fournisseur)
     *     → au DÉBIT  : in_refund     (le fournisseur nous rembourse)
     *
     * Retourne null si aucune ligne n'est parlante (ex : écriture purement financière,
     * inter-comptes banque, OD sans compte commercial).
     *
     * @param array $linesData [['fk_acc_id' => int, 'aml_debit' => float, 'aml_credit' => float], ...]
     * @return string|null out_invoice | out_refund | in_invoice | in_refund | null
     */
    public static function detectGlobalDocumentType(array $linesData): ?string
    {
        if (empty($linesData)) {
            return null;
        }

        $accIds = array_values(array_unique(array_filter(array_column($linesData, 'fk_acc_id'))));
        if (empty($accIds)) {
            return null;
        }

        // Une seule requête pour tous les comptes de l'écriture
        $accTypes = DB::table('account_account_acc')
            ->whereIn('acc_id', $accIds)
            ->pluck('acc_type', 'acc_id');

        // ── Phase 1 : comptes de produit / charge (classe 6 et 7) ────────────
        foreach ($linesData as $line) {
            $type   = $accTypes[$line['fk_acc_id'] ?? null] ?? null;
            $debit  = (float)($line['aml_debit']  ?? 0);
            $credit = (float)($line['aml_credit'] ?? 0);

            if (in_array($type, ['income', 'income_other'])) {
                return $credit > 0 ? 'out_invoice' : 'out_refund';
            }

            if (in_array($type, ['expense', 'expense_depreciation', 'expense_direct_cost'])) {
                return $debit > 0 ? 'in_invoice' : 'in_refund';
            }
        }

        // ── Phase 2 : comptes tiers (receivable / payable) ────────────────────
        foreach ($linesData as $line) {
            $type   = $accTypes[$line['fk_acc_id'] ?? null] ?? null;
            $debit  = (float)($line['aml_debit']  ?? 0);
            $credit = (float)($line['aml_credit'] ?? 0);

            if ($type === 'asset_receivable') {
                return $debit > 0 ? 'out_invoice' : 'out_refund';
            }

            if ($type === 'liability_payable') {
                return $credit > 0 ? 'in_invoice' : 'in_refund';
            }
        }

        return null; // Aucun signal — écriture purement financière / intercomptes
    }

    /**
     * Détecte le document_type depuis un objet AML unique (fallback ligne par ligne).
     *
     * Utilisé par AccountMoveLineModel::creating quand $pendingDocumentType est null
     * (ligne créée directement hors saveWithValidation).
     *
     * Applique la même logique de priorité que detectGlobalDocumentType mais
     * sur une seule ligne.
     *
     * @return string out_invoice | out_refund | in_invoice | in_refund
     */
    public static function resolveDocumentTypeFromLine($line): string
    {
        $account = $line->account ?? \App\Models\AccountModel::find($line->fk_acc_id);
        $accType = $account?->acc_type;
        $debit   = (float)($line->aml_debit  ?? 0);
        $credit  = (float)($line->aml_credit ?? 0);

        if (!$accType) {
            return 'out_invoice'; // défaut conservateur
        }

        // Phase 1 : produit / charge
        if (in_array($accType, ['income', 'income_other'])) {
            return $credit > 0 ? 'out_invoice' : 'out_refund';
        }
        if (in_array($accType, ['expense', 'expense_depreciation', 'expense_direct_cost'])) {
            return $debit > 0 ? 'in_invoice' : 'in_refund';
        }

        // Phase 2 : tiers
        if ($accType === 'asset_receivable') {
            return $debit > 0 ? 'out_invoice' : 'out_refund';
        }
        if ($accType === 'liability_payable') {
            return $credit > 0 ? 'in_invoice' : 'in_refund';
        }

        return 'out_invoice'; // défaut : aucun signal
    }

    /**
     * Retourne l'exigibilité de la taxe : 'on_invoice' (par défaut) ou 'on_payment'.
     * Résultat mis en cache pour éviter les N+1 lors des transferts en masse.
     */
    public static function resolveTaxExigibility(int $taxId): string
    {
        $cacheKey = "exigibility_{$taxId}";
        if (!array_key_exists($cacheKey, self::$cache)) {
            $tax = \App\Models\AccountTaxModel::find($taxId);
            self::$cache[$cacheKey] = $tax?->tax_exigibility ?? 'on_invoice';
        }
        return self::$cache[$cacheKey];
    }

    /**
     * Retourne le taux brut d'une taxe (tax_rate), avec cache statique.
     */
    public static function resolveTaxRate(int $taxId): float
    {
        $cacheKey = "taxrate_{$taxId}";
        if (!array_key_exists($cacheKey, self::$cache)) {
            $tax = \App\Models\AccountTaxModel::find($taxId);
            self::$cache[$cacheKey] = $tax ? (float) $tax->tax_rate : 0.0;
        }
        return self::$cache[$cacheKey];
    }

    /**
     * Retourne toutes les lignes TRL de type 'tax' pour une taxe + documentType, avec cache.
     *
     * Chaque élément a : fk_acc_id, trl_factor_percent, account (relation).
     * Permet de gérer TVA normale, autoliquidation et intracommunautaire.
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public static function resolveAllTaxTRLLines(int $taxId, string $documentType)
    {
        $cacheKey = "all_trl_{$taxId}_{$documentType}";
        if (!array_key_exists($cacheKey, self::$cache)) {
            self::$cache[$cacheKey] = AccountTaxRepartitionLineModel::with('account')
                ->where([
                    'fk_tax_id'            => $taxId,
                    'trl_repartition_type' => 'tax',
                    'trl_document_type'    => $documentType,
                ])->get();
        }
        return self::$cache[$cacheKey];
    }

    /**
     * Vide le cache statique.
     * Utile pour les tests unitaires ou entre deux opérations dans le même processus CLI.
     */
    public static function clearCache(): void
    {
        self::$cache = [];
    }
}
