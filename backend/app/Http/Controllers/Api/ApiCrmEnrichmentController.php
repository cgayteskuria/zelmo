<?php

namespace App\Http\Controllers\Api;

use App\Models\ContactModel;
use App\Models\CrmConfigModel;
use App\Models\CrmRevealRequestModel;
use App\Models\PartnerModel;
use App\Services\EnrichmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ApiCrmEnrichmentController extends Controller
{
    public function __construct(private EnrichmentService $enrichmentService) {}

    /**
     * Recherche de contacts/prospects via le service d'enrichissement.
     * Ne consomme pas de crédits.
     */
    public function search(Request $request)
    {
        if (!$request->user()->can('enrichment.search')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $validated = $request->validate([
            'q_keywords'                       => 'nullable|string|max:255',
            'person_titles'                    => 'nullable|array',
            'person_titles.*'                  => 'string|max:100',
            'person_seniorities'               => 'nullable|array',
            'person_seniorities.*'             => 'string',
            'person_locations'                 => 'nullable|array',
            'person_locations.*'               => 'string|max:100',
            'q_organization_name'              => 'nullable|string|max:255',
            'q_organization_domains_list'      => 'nullable|array',
            'q_organization_domains_list.*'    => 'string|max:255',
            'organization_locations'           => 'nullable|array',
            'organization_locations.*'         => 'string|max:100',
            'organization_num_employees_ranges'=> 'nullable|array',
            'organization_num_employees_ranges.*' => 'string',
            'revenue_range_min'                => 'nullable|numeric|min:0',
            'revenue_range_max'                => 'nullable|numeric|min:0',
            'page'                             => 'nullable|integer|min:1',
            'per_page'                         => 'nullable|integer|min:1|max:100',
        ]);

        try {
            $page    = (int) ($validated['page'] ?? 1);
            $perPage = (int) ($validated['per_page'] ?? 25);

            $result = $this->enrichmentService->searchPeople($validated, $page, $perPage);

            $credits = $this->enrichmentService->getUserCreditsInfo($request->user()->usr_id);

            return response()->json([
                'status'  => true,
                'data'    => $result,
                'credits' => $credits,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Déclenche la révélation du numéro de mobile (async, livré par webhook).
     * Consomme 1 crédit.
     */
    public function reveal(Request $request)
    {
        if (!$request->user()->can('enrichment.reveal')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $validated = $request->validate([
            'apollo_person_id'  => 'required|string|max:100',
            'firstname'         => 'nullable|string|max:100',
            'lastname'          => 'nullable|string|max:100',
            'title'             => 'nullable|string|max:200',
            'organization_name' => 'nullable|string|max:200',
            'email'             => 'nullable|email|max:320',
            'linkedin_url'      => 'nullable|string|max:2048',
            'ctc_id'            => 'nullable|integer|exists:contact_ctc,ctc_id',
            'ptr_id'            => 'nullable|integer|exists:partner_ptr,ptr_id',
        ]);

        $userId = $request->user()->usr_id;

        if (!$this->enrichmentService->checkUserCredits($userId)) {
            return response()->json([
                'message' => 'Quota de crédits atteint pour votre compte.',
                'code'    => 'CREDITS_EXHAUSTED',
            ], 403);
        }

        try {
            $reveal = $this->enrichmentService->requestReveal(
                $userId,
                $validated['apollo_person_id'],
                [
                    'firstname'         => $validated['firstname'] ?? '',
                    'lastname'          => $validated['lastname'] ?? '',
                    'title'             => $validated['title'] ?? '',
                    'organization_name' => $validated['organization_name'] ?? '',
                    'email'             => $validated['email'] ?? null,
                    'linkedin_url'      => $validated['linkedin_url'] ?? null,
                ],
                $validated['ctc_id'] ?? null,
                $validated['ptr_id'] ?? null
            );

            // Ne consommer le crédit que si Apollo a accepté la demande
            if ($reveal->crr_status === 'error') {
                return response()->json([
                    'message' => 'Le service de révélation a refusé la demande : ' . $reveal->crr_error_message,
                    'crr_id'  => $reveal->crr_id,
                ], 422);
            }

            $this->enrichmentService->consumeCredit($userId);
            $credits = $this->enrichmentService->getUserCreditsInfo($userId);

            return response()->json([
                'status'     => true,
                'crr_id'     => $reveal->crr_id,
                'crr_status' => $reveal->crr_status,
                'credits'    => $credits,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Retourne le statut d'une demande de révélation.
     * Utilisé par le frontend pour le polling.
     */
    public function revealStatus(Request $request, int $id)
    {
        if (!$request->user()->can('enrichment.reveal')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $reveal = CrmRevealRequestModel::where('crr_id', $id)
            ->where('fk_usr_id', $request->user()->usr_id)
            ->firstOrFail();

        return response()->json([
            'status'       => true,
            'crr_status'   => $reveal->crr_status,
            'phone_number' => $reveal->crr_phone_number,
            'fk_ctc_id'    => $reveal->fk_ctc_id,
            'fk_ptr_id'    => $reveal->fk_ptr_id,
            'error'        => $reveal->crr_error_message,
        ]);
    }

    /**
     * Vérifie si des IDs externes sont déjà présents dans le CRM.
     */
    public function checkExists(Request $request)
    {
        if (!$request->user()->can('enrichment.search')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $ids = (array) $request->input('ids', []);

        if (empty($ids)) {
            return response()->json(['status' => true, 'found' => []]);
        }

        $contacts = ContactModel::whereIn('ctc_external_id', $ids)
            ->get(['ctc_id', 'ctc_external_id', 'fk_ptr_id']);

        $partners = PartnerModel::whereIn('ptr_external_id', $ids)
            ->get(['ptr_id', 'ptr_external_id']);

        $found = [];

        foreach ($contacts as $ctc) {
            $found[$ctc->ctc_external_id] = [
                'ctc_id' => $ctc->ctc_id,
                'ptr_id' => $ctc->fk_ptr_id,
            ];
        }

        foreach ($partners as $ptr) {
            if (!isset($found[$ptr->ptr_external_id])) {
                $found[$ptr->ptr_external_id] = ['ctc_id' => null, 'ptr_id' => $ptr->ptr_id];
            } else {
                $found[$ptr->ptr_external_id]['ptr_id'] = $ptr->ptr_id;
            }
        }

        return response()->json([
            'status' => true,
            'found'  => $found,
        ]);
    }

    /**
     * Importe une personne + sa société dans le CRM sans créer de doublon.
     */
    public function importPerson(Request $request)
    {
        if (!$request->user()->can('enrichment.search')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $validated = $request->validate([
            'person_external_id' => 'required|string|max:100',
            'firstname'          => 'nullable|string|max:100',
            'lastname'           => 'nullable|string|max:100',
            'title'              => 'nullable|string|max:200',
            'email'              => 'nullable|email|max:320',
            'org_external_id'    => 'nullable|string|max:100',
            'org_name'           => 'nullable|string|max:100',
            'org_city'           => 'nullable|string|max:45',
            'org_headcount'      => 'nullable|string|max:100',
            'org_industry'       => 'nullable|string|max:255',
            'crr_id'             => 'nullable|integer|exists:crm_reveal_request_crr,crr_id',
        ]);

        try {
            $result = $this->enrichmentService->importPerson($validated, $request->user()->usr_id);
            return response()->json([
                'status'  => true,
                'ctc_id'  => $result['ctc_id'],
                'ptr_id'  => $result['ptr_id'],
                'created' => $result['created'],
            ]);
        } catch (\Exception $e) {
            Log::error('importPerson error', ['message' => $e->getMessage()]);
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Enrichit les informations d'une organisation (domaine ou nom).
     * Consomme 1 crédit Apollo.
     */
    public function enrichOrganization(Request $request)
    {
        if (!$request->user()->can('enrichment.reveal')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $validated = $request->validate([
            'domain' => 'nullable|string|max:255',
            'name'   => 'nullable|string|max:255',
        ]);

        if (empty($validated['domain']) && empty($validated['name'])) {
            return response()->json(['message' => 'Un domaine ou un nom de société est requis.'], 422);
        }

        try {
            $result = $this->enrichmentService->enrichOrganization(
                $validated['domain'] ?? null,
                $validated['name']   ?? null
            );

            return response()->json(['status' => true, 'data' => $result]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Teste la connexion au service d'enrichissement externe.
     * Accepte crc_api_url / crc_api_key pour tester les valeurs du formulaire sans sauvegarder.
     */
    public function testConnection(Request $request)
    {
        if (!$request->user()->can('enrichment.settings')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $validated = $request->validate([
            'crc_api_url' => 'nullable|string|max:500',
            'crc_api_key' => 'nullable|string|max:500',
        ]);

        // Utiliser les valeurs du formulaire si fournies et non masquées
        $overrides = array_filter($validated, fn($v) => !empty($v) && !str_contains((string) $v, '•'));

        $result = $this->enrichmentService->testConnection($overrides);

        return response()->json([
            'ok'      => $result['ok'],
            'http'    => $result['status'],
            'message' => $result['message'],
        ], $result['ok'] ? 200 : 422);
    }

    /**
     * Récupère la configuration du service d'enrichissement.
     */
    public function getConfig(Request $request)
    {
        if (!$request->user()->can('enrichment.settings')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $config = CrmConfigModel::firstOrCreate(['crc_id' => 1]);

        return response()->json([
            'status' => true,
            'data'   => [
                'crc_id'             => $config->crc_id,
                'crc_api_url'        => $config->crc_api_url,
                'crc_api_key'        => $config->crc_api_key ? str_repeat('•', 8) . substr($config->crc_api_key, -4) : '',
                'crc_webhook_secret' => $config->crc_webhook_secret ? str_repeat('•', 8) . substr($config->crc_webhook_secret, -4) : '',
                'crc_api_key_set'    => !empty($config->crc_api_key),
                'webhook_url'        => config('app.url') . '/api/crm-enrichment/webhook',
            ],
        ]);
    }

    /**
     * Met à jour la configuration du service d'enrichissement.
     */
    public function updateConfig(Request $request)
    {
        if (!$request->user()->can('enrichment.settings')) {
            return response()->json(['message' => 'Accès non autorisé.'], 403);
        }

        $validated = $request->validate([
            'crc_api_url'        => 'required|string|max:500',
            'crc_api_key'        => 'nullable|string|max:500',
            'crc_webhook_secret' => 'nullable|string|max:255',
        ]);

        $config = CrmConfigModel::firstOrCreate(['crc_id' => 1]);

        $updateData = [
            'crc_api_url'        => $validated['crc_api_url'],
            'fk_usr_id_updater'  => $request->user()->usr_id,
        ];

        // Ne mettre à jour la clé que si une nouvelle valeur est fournie (et non masquée)
        if (!empty($validated['crc_api_key']) && !str_contains($validated['crc_api_key'], '•')) {
            $updateData['crc_api_key'] = $validated['crc_api_key'];
        }

        if (isset($validated['crc_webhook_secret']) && !str_contains($validated['crc_webhook_secret'], '•')) {
            $updateData['crc_webhook_secret'] = $validated['crc_webhook_secret'];
        }

        $config->update($updateData);

        return response()->json([
            'status'  => true,
            'message' => 'Configuration mise à jour avec succès.',
        ]);
    }

    /**
     * Point d'entrée du webhook — appelé par le service d'enrichissement
     * pour livrer le numéro de mobile (pas d'authentification Sanctum).
     */
    public function webhook(Request $request)
    {
        $config = CrmConfigModel::first();

        // Validation du secret webhook
        if ($config && !empty($config->crc_webhook_secret)) {
            $secret  = $request->header('X-Webhook-Secret')
                    ?? $request->input('webhook_secret');

            if ($secret !== $config->crc_webhook_secret) {
                Log::warning('CRM Webhook: secret invalide', ['ip' => $request->ip()]);
                return response()->json(['message' => 'Non autorisé.'], 401);
            }
        }

        $data = $request->all();

        Log::info('CRM Webhook reçu', ['payload' => $data]);

        // Trouver l'ID de la personne dans la payload (peut varier selon l'API)
        $apolloPersonId = $data['id'] ?? $data['person_id'] ?? null;

        if (!$apolloPersonId) {
            return response()->json(['message' => 'ID de personne manquant.'], 422);
        }

        $reveal = CrmRevealRequestModel::where('crr_apollo_person_id', $apolloPersonId)
            ->where('crr_status', 'pending')
            ->latest('crr_id')
            ->first();

        if (!$reveal) {
            return response()->json(['status' => 'ignored'], 200);
        }

        // Extraire le numéro de téléphone de la payload
        $phoneNumber = $this->extractPhoneFromPayload($data);

        if (!$phoneNumber) {
            $reveal->update([
                'crr_status'        => 'error',
                'crr_error_message' => 'Aucun numéro de mobile trouvé dans la réponse.',
            ]);
            return response()->json(['status' => 'no_phone'], 200);
        }

        // Mettre à jour ou créer le contact en CRM
        $ctcId = $reveal->fk_ctc_id;
        $ptrId = $reveal->fk_ptr_id;

        if ($ctcId) {
            ContactModel::where('ctc_id', $ctcId)->update(['ctc_mobile' => $phoneNumber]);
        } else {
            // Créer prospect + contact si pas encore dans le CRM
            if (!$ptrId && !empty($reveal->crr_organization_name)) {
                $partner = PartnerModel::firstOrCreate(
                    ['ptr_name' => $reveal->crr_organization_name],
                    [
                        'ptr_is_prospect'  => 1,
                        'ptr_is_active'    => 1,
                        'fk_usr_id_author' => $reveal->fk_usr_id,
                        'ptr_external_id'  => $apolloPersonId . '_org',
                    ]
                );
                $ptrId = $partner->ptr_id;
            }

            $email = $reveal->crr_person_firstname . '.' . $reveal->crr_person_lastname . '@enrichissement.local';

            $contact = ContactModel::create([
                'ctc_firstname'   => $reveal->crr_person_firstname,
                'ctc_lastname'    => $reveal->crr_person_lastname,
                'ctc_job_title'   => $reveal->crr_person_title,
                'ctc_mobile'      => $phoneNumber,
                'ctc_email'       => $email,
                'ctc_is_active'   => 1,
                'ctc_external_id' => $apolloPersonId,
                'fk_ptr_id'       => $ptrId,
                'fk_usr_id_author'=> $reveal->fk_usr_id,
            ]);
            $ctcId = $contact->ctc_id;

            if ($ptrId) {
                \DB::table('contact_partner_ctp')->insertOrIgnore([
                    'fk_ctc_id'  => $ctcId,
                    'fk_ptr_id'  => $ptrId,
                    'ctp_created' => now(),
                    'ctp_updated' => now(),
                ]);
            }
        }

        $reveal->update([
            'crr_status'       => 'received',
            'crr_phone_number' => $phoneNumber,
            'fk_ctc_id'        => $ctcId,
            'fk_ptr_id'        => $ptrId,
        ]);

        return response()->json(['status' => 'ok'], 200);
    }

    private function extractPhoneFromPayload(array $data): ?string
    {
        // Format Apollo.io
        if (!empty($data['phone_numbers']) && is_array($data['phone_numbers'])) {
            foreach ($data['phone_numbers'] as $ph) {
                if (!empty($ph['sanitized_number'])) {
                    return $ph['sanitized_number'];
                }
                if (!empty($ph['raw_number'])) {
                    return $ph['raw_number'];
                }
            }
        }

        // Format simplifié
        if (!empty($data['mobile_phone'])) {
            return $data['mobile_phone'];
        }
        if (!empty($data['phone'])) {
            return $data['phone'];
        }

        return null;
    }
}
