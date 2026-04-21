<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\PartnerModel;


class ApiPartnerController extends Controller
{
    use \App\Traits\HasGridFilters;

    /**
     * Applique un scope sur la query selon les droits de l'utilisateur.
     * - partners.view → pas de restriction
     * - sinon, on filtre sur les types autorisés (OR)
     */
    private function applyPermissionScope($query, string $permissionAction = 'view'): void
    {
        $user = auth()->user();

        if ($user->can("partners.{$permissionAction}")) {
            return; // Accès total, pas de filtre
        }

        $query->where(function ($q) use ($user, $permissionAction) {
            $hasAny = false;

            if ($user->can("customers.{$permissionAction}")) {
                $q->orWhere('ptr_is_customer', 1);
                $hasAny = true;
            }
            if ($user->can("suppliers.{$permissionAction}")) {
                $q->orWhere('ptr_is_supplier', 1);
                $hasAny = true;
            }
            if ($user->can("prospects.{$permissionAction}")) {
                $q->orWhere('ptr_is_prospect', 1);
                $hasAny = true;
            }

            // Sécurité : si aucun droit, on retourne rien
            if (!$hasAny) {
                $q->whereRaw('1 = 0');
            }
        });
    }

    /**
     * Display a listing of the resource.
     * Support de la pagination serveur et du tri pour optimiser le chargement de grandes tables
     */
    public function index(Request $request, string $gridKey = null)
    {
        // --- Gestion des grid settings ---
        if ($gridKey && !$request->has('sort_by')) {
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

        $columnMap = [
            'id' => 'partner_ptr.ptr_id',
            'ptr_name' => 'ptr_name',
            'ptr_city' => 'ptr_city',
            'ptr_phone' => 'ptr_phone',
            'ptr_email' => 'ptr_email',
            'seller_name' => DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname)"),
            'opp_count' => 'opp_count',
            'pipeline_amount' => 'pipeline_amount',
        ];

        $query = PartnerModel::select([
            'partner_ptr.ptr_id as id',
            'ptr_name',
            'ptr_city',
            'ptr_phone',
            'ptr_email',
            DB::raw("CONCAT(seller.usr_firstname, ' ', seller.usr_lastname) as seller_name"),
            DB::raw("(SELECT COUNT(*) FROM prospect_opportunity_opp WHERE prospect_opportunity_opp.fk_ptr_id = partner_ptr.ptr_id) as opp_count"),
            DB::raw("(SELECT COALESCE(SUM(opp_amount), 0) FROM prospect_opportunity_opp opp2
                    INNER JOIN prospect_pipeline_stage_pps pps ON opp2.fk_pps_id = pps.pps_id
                    WHERE opp2.fk_ptr_id = partner_ptr.ptr_id AND pps.pps_is_won = 0 AND pps.pps_is_lost = 0) as pipeline_amount"),
        ])
            ->leftJoin('user_usr as seller', 'partner_ptr.fk_usr_id_seller', '=', 'seller.usr_id');

        // Filtres de type (injectés par indexCustomers / indexSuppliers / indexProspects)
        if ($request->input('ptr_is_customer')) {
            $query->where('ptr_is_customer', 1);
        }
        if ($request->input('ptr_is_supplier')) {
            $query->where('ptr_is_supplier', 1);
        }
        if ($request->input('ptr_is_prospect')) {
            $query->where('ptr_is_prospect', 1);
        }

        // 🔐 Filtre selon les droits de l'utilisateur
        $this->applyPermissionScope($query);

        $this->applyGridFilters($query, $request, $columnMap);

        $total = $query->count();

        $this->applyGridSort($query, $request, $columnMap, 'ptr_name', 'ASC');
        $this->applyGridPagination($query, $request);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'ptr_name'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        if ($gridKey) {
            $this->saveGridSettings($gridKey, $currentSettings);
        }

        return response()->json([
            'data'         => $query->get(),
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Affiche la liste des clients
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexPartners(Request $request)
    {
        return $this->index($request, 'partners');
    }

    public function indexCustomers(Request $request)
    {
        $request->merge(['ptr_is_customer' => '1']);
        return $this->index($request, 'customers');
    }


    /**
     * Affiche la liste des fournisseurs
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function indexSuppliers(Request $request)
    {
        $request->merge(['ptr_is_supplier' => '1']);
        return $this->index($request, 'suppliers');
    }

    /**
     * Affiche la liste des prospects avec stats agrégées (nb opportunités, montant pipeline)
     */
    public function indexProspects(Request $request)
    {
        $request->merge(['ptr_is_prospect' => '1']);
        return $this->index($request, 'prospects');
    }

    /**
     * Retourne le préfixe de permission selon la nature du partenaire
     */
    private function getPermissionPrefix(PartnerModel $partner)
    {
        if ($partner->ptr_is_customer) return 'customers';
        if ($partner->ptr_is_supplier) return 'suppliers';
        if ($partner->ptr_is_prospect) return 'prospects';
        return 'partners';
    }

    /**
     * Récupère les partenaires sous forme d'options pour un Select
     * Support des filtres : is_customer, is_supplier, is_prospect, is_active
     * Support des filtres OR : OR[is_customer]=1&OR[is_prospect]=1
     */
    public function options(Request $request)
    {

        $query = PartnerModel::select('ptr_id as id', 'ptr_name as label');
        $user = auth()->user();

        $this->applyPermissionScope($query);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('ptr_name', 'LIKE', "%{$search}%");
        }

        // Filtres optionnels (AND)
         if ($request->has('is_customer') && !$request->has('OR')) {
            $query->where('ptr_is_customer', (int) $request->input('is_customer'));
        }

        if ($request->has('is_supplier') && !$request->has('OR')) {
            $query->where('ptr_is_supplier', (int) $request->input('is_supplier'));
        }

        if ($request->has('is_prospect') && !$request->has('OR')) {
            $query->where('ptr_is_prospect', (int) $request->input('is_prospect'));
        }

        if ($request->has('is_active')) {
            $query->where('ptr_is_active', (int) $request->input('is_active'));
        }

        // Gestion des filtres OR
        if ($request->has('OR')) {
            $orFilters = $request->input('OR');

            $query->where(function ($q) use ($orFilters) {
                foreach ($orFilters as $field => $value) {
                    if ($field === 'is_customer') {
                        $q->orWhere('ptr_is_customer', (int) $value);
                    } elseif ($field === 'is_supplier') {
                        $q->orWhere('ptr_is_supplier', (int) $value);
                    } elseif ($field === 'is_prospect') {
                        $q->orWhere('ptr_is_prospect', (int) $value);
                    }
                }
            });
        }

        $data = $query->orderBy('ptr_name', 'asc')->get();

        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Vérifie que l'utilisateur peut écrire sur un partenaire selon son type.
     * Pour le store, on passe les flags depuis $request directement.
     * Pour le update, on passe le modèle existant + les nouvelles valeurs de $request.
     */
    private function authorizePartnerWrite(array $types, string $action = 'edit'): void
    {
        $user = auth()->user();

        // Accès global
        if ($user->can("partners.{$action}")) {
            return;
        }

        // Vérification par type demandé
        $permissionMap = [
            'customer' => "customers.{$action}",
            'supplier' => "suppliers.{$action}",
            'prospect' => "prospects.{$action}",
        ];

        foreach ($types as $type) {
            if (isset($permissionMap[$type]) && $user->can($permissionMap[$type])) {
                return;
            }
        }

        abort(403, "Vous n'avez pas les droits nécessaires pour effectuer cette action.");
    }

    /**
     * Extrait les types depuis une Request (store ou update)
     * ex: ['customer', 'prospect']
     */
    private function getTypesFromRequest(Request $request, ?PartnerModel $existing = null): array
    {
        $types = [];

        // On fusionne les valeurs existantes (update) avec les nouvelles (request)
        // Si le champ n'est pas dans la request, on prend la valeur existante du modèle
        $isCustomer = $request->has('ptr_is_customer')
            ? (int) $request->input('ptr_is_customer')
            : ($existing?->ptr_is_customer ?? 0);

        $isSupplier = $request->has('ptr_is_supplier')
            ? (int) $request->input('ptr_is_supplier')
            : ($existing?->ptr_is_supplier ?? 0);

        $isProspect = $request->has('ptr_is_prospect')
            ? (int) $request->input('ptr_is_prospect')
            : ($existing?->ptr_is_prospect ?? 0);

        if ($isCustomer) $types[] = 'customer';
        if ($isSupplier) $types[] = 'supplier';
        if ($isProspect) $types[] = 'prospect';

        return $types;
    }

    /**
     * Display the specified tax.
     */
    public function show($id)
    {
        $partner = PartnerModel::withCount(['documents', 'opportunities', 'prospectActivities'])
            ->with([
                'customerPaymentMode:pam_id,pam_label',
                'supplierPaymentMode:pam_id,pam_label',
                'supplierPaymentCondition:dur_id,dur_label',
                'customerPaymentCondition:dur_id,dur_label',
                'customerAccount:acc_id,acc_label,acc_code',
                'supplierAccount:acc_id,acc_label,acc_code',
                'seller' => function ($query) {
                    // Pour utiliser CONCAT, on doit utiliser selectRaw
                    // Note: usr_id doit être inclus pour que la relation puisse se faire
                    $query->selectRaw("usr_id, TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label");
                }
            ])
            ->where('ptr_id', $id)->firstOrFail();

        // 2. Vérification dynamique des permissions
        $types = $this->getTypesFromRequest(new Request(), $partner);
        $this->authorizePartnerWrite($types, 'view');

        if (!$partner) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }
        return response()->json([
            'status' => true,
            'data' => $partner
        ], 200);
    }

    public function store(Request $request)
    {
        $request->validate([
            'ptr_name'                              => 'required|string|max:100|unique:partner_ptr,ptr_name',
            'ptr_address'                           => 'nullable|string|max:500',
            'ptr_zip'                               => 'nullable|string|max:10',
            'ptr_city'                              => 'nullable|string|max:45',
            'ptr_country'                           => 'nullable|string|max:45',
            'ptr_phone'                             => 'nullable|string|max:20',
            'ptr_email'                             => 'nullable|email|max:320',
            'fk_usr_id_seller'                      => 'nullable|integer|exists:user_usr,usr_id',
            'ptr_is_active'                         => 'nullable|boolean',
            'ptr_is_customer'                       => 'nullable|boolean',
            'ptr_is_supplier'                       => 'nullable|boolean',
            'ptr_is_prospect'                       => 'nullable|boolean',
            'ptr_notes'                             => 'nullable|string|max:255',
            'ptr_vat_number'                        => 'nullable|string|max:20',
            'ptr_siren'                             => 'nullable|string|max:14',
            'usr_id_referenttech'                   => 'nullable|integer|exists:user_usr,usr_id',
            'fk_pam_id_customer'                    => 'nullable|integer|exists:payment_mode_pam,pam_id',
            'fk_dur_id_payment_condition_customer'  => 'nullable|integer|exists:duration_dur,dur_id',
            'fk_pam_id_supplier'                    => 'nullable|integer|exists:payment_mode_pam,pam_id',
            'fk_dur_id_payment_condition_supplier'  => 'nullable|integer|exists:duration_dur,dur_id',
            'fk_acc_id_customer'                    => 'nullable|integer|exists:account_account_acc,acc_id',
            'fk_acc_id_supplier'                    => 'nullable|integer|exists:account_account_acc,acc_id',
            'ptr_account_auxiliary_customer'        => 'nullable|string|max:8|unique:partner_ptr,ptr_account_auxiliary_customer',
            'ptr_account_auxiliary_supplier'        => 'nullable|string|max:8|unique:partner_ptr,ptr_account_auxiliary_supplier',
            'ptr_customer_note'                     => 'nullable|string|max:255',
            'fk_tap_id'                             => 'nullable|integer|exists:account_tax_position_tap,tap_id',
            'ptr_prospect_description'              => 'nullable|string',
            'ptr_linkedin_url'                      => 'nullable|string|max:2048',
            'ptr_pappers_url'                       => 'nullable|string|max:2048',
            'ptr_headcount'                          => 'nullable|string|max:100',
            'ptr_activity'                          => 'nullable|string|max:255',
            'ptr_customer_delivery_address'         => 'nullable|string',
            'ptr_supplier_delivery_address'         => 'nullable|string',
        ], [
            // ptr_name
            'ptr_name.required'                             => 'Le nom du partenaire est obligatoire.',
            'ptr_name.max'                                  => 'Le nom ne peut pas dépasser 100 caractères.',
            'ptr_name.unique'                               => 'Un partenaire avec ce nom existe déjà.',

            // contact
            'ptr_address.max'                               => 'L\'adresse ne peut pas dépasser 500 caractères.',
            'ptr_zip.max'                                   => 'Le code postal ne peut pas dépasser 10 caractères.',
            'ptr_city.max'                                  => 'La ville ne peut pas dépasser 45 caractères.',
            'ptr_country.max'                               => 'Le pays ne peut pas dépasser 45 caractères.',
            'ptr_phone.max'                                 => 'Le téléphone ne peut pas dépasser 20 caractères.',
            'ptr_email.email'                               => 'L\'adresse email n\'est pas valide.',
            'ptr_email.max'                                 => 'L\'email ne peut pas dépasser 320 caractères.',

            // relations utilisateurs
            'fk_usr_id_seller.exists'                       => 'Le commercial sélectionné n\'existe pas.',
            'usr_id_referenttech.exists'                    => 'Le référent technique sélectionné n\'existe pas.',

            // identifiants légaux
            'ptr_vat_number.max'                            => 'Le numéro de TVA ne peut pas dépasser 20 caractères.',
            'ptr_siren.max'                                 => 'Le numéro SIREN/SIRET ne peut pas dépasser 14 caractères.',

            // modes de paiement & conditions
            'fk_pam_id_customer.exists'                     => 'Le mode de paiement client sélectionné n\'existe pas.',
            'fk_dur_id_payment_condition_customer.exists'   => 'La condition de paiement client sélectionnée n\'existe pas.',
            'fk_pam_id_supplier.exists'                     => 'Le mode de paiement fournisseur sélectionné n\'existe pas.',
            'fk_dur_id_payment_condition_supplier.exists'   => 'La condition de paiement fournisseur sélectionnée n\'existe pas.',

            // comptes comptables
            'fk_acc_id_customer.exists'                     => 'Le compte comptable client sélectionné n\'existe pas.',
            'fk_acc_id_supplier.exists'                     => 'Le compte comptable fournisseur sélectionné n\'existe pas.',
            'ptr_account_auxiliary_customer.max'            => 'Le compte auxiliaire client ne peut pas dépasser 8 caractères.',
            'ptr_account_auxiliary_customer.unique'         => 'Ce compte auxiliaire client est déjà utilisé par un autre partenaire.',
            'ptr_account_auxiliary_supplier.max'            => 'Le compte auxiliaire fournisseur ne peut pas dépasser 8 caractères.',
            'ptr_account_auxiliary_supplier.unique'         => 'Ce compte auxiliaire fournisseur est déjà utilisé par un autre partenaire.',

            // divers
            'ptr_notes.max'                                 => 'Les notes ne peuvent pas dépasser 255 caractères.',
            'ptr_customer_note.max'                         => 'La note client ne peut pas dépasser 255 caractères.',
            'fk_tap_id.exists'                              => 'La position fiscale sélectionnée n\'existe pas.',
        ]);

        // 🔐 Vérification des droits selon les types cochés
        $types = $this->getTypesFromRequest($request);

        if (empty($types)) {
            return response()->json([
                'status'  => false,
                'message' => 'Le partenaire doit être au moins client, fournisseur ou prospect.'
            ], 422);
        }

        $this->authorizePartnerWrite($types, 'edit');

        $partner = PartnerModel::create([
            'ptr_name'                              => $request->ptr_name,
            'ptr_address'                           => $request->ptr_address,
            'ptr_zip'                               => $request->ptr_zip,
            'ptr_city'                              => $request->ptr_city,
            'ptr_country'                           => $request->ptr_country,
            'ptr_phone'                             => $request->ptr_phone,
            'ptr_email'                             => $request->ptr_email,
            'fk_usr_id_seller'                      => $request->fk_usr_id_seller,
            'ptr_is_active'                         => $request->ptr_is_active ?? 1,
            'ptr_is_customer'                       => $request->ptr_is_customer ?? 0,
            'ptr_is_supplier'                       => $request->ptr_is_supplier ?? 0,
            'ptr_is_prospect'                       => $request->ptr_is_prospect ?? 0,
            'ptr_notes'                             => $request->ptr_notes,
            'ptr_vat_number'                        => $request->ptr_vat_number,
            'ptr_siren'                             => $request->ptr_siren,
            'usr_id_referenttech'                   => $request->usr_id_referenttech,
            'fk_pam_id_customer'                    => $request->fk_pam_id_customer,
            'fk_dur_id_payment_condition_customer'  => $request->fk_dur_id_payment_condition_customer,
            'fk_pam_id_supplier'                    => $request->fk_pam_id_supplier,
            'fk_dur_id_payment_condition_supplier'  => $request->fk_dur_id_payment_condition_supplier,
            'fk_acc_id_customer'                    => $request->fk_acc_id_customer,
            'fk_acc_id_supplier'                    => $request->fk_acc_id_supplier,
            'ptr_account_auxiliary_customer'        => $request->ptr_account_auxiliary_customer,
            'ptr_account_auxiliary_supplier'        => $request->ptr_account_auxiliary_supplier,
            'ptr_customer_note'                     => $request->ptr_customer_note,
            'fk_tap_id'                             => $request->fk_tap_id,
            'ptr_prospect_description'              => $request->ptr_prospect_description,
            'ptr_linkedin_url'                      => $request->ptr_linkedin_url,
            'ptr_pappers_url'                       => $request->ptr_pappers_url,
            'ptr_headcount'                          => $request->ptr_headcount,
            'ptr_activity'                          => $request->ptr_activity,
            'ptr_customer_delivery_address'         => $request->ptr_customer_delivery_address,
            'ptr_supplier_delivery_address'         => $request->ptr_supplier_delivery_address,
            'fk_usr_id_author'                      => auth()->id(),
        ]);

        return response()->json([
            'status'  => true,
            'message' => 'Partenaire créé avec succès.',
            'data'    => $partner
        ], 201);
    }


    public function update(Request $request, $id)
    {
        $partner = PartnerModel::findOrFail($id);

        $request->validate([
            'ptr_name'                              => 'sometimes|string|max:100|unique:partner_ptr,ptr_name,' . $id . ',ptr_id',
            'ptr_address'                           => 'nullable|string|max:500',
            'ptr_zip'                               => 'nullable|string|max:10',
            'ptr_city'                              => 'nullable|string|max:45',
            'ptr_country'                           => 'nullable|string|max:45',
            'ptr_phone'                             => 'nullable|string|max:20',
            'ptr_email'                             => 'nullable|email|max:320',
            'fk_usr_id_seller'                      => 'nullable|integer|exists:user_usr,usr_id',
            'ptr_is_active'                         => 'nullable|boolean',
            'ptr_is_customer'                       => 'nullable|boolean',
            'ptr_is_supplier'                       => 'nullable|boolean',
            'ptr_is_prospect'                       => 'nullable|boolean',
            'ptr_notes'                             => 'nullable|string|max:255',
            'ptr_vat_number'                        => 'nullable|string|max:20',
            'ptr_siren'                             => 'nullable|string|max:14',
            'usr_id_referenttech'                   => 'nullable|integer|exists:user_usr,usr_id',
            'fk_pam_id_customer'                    => 'nullable|integer|exists:payment_mode_pam,pam_id',
            'fk_dur_id_payment_condition_customer'  => 'nullable|integer|exists:duration_dur,dur_id',
            'fk_pam_id_supplier'                    => 'nullable|integer|exists:payment_mode_pam,pam_id',
            'fk_dur_id_payment_condition_supplier'  => 'nullable|integer|exists:duration_dur,dur_id',
            'fk_acc_id_customer'                    => 'nullable|integer|exists:account_account_acc,acc_id',
            'fk_acc_id_supplier'                    => 'nullable|integer|exists:account_account_acc,acc_id',
            'ptr_account_auxiliary_customer'        => 'nullable|string|max:8|unique:partner_ptr,ptr_account_auxiliary_customer,' . $id . ',ptr_id',
            'ptr_account_auxiliary_supplier'        => 'nullable|string|max:8|unique:partner_ptr,ptr_account_auxiliary_supplier,' . $id . ',ptr_id',
            'ptr_customer_note'                     => 'nullable|string|max:255',
            'fk_tap_id'                             => 'nullable|integer|exists:account_tax_position_tap,tap_id',
            'ptr_prospect_description'              => 'nullable|string',
            'ptr_linkedin_url'                      => 'nullable|string|max:2048',
            'ptr_pappers_url'                       => 'nullable|string|max:2048',
            'ptr_headcount'                          => 'nullable|string|max:100',
            'ptr_activity'                          => 'nullable|string|max:255',
            'ptr_customer_delivery_address'         => 'nullable|string',
            'ptr_supplier_delivery_address'         => 'nullable|string',
        ], [
            // ptr_name
            'ptr_name.max'                                  => 'Le nom ne peut pas dépasser 100 caractères.',
            'ptr_name.unique'                               => 'Un partenaire avec ce nom existe déjà.',

            // contact
            'ptr_address.max'                               => 'L\'adresse ne peut pas dépasser 500 caractères.',
            'ptr_zip.max'                                   => 'Le code postal ne peut pas dépasser 10 caractères.',
            'ptr_city.max'                                  => 'La ville ne peut pas dépasser 45 caractères.',
            'ptr_country.max'                               => 'Le pays ne peut pas dépasser 45 caractères.',
            'ptr_phone.max'                                 => 'Le téléphone ne peut pas dépasser 20 caractères.',
            'ptr_email.email'                               => 'L\'adresse email n\'est pas valide.',
            'ptr_email.max'                                 => 'L\'email ne peut pas dépasser 320 caractères.',

            // relations utilisateurs
            'fk_usr_id_seller.exists'                       => 'Le commercial sélectionné n\'existe pas.',
            'usr_id_referenttech.exists'                    => 'Le référent technique sélectionné n\'existe pas.',

            // identifiants légaux
            'ptr_vat_number.max'                            => 'Le numéro de TVA ne peut pas dépasser 20 caractères.',
            'ptr_siren.max'                                 => 'Le numéro SIREN/SIRET ne peut pas dépasser 14 caractères.',

            // modes de paiement & conditions
            'fk_pam_id_customer.exists'                     => 'Le mode de paiement client sélectionné n\'existe pas.',
            'fk_dur_id_payment_condition_customer.exists'   => 'La condition de paiement client sélectionnée n\'existe pas.',
            'fk_pam_id_supplier.exists'                     => 'Le mode de paiement fournisseur sélectionné n\'existe pas.',
            'fk_dur_id_payment_condition_supplier.exists'   => 'La condition de paiement fournisseur sélectionnée n\'existe pas.',

            // comptes comptables
            'fk_acc_id_customer.exists'                     => 'Le compte comptable client sélectionné n\'existe pas.',
            'fk_acc_id_supplier.exists'                     => 'Le compte comptable fournisseur sélectionné n\'existe pas.',
            'ptr_account_auxiliary_customer.max'            => 'Le compte auxiliaire client ne peut pas dépasser 8 caractères.',
            'ptr_account_auxiliary_customer.unique'         => 'Ce compte auxiliaire client est déjà utilisé par un autre partenaire.',
            'ptr_account_auxiliary_supplier.max'            => 'Le compte auxiliaire fournisseur ne peut pas dépasser 8 caractères.',
            'ptr_account_auxiliary_supplier.unique'         => 'Ce compte auxiliaire fournisseur est déjà utilisé par un autre partenaire.',

            // divers
            'ptr_notes.max'                                 => 'Les notes ne peuvent pas dépasser 255 caractères.',
            'ptr_customer_note.max'                         => 'La note client ne peut pas dépasser 255 caractères.',
            'fk_tap_id.exists'                              => 'La position fiscale sélectionnée n\'existe pas.',
        ]);

        // 🔐 Vérification des droits sur les types AVANT et APRÈS modification
        $typesBefore = $this->getTypesFromRequest(new Request(), $partner);
        $typesAfter  = $this->getTypesFromRequest($request, $partner);
        $allTypes    = array_unique(array_merge($typesBefore, $typesAfter));

        if (empty($allTypes)) {
            return response()->json([
                'status'  => false,
                'message' => 'Le partenaire doit être au moins client, fournisseur ou prospect.'
            ], 422);
        }

        $this->authorizePartnerWrite($allTypes, 'edit');

        $partner->update([
            'ptr_name'                              => $request->input('ptr_name', $partner->ptr_name),
            'ptr_address'                           => $request->input('ptr_address', $partner->ptr_address),
            'ptr_zip'                               => $request->input('ptr_zip', $partner->ptr_zip),
            'ptr_city'                              => $request->input('ptr_city', $partner->ptr_city),
            'ptr_country'                           => $request->input('ptr_country', $partner->ptr_country),
            'ptr_phone'                             => $request->input('ptr_phone', $partner->ptr_phone),
            'ptr_email'                             => $request->input('ptr_email', $partner->ptr_email),
            'fk_usr_id_seller'                      => $request->input('fk_usr_id_seller', $partner->fk_usr_id_seller),
            'ptr_is_active'                         => $request->input('ptr_is_active', $partner->ptr_is_active),
            'ptr_is_customer'                       => $request->input('ptr_is_customer', $partner->ptr_is_customer),
            'ptr_is_supplier'                       => $request->input('ptr_is_supplier', $partner->ptr_is_supplier),
            'ptr_is_prospect'                       => $request->input('ptr_is_prospect', $partner->ptr_is_prospect),
            'ptr_notes'                             => $request->input('ptr_notes', $partner->ptr_notes),
            'ptr_vat_number'                        => $request->input('ptr_vat_number', $partner->ptr_vat_number),
            'ptr_siren'                             => $request->input('ptr_siren', $partner->ptr_siren),
            'usr_id_referenttech'                   => $request->input('usr_id_referenttech', $partner->usr_id_referenttech),
            'fk_pam_id_customer'                    => $request->input('fk_pam_id_customer', $partner->fk_pam_id_customer),
            'fk_dur_id_payment_condition_customer'  => $request->input('fk_dur_id_payment_condition_customer', $partner->fk_dur_id_payment_condition_customer),
            'fk_pam_id_supplier'                    => $request->input('fk_pam_id_supplier', $partner->fk_pam_id_supplier),
            'fk_dur_id_payment_condition_supplier'  => $request->input('fk_dur_id_payment_condition_supplier', $partner->fk_dur_id_payment_condition_supplier),
            'fk_acc_id_customer'                    => $request->input('fk_acc_id_customer', $partner->fk_acc_id_customer),
            'fk_acc_id_supplier'                    => $request->input('fk_acc_id_supplier', $partner->fk_acc_id_supplier),
            'ptr_account_auxiliary_customer'        => $request->input('ptr_account_auxiliary_customer', $partner->ptr_account_auxiliary_customer),
            'ptr_account_auxiliary_supplier'        => $request->input('ptr_account_auxiliary_supplier', $partner->ptr_account_auxiliary_supplier),
            'ptr_customer_note'                     => $request->input('ptr_customer_note', $partner->ptr_customer_note),
            'fk_tap_id'                             => $request->input('fk_tap_id', $partner->fk_tap_id),
            'ptr_prospect_description'              => $request->input('ptr_prospect_description', $partner->ptr_prospect_description),
            'ptr_linkedin_url'                      => $request->input('ptr_linkedin_url', $partner->ptr_linkedin_url),
            'ptr_pappers_url'                       => $request->input('ptr_pappers_url', $partner->ptr_pappers_url),
            'ptr_headcount'                          => $request->input('ptr_headcount', $partner->ptr_headcount),
            'ptr_activity'                          => $request->input('ptr_activity', $partner->ptr_activity),
            'ptr_customer_delivery_address'         => $request->input('ptr_customer_delivery_address', $partner->ptr_customer_delivery_address),
            'ptr_supplier_delivery_address'         => $request->input('ptr_supplier_delivery_address', $partner->ptr_supplier_delivery_address),
            'fk_usr_id_updater'                     => auth()->id(),
        ]);

        return response()->json([
            'status'  => true,
            'message' => 'Partenaire mis à jour avec succès.',
            'data'    => $partner->fresh()
        ]);
    }
    public function destroy($id)
    {
        $partner = PartnerModel::findOrFail($id);

        // Même logique, mais avec l'action 'delete'
        $types = $this->getTypesFromRequest(new Request(), $partner);
        $this->authorizePartnerWrite($types, 'delete');

        $partner->delete();

        return response()->json([
            'status'  => true,
            'message' => 'Partenaire supprimé avec succès.'
        ]);
    }


    /**
     * Vérifier si un compte auxiliaire existe déjà
     */
    public function checkAccountAuxiliary(Request $request)
    {
        $request->validate([
            'account_type' => 'required|string|in:customer,supplier',
            'account_auxiliary' => 'required|string|max:8',
            'id' => 'nullable|integer',
            'generate_next' => 'nullable|boolean'
        ]);

        $accountType = $request->account_type;
        $accountAuxiliary = $request->account_auxiliary;
        $id = $request->id ?? 0;
        $generateNext = $request->generate_next ?? false;

        try {
            if (empty($accountAuxiliary)) {
                return response()->json([
                    'exists' => false,
                    'available' => true
                ]);
            }

            $checkExistence = function ($auxCode) use ($accountType, $id) {
                $partner = PartnerModel::where("ptr_account_auxiliary_{$accountType}", $auxCode)
                    ->where('ptr_id', '!=', $id)
                    ->first();
                return $partner !== null;
            };

            $exists = $checkExistence($accountAuxiliary);

            if (!$exists) {
                return response()->json([
                    'exists' => false,
                    'available' => true,
                    'account_auxiliary' => $accountAuxiliary
                ]);
            }

            if (!$generateNext) {
                $existingPartner = PartnerModel::where("ptr_account_auxiliary_{$accountType}", $accountAuxiliary)
                    ->where('ptr_id', '!=', $id)
                    ->select('ptr_id', 'ptr_name')
                    ->first();

                return response()->json([
                    'exists' => true,
                    'available' => false,
                    'existing_partner' => [
                        'id' => $existingPartner->ptr_id,
                        'name' => $existingPartner->ptr_name
                    ]
                ]);
            }

            // Génération d'un nouveau code avec incrémentation
            $increment = 1;
            do {
                if ($increment < 10) {
                    $newAuxCode = rtrim(substr($accountAuxiliary, 0, 7), '0123456789') . $increment;
                } else {
                    $newAuxCode = substr($accountAuxiliary, 0, 6) . $increment;
                }
                $newAuxCode = substr($newAuxCode, 0, 8);
                $increment++;
            } while ($checkExistence($newAuxCode) && $increment <= 99);

            return response()->json([
                'exists' => true,
                'available' => true,
                'account_auxiliary' => $newAuxCode,
                'generated' => true
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => "Erreur lors de la vérification : " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Récupère les objets liés à un partenaire (devis, commandes, factures, bons de livraison, contrats)
     */
    public function getLinkedObjects($ptrId)
    {
        try {
            $queries = [];

            // Devis client (ord_status < 3)
            $queries[] = DB::table('sale_order_ord as ord')
                ->leftJoin('partner_ptr as ptr', 'ord.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('ord.fk_ptr_id', $ptrId)
                ->where('ord.ord_status', '<', 3)
                ->selectRaw("
                    ord.ord_id as id,
                    'saleorder' as object,
                    'Devis client' as type,
                    ord.ord_number as number,
                    ord.ord_date as date,
                    ptr.ptr_name,
                    ord.ord_totalht as totalht,
                    ord.ord_totalttc as totalttc
                ");

            // Commandes client (ord_status >= 3)
            $queries[] = DB::table('sale_order_ord as ord')
                ->leftJoin('partner_ptr as ptr', 'ord.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('ord.fk_ptr_id', $ptrId)
                ->where('ord.ord_status', '>=', 3)
                ->selectRaw("
                    ord.ord_id as id,
                    'saleorder' as object,
                    'Commande client' as type,
                    ord.ord_number as number,
                    ord.ord_date as date,
                    ptr.ptr_name,
                    ord.ord_totalht as totalht,
                    ord.ord_totalttc as totalttc
                ");

            // Commandes fournisseur
            $queries[] = DB::table('purchase_order_por as por')
                ->leftJoin('partner_ptr as ptr', 'por.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('por.fk_ptr_id', $ptrId)
                ->selectRaw("
                    por.por_id as id,
                    'purchaseorder' as object,
                    'Commande fournisseur' as type,
                    por.por_number as number,
                    por.por_date as date,
                    ptr.ptr_name,
                    por.por_totalht as totalht,
                    por.por_totalttc as totalttc
                ");

            // Factures client
            $queries[] = DB::table('invoice_inv as inv')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('inv.fk_ptr_id', $ptrId)
                ->where('inv.inv_operation', 1)
                ->selectRaw("
                    inv.inv_id as id,
                    'custinvoice' as object,
                    'Facture client' as type,
                    inv.inv_number as number,
                    inv.inv_date as date,
                    ptr.ptr_name,
                    inv.inv_totalht as totalht,
                    inv.inv_totalttc as totalttc
                ");

            // Avoirs client
            $queries[] = DB::table('invoice_inv as inv')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('inv.fk_ptr_id', $ptrId)
                ->where('inv.inv_operation', 2)
                ->selectRaw("
                    inv.inv_id as id,
                    'custrefund' as object,
                    'Avoir client' as type,
                    inv.inv_number as number,
                    inv.inv_date as date,
                    ptr.ptr_name,
                    inv.inv_totalht as totalht,
                    inv.inv_totalttc as totalttc
                ");

            // Factures fournisseur
            $queries[] = DB::table('invoice_inv as inv')
                ->leftJoin('partner_ptr as ptr', 'inv.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('inv.fk_ptr_id', $ptrId)
                ->where('inv.inv_operation', 3)
                ->selectRaw("
                    inv.inv_id as id,
                    'suppinvoice' as object,
                    'Facture fournisseur' as type,
                    inv.inv_number as number,
                    inv.inv_date as date,
                    ptr.ptr_name,
                    inv.inv_totalht as totalht,
                    inv.inv_totalttc as totalttc
                ");

            // Bons de livraison client
            $queries[] = DB::table('delivery_note_dln as dln')
                ->leftJoin('partner_ptr as ptr', 'dln.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('dln.fk_ptr_id', $ptrId)
                ->where('dln.dln_operation', 1)
                ->selectRaw("
                    dln.dln_id as id,
                    'custdeliverynote' as object,
                    'Bon de livraison' as type,
                    dln.dln_number as number,
                    dln.dln_date as date,
                    ptr.ptr_name,
                    0 as totalht,
                    0 as totalttc
                ");

            // Bons de réception fournisseur
            $queries[] = DB::table('delivery_note_dln as dln')
                ->leftJoin('partner_ptr as ptr', 'dln.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('dln.fk_ptr_id', $ptrId)
                ->where('dln.dln_operation', 2)
                ->selectRaw("
                    dln.dln_id as id,
                    'suppreceptionnote' as object,
                    'Bon de réception' as type,
                    dln.dln_number as number,
                    dln.dln_date as date,
                    ptr.ptr_name,
                    0 as totalht,
                    0 as totalttc
                ");

            // Contrats client
            $queries[] = DB::table('contract_con as con')
                ->leftJoin('partner_ptr as ptr', 'con.fk_ptr_id', '=', 'ptr.ptr_id')
                ->where('con.fk_ptr_id', $ptrId)
                ->selectRaw("
                    con.con_id as id,
                    'custcontract' as object,
                    'Contrat' as type,
                    con.con_number as number,
                    con.con_date as date,
                    ptr.ptr_name,
                    con.con_totalht as totalht,
                    con.con_totalttc as totalttc
                ");

            // Construction finale avec UNION ALL
            $query = array_shift($queries);
            foreach ($queries as $q) {
                $query->unionAll($q);
            }

            $data = DB::query()
                ->fromSub($query, 'linked')
                ->distinct()
                ->orderBy('type')
                ->orderBy('date')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $data
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des objets liés: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Vérifier si un partenaire a des enregistrements liés
     * avant de le désactiver comme client ou fournisseur
     */
    public function checkLinkedRecords(Request $request)
    {
        $request->validate([
            'ptr_id' => 'required|integer|exists:partner_ptr,ptr_id',
            'check_type' => 'required|string|in:customer,supplier'
        ]);

        $partnerId = $request->ptr_id;
        $checkType = $request->check_type;

        try {
            $count = 0;

            if ($checkType === 'customer') {
                // Vérifier les enregistrements liés au client
                // Note: Ces tables n'existent peut-être pas encore, adapter selon votre schéma
                $tables = [
                    // Format: [table, colonne_fk, conditions_supplémentaires]
                    ['sale_order_ord', 'fk_ptr_id', null],
                    ['invoice_inv', 'fk_ptr_id', ['inv_operation' => [1, 2]]],
                    ['contract_con', 'fk_ptr_id', null],
                ];

                foreach ($tables as [$table, $fkColumn, $conditions]) {
                    // Vérifier si la table existe
                    if (!DB::getSchemaBuilder()->hasTable($table)) {
                        continue;
                    }

                    $query = DB::table($table)->where($fkColumn, $partnerId);

                    if ($conditions) {
                        foreach ($conditions as $col => $values) {
                            $query->whereIn($col, $values);
                        }
                    }

                    $count += $query->count();
                }
            } else if ($checkType === 'supplier') {
                // Vérifier les enregistrements liés au fournisseur
                $tables = [
                    ['purchase_order_por', 'fk_ptr_id', null],
                    ['invoice_inv', 'fk_ptr_id', ['inv_operation' => [2, 3]]],
                    ['contract_con', 'fk_ptr_id', null],
                ];

                foreach ($tables as [$table, $fkColumn, $conditions]) {
                    // Vérifier si la table existe
                    if (!DB::getSchemaBuilder()->hasTable($table)) {
                        continue;
                    }

                    $query = DB::table($table)->where($fkColumn, $partnerId);

                    if ($conditions) {
                        foreach ($conditions as $col => $values) {
                            $query->whereIn($col, $values);
                        }
                    }

                    $count += $query->count();
                }
            }

            return response()->json([
                'status' => true,
                'has_linked_records' => $count > 0,
                'count' => $count
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => "Erreur lors de la vérification : " . $e->getMessage()
            ], 500);
        }
    }
}
