import { Drawer, Form, Input, Button, Row, Col, Popconfirm, Spin, Space } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { prospectLostReasonsApi } from "../../services/apiProspect";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

export default function ProspectLostReason({ reasonId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const pageLabel = Form.useWatch("plr_label", form);

    const { submit, remove, loading } = useEntityForm({
        api: prospectLostReasonsApi,
        entityId: reasonId,
        idField: "plr_id",
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

    const handleFormSubmit = async (values) => { await submit(values); form.resetFields(); };
    const handleDelete = async () => await remove();
    const handleClose = () => { form.resetFields(); onClose?.(); };

    return (
        <Drawer
            title={pageLabel ? `Édition - ${pageLabel}` : "Nouvelle raison de perte"}
            placement="right" onClose={handleClose} open={open} size={drawerSize} forceRender
            footer={
                <Space style={{ width: "100%", display: "flex", paddingRight: 15, justifyContent: "flex-end" }}>
                    {reasonId && (
                        <><div style={{ flex: 1 }} />
                            <CanAccess permission="settings.prospectconf.delete">
                                <Popconfirm title="Supprimer cette raison ?" description="Cette action est irréversible." onConfirm={handleDelete} okText="Oui" cancelText="Non">
                                    <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
                                </Popconfirm>
                            </CanAccess></>
                    )}
                    <Button onClick={handleClose}>Annuler</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>Enregistrer</Button>
                </Space>
            }
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="plr_id" hidden><Input /></Form.Item>
                    <div className="box" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={24}>
                                <Form.Item name="plr_label" label="Libellé" rules={[{ required: true, message: "Le libellé est requis" }]}>
                                    <Input placeholder="Raison de perte" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
