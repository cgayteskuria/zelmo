import { Drawer, Form, Input, InputNumber, Select, Button, Spin, Space, ColorPicker, DatePicker, Popconfirm, Row, Col, Tooltip } from "antd";
import { SaveOutlined, DeleteOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { timeProjectsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import PartnerSelect from "../../components/select/PartnerSelect";
import CanAccess from "../../components/common/CanAccess";
import { useEffect } from "react";
import dayjs from "dayjs";

const PALETTE = [
    "#7c3aed", "#2563eb", "#0891b2", "#059669", "#65a30d",
    "#d97706", "#dc2626", "#db2777", "#7c3aed", "#4f46e5",
];
function randomColor() {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

export default function TimeProjectForm({ projectId, open, onClose, onSubmit }) {
    const [form] = Form.useForm();
    const tprLib = Form.useWatch("tpr_lib", form);

    // Couleur aléatoire à la création
    useEffect(() => {
        if (open && !projectId) {
            form.setFieldValue("tpr_color", randomColor());
        }
    }, [open, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const { submit, remove, loading } = useEntityForm({
        api: timeProjectsApi,
        entityId: projectId,
        idField: "tpr_id",
        form,
        open,
        transformData: (data) => ({
            ...data,
            tpr_deadline: data.tpr_deadline ? dayjs(data.tpr_deadline) : null,
        }),
        onSuccess: ({ action, data }) => {
            onSubmit?.({ action, data });
            onClose?.();
        },
        onDelete: ({ id }) => {
            onSubmit?.({ action: "delete", id });
            onClose?.();
        },
    });

    const handleClose = () => {
        form.resetFields();
        onClose?.();
    };

    return (
        <Drawer
            title={tprLib ? `Projet — ${tprLib}` : "Nouveau projet"}
            placement="right"
            onClose={handleClose}
            open={open}
            size="large"
            forceRender
            footer={
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    {projectId ? (
                        <CanAccess permission="time.projects.edit">
                            <Popconfirm
                                title="Supprimer ce projet ?"
                                description="Cette action est irréversible."
                                onConfirm={remove}
                                okText="Supprimer"
                                okButtonProps={{ danger: true }}
                                cancelText="Annuler"
                            >
                                <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
                            </Popconfirm>
                        </CanAccess>
                    ) : <span />}
                    <Space>
                        <Button onClick={handleClose}>Annuler</Button>
                        <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
                            Enregistrer
                        </Button>
                    </Space>
                </Space>
            }
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={submit}>
                    <Form.Item name="tpr_id" hidden><Input /></Form.Item>

                    <Row gutter={12} align="bottom">
                        <Col span={17}>
                            <Form.Item name="tpr_lib" label="Nom du projet" rules={[{ required: true, message: "Champ requis" }]}>
                                <Input placeholder="Ex: Refonte site web…" maxLength={255} />
                            </Form.Item>
                        </Col>
                        <Col span={3}>
                            <Form.Item name="tpr_color" label="Couleur">
                                <ColorPicker
                                    format="hex"
                                    showText={false}
                                    onChange={(_, hex) => form.setFieldValue("tpr_color", hex.slice(0, 7))}
                                />
                            </Form.Item>

                        </Col>
                        <Col span={4}>
                            <Form.Item name="tpr_status" label="Statut" initialValue={0}>
                                <Select options={[
                                    { value: 0, label: "Actif" },
                                    { value: 1, label: "Archivé" },
                                ]} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="fk_ptr_id" label="Client" rules={[{ required: true, message: "Champ requis" }]}>
                        <PartnerSelect loadInitially filters={{ is_customer: 1 }} />
                    </Form.Item>

                    <Row gutter={12}>
                        <Col span={6}>
                            <Form.Item
                                name="tpr_budget_hours"
                                label={
                                    <Space size={4}>
                                        Budget
                                        <Tooltip title="Nombre d'heures maximum allouées au projet. Laissez vide pour un budget illimité. Une barre de progression s'affiche dans la liste des projets.">
                                            <InfoCircleOutlined style={{ color: "var(--color-muted)", fontSize: 13 }} />
                                        </Tooltip>
                                    </Space>
                                }
                            >
                                <InputNumber min={0} step={0.5} placeholder="Illimité" style={{ width: "100%" }} suffix="h" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="tpr_deadline"
                                label={
                                    <Space size={4}>
                                        Date limite
                                        <Tooltip title="Date de fin prévue du projet. Passé cette date, le projet apparaît en retard dans la liste.">
                                            <InfoCircleOutlined style={{ color: "var(--color-muted)", fontSize: 13 }} />
                                        </Tooltip>
                                    </Space>
                                }
                            >
                                <DatePicker style={{ width: "auto" }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>

                        <Col span={7}>
                            <Form.Item
                                name="tpr_hourly_rate"
                                label={
                                    <Space size={4}>
                                        Taux horaire HT par défaut
                                        <Tooltip title="Taux appliqué automatiquement aux saisies facturables de ce projet. Il peut être surchargé saisie par saisie.">
                                            <InfoCircleOutlined style={{ color: "var(--color-muted)", fontSize: 13 }} />
                                        </Tooltip>
                                    </Space>
                                }
                            >
                                <InputNumber min={0} step={5} placeholder="Ex: 120" style={{ width: "100%" }} suffix="€/h" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="tpr_description" label="Description">
                        <Input.TextArea rows={5} placeholder="Contexte du projet…" maxLength={500} showCount />
                    </Form.Item>
                </Form>
            </Spin>
        </Drawer>
    );
}
