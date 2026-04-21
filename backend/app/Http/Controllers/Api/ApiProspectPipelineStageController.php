<?php
namespace App\Http\Controllers\Api;

use App\Models\ProspectPipelineStageModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiProspectPipelineStageController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'pipeline-stages';

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

        $query = ProspectPipelineStageModel::query()
            ->select([
                'pps_id as id',
                'pps_label',
                'pps_order',
                'pps_color',
                'pps_default_probability',
                'pps_is_won',
                'pps_is_lost',
                'pps_is_active',
                'pps_is_default',
            ]);

        $filterColumnMap = [
            'pps_label' => 'pps_label',
        ];
        $this->applyGridFilters($query, $request, $filterColumnMap);

        $total = $query->count();

        $sortColumnMap = [
            'id' => 'pps_id',
            'pps_order' => 'pps_order',
            'pps_label' => 'pps_label',
            'pps_default_probability' => 'pps_default_probability',
            'pps_is_default' => 'pps_is_default',
        ];
        $this->applyGridSort($query, $request, $sortColumnMap, 'pps_order', 'ASC');
        $this->applyGridPagination($query, $request);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'pps_order'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
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

    public function show($id)
    {
        $item = ProspectPipelineStageModel::where('pps_id', $id)->firstOrFail();
        return response()->json(['status' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'pps_label'               => 'required|string|max:100|unique:prospect_pipeline_stage_pps,pps_label',
            'pps_order'               => 'required|integer',
            'pps_color'               => 'required|string|max:20',
            'pps_is_won'              => 'sometimes|boolean',
            'pps_is_lost'             => 'sometimes|boolean',
            'pps_default_probability' => 'required|integer|min:0|max:100',
            'pps_is_active'           => 'sometimes|boolean',
            'pps_is_default'          => 'sometimes|boolean',
        ]);

        if (!empty($validated['pps_is_won']) && !empty($validated['pps_is_lost'])) {
            return response()->json([
                'message' => 'Une étape ne peut pas être à la fois gagnée et perdue.',
            ], 422);
        }

        DB::transaction(function () use (&$item, $validated) {
            if (!empty($validated['pps_is_default'])) {
                ProspectPipelineStageModel::clearDefault();
            } else {
                $validated['pps_is_default'] = null;
            }

            $item = ProspectPipelineStageModel::create($validated);
        });

        return response()->json(['message' => 'Étape créée', 'data' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $item = ProspectPipelineStageModel::findOrFail($id);

        $validated = $request->validate([
            'pps_label'               => 'required|string|max:100|unique:prospect_pipeline_stage_pps,pps_label,' . $id . ',pps_id',
            'pps_order'               => 'sometimes|integer',
            'pps_color'               => 'sometimes|string|max:20',
            'pps_is_won'              => 'sometimes|boolean',
            'pps_is_lost'             => 'sometimes|boolean',
            'pps_default_probability' => 'sometimes|integer|min:0|max:100',
            'pps_is_active'           => 'sometimes|boolean',
            'pps_is_default'          => 'sometimes|boolean',
        ]);

        $isWon  = $validated['pps_is_won']  ?? $item->pps_is_won;
        $isLost = $validated['pps_is_lost'] ?? $item->pps_is_lost;

        if ($isWon && $isLost) {
            return response()->json([
                'message' => 'Une étape ne peut pas être à la fois gagnée et perdue.',
            ], 422);
        }

        DB::transaction(function () use ($item, $validated) {
            if (!empty($validated['pps_is_default'])) {
                ProspectPipelineStageModel::clearDefault(exceptId: $item->pps_id);
            } else {
                $validated['pps_is_default'] = null;
            }

            $item->update($validated);
        });

        return response()->json(['message' => 'Étape mise à jour', 'data' => $item->fresh()]);
    }

    public function destroy($id)
    {
        $item = ProspectPipelineStageModel::findOrFail($id);
        $item->delete();
        return response()->json(['message' => 'Étape supprimée']);
    }

    public function options(Request $request)
    {
        $query = ProspectPipelineStageModel::where('pps_is_active', 1);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('pps_label', 'LIKE', "%{$search}%");
        }

        $data = $query->orderBy('pps_order', 'asc')
            ->get()
            ->map(fn($item) => [
                'id'          => $item->pps_id,
                'label'       => $item->pps_label,
                'color'       => $item->pps_color,
                'probability' => $item->pps_default_probability,
                'is_won'      => $item->pps_is_won,
                'is_lost'     => $item->pps_is_lost,
                'default'     => (bool) $item->pps_is_default,
            ]);

        return response()->json(['data' => $data]);
    }
}
