import { useState, useEffect } from 'react';
import {
    Drawer, Form, Input, Button, Space, Typography,
    Tooltip, Row, Col, Tag, Divider, Alert,
} from 'antd';
import {
    SaveOutlined, CopyOutlined, ApiOutlined,
    LinkOutlined, KeyOutlined, SafetyCertificateOutlined,
    CheckCircleOutlined, CloseCircleOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import { message } from '../../utils/antdStatic';
import { enrichmentApi } from '../../services/apiEnrichment';

const { Text, Paragraph } = Typography;

function SectionLabel({ icon, title, description }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <Space align="center" style={{ marginBottom: 4 }}>
                <span style={{ color: '#16a34a', fontSize: 15 }}>{icon}</span>
                <Text strong style={{ fontSize: 14 }}>{title}</Text>
            </Space>
            {description && (
                <Paragraph type="secondary" style={{ fontSize: 12, margin: 0, paddingLeft: 22 }}>
                    {description}
                </Paragraph>
            )}
        </div>
    );
}

export default function CrmConfig({ open, onClose }) {
    const [form] = Form.useForm();
    const [loading, setLoading]     = useState(false);
    const [saving, setSaving]       = useState(false);
    const [testing, setTesting]     = useState(false);
    const [testResult, setTestResult] = useState(null); // null | { ok, message }
    const [webhookUrl, setWebhookUrl] = useState('');
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        if (!open) return;
        const load = async () => {
            setLoading(true);
            try {
                const res  = await enrichmentApi.getConfig();
                const data = res.data || res;
                form.setFieldsValue({
                    crc_api_url:        data.crc_api_url        || '',
                    crc_api_key:        data.crc_api_key        || '',
                    crc_webhook_secret: data.crc_webhook_secret || '',
                });
                setWebhookUrl(data.webhook_url || '');
                setIsConfigured(!!data.crc_api_url);
                setTestResult(null);
            } catch (_) {
                message.error('Impossible de charger la configuration.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [open]);

    const handleSave = async () => {
        let values;
        try { values = await form.validateFields(); } catch (_) { return; }
        setSaving(true);
        try {
            await enrichmentApi.updateConfig(values);
            setIsConfigured(!!values.crc_api_url);
            message.success('Configuration enregistrée.');
        } catch (err) {
            message.error(err?.message || "Erreur lors de l'enregistrement.");
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const formValues = form.getFieldsValue();
            const res = await enrichmentApi.testConnection({
                crc_api_url: formValues.crc_api_url || undefined,
                crc_api_key: formValues.crc_api_key || undefined,
            });
            const data = res.data || res;
            setTestResult({ ok: data.ok, message: data.message });
        } catch (err) {
            const msg = err?.message || 'Impossible de joindre le service.';
            setTestResult({ ok: false, message: msg });
        } finally {
            setTesting(false);
        }
    };

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl)
            .then(() => message.success('URL copiée.'))
            .catch(() => message.error('Impossible de copier.'));
    };

    return (
        <Drawer
            title={
                <Space>
                    <ApiOutlined style={{ color: '#16a34a' }} />
                    <span>Service d'enrichissement</span>
                    {!loading && (
                        isConfigured
                            ? <Tag color="success" icon={<CheckCircleOutlined />}>Configuré</Tag>
                            : <Tag color="warning" icon={<CloseCircleOutlined />}>Non configuré</Tag>
                    )}
                </Space>
            }
            open={open}
            onClose={onClose}
            size={"large"}
            loading={loading}
            footer={
                <Row justify="space-between" align="middle">
                    <Col>
                        <Button
                            icon={<ThunderboltOutlined />}
                            onClick={handleTest}
                            loading={testing}
                            disabled={!isConfigured}
                        >
                            Tester la connexion
                        </Button>
                    </Col>
                    <Col>
                        <Space>
                            <Button onClick={onClose}>Annuler</Button>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={handleSave}
                                loading={saving}
                                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                            >
                                Enregistrer
                            </Button>
                        </Space>
                    </Col>
                </Row>
            }
        >
            <Form form={form} layout="vertical" requiredMark={false}>

                {/* Section API */}
                <SectionLabel
                    icon={<LinkOutlined />}
                    title="Connexion API"
                    description="Identifiants de base pour joindre le service d'enrichissement."
                />

                <Form.Item
                    name="crc_api_url"
                    label="URL de l'API"
                    rules={[{ required: true, message: "Veuillez saisir l'URL de l'API." }]}
                    tooltip="URL de base du service d'enrichissement, sans slash final."
                >
                    <Input
                        prefix={<LinkOutlined style={{ color: '#bfbfbf' }} />}
                        placeholder="https://api.example.com/v1"
                    />
                </Form.Item>

                <Form.Item
                    name="crc_api_key"
                    label="Clé API"
                    tooltip="Laissez vide pour conserver la clé existante."
                    style={{ marginBottom: 0 }}
                >
                    <Input.Password
                        prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />}
                        placeholder="Laissez vide pour ne pas modifier"
                    />
                </Form.Item>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16, marginTop: 4 }}>
                    La clé actuelle est masquée pour des raisons de sécurité.
                </Text>

                {testResult && (
                    <Alert
                        type={testResult.ok ? 'success' : 'error'}
                        showIcon
                        message={testResult.ok ? 'Connexion réussie' : 'Échec de la connexion'}
                        description={testResult.message}
                        style={{ marginBottom: 16 }}
                        closable
                        onClose={() => setTestResult(null)}
                    />
                )}

                <Divider style={{ margin: '4px 0 24px' }} />

                {/* Section Webhook */}
                <SectionLabel
                    icon={<SafetyCertificateOutlined />}
                    title="Webhook (révélation de mobile)"
                    description="Le numéro de mobile est transmis de façon asynchrone via webhook. Configurez l'URL ci-dessous dans les paramètres de votre service d'enrichissement."
                />

                <Form.Item
                    name="crc_webhook_secret"
                    label={<span>Secret webhook <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>(optionnel)</Text></span>}
                    tooltip="Clé de sécurité pour vérifier l'authenticité des appels entrants. Laissez vide si votre service ne l'exige pas."
                    style={{ marginBottom: webhookUrl ? 16 : 0 }}
                >
                    <Input.Password
                        prefix={<SafetyCertificateOutlined style={{ color: '#bfbfbf' }} />}
                        placeholder="Laissez vide pour ne pas modifier"
                    />
                </Form.Item>

                {webhookUrl && (
                    <div style={{
                        background: '#fafafa',
                        border: '1px solid #f0f0f0',
                        borderRadius: 8,
                        padding: '12px 14px',
                        marginTop: 4,
                    }}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                            URL à configurer dans votre service pour recevoir les réponses :
                        </Text>
                        <Row gutter={8} align="middle">
                            <Col flex="1">
                                <Input
                                    value={webhookUrl}
                                    readOnly
                                    style={{
                                        fontFamily: 'monospace',
                                        fontSize: 11,
                                        background: '#fff',
                                        color: '#262626',
                                    }}
                                />
                            </Col>
                            <Col>
                                <Tooltip title="Copier l'URL">
                                    <Button icon={<CopyOutlined />} onClick={copyWebhookUrl} />
                                </Tooltip>
                            </Col>
                        </Row>
                    </div>
                )}
            </Form>
        </Drawer>
    );
}
