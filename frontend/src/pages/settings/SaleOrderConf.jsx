import { useState, useEffect } from "react";
import { Drawer, Form, Input, Button, Row, Col, Spin, Space, InputNumber, Upload } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined, UploadOutlined } from "@ant-design/icons";
import { saleOrderConfApi, messageTemplatesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import RichTextEditor from "../../components/common/RichTextEditor";
import MessageTemplateSelect from "../../components/select/MessageTemplateSelect";
import MessageEmailAccountSelect from "../../components/select/MessageEmailAccountSelect";
import CommitmentDurationSelect from "../../components/select/CommitmentDurationSelect";
import RenewDurationSelect from "../../components/select/RenewDurationSelect";
import NoticeDurationSelect from "../../components/select/NoticeDurationSelect";
import InvoicingDurationSelect from "../../components/select/InvoicingDurationSelect";
import PaymentConditionSelect from "../../components/select/PaymentConditionSelect";

const { TextArea } = Input;


/**
 * Composant SaleOrderConf
 * Formulaire de configuration des ventes dans un Drawer avec éditeur riche
 */
export default function SaleOrderConf({ saleOrderConfId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [durations, setDurations] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [cgvConfigured, setCgvConfigured] = useState(false);
    const [cgvUploading, setCgvUploading] = useState(false);


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
    const { submit, loading, entity } = useEntityForm({
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

    useEffect(() => {
        setCgvConfigured(!!entity?.sco_cgv_path);
    }, [entity]);

    const handleFormSubmit = async (values) => {
        await submit(values);
    };

    const handleCgvUpload = async (options) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append('cgv_file', file);
        setCgvUploading(true);
        try {
            await saleOrderConfApi.uploadCgv(saleOrderConfId, formData);
            setCgvConfigured(true);
            message.success('CGV uploadées avec succès.');
            onSuccess();
        } catch {
            message.error("Erreur lors de l'upload des CGV.");
            onError(new Error('Upload failed'));
        } finally {
            setCgvUploading(false);
        }
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
                            <Col span={8}>
                                <Form.Item
                                    name="sco_qutote_default_validity"
                                    label="Validité devis par défaut (jrs) "
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

                    {/* Section: Abonnements */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Abonnements (valeurs par défaut)
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_dur_id_commitment"
                                    label="Engagement par défaut"
                                >
                                    <CommitmentDurationSelect
                                        loadInitially={true}
                                        initialData={entity?.commitmentDuration}
                                        placeholder="Sélectionner une durée d'engagement..."
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_dur_id_renew"
                                    label="Reconduction par défaut"
                                >
                                    <RenewDurationSelect
                                        loadInitially={true}
                                        initialData={entity?.renewDuration}
                                        placeholder="Sélectionner une reconduction..."
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_dur_id_notice"
                                    label="Préavis par défaut"
                                >
                                    <NoticeDurationSelect
                                        loadInitially={true}
                                        initialData={entity?.noticeDuration}
                                        placeholder="Sélectionner un préavis..."
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_dur_id_invoicing"
                                    label="Périodicité de facturation par défaut"
                                >
                                    <InvoicingDurationSelect
                                        loadInitially={true}
                                        initialData={entity?.invoicingDuration}
                                        placeholder="Sélectionner une périodicité..."
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="fk_dur_id_payment_condition"
                                    label="Condition de règlement par défaut"
                                >
                                    <PaymentConditionSelect
                                        loadInitially={true}
                                        initialData={entity?.paymentCondition}
                                        placeholder="Sélectionner une condition de règlement..."
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
                                        height: 150px;
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
                                        height={150}
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

                    {/* Section: CGV */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3 style={{ marginBottom: 16, fontWeight: "bold", fontSize: "16px" }}>
                            Conditions Générales de Vente (CGV)
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    {cgvConfigured && (
                                        <span style={{ color: "#52c41a", fontSize: 13 }}>
                                            ✓ CGV configurées
                                        </span>
                                    )}
                                    <Upload
                                        accept=".pdf"
                                        showUploadList={false}
                                        customRequest={handleCgvUpload}
                                    >
                                        <Button icon={<UploadOutlined />} loading={cgvUploading}>
                                            {cgvConfigured ? "Remplacer les CGV (PDF)" : "Uploader les CGV (PDF)"}
                                        </Button>
                                    </Upload>
                                </div>
                                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                                    Le fichier PDF des CGV sera accessible lors de la signature électronique des devis.
                                    L&apos;envoi d&apos;une demande de signature nécessite que les CGV soient configurées.
                                </div>
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
