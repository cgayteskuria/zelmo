<?php

namespace App\Http\Controllers\Api;

use App\Models\TicketStatusModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiTicketStatusController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'ticket-statuses';

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

        $query = TicketStatusModel::query();
        $this->applyGridFilters($query, $request, ['tke_label' => 'tke_label']);
        $total = $query->count();
        $this->applyGridSort($query, $request, ['id' => 'tke_id', 'tke_label' => 'tke_label', 'tke_order' => 'tke_order'], 'tke_order', 'ASC');
        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'tke_order'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json(['data' => $query->get(), 'total' => $total, 'gridSettings' => $currentSettings]);
    }

    public function show($id)
    {
        $item = TicketStatusModel::where('tke_id', $id)->firstOrFail();

        return response()->json(['status' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'tke_label' => 'required|string|max:50|unique:ticket_status_tke,tke_label',
            'tke_order' => 'nullable|integer',
            'tke_color' => 'nullable|string|max:50',
        ]);

        $validated['fk_usr_id_author'] = $request->user()->usr_id;
        $validated['fk_usr_id_updater'] = $request->user()->usr_id;

        $item = TicketStatusModel::create($validated);

        return response()->json(['message' => 'Statut créé', 'data' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $item = TicketStatusModel::findOrFail($id);

        $validated = $request->validate([
            'tke_label' => 'required|string|max:50|unique:ticket_status_tke,tke_label,' . $id . ',tke_id',
            'tke_order' => 'nullable|integer',
            'tke_color' => 'nullable|string|max:50',
        ]);

        $validated['fk_usr_id_updater'] = $request->user()->usr_id;

        $item->update($validated);

        return response()->json(['message' => 'Statut mis à jour', 'data' => $item]);
    }

    public function destroy($id)
    {
        $item = TicketStatusModel::findOrFail($id);
        $item->delete();

        return response()->json(['message' => 'Statut supprimé']);
    }
}
