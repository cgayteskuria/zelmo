import { useState, useEffect } from "react";
import { Drawer, Form, Input, Button, Row, Col, Spin, Space, Select } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined } from "@ant-design/icons";
import { purchaseOrderConfApi, messageTemplatesApi, productsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import MessageTemplateSelect from "../../components/select/MessageTemplateSelect"
import ProductSelect from "../../components/select/ProductSelect"

/**
 * Composant PurchaseOrderConf
 * Formulaire de configuration des commandes d'achat dans un Drawer
 */
export default function PurchaseOrderConf({ purchaseOrderConfId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
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
        api: purchaseOrderConfApi,
        entityId: purchaseOrderConfId,
        idField: "pco_id",
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
            title="Configuration des commandes d'achat"
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading || loadingData} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="pco_id" hidden>
                        <Input />
                    </Form.Item>

                    {/* Section: Modèle mail */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Modèle mail
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_emt_id"
                                    label="Modèle par défaut"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le modèle par défaut est requis"
                                        }
                                    ]}
                                >
                                    <MessageTemplateSelect />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>

                    {/* Section: Import commandes et factures */}
                    <div className="box" style={{ marginBottom: 24 }}>
                        <h3
                            style={{
                                marginBottom: 16,
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            Import commandes et factures
                        </h3>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_prt_id_default"
                                    label="Produit par défaut"
                                    rules={[
                                        {
                                            required: false
                                        }
                                    ]}
                                >
                                    <ProductSelect
                                        loadInitially={true} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
