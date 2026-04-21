<?php

namespace App\Http\Controllers\Api;

use App\Models\AccountTaxTagModel;
use Illuminate\Http\Request;

class ApiAccountTaxTagController extends Controller
{
    /**
     * Liste simplifiée pour les selects (id + label + code).
     */
    public function options()
    {
        $data = AccountTaxTagModel::select('ttg_id as id', 'ttg_name as label', 'ttg_code')
            ->orderBy('ttg_code')
            ->get();

        return response()->json(['data' => $data]);
    }
}
