<?php

namespace App\Services;

use App\Models\ContactModel;
use App\Models\CrmConfigModel;
use App\Models\CrmRevealRequestModel;
use App\Models\PartnerModel;
use App\Models\UserModel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EnrichmentService
{
    private ?CrmConfigModel $config = null;

    public function getConfig(): CrmConfigModel
    {
        if (!$this->config) {
            $this->config = CrmConfigModel::firstOrCreate(['crc_id' => 1]);
        }
        return $this->config;
    }

    /**
     * Recherche de personnes via l'API d'enrichissement.
     * Ne consomme pas de crédits.
     */
    public function searchPeople(array $filters, int $page = 1, int $perPage = 25): array
    {
        $config = $this->getConfig();

        if (empty($config->crc_api_url) || empty($config->crc_api_key)) {
            throw new \RuntimeException('Le service d\'enrichissement n\'est pas configuré.');
        }

        $payload = array_filter([
            'page'     => $page,
            'per_page' => $perPage,
        ]);

        // Filtres personne
        if (!empty($filters['q_keywords'])) {
            $payload['q_keywords'] = $filters['q_keywords'];
        }
        if (!empty($filters['person_titles'])) {
            $payload['person_titles'] = (array) $filters['person_titles'];
        }
        if (!empty($filters['person_seniorities'])) {
            $payload['person_seniorities'] = (array) $filters['person_seniorities'];
        }
        if (!empty($filters['person_locations'])) {
            $payload['person_locations'] = (array) $filters['person_locations'];
        }

        // Filtres organisation
        if (!empty($filters['q_organization_name'])) {
            $payload['q_organization_name'] = $filters['q_organization_name'];
        }
        if (!empty($filters['q_organization_domains_list'])) {
            $payload['q_organization_domains_list'] = (array) $filters['q_organization_domains_list'];
        }
        if (!empty($filters['organization_locations'])) {
            $payload['organization_locations'] = (array) $filters['organization_locations'];
        }
        if (!empty($filters['organization_num_employees_ranges'])) {
            $payload['organization_num_employees_ranges'] = (array) $filters['organization_num_employees_ranges'];
        }
        if (isset($filters['revenue_range_min']) || isset($filters['revenue_range_max'])) {
            $payload['revenue_range'] = array_filter([
                'min' => $filters['revenue_range_min'] ?? null,
                'max' => $filters['revenue_range_max'] ?? null,
            ]);
        }

        $response = Http::withHeaders([
            'X-Api-Key'    => $config->crc_api_key,
            'Content-Type' => 'application/json',
            'Accept'       => 'application/json',
        ])->timeout(30)->post(rtrim($config->crc_api_url, '/') . '/mixed_people/api_search', $payload);

        if (!$response->successful()) {
            Log::error('EnrichmentService::searchPeople error', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            throw new \RuntimeException('Erreur lors de la recherche : ' . $response->status());
        }

        return $response->json() ?? [];
    }

    /**
     * Teste la connexion au service externe avec les credentials enregistrés.
     * Fait un appel minimal (1 résultat) — ne consomme pas de crédits.
     *
     * @return array { ok: bool, status: int|null, message: string }
     */
    public function testConnection(array $overrides = []): array
    {
        $config = $this->getConfig();

        $apiUrl = $overrides['crc_api_url'] ?? $config->crc_api_url;
        $apiKey = $overrides['crc_api_key'] ?? $config->crc_api_key;

        if (empty($apiUrl)) {
            return ['ok' => false, 'status' => null, 'message' => "L'URL de l'API n'est pas renseignée."];
        }
        if (empty($apiKey)) {
            return ['ok' => false, 'status' => null, 'message' => "La clé API n'est pas renseignée."];
        }

        $endpoint = rtrim($apiUrl, '/') . '/mixed_people/api_search';

        Log::info('EnrichmentService::testConnection attempt', [
            'endpoint' => $endpoint,
            'key_hint' => substr($apiKey, 0, 4) . '…',
        ]);

        try {
            $response = Http::withHeaders([
                'X-Api-Key'    => $apiKey,
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ])->withoutVerifying()->timeout(15)->post($endpoint, [
                'page'     => 1,
                'per_page' => 1,
            ]);

            Log::info('EnrichmentService::testConnection response', [
                'status' => $response->status(),
                'body'   => substr($response->body(), 0, 800),
            ]);

            if ($response->successful()) {
                $data  = $response->json();
                $total = $data['pagination']['total_entries'] ?? null;
                $msg   = $total !== null
                    ? "Connexion réussie — {$total} contacts disponibles."
                    : 'Connexion réussie.';
                return ['ok' => true, 'status' => $response->status(), 'message' => $msg];
            }

            $body   = $response->json() ?? [];
            $detail = $body['message'] ?? $body['error'] ?? $response->body();
            if (strlen($detail) > 200) $detail = substr($detail, 0, 200) . '…';

            return ['ok' => false, 'status' => $response->status(), 'message' => "[HTTP {$response->status()}] {$detail}"];

        } catch (\Exception $e) {
            Log::error('EnrichmentService::testConnection exception', ['error' => $e->getMessage()]);
            return ['ok' => false, 'status' => null, 'message' => 'Impossible de joindre le service : ' . $e->getMessage()];
        }
    }

    /**
     * Vérifie si l'utilisateur dispose de crédits d'enrichissement.
     */
    public function checkUserCredits(int $userId): bool
    {
        $user = UserModel::find($userId);
        if (!$user) {
            return false;
        }

        // NULL = illimité
        if ($user->usr_enrichment_credits_limit === null) {
            return true;
        }

        $this->resetCreditsIfNewMonth($user);

        return $user->usr_enrichment_credits_used < $user->usr_enrichment_credits_limit;
    }

    /**
     * Consomme un crédit pour l'utilisateur.
     */
    public function consumeCredit(int $userId): void
    {
        $user = UserModel::find($userId);
        if (!$user || $user->usr_enrichment_credits_limit === null) {
            return;
        }

        $this->resetCreditsIfNewMonth($user);

        $user->increment('usr_enrichment_credits_used');
    }

    /**
     * Remet le compteur à zéro si on est dans un nouveau mois.
     */
    private function resetCreditsIfNewMonth(UserModel $user): void
    {
        $resetAt = $user->usr_enrichment_credits_reset_at;
        $now     = now();

        if (!$resetAt || $now->month !== \Carbon\Carbon::parse($resetAt)->month
                      || $now->year  !== \Carbon\Carbon::parse($resetAt)->year) {
            $user->update([
                'usr_enrichment_credits_used'     => 0,
                'usr_enrichment_credits_reset_at' => $now,
            ]);
        }
    }

    /**
     * Déclenche une révélation de numéro de mobile (asynchrone via webhook).
     */
    public function requestReveal(
        int    $userId,
        string $apolloPersonId,
        array  $personData,
        ?int   $contactId = null,
        ?int   $partnerId = null
    ): CrmRevealRequestModel {
        $config = $this->getConfig();

        $reveal = CrmRevealRequestModel::create([
            'fk_usr_id'            => $userId,
            'crr_apollo_person_id' => $apolloPersonId,
            'crr_person_firstname' => $personData['firstname'] ?? '',
            'crr_person_lastname'  => $personData['lastname'] ?? '',
            'crr_person_title'     => $personData['title'] ?? '',
            'crr_organization_name'=> $personData['organization_name'] ?? '',
            'crr_status'           => 'pending',
            'fk_ctc_id'            => $contactId,
            'fk_ptr_id'            => $partnerId,
        ]);

        $webhookUrl = config('app.url') . '/api/crm-enrichment/webhook';

        $payload = array_filter([
            'id'                  => $apolloPersonId,
            'reveal_phone_number' => true,
            'webhook_url'         => $webhookUrl,
        ]);

        if (!empty($personData['email'])) {
            $payload['email'] = $personData['email'];
        }
        if (!empty($personData['linkedin_url'])) {
            $payload['linkedin_url'] = $personData['linkedin_url'];
        }
        if (!empty($personData['organization_name'])) {
            $payload['organization_name'] = $personData['organization_name'];
        }

        $response = Http::withHeaders([
            'X-Api-Key'    => $config->crc_api_key,
            'Content-Type' => 'application/json',
            'Cache-Control' => 'no-cache',
        ])->timeout(30)->post(rtrim($config->crc_api_url, '/') . '/people/match', $payload);

        if (!$response->successful()) {
            Log::error('EnrichmentService::requestReveal error', [
                'crr_id' => $reveal->crr_id,
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            $reveal->update([
                'crr_status'        => 'error',
                'crr_error_message' => 'Erreur API : ' . $response->status(),
            ]);
        }

        return $reveal->fresh();
    }

    /**
     * Importe une personne et sa société dans le CRM sans doublon.
     *
     * Déduplication :
     *  - Société : ptr_external_id (Apollo org ID) → ptr_name → création
     *  - Contact  : ctc_external_id (Apollo person ID) → création
     *  - Lien     : insertOrIgnore sur contact_partner_ctp (clé unique)
     */
    public function importPerson(array $data, int $userId): array
    {
        return DB::transaction(function () use ($data, $userId) {
            // --- Société ---
            $orgExtId = $data['org_external_id'] ?? null;
            $orgName  = $data['org_name']         ?? null;
            $partner  = null;

            if ($orgExtId) {
                $partner = PartnerModel::where('ptr_external_id', $orgExtId)->first();
            }
            if (!$partner && $orgName) {
                $partner = PartnerModel::where('ptr_name', $orgName)->first();
            }
            if (!$partner && $orgName) {
                $partner = PartnerModel::create([
                    'ptr_name'         => $orgName,
                    'ptr_city'         => $data['org_city']      ?? '',
                    'ptr_headcount'    => $data['org_headcount']  ?? '',
                    'ptr_activity'     => $data['org_industry']   ?? '',
                    'ptr_is_prospect'  => true,
                    'ptr_is_customer'  => false,
                    'ptr_is_supplier'  => false,
                    'ptr_is_active'    => true,
                    'ptr_external_id'  => $orgExtId,
                    'fk_usr_id_author' => $userId,
                ]);
            }
            $ptrId = $partner?->ptr_id;

            // --- Contact ---
            $personExtId = $data['person_external_id'];
            $contact     = ContactModel::where('ctc_external_id', $personExtId)->first();
            $created     = false;

            if (!$contact) {
                $firstName = !empty($data['firstname']) ? $data['firstname'] : '';
                $lastName  = !empty($data['lastname'])  ? $data['lastname']  : '';
                $email     = !empty($data['email'])
                    ? $data['email']
                    : strtolower($firstName ?: 'contact') . '.' . strtolower($lastName ?: 'inconnu') . '@enrichissement.local';

                $contact = ContactModel::create([
                    'ctc_firstname'    => $firstName,
                    'ctc_lastname'     => $lastName ?: null,
                    'ctc_job_title'    => $data['title']  ?? '',
                    'ctc_email'        => $email,
                    'ctc_is_active'    => true,
                    'ctc_external_id'  => $personExtId,
                    'fk_ptr_id'        => $ptrId,
                    'fk_usr_id_author' => $userId,
                ]);
                $created = true;
            }

            // --- Lien contact ↔ société ---
            if ($ptrId) {
                DB::table('contact_partner_ctp')->insertOrIgnore([
                    'fk_ctc_id'   => $contact->ctc_id,
                    'fk_ptr_id'   => $ptrId,
                    'ctp_created' => now(),
                    'ctp_updated' => now(),
                ]);
            }

            // --- Mise à jour du reveal request si fourni ---
            if (!empty($data['crr_id'])) {
                CrmRevealRequestModel::where('crr_id', $data['crr_id'])->update([
                    'fk_ctc_id' => $contact->ctc_id,
                    'fk_ptr_id' => $ptrId,
                ]);
            }

            return [
                'ctc_id'  => $contact->ctc_id,
                'ptr_id'  => $ptrId,
                'created' => $created,
            ];
        });
    }

    /**
     * Enrichit les informations d'une organisation via l'API.
     * Consomme 1 crédit.
     */
    public function enrichOrganization(?string $domain = null, ?string $name = null): array
    {
        $config = $this->getConfig();

        if (empty($config->crc_api_url) || empty($config->crc_api_key)) {
            throw new \RuntimeException('Le service d\'enrichissement n\'est pas configuré.');
        }

        $params = array_filter([
            'domain' => $domain,
            'name'   => $name,
        ]);

        $response = Http::withHeaders([
            'X-Api-Key' => $config->crc_api_key,
            'Accept'    => 'application/json',
        ])->timeout(30)->get(rtrim($config->crc_api_url, '/') . '/organizations/enrich', $params);

        if (!$response->successful()) {
            Log::error('EnrichmentService::enrichOrganization error', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            throw new \RuntimeException('Erreur enrichissement organisation : ' . $response->status());
        }

        return $response->json() ?? [];
    }

    /**
     * Retourne les crédits restants de l'utilisateur.
     */
    public function getUserCreditsInfo(int $userId): array
    {
        $user = UserModel::find($userId);
        if (!$user) {
            return ['used' => 0, 'limit' => null, 'unlimited' => true];
        }

        $this->resetCreditsIfNewMonth($user);

        return [
            'used'      => (int) $user->usr_enrichment_credits_used,
            'limit'     => $user->usr_enrichment_credits_limit,
            'unlimited' => $user->usr_enrichment_credits_limit === null,
        ];
    }
}
