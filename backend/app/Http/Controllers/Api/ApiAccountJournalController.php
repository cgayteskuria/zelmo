<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountJournalModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiAccountJournalController extends Controller

{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'account-journals';

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

        $query = AccountJournalModel::query();

        $this->applyGridFilters($query, $request, [
            'ajl_label' => 'ajl_label',
            'ajl_code'  => 'ajl_code',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'        => 'ajl_id',
            'ajl_label' => 'ajl_label',
            'ajl_code'  => 'ajl_code',
        ], 'ajl_label', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'ajl_label'),
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


    /**
     * Display the specified account journal.
     */
    public function show($id)
    {
        $journal = AccountJournalModel::where('ajl_id', $id)
            ->with([
                'author:usr_id,usr_firstname,usr_lastname',
                'updater:usr_id,usr_firstname,usr_lastname'
            ])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $journal
        ], 200);
    }

    /**
     * Store a newly created account journal.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'ajl_code' => 'required|string|max:20|unique:account_journal_ajl,ajl_code',
            'ajl_label' => 'required|string|max:255',
        ]);

        $validatedData['fk_usr_id_author'] = $request->user()->usr_id;
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $journal = AccountJournalModel::create($validatedData);

        return response()->json([
            'message' => 'Journal comptable créé avec succès',
            'data' => $journal->load(['author', 'updater']),
        ], 201);
    }

    /**
     * Update the specified account journal.
     */
    public function update(Request $request, $id)
    {
        $journal = AccountJournalModel::findOrFail($id);

        $validatedData = $request->validate([
            'ajl_code' => 'required|string|max:20|unique:account_journal_ajl,ajl_code,' . $id . ',ajl_id',
            'ajl_label' => 'required|string|max:255',
        ]);

        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;

        $journal->update($validatedData);

        return response()->json([
            'message' => 'Journal comptable mis à jour avec succès',
            'data' => $journal->load(['author', 'updater']),
        ]);
    }

    /**
     * Remove the specified account journal.
     */
    public function destroy($id)
    {
        $journal = AccountJournalModel::findOrFail($id);

        $journal->delete();

        return response()->json([
            'message' => 'Journal comptable supprimé avec succès'
        ]);
    }

    public function options(Request $request)
    {

        $query = AccountJournalModel::select('ajl_id as id', 'ajl_code as code', 'ajl_label as label')
            ->distinct();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('ajl_label', 'LIKE', "%{$search}%");
        }

        $data = $query->orderBy('ajl_label', 'asc')->get();

        return response()->json([
            'data' => $data
        ]);
    }
}
