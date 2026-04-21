<?php

namespace App\Http\Controllers\Api;

use App\Models\ProspectActivityModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ApiProspectActivityController extends Controller
{
    use HasGridFilters;

    /**
     * Liste des activités avec ServerTable
     */
    public function index(Request $request)
    {
        $gridKey = 'prospect-activities';

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
        $canViewAll = $user->can('prospect-activities.view_all');

        $query = ProspectActivityModel::query()
            ->select([
                'prospect_activity_pac.pac_id as id',
                'pac_type',
                'pac_subject',
                'pac_date',
                'pac_due_date',
                'pac_is_done',
                'pac_done_date',
                'pac_duration',
                'ptr_name',
                'opp_label',
                DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname) as seller_name"),
            ])
            ->leftJoin('partner_ptr', 'prospect_activity_pac.fk_ptr_id', '=', 'ptr_id')
            ->leftJoin('prospect_opportunity_opp', 'prospect_activity_pac.fk_opp_id', '=', 'opp_id')
            ->leftJoin('user_usr as seller', 'prospect_activity_pac.fk_usr_id_seller', '=', 'seller.usr_id');

        if (!$canViewAll) {
            $query->where('prospect_activity_pac.fk_usr_id_seller', $user->usr_id);
        }

        // Filtre "à faire uniquement"
        if ($request->boolean('pending_only', false)) {
            $query->where('pac_is_done', 0);
        }

        $filterColumnMap = [
            'pac_type' => 'pac_type',
            'pac_subject' => 'pac_subject',
            'ptr_name' => 'ptr_name',
            'opp_label' => 'opp_label',
            'seller_name' => DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname)"),
            'pac_date' => 'pac_date',
            'pac_due_date' => 'pac_due_date',
            'pac_is_done' => 'pac_is_done',
        ];
        $this->applyGridFilters($query, $request, $filterColumnMap);

        $total = $query->count();

        $sortColumnMap = [
            'id' => 'pac_id',
            'pac_type' => 'pac_type',
            'pac_subject' => 'pac_subject',
            'pac_date' => 'pac_date',
            'pac_due_date' => 'pac_due_date',
            'ptr_name' => 'ptr_name',
            'opp_label' => 'opp_label',
            'seller_name' => DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname)"),
            'pac_is_done' => 'pac_is_done',
        ];
        $this->applyGridSort($query, $request, $sortColumnMap, 'pac_date', 'DESC');
        $this->applyGridPagination($query, $request);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'pac_date'),
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
     * Activités d'une opportunité
     */
    public function byOpportunity($oppId)
    {
        $activities = ProspectActivityModel::where('fk_opp_id', $oppId)
            ->select([
                'pac_id',
                'pac_type',
                'pac_subject',
                'pac_description',
                'pac_date',
                'pac_due_date',
                'pac_is_done',
                'pac_done_date',
                'pac_duration',
                'fk_opp_id',
                'fk_ptr_id',
                'fk_ctc_id',
                DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname) as seller_name"),
                DB::raw("CONCAT(author.usr_firstname, ' ', author.usr_lastname) as author_name"),
            ])
            ->leftJoin('user_usr as seller', 'prospect_activity_pac.fk_usr_id_seller', '=', 'seller.usr_id')
            ->leftJoin('user_usr as author', 'prospect_activity_pac.fk_usr_id_author', '=', 'author.usr_id')
            ->orderBy('pac_date', 'desc')
            ->get();

        return response()->json(['data' => $activities]);
    }

    /**
     * Création
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'pac_type' => 'required|string|in:call,email,meeting,note,task',
            'pac_subject' => 'required|string|max:255',
            'pac_description' => 'nullable|string',
            'pac_date' => 'required|date',
            'pac_due_date' => 'nullable|date',
            'pac_is_done' => 'sometimes|boolean',
            'pac_duration' => 'nullable|integer|min:0',
            'fk_opp_id' => 'nullable|exists:prospect_opportunity_opp,opp_id',
            'fk_ptr_id' => 'required|exists:partner_ptr,ptr_id',
            'fk_ctc_id' => 'nullable|exists:contact_ctc,ctc_id',
            'fk_usr_id_seller' => 'required|exists:user_usr,usr_id',
        ], [
            'pac_type.required'         => 'Le type d\'activité est obligatoire.',
            'pac_type.in'               => 'Le type doit être : call, email, meeting, note ou task.',
            'pac_subject.required'      => 'Le sujet est obligatoire.',
            'pac_subject.max'           => 'Le sujet ne peut pas dépasser 255 caractères.',
            'pac_date.required'         => 'La date de l\'activité est obligatoire.',
            'pac_date.date'             => 'La date de l\'activité n\'est pas valide.',
            'pac_due_date.date'         => 'La date d\'échéance n\'est pas valide.',
            'pac_is_done.boolean'       => 'Le champ "fait" doit être vrai ou faux.',
            'pac_duration.integer'      => 'La durée doit être un nombre entier.',
            'pac_duration.min'          => 'La durée ne peut pas être négative.',
            'fk_opp_id.exists'          => 'L\'opportunité sélectionnée n\'existe pas.',
            'fk_ptr_id.required'        => 'Le partenaire est obligatoire.',
            'fk_ptr_id.exists'          => 'Le partenaire sélectionné n\'existe pas.',
            'fk_ctc_id.exists'          => 'Le contact sélectionné n\'existe pas.',
            'fk_usr_id_seller.required' => 'Le vendeur est obligatoire.',
            'fk_usr_id_seller.exists'   => 'Le vendeur sélectionné n\'existe pas.',
        ]);

        $activity = ProspectActivityModel::create($validated);

        return response()->json(['message' => 'Activité créée', 'data' => $activity], 201);
    }

    public function show($id)
    {
        $activity = ProspectActivityModel::with([
            'opportunity',
            'partner:ptr_id,ptr_name',
            'contact: ctc_id,ctc_firstname,ctc_lastname',
            'seller:usr_id,usr_firstname,usr_lastname'
        ])
            ->findOrFail($id);
        return response()->json(['status' => true, 'data' => $activity]);
    }

    public function update(Request $request, $id)
    {
        $activity = ProspectActivityModel::findOrFail($id);

        $validated = $request->validate([
            'pac_type' => 'sometimes|required|string|in:call,email,meeting,note,task',
            'pac_subject' => 'sometimes|required|string|max:255',
            'pac_description' => 'nullable|string',
            'pac_date' => 'sometimes|required|date',
            'pac_due_date' => 'nullable|date',
            'pac_is_done' => 'sometimes|boolean',
            'pac_done_date' => 'nullable|date',
            'pac_duration' => 'nullable|integer|min:0',
            'fk_opp_id' => 'nullable|exists:prospect_opportunity_opp,opp_id',
            'fk_ptr_id' => 'sometimes|required|exists:partner_ptr,ptr_id',
            'fk_ctc_id' => 'nullable|exists:contact_ctc,ctc_id',
            'fk_usr_id_seller' => 'sometimes|required|exists:user_usr,usr_id',
        ], [
            'pac_type.required'         => 'Le type d\'activité est obligatoire.',
            'pac_type.in'               => 'Le type doit être : call, email, meeting, note ou task.',
            'pac_subject.required'      => 'Le sujet est obligatoire.',
            'pac_subject.max'           => 'Le sujet ne peut pas dépasser 255 caractères.',
            'pac_date.required'         => 'La date de l\'activité est obligatoire.',
            'pac_date.date'             => 'La date de l\'activité n\'est pas valide.',
            'pac_due_date.date'         => 'La date d\'échéance n\'est pas valide.',
            'pac_done_date.date'        => 'La date de réalisation n\'est pas valide.',
            'pac_is_done.boolean'       => 'Le champ "fait" doit être vrai ou faux.',
            'pac_duration.integer'      => 'La durée doit être un nombre entier.',
            'pac_duration.min'          => 'La durée ne peut pas être négative.',
            'fk_opp_id.exists'          => 'L\'opportunité sélectionnée n\'existe pas.',
            'fk_ptr_id.required'        => 'Le partenaire est obligatoire.',
            'fk_ptr_id.exists'          => 'Le partenaire sélectionné n\'existe pas.',
            'fk_ctc_id.exists'          => 'Le contact sélectionné n\'existe pas.',
            'fk_usr_id_seller.required' => 'Le vendeur est obligatoire.',
            'fk_usr_id_seller.exists'   => 'Le vendeur sélectionné n\'existe pas.',
        ]);


        $activity->update($validated);

        return response()->json(['message' => 'Activité mise à jour', 'data' => $activity]);
    }

    public function destroy($id)
    {
        $activity = ProspectActivityModel::findOrFail($id);
        $activity->delete();
        return response()->json(['message' => 'Activité supprimée']);
    }

    /**
     * Marquer comme terminée
     */
    public function markAsDone($id)
    {
        $activity = ProspectActivityModel::findOrFail($id);
        $activity->update([
            'pac_is_done' => 1,
            'pac_done_date' => now(),
        ]);

        return response()->json(['message' => 'Activité terminée', 'data' => $activity]);
    }

    /**
     * Activités d'un tiers (partner)
     */
    public function byPartner(Request $request, $ptrId)
    {
        $query = ProspectActivityModel::where('prospect_activity_pac.fk_ptr_id', $ptrId)
            ->select([
                'pac_id',
                'pac_type',
                'pac_subject',
                'pac_date',
                'pac_due_date',
                'pac_is_done',
                'pac_duration',
                'fk_opp_id',
                'opp_label',
                DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname) as seller_name"),
            ])
            ->leftJoin('prospect_opportunity_opp', 'prospect_activity_pac.fk_opp_id', '=', 'opp_id')
            ->leftJoin('user_usr as seller', 'prospect_activity_pac.fk_usr_id_seller', '=', 'seller.usr_id');

        if (!$request->boolean('include_opportunity_activities', false)) {
            $query->whereNull('prospect_activity_pac.fk_opp_id');
        }

        $activities = $query->orderBy('pac_date', 'desc')->get();

        return response()->json(['data' => $activities]);
    }

    /**
     * Prochaines activités/tâches (pour le dashboard)
     */
    public function upcoming(Request $request)
    {
        $user = Auth::user();
        $canViewAll = $user->can('prospect-activities.view_all');

        $query = ProspectActivityModel::query()
            ->select([
                'pac_id',
                'pac_type',
                'pac_subject',
                'pac_due_date',
                'pac_date',
                'fk_opp_id',
                'ptr_name',
                'opp_label',
                DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname) as seller_name"),
            ])
            ->leftJoin('partner_ptr', 'prospect_activity_pac.fk_ptr_id', '=', 'ptr_id')
            ->leftJoin('prospect_opportunity_opp', 'prospect_activity_pac.fk_opp_id', '=', 'opp_id')
            ->leftJoin('user_usr as seller', 'prospect_activity_pac.fk_usr_id_seller', '=', 'seller.usr_id')
            ->where('pac_is_done', 0);

        if (!$canViewAll) {
            $query->where('prospect_activity_pac.fk_usr_id_seller', $user->usr_id);
        }

        $limit = (int) $request->input('limit', 10);

        $activities = $query
            ->orderByRaw('COALESCE(pac_due_date, pac_date) ASC')
            ->limit(min($limit, 50))
            ->get();

        return response()->json(['data' => $activities]);
    }
}
