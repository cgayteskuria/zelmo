<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountModel;
use App\Models\PartnerModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;

class ApiAccountController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'accounts';

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

        $query = AccountModel::with([
            'author:usr_id,usr_firstname,usr_lastname',
            'updater:usr_id,usr_firstname,usr_lastname',
        ]);

        $this->applyGridFilters($query, $request, [
            'acc_label'     => 'acc_label',
            'acc_code'      => 'acc_code',
            'acc_is_active' => 'acc_is_active',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'        => 'acc_id',
            'acc_code'  => 'acc_code',
            'acc_label' => 'acc_label',
        ], 'acc_code', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'acc_code'),
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
     * Display the specified account.
     */
    public function show($id)
    {
        $account = AccountModel::where('acc_id', $id)
            ->with([
                'author:usr_id,usr_firstname,usr_lastname',
                'updater:usr_id,usr_firstname,usr_lastname'
            ])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $account
        ], 200);
    }

    /**
     * Store a newly created account.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'acc_code'          => 'required|string|max:20|unique:account_account_acc,acc_code',
            'acc_label'         => 'required|string|max:255',
            'acc_type'          => 'required|string|in:asset_receivable,asset_cash,asset_current,asset_non_current,asset_prepayments,asset_fixed,liability_payable,liability_credit_card,liability_current,liability_non_current,equity,equity_unaffected,equity_retained,equity_current_year_earnings,income,income_other,expense,expense_depreciation,expense_direct_cost,off_balance',
            'acc_is_letterable' => 'nullable|boolean',
            'acc_is_active'     => 'nullable|boolean',
        ]);

        $validatedData['fk_usr_id_author'] = $request->user()->usr_id;
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;
        $validatedData['acc_is_letterable'] = $request->input('acc_is_letterable', false);
        $validatedData['acc_is_active'] = $request->input('acc_is_active', true);

        $account = AccountModel::create($validatedData);

        return response()->json([
            'message' => 'Compte comptable créé avec succès',
            'data' => $account->load(['author', 'updater']),
        ], 201);
    }

    /**
     * Update the specified account.
     */
    public function update(Request $request, $id)
    {
        $account = AccountModel::findOrFail($id);

        $validatedData = $request->validate([
            'acc_code'          => 'required|string|max:20|unique:account_account_acc,acc_code,' . $id . ',acc_id',
            'acc_label'         => 'required|string|max:255',
            'acc_type'          => 'required|string|in:asset_receivable,asset_cash,asset_current,asset_non_current,asset_prepayments,asset_fixed,liability_payable,liability_credit_card,liability_current,liability_non_current,equity,equity_unaffected,equity_retained,equity_current_year_earnings,income,income_other,expense,expense_depreciation,expense_direct_cost,off_balance',
            'acc_is_letterable' => 'nullable|boolean',
            'acc_is_active'     => 'nullable|boolean',
        ]);

        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;
        $validatedData['acc_is_letterable'] = $request->input('acc_is_letterable', false);
        $validatedData['acc_is_active'] = $request->input('acc_is_active', true);

        $account->update($validatedData);

        return response()->json([
            'message' => 'Compte comptable mis à jour avec succès',
            'data' => $account->load(['author', 'updater']),
        ]);
    }

    /**
     * Remove the specified account.
     */
    public function destroy($id)
    {
        $account = AccountModel::findOrFail($id);

        $account->delete();

        return response()->json([
            'message' => 'Compte comptable supprimé avec succès'
        ]);
    }

    public function options(Request $request)
    {

        $request->validate([
            'search'            => 'nullable|string|max:100',
            'acc_is_letterable' => 'nullable',
            'isActive'          => 'nullable',
            'type'              => 'nullable',
        ]);

        $query = AccountModel::select('acc_id as id', 'acc_label as label', 'acc_code as code', 'acc_type as type');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('acc_code', 'LIKE', "%{$search}%")
                  ->orWhere('acc_label', 'LIKE', "%{$search}%");
            });
        }

        if ($request->has('code')) {
            $codeFilter = $request->input('code', '');
            $query->where('acc_code', 'LIKE', $codeFilter);
        }

      /*  if ($request->has('acc_is_letterable')) {
            $acc_is_letterable = $request->input('acc_is_letterable', false);
            $query->where('acc_is_letterable', $acc_is_letterable);
        }*/

        if ($request->has('isLetterable')) {
            $acc_is_letterable = $request->input('isLetterable', false);
            $query->where('acc_is_letterable', $acc_is_letterable);
        }

        if ($request->has('isActive')) {
            $query->where('acc_is_active', filter_var($request->input('isActive'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('type')) {
            $types = (array) $request->input('type');
            $query->whereIn('acc_type', $types);
        }

        $data = $query->orderBy('acc_code', 'asc')->get();
        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Créer automatiquement un compte comptable pour un partenaire
     */
    public function createAutoAccount(Request $request)
    {
        $request->validate([
            'accountLabel' => 'required|string',
            'accountCode' => 'required|string|in:411%,401%'
        ]);

        // Déterminer le préfixe selon le type de compte
        $accountCode = $request->accountCode;
        $prefix = $accountCode === '401%' ? '401' : '411';
        $defaultCode = $accountCode === '401%' ? 401001 : 411001;

        // Récupérer le dernier compte avec ce préfixe
        $lastAccount = AccountModel::where('acc_code', 'LIKE', $prefix . '%')
            ->orderBy('acc_code', 'desc')
            ->first();

        // Générer le nouveau code
        $newCode = $lastAccount ? (intval($lastAccount->acc_code) + 1) : $defaultCode;

        // Créer le nouveau compte
        $account = AccountModel::create([
            'acc_code' => strval($newCode),
            'acc_label' => $request->accountLabel,
            'acc_is_letterable' => true
        ]);

        return response()->json([
            'status' => true,
            'message' => 'Account created successfully',
            'account' => [
                'id' => $account->acc_id,
                'label' => $account->acc_label,
                'code' => $account->acc_code
            ]
        ], 201);
    }


    /**
     * Récupérer la période d'écriture depuis la configuration
     *
     * @return JsonResponse
     */
    public function getWritingPeriod()
    {
        try {

            $period = AccountModel::getWritingPeriod();

            return response()->json([
                'writing_period' => $period['startDate'],
                'startDate' => $period['startDate'],
                'curExerciseId' => $period['curExerciseId'],
                'endDate' => $period['endDate'],
                'nextExerciseId' => $period['nextExerciseId'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => true,
                'message' => $e->getMessage()
            ], 400);
        }
    }
}
