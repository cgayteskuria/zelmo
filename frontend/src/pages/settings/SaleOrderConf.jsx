import { useState, useEffect } from "react";
import { Drawer, Form, Input, Button, Row, Col, Spin, Space, InputNumber } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined } from "@ant-design/icons";
import { saleOrderConfApi, messageTemplatesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import RichTextEditor from "../../components/common/RichTextEditor";
import MessageTemplateSelect from "../../components/select/MessageTemplateSelect";
import MessageEmailAccountSelect from "../../components/select/MessageEmailAccountSelect";

const { TextArea } = Input;


/**
 * Composant SaleOrderConf
 * Formulaire de configuration des ventes dans un Drawer avec éditeur riche
 */
export default function SaleOrderConf({ saleOrderConfId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [durations, setDurations] = useState([]);
    const [loadingData, setLoadingData] = useState(false);


    /**
     * Charger les données des selects
     */
    useEffect(() => {
        if (open) {
            loadSelectData();
        }
    }, [open]);

    const loadSelectData = async () => {
        setLoadingData(true);
        try {
            
            // Charger les durées (dur_reference=6 pour les durées de validité de devis)
            // Note: Vous devrez peut-être créer un endpoint API pour cela
            // Pour l'instant, on utilise un tableau statique
            setDurations([
                { value: 1, label: "15 jours" },
                { value: 2, label: "1 mois" },
                { value: 3, label: "2 mois" },
                { value: 4, label: "3 mois" }
            ]);
        } catch (error) {
            console.error("Erreur lors du chargement des données:", error);
            message.error("Erreur lors du chargement des données");
        } finally {
            setLoadingData(false);
        }
    };

    /**
     * On instancie les fonctions CRUD
     */
    const { submit, loading } = useEntityForm({
        api: saleOrderConfApi,
        entityId: saleOrderConfId,
        idField: "sco_id",
        form,
        open,

        onSuccess: ({ action, data }, closeDrawer = true) => {
            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        }
    });

    const handleFormSubmit = async (values) => {
        await submit(values);
    };

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        if (onClose) {
            onClose();
        }
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
                justifyContent: "flex-end"
            }}
        >
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
    );

    return (
        <Drawer
            title="Configuration des ventes"
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading || loadingData} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="sco_id" hidden>
                        <Input />
                    </Form.Item>

                    {/* Section: Devis */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Devis
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="sco_qutote_default_validity"
                                    label="Durée par défaut de validité d'un devis"
                                    rules={[
                                        {
                                            required: true,
                                            message: "La durée de validité est requise"
                                        }
                                    ]}
                                >
                                    <InputNumber
                                        
                                        precision={0}
                                        min={1}
                                      
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: Paramètres d'impression */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Paramètres d'impression
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <style>
                                    {`
                                    .ql-container {
                                        height: 250px;
                                    }

                                    .ql-editor {
                                        height: 100%;
                                        overflow-y: auto;
                                    }
                                    `}
                                </style>
                                <Form.Item
                                    name="sco_sale_legal_notice"
                                    label="Mention légale"
                                    rules={[
                                        {
                                            required: false
                                        }
                                    ]}
                                    getValueFromEvent={(content) => content}
                                >
                                    <RichTextEditor
                                        height={300}
                                        placeholder="Saisir la mention légale..."
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: Compte email */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Compte email
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_eml_id"
                                    label="Compte email pour l'envoi des devis/commandes"
                                >
                                    <MessageEmailAccountSelect                                       
                                        placeholder="Sélectionner un compte email..."
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: Modèle mail */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Modèles mail
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id_sale"
                                    label="Bon de commande standard"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Ce modèle est requis"
                                        }
                                    ]}
                                >
                                    <MessageTemplateSelect />
                                </Form.Item>
                            </Col>

                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id_sale_validation"
                                    label="Bon de commande avec validation en ligne"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Ce modèle est requis"
                                        }
                                    ]}
                                >
                                    <MessageTemplateSelect />
                                </Form.Item>
                            </Col>

                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id_token_renew"
                                    label="Mail contenant le token"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Ce modèle est requis"
                                        }
                                    ]}
                                >
                                     <MessageTemplateSelect />
                                </Form.Item>
                            </Col>

                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id_sale_confirmation"
                                    label="Confirmation de commande envoyée au client après validation"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Ce modèle est requis"
                                        }
                                    ]}
                                >
                                    <MessageTemplateSelect />
                                </Form.Item>
                            </Col>

                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id_seller_alert"
                                    label="Alerte le commercial de la validation de commande"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Ce modèle est requis"
                                        }
                                    ]}
                                >
                                     <MessageTemplateSelect />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
