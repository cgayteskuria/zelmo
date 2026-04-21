<?php

namespace App\Services;

use GuzzleHttp\Client;
use League\OAuth2\Client\Provider\GenericProvider;
use PHPMailer\PHPMailer\OAuth;
use Exception;

class GoogleOAuth2Service
{
    public const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
    public const AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
    public const RESOURCE_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
    public const MAIL_SCOPE = ['https://mail.google.com/', 'openid', 'email'];

    /**
     * Crée un objet OAuth configuré pour PHPMailer (Gmail)
     */
    public function createOAuthForPHPMailer(
        string $clientId,
        string $clientSecret,
        string $refreshToken,
        string $userEmail
    ): OAuth {
        $provider = $this->createProvider($clientId, $clientSecret);
        return new OAuth([
            'provider'     => $provider,
            'clientId'     => $clientId,
            'clientSecret' => $clientSecret,
            'refreshToken' => $refreshToken,
            'userName'     => $userEmail,
        ]);
    }

    /**
     * Crée un provider OAuth2 pour Google
     */
    public function createProvider(
        string $clientId,
        string $clientSecret
    ): GenericProvider {
        return new GenericProvider(
            [
                'urlAuthorize'            => self::AUTHORIZE_ENDPOINT,
                'urlAccessToken'          => self::TOKEN_ENDPOINT,
                'urlResourceOwnerDetails' => self::RESOURCE_ENDPOINT,
                'clientId'                => $clientId,
                'clientSecret'            => $clientSecret,
            ],
            [
                'httpClient' => new \GuzzleHttp\Client([
                    'verify' => false
                ])
            ]
        );
    }

    /**
     * Obtient les tokens via le flux "authorization_code"
     */
    public function getTokensFromAuthorizationCode(
        string $clientId,
        string $clientSecret,
        string $authorizationCode,
        string $redirectUri
    ): array {
        $client = new Client(['verify' => false]);

        try {
            $response = $client->post(self::TOKEN_ENDPOINT, [
                'form_params' => [
                    'client_id'     => $clientId,
                    'client_secret' => $clientSecret,
                    'code'          => $authorizationCode,
                    'redirect_uri'  => $redirectUri,
                    'grant_type'    => 'authorization_code',
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
            throw new Exception("Erreur lors de l'obtention des tokens Google: " . $e->getMessage());
        }
    }

    /**
     * Rafraîchit le token OAuth2 Google
     */
    public function refreshToken(
        string $clientId,
        string $clientSecret,
        string $refreshToken
    ): array {
        $client = new Client(['verify' => false]);

        try {
            $response = $client->post(self::TOKEN_ENDPOINT, [
                'form_params' => [
                    'client_id'     => $clientId,
                    'client_secret' => $clientSecret,
                    'refresh_token' => $refreshToken,
                    'grant_type'    => 'refresh_token',
                ]
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            return [
                'access_token'  => $data['access_token'] ?? '',
                'refresh_token' => $data['refresh_token'] ?? $refreshToken,
                'expires_in'    => $data['expires_in'] ?? 3600,
                'expires_at'    => time() + ($data['expires_in'] ?? 3600),
            ];
        } catch (Exception $e) {
            throw new Exception("Erreur lors du rafraîchissement du token Google: " . $e->getMessage());
        }
    }

    /**
     * Vérifie si un token a expiré
     */
    public function isTokenExpired(int $expiresAt, int $bufferSeconds = 300): bool
    {
        return time() >= ($expiresAt - $bufferSeconds);
    }

    /**
     * Obtient un access_token valide (rafraîchit si nécessaire)
     */
    public function getValidAccessToken(
        string $clientId,
        string $clientSecret,
        string $refreshToken,
        ?int $currentExpiresAt = null
    ): array {
        if ($currentExpiresAt && !$this->isTokenExpired($currentExpiresAt)) {
            return [
                'access_token'  => null,
                'refresh_token' => $refreshToken,
                'expires_at'    => $currentExpiresAt,
                'refreshed'     => false,
            ];
        }

        $tokens = $this->refreshToken($clientId, $clientSecret, $refreshToken);

        return [
            'access_token'  => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'expires_at'    => $tokens['expires_at'],
            'refreshed'     => true,
        ];
    }
}