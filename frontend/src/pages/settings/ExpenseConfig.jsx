import { useState, useEffect } from "react";
import { Drawer, Form, Button, Row, Col, Spin, Space, Switch, Divider } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined } from "@ant-design/icons";
import { expenseConfigApi } from "../../services/api";
import MileageScaleManager from "../../components/expense/MileageScaleManager";

/**
 * Composant ExpenseConfig
 * Formulaire de configuration du module notes de frais dans un Drawer
 */
export default function ExpenseConfig({ open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    /**
     * Charger la configuration au montage
     */
    useEffect(() => {
        if (open) {
            loadConfig();
        }
    }, [open]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const response = await expenseConfigApi.get(1);
            const config = response.data;
            form.setFieldsValue({
                eco_id: config.eco_id,
                eco_ocr_enable: config.eco_ocr_enable,
            });
        } catch (error) {
            console.error("Erreur lors du chargement de la configuration:", error);
            message.error("Erreur lors du chargement de la configuration");
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = async (values) => {
        setSaving(true);
        try {
            await expenseConfigApi.update(1, values);
            message.success("Configuration mise a jour");
            onSubmit?.({ action: 'update', data: values });
            onClose?.();
        } catch (error) {
            console.error("Erreur lors de la sauvegarde:", error);
            message.error("Erreur lors de la sauvegarde");
        } finally {
            setSaving(false);
        }
    };

    /**
     * Fermeture du drawer
     */
    const handleClose = () => {
        form.resetFields();
        onClose?.();
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
                loading={saving}
                onClick={() => form.submit()}
            >
                Enregistrer
            </Button>
        </Space>
    );

    return (
        <Drawer
            title="Configuration du module notes de frais"
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="eco_id" hidden>
                        <input type="hidden" />
                    </Form.Item>

                    {/* Section: OCR */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Reconnaissance automatique (OCR)
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="eco_ocr_enable"
                                    label="Activer l'OCR sur les justificatifs"
                                    valuePropName="checked"
                                    extra="Permet d'extraire automatiquement les informations des justificatifs (date, montant, commercant)"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>

                <Divider />

                {/* Section: Barème kilométrique */}
                <div className="box">
                    <h3
                        style={{
                            marginBottom: 16,
                            fontWeight: "bold",
                            fontSize: "16px"
                        }}
                    >
                        Bareme kilometrique
                    </h3>
                    <MileageScaleManager />
                </div>
            </Spin>
        </Drawer>
    );
}
