<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers;

use App\Models\ExpenseReportModel;
use App\Models\PaymentModel;
use App\Models\PaymentAllocationModel;
use App\Services\PaymentService;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ApiExpenseReportController extends Controller
{
    /**
     * Vérifie si l'utilisateur est le propriétaire de la note de frais
     */
    private function isOwner(ExpenseReportModel $report): bool
    {
        return $report->fk_usr_id === Auth::id();
    }

    /**
     * Vérifie si la note de frais appartient à un membre de l'équipe
     */
    private function isTeamMember(ExpenseReportModel $report): bool
    {
        $user = Auth::user();
        $teamMemberIds = $user->getTeamMemberIds();
        return in_array($report->fk_usr_id, $teamMemberIds);
    }

    /**
     * Vérifie si l'utilisateur a accès à une note de frais (lecture)
     */
    private function canAccessReport(ExpenseReportModel $report): bool
    {
        $user = Auth::user();

        // Si l'utilisateur a la permission expenses.approveall, il a accès à tout
        if ($user->can('expenses.approveall')) {
            return true;
        }


        // Si c'est sa propre note de frais et qu'il a la permission expenses.my.view
        if ($this->isOwner($report) && $user->can('expenses.my.view')) {
            return true;
        }

        // Si c'est un membre de son équipe et qu'il a la permission expenses.view
        if ($this->isTeamMember($report) && $user->can('expenses.view')) {
            return true;
        }

        return false;
    }

    /**
     * Vérifie si l'utilisateur peut créer une note de frais
     * @param int|null $targetUserId ID de l'utilisateur pour qui créer la note (null = soi-même)
     */
    private function canCreateReport(?int $targetUserId = null): bool
    {
        $user = Auth::user();

        // Création pour soi-même
        if ($targetUserId === null || $targetUserId === $user->usr_id) {
            return $user->can('expenses.my.create');
        }

        // Création pour un membre de l'équipe
        $teamMemberIds = $user->getTeamMemberIds();
        if (in_array($targetUserId, $teamMemberIds) && $user->can('expenses.create')) {
            return true;
        }

        // Création pour n'importe qui (approveall)
        if ($user->can('expenses.approveall') && $user->can('expenses.create')) {
            return true;
        }

        return false;
    }

    /**
     * Vérifie si l'utilisateur peut éditer la note de frais
     */
    private function canEditReport(ExpenseReportModel $report): bool
    {
        $user = Auth::user();

        // Si l'utilisateur a la permission expenses.approveall + expenses.edit
        if ($user->can('expenses.approveall') && $user->can('expenses.edit')) {
            return true;
        }

        // Si c'est sa propre note de frais
        if ($this->isOwner($report)) {
            return $user->can('expenses.my.edit');
        }

        // Si c'est un membre de son équipe
        if ($this->isTeamMember($report) && $user->can('expenses.edit')) {
            return true;
        }

        return false;
    }

    /**
     * Vérifie si l'utilisateur peut supprimer la note de frais
     */
    private function canDeleteReport(ExpenseReportModel $report): bool
    {
        $user = Auth::user();

        // Si l'utilisateur a la permission expenses.approveall + expenses.delete
        if ($user->can('expenses.approveall') && $user->can('expenses.delete')) {
            return true;
        }

        // Si c'est sa propre note de frais
        if ($this->isOwner($report)) {
            return $user->can('expenses.my.delete');
        }

        // Si c'est un membre de son équipe
        if ($this->isTeamMember($report) && $user->can('expenses.delete')) {
            return true;
        }



        return false;
    }

    /**
     * Vérifie si l'utilisateur peut approuver/rejeter la note de frais
     */
    private function canApproveReport(ExpenseReportModel $report): bool
    {
        $user = Auth::user();

        // Si l'utilisateur a la permission expenses.approveall
        if ($user->can('expenses.approveall')) {
            return true;
        }

        // Ne peut pas approuver sa propre note
        if ($this->isOwner($report)) {
            return false;
        }

        // Si c'est un membre de son équipe et qu'il a la permission expenses.approve
        if ($this->isTeamMember($report) && $user->can('expenses.approve')) {
            return true;
        }



        return false;
    }

    /**
     * Liste des notes de frais à valider (pour les managers/approbateurs)
     * Affiche uniquement les notes de frais de l'équipe en attente de validation
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        $query = ExpenseReportModel::leftJoin('user_usr as usr', 'expense_reports_exr.fk_usr_id', '=', 'usr.usr_id')
            ->select([
                'exr_id as id',
                'exr_number',
                'exr_title',
                'exr_period_from',
                'exr_period_to',
                'exr_status',
                'exr_submission_date',
                'exr_total_amount_ttc',
                'exr_payment_progress',
                DB::raw("TRIM(CONCAT_WS(' ', usr.usr_firstname, usr.usr_lastname)) as employee"),
            ]);


        if ($request->has('myExpenseReports')) {
            if (!$user->can('expenses.my.view')) {
                return response()->json([
                    'success' => false,
                    'message' => "Vous n'avez pas la permission d'afficher ces notes de frais"
                ], 403);
            }
            $query->where('fk_usr_id', Auth::id());
        } else {

            if ($user->can('expenses.approveall')) {
                // Par défaut, filtrer sur les notes soumises (à valider)
                // if (!$request->filled('status')) {
                //     $query->where('exr_status', 'submitted');
                // }
            } else  if ($user->can('expenses.approve')) {
                // Sinon, il ne voit que les notes de son équipe en attente
                $teamMemberIds = $user->getTeamMemberIds();
                if (empty($teamMemberIds)) {
                    // Pas de membres d'équipe = pas de résultats
                    $query->whereRaw('1 = 0');
                } else {
                    $query->whereIn('fk_usr_id', $teamMemberIds);
                    // Par défaut, filtrer sur les notes soumises (à valider)
                    if (!$request->filled('status')) {
                        $query->where('exr_status', 'submitted');
                    }
                }
            }
        }

        //approveall
        // Si l'utilisateur a la permission expenses.approveall, il voit toutes les notes soumises


        // Filtres
        if ($request->filled('status')) {
            $query->where('exr_status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('exr_number', 'like', "%{$search}%")
                    ->orWhere('exr_title', 'like', "%{$search}%")
                    ->orWhere('exr_description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('date_from')) {
            $query->where('exr_submission_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('exr_submission_date', '<=', $request->date_to);
        }


        // Tri
        //  $sortField = $request->get('sort_field', 'exr_created_at');
        //  $sortOrder = $request->get('sort_order', 'desc');
        //  $query->orderBy($sortField, $sortOrder);

        // $sortBy    = $request->input('sort_by', 'id');
        // $sortOrder = strtoupper($request->input('sort_order', 'ASC')) === 'DESC' ? 'DESC' : 'ASC';

        // Pagination
        //  $perPage = $request->get('per_page', 15);
        $data = $query
            ->orderBy('exr_period_from', 'ASC')
            // ->skip($offset)
            // ->take($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data'  => $data,

        ]);
    }

    /**
     * Liste des notes de frais de l'utilisateur connecté (Mes notes de frais)
     */
    public function myExpenseReports(Request $request)
    {

        $request->merge(['myExpenseReports' => true]);
        return $this->index($request);
    }

    /**
     * Afficher une note de frais
     */
    public function show($id)
    {
        $report = ExpenseReportModel::with([
            'user:usr_id,usr_firstname,usr_lastname',
            'approver:usr_id,usr_firstname,usr_lastname',
            'expenses.category',
            'expenses.lines.tax',
            'mileageExpenses.vehicle',
        ])->findOrFail($id);

        // Vérifier l'accès
        if (!$this->canAccessReport($report)) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'avez pas accès à cette note de frais'
            ], 403);
        }
        $user = Auth::user();
        return response()->json([
            'success' => true,
            'data' => [
                'id' => $report->exr_id,
                'exr_number' => $report->exr_number,
                'exr_title' => $report->exr_title,
                'exr_description' => $report->exr_description,
                'exr_period_from' => $report->exr_period_from?->format('Y-m-d'),
                'exr_period_to' => $report->exr_period_to?->format('Y-m-d'),
                'exr_status' => $report->exr_status,
                'exr_status_label' => $report->status_label,
                'exr_submission_date' => $report->exr_submission_date,
                'exr_approval_date' => $report->exr_approval_date,
                'exr_rejection_reason' => $report->exr_rejection_reason,
                'exr_total_amount_ht' => (float) $report->exr_total_amount_ht,
                'exr_total_amount_ttc' => (float) $report->exr_total_amount_ttc,
                'exr_total_tva' => (float) $report->exr_total_tva,
                'exr_amount_remaining' => (float) ($report->exr_amount_remaining ?? $report->exr_total_amount_ttc),
                'exr_payment_progress' => (int) ($report->exr_payment_progress ?? 0),
                'exr_payment_date' => $report->exr_payment_date,
                'fk_usr_id' => $report->fk_usr_id,
                'user' => $report->user,
                'approver' => $report->approver,
                'is_owner' => $this->isOwner($report),
                'can_edit' => $report->canBeEdited() && $this->canEditReport($report),
                'can_delete' => $report->canBeEdited() && $this->canDeleteReport($report),
                'can_submit' => $report->canBeSubmitted() && $this->isOwner($report),
                'can_approve' => $report->canBeApproved() && $this->canApproveReport($report),
                'can_approve_all' => $user->can('expenses.approveall'),
                'expenses' => $report->expenses->map(function ($expense) {
                    return [
                        'id' => $expense->exp_id,
                        'exp_date' => $expense->exp_date->format('Y-m-d'),
                        'exp_description' => $expense->exp_description,
                        'exp_merchant' => $expense->exp_merchant,
                        'exp_payment_method' => $expense->exp_payment_method,
                        'exp_total_amount_ht' => (float) $expense->exp_total_amount_ht,
                        'exp_total_amount_ttc' => (float) $expense->exp_total_amount_ttc,
                        'exp_total_tva' => (float) $expense->exp_total_tva,
                        'exp_receipt_path' => $expense->exp_receipt_path,
                        'exp_notes' => $expense->exp_notes,
                        'fk_exc_id' => $expense->fk_exc_id,
                        'category' => $expense->category,
                        'lines' => $expense->lines,
                    ];
                }),
                'mileage_expenses' => $report->mileageExpenses->map(function ($mex) {
                    return [
                        'id' => $mex->mex_id,
                        'mex_date' => $mex->mex_date ? $mex->mex_date->format('Y-m-d') : null,
                        'mex_departure' => $mex->mex_departure,
                        'mex_destination' => $mex->mex_destination,
                        'mex_distance_km' => (float) $mex->mex_distance_km,
                        'mex_is_round_trip' => (bool) $mex->mex_is_round_trip,
                        'mex_fiscal_power' => $mex->mex_fiscal_power,
                        'mex_vehicle_type' => $mex->mex_vehicle_type,
                        'mex_rate_coefficient' => (float) $mex->mex_rate_coefficient,
                        'mex_rate_constant' => (float) $mex->mex_rate_constant,
                        'mex_calculated_amount' => (float) $mex->mex_calculated_amount,
                        'mex_notes' => $mex->mex_notes,
                        'fk_vhc_id' => $mex->fk_vhc_id,
                        'vehicle' => $mex->vehicle ? [
                            'id' => $mex->vehicle->vhc_id,
                            'vhc_name' => $mex->vehicle->vhc_name,
                            'vhc_registration' => $mex->vehicle->vhc_registration,
                            'vhc_fiscal_power' => $mex->vehicle->vhc_fiscal_power,
                            'vhc_type' => $mex->vehicle->vhc_type,
                        ] : null,
                    ];
                }),
            ]
        ]);
    }

    /**
     * Créer une note de frais
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'exr_title' => 'nullable|string|max:255',
            'exr_description' => 'nullable|string',
            'exr_period_from' => 'nullable|date',
            'exr_period_to' => 'nullable|date|after_or_equal:exr_period_from',
            'fk_usr_id' => 'nullable|integer|exists:user_usr,usr_id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        // Déterminer l'utilisateur cible
        $targetUserId = $request->filled('fk_usr_id') ? $request->fk_usr_id : Auth::id();

        // Vérifier la permission de création
        if (!$this->canCreateReport($targetUserId)) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'avez pas la permission de créer cette note de frais'
            ], 403);
        }

        DB::beginTransaction();
        try {
            // Le numéro (exr_number) est généré automatiquement dans le boot du modèle
            $report = ExpenseReportModel::create([
                'fk_usr_id' => $targetUserId,
                'exr_title' => $request->exr_title,
                'exr_description' => $request->exr_description,
                'exr_period_from' => $request->exr_period_from,
                'exr_period_to' => $request->exr_period_to,
                'exr_status' => 'draft',
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Note de frais créée avec succès',
                'data' => [
                    'id' => $report->exr_id,
                    'exr_number' => $report->exr_number,
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mettre à jour une note de frais
     */
    public function update(Request $request, $id)
    {
        $report = ExpenseReportModel::findOrFail($id);

        // Vérifier si l'utilisateur peut éditer cette note
        if (!$this->canEditReport($report)) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez pas modifier cette note de frais'
            ], 403);
        }

        if (!$report->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette note de frais ne peut pas être modifiée'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'exr_title' => 'nullable|string|max:255',
            'exr_description' => 'nullable|string',
            'exr_period_from' => 'nullable|date',
            'exr_period_to' => 'nullable|date|after_or_equal:exr_period_from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        $report->update($request->only([
            'exr_title',
            'exr_description',
            'exr_period_from',
            'exr_period_to',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Note de frais mise à jour',
            'data' => $report
        ]);
    }

    /**
     * Soumettre une note de frais
     */
    public function submit($id)
    {
        $report = ExpenseReportModel::with('expenses')->findOrFail($id);

        $user = Auth::user();
        if ($user->can('expenses.approveall')) {
            $report->update([
                'exr_status' => 'submitted',
                'exr_submission_date' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Note de frais soumise avec succès',
                'data' => $report
            ]);
        }

        // Seul le propriétaire peut soumettre sa note de frais
        if (!$this->isOwner($report)) {
            return response()->json([
                'success' => false,
                'message' => 'Vous ne pouvez soumettre que vos propres notes de frais'
            ], 403);
        }

        if (!$report->canBeSubmitted()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette note de frais ne peut pas être soumise'
            ], 403);
        }

        $report->update([
            'exr_status' => 'submitted',
            'exr_submission_date' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Note de frais soumise avec succès',
            'data' => $report
        ]);
    }

    /**
     * Approuver une note de frais
     */
    public function approve(Request $request, $id)
    {
        $report = ExpenseReportModel::findOrFail($id);

        // Vérifier la permission d'approbation
        if (!$this->canApproveReport($report)) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'avez pas la permission d\'approuver cette note de frais'
            ], 403);
        }

        if (!$report->canBeApproved()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette note de frais ne peut pas être approuvée (statut incorrect)'
            ], 403);
        }

        $report->update([
            'exr_status' => 'approved',
            'exr_approval_date' => now(),
            'fk_usr_id_approved_by' => Auth::id(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Note de frais approuvée',
            'data' => $report
        ]);
    }

    /**
     * Rejeter une note de frais
     */
    public function reject(Request $request, $id)
    {
        $report = ExpenseReportModel::findOrFail($id);

        // Vérifier la permission d'approbation (même permission pour rejeter)
        if (!$this->canApproveReport($report)) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'avez pas la permission de rejeter cette note de frais'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'exr_rejection_reason' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        $report->update([
            'exr_status' => 'rejected',
            'exr_rejection_reason' => $request->exr_rejection_reason,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Note de frais rejetée',
            'data' => $report
        ]);
    }

    /**
     * Désapprouver une note de frais (retour en statut soumis)
     * Possible uniquement si aucun paiement n'a été effectué
     */
    public function unapprove(Request $request, $id)
    {
        $report = ExpenseReportModel::findOrFail($id);

        // Vérifier la permission d'approbation (même permission pour désapprouver)
        if (!$this->canApproveReport($report)) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'avez pas la permission de désapprouver cette note de frais'
            ], 403);
        }

        if (!$report->canBeUnapproved()) {
            $reason = $report->exr_status !== 'approved'
                ? 'Cette note de frais n\'est pas en statut approuvée'
                : 'Impossible de désapprouver : des paiements ont déjà été effectués';

            return response()->json([
                'success' => false,
                'message' => $reason
            ], 403);
        }

        $report->update([
            'exr_status' => 'submitted',
            'exr_approval_date' => null,
            'fk_usr_id_approved_by' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Note de frais désapprouvée',
            'data' => $report
        ]);
    }

    /**
     * Supprimer une note de frais
     */
    public function destroy($id)
    {
        $report = ExpenseReportModel::findOrFail($id);

        // Vérifier si l'utilisateur peut supprimer cette note
        if (!$this->canDeleteReport($report)) {
            return response()->json([
                'success' => false,
                'message' => 'Vous n\'avez pas la permission de supprimer cette note de frais'
            ], 403);
        }

        if (!$report->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette note de frais ne peut pas être supprimée (statut non modifiable)'
            ], 403);
        }

        $report->delete();

        return response()->json([
            'success' => true,
            'message' => 'Note de frais supprimée'
        ]);
    }

    /**
     * Marquer une note de frais comme payée
     */
    public function markPaid($id)
    {
        $report = ExpenseReportModel::findOrFail($id);

        if ($report->exr_status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Seule une note approuvée peut être marquée comme payée'
            ], 403);
        }

        $report->update([
            'exr_status' => 'paid',
            'exr_payment_date' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Note de frais marquée comme payée',
            'data' => $report
        ]);
    }

    /**
     * Récupère les paiements d'une note de frais
     *
     * @param int $exrId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPayments($exrId)
    {
        try {
            // Vérifier l'accès à la note de frais
            $report = ExpenseReportModel::findOrFail($exrId);
            if (!$this->canAccessReport($report)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Vous n\'avez pas accès à cette note de frais'
                ], 403);
            }

            $data = DB::table('payment_pay as pay')
                ->join('payment_allocation_pal as pal', 'pay.pay_id', '=', 'pal.fk_pay_id')
                ->leftJoin('payment_mode_pam as pam', 'pay.fk_pam_id', '=', 'pam.pam_id')
                ->leftJoin('bank_details_bts as bts', 'pay.fk_bts_id', '=', 'bts.bts_id')
                ->where('pal.fk_exr_id', $exrId)
                ->select([
                    'pay.pay_id',
                    'pay.pay_date',
                    'pay.pay_number',
                    'pay.pay_number',
                    'pay.pay_status',
                    'pal.pal_amount',
                    DB::raw("'Paiement' AS payment_type"),
                    'pay.pay_number as paynumber',
                    'pam.pam_label as payment_mode',
                    'pay.pay_amount as amount',
                    'bts.bts_label as bank_label'
                ])
                ->orderBy('pay.pay_date', 'DESC')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des paiements: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupère les notes de frais impayées du même salarié
     * Utilisé pour allouer un paiement à plusieurs notes de frais
     *
     * @param int $exrId - ID de la note de frais courante
     * @param int|null $payId - ID du paiement en cours d'édition (optionnel)
     * @return \Illuminate\Http\JsonResponse
     */
    public function getUnpaidExpenseReports($exrId, $payId = null)
    {
        try {
            // Récupérer la note de frais courante pour obtenir l'ID du salarié
            $currentReport = ExpenseReportModel::findOrFail($exrId);

            if (!$this->canAccessReport($currentReport)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Vous n\'avez pas accès à cette note de frais'
                ], 403);
            }

            $employeeId = $currentReport->fk_usr_id;

            // Récupérer les notes de frais approuvées du même salarié avec un montant restant > 0
            $query = ExpenseReportModel::where('fk_usr_id', $employeeId)
                ->whereIn('exr_status', ['approved', 'accounted'])
                ->where(function ($q) {
                    $q->where('exr_amount_remaining', '>', 0)
                        ->orWhereNull('exr_amount_remaining');
                });

            // Si on édite un paiement, inclure aussi les notes déjà allouées à ce paiement
            if ($payId) {
                $allocatedExrIds = DB::table('payment_allocation_pal')
                    ->where('fk_pay_id', $payId)
                    ->whereNotNull('fk_exr_id')
                    ->pluck('fk_exr_id')
                    ->toArray();

                if (!empty($allocatedExrIds)) {
                    $query->orWhereIn('exr_id', $allocatedExrIds);
                }
            }

            $reports = $query->orderBy('exr_approval_date', 'ASC')
                ->get()
                ->map(function ($report) use ($payId) {
                    // Calculer le montant restant réel
                    $amountRemaining = $report->exr_amount_remaining ?? $report->exr_total_amount_ttc;

                    // Si on édite un paiement, ajouter le montant déjà alloué au montant restant
                    if ($payId) {
                        $allocatedAmount = DB::table('payment_allocation_pal')
                            ->where('fk_pay_id', $payId)
                            ->where('fk_exr_id', $report->exr_id)
                            ->sum('pal_amount');
                        $amountRemaining += $allocatedAmount;
                    }

                    return [
                        'id' => $report->exr_id,
                        'number' => $report->exr_number,
                        'date' => $report->exr_approval_date,
                        'totalttc' => (float) $report->exr_total_amount_ttc,
                        'amount_remaining' => (float) $amountRemaining,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $reports
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des notes de frais impayées: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Récupère les trop versés disponibles pour un salarié
     * Recherche les paiements de notes de frais du même salarié
     * où le montant payé dépasse le montant alloué
     *
     * @param int $exrId
     * @return JsonResponse
     */
    public function getAvailableCredits($exrId): JsonResponse
    {
        try {
            $expenseReport = ExpenseReportModel::findOrFail($exrId);
            $employeeId = $expenseReport->fk_usr_id;

            // Récupérer les trop versés (paiements NDF du même salarié où montant > montant alloué)
            /*   $creditsQuery = DB::table('payment_pay as pay')
                ->join('payment_allocation_pal as pal_main', 'pay.pay_id', '=', 'pal_main.fk_pay_id')
                ->join('expense_reports_exr as exr', 'pal_main.fk_exr_id', '=', 'exr.exr_id')
                ->leftJoin('payment_allocation_pal as pal_all', 'pay.pay_id', '=', 'pal_all.fk_pay_id')
                ->where('exr.fk_usr_id', $employeeId)
                ->where('pay.pay_operation', PaymentModel::OPERATION_EXPENSE_REPORT_PAYMENT)
                ->groupBy('pay.pay_id', 'pay.pay_number', 'pay.pay_amount')
                ->select([
                    DB::raw("CONCAT('pay_', pay.pay_id) as id"),
                    DB::raw("CONCAT('Trop versé - Paiement ', pay.pay_number, ' (', ROUND(pay.pay_amount - COALESCE(SUM(pal_all.pal_amount), 0), 2), '€)') as label"),
                    DB::raw('(pay.pay_amount - COALESCE(SUM(pal_all.pal_amount), 0)) as balance')
                ])
                ->havingRaw('balance > 0')
                ->get();*/

            $creditsQuery = PaymentModel::from('payment_pay')
                ->where('fk_usr_id', $employeeId)
                ->where('pay_amount_available', '>', 0)
                ->select([
                    DB::raw("CONCAT('pay_',pay_id) as id"),
                    DB::raw("CONCAT('Trop versé paiement - ', pay_number ,' (',ROUND(pay_amount_available, 2), '€)')COLLATE utf8mb4_general_ci  as label"),
                    DB::raw('pay_amount_available as balance')
                ]);
            $data = $creditsQuery

                ->orderBy('label')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des crédits disponibles: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Utilise un trop versé sur une note de frais
     * Crée une allocation supplémentaire sur le paiement existant
     *
     * @param Request $request
     * @param int $exrId
     * @return JsonResponse
     */
    public function useCredit(Request $request, $exrId): JsonResponse
    {
        $request->validate([
            'credit_id' => 'required|string',
        ]);

        try {
            DB::beginTransaction();

            $expenseReport = ExpenseReportModel::findOrFail($exrId);
            $amountRemaining = (float) ($expenseReport->exr_amount_remaining ?? $expenseReport->exr_total_amount_ttc);

            if ($amountRemaining <= 0) {
                throw new \Exception('La note de frais est déjà entièrement réglée');
            }

            $explodedCreditId = explode('_', $request->credit_id);
            if (!isset($explodedCreditId[1]) || $explodedCreditId[0] !== 'pay') {
                throw new \Exception("ID de crédit invalide");
            }

            $payment = PaymentModel::find($explodedCreditId[1]);
            if (!$payment) {
                throw new \Exception("Paiement introuvable");
            }

            // Calculer le solde disponible sur ce paiement
            $totalAllocated = PaymentAllocationModel::where('fk_pay_id', $payment->pay_id)
                ->sum('pal_amount');
            $creditBalance = (float) $payment->pay_amount - (float) $totalAllocated;

            if ($creditBalance <= 0) {
                throw new \Exception('Aucun montant disponible sur ce crédit');
            }

            // Calculer le montant à allouer
            $payAmount = min($creditBalance, $amountRemaining);

            $userId = $request->user()->usr_id;

            // Créer l'allocation
            $allocation = new PaymentAllocationModel();
            $allocation->fk_pay_id = $payment->pay_id;
            $allocation->fk_exr_id = $exrId;
            $allocation->pal_amount = $payAmount;
            $allocation->fk_usr_id_author = $userId;
            $allocation->save();

            // Mettre à jour le montant restant de la note de frais
            $expenseReport->updateAmountRemaining();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Crédit appliqué avec succès',
                'data' => [
                    'pay_id' => $payment->pay_id,
                    'pay_number' => $payment->pay_number,
                    'amount' => $payAmount,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function removePaymentAllocation(Request $request, $exrId, $payId): JsonResponse
    {
        try {
            (new PaymentService())->removeAllocation((int)$payId, 'fk_exr_id', (int)$exrId);
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
