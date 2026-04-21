<?php

namespace App\Http\Controllers\Api;

use App\Models\TicketGradeModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiTicketGradeController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'ticket-grades';

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

        $query = TicketGradeModel::query();
        $this->applyGridFilters($query, $request, ['tkg_label' => 'tkg_label']);
        $total = $query->count();
        $this->applyGridSort($query, $request, ['id' => 'tkg_id', 'tkg_label' => 'tkg_label', 'tkg_order' => 'tkg_order'], 'tkg_order', 'ASC');
        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'tkg_order'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json(['data' => $query->get(), 'total' => $total, 'gridSettings' => $currentSettings]);
    }

    public function show($id)
    {
        $item = TicketGradeModel::where('tkg_id', $id)->firstOrFail();

        return response()->json(['status' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'tkg_label' => 'required|string|max:50|unique:ticket_grade_tkg,tkg_label',
            'tkg_order' => 'nullable|integer',
            'tkg_color' => 'nullable|string|max:255',
        ]);

        $validated['fk_usr_id_author'] = $request->user()->usr_id;
        $validated['fk_usr_id_updater'] = $request->user()->usr_id;

        $item = TicketGradeModel::create($validated);

        return response()->json(['message' => 'Grade créé', 'data' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $item = TicketGradeModel::findOrFail($id);

        $validated = $request->validate([
            'tkg_label' => 'required|string|max:50|unique:ticket_grade_tkg,tkg_label,' . $id . ',tkg_id',
            'tkg_order' => 'nullable|integer',
            'tkg_color' => 'nullable|string|max:255',
        ]);

        $validated['fk_usr_id_updater'] = $request->user()->usr_id;

        $item->update($validated);

        return response()->json(['message' => 'Grade mis à jour', 'data' => $item]);
    }

    public function destroy($id)
    {
        $item = TicketGradeModel::findOrFail($id);
        $item->delete();

        return response()->json(['message' => 'Grade supprimé']);
    }
}
