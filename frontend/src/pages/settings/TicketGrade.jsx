import { Drawer, Form, Input, InputNumber, Button, Row, Col, Popconfirm, Spin, Space, ColorPicker } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { ticketGradesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

export default function TicketGrade({ ticketGradeId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const pageLabel = Form.useWatch("tkg_label", form);

    const { submit, remove, loading } = useEntityForm({
        api: ticketGradesApi,
        entityId: ticketGradeId,
        idField: "tkg_id",
        form,
        open,
        onSuccess: ({ action, data }, closeDrawer = true) => {
            onSubmit?.({ action, data });
            if (closeDrawer) onClose?.();
        },
        onDelete: ({ id }) => {
            onSubmit?.({ action: "delete", id });
            onClose?.();
        },
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
        onClose?.();
    };

    return (
        <Drawer
            title={pageLabel ? `Édition - ${pageLabel}` : "Nouveau grade"}
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            forceRender
            footer={
                <Space style={{ width: "100%", display: "flex", paddingRight: 15, justifyContent: "flex-end" }}>
                    {ticketGradeId && (
                        <>
                            <div style={{ flex: 1 }} />
                            <CanAccess permission="settings.ticketingconf.delete">
                                <Popconfirm
                                    title="Supprimer ce grade ?"
                                    description="Cette action est irréversible."
                                    onConfirm={handleDelete}
                                    okText="Oui"
                                    cancelText="Non"
                                >
                                    <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
                                </Popconfirm>
                            </CanAccess>
                        </>
                    )}
                    <Button onClick={handleClose}>Annuler</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
                        Enregistrer
                    </Button>
                </Space>
            }
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="tkg_id" hidden><Input /></Form.Item>
                    <Row gutter={[16, 8]}>
                        <Col span={24}>
                            <Form.Item
                                name="tkg_label"
                                label="Libellé"
                                rules={[{ required: true, message: "Le libellé est requis" }]}
                            >
                                <Input placeholder="Libellé du grade" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="tkg_order" label="Ordre">
                                <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="tkg_color"
                                label="Couleur"
                                getValueFromEvent={(color) => color?.toHexString?.() ?? color}
                                getValueProps={(value) => ({ value: value || undefined })}
                            >
                                <ColorPicker showText format="hex" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Spin>
        </Drawer>
    );
}
