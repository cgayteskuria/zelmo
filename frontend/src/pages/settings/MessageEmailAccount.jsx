import { useState, useEffect, useRef, useMemo } from "react";
import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Space, Select, Divider, Alert, Tag, Tooltip, Modal } from "antd";
import { message } from '../../utils/antdStatic';
import { DeleteOutlined, SaveOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, InfoCircleOutlined, SendOutlined, LoadingOutlined, MailOutlined } from "@ant-design/icons";
import { messageEmailAccountsApi } from "../../services/api";
import { getToken } from "../../services/auth";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

/**
 * Composant MessageEmailAccount
 * Formulaire d'édition dans un Drawer avec support de deux modes d'authentification
 */
export default function MessageEmailAccount({ emailAccountId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [secureMode, setSecureMode] = useState("basic");
    const [testStatus, setTestStatus] = useState(null); // null, 'testing', 'success', 'error'
    const [testResult, setTestResult] = useState(null);
    const [lastTestDate, setLastTestDate] = useState(null);
    const [requireOAuth, setRequireOAuth] = useState(false);

    const [oauthWindow, setOauthWindow] = useState(null);
    const [oauthErrorMessage, setOauthErrorMessage] = useState(null);
    const [isWaitingForOAuth, setIsWaitingForOAuth] = useState(false);

    // États pour le modal de test avec envoi d'email
    const [testModalOpen, setTestModalOpen] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const [testLogs, setTestLogs] = useState([]);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const eventSourceRef = useRef(null);

    const pageLabel = Form.useWatch("eml_label", form);

    // Watchers pour la validation du bouton "Tester la connexion"
    const watchedRefreshToken = Form.useWatch("eml_refresh_token", form);
    const watchedPassword = Form.useWatch("eml_password", form);
    const watchedImapHost = Form.useWatch("eml_imap_host", form);
    const watchedSmtpHost = Form.useWatch("eml_smtp_host", form);
    const watchedAddress = Form.useWatch("eml_address", form);

    /**
     * Determine si le bouton "Tester la connexion" doit etre actif
     */
    const canTestConnection = useMemo(() => {
        if (secureMode === "xoauth2" || secureMode === "google_oauth2") {
            // OAuth2: actif seulement si le refresh token est present
            return !!watchedRefreshToken;
        } else {
            // Basic: actif si les champs requis sont remplis
            return !!(watchedAddress && (watchedPassword || emailAccountId) && watchedImapHost && watchedSmtpHost);
        }
    }, [secureMode, watchedRefreshToken, watchedPassword, watchedImapHost, watchedSmtpHost, watchedAddress, emailAccountId]);

    /**
     * Modes d'authentification disponibles
     */
    const authModes = [
        { value: "basic", label: "Authentification basique (SMTP/IMAP)" },
        { value: "xoauth2", label: "Microsoft 365 (OAuth2)" },
        { value: "google_oauth2", label: "Gmail (OAuth2)" }
    ];

    /**
     * Écoute les messages provenant de la popup OAuth (callback)
     */
    useEffect(() => {
        const handleOAuthCallback = async (event) => {
            // Vérifier l'origine pour la sécurité
            if (event.origin !== window.location.origin) return;

            // Vérifier que c'est bien un callback OAuth
            if (event.data?.type === 'OAUTH_CALLBACK') {
                const { code, error, error_description } = event.data;

                if (error) {
                    message.error(`Erreur OAuth: ${error_description || error}`);
                    setIsWaitingForOAuth(false);
                    return;
                }

                if (code) {
                    // Fermer la popup
                    if (oauthWindow && !oauthWindow.closed) {
                        oauthWindow.close();
                    }

                    // Échanger le code contre les tokens selon le provider
                    if (secureMode === 'google_oauth2') {
                        await exchangeGoogleCodeForTokens(code);
                    } else {
                        await exchangeCodeForTokens(code);
                    }
                }
            }
        };

        window.addEventListener('message', handleOAuthCallback);
        return () => window.removeEventListener('message', handleOAuthCallback);
    }, [oauthWindow, secureMode]);

    /**
     * Échange le code d'autorisation contre les tokens
     */
    const exchangeCodeForTokens = async (authorizationCode) => {
        try {

            message.loading({ content: 'Échange du code contre les tokens...', key: 'oauth' });

            const values = form.getFieldsValue();
            const response = await messageEmailAccountsApi.exchangeOAuthCode({
                eml_id: values.eml_id,
                tenant_id: values.eml_tenant_id,
                client_id: values.eml_client_id,
                client_secret: values.eml_client_secret,
                code: authorizationCode,
                redirect_uri: `${window.location.origin}/oauth/callback.html`
            });

            if (response.success) {
                form.setFieldsValue({
                    eml_access_token: response.access_token,
                    eml_refresh_token: response.refresh_token,
                    eml_token_expires_at: response.expires_at
                });

                message.success({
                    content: 'Authentification OAuth2 réussie ! Les tokens ont été générés.',
                    key: 'oauth',
                    duration: 5
                });

                // Auto-save après obtention des tokens
                await form.validateFields();
                await submit(form.getFieldsValue(), { closeDrawer: false });
            }
        } catch (error) {
            setOauthErrorMessage(error.message);
            message.error({
                content: error.message || 'Erreur lors de l\'échange du code OAuth',
                key: 'oauth'
            });
        } finally {
            setIsWaitingForOAuth(false);
        }
    };

    /**
     * Échange le code d'autorisation Google contre les tokens
     */
    const exchangeGoogleCodeForTokens = async (authorizationCode) => {
        try {
            message.loading({ content: 'Échange du code Google contre les tokens...', key: 'oauth' });

            const values = form.getFieldsValue();
            const response = await messageEmailAccountsApi.exchangeGoogleOAuthCode({
                eml_id: values.eml_id,
                client_id: values.eml_client_id,
                client_secret: values.eml_client_secret,
                code: authorizationCode,
                redirect_uri: `${window.location.origin}/oauth/callback.html`
            });

            if (response.success) {
                form.setFieldsValue({
                    eml_access_token: response.access_token,
                    eml_refresh_token: response.refresh_token,
                    eml_token_expires_at: response.expires_at
                });

                message.success({
                    content: 'Authentification Gmail réussie ! Les tokens ont été générés.',
                    key: 'oauth',
                    duration: 5
                });

                // Auto-save après obtention des tokens
                await form.validateFields();
                await submit(form.getFieldsValue(), { closeDrawer: false });
            }
        } catch (error) {
            setOauthErrorMessage(error.message);
            message.error({
                content: error.message || 'Erreur lors de l\'échange du code Google OAuth',
                key: 'oauth'
            });
        } finally {
            setIsWaitingForOAuth(false);
        }
    };

    /**
     * Démarre le flux OAuth2 - Ouvre la popup Microsoft
     */
    const handleGenerateOAuthToken = async () => {
        try {
            setRequireOAuth(true);
            setOauthErrorMessage(null);

            const values = await form.validateFields([
                'eml_tenant_id',
                'eml_client_id',
                'eml_client_secret',
                'eml_address'
            ]);

            if (!values.eml_client_secret) {
                message.warning("Le client secret est obligatoire pour l'authentification OAuth2.");
                return;
            }

            // Sauvegarder d'abord le compte si ce n'est pas déjà fait
            if (!values.eml_id) {
                message.loading({ content: 'Enregistrement du compte...', key: 'save' });
                const saveResult = await submit(form.getFieldsValue(), { closeDrawer: false });

                if (!saveResult?.data?.eml_id) {
                    message.error({ content: 'Impossible d\'enregistrer le compte', key: 'save' });
                    return;
                }

                form.setFieldsValue({ eml_id: saveResult.data.eml_id });
                values.eml_id = saveResult.data.eml_id;
                message.destroy('save');
            }

            // Construire l'URL d'autorisation Microsoft via le backend
            const authUrl = await buildMicrosoftAuthUrl(values);

            // Ouvrir la popup
            const width = 600;
            const height = 700;
            const left = (window.screen.width / 2) - (width / 2);
            const top = (window.screen.height / 2) - (height / 2);

            const popup = window.open(
                authUrl,
                'Microsoft OAuth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
            );

            if (!popup) {
                message.error('Impossible d\'ouvrir la fenêtre de connexion. Vérifiez que les popups ne sont pas bloquées.');
                return;
            }

            setOauthWindow(popup);
            setIsWaitingForOAuth(true);

            // Surveiller la fermeture de la popup
            const checkPopupClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkPopupClosed);
                    if (isWaitingForOAuth) {
                        message.warning('Authentification annulée');
                        setIsWaitingForOAuth(false);
                    }
                }
            }, 500);

        } catch (error) {

            message.error(error.message || 'Erreur lors du démarrage de l\'authentification');
        } finally {
            setRequireOAuth(false);
        }
    };

    /**
     * Construit l'URL d'autorisation Microsoft via le backend
     */
    const buildMicrosoftAuthUrl = async (values) => {
        try {
            const response = await messageEmailAccountsApi.getOAuthAuthUrl({
                tenant_id: values.eml_tenant_id,
                client_id: values.eml_client_id,
                redirect_uri: `${window.location.origin}/oauth/callback.html`,
                email: values.eml_address,
                state: values.eml_id?.toString() || ''
            });

            if (response.success) {
                return response.auth_url;
            } else {
                throw new Error(response.message || 'Erreur lors de la generation de l\'URL OAuth');
            }
        } catch (error) {
            throw new Error(error.message || 'Erreur lors de la generation de l\'URL OAuth');
        }
    };

    /**
     * Démarre le flux OAuth2 Google - Ouvre la popup Gmail
     */
    const handleGoogleOAuthToken = async () => {
        try {
            setRequireOAuth(true);
            setOauthErrorMessage(null);

            const values = await form.validateFields([
                'eml_client_id',
                'eml_client_secret',
                'eml_address'
            ]);

            if (!values.eml_client_secret) {
                message.warning("Le client secret est obligatoire pour l'authentification Google OAuth2.");
                return;
            }

            // Sauvegarder d'abord le compte si ce n'est pas déjà fait
            if (!values.eml_id) {
                message.loading({ content: 'Enregistrement du compte...', key: 'save' });
                const saveResult = await submit(form.getFieldsValue(), { closeDrawer: false });

                if (!saveResult?.data?.eml_id) {
                    message.error({ content: 'Impossible d\'enregistrer le compte', key: 'save' });
                    return;
                }

                form.setFieldsValue({ eml_id: saveResult.data.eml_id });
                values.eml_id = saveResult.data.eml_id;
                message.destroy('save');
            }

            // Construire l'URL d'autorisation Google via le backend
            const authUrl = await buildGoogleAuthUrl(values);

            // Ouvrir la popup
            const width = 600;
            const height = 700;
            const left = (window.screen.width / 2) - (width / 2);
            const top = (window.screen.height / 2) - (height / 2);

            const popup = window.open(
                authUrl,
                'Google OAuth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
            );

            if (!popup) {
                message.error('Impossible d\'ouvrir la fenêtre de connexion. Vérifiez que les popups ne sont pas bloquées.');
                return;
            }

            setOauthWindow(popup);
            setIsWaitingForOAuth(true);

            // Surveiller la fermeture de la popup
            const checkPopupClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkPopupClosed);
                    if (isWaitingForOAuth) {
                        message.warning('Authentification annulée');
                        setIsWaitingForOAuth(false);
                    }
                }
            }, 500);

        } catch (error) {
            message.error(error.message || 'Erreur lors du démarrage de l\'authentification Google');
        } finally {
            setRequireOAuth(false);
        }
    };

    /**
     * Construit l'URL d'autorisation Google via le backend
     */
    const buildGoogleAuthUrl = async (values) => {
        try {
            const response = await messageEmailAccountsApi.getGoogleOAuthAuthUrl({
                client_id: values.eml_client_id,
                redirect_uri: `${window.location.origin}/oauth/callback.html`,
                email: values.eml_address,
                state: values.eml_id?.toString() || ''
            });

            if (response.success) {
                return response.auth_url;
            } else {
                throw new Error(response.message || 'Erreur lors de la generation de l\'URL Google OAuth');
            }
        } catch (error) {
            throw new Error(error.message || 'Erreur lors de la generation de l\'URL Google OAuth');
        }
    };

    /**
     * Ouvre le modal de test avec envoi d'email
     */
    const openTestModal = async () => {
        try {
            // Valider d'abord les champs necessaires
            const values = await form.validateFields();

            // Sauvegarder avant de tester
            const saveResult = await submit(values, { closeDrawer: false });

            if (!saveResult?.data?.eml_id) {
                message.error('Impossible d\'enregistrer le compte');
                return;
            }

            form.setFieldsValue({ eml_id: saveResult.data.eml_id });

            // Pre-remplir l'email de test avec l'adresse du compte
            setTestEmail(values.eml_address || '');
            setTestLogs([]);
            setTestModalOpen(true);
        } catch (error) {
            message.error(error.message || 'Veuillez remplir tous les champs requis');
        }
    };

    /**
     * Lance le test d'envoi/reception d'email avec streaming SSE
     */
    const runEmailTest = async () => {
        if (!testEmail) {
            message.warning('Veuillez saisir une adresse email de test');
            return;
        }

        const emlId = form.getFieldValue('eml_id');
        if (!emlId) {
            message.error('Compte non enregistre');
            return;
        }

        setIsTestRunning(true);
        setTestLogs([]);
        setTestStatus('testing');
        setTestResult(null);

        try {
            // Utiliser fetch directement pour le streaming SSE (axios ne supporte pas les streams)
            const token = getToken();
            const response = await fetch('/api/message-email-accounts/send-test-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({
                    eml_id: emlId,
                    test_email: testEmail
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            // Ajouter le log
                            setTestLogs(prev => [...prev, data]);

                            // Si c'est le resultat final
                            if (data.type === 'result') {
                                const result = JSON.parse(data.message);
                                if (result.success) {
                                    setTestStatus('success');
                                    setTestResult({
                                        imap: result.imap_status,
                                        smtp: result.smtp_status,
                                        message: result.message
                                    });
                                } else {
                                    setTestStatus('error');
                                    setTestResult({
                                        error: result.message
                                    });
                                }
                            }
                        } catch (e) {
                            // Ignorer les erreurs de parsing
                        }
                    }
                }
            }
        } catch (error) {
            setTestStatus('error');
            setTestResult({ error: error.message });
            setTestLogs(prev => [...prev, { type: 'error', message: error.message, timestamp: new Date().toLocaleTimeString() }]);
        } finally {
            setIsTestRunning(false);
            setLastTestDate(new Date().toISOString());
        }
    };

    /**
     * Ferme le modal de test
     */
    const closeTestModal = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        setTestModalOpen(false);
        setTestLogs([]);
        setIsTestRunning(false);
    };

    /**
     * Rendu d'une icone selon le type de log
     */
    const getLogIcon = (type) => {
        switch (type) {
            case 'info':
                return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
            case 'success':
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 'error':
                return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
            case 'sending':
                return <SendOutlined style={{ color: '#1890ff' }} />;
            case 'receiving':
                return <MailOutlined style={{ color: '#722ed1' }} />;
            case 'complete':
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            case 'result':
                return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            default:
                return <LoadingOutlined style={{ color: '#1890ff' }} />;
        }
    };
    /**
     * On instancie les fonctions CRUD
     */
    const { submit, remove, loading } = useEntityForm({
        api: messageEmailAccountsApi,
        entityId: emailAccountId,
        idField: "eml_id",
        form,
        open,

        onDataLoaded: (data) => {
            // Mettre à jour le mode de sécurité pour afficher les bons champs
            setSecureMode(data.eml_secure_mode || "basic");
            // Charger le statut du dernier test si disponible
            if (data.eml_last_test_status) {
                setTestStatus(data.eml_last_test_status);
                setLastTestDate(data.eml_last_test_date);
            }
        },

        onSuccess: ({ action, data }, closeDrawer = true) => {
            // Mettre à jour l'ID actuel après création
            if (action === 'create' && data?.eml_id) {

            }

            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        },

        onDelete: ({ id }) => {
            onSubmit?.({ action: "delete", id });
            onClose?.();
        }
    });

    const handleFormSubmit = async (values) => {
        await submit(values);
        form.resetFields();
    };

    const handleDelete = async () => {
        await remove();
    };

    /**
     * Auto-détection des paramètres serveur
     */
    const handleAutoDetect = async () => {
        try {
            const email = form.getFieldValue('eml_address');
            if (!email) {
                message.warning('Veuillez d\'abord saisir l\'adresse email');
                return;
            }

            message.loading({ content: 'Détection automatique des serveurs...', key: 'autodetect' });

            const response = await messageEmailAccountsApi.autoDetectServers({
                email: email
            });

            if (response.success) {
                form.setFieldsValue({
                    eml_imap_host: response.imap_host,
                    eml_imap_port: response.imap_port,
                    eml_smtp_host: response.smtp_host,
                    eml_smtp_port: response.smtp_port
                });
                message.success({ content: 'Serveurs détectés automatiquement !', key: 'autodetect' });
            }
        } catch (error) {
            message.error({ content: 'Impossible de détecter automatiquement les serveurs', key: 'autodetect' });
        }
    };

    /**
     * Gestion du changement de mode d'authentification
     */
    const handleSecureModeChange = (value) => {
        setSecureMode(value);
        setTestStatus(null);
        setTestResult(null);
        setOauthErrorMessage(null);

        // Réinitialiser les champs spécifiques au mode précédent
        if (value === "basic") {
            form.setFieldsValue({
                eml_tenant_id: null,
                eml_client_id: null,
                eml_client_secret: null,
                eml_access_token: null,
                eml_refresh_token: null
            });
        } else if (value === "xoauth2") {
            form.setFieldsValue({
                eml_password: null,
                eml_imap_host: null,
                eml_imap_port: null,
                eml_smtp_host: null,
                eml_smtp_port: null
            });
        } else if (value === "google_oauth2") {
            form.setFieldsValue({
                eml_password: null,
                eml_tenant_id: null,
                eml_imap_host: null,
                eml_imap_port: null,
                eml_smtp_host: null,
                eml_smtp_port: null,
                eml_access_token: null,
                eml_refresh_token: null
            });
        }
    };

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        setSecureMode("basic");
        setTestStatus(null);
        setTestResult(null);
        if (onClose) {
            onClose();
        }
    };

    /**
     * Rendu du statut du test
     */
    const renderTestStatus = () => {
        if (!testStatus && !lastTestDate) return null;

        let icon, color, text;

        if (testStatus === 'testing') {
            icon = <SyncOutlined spin />;
            color = 'processing';
            text = 'Test en cours...';
        } else if (testStatus === 'success') {
            icon = <CheckCircleOutlined />;
            color = 'success';
            text = 'Connexion OK';
        } else if (testStatus === 'error') {
            icon = <CloseCircleOutlined />;
            color = 'error';
            text = 'Connexion échouée';
        }

        return (
            <div style={{ marginBottom: 16 }}>
                <Tag icon={icon} color={color} style={{ fontSize: '13px', padding: '4px 12px' }}>
                    {text}
                    {lastTestDate && testStatus !== 'testing' && (
                        <span style={{ marginLeft: 8, opacity: 0.8, fontSize: '11px' }}>
                            ({new Date(lastTestDate).toLocaleString('fr-FR')})
                        </span>
                    )}
                </Tag>
            </div>
        );
    };

    /**
     * Rendu des résultats du test
     */
    const renderTestResults = () => {
        if (!testResult) return null;

        if (testStatus === 'success') {
            return (
                <Alert
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Test de connexion réussi"
                    description={
                        <div>
                            {testResult.imap && (
                                <div>
                                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                                    IMAP : Connexion établie
                                </div>
                            )}
                            {testResult.smtp && (
                                <div>
                                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                                    SMTP : Connexion établie
                                </div>
                            )}
                            {testResult.message && (
                                <div style={{ marginTop: 8, fontSize: '12px', opacity: 0.8 }}>
                                    {testResult.message}
                                </div>
                            )}
                        </div>
                    }
                />
            );
        }

        if (testStatus === 'error') {
            return (
                <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Échec du test de connexion"
                    description={
                        <div>
                            <div>{testResult.error}</div>
                            {testResult.details && (
                                <div style={{ marginTop: 8, fontSize: '12px', fontFamily: 'monospace' }}>
                                    {testResult.details}
                                </div>
                            )}
                        </div>
                    }
                />
            );
        }

        return null;
    };

    /**
     * Actions du drawer (footer)
     */
    const drawerActions = (
        <Space
            style={{
                width: "100%",
                display: "flex",
                paddingRight: "15px",
                justifyContent: "space-between"
            }}
        >
            <div>
                {emailAccountId && (
                    <CanAccess permission="settings.messageemailaccounts.delete">
                        <Popconfirm
                            title="Supprimer ce compte"
                            description="Êtes-vous sûr de vouloir supprimer ce compte email ?"
                            onConfirm={handleDelete}
                            okText="Oui"
                            cancelText="Non"
                        >
                            <Button danger icon={<DeleteOutlined />}>
                                Supprimer
                            </Button>
                        </Popconfirm>
                    </CanAccess>
                )}
            </div>

            <Space>
                <Tooltip title={!canTestConnection ? (secureMode === 'xoauth2' ? 'Veuillez d\'abord vous authentifier avec Microsoft' : secureMode === 'google_oauth2' ? 'Veuillez d\'abord vous authentifier avec Gmail' : 'Veuillez remplir tous les champs requis') : ''}>
                    <Button
                        icon={<ThunderboltOutlined />}
                        type="secondary"
                        onClick={openTestModal}
                        loading={testModalOpen}
                        disabled={!canTestConnection}
                    >
                        Tester la connexion
                    </Button>
                </Tooltip>
                <Button onClick={handleClose}>Annuler</Button>
                <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    onClick={() => form.submit()}
                >
                    Enregistrer
                </Button>
            </Space>
        </Space>
    );

    return (
        <Drawer
            title={
                pageLabel ? `Édition - ${pageLabel}` : "Nouveau compte email"
            }
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                {renderTestStatus()}
                {renderTestResults()}

                {isWaitingForOAuth && (
                    <Alert
                        type="info"
                        showIcon
                        message={secureMode === 'google_oauth2' ? "Authentification Gmail en cours" : "Authentification Microsoft en cours"}
                        description="Veuillez vous connecter dans la fenêtre popup et autoriser l'accès à votre compte email."
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="eml_id" hidden>
                        <Input />
                    </Form.Item>

                    {/* Section: Informations générales */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3 style={{ marginBottom: 16, fontWeight: "bold", fontSize: "16px" }}>
                            Informations générales
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="eml_label"
                                    label="Nom du compte"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le nom est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Ex: Support Client, Contact Commercial" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="eml_address"
                                    label="Adresse email"
                                    rules={[
                                        {
                                            required: true,
                                            message: "L'adresse email est requise"
                                        },
                                        {
                                            type: "email",
                                            message: "Veuillez saisir une adresse email valide"
                                        }
                                    ]}
                                >
                                    <Input placeholder="contact@exemple.com" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="eml_sender_alias"
                                    label="Alias d'expédition"
                                    rules={[
                                        {
                                            type: "email",
                                            message: "Veuillez saisir une adresse email valide"
                                        }
                                    ]}
                                    extra="Si renseigné, cette adresse sera utilisée comme expéditeur à la place de l'adresse de connexion"
                                >
                                    <Input placeholder="alias@exemple.com (optionnel)" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="eml_secure_mode"
                                    label="Mode d'authentification"
                                    initialValue="basic"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le mode d'authentification est requis"
                                        }
                                    ]}
                                >
                                    <Select
                                        placeholder="Sélectionner un mode"
                                        options={authModes}
                                        onChange={handleSecureModeChange}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: Configuration SMTP/IMAP (mode basic) */}
                    {secureMode === "basic" && (
                        <div className="box" style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontWeight: "bold", fontSize: "16px" }}>
                                    Configuration SMTP/IMAP
                                </h3>
                                <Tooltip title="Détecte automatiquement les paramètres serveur en fonction de votre adresse email">
                                    <Button
                                        size="small"
                                        icon={<ThunderboltOutlined />}
                                        onClick={handleAutoDetect}
                                    >
                                        Auto-détection
                                    </Button>
                                </Tooltip>
                            </div>

                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Form.Item
                                        name="eml_password"
                                        label="Mot de passe"
                                        rules={[
                                            {
                                                required: !emailAccountId,
                                                message: "Le mot de passe est requis"
                                            }
                                        ]}
                                        extra={emailAccountId ? "Laissez vide pour conserver le mot de passe actuel" : null}
                                    >
                                        <Input.Password
                                            placeholder="Mot de passe du compte email"
                                            autoComplete="new-password"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider titlePlacement="left">
                                Serveur IMAP (réception)
                            </Divider>

                            <Row gutter={[16, 8]}>
                                <Col span={18}>
                                    <Form.Item
                                        name="eml_imap_host"
                                        label="Serveur IMAP"
                                        rules={[
                                            {
                                                required: secureMode === "basic",
                                                message: "Le serveur IMAP est requis"
                                            }
                                        ]}
                                    >
                                        <Input placeholder="imap.gmail.com" />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item
                                        name="eml_imap_port"
                                        label="Port"
                                        initialValue={993}
                                        rules={[
                                            {
                                                required: secureMode === "basic",
                                                message: "Le port est requis"
                                            }
                                        ]}
                                    >
                                        <Input placeholder="993" type="number" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider titlePlacement="left">
                                Serveur SMTP (envoi)
                            </Divider>

                            <Row gutter={[16, 8]}>
                                <Col span={18}>
                                    <Form.Item
                                        name="eml_smtp_host"
                                        label="Serveur SMTP"
                                        rules={[
                                            {
                                                required: secureMode === "basic",
                                                message: "Le serveur SMTP est requis"
                                            }
                                        ]}
                                    >
                                        <Input placeholder="smtp.gmail.com" />
                                    </Form.Item>
                                </Col>
                                <Col span={6}>
                                    <Form.Item
                                        name="eml_smtp_port"
                                        label="Port"
                                        initialValue={587}
                                        rules={[
                                            {
                                                required: secureMode === "basic",
                                                message: "Le port est requis"
                                            }
                                        ]}
                                    >
                                        <Input placeholder="587" type="number" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>
                    )}

                    {/* Section: Configuration Microsoft 365 (mode xoauth2) */}
                    {secureMode === "xoauth2" && (
                        <div className="box" style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontWeight: "bold", fontSize: "16px" }}>
                                    Configuration Microsoft 365 (OAuth2)
                                </h3>
                                <Tooltip title="Génère les tokens d'authentification OAuth2">

                                </Tooltip>
                            </div>

                            <Alert
                                title="Configuration Azure AD requise"
                                description={
                                    <div>
                                        <p style={{ marginBottom: 8 }}>Permissions nécessaires dans Azure AD :</p>
                                        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                            <li>Mail.Read</li>
                                            <li>Mail.Send</li>
                                            <li>IMAP.AccessAsUser.All</li>
                                            <li>SMTP.Send</li>
                                        </ul>
                                    </div>
                                }
                                type="info"
                                showIcon
                                icon={<InfoCircleOutlined />}
                                style={{ marginBottom: 16 }}
                            />

                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Form.Item
                                        name="eml_tenant_id"
                                        label="Tenant ID"
                                        rules={[
                                            {
                                                required: secureMode === "xoauth2",
                                                message: "Le Tenant ID est requis pour Microsoft 365"
                                            }
                                        ]}
                                    >
                                        <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Form.Item
                                        name="eml_client_id"
                                        label="Client ID (Application ID)"
                                        rules={[
                                            {
                                                required: secureMode === "xoauth2",
                                                message: "Le Client ID est requis pour Microsoft 365"
                                            }
                                        ]}
                                    >
                                        <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Form.Item
                                        name="eml_client_secret"
                                        label="Client Secret"
                                        rules={[
                                            {
                                                required: secureMode === "xoauth2" && (!emailAccountId || requireOAuth === true),
                                                message: "Le Client Secret est requis pour Microsoft 365"
                                            }
                                        ]}
                                        extra={emailAccountId ? "Laissez vide pour conserver le secret actuel" : null}
                                    >
                                        <Input.Password
                                            placeholder="Client Secret de l'application Azure AD"
                                            autoComplete="new-password"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Button
                                        type="primary"
                                        icon={<SyncOutlined />}
                                        onClick={handleGenerateOAuthToken}
                                        loading={isWaitingForOAuth}
                                        disabled={isWaitingForOAuth}
                                        block
                                    >
                                        {isWaitingForOAuth ? 'Authentification en cours...' : 'Authentifier avec Microsoft'}

                                    </Button> {oauthErrorMessage && (
                                        <Alert
                                            type="error"
                                            showIcon
                                            style={{ marginBottom: 16, marginTop: 16 }}
                                            title="Échec d'authentification"
                                            description={
                                                <div>
                                                    <div></div>
                                                    <div style={{ marginTop: 8, fontSize: '12px', fontFamily: 'monospace' }}>
                                                        {oauthErrorMessage}
                                                    </div>
                                                </div>
                                            }
                                        />
                                    )}
                                </Col>
                            </Row>
                            {!oauthErrorMessage && (
                                <>
                                    <Divider>Tokens OAuth2 (générés automatiquement)</Divider>

                                    <Row gutter={[16, 8]}>
                                        <Col span={24}>
                                            <Form.Item
                                                name="eml_access_token"
                                                label="Access Token"
                                            >
                                                <Input.TextArea
                                                    placeholder="Sera généré automatiquement après configuration"
                                                    rows={2}
                                                    readOnly
                                                    className="readOnly"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>



                                    <Row gutter={[16, 8]}>
                                        <Col span={24}>
                                            <Form.Item
                                                name="eml_refresh_token"
                                                label="Refresh Token"
                                            >
                                                <Input.TextArea
                                                    placeholder="Sera généré automatiquement après configuration"
                                                    rows={2}
                                                    readOnly
                                                    className="readOnly"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </>
                            )}
                        </div>
                    )}

                    {/* Section: Configuration Gmail (mode google_oauth2) */}
                    {secureMode === "google_oauth2" && (
                        <div className="box" style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0, fontWeight: "bold", fontSize: "16px" }}>
                                    Configuration Gmail (OAuth2)
                                </h3>
                            </div>

                            <Alert
                                title="Configuration Google Cloud requise"
                                description={
                                    <div>
                                        <p style={{ marginBottom: 8 }}>Prérequis dans Google Cloud Console :</p>
                                        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                            <li>Activer l'API Gmail</li>
                                            <li>Configurer l'écran de consentement OAuth</li>
                                            <li>Créer des identifiants OAuth 2.0 (Application Web)</li>
                                            <li>Ajouter l'URI de redirection : <code>{window.location.origin}/oauth/callback.html</code></li>
                                        </ul>
                                    </div>
                                }
                                type="info"
                                showIcon
                                icon={<InfoCircleOutlined />}
                                style={{ marginBottom: 16 }}
                            />

                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Form.Item
                                        name="eml_client_id"
                                        label="Client ID"
                                        rules={[
                                            {
                                                required: secureMode === "google_oauth2",
                                                message: "Le Client ID est requis pour Gmail"
                                            }
                                        ]}
                                    >
                                        <Input placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Form.Item
                                        name="eml_client_secret"
                                        label="Client Secret"
                                        rules={[
                                            {
                                                required: secureMode === "google_oauth2" && (!emailAccountId || requireOAuth === true),
                                                message: "Le Client Secret est requis pour Gmail"
                                            }
                                        ]}
                                        extra={emailAccountId ? "Laissez vide pour conserver le secret actuel" : null}
                                    >
                                        <Input.Password
                                            placeholder="Client Secret de l'application Google"
                                            autoComplete="new-password"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={[16, 8]}>
                                <Col span={24}>
                                    <Button
                                        type="primary"
                                        icon={<SyncOutlined />}
                                        onClick={handleGoogleOAuthToken}
                                        loading={isWaitingForOAuth}
                                        disabled={isWaitingForOAuth}
                                        block
                                    >
                                        {isWaitingForOAuth ? 'Authentification en cours...' : 'Authentifier avec Gmail'}

                                    </Button> {oauthErrorMessage && (
                                        <Alert
                                            type="error"
                                            showIcon
                                            style={{ marginBottom: 16, marginTop: 16 }}
                                            title="Échec d'authentification"
                                            description={
                                                <div>
                                                    <div></div>
                                                    <div style={{ marginTop: 8, fontSize: '12px', fontFamily: 'monospace' }}>
                                                        {oauthErrorMessage}
                                                    </div>
                                                </div>
                                            }
                                        />
                                    )}
                                </Col>
                            </Row>
                            {!oauthErrorMessage && (
                                <>
                                    <Divider>Tokens OAuth2 (générés automatiquement)</Divider>

                                    <Row gutter={[16, 8]}>
                                        <Col span={24}>
                                            <Form.Item
                                                name="eml_access_token"
                                                label="Access Token"
                                            >
                                                <Input.TextArea
                                                    placeholder="Sera généré automatiquement après authentification"
                                                    rows={2}
                                                    readOnly
                                                    className="readOnly"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Row gutter={[16, 8]}>
                                        <Col span={24}>
                                            <Form.Item
                                                name="eml_refresh_token"
                                                label="Refresh Token"
                                            >
                                                <Input.TextArea
                                                    placeholder="Sera généré automatiquement après authentification"
                                                    rows={2}
                                                    readOnly
                                                    className="readOnly"
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </>
                            )}
                        </div>
                    )}

                    {/* Guide rapide */}
                    <div
                        className="box"
                        style={{
                            marginTop: 24,
                            padding: 16,
                            backgroundColor: "#f8f9fa",
                            borderLeft: "4px solid #1890ff"
                        }}
                    >
                        <h4 style={{ marginBottom: 8, fontWeight: "bold", display: 'flex', alignItems: 'center' }}>
                            <InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                            Guide de configuration
                        </h4>
                        {secureMode === "basic" ? (
                            <div style={{ fontSize: "13px", color: "#666" }}>
                                <p style={{ margin: '8px 0' }}>
                                    <strong>Ports standards :</strong>
                                </p>
                                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                                    <li>IMAP : 993 (SSL/TLS) ou 143 (STARTTLS)</li>
                                    <li>SMTP : 587 (STARTTLS) ou 465 (SSL/TLS)</li>
                                </ul>
                                <p style={{ margin: '8px 0' }}>
                                    <strong>Fournisseurs courants :</strong>
                                </p>
                                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                                    <li>Gmail : imap.gmail.com / smtp.gmail.com</li>
                                    <li>Outlook : outlook.office365.com</li>
                                    <li>Yahoo : imap.mail.yahoo.com / smtp.mail.yahoo.com</li>
                                </ul>
                            </div>
                        ) : secureMode === "google_oauth2" ? (
                            <div style={{ fontSize: "13px", color: "#666" }}>
                                <p style={{ margin: '8px 0' }}>
                                    <strong>Étapes de configuration :</strong>
                                </p>
                                <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
                                    <li>Accédez à Google Cloud Console</li>
                                    <li>Créez un projet ou sélectionnez un projet existant</li>
                                    <li>Activez l'API Gmail</li>
                                    <li>Configurez l'écran de consentement OAuth</li>
                                    <li>Créez des identifiants OAuth 2.0 (type: Application Web)</li>
                                    <li>Ajoutez l'URI de redirection autorisée</li>
                                    <li>Renseignez Client ID et Client Secret ci-dessus</li>
                                    <li>Cliquez sur "Authentifier avec Gmail"</li>
                                </ol>
                            </div>
                        ) : (
                            <div style={{ fontSize: "13px", color: "#666" }}>
                                <p style={{ margin: '8px 0' }}>
                                    <strong>Étapes de configuration :</strong>
                                </p>
                                <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
                                    <li>Créez une application dans Azure AD</li>
                                    <li>Configurez les permissions API nécessaires</li>
                                    <li>Générez un Client Secret</li>
                                    <li>Renseignez les identifiants ci-dessus</li>
                                    <li>Cliquez sur "Générer les tokens"</li>
                                </ol>
                            </div>
                        )}
                    </div>
                </Form>
            </Spin>

            {/* Modal de test d'envoi/réception d'email */}
            <Modal
                title={
                    <Space>
                        <MailOutlined />
                        Test d'envoi et réception d'email
                    </Space>
                }
                open={testModalOpen}
                onCancel={closeTestModal}
                footer={[
                    <Button key="close" onClick={closeTestModal}>
                        Fermer
                    </Button>,
                    <Button
                        key="test"
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={runEmailTest}
                        loading={isTestRunning}
                        disabled={!testEmail || isTestRunning}
                    >
                        {isTestRunning ? 'Test en cours...' : 'Lancer le test'}
                    </Button>
                ]}
                width={600}
            >
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                        Adresse email de test :
                    </label>
                    <Input
                        placeholder="Entrez l'adresse email pour le test"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        disabled={isTestRunning}
                        prefix={<MailOutlined />}
                    />
                    <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                        Un email de test sera envoyé à cette adresse, puis la connexion IMAP sera testée.
                    </div>
                </div>

                {/* Console de logs en temps réel */}
                {testLogs.length > 0 && (
                    <div
                        style={{
                            backgroundColor: '#1e1e1e',
                            borderRadius: 8,
                            padding: 16,
                            maxHeight: 300,
                            overflowY: 'auto',
                            fontFamily: 'monospace',
                            fontSize: 13
                        }}
                    >
                        {testLogs.map((log, index) => (
                            <div
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    marginBottom: 8,
                                    color: log.type === 'error' ? '#ff4d4f' : log.type === 'success' || log.type === 'complete' ? '#52c41a' : '#d9d9d9'
                                }}
                            >
                                <span style={{ marginRight: 8, flexShrink: 0 }}>
                                    {getLogIcon(log.type)}
                                </span>
                                <span style={{ color: '#888', marginRight: 8, flexShrink: 0 }}>
                                    [{log.timestamp}]
                                </span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                        {isTestRunning && (
                            <div style={{ display: 'flex', alignItems: 'center', color: '#1890ff' }}>
                                <LoadingOutlined style={{ marginRight: 8 }} />
                                <span>En attente...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Résultat final */}
                {testResult && !isTestRunning && (
                    <div style={{ marginTop: 16 }}>
                        {testStatus === 'success' ? (
                            <Alert
                                type="success"
                                showIcon
                                message="Test réussi !"
                                description={
                                    <div>
                                        {testResult.smtp && (
                                            <div><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />SMTP : Email envoyé avec succès</div>
                                        )}
                                        {testResult.imap && (
                                            <div><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />IMAP : Connexion établie</div>
                                        )}
                                    </div>
                                }
                            />
                        ) : (
                            <Alert
                                type="error"
                                showIcon
                                message="Échec du test"
                                description={testResult.error}
                            />
                        )}
                    </div>
                )}
            </Modal>
        </Drawer>
    );
}