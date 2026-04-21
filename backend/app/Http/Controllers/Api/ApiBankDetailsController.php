<?php

namespace App\Http\Controllers\Api;

use App\Models\BankDetailsModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ApiBankDetailsController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $offset = $request->input('offset', 0);
        $limit = $request->input('limit', 50);
        $search = $request->input('search', '');
        $sort = $request->input('sort', 'bts_label ASC');

        // Filtres optionnels par entité
        $fk_ptr_id = $request->input('fk_ptr_id');
        $fk_cop_id = $request->input('fk_cop_id');

        $query = BankDetailsModel::query();

        // Filtrer par partner ou company
        if ($fk_ptr_id) {
            $query->where('fk_ptr_id', $fk_ptr_id);
        }
        if ($fk_cop_id) {
            $query->where('fk_cop_id', $fk_cop_id);
        }

        // Appliquer la recherche si présente
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('bts_label', 'like', "%{$search}%")
                    ->orWhere('bts_iban', 'like', "%{$search}%")
                    ->orWhere('bts_bic', 'like', "%{$search}%");
            });
        }

        $total = $query->count();

        // Appliquer le tri
        if (!empty($sort)) {
            $sortParts = explode(',', $sort);
            foreach ($sortParts as $sortPart) {
                $sortPart = trim($sortPart);
                $parts = explode(' ', $sortPart);
                $field = $parts[0];
                $direction = isset($parts[1]) ? strtoupper($parts[1]) : 'ASC';
                $query->orderBy($field, $direction);
            }
        }

        $data = $query->with(['author:usr_id,usr_firstname,usr_lastname'])
            ->offset($offset)
            ->limit($limit)
            ->get();

        // Ajouter l'ID comme attribut pour la compatibilité avec le frontend
        $data->transform(function ($item) {
            $item->id = $item->bts_id;
            return $item;
        });

        return response()->json([
            'data' => $data,
            'total' => $total
        ]);
    }

    /**
     * Retourne la liste des banques pour les selects
     */
    public function options(Request $request)
    {
        $fk_ptr_id = $request->input('fk_ptr_id');
        $fk_cop_id = $request->input('fk_cop_id');

        $query = BankDetailsModel::select('bts_id as id', 'bts_label as label', 'bts_is_default as default');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('bts_label', 'LIKE', "%{$search}%");
        }

        if ($fk_ptr_id) {
            $query->where('fk_ptr_id', $fk_ptr_id);
        }
        if ($fk_cop_id) {
            $query->where('fk_cop_id', $fk_cop_id);
        }

        $data = $query->orderBy('bts_label', 'asc')->get();

        return response()->json([
            'data' => $data
        ]);
    }


    /**
     * Récupérer les détails bancaires d'une société
     * @param int $companyId - ID de la société
     */
    public function getByCompany(Request $request,$companyId)
    {
         $request->merge(['fk_cop_id' => $companyId]);
         return $this->options($request);
    }
    /**
     * Récupérer un compte bancaire spécifique
     */
    public function show($id)
    {
        $bankDetail = BankDetailsModel::with(['account:acc_id,acc_code,acc_label'])
            ->findOrFail($id);

        return response()->json([
            'data' => $bankDetail
        ], 200);
    }

    /**
     * Créer un compte bancaire
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'bts_label' => 'required|string|max:100',
            'bts_iban' => 'required|string|max:34',
            'bts_bic' => 'required|string|max:11',
            'bts_bnal_address' => 'required|string|max:255',
            'bts_bank_code' => 'nullable|string|max:10',
            'bts_sort_code' => 'nullable|string|max:10',
            'bts_account_nbr' => 'nullable|string|max:20',
            'bts_bban_key' => 'nullable|string|max:2',
            'fk_ptr_id' => 'nullable|integer|exists:partner_ptr,ptr_id',
            'fk_cop_id' => 'nullable|integer|exists:company_cop,cop_id',
            'fk_acc_id' => 'nullable|integer|exists:account_account_acc,acc_id',
            'bts_is_active' => 'boolean',
            'bts_is_default' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();

        try {
            // Si on définit cette banque comme défaut, retirer le défaut des autres
            if ($request->input('bts_is_default', false)) {
                if ($request->fk_ptr_id) {
                    BankDetailsModel::where('fk_ptr_id', $request->fk_ptr_id)
                        ->update(['bts_is_default' => 0]);
                } elseif ($request->fk_cop_id) {
                    BankDetailsModel::where('fk_cop_id', $request->fk_cop_id)
                        ->update(['bts_is_default' => 0]);
                }
            }

            $bankDetail = BankDetailsModel::create([
                'bts_label' => $request->bts_label,
                'bts_iban' => $request->bts_iban,
                'bts_bic' => $request->bts_bic,
                'bts_bnal_address' => $request->bts_bnal_address,
                'bts_bank_code' => $request->bts_bank_code,
                'bts_sort_code' => $request->bts_sort_code,
                'bts_account_nbr' => $request->bts_account_nbr,
                'bts_bban_key' => $request->bts_bban_key,
                'fk_ptr_id' => $request->fk_ptr_id,
                'fk_cop_id' => $request->fk_cop_id,
                'fk_acc_id' => $request->fk_acc_id,
                'bts_is_active' => $request->input('bts_is_active', true),
                'bts_is_default' => $request->input('bts_is_default', false),
                'fk_usr_id_author' => $userId,
            ]);

            return response()->json([
                'data' => $bankDetail
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mettre à jour un compte bancaire
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'bts_label' => 'required|string|max:100',
            'bts_iban' => 'required|string|max:34',
            'bts_bic' => 'required|string|max:11',
            'bts_bnal_address' => 'required|string|max:255',
            'bts_bank_code' => 'nullable|string|max:10',
            'bts_sort_code' => 'nullable|string|max:10',
            'bts_account_nbr' => 'nullable|string|max:20',
            'bts_bban_key' => 'nullable|string|max:2',
            'fk_ptr_id' => 'nullable|integer|exists:partner_ptr,ptr_id',
            'fk_cop_id' => 'nullable|integer|exists:company_cop,cop_id',
            'fk_acc_id' => 'nullable|integer|exists:account_account_acc,acc_id',
            'bts_is_active' => 'boolean',
            'bts_is_default' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();

        try {
            $bankDetail = BankDetailsModel::findOrFail($id);

            // Si on définit cette banque comme défaut, retirer le défaut des autres
            if ($request->input('bts_is_default', false)) {
                if ($bankDetail->fk_ptr_id) {
                    BankDetailsModel::where('fk_ptr_id', $bankDetail->fk_ptr_id)
                        ->where('bts_id', '!=', $id)
                        ->update(['bts_is_default' => 0]);
                } elseif ($bankDetail->fk_cop_id) {
                    BankDetailsModel::where('fk_cop_id', $bankDetail->fk_cop_id)
                        ->where('bts_id', '!=', $id)
                        ->update(['bts_is_default' => 0]);
                }
            }

            $bankDetail->update([
                'bts_label' => $request->bts_label,
                'bts_iban' => $request->bts_iban,
                'bts_bic' => $request->bts_bic,
                'bts_bnal_address' => $request->bts_bnal_address,
                'bts_bank_code' => $request->bts_bank_code,
                'bts_sort_code' => $request->bts_sort_code,
                'bts_account_nbr' => $request->bts_account_nbr,
                'bts_bban_key' => $request->bts_bban_key,
                'fk_acc_id' => $request->fk_acc_id,
                'bts_is_active' => $request->input('bts_is_active', true),
                'bts_is_default' => $request->input('bts_is_default', false),
                'fk_usr_id_updater' => $userId,
            ]);

            return response()->json([
                'data' => $bankDetail
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer un compte bancaire
     */
    public function destroy($id)
    {
        try {
            $bankDetail = BankDetailsModel::findOrFail($id);

            // Vérifier si c'est la banque par défaut
            if ($bankDetail->bts_is_default) {
                return response()->json([
                    'success' => false,
                    'message' => 'Impossible de supprimer la banque par défaut'
                ], 422);
            }

            $bankDetail->delete();

            return response()->json([
                'success' => true,
                'message' => 'Compte bancaire supprimé avec succès'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validation IBAN avec extraction des composants BBAN
     */
    public function validateIban(Request $request)
    {
        $iban = $request->input('iban');

        if (empty($iban)) {
            return response()->json([
                'success' => false,
                'message' => 'IBAN requis'
            ], 422);
        }

        // Nettoyer l'IBAN (retirer espaces et convertir en majuscules)
        $iban = strtoupper(str_replace(' ', '', $iban));

        // Vérifier la longueur minimale
        if (strlen($iban) < 15) {
            return response()->json([
                'success' => false,
                'message' => 'IBAN trop court'
            ], 422);
        }

        // Extraire le code pays
        $countryCode = substr($iban, 0, 2);

        // Codes pays et leurs longueurs IBAN
        $ibanLengths = [
            'AD' => 24,
            'AE' => 23,
            'AL' => 28,
            'AT' => 20,
            'AZ' => 28,
            'BA' => 20,
            'BE' => 16,
            'BG' => 22,
            'BH' => 22,
            'BR' => 29,
            'BY' => 28,
            'CH' => 21,
            'CR' => 22,
            'CY' => 28,
            'CZ' => 24,
            'DE' => 22,
            'DK' => 18,
            'DO' => 28,
            'EE' => 20,
            'EG' => 29,
            'ES' => 24,
            'FI' => 18,
            'FO' => 18,
            'FR' => 27,
            'GB' => 22,
            'GE' => 22,
            'GI' => 23,
            'GL' => 18,
            'GR' => 27,
            'GT' => 28,
            'HR' => 21,
            'HU' => 28,
            'IE' => 22,
            'IL' => 23,
            'IS' => 26,
            'IT' => 27,
            'JO' => 30,
            'KW' => 30,
            'KZ' => 20,
            'LB' => 28,
            'LC' => 32,
            'LI' => 21,
            'LT' => 20,
            'LU' => 20,
            'LV' => 21,
            'MC' => 27,
            'MD' => 24,
            'ME' => 22,
            'MK' => 19,
            'MR' => 27,
            'MT' => 31,
            'MU' => 30,
            'NL' => 18,
            'NO' => 15,
            'PK' => 24,
            'PL' => 28,
            'PS' => 29,
            'PT' => 25,
            'QA' => 29,
            'RO' => 24,
            'RS' => 22,
            'SA' => 24,
            'SE' => 24,
            'SI' => 19,
            'SK' => 24,
            'SM' => 27,
            'TN' => 24,
            'TR' => 26,
            'UA' => 29,
            'VA' => 22,
            'VG' => 24,
            'XK' => 20
        ];

        // Vérifier si le code pays est valide
        if (!isset($ibanLengths[$countryCode])) {
            return response()->json([
                'success' => false,
                'message' => 'Code pays invalide'
            ], 422);
        }

        // Vérifier la longueur
        if (strlen($iban) != $ibanLengths[$countryCode]) {
            return response()->json([
                'success' => false,
                'message' => 'Longueur IBAN incorrecte pour ce pays'
            ], 422);
        }

        // Validation algorithmique (modulo 97)
        if (!$this->validateIbanChecksum($iban)) {
            return response()->json([
                'success' => false,
                'message' => 'Clé de contrôle IBAN invalide'
            ], 422);
        }

        // Extraire les composants BBAN (spécifique à la France)
        $bbanComponents = $this->extractBbanComponents($iban, $countryCode);

        // Formater l'IBAN (espaces tous les 4 caractères)
        $formatted = implode(' ', str_split($iban, 4));

        // Nom complet du pays
        $countryNames = [
            'FR' => 'France',
            'DE' => 'Allemagne',
            'IT' => 'Italie',
            'ES' => 'Espagne',
            'BE' => 'Belgique',
            'NL' => 'Pays-Bas',
            'PT' => 'Portugal',
            'GB' => 'Royaume-Uni',
            'CH' => 'Suisse',
            'AT' => 'Autriche',
            'PL' => 'Pologne',
            'SE' => 'Suède'
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'formatted' => $formatted,
                'country_code' => $countryCode,
                'country_name' => $countryNames[$countryCode] ?? $countryCode,
                'bank_code' => $bbanComponents['bank_code'] ?? '',
                'sort_code' => $bbanComponents['sort_code'] ?? '',
                'account_nbr' => $bbanComponents['account_nbr'] ?? '',
                'bban_key' => $bbanComponents['bban_key'] ?? '',
            ]
        ], 200);
    }

    /**
     * Valider la clé de contrôle IBAN (modulo 97)
     */
    private function validateIbanChecksum($iban)
    {
        // Déplacer les 4 premiers caractères à la fin
        $rearranged = substr($iban, 4) . substr($iban, 0, 4);

        // Convertir les lettres en chiffres (A=10, B=11, ..., Z=35)
        $numeric = '';
        for ($i = 0; $i < strlen($rearranged); $i++) {
            $char = $rearranged[$i];
            if (ctype_alpha($char)) {
                $numeric .= (ord($char) - ord('A') + 10);
            } else {
                $numeric .= $char;
            }
        }

        // Calculer le modulo 97
        return bcmod($numeric, '97') === '1';
    }

    /**
     * Extraire les composants BBAN (Basic Bank Account Number)
     * Spécifique à chaque pays, ici implémentation pour la France
     */
    private function extractBbanComponents($iban, $countryCode)
    {
        $components = [];

        if ($countryCode === 'FR') {
            // France: FR + 2 chiffres clé + 5 code banque + 5 code guichet + 11 numéro compte + 2 clé RIB
            // Format: FRkk BBBB BGGG GGCC CCCC CCCC Ckk
            $bban = substr($iban, 4); // Retirer "FRkk"

            $components['bank_code'] = substr($bban, 0, 5);      // 5 chiffres
            $components['sort_code'] = substr($bban, 5, 5);      // 5 chiffres
            $components['account_nbr'] = substr($bban, 10, 11);  // 11 caractères
            $components['bban_key'] = substr($bban, 21, 2);      // 2 chiffres
        }
        // Ajouter d'autres pays si nécessaire

        return $components;
    }

    /**
     * Récupérer les détails bancaires d'un partenaire
     * @param int $partnerId - ID du partenaire
     */
    public function getByPartner($partnerId)
    {
        $data = BankDetailsModel::where('fk_ptr_id', $partnerId)
            ->get()
            ->transform(function ($item) {
                $item->id = $item->bts_id;
                return $item;
            });

        return response()->json([
            'data' => $data
        ]);
    }
}
