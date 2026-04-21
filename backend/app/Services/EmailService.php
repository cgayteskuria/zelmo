<?php

namespace App\Services;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\OAuth;
use Webklex\PHPIMAP\ClientManager;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use App\Models\MessageEmailAccountModel;
use Exception;

use Carbon\Carbon;

class EmailService
{
    private const IMAP_DEFAULT_PORT = 993;
    private const SMTP_DEFAULT_PORT = 587;
    private const CONNECTION_TIMEOUT = 10;
    private const SEND_TIMEOUT = 30;

    private OAuth2Service $oauthService;
    private GoogleOAuth2Service $googleOAuthService;

    /**
     * Constructeur avec injection du service OAuth2
     */
    public function __construct()
    {
        $this->oauthService = new OAuth2Service();
        $this->googleOAuthService = new GoogleOAuth2Service();
    }

    /**
     * Test la connexion IMAP et SMTP
     *
     * @param MessageEmailAccountModel $config
     * @return array
     */
    public function testConnection(MessageEmailAccountModel $config): array
    {
        $results = $this->initializeResults();

        try {
            // Validation des paramètres requis
            // $this->validateConfig($config);


            // Test SMTP via l'envoi d'un email de test
            $results['smtp_status'] = $this->testSmtpConnection($config);

            // Test IMAP
            $results['imap_status'] = $this->testImapConnection($config, false);

            // Résultat global
            $results['success'] = $results['imap_status'] && $results['smtp_status'];
            $results['message'] = $results['success']
                ? 'Connexion IMAP et SMTP établie avec succès'
                : 'Échec de connexion : ' . implode(' | ', $results['errors']);
        } catch (Exception $e) {
            $results['errors'][] = $e->getMessage();
            $results['message'] = 'Erreur lors du test de connexion : ' . $e->getMessage();
        }

        return $results;
    }

    /**
     * Envoie un email via PHPMailer
     *
     * @param MessageEmailAccountModel $emailAccount
     * @param string|array $to
     * @param string $subject
     * @param string $body
     * @param array $options Options supplémentaires (cc, bcc, attachments, etc.)
     * @return array
     */
    public function sendEmail(MessageEmailAccountModel $emailAccount, string|array $to, string $subject, string $body, array $options = []): array
    {
        try {

            $mail = $this->createMailer($emailAccount);

            // Configuration des destinataires
            if (is_array($to)) {
                foreach ($to as $address) {
                    $mail->addAddress(trim($address));
                }
            } else {
                $mail->addAddress($to);
            }

            if (!empty($options['cc'])) {
                foreach ((array)$options['cc'] as $cc) {
                    $mail->addCC($cc);
                }
            }

            if (!empty($options['bcc'])) {
                foreach ((array)$options['bcc'] as $bcc) {
                    $mail->addBCC($bcc);
                }
            }

            // Contenu
            $mail->isHTML($options['is_html'] ?? true);
            $mail->Subject = $subject;
            $mail->Body = $body;
            $mail->AltBody = $options['alt_body'] ?? strip_tags($body);

            // Pièces jointes
            if (!empty($options['attachments'])) {
                foreach ($options['attachments'] as $attachment) {
                    if (is_array($attachment)) {
                        $mail->addAttachment($attachment['path'], $attachment['name'] ?? '');
                    } else {
                        $mail->addAttachment($attachment);
                    }
                }
            }

            // Envoi
            $mail->send();

            return [
                'success' => true,
                'message' => 'Email envoyé avec succès'
            ];
        } catch (PHPMailerException $e) {
            Log::error('Erreur envoi email', [
                'account' => $emailAccount->eml_address,
                'to' => $to,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'envoi de l\'email : ' . $e->getMessage()
            ];
        } catch (Exception $e) {
            Log::error('Erreur OAuth2', [
                'account' => $emailAccount->eml_address,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'message' => 'Erreur OAuth2 : ' . $e->getMessage()
            ];
        }
    }

    /**
     * Rafraîchit le token OAuth2 si nécessaire et met à jour la BDD
     *
     * @param MessageEmailAccountModel $config
     * @return void
     * @throws Exception
     */
    private function refreshOAuthTokenIfNeeded(MessageEmailAccountModel $config): void
    {
        // Seulement pour les comptes OAuth2
        if (!in_array($config->eml_secure_mode, ['xoauth2', 'google_oauth2'])) {
            return;
        }

        // Vérifier si les champs OAuth2 sont présents
        if (empty($config->eml_refresh_token)) {
            throw new Exception("Configuration OAuth2 incomplète: refresh_token manquant");
        }

        if ($config->eml_secure_mode === 'xoauth2' && empty($config->eml_tenant_id)) {
            throw new Exception("Configuration OAuth2 incomplète: tenant_id manquant");
        }

        try {
            if ($config->eml_secure_mode === 'google_oauth2') {
                $tokenInfo = $this->googleOAuthService->getValidAccessToken(
                    $config->eml_client_id,
                    $this->decryptIfEncrypted($config->eml_client_secret),
                    $this->decryptIfEncrypted($config->eml_refresh_token),
                    $config->eml_access_token_expires_at
                );
            } else {
                $tokenInfo = $this->oauthService->getValidAccessToken(
                    $config->eml_tenant_id,
                    $config->eml_client_id,
                    $this->decryptIfEncrypted($config->eml_client_secret),
                    $this->decryptIfEncrypted($config->eml_refresh_token),
                    $config->eml_access_token_expires_at
                );
            }

            // Si le token a été rafraîchi, sauvegarder en BDD
            if ($tokenInfo['refreshed']) {
                // Mettre à jour le modèle ET la BDD
                $config->eml_access_token = $tokenInfo['access_token'];
                $config->eml_refresh_token = Crypt::encryptString($tokenInfo['refresh_token']);
                $config->eml_access_token_expires_at = $tokenInfo['expires_at'];
                $config->save();
            }
        } catch (Exception $e) {
            throw new Exception("Échec du rafraîchissement OAuth2 : " . $e->getMessage());
        }
    }

    /**
     * Crée et configure une instance PHPMailer
     *
     * @param MessageEmailAccountModel $config
     * @param int|null $timeout
     * @return PHPMailer
     * @throws PHPMailerException
     */
    private function createMailer(MessageEmailAccountModel $config, ?int $timeout = null): PHPMailer
    {
        try {
            // Rafraîchir le token OAuth2 si nécessaire AVANT d'envoyer
            $this->refreshOAuthTokenIfNeeded($config);


            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->isHTML(true);
            $mail->CharSet = 'UTF-8';
            $mail->SMTPAuth = true;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Timeout = $timeout ?? self::SEND_TIMEOUT;

            // Configuration SMTP de base
            $mail->Host = $config->eml_smtp_host;
            $mail->Port = $config->eml_smtp_port ?? self::SMTP_DEFAULT_PORT;
            $mail->Username = $config->eml_address;
            $senderAddress = !empty($config->eml_sender_alias) ? $config->eml_sender_alias : $config->eml_address;
            $mail->setFrom($senderAddress, $config->eml_label ?? '');

            // Authentification selon le mode
            if (in_array($config->eml_secure_mode, ['xoauth2', 'google_oauth2'])) {
                $mail->AuthType = 'XOAUTH2';
                $mail->Password = '';

                if ($config->eml_secure_mode === 'google_oauth2') {
                    $mail->setOAuth(
                        $this->googleOAuthService->createOAuthForPHPMailer(
                            $config->eml_client_id,
                            $this->decryptIfEncrypted($config->eml_client_secret),
                            $this->decryptIfEncrypted($config->eml_refresh_token),
                            $config->eml_address
                        )
                    );
                } else {
                    $mail->setOAuth(
                        $this->oauthService->createOAuthForPHPMailer(
                            $config->eml_tenant_id,
                            $config->eml_client_id,
                            $this->decryptIfEncrypted($config->eml_client_secret),
                            $this->decryptIfEncrypted($config->eml_refresh_token),
                            $config->eml_address
                        )
                    );
                }
            } else {
                $mail->Password = $this->decryptIfEncrypted($config->eml_password);
            }   

            return $mail;
        } catch (Exception $e) {

            throw new Exception("Échec du createMailer : " . $e->getMessage());
        }
    }

    /**
     * Test la connexion IMAP
     *
     * @param MessageEmailAccountModel $config
     * @param bool $returnArray Si true, retourne un array avec success/message
     * @return bool|array
     */
    public function testImapConnection(MessageEmailAccountModel $config, bool $returnArray = true): bool|array
    {
        try {
            $imapConfig = $this->buildImapConfig($config);
            $cm = new ClientManager();
            $client = $cm->make($imapConfig);

            $client->connect();
            $client->disconnect();

            if ($returnArray) {
                return [
                    'success' => true,
                    'message' => 'Connexion IMAP établie avec succès'
                ];
            }
            return true;
        } catch (Exception $e) {
            if ($returnArray) {
                return [
                    'success' => false,
                    'message' => "IMAP: " . $e->getMessage()
                ];
            }
            throw new Exception("IMAP: " . $e->getMessage());
        }
    }

    /**
     * Test la connexion SMTP en utilisant la méthode sendEmail
     *
     * @param MessageEmailAccountModel $config
     * @return bool
     * @throws Exception
     */
    private function testSmtpConnection(MessageEmailAccountModel $config): bool
    {
        try {
            $mail = $this->createMailer($config, self::CONNECTION_TIMEOUT);

            // Test de connexion sans envoi réel
            if (!$mail->smtpConnect()) {
                throw new Exception("Impossible d'établir la connexion SMTP");
            }

            $mail->smtpClose();
            return true;
        } catch (Exception $e) {
            throw new Exception("SMTP: " . $e->getMessage());
        }
    }

    /**
     * Construit la configuration IMAP à partir du modèle
     *
     * @param MessageEmailAccountModel $config
     * @return array
     */
    private function buildImapConfig(MessageEmailAccountModel $config): array
    {
        $secureMode = $config->eml_secure_mode ?? 'basic';

        $imapConfig = [
            'host'          => $config->eml_imap_host,
            'port'          => $config->eml_imap_port ?? self::IMAP_DEFAULT_PORT,
            'encryption'    => 'ssl',
            'validate_cert' => true,
            'username'      => $config->eml_address,
            'protocol'      => 'imap'
        ];

        // Configuration selon le mode d'authentification
        if (in_array($secureMode, ['xoauth2', 'google_oauth2'])) {
            // Rafraîchir le token OAuth2 si nécessaire AVANT de se connecter
            $this->refreshOAuthTokenIfNeeded($config);
            // Pour OAuth2, le password est le token brut
            $imapConfig['password']       = $config->eml_access_token;
            $imapConfig['authentication'] = 'oauth';
        } else {
            // Mode classique avec mot de passe (potentiellement chiffré en DB)
            $imapConfig['password'] = $this->decryptIfEncrypted($config->eml_password);
        }

        return $imapConfig;
    }
   
    /**
     * Décrypte une valeur si elle est cryptée
     *
     * @param string|null $value
     * @return string
     */
    private function decryptIfEncrypted(?string $value): string
    {
        if (empty($value)) {
            return '';
        }

        try {
            return Crypt::decryptString($value);
        } catch (Exception $e) {
            return $value;
        }
    }

    /**
     * Initialise le tableau de résultats
     *
     * @return array
     */
    private function initializeResults(): array
    {
        return [
            'success' => false,
            'imap_status' => false,
            'smtp_status' => false,
            'message' => '',
            'errors' => []
        ];
    }
  
}
