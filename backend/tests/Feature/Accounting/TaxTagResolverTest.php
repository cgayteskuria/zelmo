<?php

namespace Tests\Feature\Accounting;

use App\Services\TaxTagResolver;
use Illuminate\Support\Facades\DB;

class TaxTagResolverTest extends AccountingTestCase
{
    private int $tagId;
    private int $tagRefundId;
    private int $taxId;
    private int $accTaxId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tagId       = DB::table('account_tax_tag_ttg')->insertGetId(['ttg_name' => 'Base TVA 20%',   'ttg_code' => 'FR_BASE_VENTE_20',  'ttg_applicability' => 'taxes', 'ttg_country_id' => null]);
        $this->tagRefundId = DB::table('account_tax_tag_ttg')->insertGetId(['ttg_name' => 'Base avoir 20%', 'ttg_code' => 'FR_BASE_AVOIR_20', 'ttg_applicability' => 'taxes', 'ttg_country_id' => null]);
        $this->accTaxId    = $this->createAccount('445710', 'liability_current');
        $this->taxId       = DB::table('tax_tax')->insertGetId(['tax_label' => 'TVA 20% ventes', 'tax_rate' => 20]);

        TaxTagResolver::clearCache();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Insère une ligne de répartition et attache les tags via le pivot rtr.
     */
    private function insertTrl(array $attrs, array $tagIds = []): int
    {
        $trlId = DB::table('account_tax_repartition_line_trl')->insertGetId($attrs);

        foreach ($tagIds as $ttgId) {
            DB::table('account_tax_repartition_line_tag_rel_rtr')->insertOrIgnore([
                'fk_trl_id' => $trlId,
                'fk_ttg_id' => $ttgId,
            ]);
        }

        return $trlId;
    }

    // ── Ligne de base (base HT) ───────────────────────────────────────────────

    public function test_resolves_base_tag_for_invoice_line(): void
    {
        $this->insertTrl([
            'fk_tax_id'            => $this->taxId,
            'trl_repartition_type' => 'base',
            'trl_document_type'    => 'invoice',
            'trl_sign'             => 1,
            'trl_factor_percent'   => 100,
        ], [$this->tagId]);

        $tags = TaxTagResolver::resolveTagsForLine($this->taxId, false, 'invoice', null);

        $this->assertCount(1, $tags);
        $this->assertEquals($this->tagId, $tags[0]['ttg_id']);
    }

    // ── Ligne TVA ─────────────────────────────────────────────────────────────

    public function test_resolves_tax_line_tag(): void
    {
        $this->insertTrl([
            'fk_tax_id'            => $this->taxId,
            'trl_repartition_type' => 'tax',
            'trl_document_type'    => 'invoice',
            'fk_acc_id'            => $this->accTaxId,
            'trl_sign'             => 1,
            'trl_factor_percent'   => 100,
        ], [$this->tagId]);

        $tags = TaxTagResolver::resolveTagsForLine($this->taxId, true, 'invoice', $this->accTaxId);

        $this->assertCount(1, $tags);
        $this->assertEquals($this->tagId, $tags[0]['ttg_id']);
    }

    // ── Ligne TVA multi-tags ──────────────────────────────────────────────────

    public function test_resolves_multiple_tags(): void
    {
        $this->insertTrl([
            'fk_tax_id'            => $this->taxId,
            'trl_repartition_type' => 'base',
            'trl_document_type'    => 'invoice',
            'trl_sign'             => 1,
            'trl_factor_percent'   => 100,
        ], [$this->tagId, $this->tagRefundId]);

        $tags = TaxTagResolver::resolveTagsForLine($this->taxId, false, 'invoice', null);

        $this->assertCount(2, $tags);
        $ttgIds = array_column($tags, 'ttg_id');
        $this->assertContains($this->tagId, $ttgIds);
        $this->assertContains($this->tagRefundId, $ttgIds);
    }

    // ── Avoir ─────────────────────────────────────────────────────────────────

    public function test_resolves_correct_tag_for_refund(): void
    {
        $this->insertTrl([
            'fk_tax_id'            => $this->taxId,
            'trl_repartition_type' => 'base',
            'trl_document_type'    => 'invoice',
            'trl_sign'             => 1,
            'trl_factor_percent'   => 100,
        ], [$this->tagId]);

        $this->insertTrl([
            'fk_tax_id'            => $this->taxId,
            'trl_repartition_type' => 'base',
            'trl_document_type'    => 'refund',
            'trl_sign'             => -1,
            'trl_factor_percent'   => 100,
        ], [$this->tagRefundId]);

        $tags = TaxTagResolver::resolveTagsForLine($this->taxId, false, 'refund', null);

        $this->assertCount(1, $tags);
        $this->assertEquals($this->tagRefundId, $tags[0]['ttg_id']);
    }

    // ── Pas de configuration → tableau vide (normal) ─────────────────────────

    public function test_returns_empty_when_trl_missing(): void
    {
        $tags = TaxTagResolver::resolveTagsForLine($this->taxId, false, 'invoice', null);

        $this->assertIsArray($tags);
        $this->assertEmpty($tags);
    }

    public function test_returns_empty_when_no_tag_on_trl(): void
    {
        // TRL sans aucun tag dans le pivot — cas normal (colonne sans tag configuré)
        $this->insertTrl([
            'fk_tax_id'            => $this->taxId,
            'trl_repartition_type' => 'base',
            'trl_document_type'    => 'invoice',
            'trl_sign'             => 1,
            'trl_factor_percent'   => 100,
        ], []); // aucun tag attaché

        $tags = TaxTagResolver::resolveTagsForLine($this->taxId, false, 'invoice', null);

        $this->assertIsArray($tags);
        $this->assertEmpty($tags);
    }

    // ── Cache statique ────────────────────────────────────────────────────────

    public function test_static_cache_avoids_duplicate_queries(): void
    {
        $this->insertTrl([
            'fk_tax_id'            => $this->taxId,
            'trl_repartition_type' => 'base',
            'trl_document_type'    => 'invoice',
            'trl_sign'             => 1,
            'trl_factor_percent'   => 100,
        ], [$this->tagId]);

        DB::enableQueryLog();
        TaxTagResolver::resolveTagsForLine($this->taxId, false, 'invoice', null);
        $queriesFirst = count(DB::getQueryLog());

        DB::flushQueryLog();
        TaxTagResolver::resolveTagsForLine($this->taxId, false, 'invoice', null);
        $queriesSecond = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertGreaterThan(0, $queriesFirst);
        $this->assertEquals(0, $queriesSecond, 'Le cache doit éviter la seconde requête SQL');
    }

    public function test_clear_cache_forces_new_query(): void
    {
        $this->insertTrl([
            'fk_tax_id'            => $this->taxId,
            'trl_repartition_type' => 'base',
            'trl_document_type'    => 'invoice',
            'trl_sign'             => 1,
            'trl_factor_percent'   => 100,
        ], [$this->tagId]);

        TaxTagResolver::resolveTagsForLine($this->taxId, false, 'invoice', null);
        TaxTagResolver::clearCache();

        DB::enableQueryLog();
        TaxTagResolver::resolveTagsForLine($this->taxId, false, 'invoice', null);
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertGreaterThan(0, $queries, 'Après clearCache, une nouvelle requête doit être émise');
    }
}
