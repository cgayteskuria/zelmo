<?php

namespace App\Http\Controllers\Api;

use App\Models\TicketCategoryModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiTicketCategoryController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'ticket-categories';

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

        $query = TicketCategoryModel::query();
        $this->applyGridFilters($query, $request, ['tkc_label' => 'tkc_label']);
        $total = $query->count();
        $this->applyGridSort($query, $request, ['id' => 'tkc_id', 'tkc_label' => 'tkc_label'], 'tkc_label', 'ASC');
        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'tkc_label'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json(['data' => $query->get(), 'total' => $total, 'gridSettings' => $currentSettings]);
    }

    public function show($id)
    {
        $item = TicketCategoryModel::where('tkc_id', $id)->firstOrFail();

        return response()->json(['status' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'tkc_label' => 'required|string|max:50|unique:ticket_category_tkc,tkc_label',
        ]);

        $validated['fk_usr_id_author'] = $request->user()->usr_id;
        $validated['fk_usr_id_updater'] = $request->user()->usr_id;

        $item = TicketCategoryModel::create($validated);

        return response()->json(['message' => 'Catégorie créée', 'data' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $item = TicketCategoryModel::findOrFail($id);

        $validated = $request->validate([
            'tkc_label' => 'required|string|max:50|unique:ticket_category_tkc,tkc_label,' . $id . ',tkc_id',
        ]);

        $validated['fk_usr_id_updater'] = $request->user()->usr_id;

        $item->update($validated);

        return response()->json(['message' => 'Catégorie mise à jour', 'data' => $item]);
    }

    public function destroy($id)
    {
        $item = TicketCategoryModel::findOrFail($id);
        $item->delete();

        return response()->json(['message' => 'Catégorie supprimée']);
    }
}
