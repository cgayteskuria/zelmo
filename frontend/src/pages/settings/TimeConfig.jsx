import { useEffect, useState } from "react";
import { Drawer, Form, Input, Button, Row, Col, Spin, Space, Alert } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined } from "@ant-design/icons";
import { timeConfigApi } from "../../services/api";
import CanAccess from "../../components/common/CanAccess";
import ProductSelect from "../../components/select/ProductSelect";

/**
 * Composant TimeConfig
 * Formulaire de configuration du module temps dans un Drawer
 */
export default function TimeConfig({ open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [productInitialData, setProductInitialData] = useState(null);

    useEffect(() => {
        if (open) {
            loadConfig();
        }
    }, [open]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const response = await timeConfigApi.get(1);
            const config = response.data.data ?? response.data;
            form.setFieldsValue({
                tmc_id:     config.tmc_id,
                fk_prt_id:  config.fk_prt_id ?? null,
            });
            if (config.product) {
                setProductInitialData({
                    prt_id:        config.product.prt_id,
                    prt_label:     config.product.prt_label,
                    prt_reference: config.product.prt_ref,
                });
            }
        } catch (error) {
            message.error("Erreur lors du chargement de la configuration");
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = async (values) => {
        setSaving(true);
        try {
            await timeConfigApi.update(1, values);
            message.success("Configuration du module temps mise à jour");
            onSubmit?.();
            onClose?.();
        } catch (error) {
            message.error("Erreur lors de la sauvegarde");
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        form.resetFields();
        setProductInitialData(null);
        onClose?.();
    };

    const drawerActions = (
        <Space style={{ width: "100%", display: "flex", paddingRight: "15px", justifyContent: "flex-end" }}>
            <Button onClick={handleClose}>Annuler</Button>
            <CanAccess permission="time.invoice">
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={() => form.submit()}
                >
                    Enregistrer
                </Button>
            </CanAccess>
        </Space>
    );

    return (
        <Drawer
            title="Configuration du module temps"
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="tmc_id" hidden>
                        <Input />
                    </Form.Item>

                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3 style={{ marginBottom: 16, fontWeight: "bold", fontSize: "16px" }}>
                            Facturation des saisies de temps
                        </h3>
                        <Alert
                            type="info"
                            showIcon
                            message="Ce produit sera utilisé lors de la génération des factures depuis les saisies de temps approuvées. Sa TVA sera appliquée aux lignes de facture."
                            style={{ marginBottom: 16 }}
                        />
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_prt_id"
                                    label="Produit de facturation"
                                    rules={[{ required: true, message: "Le produit de facturation est requis" }]}
                                    extra="Produit utilisé comme base pour les lignes de facturation des saisies de temps"
                                >
                                    <ProductSelect
                                        loadInitially={true}
                                        initialData={productInitialData}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
