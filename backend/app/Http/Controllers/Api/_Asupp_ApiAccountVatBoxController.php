<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountModel;
use App\Models\VatBoxModel;
use Illuminate\Http\Request;

class ApiAccountVatBoxController extends Controller
{
    /**
     * GET /api/vat-boxes?regime=reel
     *
     * Retourne la liste plate des cases de déclaration pour un régime donné.
     * La construction de l'arbre est faite côté frontend.
     */
    public function index(Request $request)
    {
        $regime = $request->query('regime', 'reel');

        $boxes = VatBoxModel::forRegime($regime)->get([
            'vbx_id',
            'vbx_code',
            'vbx_label',
            'vbx_edi_code',
            'fk_vbx_id_parent',
            'vbx_regime',
            'vbx_is_title',
            'vbx_default_accounts',
            'vbx_accounts',
            'vbx_order',
        ]);

        return response()->json(['status' => true, 'data' => $boxes]);
    }

    /**
     * PUT /api/vat-boxes/accounts
     *
     * Sauvegarde batch du mapping configuré par l'administrateur.
     *
     * Body : [{"vbx_id": 5, "accounts": [{"type":"account","acc_id":123}, {"type":"prefix","value":"4472"}]}, ...]
     */
    public function updateAccounts(Request $request)
    {
        $items = $request->validate([
            '*'                    => 'array',
            '*.vbx_id'             => 'required|integer|exists:vat_box_vbx,vbx_id',
            '*.accounts'           => 'required|array',
            '*.accounts.*.type'    => 'required|in:account,prefix',
            '*.accounts.*.acc_id'  => 'required_if:*.accounts.*.type,account|integer|exists:account_account_acc,acc_id',
            '*.accounts.*.value'   => 'required_if:*.accounts.*.type,prefix|string|max:20',
        ]);

        foreach ($items as $item) {
            $box = VatBoxModel::find($item['vbx_id']);
            if (!$box) continue;

            // Vérifier que la box est mappable et non verrouillée
            if (!$box->isMappable() || $box->vbx_is_title) continue;

            // Valider les acc_id individuellement (la validation tableau imbriqué de Laravel peut être capricieuse)
            $cleanAccounts = [];
            foreach ($item['accounts'] as $entry) {
                if ($entry['type'] === 'account') {
                    if (!AccountModel::where('acc_id', $entry['acc_id'])->exists()) continue;
                    $cleanAccounts[] = ['type' => 'account', 'acc_id' => (int)$entry['acc_id']];
                } elseif ($entry['type'] === 'prefix') {
                    $cleanAccounts[] = ['type' => 'prefix', 'value' => $entry['value']];
                }
            }

            // null = réinitialiser aux défauts
            $box->vbx_accounts = empty($cleanAccounts) ? null : $cleanAccounts;
            $box->save();
        }

        return response()->json(['status' => true, 'message' => 'Mapping enregistré.']);
    }
}
