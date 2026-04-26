<?php

namespace App\Http\Controllers\Api;

use App\Models\CountryModel;

class ApiCountryController extends Controller
{
    public function index()
    {
        $countries = CountryModel::orderBy('cty_name')->get(['cty_code', 'cty_name', 'cty_is_eu']);

        return response()->json([
            'status' => true,
            'data'   => $countries,
        ]);
    }
}
