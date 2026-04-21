import { Drawer, Form, Input, InputNumber, ColorPicker, Select, Button, Row, Col, Popconfirm, Spin, Space } from "antd";
import {
    DeleteOutlined, SaveOutlined,
    ClockCircleOutlined, SyncOutlined, CheckCircleOutlined,
    ExclamationCircleOutlined, PauseCircleOutlined, ToolOutlined,
    StopOutlined, CalendarOutlined, HomeOutlined, WarningOutlined,
    UserOutlined, QuestionCircleOutlined, MinusCircleOutlined,
    PlayCircleOutlined, HourglassOutlined, PhoneOutlined,
} from "@ant-design/icons";
import { ticketStatusesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

const ICON_OPTIONS = [
    { value: "ClockCircleOutlined",      label: "Horloge",            icon: <ClockCircleOutlined /> },
    { value: "PlayCircleOutlined",       label: "En cours",           icon: <PlayCircleOutlined /> },
    { value: "SyncOutlined",             label: "Synchronisation",    icon: <SyncOutlined /> },
    { value: "PauseCircleOutlined",      label: "En pause",           icon: <PauseCircleOutlined /> },
    { value: "HourglassOutlined",        label: "Sablier",            icon: <HourglassOutlined /> },
    { value: "CalendarOutlined",         label: "Calendrier",         icon: <CalendarOutlined /> },
    { value: "ToolOutlined",             label: "Outil / Intervention", icon: <ToolOutlined /> },
    { value: "HomeOutlined",             label: "Sur site",           icon: <HomeOutlined /> },
    { value: "PhoneOutlined",            label: "Téléphone",          icon: <PhoneOutlined /> },
    { value: "UserOutlined",             label: "Utilisateur",        icon: <UserOutlined /> },
    { value: "ExclamationCircleOutlined",label: "Urgent",             icon: <ExclamationCircleOutlined /> },
    { value: "WarningOutlined",          label: "Avertissement",      icon: <WarningOutlined /> },
    { value: "QuestionCircleOutlined",   label: "À qualifier",        icon: <QuestionCircleOutlined /> },
    { value: "CheckCircleOutlined",      label: "Terminé",            icon: <CheckCircleOutlined /> },
    { value: "StopOutlined",             label: "Arrêté / Annulé",    icon: <StopOutlined /> },
    { value: "MinusCircleOutlined",      label: "Ignoré",             icon: <MinusCircleOutlined /> },
];

export default function TicketStatusForm({ ticketStatusId, open, onClose, onSubmit, drawerSize = "large" }) {
    const [form] = Form.useForm();
    const pageLabel = Form.useWatch("tke_label", form);

    const { submit, remove, loading } = useEntityForm({
        api: ticketStatusesApi,
        entityId: ticketStatusId,
        idField: "tke_id",
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
            title={pageLabel ? `Édition - ${pageLabel}` : "Nouveau statut"}
            placement="right"
            onClose={handleClose}
            open={open}
            size={drawerSize}
            forceRender
            footer={
                <Space style={{ width: "100%", display: "flex", paddingRight: 15, justifyContent: "flex-end" }}>
                    {ticketStatusId && (
                        <>
                            <div style={{ flex: 1 }} />
                            <CanAccess permission="settings.ticketingconf.delete">
                                <Popconfirm
                                    title="Supprimer ce statut ?"
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
                    <Form.Item name="tke_id" hidden><Input /></Form.Item>
                    <Row gutter={[16, 8]}>
                        <Col span={24}>
                            <Form.Item
                                name="tke_label"
                                label="Libellé"
                                rules={[{ required: true, message: "Le libellé est requis" }]}
                            >
                                <Input placeholder="Libellé du statut" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="tke_order" label="Ordre">
                                <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="tke_color" label="Couleur" getValueFromEvent={(color) => color?.toHexString()}>
                                <ColorPicker format="hex" showText />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]}>
                        <Col span={24}>
                            <Form.Item name="tke_icon" label="Icône">
                                <Select
                                    allowClear
                                    placeholder="Sélectionner une icône..."
                                    options={ICON_OPTIONS.map((o) => ({
                                        value: o.value,
                                        label: (
                                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                {o.icon}
                                                {o.label}
                                            </span>
                                        ),
                                    }))}
                                    optionRender={(option) => (
                                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {ICON_OPTIONS.find((o) => o.value === option.value)?.icon}
                                            {option.label}
                                        </span>
                                    )}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Spin>
        </Drawer>
    );
}
