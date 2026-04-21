<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountTaxModel;
use App\Models\AccountTaxRepartitionLineModel;
use App\Models\AccountConfigModel;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;

class ApiAccountTaxController extends Controller

{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'taxes';

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

        $query = AccountTaxModel::withCount('repartitionLines');

        $this->applyGridFilters($query, $request, [
            'tax_label'       => 'tax_label',
            'tax_rate'        => 'tax_rate',
            'tax_use'         => 'tax_use',
            'tax_exigibility' => 'tax_exigibility',
            'tax_scope'       => 'tax_scope',
            'tax_is_active'   => 'tax_is_active',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'        => 'tax_id',
            'tax_label' => 'tax_label',
            'tax_rate'  => 'tax_rate',
        ], 'tax_label', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'tax_label'),
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
     * Display the specified tax.
     */
    public function show($id)
    {
        $tax = AccountTaxModel::where('tax_id', $id)
            ->with([
                'author:usr_id,usr_firstname,usr_lastname',
                'updater:usr_id,usr_firstname,usr_lastname',
            ])
            ->firstOrFail();

        return response()->json([
            'status' => true,
            'data' => $tax
        ], 200);
    }

    /**
     * Store a newly created tax.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'tax_label'        => 'required|string|max:50',
            'tax_use'          => 'required|string|in:sale,purchase',
            'tax_rate'         => 'required|numeric|min:0|max:100',
            'tax_exigibility'  => 'required|string|in:on_invoice,on_payment',
            'tax_scope'        => 'required|string|in:conso,service,all',
            'tax_is_default'   => 'nullable|boolean',
            'tax_is_active'    => 'nullable|boolean',
            'tax_print_label' => 'required|string|max:50',
        ]);

        $validatedData['fk_usr_id_author'] = $request->user()->usr_id;
        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;
        $validatedData['tax_is_default'] = $request->input('tax_is_default', false);

        // Gérer la logique de tax_is_default
        $result = $this->handleDefaultTax($validatedData);
        if ($result['error']) {
            return response()->json([
                'message' => $result['message']
            ], 422);
        }
        $validatedData = $result['data'];

        $tax = AccountTaxModel::create($validatedData);

        return response()->json([
            'message' => 'Taxe créée avec succès',
            'data' => $tax->load(['author', 'updater']),
        ], 201);
    }

    /**
     * Update the specified tax.
     */
    public function update(Request $request, $id)
    {
        $tax = AccountTaxModel::findOrFail($id);

        $validatedData = $request->validate([
            'tax_label'       => 'required|string|max:50',
            'tax_print_label' => 'required|string|max:50',
            'tax_use'         => 'required|string|in:sale,purchase',
            'tax_rate'        => 'required|numeric|min:0|max:100',
            'tax_exigibility' => 'required|string|in:on_invoice,on_payment',
            'tax_scope'       => 'required|string|in:conso,service,all',
            'tax_is_default'  => 'nullable|boolean',
            'tax_is_active'   => 'nullable|boolean',
        ]);

        $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;
        $validatedData['tax_is_default'] = $request->input('tax_is_default', false);

        // Bloquer l'activation si les répartitions sont incomplètes
        if (!empty($validatedData['tax_is_active'])) {
            $requiredDocTypes = $tax->tax_use === 'sale'
                ? ['out_invoice', 'out_refund']
                : ['in_invoice', 'in_refund'];

            foreach ($requiredDocTypes as $docType) {
                $hasLine = $tax->repartitionLines()
                    ->where('trl_document_type', $docType)
                    ->exists();

                if (!$hasLine) {
                    $label = match ($docType) {
                        'out_invoice' => 'factures client',
                        'out_refund'  => 'avoirs client',
                        'in_invoice'  => 'factures fournisseur',
                        'in_refund'   => 'avoirs fournisseur',
                    };
                    return response()->json([
                        'message' => "Impossible d'activer cette taxe : aucune ventilation configurée pour les {$label}."
                    ], 422);
                }
            }
        }

        // Gérer la logique de tax_is_default
        $result = $this->handleDefaultTax($validatedData, $tax);
        if ($result['error']) {
            return response()->json([
                'message' => $result['message']
            ], 422);
        }
        $validatedData = $result['data'];


        // Nettoyer les lignes de ventilation si tax_use a changé
        if ($tax->tax_use !== $validatedData['tax_use']) {
            $deletePrefix = match ($validatedData['tax_use']) {
                'sale'     => 'in_%',
                'purchase' => 'out_%',
            };

            $tax->repartitionLines()
                ->where('trl_document_type', 'LIKE', $deletePrefix)
                ->delete();
        }

        $tax->update($validatedData);

        return response()->json([
            'message' => 'Taxe mise à jour avec succès',
            'data' => $tax->load(['author', 'updater']),
        ]);
    }

    /**
     * Gérer la logique de tax_is_default
     * - Une seule taxe par défaut par tax_use
     * - Si c'est la seule taxe du type, elle doit être par défaut
     */
    private function handleDefaultTax($taxData, $currentTax = null)
    {
        $taxType = $taxData['tax_use'];
        $isDefault = $taxData['tax_is_default'] ?? false;

        // Compter le nombre de taxes du même type (en excluant la taxe actuelle si update)
        $query = AccountTaxModel::where('tax_use', $taxType);
        if ($currentTax) {
            $query->where('tax_id', '!=', $currentTax->tax_id);
        }
        $countSameType = $query->count();

        // Si c'est la seule taxe de ce type, elle DOIT être par défaut
        if ($countSameType == 0) {
            $taxData['tax_is_default'] = true;
        }
        // Si on veut mettre cette taxe par défaut, retirer le défaut des autres
        elseif ($isDefault) {
            AccountTaxModel::where('tax_use', $taxType)
                ->where('tax_id', '!=', $currentTax?->tax_id)
                ->update(['tax_is_default' => false]);
        }
        // Si on essaie de retirer le défaut alors que c'est la seule par défaut
        elseif (!$isDefault && $currentTax && $currentTax->tax_is_default) {
            // Vérifier s'il y a au moins une autre taxe du même type
            if ($countSameType > 0) {
                return [
                    'error' => true,
                    'message' => 'Impossible de désactiver la taxe par défaut. Veuillez d\'abord définir une autre taxe comme par défaut pour ce type.'
                ];
            }
        }

        return ['error' => false, 'data' => $taxData];
    }

    /**
     * Remove the specified tax.
     */
    public function destroy($id)
    {
        $tax = AccountTaxModel::findOrFail($id);
        try {
            // Vérifier s'il existe d'autres taxes du même type
            $otherTaxesCount = AccountTaxModel::where('tax_use', $tax->tax_use)
                ->where('tax_id', '!=', $tax->tax_id)
                ->count();



            // Si on supprime une taxe par défaut et qu'il y en a d'autres du même type
            if ($tax->tax_is_default && $otherTaxesCount > 0) {
                // Définir la première autre taxe comme par défaut
                AccountTaxModel::where('tax_use', $tax->tax_use)
                    ->where('tax_id', '!=', $tax->tax_id)
                    ->orderBy('tax_label', 'asc')
                    ->first()
                    ->update(['tax_is_default' => true]);
            }


            // Supprimer les lignes de ventilation avant la taxe (contrainte FK)
            $tax->repartitionLines()->delete();

            $tax->delete();

            return response()->json([
                'message' => 'Taxe supprimée avec succès'
            ]);
        } catch (QueryException $e) {
            if ($e->getCode() === '23000' && str_contains($e->getMessage(), '1451')) {
                $code = $e->errorInfo[1]; // Code SQL 
                $table = null;

                // Extraire la table du message si tu veux
                preg_match("/foreign key constraint fails\s+\(`[^`]+`\.`([^`]+)`/i", $e->getMessage(), $matches);

                $table = $matches[1] ?? null;

                return response()->json([
                    'success' => false,
                    'code' => $code,
                    'table' => $table,
                    'message' => $e->getMessage(),
                ], 400);
            }

            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors de la suppression.'
            ], 500);
        }
    }

    /**
     * Retourne les repartition lines d'une taxe avec leurs tags.
     *
     * En régime TVA sur encaissements (aco_vat_regime = 'encaissements') et si la taxe
     * est exigible à l'encaissement (tax_exigibility = 'on_payment'), les lignes de type
     * 'tax' utilisent un compte d'attente TVA au lieu du compte définitif.
     * La réponse inclut is_on_payment + waiting_account pour que le frontend
     * puisse afficher le compte effectivement utilisé.
     */
    public function repartitionLines($id)
    {
        $tax = AccountTaxModel::findOrFail($id);

        $lines = $tax->repartitionLines()
            ->with([
                'account' => fn($q) => $q->select('acc_id', 'acc_code', 'acc_label'),
                'tags'    => fn($q) => $q->select('ttg_id', 'ttg_code', 'ttg_name'),
            ])
            ->get()
            ->map(fn($line) => array_merge($line->toArray(), [
                'ttg_ids' => $line->tags->pluck('ttg_id')->values(),
            ]));

        // Régime encaissements : détecter si la taxe est on_payment
        $isOnPayment = false;
        $waitingAccount = null;

        $config = AccountConfigModel::with([
            'saleVatWaitingAccount',
            'purchaseVatWaitingAccount',
        ])->find(1);


        if (
            $config && $config->aco_vat_regime === 'encaissements'
            && $tax->tax_exigibility === 'on_payment'
        ) {
            $isOnPayment = true;

            // Sélectionner le compte d'attente selon le sens de la taxe (vente / achat)
            $waitingAccModel = $tax->tax_use === 'sale'
                ? $config->saleVatWaitingAccount
                : $config->purchaseVatWaitingAccount;

            if ($waitingAccModel) {
                $waitingAccount = [
                    'acc_id'    => $waitingAccModel->acc_id,
                    'acc_code'  => $waitingAccModel->acc_code,
                    'acc_label' => $waitingAccModel->acc_label,
                ];
            }
        }

        return response()->json([
            'data'            => $lines,
            'tax_rate'        => $tax->tax_rate,
            'is_on_payment'   => $isOnPayment,
            'waiting_account' => $waitingAccount,
        ]);
    }

    /**
     * Remplace toutes les repartition lines d'une taxe (delete + recreate).
     *
     * Payload attendu :
     * [
     *   {
     *     "trl_document_type": "in_invoice",
     *     "trl_repartition_type": "base",
     *     "trl_factor_percent": 100,
     *     "fk_acc_id": null,
     *     "ttg_ids": [11, 14],     *    
     *   },
     *   ...
     * ]
     */
    public function saveRepartitionLines(Request $request, $id)
    {
        $tax = AccountTaxModel::findOrFail($id);

        $validated = $request->validate([
            'lines'                        => 'required|array',
            'lines.*.trl_document_type'    => 'required|string|in:in_invoice,in_refund,out_invoice,out_refund',
            'lines.*.trl_repartition_type' => 'required|string|in:base,tax',
            'lines.*.trl_factor_percent'   => 'nullable|numeric|min:-100|max:100',
            'lines.*.fk_acc_id'            => 'nullable|integer|exists:account_account_acc,acc_id',
            'lines.*.ttg_ids'              => 'nullable|array',
            'lines.*.ttg_ids.*'            => 'integer|exists:account_tax_tag_ttg,ttg_id',

        ]);

        // Vérifier qu'au moins une ligne existe pour chaque type de document requis
        $requiredDocTypes = $tax->tax_use === 'sale'
            ? ['out_invoice', 'out_refund']
            : ['in_invoice', 'in_refund'];

        $linesByDocType = collect($validated['lines'])->groupBy('trl_document_type');

        foreach ($requiredDocTypes as $docType) {
            if (empty($linesByDocType[$docType])) {
                $label = match ($docType) {
                    'out_invoice' => 'factures client',
                    'out_refund'  => 'avoirs client',
                    'in_invoice'  => 'factures fournisseur',
                    'in_refund'   => 'avoirs fournisseur',
                };
                return response()->json([
                    'message' => "La ventilation doit comporter au moins une ligne pour les {$label}."
                ], 422);
            }
        }

        try {
            DB::transaction(function () use ($tax, $validated) {
                $tax->repartitionLines()->delete();

                foreach ($validated['lines'] as $lineData) {
                    $line = AccountTaxRepartitionLineModel::create([
                        'fk_tax_id'            => $tax->tax_id,
                        'trl_document_type'    => $lineData['trl_document_type'],
                        'trl_repartition_type' => $lineData['trl_repartition_type'],
                        'trl_factor_percent'   => $lineData['trl_factor_percent'] ?? 100,
                        'fk_acc_id'            => $lineData['fk_acc_id'] ?? null,
                    ]);

                    if (!empty($lineData['ttg_ids'])) {
                        $line->tags()->attach($lineData['ttg_ids']);
                    }
                }
            });
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        // Recharger et retourner les lignes mises à jour
        $lines = $tax->repartitionLines()
            ->with([
                'account' => fn($q) => $q->select('acc_id', 'acc_code', 'acc_label'),
                'tags'    => fn($q) => $q->select('ttg_id', 'ttg_code', 'ttg_name'),
            ])
            ->get()
            ->map(fn($line) => array_merge($line->toArray(), [
                'ttg_ids' => $line->tags->pluck('ttg_id')->values(),
            ]));

        return response()->json([
            'message' => 'Ventilation comptable enregistrée avec succès',
            'data'    => $lines,
        ]);
    }

    public function options(Request $request)
    {
        $request->validate([
            'search'          => 'nullable|string|max:100',
            'tax_use'         => 'nullable|string|in:sale,purchase',
            'tax_exigibility' => 'nullable|string|in:on_invoice,on_payment',
            'tax_is_active'   => 'nullable|boolean',
            'tax_scope'    => 'nullable|string|in:conso,service',
            'fk_tap_id'       => 'nullable|integer|exists:account_tax_position_tap,tap_id',
        ]);

        $query = AccountTaxModel::select('tax_id as id', 'tax_label as label', 'tax_is_default as default')
            ->distinct();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('tax_label', 'LIKE', "%{$search}%");
        }

        if ($request->filled('tax_use')) {
            $query->where('tax_use', $request->tax_use);
        }

        if ($request->filled('tax_exigibility')) {
            $query->where('tax_exigibility', $request->tax_exigibility);
        }

        if ($request->filled('tax_is_active')) {
            $query->where('tax_is_active', filter_var($request->input('tax_is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('tax_scope')) {
            $query->whereIn('tax_scope', ['all', $request->input('tax_scope')]);
        }

        // Gérer le filtrage selon la position fiscale

        if ($request->has('fk_tap_id') && !empty($request->fk_tap_id)) {
            // Cas 2: fk_tap_id est fourni
            // Afficher uniquement les taxes qui ONT une correspondance
            $query->join('account_tax_position_correspondence_tac as tac', function ($join) use ($request) {
                $join->on('account_tax_tax.tax_id', '=', 'tac.fk_tax_id_target')
                    ->where('tac.fk_tap_id', '=', $request->fk_tap_id);
            });
        } else {
            // Cas 1: fk_tap_id est vide/null
            // Afficher les taxes qui N'ONT PAS de correspondance
            // $query->leftJoin('account_tax_position_correspondence_tac as tac', 'account_tax_tax.tax_id', '=', 'tac.fk_tax_id_target')
            //    ->whereNull('tac.fk_tap_id');
        }


        $data = $query->orderBy('tax_label', 'asc')->get();

        return response()->json([
            'data' => $data
        ]);
    }
}
