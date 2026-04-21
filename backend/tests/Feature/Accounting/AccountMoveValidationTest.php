<?php

namespace Tests\Feature\Accounting;

use App\Models\AccountMoveModel;

class AccountMoveValidationTest extends AccountingTestCase
{
    private int $journalId;
    private int $exerciseId;
    private int $accDebit;
    private int $accCredit;

    protected function setUp(): void
    {
        parent::setUp();
        $this->journalId  = $this->createJournal('OD', 'general');
        $this->exerciseId = $this->createExercise('2026-01-01', '2026-12-31', true);
        $this->accDebit   = $this->createAccount('401000', 'liability_payable');
        $this->accCredit  = $this->createAccount('512000', 'asset_cash');
    }

    // ── Balance ───────────────────────────────────────────────────────────────

    public function test_balanced_move_passes_validation(): void
    {
        $move = AccountMoveModel::saveWithValidation(
            $this->moveData(),
            [
                ['fk_acc_id' => $this->accDebit,  'aml_debit' => 100, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accCredit, 'aml_debit' => 0,   'aml_credit' => 100],
            ]
        );

        $this->assertNotNull($move->amo_id);
        $this->assertEquals(2, $move->lines()->count());
    }

    public function test_unbalanced_move_throws_exception(): void
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/déséquilibr/i');

        AccountMoveModel::saveWithValidation(
            $this->moveData(),
            [
                ['fk_acc_id' => $this->accDebit,  'aml_debit' => 100, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accCredit, 'aml_debit' => 0,   'aml_credit' => 90],
            ]
        );
    }

    // ── Nombre minimum de lignes ──────────────────────────────────────────────

    public function test_minimum_2_lines_required(): void
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/minimum 2 lignes/i');

        AccountMoveModel::saveWithValidation(
            $this->moveData(),
            [
                ['fk_acc_id' => $this->accDebit, 'aml_debit' => 100, 'aml_credit' => 100],
            ]
        );
    }

    public function test_zero_lines_throws_exception(): void
    {
        $this->expectException(\Exception::class);

        AccountMoveModel::saveWithValidation($this->moveData(), []);
    }

    // ── Exercice clôturé ──────────────────────────────────────────────────────

    public function test_date_within_open_exercise_passes(): void
    {
        $move = AccountMoveModel::saveWithValidation(
            $this->moveData('2026-06-15'),
            [
                ['fk_acc_id' => $this->accDebit,  'aml_debit' => 50, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accCredit, 'aml_debit' => 0,  'aml_credit' => 50],
            ]
        );

        $this->assertNotNull($move->amo_id);
    }

    public function test_closed_exercise_throws_exception(): void
    {
        // Créer un exercice clôturé au 31/03/2026
        $closedExId = $this->createExercise('2026-01-01', '2026-12-31', true, '2026-03-31');

        // Annuler le précédent exercice non clôturé
        \Illuminate\Support\Facades\DB::table('account_exercise_aex')
            ->where('aex_id', $this->exerciseId)
            ->update(['aex_is_current_exercise' => 0]);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/clôtur/i');

        AccountMoveModel::saveWithValidation(
            array_merge($this->moveData('2026-02-15'), ['fk_aex_id' => $closedExId]),
            [
                ['fk_acc_id' => $this->accDebit,  'aml_debit' => 50, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accCredit, 'aml_debit' => 0,  'aml_credit' => 50],
            ]
        );
    }

    // ── Mise à jour (update) ──────────────────────────────────────────────────

    public function test_update_replaces_lines_correctly(): void
    {
        $move = AccountMoveModel::saveWithValidation(
            $this->moveData(),
            [
                ['fk_acc_id' => $this->accDebit,  'aml_debit' => 100, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accCredit, 'aml_debit' => 0,   'aml_credit' => 100],
            ]
        );

        $updated = AccountMoveModel::saveWithValidation(
            array_merge($this->moveData(), ['amo_label' => 'Modifiée']),
            [
                ['fk_acc_id' => $this->accDebit,  'aml_debit' => 200, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accCredit, 'aml_debit' => 0,   'aml_credit' => 200],
            ],
            $move->amo_id
        );

        $this->assertEquals($move->amo_id, $updated->amo_id);
        $this->assertEquals('Modifiée', $updated->amo_label);
        $this->assertEquals(200, $updated->lines()->sum('aml_debit'));
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private function moveData(string $date = '2026-06-15'): array
    {
        return [
            'fk_ajl_id'       => $this->journalId,
            'fk_aex_id'       => $this->exerciseId,
            'amo_date'        => $date,
            'amo_label'       => 'Test validation',
        ];
    }
}
