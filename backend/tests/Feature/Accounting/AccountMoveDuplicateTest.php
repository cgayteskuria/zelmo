<?php

namespace Tests\Feature\Accounting;

use App\Models\AccountMoveModel;
use App\Models\InvoiceModel;
use Illuminate\Support\Facades\DB;

class AccountMoveDuplicateTest extends AccountingTestCase
{
    private int $journalId;
    private int $exerciseId;
    private int $acc1;
    private int $acc2;
    private AccountMoveModel $original;

    protected function setUp(): void
    {
        parent::setUp();

        $this->journalId  = $this->createJournal('VTE', 'sale');
        $this->exerciseId = $this->createExercise();
        $this->acc1       = $this->createAccount('411000', 'asset_receivable');
        $this->acc2       = $this->createAccount('706000', 'income');

        // Écriture source
        $this->original = AccountMoveModel::saveWithValidation(
            [
                'fk_ajl_id'         => $this->journalId,
                'fk_aex_id'         => $this->exerciseId,
                'amo_date'          => '2026-06-01',
                'amo_label'         => 'Facture originale',
                'amo_ref'           => 'REF-001',
                'amo_document_type' => 'invoice',
            ],
            [
                ['fk_acc_id' => $this->acc1, 'aml_debit' => 1200, 'aml_credit' => 0,    'aml_label' => 'Client'],
                ['fk_acc_id' => $this->acc2, 'aml_debit' => 0,    'aml_credit' => 1200, 'aml_label' => 'Vente'],
            ]
        );
    }

    public function test_duplicate_creates_new_independent_move(): void
    {
        $copy = $this->duplicateViaModel($this->original);

        $this->assertNotEquals($this->original->amo_id, $copy->amo_id);
        $this->assertEquals(2, $copy->lines()->count());
    }

    public function test_duplicate_preserves_document_type(): void
    {
        $copy = $this->duplicateViaModel($this->original);

        $this->assertEquals('invoice', $copy->amo_document_type);
    }

    public function test_duplicate_does_not_copy_fk_inv_id(): void
    {
        // Simuler une écriture liée à une facture
        $invId = DB::table('invoice_inv')->insertGetId([
            'inv_operation' => InvoiceModel::OPERATION_CUSTOMER_INVOICE,
            'inv_status'    => 1,
        ]);
        DB::table('account_move_amo')
            ->where('amo_id', $this->original->amo_id)
            ->update(['fk_inv_id' => $invId]);
        $this->original->refresh();

        $copy = $this->duplicateViaModel($this->original);

        $this->assertNull($copy->fk_inv_id, 'La copie ne doit pas être liée à la facture originale');
    }

    public function test_duplicate_copy_is_balanced(): void
    {
        $copy = $this->duplicateViaModel($this->original);

        $totalDebit  = $copy->lines()->sum('aml_debit');
        $totalCredit = $copy->lines()->sum('aml_credit');

        $this->assertEquals($totalDebit, $totalCredit);
    }

    public function test_duplicate_copies_correct_amounts(): void
    {
        $copy = $this->duplicateViaModel($this->original);

        $this->assertEquals(1200, $copy->lines()->sum('aml_debit'));
        $this->assertEquals(1200, $copy->lines()->sum('aml_credit'));
    }

    public function test_duplicate_preserves_journal(): void
    {
        $copy = $this->duplicateViaModel($this->original);

        $this->assertEquals($this->original->fk_ajl_id, $copy->fk_ajl_id);
    }

    public function test_duplicate_goes_through_save_with_validation(): void
    {
        // Une écriture déséquilibrée ne peut pas être dupliquée
        // On force un déséquilibre directement en BDD (contourne saveWithValidation)
        DB::table('account_move_line_aml')
            ->where('fk_amo_id', $this->original->amo_id)
            ->where('aml_debit', '>', 0)
            ->update(['aml_debit' => 999]); // déséquilibrer

        $this->original->load('lines');

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/déséquilibr/i');

        $this->duplicateViaModel($this->original);
    }

    // ── Helper : réplique la logique de duplicate() sans passer par HTTP ─────

    private function duplicateViaModel(AccountMoveModel $original): AccountMoveModel
    {
        $moveData = [
            'fk_ajl_id'         => $original->fk_ajl_id,
            'amo_date'          => now()->format('Y-m-d'),
            'amo_label'         => $original->amo_label,
            'amo_ref'           => $original->amo_ref,
            'amo_document_type' => $original->amo_document_type,
            // fk_inv_id / fk_pay_id / fk_exr_id intentionnellement non copiés
        ];

        $linesData = $original->lines->map(fn($line) => [
            'fk_acc_id'   => $line->fk_acc_id,
            'aml_label'   => $line->aml_label,
            'aml_debit'   => $line->aml_debit,
            'aml_credit'  => $line->aml_credit,
            'fk_tax_id'   => $line->fk_tax_id,
        ])->toArray();

        return AccountMoveModel::saveWithValidation($moveData, $linesData);
    }
}
