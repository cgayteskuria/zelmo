import { Drawer, Form, Input, InputNumber, Button, Row, Col, Popconfirm, Spin, Space, Switch, ColorPicker } from "antd";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { prospectPipelineStagesApi } from "../../services/apiProspect";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

export default function ProspectPipelineStage({ stageId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const pageLabel = Form.useWatch("pps_label", form);

    const { submit, remove, loading } = useEntityForm({
        api: prospectPipelineStagesApi,
        entityId: stageId,
        idField: "pps_id",
        form,
        open,
        transformData: (data) => ({
            ...data,
            pps_is_won: !!data.pps_is_won,
            pps_is_lost: !!data.pps_is_lost,
            pps_is_active: data.pps_is_active !== 0,
        }),
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
        // Convertir la couleur du ColorPicker en hex string
        if (values.pps_color && typeof values.pps_color === 'object') {
            values.pps_color = values.pps_color.toHexString?.() || values.pps_color;
        }
        await submit(values);
        form.resetFields();
    };

    const handleDelete = async () => await remove();
    const handleClose = () => { form.resetFields(); onClose?.(); };

    return (
        <Drawer
            title={pageLabel ? `Édition - ${pageLabel}` : "Nouvelle étape"}
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            forceRender
            footer={
                <Space style={{ width: "100%", display: "flex", paddingRight: 15, justifyContent: "flex-end" }}>
                    {stageId && (
                        <>
                            <div style={{ flex: 1 }} />
                            <CanAccess permission="settings.prospectconf.delete">
                                <Popconfirm title="Supprimer cette étape ?" description="Cette action est irréversible." onConfirm={handleDelete} okText="Oui" cancelText="Non">
                                    <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
                                </Popconfirm>
                            </CanAccess>
                        </>
                    )}
                    <Button onClick={handleClose}>Annuler</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>Enregistrer</Button>
                </Space>
            }
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit} initialValues={{ pps_is_active: true, pps_default_probability: 0, pps_order: 0 }}>
                    <Form.Item name="pps_id" hidden><Input /></Form.Item>
                    <div className="box" style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 8]}>
                            <Col span={16}>
                                <Form.Item name="pps_label" label="Libellé" rules={[{ required: true, message: "Le libellé est requis" }]}>
                                    <Input placeholder="Nom de l'étape" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="pps_order" label="Ordre" rules={[{ required: true }]}>
                                    <InputNumber style={{ width: "100%" }} min={0} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="pps_color" label="Couleur" rules={[{ required: true }]}>
                                    <ColorPicker showText />
                                </Form.Item>
                            </Col>
                            <Col span={8} offset={8}>
                                <Form.Item name="pps_default_probability" label="Probabilité par défaut (%)" rules={[{ required: true }]}>
                                    <InputNumber style={{ width: "100%" }} min={0} max={100} />
                                </Form.Item>
                            </Col><Col span={6}>
                                <Form.Item name="pps_is_active" label="Actif" valuePropName="checked">
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item
                                    name="pps_is_default"
                                    label="Etape par défaut"
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="pps_is_won" label="Étape Gagné" valuePropName="checked">
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="pps_is_lost" label="Étape Perdu" valuePropName="checked">
                                    <Switch />
                                </Form.Item>
                            </Col>

                        </Row>
                    </div>
                </Form>
            </Spin>
        </Drawer>
    );
}
