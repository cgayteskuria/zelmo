<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountTaxReportMappingModel;
use App\Models\AccountTaxDeclarationModel;
use App\Services\AccountVatDeclarationService;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiAccountVatDeclarationController extends Controller
{
    use HasGridFilters;

    private AccountVatDeclarationService $service;

    public function __construct(AccountVatDeclarationService $service)
    {
        $this->service = $service;
    }

    public function index(Request $request)
    {
        $gridKey = 'vat-declarations';

        if (!$request->has('sort_by')) {
            $saved = $this->loadGridSettings($gridKey);
            if ($saved) {
                $merge = [];
                if (!empty($saved['sort_by']))    $merge['sort_by']    = $saved['sort_by'];
                if (!empty($saved['sort_order'])) $merge['sort_order'] = $saved['sort_order'];
                if (!empty($saved['filters']))    $merge['filters']    = $saved['filters'];
                if (!empty($saved['page_size']))  $merge['limit']      = $saved['page_size'];
                $request->merge($merge);
            }
        }

        $query = AccountTaxDeclarationModel::from('account_tax_declaration_vdc as vdc')
            ->leftJoin('account_move_amo as amo', 'amo.amo_id', '=', 'vdc.fk_amo_id')
            ->select([
                'vdc.vdc_id',
                'vdc.vdc_label',
                'vdc.vdc_period_start',
                'vdc.vdc_period_end',
                'vdc.vdc_type',
                'vdc.vdc_system',
                'vdc.vdc_regime',
                'vdc.vdc_status',
                // CA3 : boxes 16/23/28 ; CA12 : T1/T2/T3 — on charge les deux, null si absent
                DB::raw('COALESCE((SELECT vdl_amount_tva FROM account_tax_declaration_line_vdl WHERE fk_vdc_id = vdc.vdc_id AND vdl_box = "16"), (SELECT vdl_amount_tva FROM account_tax_declaration_line_vdl WHERE fk_vdc_id = vdc.vdc_id AND vdl_box = "T1")) as box16_amount'),
                DB::raw('COALESCE((SELECT vdl_amount_tva FROM account_tax_declaration_line_vdl WHERE fk_vdc_id = vdc.vdc_id AND vdl_box = "23"), (SELECT vdl_amount_tva FROM account_tax_declaration_line_vdl WHERE fk_vdc_id = vdc.vdc_id AND vdl_box = "T2")) as box23_amount'),
                DB::raw('COALESCE((SELECT vdl_amount_tva FROM account_tax_declaration_line_vdl WHERE fk_vdc_id = vdc.vdc_id AND vdl_box = "28"), (SELECT vdl_amount_tva FROM account_tax_declaration_line_vdl WHERE fk_vdc_id = vdc.vdc_id AND vdl_box = "T3")) as box28_amount'),
            ]);

        $this->applyGridFilters($query, $request, [
            'vdc_period_start' => 'vdc.vdc_period_start',
            'vdc_period_end'   => 'vdc.vdc_period_end',
            'vdc_type'         => 'vdc.vdc_type',
            'vdc_system'       => 'vdc.vdc_system',
            'vdc_status'       => 'vdc.vdc_status',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'vdc_period_start' => 'vdc.vdc_period_start',
            'vdc_period_end'   => 'vdc.vdc_period_end',
            'vdc_type'         => 'vdc.vdc_type',
            'vdc_system'       => 'vdc.vdc_system',
            'vdc_status'       => 'vdc.vdc_status',
        ], 'vdc_period_start', 'DESC');

        $this->applyGridPagination($query, $request, 25);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'vdc_period_start'),
            'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int)$request->input('limit', 25),
        ];

        // Ne sauvegarder les réglages que lorsque l'utilisateur interagit réellement
        // avec la grille (sort_by toujours envoyé par fetchData dans useServerTable).
        // Les requêtes sans sort_by (chargement initial, vérification hasDraft, etc.)
        // ne doivent pas écraser les réglages persistés.
        if ($request->has('sort_by')) {
            $this->saveGridSettings($gridKey, $currentSettings);
        }

        return response()->json([
            'data'         => $query->get(),
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    public function show($id)
    {
        $declaration = AccountTaxDeclarationModel::with(['lines', 'move', 'author:usr_id,usr_firstname,usr_lastname'])
            ->findOrFail($id);

        $declaration->setRelation('lines', $declaration->lines);

        // Indique si cette déclaration peut être supprimée :
        //   - brouillon : toujours supprimable
        //   - clôturée  : uniquement si c'est la dernière (vdc_id max)
        //                 ET qu'aucun brouillon n'est en cours
        $canDelete = $declaration->isDraft();
        if ($declaration->isClosed()) {
            $maxClosedId = AccountTaxDeclarationModel::where('vdc_status', 'closed')->max('vdc_id');
            $hasDraft    = AccountTaxDeclarationModel::where('vdc_status', 'draft')->exists();
            $canDelete   = ($maxClosedId === $declaration->vdc_id) && !$hasDraft;
        }
        $declaration->setAttribute('vdc_can_delete', $canDelete);

        return response()->json(['status' => true, 'data' => $declaration]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'period_start'    => 'required|date',
            'period_end'      => 'required|date|after_or_equal:period_start',
            'type'            => 'required|in:monthly,quarterly,mini_reel',
            'regime'          => 'nullable|in:debits,encaissements',
            'credit_previous' => 'nullable|numeric|min:0',
            'vat_system'      => 'nullable|in:reel,simplifie',
            'include_draft'   => 'nullable|boolean',
        ], [
            'period_start.required'         => 'La date de début de période est obligatoire.',
            'period_start.date'             => 'La date de début de période est invalide.',
            'period_end.required'           => 'La date de fin de période est obligatoire.',
            'period_end.date'               => 'La date de fin de période est invalide.',
            'period_end.after_or_equal'     => 'La date de fin doit être postérieure ou égale à la date de début.',
            'type.required'                 => 'La périodicité est obligatoire.',
            'type.in'                       => 'La périodicité doit être mensuelle, trimestrielle ou mini-réel.',
            'regime.in'                     => 'Le régime doit être "débits" ou "encaissements".',
            'credit_previous.numeric'       => 'Le crédit reporté doit être un nombre.',
            'credit_previous.min'           => 'Le crédit reporté ne peut pas être négatif.',
            'vat_system.in'                 => 'Le système TVA doit être "reel" ou "simplifie".',
        ]);

       
        $existingDraft = AccountTaxDeclarationModel::where('vdc_status', 'draft')->first();
        if ($existingDraft) {
            return response()->json([
                'status'  => false,
                'message' => 'Une déclaration est déjà en brouillon. Validez ou supprimez-la avant d\'en créer une nouvelle.',
            ], 422);
        }

        try {
            // Pré-remplir vdc_label à partir de la période qui vient de se clôturer
            // avant aujourd'hui (pas depuis les dates de la requête).
            $today = \Carbon\Carbon::today();
            $type  = $validated['type'];

            if ($type === 'monthly') {
                // Dernier mois clos = mois précédant aujourd'hui
                $refDate   = $today->copy()->subMonthNoOverflow()->startOfMonth();
                $autoLabel = ucfirst($refDate->locale('fr')->translatedFormat('F Y'));
            } else {
                // Dernier trimestre clos avant aujourd'hui
                $currentQ  = $today->quarter; // 1–4 (propriété Carbon)
                $prevQ     = $currentQ === 1 ? 4 : $currentQ - 1;
                $prevYear  = $currentQ === 1 ? $today->year - 1 : $today->year;
                $autoLabel = 'T' . $prevQ . ' ' . $prevYear;
            }

            $validated['vdc_label'] = $validated['vdc_label'] ?? $autoLabel;

            $declaration = $this->service->computeLines(
                $validated['period_start'],
                $validated['period_end'],
                (bool)($validated['include_draft'] ?? false),
                $request->user()->usr_id,
                $validated['vdc_label']
            );
            return response()->json(['status' => true, 'data' => $declaration], 201);
        } catch (\Exception $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function updateLabel(Request $request, $id)
    {
        $declaration = AccountTaxDeclarationModel::findOrFail($id);

        if (!$declaration->isDraft()) {
            return response()->json(['status' => false, 'message' => 'Le libellé ne peut être modifié que sur un brouillon.'], 422);
        }

        $validated = $request->validate(['vdc_label' => 'required|string|max:255']);
        $declaration->update([
            'vdc_label'         => $validated['vdc_label'],
            'fk_usr_id_updater' => $request->user()->usr_id,
            'vdc_updated'       => now(),
        ]);

        return response()->json(['status' => true, 'data' => $declaration]);
    }

    public function destroy($id)
    {
        $declaration = AccountTaxDeclarationModel::with('lines')->findOrFail($id);

        try {
            $this->service->deleteDeclaration($declaration);
            return response()->json(['status' => true, 'message' => 'Déclaration supprimée.']);
        } catch (\Exception $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function close(Request $request, $id)
    {
        $declaration = AccountTaxDeclarationModel::with('lines')->findOrFail($id);

        try {
            $declaration = $this->service->closeDeclaration($declaration, $request->user()->usr_id);
            return response()->json(['status' => true, 'data' => $declaration]);
        } catch (\Exception $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function preview(Request $request)
    {
        $validated = $request->validate([
            'period_start'    => 'required|date',
            'period_end'      => 'required|date|after_or_equal:period_start',
            'regime'          => 'nullable|in:debits,encaissements',
            'credit_previous' => 'nullable|numeric|min:0',
            'mini_reel'       => 'nullable|boolean',
            'vat_system'      => 'nullable|in:reel,simplifie',
            'include_draft'   => 'nullable|boolean',
        ]);

        try {
            $declaration = $this->service->computeLines(
                $validated['period_start'],
                $validated['period_end'],
                (bool)($validated['include_draft'] ?? false),
                $request->user()->usr_id
            );

            return response()->json(['status' => true, 'data' => $declaration], 201);
        } catch (\Exception $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function nextDeadline()
    {
        try {
            $config    = \App\Models\AccountConfigModel::findOrFail(1);
            $deadlines = $this->service->computeNextDeadlines($config);
            return response()->json(['status' => true, 'data' => $deadlines]);
        } catch (\Exception $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Met à jour manuellement le montant d'une case PREVIOUS_CREDIT ou REFUND_REQUESTED.
     * PATCH /api/vat-declarations/{id}/lines/{vdlId}/amount
     */
    public function updateLineAmount(Request $request, $id, $vdlId)
    {
        $declaration = AccountTaxDeclarationModel::findOrFail($id);
        $validated = $request->validate(['vdl_amount_tva' => 'required|numeric|min:0']);

        try {
            $updated = $this->service->updateManualLine(
                $declaration,
                (int) $vdlId,
                (float) $validated['vdl_amount_tva'],
                $request->user()->usr_id
            );
            return response()->json(['status' => true, 'data' => $updated]);
        } catch (\Exception $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Retourne les lignes d'écritures sources d'une case CA3 (audit trail).
     * GET /api/vat-declarations/{id}/box-lines/{vdlId}
     */
    public function boxLines($id, $vdlId)
    {
        $declaration = AccountTaxDeclarationModel::findOrFail($id);

        try {
            $lines = $this->service->getBoxSourceLines($declaration, $vdlId);
            return response()->json(['status' => true, 'data' => $lines, 'vdlId' => $vdlId]);
        } catch (\Exception $e) {
            return response()->json(['status' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Retourne le mapping TVA (cases + relations tags) pour un régime donné.
     * Utilisé par l'interface d'administration du mapping.
     */
    public function mapping(Request $request)
    {
        $regime = strtoupper($request->input('regime', 'CA3'));

        if (!in_array($regime, ['CA3', 'CA12'])) {
            return response()->json(['status' => false, 'message' => 'Régime invalide.'], 422);
        }

        $rows = AccountTaxReportMappingModel::forRegime($regime)->get();

        $tagIds = $rows->flatMap(fn($r) => [$r->fk_ttg_id_base, $r->fk_ttg_id_tax])
            ->filter()
            ->unique()
            ->values();

        $tags = \App\Models\AccountTaxTagModel::whereIn('ttg_id', $tagIds)
            ->get(['ttg_id', 'ttg_code', 'ttg_name'])
            ->keyBy('ttg_id');

        $data = $rows->map(fn($trm) => [
            'trm_id'          => $trm->trm_id,
            'trm_box'         => $trm->trm_box,
            'trm_label'       => $trm->trm_label,
            'trm_row_type'    => $trm->trm_row_type,
            'trm_order'       => $trm->trm_order,
            'trm_regime'      => $trm->trm_regime,
            // 'trm_sign'        => $trm->trm_sign,
            'trm_tax_rate'    => $trm->trm_tax_rate,
            'trm_formula'     => $trm->trm_formula,
            'trm_dgfip_code'  => $trm->trm_dgfip_code,
            'tag_base'        => $trm->fk_ttg_id_base ? [
                'ttg_id'   => $trm->fk_ttg_id_base,
                'ttg_code' => $tags[$trm->fk_ttg_id_base]?->ttg_code,
                'ttg_name' => $tags[$trm->fk_ttg_id_base]?->ttg_name,
            ] : null,
            'tag_tax'         => $trm->fk_ttg_id_tax ? [
                'ttg_id'   => $trm->fk_ttg_id_tax,
                'ttg_code' => $tags[$trm->fk_ttg_id_tax]?->ttg_code,
                'ttg_name' => $tags[$trm->fk_ttg_id_tax]?->ttg_name,
            ] : null,
        ]);

        return response()->json(['status' => true, 'data' => $data]);
    }
}
