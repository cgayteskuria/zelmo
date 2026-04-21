import { useState } from "react";
import { Drawer, Form, Input, Button, Row, Col, Spin, Space, Switch, Alert, Divider } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined, MailOutlined } from "@ant-design/icons";
import { ticketConfigApi } from "../../services/api";
import CanAccess from "../../components/common/CanAccess";
import MessageEmailAccountSelect from "../../components/select/MessageEmailAccountSelect";
import MessageTemplateSelect from "../../components/select/MessageTemplateSelect";
import { useEntityForm } from "../../hooks/useEntityForm";

/**
 * Composant TicketConfig
 * Formulaire de configuration du module assistance dans un Drawer
 */
export default function TicketConfig({ open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [sendAcknowledgment, setSendAcknowledgment] = useState(false);
    const [collectingEmails, setCollectingEmails] = useState(false);

    // Callback appelé après le chargement des données
    const handleDataLoaded = (data) => {
        setSendAcknowledgment(data.tco_send_acknowledgment || false);
    };

    // Utilisation du hook useEntityForm
    const { loading, submit } = useEntityForm({
        api: ticketConfigApi,
        form,
        open,
        entityId: 1, // Configuration unique avec ID=1
        idField: 'tco_id',
        onDataLoaded: handleDataLoaded,
        beforeSubmit: (values) => {
            // Validation conditionnelle
            if (values.tco_send_acknowledgment && !values.fk_emt_id_acknowledgment) {
                message.error("Le template d'accusé de réception est requis si vous activez l'envoi d'accusé de réception");
                return false;
            }
            return true;
        },
        afterSubmit: () => {
            message.success('Configuration du module assistance mise à jour avec succès');
            onSubmit?.();
            onClose();
        },
        messages: {
            update: 'Configuration du module assistance mise à jour avec succès',
            loadError: 'Erreur lors du chargement de la configuration',
            saveError: 'Erreur lors de la sauvegarde',
        },
    });

    const handleFormSubmit = async (values) => {
        await submit(values, { closeDrawer: false });
    };

    const handleForceEmailCollection = async () => {
        try {
            setCollectingEmails(true);
            const response = await ticketConfigApi.forceEmailCollection({ limit: 50 });

            if (response.success) {
                message.success(response.message || 'Collecte des emails effectuée avec succès');
            } else {
                message.warning(response.message || 'Collecte des emails terminée avec des erreurs');
            }

            if (response.errors && response.errors.length > 0) {
                response.errors.forEach(error => {
                    message.error(error);
                });
            }
        } catch (error) {
            console.error('Erreur lors de la collecte des emails:', error);
            if (error.response?.data?.message) {
                message.error(error.response.data.message);
            } else {
                message.error('Erreur lors de la collecte des emails');
            }
        } finally {
            setCollectingEmails(false);
        }
    };

    const handleSwitchChange = (checked) => {
        setSendAcknowledgment(checked);
        if (!checked) {
            // Si désactivé, vider le champ template acknowledgment
            form.setFieldValue('fk_emt_id_acknowledgment', null);
        }
    };

    const handleClose = () => {
        form.resetFields();
        setSendAcknowledgment(false);
        onClose();
    };

    return (
        <Drawer
            title="Configuration du module assistance"
            placement="right"
            open={open}
            onClose={handleClose}
            size={drawerSize}
            forceRender
            footer={
                <Space style={{ float: "right" }}>
                    <Button onClick={handleClose}>Annuler</Button>
                    <CanAccess permission="settings.ticketingconf.edit">
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={() => form.submit()}
                            loading={loading}
                        >
                            Enregistrer
                        </Button>
                    </CanAccess>
                </Space>
            }
        >
            <Spin spinning={loading}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    initialValues={{
                        tco_send_acknowledgment: false,
                    }}
                >
                    <Form.Item name="tco_id" hidden>
                        <Input />
                    </Form.Item>

                    <Alert
                        message="Configuration du module assistance"
                        description="Configurez le compte email pour recevoir les tickets et les modèles de messages automatiques."
                        type="info"
                        showIcon
                        style={{ marginBottom: 24 }}
                    />

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="fk_eml_id"
                                label="Compte email pour la réception des tickets"
                                tooltip="Compte email qui sera utilisé pour recevoir les nouveaux tickets"
                            >
                                <MessageEmailAccountSelect
                                    placeholder="Sélectionner un compte email"
                                    selectProps={{
                                        allowClear: true,
                                        showSearch: true
                                    }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider>Accusé de réception</Divider>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="tco_send_acknowledgment"
                                label="Envoyer un accusé de réception automatique"
                                valuePropName="checked"
                            >
                                <Switch onChange={handleSwitchChange} />
                            </Form.Item>
                        </Col>
                    </Row>

                    {sendAcknowledgment && (
                        <Row gutter={16}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id_acknowledgment"
                                    label="Template d'accusé de réception"
                                    rules={[
                                        {
                                            required: sendAcknowledgment,
                                            message: "Le template d'accusé de réception est requis"
                                        }
                                    ]}
                                >
                                    <MessageTemplateSelect
                                        placeholder="Sélectionner un template"
                                        selectProps={{
                                            allowClear: true,
                                            showSearch: true
                                        }}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    <Divider>Templates de messages</Divider>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="fk_emt_id_affectation"
                                label="Template d'affectation"
                                tooltip="Template utilisé lors de l'affectation d'un ticket à un utilisateur"
                            >
                                <MessageTemplateSelect
                                    placeholder="Sélectionner un template"
                                    selectProps={{
                                        allowClear: true,
                                        showSearch: true
                                    }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="fk_emt_id_answer"
                                label="Template de réponse"
                                tooltip="Template utilisé pour répondre aux tickets"
                            >
                                <MessageTemplateSelect
                                    placeholder="Sélectionner un template"
                                    selectProps={{
                                        allowClear: true,
                                        showSearch: true
                                    }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider>Collecte des emails</Divider>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Alert
                                message="Forcer la collecte des emails"
                                description="Cliquez sur le bouton ci-dessous pour forcer la collecte des emails depuis le compte configuré et créer automatiquement des tickets."
                                type="warning"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <CanAccess permission="settings.ticketingconf.edit">
                                <Button
                                    type="secondary"
                                    icon={<MailOutlined />}
                                    onClick={handleForceEmailCollection}
                                    loading={collectingEmails}
                                    block
                                >
                                    Forcer la collecte des emails
                                </Button>
                            </CanAccess>
                        </Col>
                    </Row>
                </Form>
            </Spin>
        </Drawer>
    );
}
