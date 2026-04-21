<?php

namespace Tests\Feature\Accounting;

use App\Models\AccountMoveModel;
use App\Models\InvoiceModel;
use Illuminate\Support\Facades\DB;

class AccountMoveDocumentTypeTest extends AccountingTestCase
{
    private int $saleJournalId;
    private int $purchaseJournalId;
    private int $generalJournalId;
    private int $exerciseId;
    private int $accReceivable;   // 411xxx — asset_receivable
    private int $accPayable;      // 401xxx — liability_payable
    private int $accIncome;       // 706xxx — income
    private int $accExpense;      // 607xxx — expense

    protected function setUp(): void
    {
        parent::setUp();
        $this->saleJournalId     = $this->createJournal('VTE', 'sale');
        $this->purchaseJournalId = $this->createJournal('ACH', 'purchase');
        $this->generalJournalId  = $this->createJournal('OD', 'general');
        $this->exerciseId        = $this->createExercise();
        $this->accReceivable     = $this->createAccount('411000', 'asset_receivable');
        $this->accPayable        = $this->createAccount('401000', 'liability_payable');
        $this->accIncome         = $this->createAccount('706000', 'income');
        $this->accExpense        = $this->createAccount('607000', 'expense');
    }

    // ── Facture → 'invoice' ───────────────────────────────────────────────────

    public function test_customer_invoice_linked_move_gets_invoice_type(): void
    {
        $invId = DB::table('invoice_inv')->insertGetId([
            'inv_operation' => InvoiceModel::OPERATION_CUSTOMER_INVOICE,
            'inv_status'    => 1,
        ]);

        $move = $this->saveTwoLinedMove($this->saleJournalId, ['fk_inv_id' => $invId]);

        $this->assertEquals('out_invoice', $move->amo_document_type);
    }

    public function test_supplier_invoice_linked_move_gets_invoice_type(): void
    {
        $invId = DB::table('invoice_inv')->insertGetId([
            'inv_operation' => InvoiceModel::OPERATION_SUPPLIER_INVOICE,
            'inv_status'    => 1,
        ]);

        $move = $this->saveTwoLinedMove($this->purchaseJournalId, ['fk_inv_id' => $invId]);

        $this->assertEquals('in_invoice', $move->amo_document_type);
    }

    // ── Avoir → 'out_refund' / 'in_refund' ───────────────────────────────────

    public function test_customer_refund_linked_move_gets_refund_type(): void
    {
        $invId = DB::table('invoice_inv')->insertGetId([
            'inv_operation' => InvoiceModel::OPERATION_CUSTOMER_REFUND,
            'inv_status'    => 1,
        ]);

        $move = $this->saveTwoLinedMove($this->saleJournalId, ['fk_inv_id' => $invId]);

        $this->assertEquals('out_refund', $move->amo_document_type);
    }

    public function test_supplier_refund_linked_move_gets_refund_type(): void
    {
        $invId = DB::table('invoice_inv')->insertGetId([
            'inv_operation' => InvoiceModel::OPERATION_SUPPLIER_REFUND,
            'inv_status'    => 1,
        ]);

        $move = $this->saveTwoLinedMove($this->purchaseJournalId, ['fk_inv_id' => $invId]);

        $this->assertEquals('in_refund', $move->amo_document_type);
    }

    // ── Paiement → 'entry' ───────────────────────────────────────────────────

    public function test_payment_linked_move_gets_entry_type(): void
    {
        $payId = DB::table('payment_pay')->insertGetId(['pay_status' => 1]);

        $move = $this->saveTwoLinedMove($this->generalJournalId, ['fk_pay_id' => $payId]);

        $this->assertEquals('entry', $move->amo_document_type);
    }

    // ── Saisie manuelle : facture vente → 'out_invoice' ──────────────────────

    public function test_manual_sale_invoice_client_debit_income_credit(): void
    {
        // Écriture normale : client DÉBIT, produit CRÉDIT → out_invoice
        $move = AccountMoveModel::saveWithValidation(
            $this->moveBase($this->saleJournalId),
            [
                ['fk_acc_id' => $this->accReceivable, 'aml_debit' => 120, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accIncome,     'aml_debit' => 0,   'aml_credit' => 120],
            ]
        );
        $this->assertEquals('out_invoice', $move->amo_document_type);
    }

    // ── Saisie manuelle : facture achat → 'in_invoice' ───────────────────────

    public function test_manual_purchase_invoice_expense_debit_supplier_credit(): void
    {
        // Écriture normale achat : charge DÉBIT, fournisseur CRÉDIT → in_invoice
        $move = AccountMoveModel::saveWithValidation(
            $this->moveBase($this->purchaseJournalId),
            [
                ['fk_acc_id' => $this->accExpense, 'aml_debit' => 80, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accPayable, 'aml_debit' => 0,  'aml_credit' => 80],
            ]
        );
        $this->assertEquals('in_invoice', $move->amo_document_type);
    }

    // ── Saisie manuelle : contrepassement ─────────────────────────────────────

    public function test_avoir_client_receivable_credited(): void
    {
        // Avoir client : produit DÉBIT, client CRÉDIT → out_refund
        $move = AccountMoveModel::saveWithValidation(
            $this->moveBase($this->saleJournalId),
            [
                ['fk_acc_id' => $this->accIncome,     'aml_debit' => 120, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accReceivable, 'aml_debit' => 0,   'aml_credit' => 120],
            ]
        );
        $this->assertEquals('out_refund', $move->amo_document_type);
    }

    public function test_avoir_fournisseur_payable_debited(): void
    {
        // Avoir fournisseur : fournisseur DÉBIT, charge CRÉDIT → in_refund
        $move = AccountMoveModel::saveWithValidation(
            $this->moveBase($this->purchaseJournalId),
            [
                ['fk_acc_id' => $this->accPayable, 'aml_debit' => 80, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accExpense, 'aml_debit' => 0,  'aml_credit' => 80],
            ]
        );
        $this->assertEquals('in_refund', $move->amo_document_type);
    }

    public function test_avoir_detected_via_income_debit(): void
    {
        // Signal suffisant : compte produit au DÉBIT → out_refund (journal vente)
        $accOther = $this->createAccount('512000', 'asset_cash');
        $move = AccountMoveModel::saveWithValidation(
            $this->moveBase($this->saleJournalId),
            [
                ['fk_acc_id' => $this->accIncome, 'aml_debit' => 50, 'aml_credit' => 0],
                ['fk_acc_id' => $accOther,        'aml_debit' => 0,  'aml_credit' => 50],
            ]
        );
        $this->assertEquals('out_refund', $move->amo_document_type);
    }

    public function test_avoir_detected_via_expense_credit(): void
    {
        // Signal suffisant : compte charge au CRÉDIT → in_refund (journal achat)
        $accOther = $this->createAccount('512000', 'asset_cash');
        $move = AccountMoveModel::saveWithValidation(
            $this->moveBase($this->purchaseJournalId),
            [
                ['fk_acc_id' => $accOther,        'aml_debit' => 50, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accExpense, 'aml_debit' => 0,  'aml_credit' => 50],
            ]
        );
        $this->assertEquals('in_refund', $move->amo_document_type);
    }

    // ── Journal OD — comptes neutres → 'entry' ──────────────────────────────

    public function test_general_journal_with_neutral_accounts_returns_entry(): void
    {
        // Écriture OD purement financière (banque / banque, ou intercomptes sans 6/7)
        $accBank1 = $this->createAccount('512001', 'asset_cash');
        $accBank2 = $this->createAccount('512002', 'asset_cash');
        $move = AccountMoveModel::saveWithValidation(
            $this->moveBase($this->generalJournalId),
            [
                ['fk_acc_id' => $accBank1, 'aml_debit' => 100, 'aml_credit' => 0],
                ['fk_acc_id' => $accBank2, 'aml_debit' => 0,   'aml_credit' => 100],
            ]
        );
        // Aucun compte 6/7/tiers → pas de signal → fallback OD → 'entry'
        $this->assertEquals('entry', $move->amo_document_type);
    }

    // ── Note de frais sur journal OD → 'in_invoice' (charge au débit) ────────

    public function test_expense_report_on_od_journal_detected_as_in_invoice(): void
    {
        $accBank = $this->createAccount('512003', 'asset_cash');
        $move = AccountMoveModel::saveWithValidation(
            $this->moveBase($this->generalJournalId),
            [
                ['fk_acc_id' => $this->accExpense, 'aml_debit' => 85, 'aml_credit' => 0],
                ['fk_acc_id' => $accBank,          'aml_debit' => 0,  'aml_credit' => 85],
            ]
        );
        // Charge au débit sur un OD → in_invoice (note de frais, charge bancaire…)
        $this->assertEquals('in_invoice', $move->amo_document_type);
    }

    // ── Valeur explicite → priorité absolue ──────────────────────────────────

    public function test_explicit_out_refund_takes_priority_over_line_analysis(): void
    {
        // Écriture qui ressemble à une facture normale mais forcée en out_refund
        $move = AccountMoveModel::saveWithValidation(
            array_merge($this->moveBase($this->saleJournalId), ['amo_document_type' => 'out_refund']),
            [
                ['fk_acc_id' => $this->accReceivable, 'aml_debit' => 100, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accIncome,     'aml_debit' => 0,   'aml_credit' => 100],
            ]
        );
        $this->assertEquals('out_refund', $move->amo_document_type);
    }

    public function test_explicit_null_takes_priority_even_on_sale_journal(): void
    {
        $move = AccountMoveModel::saveWithValidation(
            array_merge($this->moveBase($this->saleJournalId), ['amo_document_type' => null]),
            [
                ['fk_acc_id' => $this->accReceivable, 'aml_debit' => 100, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accIncome,     'aml_debit' => 0,   'aml_credit' => 100],
            ]
        );
        $this->assertNull($move->amo_document_type);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function moveBase(int $journalId): array
    {
        return [
            'fk_ajl_id' => $journalId,
            'fk_aex_id' => $this->exerciseId,
            'amo_date'  => '2026-06-15',
            'amo_label' => 'Test doc type',
        ];
    }

    /** Helper pour les tests liés à une facture/paiement (lignes standard client+produit) */
    private function saveTwoLinedMove(int $journalId, array $extra = []): AccountMoveModel
    {
        return AccountMoveModel::saveWithValidation(
            array_merge($this->moveBase($journalId), $extra),
            [
                ['fk_acc_id' => $this->accReceivable, 'aml_debit' => 100, 'aml_credit' => 0],
                ['fk_acc_id' => $this->accIncome,     'aml_debit' => 0,   'aml_credit' => 100],
            ]
        );
    }
}
