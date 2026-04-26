<?php

namespace App\Services\EInvoicing;

use App\Models\EInvoicingConfigModel;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\Log;

class PdpHttpClient
{
    private Client $client;
    private EInvoicingConfigModel $config;

    public function __construct(EInvoicingConfigModel $config)
    {
        $this->config = $config;

        $this->client = new Client([
            'base_uri'        => rtrim($config->eic_api_url ?? '', '/') . '/',
            'timeout'         => 30,
            'connect_timeout' => 10,
            'http_errors'     => false,
        ]);
    }

    /**
     * Retourne l'URL du endpoint OAuth2 /token.
     * Si eic_token_url est vide, tente une auto-discovery OIDC depuis l'URL de l'API.
     */
    private function resolveTokenUrl(): string
    {
        if (!empty($this->config->eic_token_url)) {
            return $this->config->eic_token_url;
        }

        $apiUrl = rtrim($this->config->eic_api_url ?? '', '/');
        if (!$apiUrl) {
            throw new \RuntimeException("L'URL de l'API PA n'est pas configurée.");
        }

        $httpClient = new Client(['http_errors' => false, 'timeout' => 10]);

        // 1. OIDC discovery directement sur l'URL de l'API
        $res = $httpClient->get($apiUrl . '/.well-known/openid-configuration');
        if ($res->getStatusCode() === 200) {
            $data = json_decode((string) $res->getBody(), true);
            if (!empty($data['token_endpoint'])) {
                return $data['token_endpoint'];
            }
        }

        // 2. Pattern Iopole : api.{env}.iopole.fr → auth.{env}.iopole.fr/realms/iopole
        if (preg_match('/^(https?:\/\/)api\.(.+)$/', $apiUrl, $m)) {
            $discoveryUrl = $m[1] . 'auth.' . rtrim($m[2], '/') . '/realms/iopole/.well-known/openid-configuration';
            $res = $httpClient->get($discoveryUrl);
            if ($res->getStatusCode() === 200) {
                $data = json_decode((string) $res->getBody(), true);
                if (!empty($data['token_endpoint'])) {
                    Log::channel('stack')->debug('PA OIDC token URL découverte', ['token_endpoint' => $data['token_endpoint']]);
                    return $data['token_endpoint'];
                }
            }
        }

        throw new \RuntimeException(
            "Impossible de découvrir automatiquement l'URL OAuth2 depuis {$apiUrl}.\n"
            . "Renseignez le champ « URL OAuth2 (Token URL) » dans les paramètres avancés."
        );
    }

    private function getToken(): string
    {
        // Retourner le token en cache s'il est encore valide (avec 60s de marge)
        if ($this->config->eic_oauth_token && $this->config->eic_oauth_expires_at) {
            if ($this->config->eic_oauth_expires_at->gt(now()->addSeconds(60))) {
                return $this->config->eic_oauth_token;
            }
        }

        $tokenUrl     = $this->resolveTokenUrl();
        $clientId     = $this->config->eic_client_id;
        $clientSecret = $this->config->eic_client_secret;

        if (!$clientId || !$clientSecret) {
            throw new \RuntimeException(
                'Configuration OAuth2 incomplète — renseignez le Client ID et le Client Secret dans les paramètres.'
            );
        }

        $response = (new Client(['http_errors' => false, 'timeout' => 15]))->post($tokenUrl, [
            'form_params' => [
                'grant_type'    => 'client_credentials',
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
            ],
        ]);

        $body = json_decode((string) $response->getBody(), true);

        if ($response->getStatusCode() >= 400 || empty($body['access_token'])) {
            $err = $body['error_description'] ?? $body['error'] ?? 'réponse inattendue';
            throw new \RuntimeException("OAuth2 token exchange échoué ({$response->getStatusCode()}): {$err}");
        }

        $token     = $body['access_token'];
        $expiresIn = (int) ($body['expires_in'] ?? 3600);

        $this->config->updateQuietly([
            'eic_oauth_token'      => $token,
            'eic_oauth_expires_at' => now()->addSeconds($expiresIn),
        ]);
        $this->config->refresh();

        Log::channel('stack')->debug('PA OAuth2 token renouvelé', ['expires_in' => $expiresIn]);

        return $token;
    }

    /**
     * Force un nouveau token exchange (ignore le cache) et vérifie l'accessibilité de l'API.
     * Lance une RuntimeException avec un message lisible en cas d'échec.
     */
    public function testCredentials(): string
    {
        $clientId     = $this->config->eic_client_id;
        $clientSecret = $this->config->eic_client_secret;
        $apiUrl       = $this->config->eic_api_url;

        if (!$apiUrl || !$clientId || !$clientSecret) {
            throw new \RuntimeException(
                'Configuration incomplète — renseignez l\'URL de l\'API, le Client ID et le Client Secret.'
            );
        }

        // Résolution de l'URL OAuth2 (token URL explicite ou auto-discovery OIDC)
        $tokenUrl = $this->resolveTokenUrl();

        $httpClient = new Client(['http_errors' => false, 'timeout' => 15]);

        $response = $httpClient->post($tokenUrl, [
            'form_params' => [
                'grant_type'    => 'client_credentials',
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
            ],
        ]);

        $status  = $response->getStatusCode();
        $rawBody = (string) $response->getBody();
        $body    = json_decode($rawBody, true);

        if ($status >= 400 || empty($body['access_token'])) {
            $err = null;
            if (is_array($body)) {
                $err = $body['error_description'] ?? $body['error'] ?? $body['message'] ?? null;
            }
            if (!$err) {
                $err = preg_match('/<pre[^>]*>(.*?)<\/pre>/is', $rawBody, $m)
                    ? trim(strip_tags($m[1]))
                    : "HTTP {$status}";
            }
            throw new \RuntimeException(
                "Authentification OAuth2 échouée ({$status}) : {$err}.\n"
                . "URL testée : {$tokenUrl}\n"
                . "Vérifiez le Client ID et le Client Secret dans les paramètres."
            );
        }

        $token = $body['access_token'];

        // 2. Tester un appel à l'API PA avec le nouveau token
        $testClient = new Client(['base_uri' => rtrim($apiUrl, '/') . '/', 'http_errors' => false, 'timeout' => 15]);
        $headers = ['Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'];
        if (!empty($this->config->eic_customer_id)) {
            $headers['customer-id'] = $this->config->eic_customer_id;
        }

        $apiResponse = $testClient->get('v1/status', ['headers' => $headers]);
        $apiStatus   = $apiResponse->getStatusCode();
        $apiBody     = (string) $apiResponse->getBody();

        // 404 sur /v1/status = PA ne connaît pas cet endpoint mais les credentials sont valides
        if ($apiStatus === 401 || $apiStatus === 403) {
            throw new \RuntimeException(
                "Accès refusé ({$apiStatus}) — le token est obtenu mais le PA rejette la requête.\n"
                . "Vérifiez le Customer ID et les permissions du compte."
            );
        }

        return 'Connexion au PA établie avec succès.';
    }

    public function get(string $path, array $query = []): array
    {
        return $this->request('GET', $path, ['query' => $query]);
    }

    public function post(string $path, array $body = []): array
    {
        return $this->request('POST', $path, ['json' => $body]);
    }

    public function postMultipart(string $path, array $multipart): array
    {
        return $this->request('POST', $path, ['multipart' => $multipart]);
    }

    private function request(string $method, string $path, array $options = []): array
    {
        $token = $this->getToken();

        $options['headers'] = [
            'Authorization' => 'Bearer ' . $token,
            'Accept'        => 'application/json',
        ];

        if (!empty($this->config->eic_customer_id)) {
            $options['headers']['customer-id'] = $this->config->eic_customer_id;
        }

        $attempts = 0;
        $maxRetry = 2;

        while ($attempts <= $maxRetry) {
            try {
                $response = $this->client->request($method, ltrim($path, '/'), $options);
                $status   = $response->getStatusCode();
                $body     = (string) $response->getBody();

                Log::channel('stack')->debug('PA HTTP ' . $method . ' ' . $path, [
                    'status' => $status,
                    'body'   => substr($body, 0, 500),
                ]);

                if ($status === 503 && $attempts < $maxRetry) {
                    $attempts++;
                    sleep(2);
                    continue;
                }

                $decoded = json_decode($body, true);

                if ($status >= 400) {
                    throw new \RuntimeException(
                        $this->buildErrorMessage($status, $method, $path, $decoded, $body)
                    );
                }

                return $decoded ?? [];
            } catch (RequestException $e) {
                Log::channel('stack')->error('PA HTTP exception', [
                    'method'  => $method,
                    'path'    => $path,
                    'message' => $e->getMessage(),
                ]);
                throw new \RuntimeException('Connexion au PA impossible: ' . $e->getMessage(), 0, $e);
            }
        }

        throw new \RuntimeException('PA API indisponible après ' . $maxRetry . ' tentatives.');
    }

    private function buildErrorMessage(int $status, string $method, string $path, ?array $decoded, string $body): string
    {
        // Réponse JSON du PA → utiliser son propre message
        if ($decoded !== null) {
            $msg = $decoded['message'] ?? $decoded['error'] ?? $decoded['error_description'] ?? null;
            if ($msg) {
                return "Erreur {$status} du PA : {$msg}";
            }
        }

        // Réponse HTML (page d'erreur Express/Nginx) → extraire le texte de la balise <pre> si présente
        if (str_contains($body, '<html') || str_contains($body, '<!DOCTYPE')) {
            $preText = null;
            if (preg_match('/<pre[^>]*>(.*?)<\/pre>/is', $body, $m)) {
                $preText = trim(strip_tags($m[1]));
            }

            $endpoint = strtoupper($method) . ' ' . $path;

            if ($status === 404) {
                $detail = $preText ? " ({$preText})" : '';
                return "Endpoint introuvable sur le PA : {$endpoint}{$detail}.\n"
                    . "Vérifiez l'URL de l'API dans Paramètres → Facturation Électronique → onglet Connexion PA.";
            }

            if ($status === 401 || $status === 403) {
                return "Accès refusé ({$status}) sur {$endpoint}.\n"
                    . "Vérifiez le Client ID et le Client Secret dans Paramètres → Facturation Électronique.";
            }

            $detail = $preText ?? "réponse HTML inattendue";
            return "Erreur {$status} du PA sur {$endpoint} : {$detail}.";
        }

        // Texte brut ou autre
        return "Erreur {$status} du PA ({$method} {$path}) : " . substr($body, 0, 300);
    }

    public function downloadBinary(string $path): string
    {
        $token = $this->getToken();

        $headers = ['Authorization' => 'Bearer ' . $token];
        if (!empty($this->config->eic_customer_id)) {
            $headers['customer-id'] = $this->config->eic_customer_id;
        }

        $response = $this->client->get(ltrim($path, '/'), ['headers' => $headers]);

        if ($response->getStatusCode() >= 400) {
            throw new \RuntimeException('Téléchargement fichier PA échoué: ' . $response->getStatusCode());
        }

        return (string) $response->getBody();
    }
}
