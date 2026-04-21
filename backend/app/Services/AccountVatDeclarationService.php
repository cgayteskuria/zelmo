<?php

namespace App\Services;


use App\Models\AccountConfigModel;
use App\Models\AccountExerciseModel;
use App\Models\AccountMoveModel;
use App\Models\AccountTaxReportMappingModel;
use App\Services\AccountLetteringService;
use App\Models\CompanyModel;
use App\Models\AccountTaxDeclarationModel;
use App\Models\AccountTaxDeclarationLineModel;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AccountVatDeclarationService
{
    // ── Régime tag-based : correspondance régime TVA → code mapping ──────────
    private const REGIME_MAP = [
        'reel'      => 'CA3',
        'simplifie' => 'CA12',
    ];


    /**
     * Calcule les lignes d'une déclaration TVA à partir des tags comptables.
     *
     * En mode calcul seul (pas de $saveParams), retourne le tableau de lignes.
     * En mode sauvegarde ($saveParams + $userId fournis), persiste la déclaration
     * via saveDeclaration() et retourne le modèle créé.
     * La config est chargée une seule fois ici et transmise à saveDeclaration.
     *
     * @param string     $periodStart    Date début (Y-m-d)
     * @param string     $periodEnd      Date fin (Y-m-d)
     * @param float      $creditPrevious Crédit reporté de la période précédente
     * @param bool       $includeDraft   Inclure les écritures brouillon
     * @param array|null $saveParams     Paramètres de création (type, regime, etc.) — déclenche la sauvegarde
     * @param int|null   $userId         Auteur — obligatoire si $saveParams fourni
     */
    public function computeLines(
        string  $periodStart,
        string  $periodEnd,
        bool    $includeDraft   = false,
        ?int    $userId         = null,
        ?string $label          = null,
    ): array|AccountTaxDeclarationModel {

        $config        = AccountConfigModel::findOrFail(1);
        $vatSystem     = $config->aco_vat_system;
        $mappingRegime = self::REGIME_MAP[$vatSystem];

        $saveParams['period_start'] = $periodStart;
        $saveParams['period_end'] = $periodEnd;
        // Résolution du crédit reporté en mode sauvegarde

        // 1. Charger toutes les lignes du mapping pour ce régime (triées par trm_order)
        $allTrmRows = AccountTaxReportMappingModel::forRegime($mappingRegime)->get();

        // Aplatir les relations DATA → liste plate (box, ttg_id, col, sign, tax_rate)
        $trmFlat = $this->flattenTrm($allTrmRows);

        // 2. Calculer les montants par tag depuis les écritures
        [$boxTax, $boxBase, $amrIdsByBox] = $this->computeTagBasedAmounts($trmFlat, $periodStart, $periodEnd, $includeDraft);

        // 5. Injecter le crédit antérieur
        // La case PREVIOUS_CREDIT est identifiée via trm_special_type dans le mapping (pas de hardcode).
        // Le montant provient de la ligne vdl_special_type='CURRENT_CREDIT' de la dernière déclaration validée.
        $previousCreditRow = $allTrmRows->firstWhere('trm_special_type', 'PREVIOUS_CREDIT');
        $creditBox         = $previousCreditRow?->trm_box;
        $creditPrevious    = $this->resolveCarryoverCredit($vatSystem, $periodStart);

        if ($creditBox && $creditPrevious > 0) {
            $boxTax[$creditBox] = ($boxTax[$creditBox] ?? 0) + round($creditPrevious, 0);
        }

        // 6. Évaluer les formules des cases FORMULA
        [$boxTax, $boxBase] = $this->evaluateFormulas($allTrmRows, $boxTax, $boxBase);

        // 7. Construire le tableau de lignes dans le format vdl
        $lines = $this->buildLines($allTrmRows, $boxTax, $boxBase, $creditPrevious, $creditBox, $amrIdsByBox);

        // 8. Sauvegarde si les paramètres sont fournis (config déjà chargée — pas de double findOrFail)
        if ($saveParams !== null && $userId !== null) {
            $saveParams['period_start']    = $periodStart;
            $saveParams['period_end']      = $periodEnd;
            $saveParams['credit_previous'] = $creditPrevious;
            $saveParams['vdc_label']       = $label;

            return $this->saveDeclaration($config, $vatSystem, $lines, $amrIdsByBox, $saveParams, $userId);
        }

        return $lines;
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Construit la liste plate des relations tag depuis les lignes DATA du mapping.
     * Chaque élément : ['box', 'ttg_id', 'col', 'sign', 'tax_rate']
     *
     * Une ligne DATA peut contribuer à deux colonnes :
     *   - fk_ttg_id_base → col='base_ht'
     *   - fk_ttg_id_tax  → col='tax_amount'
     */
    private function flattenTrm($allTrmRows): array
    {
        $flat = [];
        foreach ($allTrmRows as $trm) {
            // NULL traité comme DATA (compat. données existantes sans trm_row_type renseigné)
            if ($trm->trm_row_type !== null && $trm->trm_row_type !== 'DATA') {
                continue;
            }
            //  $sign = (int)($trm->trm_sign ?? 1);

            if ($trm->fk_ttg_id_base) {
                $flat[] = [
                    'box'      => $trm->trm_box,
                    'ttg_id'   => $trm->fk_ttg_id_base,
                    'col'      => 'base_ht',
                    //  'sign'     => $sign,
                    'tax_rate' => null, // base HT directe, pas d'inversion
                ];
            }

            if ($trm->fk_ttg_id_tax) {
                $flat[] = [
                    'box'      => $trm->trm_box,
                    'ttg_id'   => $trm->fk_ttg_id_tax,
                    'col'      => 'tax_amount',
                    // 'sign'     => $sign,
                    'tax_rate' => $trm->trm_tax_rate,
                ];
            }
        }
        return $flat;
    }

    /**
     * Requête SQL groupée : somme nette (crédit - débit) par tag sur la période.
     *
     * Retourne [$boxTax, $boxBase] — deux tableaux séparés indexés par code de case.
     *     
     */
    private function computeTagBasedAmounts(array $tbrFlat, string $start, string $end,  bool $includeDraft = false): array
    {
        $boxTax  = [];
        $boxBase = [];

        if (empty($tbrFlat)) {
            return [$boxTax, $boxBase];
        }

        $allTagIds = array_values(array_unique(array_column($tbrFlat, 'ttg_id')));

        // Filtre double :
        //   1. amo_date dans la période déclarée (scope temporel).
        //   2. amr.fk_vdl_id IS NULL : non encore rattaché à une déclaration validée.
        //      Une écriture backdatée sur une période déjà clôturée aura fk_vdl_id non null → exclue.
        //      Une écriture backdatée sur une période non encore déclarée → incluse normalement.
        $query = DB::table('account_move_line_aml as aml')
            ->join('account_move_amo as amo', 'amo.amo_id', '=', 'aml.fk_amo_id')
            ->join('account_move_line_tag_rel_amr as amr', 'amr.fk_aml_id', '=', 'aml.aml_id')
            ->when(!$includeDraft, fn($q) => $q->whereNotNull('amo.amo_valid'))
            ->whereNull('amr.fk_vdl_id')
            ->where('amr.amr_status', 'active')
            ->whereBetween('amo.amo_date', [$start, $end])
            ->whereIn('amr.fk_ttg_id', $allTagIds);

        $rows = $query
            ->select(
                'amr.amr_id',
                'amr.fk_ttg_id',
                'amr.fk_aml_id',
                'amr.fk_trl_id',
                DB::raw("SUM(
                    CASE
                        -- VENTES
                        WHEN amo.amo_document_type = 'out_invoice'
                            THEN aml.aml_credit - aml.aml_debit

                        WHEN amo.amo_document_type = 'out_refund'
                            THEN (aml.aml_credit - aml.aml_debit)

                        -- ACHATS
                        WHEN amo.amo_document_type = 'in_invoice'
                            THEN aml.aml_debit - aml.aml_credit

                        WHEN amo.amo_document_type = 'in_refund'
                            THEN (aml.aml_debit - aml.aml_credit)

                        ELSE 0
                    END
                ) as net")
            )
            ->groupBy('amr.amr_id', 'amr.fk_ttg_id', 'amr.fk_aml_id', 'amr.fk_trl_id')
            ->get();

        // Récupérer trl_factor_percent pour les fk_trl_id trouvés dans les rows
        $trlIds = $rows->pluck('fk_trl_id')->filter()->unique()->values()->all();
        $trlFactors = $trlIds
            ? DB::table('account_tax_repartition_line_trl')
            ->whereIn('trl_id', $trlIds)
            ->pluck('trl_factor_percent', 'trl_id')
            ->all()
            : [];

        // Agréger net × sign(trl_factor_percent) par tag
        $rawAmounts = $rows->groupBy('fk_ttg_id')->map(function ($g) use ($trlFactors) {
            return $g->reduce(function ($carry, $row) use ($trlFactors) {
                $factor = (float) ($trlFactors[$row->fk_trl_id] ?? 1);
                $sign   = $factor < 0 ? -1 : 1;

                return $carry + ((float) $row->net * $sign);
            }, 0.0);
        });

        // Indexer les amr_id par ttg_id pour la liaison précise box → amr_id
        // Structure : [ttg_id => [amr_id, ...]]
        $amrIdsByTag = [];
        foreach ($rows as $row) {
            $amrIdsByTag[$row->fk_ttg_id][] = $row->amr_id;
        }

        $amrIdsByBox = []; // [box => [amr_id, ...]] — PK de account_move_line_tag_rel_amr

        // Agréger par case et par colonne (base_ht ou tax_amount)
        foreach ($tbrFlat as $rel) {
            $balance = (float)($rawAmounts[$rel['ttg_id']] ?? 0);

            if ($rel['col'] === 'base_ht') {
                $boxBase[$rel['box']] = ($boxBase[$rel['box']] ?? 0) + $balance;
            } else {
                $boxTax[$rel['box']] = ($boxTax[$rel['box']] ?? 0) + $balance;
            }

            // Rattacher les amr_id du tag à la case — filtre précis par ttg_id
            foreach ($amrIdsByTag[$rel['ttg_id']] ?? [] as $amrId) {
                $amrIdsByBox[$rel['box']][] = $amrId;
            }
        }

        // Arrondi fiscal — conserve les négatifs
        foreach ($boxTax as &$v) {
            $v = round($v, 0); // Arrondit à l'entier le plus proche (-1.5 devient -2)
        }
        unset($v);

        foreach ($boxBase as &$v) {
            $v = round($v, 0);
        }
        unset($v);

        return [$boxTax, $boxBase, $amrIdsByBox];
    }


    /**
     * Évalue les formules des lignes du mapping.
     *
     * Stratégie en deux phases :
     *
     * Phase A — avant clamp_zero (passe 1) :
     *   Les max0diff dont les deux opérandes sont des cases DATA brutes (pas calculées
     *   par une autre formule) s'exécutent en premier. Cela permet à case 15 de lire
     *   la valeur brute (négative) de case 20 avant qu'elle ne soit clampée à 0.
     *
     * Phase B — après clamp_zero (passe 2 → convergence) :
     *   clamp_zero est appliqué, puis toutes les formules restantes (sum, max0diff sur
     *   cases calculées) sont évaluées en boucle jusqu'à convergence. Cette approche
     *   itérative gère des chaînes arbitraires sans ordre fixe de passes :
     *   case 23 (sum) → TD (max0diff) → case 28 (max0diff sur TD) → case 32 (sum sur 28).
     *
     * Retourne [$boxTax, $boxBase].
     */
    private function evaluateFormulas($allTrmRows, array $boxTax, array $boxBase): array
    {
        // Cases dont la valeur est CALCULÉE par une formule (sum, max0diff).
        // clamp_zero exclu : il ajuste une valeur brute, ne la calcule pas.
        $computedBoxes = [];
        foreach ($allTrmRows as $trm) {
            $f = $trm->trm_formula;
            if ($f && ($f['op'] ?? null) !== 'clamp_zero') {
                $computedBoxes[$trm->trm_box] = true;
            }
        }

        $evalFormula = function (array $f) use (&$boxTax, &$boxBase): int {
            return match ($f['op'] ?? null) {
                'max0diff' => (int) round(max(
                    0,
                    ($boxTax[$f['minuend']]    ?? 0) -
                        ($boxTax[$f['subtrahend']] ?? 0)
                ), 0),

                'sum' => isset($f['refs'])
                    ? (int) round(array_sum(array_map(fn($r) => (
                        ($r['col'] ?? 'tax_amount') === 'base_ht'
                        ? ($boxBase[$r['box']] ?? 0)
                        : ($boxTax[$r['box']]  ?? 0)
                    ), $f['refs'])), 0)
                    : (int) round(array_sum(
                        array_map(fn($b) => $boxTax[$b] ?? 0, $f['boxes'] ?? [])
                    ), 0),

                default => 0,
            };
        };

        // Phase A — Passe 1 : max0diff sur cases DATA brutes uniquement (avant clamp_zero)
        // Ces formules ont besoin des valeurs brutes (ex. case 15 lit le négatif de case 20).
        $pass1Boxes = [];
        foreach ($allTrmRows as $trm) {
            $f = $trm->trm_formula;
            if (!$f || ($f['op'] ?? null) !== 'max0diff') continue;
            if (isset($computedBoxes[$f['minuend']]) || isset($computedBoxes[$f['subtrahend']])) continue;
            $boxTax[$trm->trm_box] = $evalFormula($f);
            $pass1Boxes[$trm->trm_box] = true;
        }

        // Phase A — Passe 2 : clamp_zero
        foreach ($allTrmRows as $trm) {
            $f = $trm->trm_formula;
            if (!$f || ($f['op'] ?? null) !== 'clamp_zero') continue;
            $code = $trm->trm_box;
            if (isset($boxTax[$code]) && $boxTax[$code] < 0) {
                $boxTax[$code] = 0;
            }
        }

        // Phase B — convergence itérative pour toutes les formules restantes.
        // Chaque itération recalcule les cases qui ont changé ; on s'arrête dès
        // qu'aucune valeur ne varie (convergence garantie pour un formulaire sans cycle).
        $maxIterations = 20;
        for ($iter = 0; $iter < $maxIterations; $iter++) {
            $changed = false;
            foreach ($allTrmRows as $trm) {
                $f = $trm->trm_formula;
                if (!$f) continue;
                $op   = $f['op'] ?? null;
                $code = $trm->trm_box;

                if ($op === 'clamp_zero') continue;           // déjà traité
                if (isset($pass1Boxes[$code])) continue;      // déjà traité en phase A

                $new = $evalFormula($f);
                $old = $boxTax[$code] ?? null;
                if ($new !== $old) {
                    $boxTax[$code] = $new;
                    $changed = true;
                }
            }
            if (!$changed) break;
        }

        return [$boxTax, $boxBase];
    }

    /**
     * Construit le tableau final de lignes vdl à partir des montants calculés.
     *
     * Itère les lignes du mapping dans l'ordre trm_order.
     * Les lignes TITLE/SUBTITLE/SUBTITLE2 sont incluses directement (hiérarchie native).    
     */
    private function buildLines(
        $allTrmRows,
        array $boxTax,
        array $boxBase,
        float $creditPrevious,
        string $creditBox,
        array $amrIdsByBox = []
    ): array {
        // Injecter le crédit si la case n'a pas encore de montant calculé
        if ($creditPrevious > 0 && !isset($boxTax[$creditBox])) {
            $boxTax[$creditBox] = round($creditPrevious, 0);
        }

        // --- Passe 1 ---
        $keptCodes = [];

        foreach ($allTrmRows as $trm) {
            $rowType = $trm->trm_row_type;
            $code    = $trm->trm_box;

            if ($rowType === 'DATA') {
                $tva  = (float)($boxTax[$code] ?? 0);
                $base = (float)($boxBase[$code] ?? 0);

                // Garder si montant non nul OU si des écritures comptables contribuent à cette case
                if ((int)$tva !== 0 || (int)$base !== 0 || !empty($amrIdsByBox[$code])) {
                    $keptCodes[$code] = true;
                }
            }

            // Toutes les lignes avec un trm_special_type sont toujours conservées
            if ($trm->trm_special_type !== null) {
                $keptCodes[$code] = true;
            }
        }

        // --- Passe 2 --- on garde les lignes de formule qui font référence à une ligne data précédente
        foreach ($allTrmRows as $trm) {

            $f = $trm->trm_formula;
            if (!$f) {
                continue;
            }

            $code = $trm->trm_box;

            // Toujours conserver : valeur non nulle, trm_special_type renseigné, ou case '01'
            $alwaysKeep = $trm->trm_special_type !== null || $code === '01';

            $referencedCodes = match ($f['op'] ?? null) {
                'sum'      => isset($f['refs']) ? array_column($f['refs'], 'box') : ($f['boxes'] ?? []),
                'max0diff' => array_filter([$f['minuend'] ?? null, $f['subtrahend'] ?? null]),
                default    => [],
            };

            foreach ($referencedCodes as $refCode) {
                if (isset($keptCodes[$refCode])) {
                    if ($alwaysKeep || (int)($boxTax[$code] ?? 0) !== 0) {
                        $keptCodes[$code] = true;
                    }
                    break;
                }
            }
        }

        // --- Passe 3 : remonter les ancêtres TITLE/SUBTITLE/SUBTITLE2 ---
        $rowsById = [];
        foreach ($allTrmRows as $trm) {
            $rowsById[$trm->trm_id] = $trm;
        }

        foreach ($allTrmRows as $trm) {

            if (!isset($keptCodes[$trm->trm_box])) {
                continue;
            }

            $current = $trm;
            while ($current && !empty($current->fk_trm_id_parent)) {
                $parent = $rowsById[$current->fk_trm_id_parent] ?? null;
                if (!$parent) {
                    break;
                }

                if (in_array($parent->trm_row_type, ['TITLE', 'SUBTITLE', 'SUBTITLE2'])) {
                    // Pour les titres on garde par ID car trm_box est null
                    $keptCodes['__id_' . $parent->trm_id] = true;
                }

                $current = $parent;
            }
        }

        // --- Passe 4 : construire les lignes en ne gardant que les IDs retenus ---
        $lines = [];

        foreach ($allTrmRows as $trm) {
            $isKept = isset($keptCodes[$trm->trm_box])
                || isset($keptCodes['__id_' . $trm->trm_id]);

            if (!$isKept) {
                continue;
            }

            $rowType = $trm->trm_row_type;
            $code    = $trm->trm_box;

            switch ($rowType) {
                case 'TITLE':
                case 'SUBTITLE':
                case 'SUBTITLE2':
                    $lines[] = [
                        'vdl_box'        => null,
                        'vdl_row_type'   => $rowType,
                        'vdl_label'      => $trm->trm_label,
                        'vdl_dgfip_code' => null,
                        'vdl_base_ht'    => 0,
                        'vdl_amount_tva' => 0,
                        'vdl_order'      => $trm->trm_order,
                    ];
                    break;

                case 'DATA':
                    $tva  = $boxTax[$code]  ?? 0;
                    $base = $boxBase[$code] ?? 0;

                    $lines[] = [
                        'vdl_box'          => $code,
                        'vdl_row_type'     => 'DATA',
                        'vdl_label'        => $trm->trm_label,
                        'vdl_dgfip_code'   => $trm->trm_dgfip_code ?? null,
                        'vdl_base_ht'      => (int)$base,
                        'vdl_amount_tva'   => (int)$tva,
                        'vdl_has_base_ht'  => $trm->trm_has_base_ht ? 1 : 0,
                        'vdl_has_tax_amt'  => $trm->trm_has_tax_amt ? 1 : 0,
                        'vdl_order'        => $trm->trm_order,
                        'vdl_special_type' => $trm->trm_special_type,
                    ];
                    break;

                case 'FORMULA':
                    $tva  = $boxTax[$code]  ?? 0;
                    $base = $boxBase[$code] ?? 0;

                    $lines[] = [
                        'vdl_box'          => $code,
                        'vdl_row_type'     => 'FORMULA',
                        'vdl_label'        => $trm->trm_label,
                        'vdl_dgfip_code'   => $trm->trm_dgfip_code ?? null,
                        'vdl_base_ht'      => (int)$base,
                        'vdl_amount_tva'   => (int)$tva,
                        'vdl_has_base_ht'  => $trm->trm_has_base_ht ? 1 : 0,
                        'vdl_has_tax_amt'  => $trm->trm_has_tax_amt ? 1 : 0,
                        'vdl_order'        => $trm->trm_order,
                        'vdl_special_type' => $trm->trm_special_type,
                    ];
                    break;
            }
        }

        return $lines;
    }


    /**
     * Persiste la déclaration brouillon calculée par computeLines.
     * Sous-fonction privée — config et lignes déjà résolues, pas de double findOrFail.
     */
    private function saveDeclaration(
        AccountConfigModel $config,
        string $vatSystem,
        array $lines,
        array $amrIdsByBox,
        array $params,
        int $userId
    ): AccountTaxDeclarationModel {
        $regime         = $params['regime'] ?? $config->aco_vat_regime;
        $creditPrevious = (float)($params['credit_previous'] ?? 0);

        $exerciseId = AccountExerciseModel::where('aex_start_date', '<=', $params['period_end'])
            ->where('aex_end_date', '>=', $params['period_start'])
            ->value('aex_id');

        return DB::transaction(function () use ($params, $lines, $exerciseId, $userId, $config, $vatSystem, $regime, $creditPrevious, $amrIdsByBox) {
            $declaration = AccountTaxDeclarationModel::create([
                'vdc_period_start'    => $params['period_start'],
                'vdc_period_end'      => $params['period_end'],
                'vdc_type'            => $params['type'] ?? (($config->aco_vat_periodicity === 'monthly') ? 'monthly' : 'quarterly'),
                'vdc_system'          => $vatSystem,
                'vdc_regime'          => $regime,
                'vdc_status'          => 'draft',
                'vdc_label'           => $params['vdc_label'] ?? null,
                'vdc_credit_previous' => $creditPrevious,
                'vdc_prorata'         => null,
                'fk_aex_id'           => $exerciseId,
                'fk_usr_id_author'    => $userId,
                'fk_usr_id_updater'   => $userId,
                'vdc_created'         => now(),
                'vdc_updated'         => now(),
            ]);

            foreach ($lines as $line) {
                $vdl = AccountTaxDeclarationLineModel::create(array_merge($line, [
                    'fk_vdc_id'           => $declaration->vdc_id,
                    'fk_usr_id_author'    => $userId,
                    'fk_usr_id_updater'   => $userId,
                    'vdl_created'         => now(),
                    'vdl_updated'         => now(),
                ]));

                $box = $line['vdl_box'];

                if ($box && isset($amrIdsByBox[$box])) {
                    DB::table('account_move_line_tag_rel_amr')
                        ->whereNull('fk_vdl_id')
                        ->whereIn('amr_id', $amrIdsByBox[$box])
                        ->update(['fk_vdl_id' => $vdl->vdl_id]);
                }
            }

            return $declaration->load('lines');
        });
    }

    /**
     * Résout le crédit de TVA à reporter depuis la dernière déclaration validée/clôturée
     * dont la période se termine avant $periodStart.
     *
     * Le montant est lu sur la ligne dont vdl_special_type = 'CURRENT_CREDIT'
     * (case 27 en CA3, T4 en CA12) — source unique, indépendante du hardcode de box.
     */
    private function resolveCarryoverCredit(string $vatSystem, string $periodStart): float
    {
        $lastDecl = AccountTaxDeclarationModel::whereIn('vdc_status', ['closed'])
            ->where('vdc_system', $vatSystem)
           // ->where('vdc_period_end', '<', $periodStart)
            ->orderByDesc('vdc_id')
            ->first();

        if (!$lastDecl) {
            return 0.0;
        }

        $creditLine = AccountTaxDeclarationLineModel::where('fk_vdc_id', $lastDecl->vdc_id)
            ->where('vdl_special_type', 'CURRENT_CREDIT')
            ->first();

        return ($creditLine && (float)$creditLine->vdl_amount_tva > 0)
            ? (float)$creditLine->vdl_amount_tva
            : 0.0;
    }



    // ── Validation (génération OD) ────────────────────────────────────────────

    public function closeDeclaration(AccountTaxDeclarationModel $declaration, int $userId): AccountTaxDeclarationModel
    {
        if (!$declaration->isDraft()) {
            throw new \Exception("Cette déclaration n'est pas en brouillon.");
        }

        $config = AccountConfigModel::findOrFail(1);

        if (!$config->fk_ajl_id_od) {
            throw new \Exception("Le journal des Opérations Diverses (OD) n'est pas configuré.");
        }

        return DB::transaction(function () use ($declaration, $config, $userId) {
            $periodLabel = $this->getPeriodLabel($declaration);
            $moveLines   = [];
            $prorata     = $declaration->vdc_prorata ? (float)$declaration->vdc_prorata / 100 : 1.0;

            // ── A. Lignes TVA par compte GL ───────────────────────────────────
            // On lit directement les lignes AMR liées à cette déclaration (fk_vdl_id déjà
            // renseigné lors de saveDeclaration) et on groupe par compte RÉEL de l'écriture
            // (aml.fk_acc_id) — pas par le compte de la config fiscale (trl.fk_acc_id) qui
            // peut différer si le paramétrage a évolué après la saisie.
            //
            // net = aml_credit - aml_debit : valeur signée du solde de la ligne.
            //   net > 0 (solde créditeur) → OD débit pour solder → TVA collectée
            //   net < 0 (solde débiteur)  → OD crédit pour solder → TVA déductible
            //
            // La classification collectée/déductible se fait via trl.trl_document_type
            // (uniquement pour le prorata et le libellé — pas pour le sens D/C de l'OD).
            $declaration->loadMissing('lines');
            $vdlIds = $declaration->lines->pluck('vdl_id')->filter()->values()->toArray();

            if (empty($vdlIds)) {
                throw new \Exception('Aucune ligne de déclaration trouvée.');
            }

            $taxRows = DB::table('account_move_line_tag_rel_amr as amr')
                ->join('account_tax_repartition_line_trl as trl', 'trl.trl_id', '=', 'amr.fk_trl_id')
                ->join('account_move_line_aml as aml', 'aml.aml_id', '=', 'amr.fk_aml_id')
                ->whereIn('amr.fk_vdl_id', $vdlIds)
                ->where('trl.trl_repartition_type', 'tax')
                ->select(
                    'aml.fk_acc_id',
                    'trl.trl_document_type',
                    'aml.aml_id',
                    DB::raw('(aml.aml_credit - aml.aml_debit) as net')
                )
                ->get();

            if ($taxRows->isEmpty()) {
                throw new \Exception('Aucune écriture TVA trouvée pour cette déclaration.');
            }

            // Regrouper en PHP : net total + liste des aml_id + nature (collectée/déductible) par compte GL
            // Un même compte peut théoriquement avoir plusieurs trl_document_type :
            // on prend la nature majoritaire (in_* = déductible).
            $byAccount = [];
            foreach ($taxRows as $row) {
                $accId = $row->fk_acc_id; // compte RÉEL de l'écriture
                $isDeductible = in_array($row->trl_document_type, ['in_invoice', 'in_refund']);
                if (!isset($byAccount[$accId])) {
                    $byAccount[$accId] = ['net' => 0.0, 'aml_ids' => [], 'is_deductible' => $isDeductible];
                }
                $byAccount[$accId]['net'] += (float)$row->net;
                $byAccount[$accId]['aml_ids'][] = $row->aml_id;
                // Si au moins une ligne est déductible, le compte est déductible
                if ($isDeductible) {
                    $byAccount[$accId]['is_deductible'] = true;
                }
            }

            foreach ($byAccount as $accId => $data) {
                $net          = $data['net'];
                $isDeductible = $data['is_deductible'];
                if (abs($net) < 0.01) continue;

                // L'OD solde toujours le compte : sens = opposé du solde net
                // net > 0 (solde créditeur) → OD débit
                // net < 0 (solde débiteur)  → OD crédit
                $odDebit  = $net > 0 ? round($net, 2) : 0;
                $odCredit = $net < 0 ? round(abs($net), 2) : 0;

                if ($isDeductible) {
                    // TVA déductible : cas normal = solde débiteur (net < 0)
                    // On crédite le montant COMPLET pour solder à 0 (lettrable)
                    // La quote-part non déductible part en régularisation (débit)
                    // Cas avoir net (net > 0 sur compte déductible) : OD débit sans prorata
                    $label = $net < 0
                        ? 'TVA déductible – OD ' . $periodLabel
                        : 'TVA déductible (avoir net) – OD ' . $periodLabel;

                    $moveLines[] = [
                        'fk_acc_id'       => $accId,
                        'aml_debit'       => $odDebit,
                        'aml_credit'      => $odCredit,
                        'aml_label_entry' => $label,
                    ];

                    // Prorata uniquement sur la TVA déductible normale (net < 0)
                    // L'équilibre global : déductible + TOTAL_TO_PAY = collectée + déductible×(1−prorata)
                    if ($net < 0 && $prorata < 1.0) {
                        $nonDeductible = round($odCredit * (1.0 - $prorata), 2);
                        if ($nonDeductible >= 0.01) {
                            $regAccId = $config->fk_acc_id_vat_regularisation;
                            if (!$regAccId) {
                                throw new \Exception("Le compte de régularisation TVA (fk_acc_id_vat_regularisation) n'est pas configuré.");
                            }
                            $moveLines[] = [
                                'fk_acc_id'       => $regAccId,
                                'aml_debit'       => $nonDeductible,
                                'aml_credit'      => 0,
                                'aml_label_entry' => 'TVA non déductible (prorata ' . round($prorata * 100, 2) . '%) – OD ' . $periodLabel,
                            ];
                        }
                    }
                } else {
                    // TVA collectée : OD exact du net, aucun prorata
                    // net > 0 = factures > avoirs → OD débit
                    // net < 0 = avoirs > factures → OD crédit
                    $label = $net > 0
                        ? 'TVA collectée – OD ' . $periodLabel
                        : 'TVA collectée (avoir net) – OD ' . $periodLabel;

                    $moveLines[] = [
                        'fk_acc_id'       => $accId,
                        'aml_debit'       => $odDebit,
                        'aml_credit'      => $odCredit,
                        'aml_label_entry' => $label,
                    ];
                }
            }

            // ── B. Lignes types spéciaux ──────────────────────────────────────
            // Mapping special_type → compte de config → sens comptable OD :
            //   TOTAL_TO_PAY    → fk_acc_id_vat_payable (44551) → crédit (dette envers le fisc)
            //   CURRENT_CREDIT  → fk_acc_id_vat_credit  (44567) → débit  (créance sur le fisc)
            //   PREVIOUS_CREDIT → fk_acc_id_vat_credit  (44567) → débit
            //   REFUND_REQUESTED→ fk_acc_id_vat_refund           → débit
            // Skippés si montant = 0.
            $specialTypeMap = [
                'TOTAL_TO_PAY'     => ['config_key' => 'fk_acc_id_vat_payable', 'label' => 'TVA nette à payer',         'debit' => false],
                'CURRENT_CREDIT'   => ['config_key' => 'fk_acc_id_vat_credit',  'label' => 'Crédit de TVA',             'debit' => true],
                'PREVIOUS_CREDIT'  => ['config_key' => 'fk_acc_id_vat_credit',  'label' => 'Crédit de TVA reporté',     'debit' => true],
                'REFUND_REQUESTED' => ['config_key' => 'fk_acc_id_vat_refund',  'label' => 'Remboursement TVA demandé', 'debit' => true],
            ];

            foreach ($declaration->lines as $line) {
                $specialType = $line->vdl_special_type ?? null;
                if (!$specialType || !isset($specialTypeMap[$specialType])) continue;

                $amount = (float)($line->vdl_amount_tva ?? 0);
                if ($amount < 0.01) continue;

                $def   = $specialTypeMap[$specialType];
                $accId = $config->{$def['config_key']} ?? null;

                if (!$accId) {
                    throw new \Exception("Le compte comptable pour '{$specialType}' ({$def['config_key']}) n'est pas configuré.");
                }

                $moveLines[] = [
                    'fk_acc_id'       => $accId,
                    'aml_debit'       => $def['debit'] ? $amount : 0,
                    'aml_credit'      => $def['debit'] ? 0 : $amount,
                    'aml_label_entry' => $def['label'] . ' – OD ' . $periodLabel,
                ];
            }

            if (empty($moveLines)) {
                throw new \Exception('Aucune ligne comptable générée pour cette déclaration.');
            }

            // ── C. Création de l'OD ───────────────────────────────────────────
            $declarationLabel = $declaration->vdc_label ?: ('TVA ' . strtoupper($periodLabel));
            $moveData = [
                'amo_date'          => now(),
                'amo_label'         => $declarationLabel . ' – OD clôture',
                'amo_ref'           => 'TVA-' . $this->getPeriodRef($declaration),
                'fk_ajl_id'         => $config->fk_ajl_id_od,
                'fk_usr_id_author'  => $userId,
                'amo_document_type' => 'entry',
            ];

            $move = AccountMoveModel::saveWithValidation($moveData, $moveLines);
           
            // ── D. Lettrage automatique des comptes TVA GL ────────────────────
            // Pour chaque compte TVA (44571x, 44566x...) : letter les lignes d'origine
            // (issues des factures/règlements) avec la nouvelle ligne OD qui les solde.
            // Best-effort : un échec de lettrage ne bloque pas la validation.
            $letteringService = new AccountLetteringService();

            $odLinesByAcc = DB::table('account_move_line_aml')
                ->where('fk_amo_id', $move->amo_id)
                ->select('aml_id', 'fk_acc_id')
                ->get()
                ->groupBy('fk_acc_id');

            foreach ($byAccount as $accId => $data) {
                if (!isset($odLinesByAcc[$accId]) || $odLinesByAcc[$accId]->isEmpty()) continue;

                $odAmlId   = $odLinesByAcc[$accId]->first()->aml_id;
                $allAmlIds = array_merge($data['aml_ids'], [$odAmlId]);

                try {
                    $code = $letteringService->getNextLetteringCode($accId);
                    $letteringService->saveLettering($code, $accId, $allAmlIds);
                } catch (\Exception $e) {
                    Log::warning("Lettrage TVA déclaration #{$declaration->vdc_id} ignoré pour compte {$accId} : " . $e->getMessage());
                }
            }

            // ── E. Mise à jour du statut de la déclaration ───────────────────
            $declaration->update([
                'vdc_status'        => 'closed',
                'vdc_closed_at'     => now(),
                'fk_amo_id'         => $move->amo_id,
                'fk_usr_id_updater' => $userId,
                'vdc_updated'       => now(),
            ]);

            return $declaration->load(['lines', 'move']);
        });
    }

    // ── Modification manuelle d'une case (PREVIOUS_CREDIT / REFUND_REQUESTED) ──

    /**
     * Met à jour le montant d'une case saisie manuellement et réévalue
     * les formules dépendantes sans re-interroger les écritures comptables.
     *
     * Seuls les vdl_special_type PREVIOUS_CREDIT et REFUND_REQUESTED sont autorisés.
     */
    public function updateManualLine(
        AccountTaxDeclarationModel $declaration,
        int   $vdlId,
        float $newAmount,
        int   $userId
    ): AccountTaxDeclarationModel {
        if (!$declaration->isDraft()) {
            throw new \Exception("Cette déclaration n'est pas en brouillon.");
        }

        $line = AccountTaxDeclarationLineModel::where('fk_vdc_id', $declaration->vdc_id)
            ->where('vdl_id', $vdlId)
            ->firstOrFail();

        if (!in_array($line->vdl_special_type, ['PREVIOUS_CREDIT', 'REFUND_REQUESTED'])) {
            throw new \Exception("Cette case ne peut pas être modifiée manuellement.");
        }

        return DB::transaction(function () use ($declaration, $line, $newAmount, $userId) {
            // 1. Mettre à jour la ligne manuelle
            $line->update([
                'vdl_amount_tva'    => (int) round($newAmount, 0),
                'fk_usr_id_updater' => $userId,
                'vdl_updated'       => now(),
            ]);

            // 2. Reconstruire boxTax/boxBase depuis les valeurs courantes en DB
            $allLines = AccountTaxDeclarationLineModel::where('fk_vdc_id', $declaration->vdc_id)->get();

            $boxTax  = [];
            $boxBase = [];
            foreach ($allLines as $l) {
                if ($l->vdl_box !== null) {
                    $boxTax[$l->vdl_box]  = (float) $l->vdl_amount_tva;
                    $boxBase[$l->vdl_box] = (float) $l->vdl_base_ht;
                }
            }

            // 3. Réévaluer les formules (les cases DATA restent telles quelles)
            $mappingRegime = self::REGIME_MAP[$declaration->vdc_system] ?? 'CA3';
            $allTrmRows    = AccountTaxReportMappingModel::forRegime($mappingRegime)->get();

            [$boxTax] = $this->evaluateFormulas($allTrmRows, $boxTax, $boxBase);

            // 4. Mettre à jour en DB uniquement les lignes portant une formule
            $linesByBox = $allLines->keyBy('vdl_box');
            foreach ($allTrmRows as $trm) {
                $box = $trm->trm_box;
                if (!$box || !$trm->trm_formula || !isset($boxTax[$box])) continue;

                $dbLine = $linesByBox[$box] ?? null;
                if (!$dbLine) continue;

                $newVal = (int) round($boxTax[$box], 0);
                if ((int) round((float) $dbLine->vdl_amount_tva, 0) === $newVal) continue;

                $dbLine->update([
                    'vdl_amount_tva'    => $newVal,
                    'fk_usr_id_updater' => $userId,
                    'vdl_updated'       => now(),
                ]);
            }

            return $declaration->load('lines');
        });
    }

    // ── Suppression (brouillon ou dernière déclaration clôturée) ─────────────

    /**
     * Supprime une déclaration TVA.
     *
     * Autorisé si :
     *   - statut draft, OU
     *   - statut closed ET c'est la dernière déclaration clôturée (par vdc_closed_at).
     *
     * Pour une déclaration clôturée, on annule en plus l'OD comptable générée :
     *   1. Délettrage de toutes les lignes de l'OD.
     *   2. Suppression des lignes AML de l'OD.
     *   3. Suppression de l'écriture OD elle-même.
     */
    public function deleteDeclaration(AccountTaxDeclarationModel $declaration): void
    {
        $isClosed = $declaration->isClosed();

        if (!$declaration->isDraft() && !$isClosed) {
            throw new \Exception('Seules les déclarations en brouillon ou la dernière clôturée peuvent être supprimées.');
        }

        if ($isClosed) {
            // Vérifier que c'est bien la dernière déclaration clôturée (vdc_id max)
            $maxId = AccountTaxDeclarationModel::where('vdc_status', 'closed')->max('vdc_id');
            if ($maxId !== $declaration->vdc_id) {
                throw new \Exception('Seule la dernière déclaration clôturée peut être supprimée.');
            }

            // Interdire la suppression si un brouillon est en cours
            $hasDraft = AccountTaxDeclarationModel::where('vdc_status', 'draft')->exists();
            if ($hasDraft) {
                throw new \Exception('Impossible de supprimer une déclaration clôturée tant qu\'un brouillon est en cours.');
            }
        }

        DB::transaction(function () use ($declaration, $isClosed) {
            // Récupérer les IDs des lignes de déclaration
            $vdlIds = $declaration->lines()->pluck('vdl_id')->toArray();

            // 1. Libérer les liens AMR
            if (!empty($vdlIds)) {
                DB::table('account_move_line_tag_rel_amr')
                    ->whereIn('fk_vdl_id', $vdlIds)
                    ->update(['fk_vdl_id' => null]);
            }

            // 2. Pour une déclaration clôturée : annuler l'OD comptable
            if ($isClosed && $declaration->fk_amo_id) {
                $odLines = DB::table('account_move_line_aml')
                    ->where('fk_amo_id', $declaration->fk_amo_id)
                    ->select('aml_id', 'fk_acc_id', 'aml_lettering_code')
                    ->get();

                // Délettrage best-effort : on retire le code de lettrage de toutes
                // les lignes qui partagent le même code sur le même compte.
                $letteringService = new AccountLetteringService();
                $doneGroups = [];

                foreach ($odLines as $aml) {
                    if (empty($aml->aml_lettering_code)) continue;
                    $groupKey = $aml->fk_acc_id . '|' . $aml->aml_lettering_code;
                    if (isset($doneGroups[$groupKey])) continue;
                    $doneGroups[$groupKey] = true;

                    try {
                        $letteringService->unletterGroup($aml->aml_lettering_code, $aml->fk_acc_id);
                    } catch (\Exception $e) {
                        Log::warning("Délettrage OD TVA #{$declaration->fk_amo_id} ignoré : " . $e->getMessage());
                    }
                }

                // Supprimer les lignes AML de l'OD (casser d'abord les auto-références)
                DB::table('account_move_line_aml')
                    ->where('fk_amo_id', $declaration->fk_amo_id)
                    ->update(['fk_parent_aml_id' => null]);
                DB::table('account_move_line_aml')
                    ->where('fk_amo_id', $declaration->fk_amo_id)
                    ->delete();

                // Supprimer l'écriture OD
                DB::table('account_move_amo')
                    ->where('amo_id', $declaration->fk_amo_id)
                    ->delete();
            }

            // 3. Supprimer les lignes et la déclaration
            $declaration->lines()->delete();
            $declaration->delete();
        });
    }

    // ── Audit trail : lignes d'écritures sources d'une case ──────────────────

    /**
     * Retourne les lignes d'écritures comptables qui composent une case Cerfa.
     *    
     */
    public function getBoxSourceLines(AccountTaxDeclarationModel $declaration, int $vdlId): array
    {
        $query = DB::table('account_move_line_aml as aml')
            ->join('account_move_amo as amo', 'amo.amo_id', '=', 'aml.fk_amo_id')
            ->join('account_account_acc as acc', 'acc.acc_id', '=', 'aml.fk_acc_id')
            ->join('account_move_line_tag_rel_amr as amr', 'amr.fk_aml_id', '=', 'aml.aml_id')
            ->where('amr.fk_vdl_id', $vdlId);

        return $query->select([
            'aml.aml_id',
            'amo.amo_date',
            'amo.amo_id',
            'amo.amo_ref',
            'amo.amo_label',
            'acc.acc_code',
            'acc.acc_label',
            DB::raw('COALESCE(aml.aml_debit,  0) as aml_debit'),
            DB::raw('COALESCE(aml.aml_credit, 0) as aml_credit'),
            DB::raw('COALESCE(aml.aml_label_entry, amo.amo_label) as aml_label'),
            DB::raw('CASE WHEN amo.amo_valid IS NULL THEN 1 ELSE 0 END as is_draft'),
        ])->orderBy('amo.amo_date')->get()->toArray();
    }

    // ── Prochaines échéances ──────────────────────────────────────────────────

    public function computeNextDeadlines(AccountConfigModel $config): array
    {
        $periodicity = $config->aco_vat_periodicity ?? 'monthly';
        $today       = Carbon::today();
        $deadlines   = [];

        $lastDeclaration = AccountTaxDeclarationModel::whereIn('vdc_status', ['closed'])
            ->orderByDesc('vdc_period_end')
            ->first();

        if ($periodicity === 'monthly' || $periodicity === 'mini_reel') {
            $nextPeriodStart = $lastDeclaration
                ? Carbon::parse($lastDeclaration->vdc_period_end)->addDay()->startOfMonth()
                : $today->copy()->startOfMonth();
            $nextPeriodEnd = $nextPeriodStart->copy()->endOfMonth();
            $deadline      = $nextPeriodEnd->copy()->addMonth()->setDay(24);
            $note          = $periodicity === 'mini_reel'
                ? 'Mini-réel : TVA collectée mensuelle, déductible trimestrielle'
                : null;

            $deadlines[] = array_filter([
                'period_start'   => $nextPeriodStart->format('Y-m-d'),
                'period_end'     => $nextPeriodEnd->format('Y-m-d'),
                'deadline'       => $deadline->format('Y-m-d'),
                'days_remaining' => $today->diffInDays($deadline, false),
                'is_overdue'     => $today->isAfter($deadline),
                'regime_note'    => $note,
            ]);
        } elseif ($periodicity === 'quarterly') {
            $quarters = [[1, 3], [4, 6], [7, 9], [10, 12]];
            $year = $today->year;

            foreach ($quarters as [$qStart, $qEnd]) {
                $pStart   = Carbon::create($year, $qStart, 1);
                $pEnd     = Carbon::create($year, $qEnd, 1)->endOfMonth();
                $dMonth   = $qEnd + 1 > 12 ? 1 : $qEnd + 1;
                $dYear    = $qEnd + 1 > 12 ? $year + 1 : $year;
                $deadline = Carbon::create($dYear, $dMonth, 24);

                if ($deadline->isAfter($today) || $today->isSameDay($deadline)) {
                    if (!$lastDeclaration || Carbon::parse($lastDeclaration->vdc_period_end)->isBefore($pEnd)) {
                        $deadlines[] = [
                            'period_start'   => $pStart->format('Y-m-d'),
                            'period_end'     => $pEnd->format('Y-m-d'),
                            'deadline'       => $deadline->format('Y-m-d'),
                            'days_remaining' => $today->diffInDays($deadline, false),
                            'is_overdue'     => false,
                        ];
                        break;
                    }
                }
            }
        }

        return $deadlines;
    }

    // ── Alertes email ─────────────────────────────────────────────────────────

    public function sendAlerts(): void
    {
        $config = AccountConfigModel::with(['vatAlertTemplate'])->findOrFail(1);
        if (! $config->aco_vat_alert_enabled) return;

        $alertDays = $config->aco_vat_alert_days ?? 15;
        $deadlines = $this->computeNextDeadlines($config);
        if (empty($deadlines)) return;

        $nextDeadline  = $deadlines[0];
        $daysRemaining = $nextDeadline['days_remaining'];
        if ($daysRemaining > $alertDays || $daysRemaining < 0) return;

        $company = CompanyModel::with('emailDefault')->first();
        if (! $company || ! $company->emailDefault) {
            Log::warning('VatAlertService: Aucun compte email par défaut configuré dans la société.');
            return;
        }

        $recipients = [];
        if ($config->aco_vat_alert_emails) {
            $recipients = array_merge($recipients, (array)$config->aco_vat_alert_emails);
        }
        if (empty($recipients)) return;

        $template = $config->vatAlertTemplate;
        if (! $template) return;

        $periodLabel = $this->getPeriodLabelFromDates($nextDeadline['period_start'], $nextDeadline['period_end']);
        $variables = [
            '{vat_period}'         => $periodLabel,
            '{vat_deadline}'       => Carbon::parse($nextDeadline['deadline'])->format('d/m/Y'),
            '{vat_days_remaining}' => (string)max(0, (int)$daysRemaining),
            '{company_name}'       => $company->cop_label ?? '',
        ];

        $subject = str_replace(array_keys($variables), array_values($variables), $template->emt_subject);
        $body    = str_replace(array_keys($variables), array_values($variables), $template->emt_body);

        $emailService = new EmailService();
        $result = $emailService->sendEmail($company->emailDefault, $recipients, $subject, $body);

        if ($result['success']) {
            Log::info('VatAlertService: Alerte TVA envoyée.', ['recipients' => $recipients]);
        } else {
            Log::error('VatAlertService: Échec envoi alerte TVA.', ['error' => $result['message']]);
        }
    }


    private function getPeriodLabel(AccountTaxDeclarationModel $declaration): string
    {
        return $this->getPeriodLabelFromDates(
            $declaration->vdc_period_start->format('Y-m-d'),
            $declaration->vdc_period_end->format('Y-m-d')
        );
    }

    private function getPeriodLabelFromDates(string $start, string $end): string
    {
        $s      = Carbon::parse($start);
        $e      = Carbon::parse($end);
        $months = $s->diffInMonths($e) + 1;
        if ($months <= 1) return $s->locale('fr')->translatedFormat('F Y');
        $quarter = (int)ceil($s->month / 3);
        return 'T' . $quarter . ' ' . $s->year;
    }

    private function getPeriodRef(AccountTaxDeclarationModel $declaration): string
    {
        $s      = Carbon::parse($declaration->vdc_period_start);
        $e      = Carbon::parse($declaration->vdc_period_end);
        $months = $s->diffInMonths($e) + 1;
        if ($months <= 1) return $s->format('Y-m');
        $quarter = (int)ceil($s->month / 3);
        return $s->format('Y') . '-T' . $quarter;
    }
}
