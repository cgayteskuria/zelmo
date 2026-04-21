<?php

namespace App\Services;

use GuzzleHttp\Client;
use League\OAuth2\Client\Provider\GenericProvider;
use PHPMailer\PHPMailer\OAuth;
use Exception;



class OAuth2Service
{
    public const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/%s/oauth2/v2.0/token';
    public const AUTHORIZE_ENDPOINT = 'https://login.microsoftonline.com/%s/oauth2/v2.0/authorize';
    public const RESOURCE_ENDPOINT = 'https://graph.microsoft.com/v1.0/me';
    public const MAIL_SCOPE =  ["offline_access", "https://outlook.office.com/SMTP.Send", "https://outlook.office.com/IMAP.AccessAsUser.All"];


    
    /**
     * Crée un objet OAuth configuré pour PHPMailer
     *
     * @param string $tenantId
     * @param string $clientId
     * @param string $clientSecret
     * @param string $refreshToken
     * @param string $userEmail
     * @return OAuth
     */
    public function createOAuthForPHPMailer(
        string $tenantId,
        string $clientId,
        string $clientSecret,
        string $refreshToken,
        string $userEmail
    ): OAuth {
        $provider = $this->createProvider($tenantId, $clientId, $clientSecret);       
        return new OAuth([
            'provider'     => $provider,
            'clientId'     => $clientId,
            'clientSecret' => $clientSecret,
            'refreshToken' => $refreshToken,
            'userName'     => $userEmail,
        ]);
    }

    /**
     * Crée un provider OAuth2 pour Microsoft 365
     *
     * @param string $tenantId
     * @param string $clientId
     * @param string $clientSecret
     * @return GenericProvider
     */
    public function createProvider(
        string $tenantId,
        string $clientId,
        string $clientSecret
    ): GenericProvider {
        return new GenericProvider(
            [
                'urlAuthorize'            => sprintf(self::AUTHORIZE_ENDPOINT, $tenantId),
                'urlAccessToken'          => sprintf(self::TOKEN_ENDPOINT, $tenantId),
                'urlResourceOwnerDetails' => self::RESOURCE_ENDPOINT,
                'clientId'                => $clientId,
                'clientSecret'            => $clientSecret,
            ],
            [
                'httpClient' => new \GuzzleHttp\Client([
                    'verify' => false // Options pour désactiver la vérification SSL
                ])
            ]
        );
    }

    /**
     * Génère les tokens OAuth2 pour Microsoft 365
     * ⚠️ ATTENTION: Le flux "client_credentials" ne fournit PAS de refresh_token
     * Utilisez plutôt le flux "authorization_code" pour obtenir un refresh_token
     *
     * @param string $tenantId
     * @param string $clientId
     * @param string $clientSecret
     * @return array
     * @throws Exception
     */
    public function generateTokens(
        string $tenantId,
        string $clientId,
        string $clientSecret
    ): array {
        $client = new Client(['verify' => false]); // ⚠️ À retirer en production

        try {
            $response = $client->post(sprintf(self::TOKEN_ENDPOINT, $tenantId), [
                'form_params' => [
                    'client_id'     => $clientId,
                    'client_secret' => $clientSecret,
                    'scope'         => self::MAIL_SCOPE,
                    'grant_type'    => 'client_credentials',
                ]
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            return [
                'access_token'  => $data['access_token'] ?? '',
                'refresh_token' => $data['refresh_token'] ?? '', // Vide avec client_credentials
                'expires_in'    => $data['expires_in'] ?? 3600,
                'expires_at'    => time() + ($data['expires_in'] ?? 3600),
            ];
        } catch (Exception $e) {
            throw new Exception("Erreur lors de la génération des tokens OAuth2: " . $e->getMessage());
        }
    }

    /**
     * Obtient les tokens via le flux "authorization_code" (recommandé pour avoir un refresh_token)
     *
     * @param string $tenantId
     * @param string $clientId
     * @param string $clientSecret
     * @param string $authorizationCode Code obtenu après autorisation de l'utilisateur
     * @param string $redirectUri L'URI de redirection configurée dans Azure AD
     * @return array
     * @throws Exception
     */
    public function getTokensFromAuthorizationCode(
        string $tenantId,
        string $clientId,
        string $clientSecret,
        string $authorizationCode,
        string $redirectUri
    ): array {
        $client = new Client(['verify' => false]); // ⚠️ À retirer en production

        try {
            $response = $client->post(sprintf(self::TOKEN_ENDPOINT, $tenantId), [
                'form_params' => [
                    'client_id'     => $clientId,
                    'client_secret' => $clientSecret,
                    'code'          => $authorizationCode,
                    'redirect_uri'  => $redirectUri,
                    'grant_type'    => 'authorization_code',
                    //'scope'         => 'https://outlook.office365.com/SMTP.Send offline_access',
                    'scope'         => self::MAIL_SCOPE,
                ]
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            return [
                'access_token'  => $data['access_token'] ?? '',
                'refresh_token' => $data['refresh_token'] ?? '',
                'expires_in'    => $data['expires_in'] ?? 3600,
                'expires_at'    => time() + ($data['expires_in'] ?? 3600),
            ];
        } catch (Exception $e) {
            throw new Exception("Erreur lors de l'obtention des tokens: " . $e->getMessage());
        }
    }

    /**
     * Rafraîchit le token OAuth2 et retourne le nouveau refresh_token
     *
     * @param string $tenantId
     * @param string $clientId
     * @param string $clientSecret
     * @param string $refreshToken
     * @return array
     * @throws Exception
     */
    public function refreshToken(
        string $tenantId,
        string $clientId,
        string $clientSecret,
        string $refreshToken
    ): array {
        $client = new Client(['verify' => false]); // ⚠️ À retirer en production

        try {
            $response = $client->post(sprintf(self::TOKEN_ENDPOINT, $tenantId), [
                'form_params' => [
                    'client_id'     => $clientId,
                    'client_secret' => $clientSecret,
                    'refresh_token' => $refreshToken,
                    'grant_type'    => 'refresh_token',
                    'scope'         => 'https://outlook.office365.com/SMTP.Send offline_access',
                ]
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            return [
                'access_token'  => $data['access_token'] ?? '',
                'refresh_token' => $data['refresh_token'] ?? $refreshToken, // Nouveau refresh_token
                'expires_in'    => $data['expires_in'] ?? 3600,
                'expires_at'    => time() + ($data['expires_in'] ?? 3600),
            ];
        } catch (Exception $e) {
            throw new Exception("Erreur lors du rafraîchissement du token: " . $e->getMessage());
        }
    }

    /**
     * Vérifie si un token a expiré
     *
     * @param int $expiresAt Timestamp d'expiration
     * @param int $bufferSeconds Marge de sécurité en secondes (par défaut 5 minutes)
     * @return bool
     */
    public function isTokenExpired(int $expiresAt, int $bufferSeconds = 300): bool
    {
        return time() >= ($expiresAt - $bufferSeconds);
    }

    /**
     * Obtient un access_token valide (rafraîchit si nécessaire)
     *
     * @param string $tenantId
     * @param string $clientId
     * @param string $clientSecret
     * @param string $refreshToken
     * @param int|null $currentExpiresAt
     * @return array ['access_token', 'refresh_token', 'expires_at']
     * @throws Exception
     */
    public function getValidAccessToken(
        string $tenantId,
        string $clientId,
        string $clientSecret,
        string $refreshToken,
        ?int $currentExpiresAt = null
    ): array {
        // Si le token est encore valide, on ne fait rien
        if ($currentExpiresAt && !$this->isTokenExpired($currentExpiresAt)) {
            return [
                'access_token'  => null, // Pas besoin de nouveau token
                'refresh_token' => $refreshToken,
                'expires_at'    => $currentExpiresAt,
                'refreshed'     => false,
            ];
        }

        // Rafraîchissement nécessaire
        $tokens = $this->refreshToken($tenantId, $clientId, $clientSecret, $refreshToken);

        return [
            'access_token'  => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'expires_at'    => $tokens['expires_at'],
            'refreshed'     => true,
        ];
    }
}
