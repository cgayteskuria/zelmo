<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers;

use App\Models\ExpenseModel;
use App\Models\ExpenseReportModel;
use App\Models\ExpenseLineModel;
use App\Models\ExpenseCategoryModel;
use App\Models\AccountTaxModel;
use App\Models\DocumentModel;
use App\Services\DocumentService;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class ApiExpenseController
{
    protected DocumentService $documentService;

    public function __construct(DocumentService $documentService)
    {
        $this->documentService = $documentService;
    }
    /**
     * Liste des dépenses avec filtres
     */
    public function index(Request $request, $exrId)
    {
        // Vérifier que la note de frais existe
        ExpenseReportModel::findOrFail($exrId);

        $query = ExpenseModel::with([
            'category',
            'expenseReport'
        ])
            ->select('expenses_exp.*')
            ->where('fk_exr_id', $exrId);

        // Filtre par catégorie
        if ($request->filled('category_id')) {
            $query->where('fk_exc_id', $request->category_id);
        }

        // Filtre par date
        if ($request->filled('date_from')) {
            $query->where('exp_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('exp_date', '<=', $request->date_to);
        }

        // Filtre par montant
        if ($request->filled('min_amount')) {
            $query->where('exp_total_amount_ttc', '>=', $request->min_amount);
        }

        if ($request->filled('max_amount')) {
            $query->where('exp_total_amount_ttc', '<=', $request->max_amount);
        }

        // Recherche textuelle
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('exp_description', 'like', "%{$search}%")
                    ->orWhere('exp_merchant', 'like', "%{$search}%")
                    ->orWhere('exp_notes', 'like', "%{$search}%");
            });
        }

        // Filtre avec ou sans reçu
        if ($request->filled('has_receipt')) {
            if ($request->has_receipt === 'true' || $request->has_receipt === true) {
                $query->whereNotNull('fk_doc_id');
            } else {
                $query->whereNull('fk_doc_id');
            }
        }

        // Tri
        $sortField = $request->get('sort_field', 'exp_date');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortField, $sortOrder);

        // Pagination
        $perPage = $request->get('per_page', 15);
        $expenses = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $expenses->map(function ($expense) {
                return $this->formatExpense($expense);
            }),
            'meta' => [
                'current_page' => $expenses->currentPage(),
                'last_page' => $expenses->lastPage(),
                'per_page' => $expenses->perPage(),
                'total' => $expenses->total(),
            ]
        ]);
    }

    /**
     * Afficher une dépense
     */
    public function show($exrId, $id)
    {
        $expense = ExpenseModel::with([
            'category',
            'expenseReport',
            'lines',
            'document'
        ])
            ->where('fk_exr_id', $exrId)
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatExpense($expense, true)
        ]);
    }

    /**
     * Créer une dépense
     */
    public function store(Request $request, $exrId)
    {
        // Decoder les lignes si envoyees en JSON string (multipart/form-data)
        $data = $request->all();
        if (is_string($request->lines)) {
            $data['lines'] = json_decode($request->lines, true);
            $request->merge(['lines' => $data['lines']]);
        }

        $messages = [
            'fk_exc_id.required' => "La catégorie de dépense est obligatoire.",
            'fk_exc_id.exists' => "La catégorie sélectionnée n'existe pas.",

            'exp_date.required' => "La date est obligatoire.",
            'exp_date.date' => "La date doit être valide.",

            'exp_description.required' => "La description est obligatoire.",
            'exp_description.max' => "La description ne doit pas dépasser 255 caractères.",

            'exp_payment_method.in' => "Le mode de paiement est invalide.",

            'lines.required' => "Au moins une ligne est obligatoire.",
            'lines.array' => "Le format des lignes est invalide.",
            'lines.min' => "Il faut au minimum une ligne.",
            'lines.max' => "Maximum 4 lignes autorisées.",

            'lines.*.fk_tax_id.required' => "La taxe est obligatoire pour chaque ligne.",
            'lines.*.fk_tax_id.exists' => "La taxe sélectionnée n'existe pas.",

            'lines.*.exl_amount_ht.required' => "Le montant HT est obligatoire.",
            'lines.*.exl_amount_ht.numeric' => "Le montant HT doit être un nombre.",
        ];
        $validator = Validator::make($data, [
            'fk_exc_id' => 'required|exists:expense_categories_exc,exc_id',
            'exp_date' => 'required|date',
            'exp_merchant' => 'required|string|max:255',
            'exp_notes' => 'nullable|string',
            'receipt' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'lines' => 'required|array|min:1',
            'lines.*.fk_tax_id' => 'required|exists:account_tax_tax,tax_id',
            'lines.*.exl_tax_rate' => 'nullable|numeric',
            'lines.*.exl_amount_tva' => 'required|numeric|min:0',
            'lines.*.exl_amount_ht' => 'required|numeric|min:0.01',
            'lines.*.exl_amount_ttc' => 'required|numeric|min:0.01',
        ], $messages);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        // Vérifier que la note de frais est modifiable
        $expenseReport = ExpenseReportModel::findOrFail($exrId);
        if (!$expenseReport->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'La note de frais ne peut pas être modifiée'
            ], 403);
        }

        // Vérifier la catégorie
        $category = ExpenseCategoryModel::findOrFail($request->fk_exc_id);
        if (!$category->exc_is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Cette catégorie n\'est pas active'
            ], 422);
        }

        DB::beginTransaction();
        $document = null;
        try {
            // Créer la dépense
            $expense = ExpenseModel::create([
                'fk_exr_id' => $exrId,
                'fk_exc_id' => $request->fk_exc_id,
                'exp_date' => $request->exp_date,
                'exp_merchant' => $request->exp_merchant,
                'exp_notes' => $request->exp_notes,
            ]);

            // Créer les lignes de dépense (montants transmis depuis le frontend)
            foreach ($request->lines as $lineData) {
                $line = new ExpenseLineModel([
                    'fk_tax_id' => $lineData['fk_tax_id'] ?? null,
                    'exl_amount_ht' => $lineData['exl_amount_ht'],
                    'exl_amount_tva' => $lineData['exl_amount_tva'],
                    'exl_amount_ttc' => $lineData['exl_amount_ttc'],
                    'exl_tax_rate' => $lineData['exl_tax_rate'] ?? null,
                ]);
                // Charger la relation tax pour la validation (modèle pas encore sauvegardé)
                if ($line->fk_tax_id) {
                    $line->setRelation('tax', AccountTaxModel::find($line->fk_tax_id));
                }
                $validationError = $line->validateAmounts();
                if ($validationError) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => $validationError
                    ], 422);
                }
                $expense->lines()->save($line);
            }

            // Gerer le fichier recu si present via DocumentService
            if ($request->hasFile('receipt')) {
                $file = $request->file('receipt');
                $documents = $this->documentService->uploadFiles(
                    [$file],
                    'expenses',
                    $expense->exp_id,
                    $request->user()->usr_id,
                    $exrId,
                );
                $document = $documents->first();
            }

            // Recalculer les totaux de la dépense pour validateExpense
            $expense->calculateTotals();
            $expense->save();

            // Valider la dépense selon la catégorie
            $validationErrors = $category->validateExpense($expense);
            if (!empty($validationErrors)) {
                // Supprimer le document uploadé en cas d'erreur
                if ($document) {
                    $this->documentService->deleteDocument($document, $request->user()->usr_id);
                }
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => $validationErrors
                ], 422);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Dépense créée avec succès',
                'data' => $this->formatExpense($expense->load(['category', 'lines.tax', 'document']))
            ], 201);
        } catch (\Exception $e) {
            // Supprimer le document uploadé en cas d'erreur
            if ($document) {
                $this->documentService->deleteDocument($document, $request->user()->usr_id);
            }
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mettre à jour une dépense
     */
    public function update(Request $request, $exrId, $id)
    {
        $expense = ExpenseModel::with('expenseReport')
            ->where('fk_exr_id', $exrId)
            ->findOrFail($id);

        // Vérifier que la note de frais est modifiable
        if (!$expense->expenseReport->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette dépense ne peut pas être modifiée'
            ], 403);
        }
        $messages = [
            'fk_exc_id.required' => "La catégorie de dépense est obligatoire.",
            'fk_exc_id.exists' => "La catégorie sélectionnée n'existe pas.",

            'exp_date.required' => "La date est obligatoire.",
            'exp_date.date' => "La date doit être valide.",

            'exp_description.required' => "La description est obligatoire.",
            'exp_description.max' => "La description ne doit pas dépasser 255 caractères.",

            'exp_payment_method.in' => "Le mode de paiement est invalide.",

            'lines.required' => "Au moins une ligne est obligatoire.",
            'lines.array' => "Le format des lignes est invalide.",
            'lines.min' => "Il faut au minimum une ligne.",
            'lines.max' => "Maximum 4 lignes autorisées.",

            'lines.*.fk_tax_id.required' => "La taxe est obligatoire pour chaque ligne.",
            'lines.*.fk_tax_id.exists' => "La taxe sélectionnée n'existe pas.",

            'lines.*.exl_amount_ht.required' => "Le montant HT est obligatoire.",
            'lines.*.exl_amount_ht.numeric' => "Le montant HT doit être un nombre.",
        ];
        $validator = Validator::make($request->all(), [
            'fk_exc_id' => 'sometimes|required|exists:expense_categories_exc,exc_id',
            'exp_date' => 'sometimes|required|date',
            'exp_description' => 'sometimes|required|string|max:255',
            'exp_merchant' => 'sometimes|required|string|max:255',
            'exp_payment_method' => 'sometimes|required|in:cash,credit_card,bank_transfer,other',
            'exp_notes' => 'nullable|string',
            'lines' => 'sometimes|required|array|min:1|max:4',
            'lines.*.fk_tax_id' => 'required|exists:account_tax_tax,tax_id',
            'lines.*.exl_amount_ht' => 'required|numeric|min:0.01',
            'lines.*.exl_tax_rate' => 'required|numeric|min:0',
            'lines.*.exl_amount_tva' => 'required|numeric|min:0',
            'lines.*.exl_amount_ttc' => 'required|numeric|min:0.01',
            'delete_receipt' => 'sometimes|boolean',
        ], $messages);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            //  Gérer la suppression du justificatif si demandée
            if ($request->has('delete_receipt') && $request->delete_receipt === true) {
                $expense->load('document'); // Charger la relation si pas déjà chargée
                if ($expense->document) {
                    $this->documentService->deleteDocument($expense->document, $request->user()->usr_id);
                }
            }

            // Mettre à jour la dépense
            $expense->update($request->only([
                'fk_exc_id',
                'exp_date',
                'exp_merchant',
                'exp_notes'
            ]));

            // Mettre à jour les lignes si fournies
            if ($request->has('lines')) {
                // Supprimer les anciennes lignes
                $expense->lines()->delete();

                // Créer les nouvelles lignes (montants transmis depuis le frontend)
                foreach ($request->lines as $lineData) {
                    $line = new ExpenseLineModel([
                        'fk_tax_id' => $lineData['fk_tax_id'] ?? null,
                        'exl_amount_ht' => $lineData['exl_amount_ht'],
                        'exl_amount_tva' => $lineData['exl_amount_tva'],
                        'exl_amount_ttc' => $lineData['exl_amount_ttc'],
                        'exl_tax_rate' => $lineData['exl_tax_rate'] ?? null,
                    ]);

                    if ($line->fk_tax_id) {
                        $line->setRelation('tax', AccountTaxModel::find($line->fk_tax_id));
                    }
                    $validationError = $line->validateAmounts();
                    if ($validationError) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => $validationError
                        ], 422);
                    }
                    $expense->lines()->save($line);
                }

                // Recalculer les totaux
                $expense->calculateTotals();
                $expense->save();
            }


            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Dépense mise à jour',
                'data' => $this->formatExpense($expense->load(['category', 'lines.tax']))
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Supprimer une dépense
     */
    public function destroy($exrId, $id)
    {
        $expense = ExpenseModel::with(['expenseReport', 'document'])
            ->where('fk_exr_id', $exrId)
            ->findOrFail($id);

        // Vérifier que la note de frais est modifiable
        if (!$expense->expenseReport->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette dépense ne peut pas être supprimée'
            ], 403);
        }

        DB::beginTransaction();
        try {
            // Supprimer le document du reçu si existant
            if ($expense->document) {
                $this->documentService->deleteDocument($expense->document, Auth::user()->usr_id);
            }

            $expense->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Dépense supprimée'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload d'un reçu
     */
    public function uploadReceipt(Request $request, $exrId, $id)
    {
        $expense = ExpenseModel::with(['expenseReport', 'document'])
            ->where('fk_exr_id', $exrId)
            ->findOrFail($id);

        // Vérifier que la note de frais est modifiable
        if (!$expense->expenseReport->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cette dépense ne peut pas être modifiée'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'receipt' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120', // 5MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        try {
            // Supprimer l'ancien document si existant
            if ($expense->document) {
                $this->documentService->deleteDocument($expense->document, $request->user()->usr_id);
            }

            // Stocker le nouveau fichier via DocumentService
            $file = $request->file('receipt');
            $documents = $this->documentService->uploadFiles(
                [$file],
                'expenses',
                $expense->exp_id,
                $request->user()->usr_id
            );
            $document = $documents->first();

            // Generer l'URL signee pour le document
            $signedUrl = $this->documentService->generateSignedUrl($document);

            return response()->json([
                'success' => true,
                'message' => 'Reçu uploadé avec succès',
                'data' => [
                    'doc_id' => $document->doc_id,
                    'url' => $signedUrl
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' =>  $e->getMessage(),
            ], 500);
        }
    }


    /**
     * Formater une dépense pour la réponse
     */
    private function formatExpense($expense, $includeLines = false)
    {
        // Generer l'URL signee pour le document si present      
        $fk_doc_id = null;
        if ($expense->relationLoaded('document') && $expense->document) {
            $fk_doc_id = $expense->document->doc_id;
        }

        $data = [
            'id' => $expense->exp_id,
            'exp_date' => $expense->exp_date->format('Y-m-d'),
            'exp_merchant' => $expense->exp_merchant,
            'exp_payment_method' => $expense->exp_payment_method,
            'exp_payment_method_label' => $expense->payment_method_label,
            'exp_total_amount_ht' => (float) $expense->exp_total_amount_ht,
            'exp_total_amount_ttc' => (float) $expense->exp_total_amount_ttc,
            'exp_total_tva' => (float) $expense->exp_total_tva,
            'fk_doc_id' => $fk_doc_id,
            'exp_notes' => $expense->exp_notes,
            'has_receipt' => $expense->has_receipt,
            'category' => $expense->category ? [
                'id' => $expense->category->exc_id,
                'exc_name' => $expense->category->exc_name,
                'exc_code' => $expense->category->exc_code,
                'exc_color' => $expense->category->exc_color,
                'exc_icon' => $expense->category->exc_icon,
            ] : null,
            'expense_report' => $expense->expenseReport ? [
                'id' => $expense->expenseReport->exr_id,
                'exr_reference' => $expense->expenseReport->exr_reference,
                'exr_title' => $expense->expenseReport->exr_title,
                'exr_status' => $expense->expenseReport->exr_status,
            ] : null,
        ];

        if ($includeLines && $expense->relationLoaded('lines')) {
            $data['lines'] = $expense->lines->map(function ($line) {
                return [
                    'id' => $line->exl_id,
                    'exl_amount_ht' => (float) $line->exl_amount_ht,
                    'exl_amount_tva' => (float) $line->exl_amount_tva,
                    'exl_amount_ttc' => (float) $line->exl_amount_ttc,
                    'exl_description' => $line->exl_description,
                    'tax' => $line->tax ? [
                        'id' => $line->tax->tax_id,
                        'tax_label' => $line->tax->tax_label,
                        'tax_rate' => (float) $line->tax->tax_rate,
                    ] : null,
                ];
            });
        }

        return $data;
    }
}
