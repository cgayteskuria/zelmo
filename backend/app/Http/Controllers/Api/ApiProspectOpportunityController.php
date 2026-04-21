<?php

namespace App\Http\Controllers\Api;

use App\Models\ProspectOpportunityModel;
use App\Models\ProspectPipelineStageModel;
use App\Models\PartnerModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ApiProspectOpportunityController extends Controller
{
    use HasGridFilters;

    /**
     * Liste des opportunités avec ServerTable (filtres, tri, pagination)
     */
    public function index(Request $request)
    {
        $gridKey = 'opportunities';

        // --- Gestion des grid settings ---
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

        $user = Auth::user();
        $canViewAll = $user->can('opportunities.view_all');

        $query = ProspectOpportunityModel::query()
            ->select([
                'prospect_opportunity_opp.opp_id as id',
                'opp_label',
                'opp_amount',
                'opp_probability',
                'opp_closed_date',
                'opp_closed_date',
                'opp_created',
                'pps_label',
                'pps_color',
                'pps_is_won',
                'pps_is_lost',
                'ptr_name',
                'pso_label',
                DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname) as seller_name"),
                DB::raw("ROUND(opp_amount * opp_probability / 100, 2) as opp_weighted_amount"),
            ])
            ->leftJoin('prospect_pipeline_stage_pps', 'fk_pps_id', '=', 'pps_id')
            ->leftJoin('partner_ptr', 'fk_ptr_id', '=', 'ptr_id')
            ->leftJoin('prospect_source_pso', 'fk_pso_id', '=', 'pso_id')
            ->leftJoin('user_usr as seller', 'prospect_opportunity_opp.fk_usr_id_seller', '=', 'seller.usr_id');

        // Filtre de visibilité : commercial ne voit que ses opportunités
        if (!$canViewAll) {
            $query->where('prospect_opportunity_opp.fk_usr_id_seller', $user->usr_id);
        }

        // Filtres dynamiques
        $filterColumnMap = [
            'opp_label' => 'opp_label',
            'ptr_name' => 'ptr_name',
            'pps_label' => 'pps_label',
            'seller_name' => DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname)"),
            'pso_label' => 'pso_label',
            'opp_amount' => 'opp_amount',
            'opp_probability' => 'opp_probability',
            'opp_closed_date' => 'opp_closed_date',
            'opp_created' => 'opp_created',
        ];
        $this->applyGridFilters($query, $request, $filterColumnMap);

        $total = $query->count();

        // Tri
        $sortColumnMap = [
            'id' => 'opp_id',
            'opp_label' => 'opp_label',
            'ptr_name' => 'ptr_name',
            'pps_label' => 'pps_order',
            'opp_amount' => 'opp_amount',
            'opp_probability' => 'opp_probability',
            'opp_weighted_amount' => DB::raw("opp_amount * opp_probability / 100"),
            'opp_closed_date' => 'opp_closed_date',
            'seller_name' => DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname)"),
            'opp_created' => 'opp_created',
        ];
        $this->applyGridSort($query, $request, $sortColumnMap, 'opp_created', 'DESC');
        $this->applyGridPagination($query, $request);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'opp_created'),
            'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $query->get(),
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Détail d'une opportunité
     */
    public function show($id)
    {
        $opp = ProspectOpportunityModel::with([
            'stage',
            'partner',
            'contact:ctc_id,ctc_firstname,ctc_lastname,ctc_email',
            'seller:usr_id,usr_firstname,usr_lastname,usr_login',
            'source',
            'lostReason',
        ])->withCount(['activities', 'documents'])->findOrFail($id);

        return response()->json(['status' => true, 'data' => $opp]);
    }

    /**
     * Création
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'opp_label' => 'required|string|max:255',
            'opp_description' => 'nullable|string',
            'opp_amount' => 'nullable|numeric|min:0',
            'opp_probability' => 'nullable|integer|min:0|max:100',
            'opp_closed_date' => 'nullable|date',
            'opp_notes' => 'nullable|string',
            'fk_pps_id' => 'required|exists:prospect_pipeline_stage_pps,pps_id',
            'fk_ptr_id' => 'required|exists:partner_ptr,ptr_id',
            'fk_ctc_id' => 'nullable|exists:contact_ctc,ctc_id',
            'fk_usr_id_seller' => 'required|exists:user_usr,usr_id',
            'fk_pso_id' => 'nullable|exists:prospect_source_pso,pso_id',
        ]);

        // Auto-remplir la probabilité depuis l'étape si non fournie
        if (!isset($validated['opp_probability']) || $validated['opp_probability'] === null) {
            $stage = ProspectPipelineStageModel::find($validated['fk_pps_id']);
            if ($stage) {
                $validated['opp_probability'] = $stage->pps_default_probability;
            }
        }

        $opp = ProspectOpportunityModel::create($validated);

        return response()->json(['message' => 'Opportunité créée', 'data' => $opp], 201);
    }

    /**
     * Mise à jour
     */
    public function update(Request $request, $id)
    {
        $opp = ProspectOpportunityModel::findOrFail($id);

        $validated = $request->validate([
            'opp_label' => 'sometimes|required|string|max:255',
            'opp_description' => 'nullable|string',
            'opp_amount' => 'nullable|numeric|min:0',
            'opp_probability' => 'nullable|integer|min:0|max:100',
            'opp_closed_date' => 'nullable|date',
            'opp_closed_date' => 'nullable|date',
            'opp_notes' => 'nullable|string',
            'fk_pps_id' => 'sometimes|required|exists:prospect_pipeline_stage_pps,pps_id',
            'fk_ptr_id' => 'sometimes|required|exists:partner_ptr,ptr_id',
            'fk_ctc_id' => 'nullable|exists:contact_ctc,ctc_id',
            'fk_usr_id_seller' => 'sometimes|required|exists:user_usr,usr_id',
            'fk_pso_id' => 'nullable|exists:prospect_source_pso,pso_id',
            'fk_plr_id' => 'nullable|exists:prospect_lost_reason_plr,plr_id',
        ]);

        $opp->update($validated);

        return response()->json(['message' => 'Opportunité mise à jour', 'data' => $opp]);
    }

    /**
     * Suppression
     */
    public function destroy($id)
    {
        $opp = ProspectOpportunityModel::findOrFail($id);
        $opp->delete();
        return response()->json(['message' => 'Opportunité supprimée']);
    }

    /**
     * Vue Pipeline (Kanban) : opportunités groupées par étape
     */
    public function pipeline(Request $request)
    {
        $user = Auth::user();
        $canViewAll = $user->can('opportunities.view_all');

        $stages = ProspectPipelineStageModel::where('pps_is_active', 1)
            ->orderBy('pps_order', 'asc')
            ->get();

        $query = ProspectOpportunityModel::query()
            ->select([
                'opp_id',
                'opp_label',
                'opp_amount',
                'opp_probability',
                'opp_closed_date',
                'fk_pps_id',
                'fk_ptr_id',
                'ptr_name',
                DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname) as seller_name"),
            ])
            ->leftJoin('partner_ptr', 'fk_ptr_id', '=', 'ptr_id')
            ->leftJoin('user_usr as seller', 'prospect_opportunity_opp.fk_usr_id_seller', '=', 'seller.usr_id');

        if (!$canViewAll) {
            $query->where('prospect_opportunity_opp.fk_usr_id_seller', $user->usr_id);
        }

        // Exclure les étapes terminées (gagné/perdu) par défaut, sauf si demandé
        if (!$request->boolean('include_closed', false)) {
            $closedStageIds = $stages->filter(fn($s) => $s->pps_is_won || $s->pps_is_lost)->pluck('pps_id');
            if ($closedStageIds->isNotEmpty()) {
                $query->whereNotIn('fk_pps_id', $closedStageIds);
            }
        }

        $opportunities = $query->get()->groupBy('fk_pps_id');

        $pipeline = $stages->map(function ($stage) use ($opportunities) {
            $stageOpps = $opportunities->get($stage->pps_id, collect());
            return [
                'stage' => [
                    'id' => $stage->pps_id,
                    'label' => $stage->pps_label,
                    'color' => $stage->pps_color,
                    'order' => $stage->pps_order,
                    'is_won' => $stage->pps_is_won,
                    'is_lost' => $stage->pps_is_lost,
                ],
                'opportunities' => $stageOpps->values(),
                'count' => $stageOpps->count(),
                'total_amount' => $stageOpps->sum('opp_amount'),
            ];
        });

        return response()->json(['data' => $pipeline->values()]);
    }

    /**
     * Marquer comme Gagné
     */
    public function markAsWon(Request $request, $id)
    {
        $opp = ProspectOpportunityModel::findOrFail($id);

        $wonStage = ProspectPipelineStageModel::where('pps_is_won', 1)->first();
        if (!$wonStage) {
            return response()->json(['message' => 'Aucune étape "Gagné" configurée'], 422);
        }

        $opp->update([
            'fk_pps_id' => $wonStage->pps_id,
            'opp_probability' => 100,
            'opp_closed_date' => now()->toDateString(),
        ]);

        return response()->json(['message' => 'Opportunité marquée comme gagnée', 'data' => $opp]);
    }

    /**
     * Marquer comme Perdu
     */
    public function markAsLost(Request $request, $id)
    {
        $opp = ProspectOpportunityModel::findOrFail($id);

        $request->validate([
            'fk_plr_id' => 'nullable|exists:prospect_lost_reason_plr,plr_id',
        ]);

        $lostStage = ProspectPipelineStageModel::where('pps_is_lost', 1)->first();
        if (!$lostStage) {
            return response()->json(['message' => 'Aucune étape "Perdu" configurée'], 422);
        }

        $opp->update([
            'fk_pps_id' => $lostStage->pps_id,
            'opp_probability' => 0,
            'opp_closed_date' => now()->toDateString(),
            'fk_plr_id' => $request->input('fk_plr_id'),
        ]);

        return response()->json(['message' => 'Opportunité marquée comme perdue', 'data' => $opp]);
    }

    /**
     * Convertir le prospect en client
     */
    public function convertToCustomer($id)
    {
        $opp = ProspectOpportunityModel::with('partner')->findOrFail($id);
        $partner = $opp->partner;

        if (!$partner) {
            return response()->json(['message' => 'Tiers introuvable'], 404);
        }

        $partner->update(['ptr_is_customer' => 1]);

        return response()->json([
            'message' => 'Prospect converti en client',
            'data' => $partner,
        ]);
    }

    /**
     * Opportunités d'un tiers donné
     */
    public function byPartner($ptrId)
    {
        $opportunities = ProspectOpportunityModel::where('fk_ptr_id', $ptrId)
            ->select([
                'opp_id',
                'opp_label',
                'opp_amount',
                'opp_probability',
                'opp_closed_date',
                'opp_closed_date',
                'pps_label',
                'pps_color',
                'pps_is_won',
                'pps_is_lost',
                DB::raw("ROUND(opp_amount * opp_probability / 100, 2) as opp_weighted_amount"),
            ])
            ->leftJoin('prospect_pipeline_stage_pps', 'fk_pps_id', '=', 'pps_id')
            ->orderBy('opp_created', 'desc')
            ->get();

        return response()->json(['data' => $opportunities]);
    }

    /**
     * Statistiques pour le dashboard
     */
    public function statistics(Request $request)
    {
        $user = Auth::user();
        $canViewAll = $user->can('opportunities.view_all');

        $baseQuery = function () use ($canViewAll, $user) {
            $q = ProspectOpportunityModel::query();
            if (!$canViewAll) {
                $q->where('fk_usr_id_seller', $user->usr_id);
            }
            return $q;
        };

        $stages = ProspectPipelineStageModel::where('pps_is_active', 1)
            ->orderBy('pps_order', 'asc')
            ->get();

        $wonStageIds = $stages->filter(fn($s) => $s->pps_is_won)->pluck('pps_id');
        $lostStageIds = $stages->filter(fn($s) => $s->pps_is_lost)->pluck('pps_id');
        $openStageIds = $stages->filter(fn($s) => !$s->pps_is_won && !$s->pps_is_lost)->pluck('pps_id');

        // KPIs globaux
        $openOpps = $baseQuery()->whereIn('fk_pps_id', $openStageIds);
        $pipelineTotal = (clone $openOpps)->sum('opp_amount');
        $pipelineWeighted = (clone $openOpps)->selectRaw('SUM(opp_amount * opp_probability / 100) as total')->value('total') ?? 0;
        $openCount = (clone $openOpps)->count();

        // Won/Lost ce mois
        $startOfMonth = now()->startOfMonth()->toDateString();
        $wonThisMonth = $baseQuery()->whereIn('fk_pps_id', $wonStageIds)
            ->where('opp_closed_date', '>=', $startOfMonth)->count();
        $lostThisMonth = $baseQuery()->whereIn('fk_pps_id', $lostStageIds)
            ->where('opp_closed_date', '>=', $startOfMonth)->count();

        // Taux de conversion (sur les 12 derniers mois)
        $yearAgo = now()->subMonths(12)->toDateString();
        $totalClosed = $baseQuery()->where('opp_closed_date', '>=', $yearAgo)
            ->whereIn('fk_pps_id', $wonStageIds->merge($lostStageIds))->count();
        $totalWon = $baseQuery()->where('opp_closed_date', '>=', $yearAgo)
            ->whereIn('fk_pps_id', $wonStageIds)->count();
        $conversionRate = $totalClosed > 0 ? round($totalWon / $totalClosed * 100, 1) : 0;

        // Montant par étape (funnel)
        $byStage = $stages->filter(fn($s) => !$s->pps_is_won && !$s->pps_is_lost)->map(function ($stage) use ($baseQuery) {
            $amount = (clone $baseQuery())->where('fk_pps_id', $stage->pps_id)->sum('opp_amount');
            $count = (clone $baseQuery())->where('fk_pps_id', $stage->pps_id)->count();
            return [
                'label' => $stage->pps_label,
                'color' => $stage->pps_color,
                'amount' => (float) $amount,
                'count' => $count,
            ];
        })->values();

        // Gagné vs Perdu par mois (6 derniers mois)
        $monthlyStats = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = now()->subMonths($i);
            $monthStart = $month->startOfMonth()->toDateString();
            $monthEnd = $month->endOfMonth()->toDateString();

            $won = $baseQuery()->whereIn('fk_pps_id', $wonStageIds)
                ->whereBetween('opp_closed_date', [$monthStart, $monthEnd])
                ->sum('opp_amount');
            $lost = $baseQuery()->whereIn('fk_pps_id', $lostStageIds)
                ->whereBetween('opp_closed_date', [$monthStart, $monthEnd])
                ->sum('opp_amount');

            $monthlyStats[] = [
                'month' => $month->format('Y-m'),
                'label' => $month->translatedFormat('M Y'),
                'won' => (float) $won,
                'lost' => (float) $lost,
            ];
        }

        // Top 5 opportunités
        $topOpportunities = $baseQuery()
            ->whereIn('fk_pps_id', $openStageIds)
            ->select(['opp_id', 'opp_label', 'opp_amount', 'opp_probability', 'opp_closed_date', 'fk_ptr_id'])
            ->leftJoin('partner_ptr', 'fk_ptr_id', '=', 'ptr_id')
            ->addSelect('ptr_name')
            ->orderByDesc('opp_amount')
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'pipeline_total' => (float) $pipelineTotal,
                'pipeline_weighted' => (float) $pipelineWeighted,
                'open_count' => $openCount,
                'conversion_rate' => $conversionRate,
                'won_this_month' => $wonThisMonth,
                'lost_this_month' => $lostThisMonth,
                'by_stage' => $byStage,
                'monthly_stats' => $monthlyStats,
                'top_opportunities' => $topOpportunities,
            ],
        ]);
    }

    /**
     * Options pour select (liste des opportunités ouvertes)
     */
    public function options(Request $request)
    {
        $user = Auth::user();
        $canViewAll = $user->can('opportunities.view_all');

        $query = ProspectOpportunityModel::query()
            ->select([
                'opp_id',
                'opp_label',
                'fk_ptr_id',
                'ptr_name',
            ])
            ->leftJoin('partner_ptr', 'fk_ptr_id', '=', 'ptr_id')
            ->leftJoin('prospect_pipeline_stage_pps', 'fk_pps_id', '=', 'pps_id')
            ->where('pps_is_won', 0)
            ->where('pps_is_lost', 0);

        if (!$canViewAll) {
            $query->where('prospect_opportunity_opp.fk_usr_id_seller', $user->usr_id);
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('opp_label', 'LIKE', "%{$search}%")
                  ->orWhere('ptr_name', 'LIKE', "%{$search}%");
            });
        }

        $data = $query->orderBy('opp_label', 'asc')
            ->limit(50)
            ->get()
            ->map(fn($item) => [
                'id' => $item->opp_id,
                'label' => $item->opp_label,
                'fk_ptr_id' => $item->fk_ptr_id,
                'ptr_name' => $item->ptr_name,
            ]);

        return response()->json(['data' => $data]);
    }

    /**
     * Stats par commercial (directeur commercial)
     */
    public function salesRepStats(Request $request)
    {
        $stages = ProspectPipelineStageModel::where('pps_is_active', 1)->get();
        $wonStageIds = $stages->filter(fn($s) => $s->pps_is_won)->pluck('pps_id');
        $lostStageIds = $stages->filter(fn($s) => $s->pps_is_lost)->pluck('pps_id');
        $openStageIds = $stages->filter(fn($s) => !$s->pps_is_won && !$s->pps_is_lost)->pluck('pps_id');

        $stats = DB::table('prospect_opportunity_opp')
            ->select([
                'prospect_opportunity_opp.fk_usr_id_seller',
                DB::raw("CONCAT(u.usr_firstname, ' ', u.usr_lastname) as seller_name"),
                DB::raw("COUNT(*) as total_opps"),
                DB::raw("SUM(CASE WHEN fk_pps_id IN (" . $openStageIds->implode(',') . ") THEN 1 ELSE 0 END) as open_opps"),
                DB::raw("SUM(CASE WHEN fk_pps_id IN (" . ($wonStageIds->isNotEmpty() ? $wonStageIds->implode(',') : '0') . ") THEN 1 ELSE 0 END) as won_opps"),
                DB::raw("SUM(CASE WHEN fk_pps_id IN (" . ($lostStageIds->isNotEmpty() ? $lostStageIds->implode(',') : '0') . ") THEN 1 ELSE 0 END) as lost_opps"),
                DB::raw("SUM(CASE WHEN fk_pps_id IN (" . $openStageIds->implode(',') . ") THEN opp_amount ELSE 0 END) as pipeline_amount"),
                DB::raw("SUM(CASE WHEN fk_pps_id IN (" . ($wonStageIds->isNotEmpty() ? $wonStageIds->implode(',') : '0') . ") THEN opp_amount ELSE 0 END) as won_amount"),
            ])
            ->join('user_usr as u', 'prospect_opportunity_opp.fk_usr_id_seller', '=', 'u.usr_id')
            ->groupBy('prospect_opportunity_opp.fk_usr_id_seller', 'u.usr_firstname', 'u.usr_lastname')
            ->get();

        return response()->json(['data' => $stats]);
    }
}
