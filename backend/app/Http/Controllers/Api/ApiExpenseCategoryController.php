<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers;

use App\Models\ExpenseCategoryModel;
use App\Traits\HasGridFilters;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ApiExpenseCategoryController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'expense-categories';

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

        $query = ExpenseCategoryModel::with(['account:acc_id,acc_code,acc_label']);

        $this->applyGridFilters($query, $request, [
            'exc_name' => 'exc_name',
            'exc_code' => 'exc_code',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'       => 'exc_id',
            'exc_name' => 'exc_name',
            'exc_code' => 'exc_code',
        ], 'exc_name', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'exc_name'),
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
     * Liste uniquement des catégories actives
     */
    public function active()
    {
        $categories = ExpenseCategoryModel::active()
            ->orderBy('exc_name', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories->map(function ($category) {
                return $this->formatCategory($category);
            })
        ]);
    }

    /**
     * Liste des catégories pour select (format options)
     */
    public function options(Request $request)
    {
        $query = ExpenseCategoryModel::active()
            ->orderBy('exc_name', 'asc');

        // Filtre optionnel par recherche
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('exc_name', 'like', "%{$search}%")
                    ->orWhere('exc_code', 'like', "%{$search}%");
            });
        }

        $categories = $query->get();

        return response()->json([
            'success' => true,
            'data' => $categories->map(function ($category) {
                return [
                    'id' => $category->exc_id,
                    'label' => $category->exc_name,
                    'code' => $category->exc_code,
                    'exc_type' => $category->exc_type,
                    'icon' => $category->exc_icon,
                    'color' => $category->exc_color,
                    'requires_receipt' => (bool) $category->exc_requires_receipt,
                    'max_amount' => $category->exc_max_amount ? (float) $category->exc_max_amount : null,
                ];
            })
        ]);
    }

    /**
     * Afficher une catégorie
     */
    public function show($id)
    {
        $category = ExpenseCategoryModel::with([
            'account:acc_id,acc_code,acc_label'
        ])->findOrFail($id);

        // Statistiques d'utilisation
        /*    $stats = DB::table('expenses_exp')
            ->where('fk_exc_id', $id)
            ->selectRaw('
                COUNT(*) as total_expenses,
                SUM(exp_total_amount_ttc) as total_amount,
                AVG(exp_total_amount_ttc) as average_amount
            ')
            ->first();*/

        return response()->json([
            'success' => true,
            'data' =>  $category,
            /*  'data' => array_merge(
                $this->formatCategory($category, true),
                [
                    'stats' => [
                        'total_expenses' => (int) $stats->total_expenses,
                        'total_amount' => (float) ($stats->total_amount ?? 0),
                        'average_amount' => (float) ($stats->average_amount ?? 0),
                    ]
                ]
            )*/
        ]);
    }

    /**
     * Créer une catégorie
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'exc_name' => 'required|string|max:100|unique:expense_categories_exc,exc_name',
            'exc_code' => 'required|string|max:50|unique:expense_categories_exc,exc_code',
            'fk_acc_id' => 'required|integer|exists:account_account_acc,acc_id',
            'exc_type' => 'required|string|in:conso,service',
            'exc_description' => 'nullable|string',
            'exc_icon' => 'nullable|string|max:50',
            'exc_color' => 'nullable|string|max:20',
            'exc_is_active' => 'boolean',
            'exc_requires_receipt' => 'boolean',
            'exc_max_amount' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        try {
            $category = ExpenseCategoryModel::create([
                'exc_name' => $request->exc_name,
                'exc_code' => $request->exc_code,
                'exc_type' => $request->exc_type,
                'exc_description' => $request->exc_description,
                'exc_icon' => $request->exc_icon,
                'exc_color' => $request->exc_color,
                'exc_is_active' => $request->get('exc_is_active', true),
                'exc_requires_receipt' => $request->get('exc_requires_receipt', true),
                'exc_max_amount' => $request->exc_max_amount,
                'fk_acc_id'  => $request->fk_acc_id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Catégorie créée avec succès',
                'data' => $this->formatCategory($category)
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mettre à jour une catégorie
     */
    public function update(Request $request, $id)
    {
        $category = ExpenseCategoryModel::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'exc_name' => 'sometimes|required|string|max:100|unique:expense_categories_exc,exc_name,' . $id . ',exc_id',
            'exc_code' => 'sometimes|required|string|max:50|unique:expense_categories_exc,exc_code,' . $id . ',exc_id',
            'fk_acc_id' => 'required|integer|exists:account_account_acc,acc_id',
            'exc_type' => 'required|string|in:conso,service',
            'exc_description' => 'nullable|string',
            'exc_icon' => 'nullable|string|max:50',
            'exc_color' => 'nullable|string|max:20',
            'exc_is_active' => 'boolean',
            'exc_requires_receipt' => 'boolean',
            'exc_max_amount' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        try {
            $category->update($request->only([
                'exc_name',
                'exc_code',
                'exc_type',
                'exc_description',
                'exc_icon',
                'exc_color',
                'exc_is_active',
                'exc_requires_receipt',
                'exc_max_amount',
                'fk_acc_id',
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Catégorie mise à jour',
                'data' => $this->formatCategory($category)
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer une catégorie
     */
    public function destroy($id)
    {
        $category = ExpenseCategoryModel::findOrFail($id);

        // Vérifier si la catégorie est utilisée
        $usageCount = DB::table('expenses_exp')
            ->where('fk_exc_id', $id)
            ->count();

        if ($usageCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cette catégorie ne peut pas être supprimée car elle est utilisée dans {$usageCount} dépense(s)",
                'usage_count' => $usageCount
            ], 422);
        }

        try {
            $category->delete();

            return response()->json([
                'success' => true,
                'message' => 'Catégorie supprimée'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Activer/Désactiver une catégorie
     */
    public function toggleActive($id)
    {
        $category = ExpenseCategoryModel::findOrFail($id);

        $category->update([
            'exc_is_active' => !$category->exc_is_active
        ]);

        return response()->json([
            'success' => true,
            'message' => $category->exc_is_active ? 'Catégorie activée' : 'Catégorie désactivée',
            'data' => $this->formatCategory($category)
        ]);
    }

    /**
     * Obtenir les catégories les plus utilisées
     */
    public function mostUsed(Request $request)
    {
        $limit = $request->get('limit', 10);

        $categories = ExpenseCategoryModel::select('expense_categories_exc.*')
            ->selectRaw('(SELECT COUNT(*) FROM expenses_exp WHERE fk_exc_id = expense_categories_exc.exc_id) as usage_count')
            ->selectRaw('(SELECT SUM(exp_total_amount_ttc) FROM expenses_exp WHERE fk_exc_id = expense_categories_exc.exc_id) as total_amount')
            ->having('usage_count', '>', 0)
            ->orderBy('usage_count', 'desc')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories->map(function ($category) {
                return array_merge(
                    $this->formatCategory($category),
                    [
                        'usage_count' => (int) $category->usage_count,
                        'total_amount' => (float) ($category->total_amount ?? 0),
                    ]
                );
            })
        ]);
    }

    /**
     * Statistiques par catégorie
     */
    public function statistics(Request $request)
    {
        $query = DB::table('expense_categories_exc')
            ->leftJoin('expenses_exp', 'expense_categories_exc.exc_id', '=', 'expenses_exp.fk_exc_id')
            ->select(
                'expense_categories_exc.exc_id',
                'expense_categories_exc.exc_name',
                'expense_categories_exc.exc_code',
                'expense_categories_exc.exc_color',
                'expense_categories_exc.exc_icon'
            )
            ->selectRaw('COUNT(expenses_exp.exp_id) as count')
            ->selectRaw('COALESCE(SUM(expenses_exp.exp_total_amount_ht), 0) as total_ht')
            ->selectRaw('COALESCE(SUM(expenses_exp.exp_total_amount_tva), 0) as total_tva')
            ->selectRaw('COALESCE(SUM(expenses_exp.exp_total_amount_ttc), 0) as total_ttc')
            ->selectRaw('COALESCE(AVG(expenses_exp.exp_total_amount_ttc), 0) as average_amount')
            ->groupBy(
                'expense_categories_exc.exc_id',
                'expense_categories_exc.exc_name',
                'expense_categories_exc.exc_code',
                'expense_categories_exc.exc_color',
                'expense_categories_exc.exc_icon'
            );

        // Filtre par période
        if ($request->filled('date_from')) {
            $query->where('expenses_exp.exp_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->where('expenses_exp.exp_date', '<=', $request->date_to);
        }

        $statistics = $query->get();

        return response()->json([
            'success' => true,
            'data' => $statistics->map(function ($stat) {
                return [
                    'id' => $stat->exc_id,
                    'name' => $stat->exc_name,
                    'code' => $stat->exc_code,
                    'color' => $stat->exc_color,
                    'icon' => $stat->exc_icon,
                    'count' => (int) $stat->count,
                    'total_ht' => (float) $stat->total_ht,
                    'total_tva' => (float) $stat->total_tva,
                    'total_ttc' => (float) $stat->total_ttc,
                    'average_amount' => (float) $stat->average_amount,
                ];
            })
        ]);
    }

    /**
     * Formater une catégorie pour la réponse
     */
    private function formatCategory($category, $detailed = false)
    {
        $data = [
            'id' => $category->exc_id,
            'exc_name' => $category->exc_name,
            'exc_code' => $category->exc_code,
            'exc_description' => $category->exc_description,
            'exc_icon' => $category->exc_icon,
            'exc_color' => $category->exc_color,
            'exc_is_active' => (bool) $category->exc_is_active,
            'exc_requires_receipt' => (bool) $category->exc_requires_receipt,
            'exc_max_amount' => $category->exc_max_amount ? (float) $category->exc_max_amount : null,
            'exc_formatted_max_amount' => $category->formatted_max_amount,
            'account' => $category->account,
        ];

        if ($detailed) {
            $data['exc_created_at'] = $category->exc_created_at?->format('Y-m-d H:i:s');
            $data['exc_updated_at'] = $category->exc_updated_at?->format('Y-m-d H:i:s');
        }

        return $data;
    }
}
