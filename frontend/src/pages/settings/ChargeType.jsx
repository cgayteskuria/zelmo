import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Space } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { chargeTypesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";
import AccountSelect from "../../components/select/AccountSelect";

/**
 * Composant ChargeType
 * Formulaire d'édition dans un Drawer
 */
export default function ChargeType({ chargeTypeId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();

    const pageLabel = Form.useWatch("cht_label", form);

    const { submit, remove, loading, entity } = useEntityForm({
        api: chargeTypesApi,
        entityId: chargeTypeId,
        idField: "cht_id",
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
            {chargeTypeId && (
                <>
                    <div style={{ flex: 1 }}></div>
                    <CanAccess permission="settings.charges.delete">
                        <Popconfirm
                            title="Supprimer ce type de charge"
                            description="Êtes-vous sûr de vouloir supprimer ce type de charge ?"
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
                pageLabel ? `Édition - ${pageLabel}` : "Nouveau type de charge"
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
                    <Form.Item name="cht_id" hidden>
                        <Input />
                    </Form.Item>

                    <div className="box" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="cht_label"
                                    label="Libellé"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le libellé est requis"
                                        }
                                    ]}
                                >
                                    <Input placeholder="Libellé du type de charge" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item
                                    name="fk_acc_id"
                                    label="Compte comptable"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Le compte comptable est requis"
                                        }
                                    ]}
                                >
                                    <AccountSelect filters={{ isActive: true }} loadInitially={false} initialData={entity?.account} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
