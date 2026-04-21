<?php

namespace App\Services;

use App\Models\AccountMoveLineModel;
use App\Models\AccountMoveModel;
use App\Models\AccountModel;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AccountLetteringService
{
    /**
     * Lettre automatiquement les écritures comptables
     *
     * Principe du lettrage comptable français :
     * - On rapproche les lignes au DÉBIT et au CRÉDIT du MÊME COMPTE
     * - Qui se rapportent à la MÊME FACTURE (via fk_inv_id)
     * - Où la somme des débits = somme des crédits
     *
     * Algorithme simplifié :
     * 1. Charge toutes les lignes de paiements avec leur fk_inv_id (via payment_allocation)
     * 2. Charge toutes les lignes de factures avec leur fk_inv_id (direct sur account_move)
     * 3. Groupe par (compte, facture) : toutes les lignes du même compte concernant la même facture
     * 4. Valide que débit = crédit pour chaque groupe
     * 5. Applique le lettrage
     *
     * Gère correctement :
     * - Paiement simple : 1 paiement → 1 facture
     * - Paiement multiple : plusieurs paiements → 1 facture
     * - Facture multiple : 1 paiement → plusieurs factures
     * - Avoirs, acomptes, etc.
     *
     * @return array Statistiques détaillées du lettrage
     * @throws \Exception
     */
    public function autoLettering(): array
    {
        return DB::transaction(function () {
            // Initialiser les statistiques
            $stats = $this->initializeStats();

            // Récupérer la période comptable autorisée
            $period = AccountModel::getWritingPeriod();

            // Charger toutes les lignes lettrables avec leur fk_inv_id
            $allLines = $this->loadAllLetterableLines($period['curExerciseId'], $period['nextExerciseId']);

            // Grouper par (compte, facture)
            $groups = $this->processSmartLettering($allLines["paymentLines"], $allLines["invoiceLines"]);

            // Grouper par (compte, note de frais)
            $expenseGroups = $this->processSmartLettering($allLines["expensePaymentLines"], $allLines["expenseReportLines"]);

            // Lettrer chaque groupe équilibré
            foreach (array_merge($groups, $expenseGroups) as $group) {
                $this->processGroup($group, $stats);
            }

            return $stats;
        });
    }

    /**
     * Initialise la structure des statistiques de lettrage
     *
     * @return array
     */
    private function initializeStats(): array
    {
        return [
            'success' => true,
            'lines_processed' => 0,
            'groups_created' => 0,
            'unbalanced_groups' => 0,
            'skipped_groups' => 0,
            'total_lines_analyzed' => 0,
            'skipped_reasons' => [
                'too_few_lines' => 0,
            ],
            'lettered_details' => [],
            'unbalanced_details' => [],
            'errors' => [],
        ];
    }

    /**
     * Retourne un résultat vide quand il n'y a aucune ligne à lettrer
     *
     * @return array
     */
    private function emptyResult(): array
    {
        return [
            'success' => true,
            'lines_processed' => 0,
            'groups_created' => 0,
            'message' => 'Aucune ligne à lettrer'
        ];
    }

    /**
     * Charge TOUTES les lignes lettrables avec leur fk_inv_id
     * Combine les lignes de factures et les lignes de paiements
     *
     * @param int $curExerciseId
     * @param int|null $nextExerciseId
     * @return array
     */
    private function loadAllLetterableLines(int $curExerciseId, ?int $nextExerciseId): array
    {
        // 1. Lignes de PAIEMENTS En compta - récupérer fk_inv_id via payment_allocation
        $paymentLines = AccountMoveLineModel::query()
            ->select([
                'account_move_line_aml.aml_id',
                'account_move_line_aml.aml_credit',
                'account_move_line_aml.aml_debit',
                'account_move_line_aml.fk_acc_id',
            ])
            ->selectRaw("
                CASE 
                    WHEN pay.fk_inv_id_deposit IS NOT NULL
                    AND inv.inv_operation = 1
                    AND account_move_line_aml.aml_debit > 0
                        THEN pay.fk_inv_id_deposit

                    WHEN pay.fk_inv_id_deposit IS NOT NULL
                    AND inv.inv_operation = 3
                    AND account_move_line_aml.aml_credit > 0
                        THEN pay.fk_inv_id_deposit

                    ELSE pal.fk_inv_id
                END AS effective_fk_inv_id
            ")
            ->join('account_account_acc as acc', 'account_move_line_aml.fk_acc_id', '=', 'acc.acc_id')
            ->join('account_move_amo as amo', 'account_move_line_aml.fk_amo_id', '=', 'amo.amo_id')
            ->join('payment_pay as pay', 'amo.fk_pay_id', '=', 'pay.pay_id')
            ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
            ->join('invoice_inv as inv', 'pal.fk_inv_id', '=', 'inv.inv_id')
            ->where('acc.acc_is_letterable', 1)
            ->where(function ($q) {
                $q->whereColumn('account_move_line_aml.aml_credit', 'pal.pal_amount')
                    ->orWhereColumn('account_move_line_aml.aml_debit', 'pal.pal_amount');
            })
            ->whereIn('amo.fk_aex_id', [$curExerciseId, $nextExerciseId])
            ->whereNull('account_move_line_aml.aml_lettering_code')
            ->whereNotNull('pal.fk_inv_id')
            ->orderBy("pal.fk_inv_id")
            ->get();

        // 2. Lignes de FACTURES - fk_inv_id direct sur account_move
        $invoiceLines  = AccountMoveLineModel::query()
            ->select([
                'account_move_line_aml.aml_id',
                'account_move_line_aml.aml_credit',
                'account_move_line_aml.aml_debit',
                'account_move_line_aml.fk_acc_id',
                'amo.fk_inv_id as effective_fk_inv_id',
            ])
            ->join('account_account_acc as acc', 'account_move_line_aml.fk_acc_id', '=', 'acc.acc_id')
            ->join('account_move_amo as amo', 'account_move_line_aml.fk_amo_id', '=', 'amo.amo_id')
            ->where('acc.acc_is_letterable', 1)
            ->whereNull('account_move_line_aml.aml_lettering_code')
            ->whereNotNull('amo.fk_inv_id')
            ->whereIn('amo.fk_aex_id', [$curExerciseId, $nextExerciseId])
            ->orderBy("amo.fk_inv_id")
            ->get();

        // 3. Lignes de PAIEMENTS de notes de frais — fk_exr_id via payment_allocation
        $expensePaymentLines = AccountMoveLineModel::query()
            ->select([
                'account_move_line_aml.aml_id',
                'account_move_line_aml.aml_credit',
                'account_move_line_aml.aml_debit',
                'account_move_line_aml.fk_acc_id',
                'pal.fk_exr_id as effective_fk_inv_id', // alias réutilisé par processSmartLettering
            ])
            ->join('account_account_acc as acc', 'account_move_line_aml.fk_acc_id', '=', 'acc.acc_id')
            ->join('account_move_amo as amo', 'account_move_line_aml.fk_amo_id', '=', 'amo.amo_id')
            ->join('payment_pay as pay', 'amo.fk_pay_id', '=', 'pay.pay_id')
            ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
            ->where('acc.acc_is_letterable', 1)
            ->where(function ($q) {
                $q->whereColumn('account_move_line_aml.aml_credit', 'pal.pal_amount')
                    ->orWhereColumn('account_move_line_aml.aml_debit', 'pal.pal_amount');
            })
            ->whereIn('amo.fk_aex_id', [$curExerciseId, $nextExerciseId])
            ->whereNull('account_move_line_aml.aml_lettering_code')
            ->whereNotNull('pal.fk_exr_id')
            ->orderBy('pal.fk_exr_id')
            ->get();

        // 4. Lignes de NOTES DE FRAIS — fk_exr_id direct sur account_move
        $expenseReportLines = AccountMoveLineModel::query()
            ->select([
                'account_move_line_aml.aml_id',
                'account_move_line_aml.aml_credit',
                'account_move_line_aml.aml_debit',
                'account_move_line_aml.fk_acc_id',
                'amo.fk_exr_id as effective_fk_inv_id', // alias réutilisé par processSmartLettering
            ])
            ->join('account_account_acc as acc', 'account_move_line_aml.fk_acc_id', '=', 'acc.acc_id')
            ->join('account_move_amo as amo', 'account_move_line_aml.fk_amo_id', '=', 'amo.amo_id')
            ->where('acc.acc_is_letterable', 1)
            ->whereNull('account_move_line_aml.aml_lettering_code')
            ->whereNotNull('amo.fk_exr_id')
            ->whereIn('amo.fk_aex_id', [$curExerciseId, $nextExerciseId])
            ->orderBy('amo.fk_exr_id')
            ->get();

        return [
            "invoiceLines"       => $invoiceLines,
            "paymentLines"       => $paymentLines,
            "expenseReportLines" => $expenseReportLines,
            "expensePaymentLines" => $expensePaymentLines,
        ];
    }

    /**
     * Groupe les lignes par (compte, facture)
     * Principe : toutes les lignes du même compte concernant la même facture
     *
     * @param array $lines
     * @return array
     */
    function processSmartLettering(Collection $paymentLines, Collection $invoiceLines): array
    {
        $groups = [];

        $invoiceIndex = $invoiceLines->groupBy(fn($l) => $l->fk_acc_id . '_' . $l->effective_fk_inv_id);

        $usedPaymentIds = [];
        $usedInvoiceIds = [];

        // ✅ PASS 1 — MATCH 1 ↔ 1
        foreach ($paymentLines as $p) {

            $key = $p->fk_acc_id . '_' . $p->effective_fk_inv_id;
            if (!isset($invoiceIndex[$key])) continue;

            foreach ($invoiceIndex[$key] as $i) {

                if (isset($usedInvoiceIds[$i->aml_id])) continue;

                if ($this->isBalanced($p, $i)) {

                    $groups[] = [
                        'account_id' => $p->fk_acc_id,
                        'invoice_id' => $p->effective_fk_inv_id,
                        'line_ids' => [$p->aml_id, $i->aml_id],
                        'total_debit' => (float)$p->aml_debit + (float)$i->aml_debit,
                        'total_credit' => (float)$p->aml_credit + (float)$i->aml_credit,
                    ];

                    $usedPaymentIds[$p->aml_id] = true;
                    $usedInvoiceIds[$i->aml_id] = true;

                    break;
                }
            }
        }

        // Reste à traiter
        // Lignes restantes après les matchs 1↔1
        $remainingPaymentLines = $paymentLines->whereNotIn('aml_id', array_keys($usedPaymentIds));
        $remainingInvoiceLines = $invoiceLines->whereNotIn('aml_id', array_keys($usedInvoiceIds));

        // ✅ PASS 2 — GROUPES CUMULÉS
        $grouped = $this->groupRemainingLines($remainingPaymentLines, $remainingInvoiceLines);

        return array_merge($groups, $grouped);
    }


    private function groupRemainingLines(Collection $paymentLines, Collection $invoiceLines): array
    {
        $groups = [];

        // Index des factures
        $invoiceIndex = $invoiceLines->groupBy(fn($l) => $l->fk_acc_id . '_' . $l->effective_fk_inv_id);

        // 1️⃣ On démarre avec les paiements
        foreach ($paymentLines as $p) {

            $key = $p->fk_acc_id . '_' . $p->effective_fk_inv_id;

            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'account_id' => $p->fk_acc_id,
                    'invoice_id' => $p->effective_fk_inv_id,
                    'line_ids' => [],
                    'total_debit' => 0.0,
                    'total_credit' => 0.0,
                ];
            }

            $groups[$key]['line_ids'][] = $p->aml_id;
            $groups[$key]['total_debit'] += (float) ($p->aml_debit ?? 0);
            $groups[$key]['total_credit'] += (float) ($p->aml_credit ?? 0);

            // On rattache les factures correspondantes
            if (isset($invoiceIndex[$key])) {
                foreach ($invoiceIndex[$key] as $i) {
                    $groups[$key]['line_ids'][] = $i->aml_id;
                    $groups[$key]['total_debit'] += (float) ($i->aml_debit ?? 0);
                    $groups[$key]['total_credit'] += (float) ($i->aml_credit ?? 0);
                }

                unset($invoiceIndex[$key]); // évite double traitement
            }
        }

        return array_values($groups);
    }



    function isBalanced($a, $b, float $epsilon = 0.00): bool
    {
        $aAmount = (float)$a->aml_debit - (float)$a->aml_credit;
        $bAmount = (float)$b->aml_debit - (float)$b->aml_credit;

        return abs($aAmount + $bAmount) <= $epsilon;
    }

    /**
     * Traite un groupe : valide et applique le lettrage si équilibré
     *
     * @param array $group
     * @param array $stats
     * @return void
     */
    private function processGroup(array $group, array &$stats): void
    {

        try {
            // Validation 1: Minimum 2 lignes
            if (count($group['line_ids']) < 2) {
                $stats['skipped_groups']++;
                $stats['skipped_reasons']['too_few_lines']++;
                return;
            }

            // Validation 2: Balance STRICTE = 0.00€
            $balance = round($group['total_debit'] - $group['total_credit'], 2);
            if ($balance !== 0.00) {
                $stats['unbalanced_groups']++;
                $stats['unbalanced_details'][] = [
                    'account_id' => $group['account_id'],
                    'line_count' => count($group['line_ids']),
                    'balance' => $balance,
                ];
                return;
            }

            // Obtenir le code de lettrage
            $letteringCode = $this->getNextLetteringCode($group['account_id']);

            // Appliquer le lettrage
            $result = $this->saveLettering($letteringCode, $group['account_id'], $group['line_ids']);

            if ($result) {
                $stats['groups_created']++;
                $stats['lines_processed'] += count($group['line_ids']);
                $stats['lettered_details'][] = [
                    'account_id' => $group['account_id'],
                    'code' => $letteringCode,
                    'line_count' => count($group['line_ids']),
                    'amount' => $group['total_debit'],
                ];
            }
        } catch (\Exception $e) {
            $stats['errors'][] = [
                'account_id' => $group['account_id'] ?? null,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Sauvegarde un lettrage sur un groupe de lignes avec validation atomique
     *
     * @param string $letteringCode Code de lettrage à appliquer
     * @param int $accountId ID du compte concerné
     * @param array $lineIds Liste des IDs de lignes à lettrer
     * @return bool
     * @throws \Exception
     */
    public function saveLettering(string $letteringCode, int $accountId, array $lineIds): bool
    {

        // Validation 0: Au moins 2 lignes requises
        if (count($lineIds) < 2) {
            throw new \Exception("Un lettrage nécessite au moins 2 lignes comptables.");
        }

        // 1. Récupérer toutes les lignes avec leur mouvement comptable pour vérifier l'exercice
        $lines = AccountMoveLineModel::query()
            ->select('account_move_line_aml.*', 'amo.fk_aex_id')
            ->join('account_move_amo as amo', 'account_move_line_aml.fk_amo_id', '=', 'amo.amo_id')
            ->whereIn('aml_id', $lineIds)
            ->where('fk_acc_id', $accountId)
            ->get();

        // 2. Vérifier que toutes les lignes existent et appartiennent au compte spécifié
        if ($lines->count() !== count($lineIds)) {
            throw new \Exception(
                "Certaines lignes n'existent pas ou n'appartiennent pas au compte {$accountId}"
            );
        }

        // 3. Vérifier que toutes les lignes appartiennent au même compte (sécurité supplémentaire)
        $distinctAccounts = $lines->pluck('fk_acc_id')->unique();
        if ($distinctAccounts->count() > 1) {
            throw new \Exception("Toutes les lignes doivent appartenir au même compte.");
        }

        // 4. Vérifier que toutes les lignes sont dans l'exercice comptable autorisé
        $writingPeriod = AccountModel::getWritingPeriod();
        $allowedExercises = array_filter([$writingPeriod['curExerciseId'], $writingPeriod['nextExerciseId']]);

        $invalidExercises = $lines->filter(function ($line) use ($allowedExercises) {
            return !in_array($line->fk_aex_id, $allowedExercises);
        });

        if ($invalidExercises->isNotEmpty()) {
            throw new \Exception(
                "Certaines lignes ne sont pas dans l'exercice comptable autorisé. " .
                "Lignes concernées: " . $invalidExercises->pluck('aml_id')->implode(', ')
            );
        }

        // 5. Vérifier que le code de lettrage n'est pas déjà utilisé sur ce compte
        $existingCode = AccountMoveLineModel::where('fk_acc_id', $accountId)
            ->where('aml_lettering_code', $letteringCode)
            ->whereNotIn('aml_id', $lineIds)
            ->exists();

        if ($existingCode) {
            throw new \Exception("Le code de lettrage '{$letteringCode}' est déjà utilisé sur ce compte.");
        }

        // 6. Vérifier qu'aucune ligne n'est déjà lettrée
        $alreadyLettered = $lines->filter(function ($line) {
            return !is_null($line->aml_lettering_code) && $line->aml_lettering_code !== '';
        });

        if ($alreadyLettered->isNotEmpty()) {
            $letteredIds = $alreadyLettered->pluck('aml_id')->toArray();
            throw new \Exception(
                "Certaines lignes sont déjà lettrées: " . implode(', ', $letteredIds)
            );
        }


        // 7. Calculer le solde total avec validation STRICTE
        $totalDebit = $lines->sum('aml_debit');
        $totalCredit = $lines->sum('aml_credit');
        $difference = round(abs($totalDebit - $totalCredit), 2);

        // Validation stricte : la différence doit être exactement 0.00€
        if ($difference !== 0.00) {
            throw new \Exception(
                "Le groupe de lettrage est déséquilibré. Débit: {$totalDebit}, Crédit: {$totalCredit}, Différence: {$difference}"
            );
        }

        // 8. Appliquer le lettrage
        $letteringDate = now();
        foreach ($lines as $line) {
            $line->update([
                'aml_lettering_code' => $letteringCode,
                'aml_lettering_date' => $letteringDate,
            ]);
        }

        return true;
    }

    /**
     * Obtient le prochain code de lettrage disponible pour un compte
     * Format: AA, AB, AC, ..., AZ, BA, BB, ..., ZZ, AAA, AAB, ...
     *
     * @param int $accountId
     * @return string
     */
    public function getNextLetteringCode(int $accountId): string
    {
        // Récupérer le dernier code de lettrage pour ce compte
        $lastCode = AccountMoveLineModel::where('fk_acc_id', $accountId)
            ->whereNotNull('aml_lettering_code')
            ->where('aml_lettering_code', '!=', '')
            ->orderByRaw('LENGTH(aml_lettering_code) DESC, aml_lettering_code DESC')
            ->value('aml_lettering_code');

        if (!$lastCode) {
            return 'AAA'; // Premier code
        }

        return $this->incrementLetteringCode($lastCode);
    }

    /**
     * Incrémente un code de lettrage (AA -> AB -> AC -> ... -> AZ -> BA -> ...)
     *
     * @param string $code
     * @return string
     */
    private function incrementLetteringCode(string $code): string
    {
        $chars = str_split($code);
        $carry = true;

        // Incrémenter de droite à gauche
        for ($i = count($chars) - 1; $i >= 0 && $carry; $i--) {
            if ($chars[$i] === 'Z') {
                $chars[$i] = 'A';
                // Le carry continue
            } else {
                $chars[$i] = chr(ord($chars[$i]) + 1);
                $carry = false;
            }
        }

        // Si on a encore un carry, ajouter une lettre
        if ($carry) {
            array_unshift($chars, 'A');
        }

        return implode('', $chars);
    }

    /**
     * Délettrer un groupe de lignes
     *
     * @param string $letteringCode
     * @param int $accountId
     * @return bool
     * @throws \Exception
     */
    public function unletterGroup(string $letteringCode, int $accountId): bool
    {
        return DB::transaction(function () use ($letteringCode, $accountId) {

            // Récupérer les lignes avec ce code de lettrage
            $lines = AccountMoveLineModel::where('fk_acc_id', $accountId)
                ->where('aml_lettering_code', $letteringCode)
                ->lockForUpdate()
                ->get();

            if ($lines->isEmpty()) {
                throw new \Exception("Aucune ligne trouvée avec le code de lettrage {$letteringCode}");
            }

            // Vérifier qu'aucune ligne n'est pointée (rapprochement bancaire)
            $pointedLines = $lines->filter(function ($line) {
                return !is_null($line->aml_abr_code) && $line->aml_abr_code !== '';
            });

            if ($pointedLines->isNotEmpty()) {
                throw new \Exception(
                    "Impossible de délettrer: certaines lignes sont pointées en rapprochement bancaire"
                );
            }

            // Supprimer le lettrage
            foreach ($lines as $line) {
                $line->update([
                    'aml_lettering_code' => null,
                    'aml_lettering_date' => null,
                ]);
            }

            Log::info("Délettrage effectué avec succès", [
                'code' => $letteringCode,
                'account_id' => $accountId,
                'lines_count' => $lines->count()
            ]);

            return true;
        });
    }

    /**
     * Validation des codes de lettrage pour import comptable
     * Vérifie l'équilibre de chaque code lettrage et s'il existe déjà en base
     *
     * @param array $rows Lignes d'import avec codes de lettrage
     * @param array $warnings Tableau des warnings (passé par référence)
     * @return array Lignes nettoyées (codes de lettrage existants supprimés)
     */
    public function validateLetteringCodesForImport(array $rows, array &$warnings): array
    {
        // Groupement par code lettrage
        $letteringGroups = [];
        foreach ($rows as $row) {
            if (!empty($row['ecriturelet'])) {
                $letteringGroups[$row['ecriturelet']][] = $row;
            }
        }

        // Vérification équilibre de chaque lettrage
        foreach ($letteringGroups as $code => $lines) {
            $totalDebit = array_sum(array_column($lines, 'debit'));
            $totalCredit = array_sum(array_column($lines, 'credit'));
            $difference = abs($totalDebit - $totalCredit);

            if ($difference > 0.01) {
                $warnings[] = "Code lettrage '$code' déséquilibré (différence: " . number_format($difference, 2) . " €)";
            }
        }

        // Vérification existence des codes de lettrage en base
        // On groupe par compte pour vérifier par compte
        $letteringByAccount = [];
        foreach ($rows as $row) {
            if (!empty($row['ecriturelet']) && !empty($row['comptenum'])) {
                if (!isset($letteringByAccount[$row['comptenum']])) {
                    $letteringByAccount[$row['comptenum']] = [];
                }
                $letteringByAccount[$row['comptenum']][$row['ecriturelet']] = true;
            }
        }

        // Vérifier pour chaque compte si les codes de lettrage existent déjà
        $existingCodes = [];
        foreach ($letteringByAccount as $accountCode => $codes) {
            $codesArray = array_keys($codes);

            // Récupérer l'ID du compte
            $account = \App\Models\AccountModel::where('acc_code', $accountCode)->first();
            if (!$account) {
                continue;
            }

            // Vérifier quels codes existent déjà pour ce compte
            $existing = AccountMoveLineModel::where('fk_acc_id', $account->acc_id)
                ->whereIn('aml_lettering_code', $codesArray)
                ->pluck('aml_lettering_code')
                ->unique()
                ->toArray();

            foreach ($existing as $existingCode) {
                $existingCodes[$accountCode . '_' . $existingCode] = true;
                $warnings[] = "Code lettrage '$existingCode' sur compte '$accountCode' existe déjà - supprimé de l'import";
            }
        }

        // Nettoyer les lignes : supprimer les codes de lettrage et dates existants
        $cleanedRows = [];
        foreach ($rows as $row) {
            if (!empty($row['ecriturelet']) && !empty($row['comptenum'])) {
                $key = $row['comptenum'] . '_' . $row['ecriturelet'];
                if (isset($existingCodes[$key])) {
                    // Supprimer le code de lettrage et sa date
                    $row['ecriturelet'] = '';
                    $row['datelet'] = '';
                }
            }
            $cleanedRows[] = $row;
        }

        return $cleanedRows;
    }
}
