import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Space } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { paymentModesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

/**
 * Composant PaymentMode
 * Formulaire d'édition dans un Drawer
 */
export default function PaymentMode({ paymentModeId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();

    const pageLabel = Form.useWatch("pam_label", form);

    const { submit, remove, loading } = useEntityForm({
        api: paymentModesApi,
        entityId: paymentModeId,
        idField: "pam_id",
        form,
        open,

        onSuccess: ({ action, data }, closeDrawer = true) => {
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

    const handleClose = () => {
        form.resetFields();
        if (onClose) {
            onClose();
        }
    };

    const drawerActions = (
        <Space
            style={{
                width: "100%",
                display: "flex",
                paddingRight: "15px",
                justifyContent: "flex-end"
            }}
        >
            {paymentModeId && (
                <>
                    <div style={{ flex: 1 }}></div>
                    <CanAccess permission="accountings.delete">
                        <Popconfirm
                            title="Supprimer ce mode de paiement"
                            description="Êtes-vous sûr de vouloir supprimer ce mode de paiement ?"
                            onConfirm={handleDelete}
                            okText="Oui"
                            cancelText="Non"
                        >
                            <Button danger icon={<DeleteOutlined />}>
                                Supprimer
                            </Button>
                        </Popconfirm>
                    </CanAccess>
                </>
            )}

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
            title={
                pageLabel ? `Édition - ${pageLabel}` : "Nouveau mode de paiement"
            }
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            footer={drawerActions}
            forceRender
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="pam_id" hidden>
                        <Input />
                    </Form.Item>

                    <div className="box" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="pam_label"
                                    label="Libellé"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le libellé est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Libellé du mode de paiement" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
