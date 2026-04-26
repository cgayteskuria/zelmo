import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Drawer, Form, Input, Select, Switch, Button, Alert, Space, Typography,
    Divider, Tag, Steps, Modal, Spin, Row, Col, Tooltip, Table, Tabs, Collapse,
} from "antd";
import {
    CheckCircleOutlined, CloseCircleOutlined, ApiOutlined, SaveOutlined,
    PlayCircleOutlined, CopyOutlined, QuestionCircleOutlined, CloudServerOutlined,
    SettingOutlined, LinkOutlined,
} from "@ant-design/icons";
import { message } from "../../utils/antdStatic";
import { eInvoicingApi } from "../../services/apiEInvoicing";
import { useEntityForm } from "../../hooks/useEntityForm";
import PageContainer from "../../components/common/PageContainer";

const { Text, Paragraph, Title } = Typography;

const PROFILES = [
    { value: "custom", label: "Personnalisé" },
];

export default function EInvoicingSettings() {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [testing, setTesting] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [registerModalOpen, setRegisterModalOpen] = useState(false);
    const [registerStep, setRegisterStep] = useState(0);

    const webhookBaseUrl = window.location.origin;

    const watchedClientId = Form.useWatch("eic_client_id", form);
    const watchedCustomerId = Form.useWatch("eic_customer_id", form);
    const canRegister = !!(watchedClientId && watchedCustomerId);

    const { loading, entity: config, submit, reload } = useEntityForm({
        api: eInvoicingApi,
        form,
        open: true,
        entityId: 1,
        idField: "eic_id",
        messages: {
            update: "Configuration sauvegardée.",
            saveError: "Erreur lors de la sauvegarde.",
            loadError: "Erreur lors du chargement de la configuration.",
        },
    });

    const handleFormSubmit = async (values) => {
        await submit({ ...values, eic_id: config?.eic_id });
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const values = await form.validateFields();
            await submit({ ...values, eic_id: config?.eic_id });
            const res = await eInvoicingApi.testConnection();
            const ok = res?.status ?? false;
            setTestResult({ ok, message: res?.message ?? "" });
        } catch (error) {
            console.log(error);
            message.error(`Erreur de connexion : ${error?.message || "Serveur injoignable"}`);
            setTestResult({ ok: false, message: `Erreur de connexion : ${error?.message || "Serveur injoignable"}` });
        } finally {
            setTesting(false);
        }
    };

    const handleRegisterEntity = async () => {
        setRegistering(true);
        try {
            setRegisterStep(1);
            await new Promise((r) => setTimeout(r, 600));
            setRegisterStep(2);
            await new Promise((r) => setTimeout(r, 600));
            setRegisterStep(3);
            const res = await eInvoicingApi.registerEntity();
            if (res?.status) {
                setRegisterStep(4);
                message.success("Entreprise enregistrée avec succès.");
                reload();
            } else {
                throw new Error(res?.message ?? "Erreur lors de l'enregistrement.");
            }
        } catch (e) {
            message.error(e.message ?? "Erreur lors de l'enregistrement.");
            setRegisterStep(-1);
        } finally {
            setRegistering(false);
        }
    };

    const copyWebhook = (path) => {
        navigator.clipboard.writeText(`${webhookBaseUrl}/api/webhooks/einvoicing${path}`);
        message.success("URL copiée dans le presse-papier.");
    };

    const isRegistered = config?.eic_entity_registered;

    // -------------------------------------------------------------------------
    // Footer
    // -------------------------------------------------------------------------
    const drawerFooter = (
        <Space style={{ width: "100%", display: "flex", paddingRight: 15, justifyContent: "flex-end" }}>
            <Button onClick={() => navigate(-1)}>Annuler</Button>
            <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => form.submit()}
                loading={loading}
            >
                Enregistrer
            </Button>
        </Space>
    );

    // -------------------------------------------------------------------------
    // Onglets
    // -------------------------------------------------------------------------
    const tabItems = [
        {
            key: "connexion",
            label: "Connexion PA",
            icon: <ApiOutlined />,
            children: (
                <Space direction="vertical" style={{ width: "100%" }} size="large">

                    {/* Identifiants OAuth2 */}
                    <div>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="eic_pdp_profile" label="Profil de connexion">
                                    <Select options={PROFILES} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="eic_facturex_profile" label="Profil Facture-X">
                                    <Select options={[                                       
                                        { value: "EN16931", label: "EN16931" },                                       
                                    ]} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item
                            name="eic_api_url"
                            label="URL de l'API"
                            rules={[{ required: true, type: "url", message: "URL valide requise." }]}
                            extra={
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    URL de base de l'API de facturation (pas l'URL d'authentification OAuth2).
                                    Sandbox Iopole : <strong>https://api.ppd.iopole.fr</strong>
                                </Text>
                            }
                        >
                            <Input placeholder="https://api.ppd.iopole.fr" />
                        </Form.Item>

                        <Form.Item
                            name="eic_token_url"
                            label="URL du serveur OAuth2 (Token URL)"
                            rules={[{ type: "url", message: "URL valide requise." }]}
                            extra={<Text type="secondary" style={{ fontSize: 11 }}>Si vide, l'URL OAuth2 est découverte automatiquement depuis l'URL de l'API. Exemple Iopole : https://auth.ppd.iopole.fr/realms/iopole/protocol/openid-connect/token</Text>}
                            style={{ marginBottom: 0 }}
                        >
                            <Input placeholder="Laisser vide pour auto-discovery" autoComplete="off" allowClear />
                        </Form.Item>


                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="eic_client_id" label="API Client ID">
                                    <Input placeholder="Client ID fourni par Iopole" autoComplete="off" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="eic_client_secret" label="API Client Secret">
                                    <Input.Password placeholder="Client Secret fourni par Iopole" autoComplete="off" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item
                            name="eic_customer_id"
                            label={
                                <Space>
                                    Identifiant client (Customer ID)
                                    <Tooltip title="Iopole est multi-tenant. Ce Customer ID identifie votre compte dans la plateforme. Il est fourni par Iopole à la création de votre espace.">
                                        <QuestionCircleOutlined />
                                    </Tooltip>
                                </Space>
                            }
                        >
                            <Input placeholder="Customer ID fourni par Iopole" autoComplete="off" />
                        </Form.Item>

                        <Form.Item
                            name="eic_webhook_secret"
                            label={
                                <Space>
                                    Token de notification (Webhook Secret)
                                    <Tooltip title="Secret HMAC-SHA256 utilisé par Iopole pour signer ses notifications Push. Renseignez ce même secret dans votre espace Iopole.">
                                        <QuestionCircleOutlined />
                                    </Tooltip>
                                </Space>
                            }
                        >
                            <Input.Password placeholder="Secret HMAC partagé avec Iopole" autoComplete="off" />
                        </Form.Item>
                    </div>

                    {/* Tester la connexion */}
                    <div>
                        <Button onClick={handleTestConnection} loading={testing} icon={<PlayCircleOutlined />}>
                            Tester la connexion
                        </Button>
                        {testResult && (
                            <Alert
                                style={{ marginTop: 12 }}
                                type={testResult.ok ? "success" : "error"}
                                message={testResult.message}
                                showIcon
                            />
                        )}
                    </div>
                </Space>
            ),
        },
        {
            key: "enregistrement",
            label: "Enregistrement & Webhooks",
            icon: <LinkOutlined />,
            children: (
                <Space direction="vertical" style={{ width: "100%" }} size="large">

                    {/* Enregistrement entreprise */}
                    <div>
                        <Title level={5} style={{ marginBottom: 8 }}>
                            Enregistrement de l'entreprise auprès du PA
                        </Title>
                        <Space direction="vertical" style={{ width: "100%" }}>
                            <Space>
                                <Text>Statut :</Text>
                                {isRegistered
                                    ? <Tag color="success" icon={<CheckCircleOutlined />}>Enregistrée</Tag>
                                    : <Tag color="error" icon={<CloseCircleOutlined />}>Non enregistrée</Tag>
                                }
                                {config?.eic_business_entity_id && (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        ID : {config.eic_business_entity_id}
                                    </Text>
                                )}
                            </Space>
                            {!isRegistered && (
                                <Alert
                                    type="warning"
                                    message="L'entreprise doit être enregistrée chez le PA avant de pouvoir émettre des factures électroniques."
                                    showIcon
                                />
                            )}
                            <Tooltip title={!canRegister ? "Renseignez l'API Client ID et le Customer ID dans l'onglet Connexion PA, puis sauvegardez." : ""}>
                                <Button
                                    onClick={() => { setRegisterStep(0); setRegisterModalOpen(true); }}
                                    disabled={!canRegister}
                                    icon={<PlayCircleOutlined />}
                                >
                                    {isRegistered ? "Re-enregistrer l'entreprise" : "Enregistrer l'entreprise"}
                                </Button>
                            </Tooltip>
                        </Space>
                    </div>

                    <Divider />

                    {/* URLs Webhook */}
                    <div>
                        <Title level={5} style={{ marginBottom: 8 }}>
                            URLs Webhook à configurer dans l'interface du PA
                        </Title>

                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="Utiliser le mode Push (recommandé)"
                            description={
                                <Space direction="vertical" size={4}>
                                    <Text>
                                        Dans l'interface de votre PA, sélectionnez le mode <strong>Push</strong> (aussi appelé <em>Webhook</em>).
                                        Le PA appelle automatiquement Zelmo dès qu'un événement se produit — la mise à jour est <strong>immédiate</strong>.
                                    </Text>
                                    <Text>
                                        <strong>Sécurité :</strong> chaque appel est signé via HMAC-SHA256 avec le <em>Token de notification</em> configuré dans l'onglet Connexion PA.
                                    </Text>
                                    <Text type="secondary">
                                        Prérequis : votre serveur Zelmo doit être accessible depuis Internet (URL publique HTTPS).
                                    </Text>
                                </Space>
                            }
                        />

                        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                            Copiez ces URLs dans la section Webhook / Push de votre espace PA :
                        </Paragraph>
                        <Table
                            size="small"
                            pagination={false}
                            showHeader={false}
                            rowKey="path"
                            dataSource={[
                                { label: "Cycle de vie facture", path: "/facture/cycledevie/{invoiceId}" },
                                { label: "Données de facturation", path: "/donneesfacturation/{invoiceId}" },
                                { label: "Déclaration e-reporting", path: "/declaration" },
                            ]}
                            columns={[
                                {
                                    dataIndex: "label",
                                    width: 200,
                                    render: (t) => <Text style={{ whiteSpace: "nowrap" }}>{t}</Text>,
                                },
                                {
                                    dataIndex: "path",
                                    render: (path) => (
                                        <Input
                                            readOnly
                                            value={`${webhookBaseUrl}/api/webhooks/einvoicing${path}`}
                                            style={{ fontFamily: "monospace", fontSize: 12 }}
                                        />
                                    ),
                                },
                                {
                                    dataIndex: "path",
                                    width: 40,
                                    render: (path) => (
                                        <Button size="small" icon={<CopyOutlined />} onClick={() => copyWebhook(path)} />
                                    ),
                                },
                            ]}
                        />
                    </div>
                </Space>
            ),
        },
        {
            key: "transmission",
            label: "Transmission",
            icon: <SettingOutlined />,
            children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                    <Form.Item name="eic_auto_transmit" valuePropName="checked" label="Transmission automatique">
                        <Switch />
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                            Transmettre automatiquement les factures à leur validation
                        </Text>
                    </Form.Item>
                    <Form.Item name="eic_validate_before_send" valuePropName="checked" label="Validation avant envoi">
                        <Switch />
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                            Valider le format Facture-X avant transmission au PA
                        </Text>
                    </Form.Item>
                </Space>
            ),
        },
    ];

    return (
        <PageContainer title="Facturation Électronique">
            <Drawer
                title={<><CloudServerOutlined style={{ marginRight: 8 }} />Paramètres e-facturation</>}
                open
                onClose={() => navigate(-1)}
                size="large"
                footer={drawerFooter}
                destroyOnHidden
            >
                <Spin spinning={loading} tip="Chargement...">
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleFormSubmit}
                        autoComplete="off"
                    >
                        <Tabs items={tabItems} />
                    </Form>
                </Spin>
            </Drawer>

            {/* Modal enregistrement entreprise */}
            <Modal
                title="Enregistrement de l'entreprise"
                open={registerModalOpen}
                onCancel={() => !registering && setRegisterModalOpen(false)}
                footer={
                    registerStep === 4 ? (
                        <Button type="primary" onClick={() => setRegisterModalOpen(false)}>Fermer</Button>
                    ) : registerStep < 0 ? (
                        <Button onClick={() => setRegisterModalOpen(false)}>Fermer</Button>
                    ) : !registering ? (
                        <Space>
                            <Button onClick={() => setRegisterModalOpen(false)}>Annuler</Button>
                            <Button type="primary" onClick={handleRegisterEntity} loading={registering}>
                                Lancer l'enregistrement
                            </Button>
                        </Space>
                    ) : null
                }
            >
                {registerStep === 0 && !registering ? (
                    <Alert
                        type="info"
                        message="Cette opération va enregistrer votre entreprise (SIREN/SIRET) auprès du PA en 4 étapes automatiques."
                        showIcon
                    />
                ) : (
                    <Steps
                        direction="vertical"
                        current={registerStep - 1}
                        status={registerStep < 0 ? "error" : registerStep === 4 ? "finish" : "process"}
                        items={[
                            { title: "Création de l'unité légale (SIREN)", description: "Enregistrement auprès du PA" },
                            { title: "Création de l'établissement (SIRET)", description: "Enregistrement de votre SIRET" },
                            { title: "Revendication de l'entité", description: "Rattachement à votre compte PA" },
                            { title: "Enregistrement de l'identifiant", description: "Activation du routage PDP" },
                        ]}
                    />
                )}
            </Modal>
        </PageContainer>
    );
}
