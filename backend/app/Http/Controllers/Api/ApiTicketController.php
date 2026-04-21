<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\TicketModel;
use App\Models\TicketArticleModel;
use App\Models\TicketHistoryModel;
use App\Models\TicketStatusModel;
use App\Models\TicketPriorityModel;
use App\Models\TicketSourceModel;
use App\Models\TicketCategoryModel;
use App\Models\TicketGradeModel;

class ApiTicketController extends Controller
{
    /**
     * Liste paginee des tickets avec jointures
     */
    public function index(Request $request)
    {
        $query = TicketModel::from('ticket_tkt as tkt')
            ->leftJoin('partner_ptr as ptr', 'tkt.fk_ptr_id', '=', 'ptr.ptr_id')
            ->leftJoin('ticket_status_tke as tke', 'tkt.fk_tke_id', '=', 'tke.tke_id')
            ->leftJoin('ticket_priority_tkp as tkp', 'tkt.fk_tkp_id', '=', 'tkp.tkp_id')
            ->leftJoin('user_usr as usr', 'tkt.fk_usr_id_assignedto', '=', 'usr.usr_id')
            ->leftJoin('ticket_grade_tkg as tkg', 'tkt.fk_tkg_id', '=', 'tkg.tkg_id')
            ->leftJoin('ticket_category_tkc as tkc', 'tkt.fk_tkc_id', '=', 'tkc.tkc_id')
            ->select([
                'tkt.tkt_id as id',
                'tkt.tkt_number',
                'tke.tke_label',
                'tkp.tkp_label',
                'ptr.ptr_name',
                'tkt.tkt_label',
                'tkt.tkt_opendate',
                'tkt.tkt_updated',
                'tkt.tkt_scheduled',
                'tkt.tkt_tps',
                DB::raw("TRIM(CONCAT_WS(' ', usr.usr_firstname, usr.usr_lastname)) as assignedTo"),
                'tkg.tkg_label',
                'tkc.tkc_label',
            ]);

        // Filtre par statut spécifique (depuis la sidebar dynamique)
        if ($request->filled('status_id')) {
            $query->where('tkt.fk_tke_id', (int) $request->input('status_id'));
        } else {
            // Filtre tickets clos (ignoré quand status_id est fourni)
            $viewClosed = filter_var($request->input('viewClosed', false), FILTER_VALIDATE_BOOLEAN);
            if (!$viewClosed) {
                $query->where(function ($q) {
                    $q->whereNull('tke.tke_label')
                        ->orWhere('tke.tke_label', '!=', 'Clos');
                });
            }
        }

        // Filtre "mes tickets" (assignés à l'utilisateur connecté)
        if (filter_var($request->input('mine', false), FILTER_VALIDATE_BOOLEAN)) {
            $query->where('tkt.fk_usr_id_assignedto', Auth::id());
        }

        $total = $query->count();

        $sortBy = $request->input('sort_by', 'id');
        $sortOrder = strtoupper($request->input('sort_order', 'DESC')) === 'ASC' ? 'ASC' : 'DESC';

        $sortColumnMap = [
            'id'          => 'tkt.tkt_id',
            'tkt_number'  => 'tkt.tkt_number',
            'tke_label'   => 'tke.tke_label',
            'tkp_label'   => 'tkp.tkp_label',
            'ptr_name'    => 'ptr.ptr_name',
            'tkt_label'   => 'tkt.tkt_label',
            'tkt_opendate' => 'tkt.tkt_opendate',
            'tkt_updated' => 'tkt.tkt_updated',
            'tkt_scheduled' => 'tkt.tkt_scheduled',
            'assignedTo'  => 'usr.usr_lastname',
            'tkg_label'   => 'tkg.tkg_label',
            'tkc_label'   => 'tkc.tkc_label',
        ];

        $sortColumn = $sortColumnMap[$sortBy] ?? 'tkt.tkt_id';

        $offset = (int) $request->input('offset', 0);
        $limit  = (int) $request->input('limit', 50);

        $data = $query
            ->orderBy($sortColumn, $sortOrder)
            ->skip($offset)
            ->take($limit)
            ->get();

        return response()->json([
            'data'  => $data,
            'total' => $total,
        ]);
    }

    /**
     * Affiche un ticket avec toutes ses relations
     */
    public function show($id)
    {
        $data = TicketModel::withCount('articles')
            ->with([
                'partner:ptr_id,ptr_name',
                'status:tke_id,tke_label,tke_color',
                'priority:tkp_id,tkp_label',
                'source:tks_id,tks_label',
                'category:tkc_id,tkc_label',
                'grade:tkg_id,tkg_label',
                'contract:con_id,con_label',
                'openBy:ctc_id,ctc_firstname,ctc_lastname,ctc_email',
                'openTo' => function ($q) {
                    $q->select('ctc_id', 'ctc_firstname', 'ctc_lastname', 'ctc_email', 'ctc_mobile', 'ctc_job_title')
                      ->with(['devices:dev_id,dev_hostname']);
                },
                'assignedTo' => function ($query) {
                    $query->selectRaw("usr_id, TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label");
                },
                'author' => function ($query) {
                    $query->selectRaw("usr_id, TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label");
                },
            ])
            ->where('tkt_id', $id)
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data'   => $data,
        ], 200);
    }

    /**
     * Creation d'un ticket
     */
    public function store(Request $request)
    {
        try {
            // Validation
            $validated = $request->validate([
                'tkt_label' => 'required|string|max:300',
                'fk_tke_id' => 'required|integer|exists:ticket_status_tke,tke_id',
                'fk_ptr_id' => 'required|integer|exists:partner_ptr,ptr_id',
                'fk_tkg_id' => 'required|integer|exists:ticket_grade_tkg,tkg_id',
                'fk_tks_id' => 'required|integer|exists:ticket_source_tks,tks_id',
                'fk_ctc_id_openby' => 'required|integer|exists:contact_ctc,ctc_id',
                'fk_ctc_id_opento' => 'required|integer|exists:contact_ctc,ctc_id',
                'tkt_opendate' => 'nullable|date',
                'fk_tkp_id' => 'required|integer|exists:ticket_priority_tkp,tkp_id',
                'fk_tkc_id' => 'nullable|integer|exists:ticket_category_tkc,tkc_id',
                'fk_usr_id_assignedto' => 'nullable|integer|exists:user_usr,usr_id',
                'fk_con_id' => 'nullable|integer|exists:contract_con,con_id',
                'tkt_scheduled' => 'nullable|date',
                'tka_message' => 'required|string',
                'tka_tps' => 'required|integer|min:1',
                'tka_cc' => 'nullable|string',
            ]);

            $item = new TicketModel();
            $data = $validated;

            // Valeurs par defaut
            if (empty($data['tkt_opendate'])) {
                $data['tkt_opendate'] = now();
            }
          
            $item->updateSafe($data);

            // Creer le premier article (demande initiale) si un body est fourni
            if (!empty($request->input('tka_message'))) {
                $articleData = [
                    'tkt_id'              => $item->tkt_id,
                    'tka_message'         => $request->input('tka_message'),
                    'tka_tps'             => (int) $request->input('tka_tps', 0),
                    'tka_cc'              => $request->input('tka_cc'),
                    'fk_ctc_id_from'      => $item->fk_ctc_id_openby,
                    'fk_ctc_id_to'        => $item->fk_ctc_id_opento,
                    'tka_is_note'         => 0,
                    'tka_date'            => now(),
                    'fk_usr_id_author'    => $request->user()?->usr_id,
                    'fk_usr_id_updater'   => $request->user()?->usr_id,
                ];
                $article = new TicketArticleModel();
                $article->updateSafe($articleData);
                self::updateTotalTime($item->tkt_id);
            }

            return response()->json([
                'success' => true,
                'message' => 'Dossier cree avec succes',
                'data'    => ['tkt_id' => $item->tkt_id],
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mise a jour d'un ticket
     */
    public function update(Request $request, $id)
    {
        $ticket = TicketModel::find($id);

        if (!$ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Dossier non trouve',
            ], 404);
        }
        // Validation
        $validated = $request->validate([
            'tkt_label' => 'sometimes|required|string|max:300',
            'fk_tke_id' => 'sometimes|required|integer|exists:ticket_status_tke,tke_id',
            'fk_ptr_id' => 'sometimes|required|integer|exists:partner_ptr,ptr_id',
            'fk_tkg_id' => 'sometimes|required|integer|exists:ticket_grade_tkg,tkg_id',
            'fk_tks_id' => 'sometimes|required|integer|exists:ticket_source_tks,tks_id',
            'fk_ctc_id_openby' => 'sometimes|required|integer|exists:contact_ctc,ctc_id',
            'fk_ctc_id_opento' => 'sometimes|required|integer|exists:contact_ctc,ctc_id',
            'tkt_opendate' => 'nullable|date',
            'fk_tkp_id' => 'nullable|integer|exists:ticket_priority_tkp,tkp_id',
            'fk_tkc_id' => 'nullable|integer|exists:ticket_category_tkc,tkc_id',
            'fk_usr_id_assignedto' => 'nullable|integer|exists:user_usr,usr_id',
            'fk_con_id' => 'nullable|integer|exists:contract_con,con_id',
            'tkt_scheduled' => 'nullable|date',
        ]);

        $data = $validated;

        if ($request->user()) {
            $data['fk_usr_id_updater'] = $request->user()->usr_id;
        }

        // Écriture de l'historique des changements
        $watchedFields = [
            'fk_tke_id', 'fk_tkp_id', 'fk_tks_id', 'fk_tkc_id',
            'fk_tkg_id', 'fk_usr_id_assignedto', 'tkt_label',
            'fk_ctc_id_openby', 'fk_ctc_id_opento',
        ];
        $histories = [];
        foreach ($watchedFields as $field) {
            if (array_key_exists($field, $data) && (string) $ticket->$field !== (string) $data[$field]) {
                $histories[] = [
                    'fk_tkt_id'    => $id,
                    'fk_usr_id'    => $request->user()?->usr_id,
                    'tkh_field'    => $field,
                    'tkh_old_value' => $ticket->$field,
                    'tkh_new_value' => $data[$field],
                    'tkh_created'  => now(),
                ];
            }
        }

        $ticket->updateSafe($data);

        foreach ($histories as $h) {
            DB::table('ticket_history_tkh')->insert($h);
        }

        return response()->json([
            'success' => true,
            'message' => 'Dossier mis a jour avec succes',
            'data'    => ['tkt_id' => $ticket->tkt_id],
        ]);
    }

    /**
     * Suppression d'un ticket avec cascade (articles + documents)
     */
    public function destroy($id)
    {
        $ticket = TicketModel::find($id);

        if (!$ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Dossier non trouve',
            ], 404);
        }

        try {
            DB::beginTransaction();

            // Supprimer les articles (le trait DeletesRelatedDocuments sur TicketArticleModel
            // supprime automatiquement les documents lies a chaque article)
            $articles = TicketArticleModel::where('tkt_id', $id)->get();
            foreach ($articles as $article) {
                $article->delete();
            }

            // Supprimer le ticket
            $ticket->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Dossier supprime avec succes',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Options statuts
     */
    public function statusOptions()
    {
        $data = TicketStatusModel::select('tke_id as id', 'tke_label as label', 'tke_color as color', 'tke_icon as icon')
            ->orderBy('tke_order', 'asc')
            ->get();

        return response()->json(['data' => $data]);
    }

    /**
     * Options priorites
     */
    public function priorityOptions()
    {
        $data = TicketPriorityModel::select('tkp_id as id', 'tkp_label as label', 'tkp_default as default' )
            ->orderBy('tkp_order', 'asc')
            ->get();

        return response()->json(['data' => $data]);
    }

    /**
     * Options sources
     */
    public function sourceOptions()
    {
        $data = TicketSourceModel::select('tks_id as id', 'tks_label as label', 'tks_default as default')
            ->orderBy('tks_id', 'asc')
            ->get();

        return response()->json(['data' => $data]);
    }

    /**
     * Options categories
     */
    public function categoryOptions()
    {
        $data = TicketCategoryModel::select('tkc_id as id', 'tkc_label as label')
            ->orderBy('tkc_id', 'asc')
            ->get();

        return response()->json(['data' => $data]);
    }

    /**
     * Options types/grades
     */
    public function gradeOptions()
    {
        $data = TicketGradeModel::select('tkg_id as id', 'tkg_label as label')
            ->orderBy('tkg_id', 'asc')
            ->get();

        return response()->json(['data' => $data]);
    }

    /**
     * Recherche de tickets (pour la fusion / liens)
     */
    public function search(Request $request)
    {
        $search = $request->input('search', '');
        $excludeId = (int) $request->input('exclude_id', 0);

        $query = TicketModel::from('ticket_tkt as tkt')
            ->leftJoin('partner_ptr as ptr', 'tkt.fk_ptr_id', '=', 'ptr.ptr_id')
            ->leftJoin('ticket_status_tke as tke', 'tkt.fk_tke_id', '=', 'tke.tke_id')
            ->select([
                'tkt.tkt_id as id',
                'tkt.tkt_number',
                'tkt.tkt_label as label',
                'ptr.ptr_name as partner_name',
                'tke.tke_label as status_label',
                'tke.tke_color as status_color',
            ]);

        if ($excludeId) {
            $query->where('tkt.tkt_id', '!=', $excludeId);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('tkt.tkt_label', 'LIKE', '%' . $search . '%')
                  ->orWhere('tkt.tkt_number', 'LIKE', '%' . $search . '%')
                  ->orWhere('ptr.ptr_name', 'LIKE', '%' . $search . '%');
                if (is_numeric($search)) {
                    $q->orWhere('tkt.tkt_id', (int) $search);
                }
            });
        }

        $data = $query->orderByDesc('tkt.tkt_id')->limit(20)->get();

        return response()->json(['data' => $data]);
    }

    /**
     * Fusion de deux tickets (source → cible)
     * Déplace tous les articles du ticket source vers le ticket cible.
     */
    public function merge(Request $request, $id)
    {
        $validated = $request->validate([
            'target_id' => 'required|integer|exists:ticket_tkt,tkt_id',
        ]);

        if ((int) $validated['target_id'] === (int) $id) {
            return response()->json(['success' => false, 'message' => 'Impossible de fusionner un ticket avec lui-même'], 422);
        }

        DB::beginTransaction();
        try {
            $source = TicketModel::findOrFail($id);
            $target = TicketModel::findOrFail($validated['target_id']);

            // Déplacer tous les articles du source vers la cible
            TicketArticleModel::where('tkt_id', $source->tkt_id)
                ->update(['tkt_id' => $target->tkt_id]);

            // Marquer le ticket source comme fusionné
            DB::table('ticket_tkt')->where('tkt_id', $source->tkt_id)->update([
                'tkt_merged_into' => $target->tkt_id,
                'tkt_merged_at'   => now(),
                'tkt_updated'     => now(),
            ]);

            // Écrire un historique sur le ticket cible
            DB::table('ticket_history_tkh')->insert([
                'fk_tkt_id'     => $target->tkt_id,
                'fk_usr_id'     => $request->user()?->usr_id,
                'tkh_field'     => 'merge',
                'tkh_old_value' => null,
                'tkh_new_value' => '#' . $source->tkt_id . ' — ' . $source->tkt_label,
                'tkh_created'   => now(),
            ]);

            // Recalculer le temps total du ticket cible
            self::updateTotalTime($target->tkt_id);

            DB::commit();

            return response()->json([
                'success' => true,
                'data'    => ['tkt_id' => $target->tkt_id],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Historique des modifications d'un ticket
     */
    public function history($ticketId)
    {
        $history = TicketHistoryModel::where('fk_tkt_id', $ticketId)
            ->with([
                'user' => fn($q) => $q->selectRaw("usr_id, TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label"),
            ])
            ->orderBy('tkh_created', 'asc')
            ->get();

        return response()->json(['data' => $history]);
    }

    /**
     * Recalcule le temps total du ticket (somme des temps des articles)
     */
    public static function updateTotalTime($ticketId)
    {
        $totalTime = TicketArticleModel::where('tkt_id', $ticketId)
            ->sum('tka_tps');

        TicketModel::where('tkt_id', $ticketId)
            ->update(['tkt_tps' => $totalTime ?? 0]);
    }

    /**
     * Compteurs pour la sidebar dynamique :
     * - nombre de tickets par statut
     * - nombre de tickets assignés à l'utilisateur connecté (non clos)
     */
    public function sidebarCounts(Request $request)
    {
        // Tous les statuts avec leur nombre de tickets
        $statusCounts = DB::table('ticket_status_tke as tke')
            ->leftJoin('ticket_tkt as tkt', 'tkt.fk_tke_id', '=', 'tke.tke_id')
            ->select('tke.tke_id', 'tke.tke_label', 'tke.tke_color', 'tke.tke_icon', DB::raw('COUNT(tkt.tkt_id) as count'))
            ->groupBy('tke.tke_id', 'tke.tke_label', 'tke.tke_color', 'tke_icon')
            ->orderBy('tke.tke_order')
            ->get()
            ->map(fn($s) => [
                'id'    => $s->tke_id,
                'label' => $s->tke_label,
                'color' => $s->tke_color,
                'icon'  => $s->tke_icon,
                'count' => (int) $s->count,
            ]);

        // Mes tickets assignés (non clos)
        $mineCount = DB::table('ticket_tkt as tkt')
            ->leftJoin('ticket_status_tke as tke', 'tkt.fk_tke_id', '=', 'tke.tke_id')
            ->where('tkt.fk_usr_id_assignedto', Auth::id())
            ->where(function ($q) {
                $q->whereNull('tke.tke_label')
                  ->orWhere('tke.tke_label', '!=', 'Clos');
            })
            ->count();

        return response()->json([
            'statuses' => $statusCounts,
            'mine'     => $mineCount,
        ]);
    }
}
