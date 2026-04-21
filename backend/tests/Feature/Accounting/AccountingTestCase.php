<?php

namespace Tests\Feature\Accounting;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Classe de base pour les tests comptables.
 *
 * Utilise la base de données de test MariaDB (port 3307).
 * La configuration DB est injectée après le boot de l'application
 * (config/database.php ne lit pas env()).
 * La transaction est démarrée manuellement après reconnexion,
 * puis rollbackée dans tearDown pour n'écrire aucune donnée.
 */
abstract class AccountingTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Surcharge la connexion MariaDB vers la base de test (port 3307)
        config([
            'database.connections.mariadb.host'     => '127.0.0.1',
            'database.connections.mariadb.port'     => '3307',
            'database.connections.mariadb.database' => 'fr_skuria_sksuite-skuria',
            'database.connections.mariadb.username' => 'root',
            'database.connections.mariadb.password' => '',
        ]);
        DB::purge('mariadb');
        DB::reconnect('mariadb');

        // Transaction manuelle — rollback dans tearDown
        DB::beginTransaction();
    }

    protected function tearDown(): void
    {
        DB::rollBack();
        parent::tearDown();
    }

    // ── Helpers de fixtures ───────────────────────────────────────────────────

    /**
     * Crée un journal avec un code unique pour éviter les conflits avec les données réelles.
     * Le suffixe aléatoire garantit l'absence de collision sur la contrainte unique ajl_code.
     */
    protected function createJournal(string $code = 'VTE', string $type = 'sale'): int
    {
        return DB::table('account_journal_ajl')->insertGetId([
            'ajl_code'  => $code . rand(100, 999), // ex: VTE412 — unique, ≤ 10 chars
            'ajl_label' => $code . ' (test)',
            'ajl_type'  => $type,
        ]);
    }

    protected function createExercise(
        string $start = '2026-01-01',
        string $end   = '2026-12-31',
        bool   $current = true,
        ?string $closingDate = null
    ): int {
        return DB::table('account_exercise_aex')->insertGetId([
            'aex_start_date'          => $start,
            'aex_end_date'            => $end,
            'aex_closing_date'        => $closingDate,
            'aex_is_current_exercise' => $current ? 1 : 0,
            'aex_is_next_exercise'    => 0,
        ]);
    }

    /**
     * Crée un compte avec un code unique pour éviter les conflits avec les données réelles.
     */
    protected function createAccount(string $code = '411000', string $type = 'asset_receivable'): int
    {
        return DB::table('account_account_acc')->insertGetId([
            'acc_code'  => $code . rand(100, 999), // ex: 411000412 — unique
            'acc_label' => $code . ' (test)',
            'acc_type'  => $type,
        ]);
    }

    protected function createMove(int $journalId, int $exerciseId, string $date = '2026-06-15', ?string $docType = null): int
    {
        return DB::table('account_move_amo')->insertGetId([
            'fk_ajl_id'         => $journalId,
            'fk_aex_id'         => $exerciseId,
            'amo_date'          => $date,
            'amo_label'         => 'Test',
            'amo_document_type' => $docType,
        ]);
    }

    protected function createLine(int $moveId, int $journalId, int $accountId, float $debit = 0, float $credit = 0): int
    {
        return DB::table('account_move_line_aml')->insertGetId([
            'fk_amo_id'  => $moveId,
            'fk_ajl_id'  => $journalId,
            'fk_acc_id'  => $accountId,
            'aml_date'   => '2026-06-15',
            'aml_label'  => 'Test',
            'aml_debit'  => $debit,
            'aml_credit' => $credit,
        ]);
    }
}
