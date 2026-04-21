<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\TimeEntryModel;
use App\Models\TimeProjectModel;
use App\Models\TimeConfigModel;
use App\Models\InvoiceModel;
use App\Models\InvoiceLineModel;
use App\Traits\HasGridFilters;

class ApiTimeEntryController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = $request->input('grid_key', 'time-entries');

        // La vue semaine fournit toujours sa propre plage de dates — ne jamais charger
        // ni sauvegarder de settings pour cette clé afin d'éviter la pollution de 'time-entries'
        $skipGridSettings = ($gridKey === 'time-week-view');

        if (!$skipGridSettings && !$request->has('sort_by')) {
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

        $query = TimeEntryModel::from('time_entry_ten as ten')
            ->leftJoin('partner_ptr as ptr', 'ten.fk_ptr_id', '=', 'ptr.ptr_id')
            ->leftJoin('time_project_tpr as tpr', 'ten.fk_tpr_id', '=', 'tpr.tpr_id')
            ->leftJoin('user_usr as usr', 'ten.fk_usr_id', '=', 'usr.usr_id')
            ->select([
                'ten.ten_id',
                'ten.ten_date',
                'ten.ten_start_time',
                'ten.ten_end_time',
                'ten.ten_duration',
                'ten.ten_description',
                'ten.ten_tags',
                'ten.ten_status',
                'ten.ten_rejection_reason',
                'ten.ten_is_billable',
                'ten.ten_hourly_rate',
                'ten.fk_ptr_id',
                'ten.fk_tpr_id',
                'ten.fk_usr_id',
                'ten.fk_inv_id',
                'ptr.ptr_name',
                'tpr.tpr_lib',
                'tpr.tpr_color',
                'tpr.tpr_hourly_rate as tpr_hourly_rate',
                DB::raw("TRIM(CONCAT_WS(' ', usr.usr_firstname, usr.usr_lastname)) as usr_fullname"),
            ]);

        // Scope : l'utilisateur ne voit que ses propres saisies sauf s'il a time.view.all
        if (!Auth::user()->can('time.view.all')) {
            $query->where('ten.fk_usr_id', Auth::id());
        }

        $this->applyGridFilters($query, $request, [
            'ten_date'    => 'ten.ten_date',
            'ptr_name'    => 'ptr.ptr_name',
            'tpr_lib'     => 'tpr.tpr_lib',
            'usr_fullname' => DB::raw("TRIM(CONCAT_WS(' ', usr.usr_firstname, usr.usr_lastname))"),
        ]);

        // Filtre statut : forcé par le grid_key (pas sauvegardé dans gridSettings)
        if ($gridKey === 'time-approval') {
            $query->where('ten.ten_status', 1); // soumis uniquement
        } elseif ($gridKey === 'time-invoicing') {
            $query->where('ten.ten_status', 2); // approuvés uniquement
        } elseif ($request->filled('filters.ten_status')) {
            $query->where('ten.ten_status', (int) $request->input('filters.ten_status'));
        }

        // Filtre facturable
        if ($request->filled('filters.ten_is_billable')) {
            $query->where('ten.ten_is_billable', (int) $request->input('filters.ten_is_billable'));
        }

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'ten_date'     => 'ten.ten_date',
            'ptr_name'     => 'ptr.ptr_name',
            'tpr_lib'      => 'tpr.tpr_lib',
            'ten_duration' => 'ten.ten_duration',
            'ten_status'   => 'ten.ten_status',
            'usr_fullname' => 'usr.usr_lastname',
        ], 'ten_date', 'DESC');

        $this->applyGridPagination($query, $request, 50);

        $savedFilters = $request->input('filters', []);
        // Pour les vues avec filtre statut forcé : ne pas le sauvegarder dans gridSettings
        if (in_array($gridKey, ['time-approval', 'time-invoicing'])) {
            unset($savedFilters['ten_status']);
        }
        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'ten_date'),
            'sort_order' => strtoupper($request->input('sort_order', 'DESC')),
            'filters'    => $savedFilters,
            'page_size'  => (int) $request->input('limit', 50),
        ];

        if (!$skipGridSettings) {
            $this->saveGridSettings($gridKey, $currentSettings);
        }

        return response()->json([
            'data'         => $query->get(),
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Résumé : heures et montant facturable par période / client
     */
    public function summary(Request $request)
    {
        $query = DB::table('time_entry_ten as ten')
            ->leftJoin('time_project_tpr as tpr', 'ten.fk_tpr_id', '=', 'tpr.tpr_id')
            ->leftJoin('partner_ptr as ptr', 'ten.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'ten.fk_ptr_id',
                'ptr.ptr_name',
                'ten.fk_tpr_id',
                'tpr.tpr_lib',
                DB::raw('ROUND(SUM(ten.ten_duration) / 60, 2) as total_hours'),
                DB::raw('ROUND(SUM(CASE WHEN ten.ten_is_billable = 1 THEN ten.ten_duration ELSE 0 END) / 60, 2) as billable_hours'),
                DB::raw('ROUND(SUM(CASE WHEN ten.ten_is_billable = 1 THEN (ten.ten_duration / 60) * COALESCE(ten.ten_hourly_rate, tpr.tpr_hourly_rate, 0) ELSE 0 END), 2) as billable_amount'),
            ])
            ->groupBy('ten.fk_ptr_id', 'ptr.ptr_name', 'ten.fk_tpr_id', 'tpr.tpr_lib');

        if (!Auth::user()->can('time.view.all')) {
            $query->where('ten.fk_usr_id', Auth::id());
        }

        if ($request->filled('from')) {
            $query->where('ten.ten_date', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->where('ten.ten_date', '<=', $request->input('to'));
        }
        if ($request->filled('fk_ptr_id')) {
            $query->where('ten.fk_ptr_id', (int) $request->input('fk_ptr_id'));
        }

        return response()->json(['status' => true, 'data' => $query->get()]);
    }

    public function show($id)
    {
        $entry = TimeEntryModel::with([
            'user:usr_id,usr_firstname,usr_lastname',
            'partner:ptr_id,ptr_name',
            'project:tpr_id,tpr_lib,tpr_color,tpr_hourly_rate,tpr_budget_hours',
        ])->findOrFail($id);

        // Sécurité : un utilisateur sans time.view.all ne peut voir que ses propres saisies
        if (!Auth::user()->can('time.view.all') && $entry->fk_usr_id !== Auth::id()) {
            return response()->json(['status' => false, 'message' => 'Accès refusé.'], 403);
        }

        return response()->json(['status' => true, 'data' => $entry]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'ten_date'        => 'required|date',
            'ten_start_time'  => 'nullable|date_format:H:i',
            'ten_end_time'    => 'nullable|date_format:H:i',
            'ten_duration'    => 'required|integer|min:1',
            'ten_description' => 'nullable|string',
            'ten_tags'        => 'nullable|array',
            'ten_is_billable' => 'nullable|boolean',
            'ten_hourly_rate' => 'nullable|numeric|min:0',
            'fk_ptr_id'       => 'required|integer|exists:partner_ptr,ptr_id',
            'fk_tpr_id'       => 'required|integer|exists:time_project_tpr,tpr_id',
            'fk_usr_id'       => 'nullable|integer|exists:user_usr,usr_id',
        ]);

        // Utiliser l'utilisateur connecté si non fourni
        $validated['fk_usr_id'] = $validated['fk_usr_id'] ?? Auth::id();

        // Sécurité : seul time.view.all peut saisir pour un autre utilisateur
        if ($validated['fk_usr_id'] !== Auth::id() && !Auth::user()->can('time.view.all')) {
            $validated['fk_usr_id'] = Auth::id();
        }

        // Validation cohérence projet / client
        if (!empty($validated['fk_tpr_id']) && !empty($validated['fk_ptr_id'])) {
            $project = TimeProjectModel::find($validated['fk_tpr_id']);
            if ($project && $project->fk_ptr_id && $project->fk_ptr_id !== (int) $validated['fk_ptr_id']) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Le projet sélectionné n\'appartient pas au client choisi.',
                ], 422);
            }
        }

        // Normalisation de la date (le front envoie parfois un ISO 8601 complet)
        if (!empty($validated['ten_date'])) {
            $validated['ten_date'] = \Illuminate\Support\Carbon::parse($validated['ten_date'])->toDateString();
        }

        // Anti-doublon timer : un seul timer actif par utilisateur
        $hasActiveTimer = TimeEntryModel::where('fk_usr_id', $validated['fk_usr_id'])
            ->whereNull('ten_end_time')
            ->where('ten_duration', 0)
            ->exists();

        if ($hasActiveTimer && empty($validated['ten_end_time']) && $validated['ten_duration'] === 0) {
            return response()->json([
                'status'  => false,
                'message' => 'Un timer est déjà actif. Arrêtez-le avant d\'en démarrer un nouveau.',
            ], 422);
        }

        $entry = TimeEntryModel::create($validated);

        return response()->json(['status' => true, 'data' => $entry], 201);
    }

    public function update(Request $request, $id)
    {
        $entry = TimeEntryModel::findOrFail($id);

        // Sécurité accès
        if (!Auth::user()->can('time.view.all') && $entry->fk_usr_id !== Auth::id()) {
            return response()->json(['status' => false, 'message' => 'Accès refusé.'], 403);
        }

        // Verrou total : approuvé (2) ou facturé (3) uniquement — rejeté (4) reste modifiable
        if ($entry->ten_status === TimeEntryModel::STATUS_APPROVED || $entry->ten_status === 3) {
            return response()->json([
                'status'  => false,
                'message' => $entry->ten_status === 3
                    ? 'Cette saisie est facturée et ne peut plus être modifiée.'
                    : 'Cette saisie est approuvée et ne peut plus être modifiée.',
            ], 403);
        }

        $validated = $request->validate([
            'ten_date'        => 'sometimes|required|date',
            'ten_start_time'  => 'nullable|date_format:H:i',
            'ten_end_time'    => 'nullable|date_format:H:i',
            'ten_duration'    => 'sometimes|required|integer|min:1',
            'ten_description' => 'nullable|string',
            'ten_tags'        => 'nullable|array',
            'ten_is_billable' => 'nullable|boolean',
            'ten_hourly_rate' => 'nullable|numeric|min:0',
            'fk_ptr_id'       => 'sometimes|required|integer|exists:partner_ptr,ptr_id',
            'fk_tpr_id'       => 'sometimes|required|integer|exists:time_project_tpr,tpr_id',
        ]);

        // Validation cohérence projet / client
        $newPtrId = $validated['fk_ptr_id'] ?? $entry->fk_ptr_id;
        $newTprId = $validated['fk_tpr_id'] ?? $entry->fk_tpr_id;
        if ($newTprId && $newPtrId) {
            $project = TimeProjectModel::find($newTprId);
            if ($project && $project->fk_ptr_id && $project->fk_ptr_id !== (int) $newPtrId) {
                return response()->json([
                    'status'  => false,
                    'message' => 'Le projet sélectionné n\'appartient pas au client choisi.',
                ], 422);
            }
        }

        // Normalisation de la date
        if (!empty($validated['ten_date'])) {
            $validated['ten_date'] = \Illuminate\Support\Carbon::parse($validated['ten_date'])->toDateString();
        }

        $entry->update($validated);

        return response()->json(['status' => true, 'data' => $entry]);
    }

    public function destroy($id)
    {
        $entry = TimeEntryModel::findOrFail($id);

        if (!Auth::user()->can('time.view.all') && $entry->fk_usr_id !== Auth::id()) {
            return response()->json(['status' => false, 'message' => 'Accès refusé.'], 403);
        }

        // Soumis : seul un approbateur peut supprimer ; approuvé/facturé : personne
        if ($entry->ten_status >= TimeEntryModel::STATUS_APPROVED) {
            return response()->json([
                'status'  => false,
                'message' => 'Cette saisie est approuvée ou facturée et ne peut pas être supprimée.',
            ], 403);
        }
        if ($entry->ten_status >= TimeEntryModel::STATUS_SUBMITTED && !Auth::user()->can('time.approve')) {
            return response()->json([
                'status'  => false,
                'message' => 'Cette saisie est soumise et ne peut pas être supprimée sans approbation.',
            ], 403);
        }

        $entry->delete();

        return response()->json(['status' => true]);
    }

    /**
     * Soumettre une saisie unique pour validation
     */
    public function submit($id)
    {
        $entry = TimeEntryModel::findOrFail($id);

        if (!Auth::user()->can('time.view.all') && $entry->fk_usr_id !== Auth::id()) {
            return response()->json(['status' => false, 'message' => 'Accès refusé.'], 403);
        }

        if (!in_array($entry->ten_status, [TimeEntryModel::STATUS_DRAFT, TimeEntryModel::STATUS_REJECTED])) {
            return response()->json(['status' => false, 'message' => 'Seules les saisies en brouillon ou rejetées peuvent être soumises.'], 422);
        }

        $entry->update(['ten_status' => TimeEntryModel::STATUS_SUBMITTED, 'ten_rejection_reason' => null]);

        return response()->json(['status' => true, 'data' => $entry]);
    }

    /**
     * Soumettre plusieurs saisies en masse
     */
    public function submitBatch(Request $request)
    {
        $request->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer']);

        $userId = Auth::id();
        $canAll = Auth::user()->can('time.view.all');

        $query = TimeEntryModel::whereIn('ten_id', $request->input('ids'))
            ->whereIn('ten_status', [TimeEntryModel::STATUS_DRAFT, TimeEntryModel::STATUS_REJECTED]);

        if (!$canAll) {
            $query->where('fk_usr_id', $userId);
        }

        $count = $query->update(['ten_status' => TimeEntryModel::STATUS_SUBMITTED, 'ten_rejection_reason' => null]);

        return response()->json(['status' => true, 'updated' => $count]);
    }

    /**
     * Approuver plusieurs saisies en masse
     */
    public function approveBatch(Request $request)
    {
        $request->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer']);

        $count = TimeEntryModel::whereIn('ten_id', $request->input('ids'))
            ->where('ten_status', TimeEntryModel::STATUS_SUBMITTED)
            ->update(['ten_status' => TimeEntryModel::STATUS_APPROVED]);

        return response()->json(['status' => true, 'updated' => $count]);
    }

    /**
     * Rejeter plusieurs saisies en masse avec motif
     */
    public function rejectBatch(Request $request)
    {
        $request->validate([
            'ids'    => 'required|array|min:1',
            'ids.*'  => 'integer',
            'reason' => 'required|string|max:500',
        ]);

        $count = TimeEntryModel::whereIn('ten_id', $request->input('ids'))
            ->where('ten_status', TimeEntryModel::STATUS_SUBMITTED)
            ->update([
                'ten_status'           => TimeEntryModel::STATUS_REJECTED,
                'ten_rejection_reason' => $request->input('reason'),
            ]);

        return response()->json(['status' => true, 'updated' => $count]);
    }

    /**
     * Générer une facture depuis une sélection de saisies approuvées
     */
    public function generateInvoice(Request $request)
    {
        $request->validate([
            'entry_ids'            => 'required|array|min:1',
            'entry_ids.*'          => 'integer',
            'fk_ptr_id'            => 'required|integer|exists:partner_ptr,ptr_id',
            'hourly_rate_override' => 'nullable|numeric|min:0',
        ]);

        $entryIds  = $request->input('entry_ids');
        $ptrId     = (int) $request->input('fk_ptr_id');
        $rateOverride = $request->input('hourly_rate_override');

        // Vérifier que le produit de facturation est configuré
        $timeConfig = TimeConfigModel::with('product:prt_id,prt_label,fk_tax_id_sale')->find(1);
        if (!$timeConfig || !$timeConfig->fk_prt_id) {
            return response()->json([
                'status'  => false,
                'message' => 'Le produit de facturation n\'est pas configuré. Veuillez définir un produit dans la configuration du module temps (Paramètres > Temps).',
            ], 422);
        }
        $product = $timeConfig->product;

        // Charger les entrées avec leur projet
        $entries = TimeEntryModel::with('project:tpr_id,tpr_lib,tpr_hourly_rate')
            ->whereIn('ten_id', $entryIds)
            ->get();

        if ($entries->isEmpty()) {
            return response()->json(['status' => false, 'message' => 'Aucune saisie trouvée.'], 422);
        }

        // Vérification : toutes les entrées doivent être pour le même client
        $ptrs = $entries->pluck('fk_ptr_id')->filter()->unique();
        if ($ptrs->count() > 1 || ($ptrs->count() === 1 && $ptrs->first() !== $ptrId)) {
            return response()->json([
                'status'  => false,
                'message' => 'Toutes les saisies doivent appartenir au même client.',
            ], 422);
        }

        // Vérification : toutes les entrées doivent être approuvées
        $nonApproved = $entries->where('ten_status', '!=', TimeEntryModel::STATUS_APPROVED)->count();
        if ($nonApproved > 0) {
            return response()->json([
                'status'  => false,
                'message' => 'Toutes les saisies doivent être au statut "Approuvé" avant facturation.',
            ], 422);
        }

        return DB::transaction(function () use ($entries, $ptrId, $rateOverride, $entryIds, $product) {
            // Créer la facture brouillon
            $invoice = InvoiceModel::create([
                'inv_operation' => 1, // CUSTOMER_INVOICE
                'inv_status'    => 0, // DRAFT
                'inv_date'      => now()->format('Y-m-d'),
                'inv_duedate'   => now()->addDays(30)->format('Y-m-d'),
                'fk_ptr_id'     => $ptrId,
            ]);

            // Taux de TVA du produit
            $productTax = $product->load('taxSale:tax_id,tax_rate')->taxSale;
            $taxRate = $productTax ? (float) $productTax->tax_rate : 0;

            // Grouper les entrées par projet
            $groups = $entries->groupBy('fk_tpr_id');
            $lineOrder = 1;

            foreach ($groups as $tprId => $groupEntries) {
                $project    = $groupEntries->first()->project;
                $totalMins  = $groupEntries->sum('ten_duration');
                $totalHours = round($totalMins / 60, 2);

                // Taux : override > entrée > projet > 0
                $rate = $rateOverride
                    ?? $groupEntries->first()->ten_hourly_rate
                    ?? ($project ? (float) $project->tpr_hourly_rate : 0);

                $label = $project ? $project->tpr_lib : $product->prt_label;

                InvoiceLineModel::create([
                    'fk_inv_id'         => $invoice->inv_id,
                    'inl_order'         => $lineOrder++,
                    'inl_type'          => 0, // PRODUCT
                    'fk_prt_id'         => $product->prt_id,
                    'inl_prtlib'        => $label,
                    'inl_qty'           => $totalHours,
                    'inl_priceunitht'   => $rate,
                    'inl_discount'      => 0,
                    'inl_mtht'          => round($totalHours * $rate, 2),
                    'inl_tax_rate'      => $taxRate,
                ]);
            }

            // Marquer les saisies comme facturées
            TimeEntryModel::whereIn('ten_id', $entryIds)->update([
                'ten_status' => TimeEntryModel::STATUS_INVOICED,
                'fk_inv_id'  => $invoice->inv_id,
            ]);

            return response()->json([
                'status'     => true,
                'invoice_id' => $invoice->inv_id,
            ]);
        });
    }

    /**
     * Récupérer les suggestions de description pour un projet donné
     */
    public function descriptionSuggestions(Request $request)
    {
        $request->validate(['fk_tpr_id' => 'required|integer']);

        $suggestions = TimeEntryModel::where('fk_tpr_id', $request->input('fk_tpr_id'))
            ->whereNotNull('ten_description')
            ->where('ten_description', '!=', '')
            ->select('ten_description')
            ->distinct()
            ->orderBy('ten_updated', 'desc')
            ->limit(20)
            ->pluck('ten_description');

        return response()->json(['status' => true, 'data' => $suggestions]);
    }
}
