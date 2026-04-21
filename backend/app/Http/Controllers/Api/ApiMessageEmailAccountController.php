<?php

namespace App\Http\Controllers\Api;

use App\Models\MessageEmailAccountModel;

use App\Services\EmailService;
use App\Services\EmailAutoDetectService;
use App\Services\OAuth2Service;
use App\Services\GoogleOAuth2Service;
use App\Traits\HasGridFilters;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Crypt;

use App\Models\SaleConfigModel;
use App\Models\InvoiceConfigModel;
use App\Models\CompanyModel;

use Carbon\Carbon;

class ApiMessageEmailAccountController extends Controller
{
    use HasGridFilters;

    protected $emailService;
    protected $autoDetectService;
    protected $oauth2Service;
    protected $googleOAuth2Service;

    public function __construct(
        EmailService $emailService,
        EmailAutoDetectService $autoDetectService,
        OAuth2Service $oauth2Service,
        GoogleOAuth2Service $googleOAuth2Service
    ) {
        $this->emailService = $emailService;
        $this->autoDetectService = $autoDetectService;
        $this->oauth2Service = $oauth2Service;
        $this->googleOAuth2Service = $googleOAuth2Service;
    }

    public function index(Request $request)
    {
        $gridKey = 'message-email-accounts';

        // --- Gestion des grid settings ---
        if (!$request->has('sort_by')) {
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

        $query = MessageEmailAccountModel::with(['author:usr_id,usr_firstname,usr_lastname']);

        $this->applyGridFilters($query, $request, [
            'eml_label'   => 'eml_label',
            'eml_address' => 'eml_address',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'          => 'eml_id',
            'eml_label'   => 'eml_label',
            'eml_address' => 'eml_address',
        ], 'eml_label', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $data = $query->get();

        $data->transform(function ($item) {
            $item->id = $item->eml_id;
            return $item;
        });

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'eml_label'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $data,
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Retourne la liste des comptes email pour les selects
     * Filtres disponibles: sale, invoice, company (défaut)
     */
    public function options(Request $request)
    {
        $query = MessageEmailAccountModel::query()
            ->select('eml_id as id', 'eml_label as label');

        $query->where(function ($q) use ($request) {

            $hasFilter = false;

            if ($request->boolean('sale')) {
                $emailId = SaleConfigModel::value('fk_eml_id');
                if ($emailId) {
                    $q->orWhere('eml_id', $emailId);
                    $hasFilter = true;
                }
            }

            if ($request->boolean('invoice')) {
                $emailId = InvoiceConfigModel::value('fk_eml_id');
                if ($emailId) {
                    $q->orWhere('eml_id', $emailId);
                    $hasFilter = true;
                }
            }

            if ($request->boolean('company')) {
                $emailId = CompanyModel::value('fk_eml_id_default');
                if ($emailId) {
                    $q->orWhere('eml_id', $emailId);
                    $hasFilter = true;
                }
            }

            /**          
             * si aucun filtre → on ne met rien
             * sinon Laravel ferait un where() vide
             */
            if (!$hasFilter) {
                $q->orWhereRaw('1 = 1');
            }
        });

        return response()->json([
            'data' => $query->orderBy('eml_label')->get()
        ]);
    }


    /**
     * Récupérer un compte email spécifique
     */
    public function show($id)
    {
        $emailAccount = MessageEmailAccountModel::findOrFail($id);

        // Déchiffrer le mot de passe si présent
        if ($emailAccount->eml_password) {
            try {
                $emailAccount->eml_password = Crypt::decryptString($emailAccount->eml_password);
            } catch (\Exception $e) {
                // Si le déchiffrement échoue, on laisse le champ vide
                $emailAccount->eml_password = '';
            }
        }

        // Déchiffrer le client_secret si présent
        if ($emailAccount->eml_client_secret) {
            try {
                $emailAccount->eml_client_secret = Crypt::decryptString($emailAccount->eml_client_secret);
            } catch (\Exception $e) {
                $emailAccount->eml_client_secret = '';
            }
        }

        return response()->json([
            'data' => $emailAccount
        ], 200);
    }

    /**
     * Créer un compte email
     */
    public function store(Request $request)
    {
        $validator = Validator::make(
            $request->all(),
            [
                'eml_label' => 'required|string|max:100',
                'eml_address' => 'required|email|max:255|unique:message_email_account_eml,eml_address',
                'eml_secure_mode' => 'required|in:basic,xoauth2,google_oauth2',
                'eml_password' => 'nullable|string|max:255',
                'eml_imap_host' => 'nullable|string|max:255',
                'eml_imap_port' => 'nullable|integer',
                'eml_smtp_host' => 'nullable|string|max:255',
                'eml_smtp_port' => 'nullable|integer',
                'eml_tenant_id' => 'nullable|string|max:255',
                'eml_client_id' => 'nullable|string|max:255',
                'eml_client_secret' => 'nullable|string|max:255',
                'eml_sender_alias' => 'nullable|email|max:255',
                // 'eml_access_token' => 'nullable|string',
                // 'eml_refresh_token' => 'nullable|string',
            ],
            [
                // Messages personnalisés
                'eml_address.unique' => 'Cette adresse email est déjà utilisée. Veuillez en saisir une autre.',
                'eml_address.required' => 'L\'adresse email est obligatoire.',
                'eml_address.email' => 'Veuillez entrer une adresse email valide.',
                'eml_label.required' => 'Le libellé est obligatoire.',
                'eml_secure_mode.required' => 'Le mode de sécurité est obligatoire.',
                'eml_sender_alias.email' => 'L\'alias d\'expédition doit être une adresse email valide.',
            ]
        );
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();

        try {
            $data = [
                'eml_label' => $request->eml_label,
                'eml_address' => $request->eml_address,
                'eml_secure_mode' => $request->eml_secure_mode,
                'eml_imap_host' => $request->eml_imap_host,
                'eml_imap_port' => $request->eml_imap_port,
                'eml_smtp_host' => $request->eml_smtp_host,
                'eml_smtp_port' => $request->eml_smtp_port,
                'eml_sender_alias' => $request->eml_sender_alias,
                'fk_usr_id_author' => $userId,
            ];

            // Chiffrer le mot de passe si présent
            if ($request->eml_password) {
                $data['eml_password'] = Crypt::encryptString($request->eml_password);
            }

            // Ajouter les champs OAuth2 si mode xoauth2
            if ($request->eml_secure_mode === 'xoauth2') {
                $data['eml_tenant_id'] = $request->eml_tenant_id;
                $data['eml_client_id'] = $request->eml_client_id;

                if ($request->eml_client_secret) {
                    $data['eml_client_secret'] = Crypt::encryptString($request->eml_client_secret);
                }
            }

            // Ajouter les champs OAuth2 si mode google_oauth2
            if ($request->eml_secure_mode === 'google_oauth2') {
                $data['eml_client_id'] = $request->eml_client_id;

                if ($request->eml_client_secret) {
                    $data['eml_client_secret'] = Crypt::encryptString($request->eml_client_secret);
                }
            }

            $emailAccount = MessageEmailAccountModel::create($data);

            return response()->json([
                'data' => $emailAccount
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mettre à jour un compte email
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'eml_label' => 'required|string|max:100',
            'eml_address' => 'required|email|max:255|unique:message_email_account_eml,eml_address,' . $id . ',eml_id',
            'eml_secure_mode' => 'required|in:basic,xoauth2,google_oauth2',
            'eml_password' => 'nullable|string|max:255',
            'eml_imap_host' => 'nullable|string|max:255',
            'eml_imap_port' => 'nullable|integer',
            'eml_smtp_host' => 'nullable|string|max:255',
            'eml_smtp_port' => 'nullable|integer',
            'eml_tenant_id' => 'nullable|string|max:255',
            'eml_client_id' => 'nullable|string|max:255',
            'eml_client_secret' => 'nullable|string|max:255',
            'eml_sender_alias' => 'nullable|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()
            ], 422);
        }

        $userId = Auth::id();

        try {
            $emailAccount = MessageEmailAccountModel::findOrFail($id);

            $data = [
                'eml_label' => $request->eml_label,
                'eml_address' => $request->eml_address,
                'eml_secure_mode' => $request->eml_secure_mode,
                'eml_imap_host' => $request->eml_imap_host,
                'eml_imap_port' => $request->eml_imap_port,
                'eml_smtp_host' => $request->eml_smtp_host,
                'eml_smtp_port' => $request->eml_smtp_port,
                'eml_sender_alias' => $request->eml_sender_alias,
                'fk_usr_id_updater' => $userId,
            ];

            // Chiffrer le mot de passe si présent et modifié
            if ($request->has('eml_password') && !empty($request->eml_password)) {
                $data['eml_password'] = Crypt::encryptString($request->eml_password);
            }

            // Ajouter les champs OAuth2 si mode xoauth2
            if ($request->eml_secure_mode === 'xoauth2') {
                $emailAutoDetectService = new EmailAutoDetectService();
                $config = $emailAutoDetectService->getProviderConfig('outlook.com');
                $data['eml_imap_host'] = $config["imap_host"];
                $data['eml_imap_port'] = $config["imap_port"];
                $data['eml_smtp_host'] = $config["smtp_host"];
                $data['eml_smtp_port'] = $config["smtp_port"];

                $data['eml_tenant_id'] = $request->eml_tenant_id;
                $data['eml_client_id'] = $request->eml_client_id;

                if ($request->has('eml_client_secret') && !empty($request->eml_client_secret)) {
                    $data['eml_client_secret'] = Crypt::encryptString($request->eml_client_secret);
                }
            } elseif ($request->eml_secure_mode === 'google_oauth2') {
                $emailAutoDetectService = new EmailAutoDetectService();
                $config = $emailAutoDetectService->getProviderConfig('gmail.com');
                $data['eml_imap_host'] = $config["imap_host"];
                $data['eml_imap_port'] = $config["imap_port"];
                $data['eml_smtp_host'] = $config["smtp_host"];
                $data['eml_smtp_port'] = $config["smtp_port"];

                $data['eml_tenant_id'] = null;
                $data['eml_client_id'] = $request->eml_client_id;

                if ($request->has('eml_client_secret') && !empty($request->eml_client_secret)) {
                    $data['eml_client_secret'] = Crypt::encryptString($request->eml_client_secret);
                }
            } else {
                // Si on passe en mode basic, vider les champs OAuth2
                $data['eml_tenant_id'] = null;
                $data['eml_client_id'] = null;
                $data['eml_client_secret'] = null;
                $data['eml_access_token'] = null;
                $data['eml_refresh_token'] = null;
            }

            $emailAccount->update($data);

            return response()->json([
                'success' => true,
                'data' => ["eml_id" => $emailAccount->eml_id]
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer un compte email
     */
    public function destroy($id)
    {
        try {
            $emailAccount = MessageEmailAccountModel::findOrFail($id);
            $emailAccount->delete();

            return response()->json([
                'success' => true,
                'message' => 'Compte email supprimé avec succès'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Test de connexion email
     */
   /* public function testConnection(Request $request)
    {
        $validator =  $request->validate([
            'eml_id' => 'required|int',
        ]);

        try {
            $config = MessageEmailAccountModel::findOrFail($validator["eml_id"]);

            $result = $this->emailService->testConnection($config);

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors du test de connexion ' .  $e->getMessage(),
                'error' => $e->getMessage(),
                'details' => $e->getTraceAsString()
            ], 500);
        }
    }*/

    /**
     * Auto-détection des serveurs email
     */
    public function autoDetectServers(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Email invalide'
            ], 422);
        }

        try {
            $servers = $this->autoDetectService->detectServers($request->email);

            return response()->json([
                'success' => true,
                'imap_host' => $servers['imap_host'],
                'imap_port' => $servers['imap_port'],
                'smtp_host' => $servers['smtp_host'],
                'smtp_port' => $servers['smtp_port'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Impossible de détecter les serveurs',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Génère l'URL d'autorisation Microsoft OAuth2
     */
    public function getOAuthAuthorizationUrl(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|string',
            'client_id' => 'required|string',
            'redirect_uri' => 'required|url',
            'email' => 'nullable|email',
            'state' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        try {

            $scopes = implode(' ',  OAuth2Service::MAIL_SCOPE);

            $params = http_build_query([
                'client_id' => $request->client_id,
                'response_type' => 'code',
                'redirect_uri' => $request->redirect_uri,
                'response_mode' => 'query',
                'scope' => $scopes,
                'state' => $request->state ?? '',
                'login_hint' => $request->email ?? '',
            ]);

            $authUrl =  sprintf(OAuth2Service::AUTHORIZE_ENDPOINT, $request->tenant_id) . "?{$params}";

            return response()->json([
                'success' => true,
                'auth_url' => $authUrl
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération de l\'URL: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Test complet d'envoi et réception d'email avec streaming
     */
    public function sendTestEmail(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'eml_id' => 'required|exists:message_email_account_eml,eml_id',
            'test_email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        // Configuration pour le streaming
        set_time_limit(120);

        return response()->stream(function () use ($request) {
            // Désactiver le buffering pour le streaming
            if (ob_get_level()) ob_end_clean();

            $sendLine = function ($text, $type = 'info') {
                $data = json_encode([
                    'type' => $type,
                    'message' => $text,
                    'timestamp' => date('H:i:s')
                ]);
                echo "data: {$data}\n\n";
                flush();
            };

            try {
                $sendLine('Lancement du test...', 'info');

                $account = MessageEmailAccountModel::findOrFail($request->eml_id);
                $testEmail = $request->test_email;

                // Générer un email unique avec timestamp pour le test
                $timestamp = time();
                $testSubject = "Test Zelmo - " . date('Y-m-d H:i:s');
                $testBody = "Ceci est un email de test envoyé depuis Zelmo.\n\nTimestamp: {$timestamp}";

                $sendLine('Test d\'envoi en cours...', 'sending');

                // Envoyer l'email
                $result = $this->emailService->sendEmail(
                    $account,
                    $testEmail,
                    $testSubject,
                    $testBody
                );

                if (!$result['success']) {
                    $sendLine('Erreur lors de l\'envoi: ' . $result['message'], 'error');
                    $sendLine(json_encode(['success' => false, 'smtp_status' => false]), 'result');
                    return;
                }

                $sendLine("Message envoyé à {$testEmail}", 'success');
                $sendLine('Test de réception en cours...', 'receiving');

                // Tester la connexion IMAP
                $imapResult = $this->emailService->testImapConnection($account);

                if ($imapResult['success']) {
                    $sendLine('Connexion IMAP établie', 'success');
                } else {
                    $sendLine('Erreur IMAP: ' . $imapResult['message'], 'error');
                }

                $sendLine('Test terminé !', 'complete');

                // Résultat final
                /*$finalResult = [
                    'success' => $result['success'] && $imapResult['success'],
                    'smtp_status' => $result['success'],
                    'imap_status' => $imapResult['success'],
                    'message' => 'Test complet réalisé'
                ];*/
                // $sendLine(json_encode($finalResult), 'result');
            } catch (\Exception $e) {
                $sendLine('Erreur: ' . $e->getMessage(), 'error');
                $sendLine(json_encode([
                    'success' => false,
                    'message' => $e->getMessage()
                ]), 'result');
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Échange le code d'autorisation contre les tokens OAuth2
     */
    public function exchangeOAuthCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'eml_id' => 'required|exists:message_email_account_eml,eml_id',
            'tenant_id' => 'required|string',
            'client_id' => 'required|string',
            'client_secret' => 'required|string',
            'code' => 'required|string',
            'redirect_uri' => 'required|url',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        try {
            $oauth2Service = new OAuth2Service();

            $tokens = $oauth2Service->getTokensFromAuthorizationCode(
                $request->tenant_id,
                $request->client_id,
                $request->client_secret,
                $request->code,
                $request->redirect_uri
            );

            // Mettre à jour le compte email avec les tokens
            $account = MessageEmailAccountModel::findOrFail($request->eml_id);
            $account->eml_access_token = $tokens['access_token'];
            $account->eml_refresh_token = Crypt::encryptString($tokens['refresh_token']);
            $account->eml_access_token_expires_at = $tokens['expires_at'];

            $account->save();

            return response()->json([
                'success' => true,
                'access_token' => $tokens['access_token'],
                'refresh_token' => $tokens['refresh_token'],
                'expires_at' => $tokens['expires_at'],
                'message' => 'Tokens OAuth2 générés avec succès'
            ]);
        } catch (\Exception $e) {

            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de l\'échange du code : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Génère l'URL d'autorisation Google OAuth2
     */
    public function getGoogleOAuthAuthorizationUrl(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'client_id' => 'required|string',
            'redirect_uri' => 'required|url',
            'email' => 'nullable|email',
            'state' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        try {
            $scopes = implode(' ', GoogleOAuth2Service::MAIL_SCOPE);

            $params = http_build_query([
                'client_id' => $request->client_id,
                'response_type' => 'code',
                'redirect_uri' => $request->redirect_uri,
                'scope' => $scopes,
                'access_type' => 'offline',
                'prompt' => 'consent',
                'state' => $request->state ?? '',
                'login_hint' => $request->email ?? '',
            ]);

            $authUrl = GoogleOAuth2Service::AUTHORIZE_ENDPOINT . "?{$params}";

            return response()->json([
                'success' => true,
                'auth_url' => $authUrl
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la génération de l\'URL Google: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Échange le code d'autorisation Google contre les tokens OAuth2
     */
    public function exchangeGoogleOAuthCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'eml_id' => 'required|exists:message_email_account_eml,eml_id',
            'client_id' => 'required|string',
            'client_secret' => 'required|string',
            'code' => 'required|string',
            'redirect_uri' => 'required|url',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        try {
            $tokens = $this->googleOAuth2Service->getTokensFromAuthorizationCode(
                $request->client_id,
                $request->client_secret,
                $request->code,
                $request->redirect_uri
            );

            // Mettre à jour le compte email avec les tokens
            $account = MessageEmailAccountModel::findOrFail($request->eml_id);
            $account->eml_access_token = $tokens['access_token'];
            $account->eml_refresh_token = Crypt::encryptString($tokens['refresh_token']);
            $account->eml_access_token_expires_at = $tokens['expires_at'];

            $account->save();

            return response()->json([
                'success' => true,
                'access_token' => $tokens['access_token'],
                'refresh_token' => $tokens['refresh_token'],
                'expires_at' => $tokens['expires_at'],
                'message' => 'Tokens Google OAuth2 générés avec succès'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de l\'échange du code Google: ' . $e->getMessage()
            ], 500);
        }
    }
}
