import { useState, useCallback, useMemo, useEffect } from "react";
import { Form, Input, Button, Row, Col, Dropdown, Select, Typography, Card, InputNumber } from "antd";
import { message } from '../../utils/antdStatic';
import { ArrowLeftOutlined, SendOutlined, DownOutlined, UserOutlined, MailOutlined, TeamOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import PageContainer from "../../components/common/PageContainer";
import RichTextEditor from "../../components/common/RichTextEditor";
import { ticketsApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import CanAccess from "../../components/common/CanAccess";

// Selects
import PartnerSelect from "../../components/select/PartnerSelect";
import ContactSelect from "../../components/select/ContactSelect";
import UserSelect from "../../components/select/UserSelect";
import TicketPrioritySelect from "../../components/select/TicketPrioritySelect";
import TicketSourceSelect from "../../components/select/TicketSourceSelect";
import TicketCategorySelect from "../../components/select/TicketCategorySelect";
import TicketGradeSelect from "../../components/select/TicketGradeSelect";

const { Text } = Typography;


export default function TicketCreate() {
    const navigate = useNavigate();
    const [form] = Form.useForm();

    // State création
    const [newBody, setNewBody] = useState("");
    const [newTps, setNewTps] = useState(0);
    const [newStatusId, setNewStatusId] = useState(null);
    const [newStatusLabel, setNewStatusLabel] = useState("Nouveau");
    const [newStatusColor, setNewStatusColor] = useState("#1677ff");
    const [statusOptions, setStatusOptions] = useState([]);
    const [creatingTicket, setCreatingTicket] = useState(false);
    const [fromContactInfo, setFromContactInfo] = useState(null);

    const partnerId = Form.useWatch("fk_ptr_id", form);

    // Réinitialiser les contacts quand le partenaire change
    useEffect(() => {
        if (partnerId) {
            form.setFieldsValue({
                fk_ctc_id_openby: undefined,
                fk_ctc_id_opento: undefined,
            });
            setFromContactInfo(null);
        }
    }, [partnerId, form]);

    // Auto-remplir "À" quand "De" est sélectionné (avec label)
    const handleFromContactSelect = useCallback((value, option) => {
        setFromContactInfo({ ctc_id: value, label: option?.label });
        const currentTo = form.getFieldValue("fk_ctc_id_opento");
        if (!currentTo) {
            form.setFieldValue("fk_ctc_id_opento", value);
        }
    }, [form]);

    // Charger les statuts
    useEffect(() => {
        ticketsApi.statusOptions().then(res => {
            const opts = res.data || [];
            setStatusOptions(opts);
            if (opts.length > 0) {
                setNewStatusId(opts[0].id);
                setNewStatusLabel(opts[0].label);
                setNewStatusColor(opts[0].color || "#1677ff");
            }
        }).catch(() => { });
    }, []);

    const onSuccessCallback = useCallback(({ action, data }) => {
        if (action === "create" && data?.tkt_id) {
            navigate(`/tickets/${data.tkt_id}`, { replace: true });
        }
    }, [navigate]);

    const { submit, loading } = useEntityForm({
        api: ticketsApi,
        entityId: null,
        idField: "tkt_id",
        form,
        open: true,
        onSuccess: onSuccessCallback,
    });

    const handleNewTicketSubmit = useCallback(async (values) => {
        if (!newBody || newBody === "<p><br></p>" || newBody === "") {
            message.warning("Veuillez saisir le corps du message");
            return;
        }

        if (!newTps || newTps <= 0) {
            message.warning("Veuillez saisir une durée supérieure à 0");
            return;
        }
        setCreatingTicket(true);
        try {
            const payload = {
                ...values,
                tkt_opendate: values.tkt_opendate ? values.tkt_opendate.format("YYYY-MM-DD HH:mm:ss") : null,
                tkt_scheduled: values.tkt_scheduled ? values.tkt_scheduled.format("YYYY-MM-DD HH:mm:ss") : null,
                tka_message: newBody,
                tka_tps: newTps || 0,
                tka_cc: values.tka_cc?.length > 0 ? values.tka_cc.join(", ") : null,
                fk_tke_id: newStatusId || undefined,
            };
            await submit(payload);
        } finally {
            setCreatingTicket(false);
        }
    }, [newBody, newTps, newStatusId, submit]);

    // Menu statuts avec couleurs
    const statusMenuItems = useMemo(() => statusOptions.map(s => {
        const color = s.color || "#1677ff";
        return {
            key: String(s.id),
            label: (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: color,
                        display: "inline-block",
                        flexShrink: 0,
                    }} />
                    {s.label}
                </span>
            ),
            onClick: () => {
                setNewStatusId(s.id);
                setNewStatusLabel(s.label);
                setNewStatusColor(s.color || "#1677ff");
            },
        };
    }), [statusOptions]);

    const mainButtonColor = newStatusColor;

    return (
        <PageContainer
            title="Nouveau dossier"
            actions={
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/tickets")}>
                    Retour
                </Button>
            }
        >
            <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 0" }}>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleNewTicketSubmit}
                    initialValues={{ tkt_opendate: dayjs() }}
                >
                    {/* ── Section 1 : Client ── */}
                    <Card
                        size="small"
                        style={{ marginBottom: 16, borderLeft: "3px solid #1677ff" }}
                        styles={{ body: { padding: "12px 16px" } }}
                    >
                        <Form.Item
                            name="fk_ptr_id"
                            label={<Text strong style={{ fontSize: 14 }}>Client</Text>}
                            rules={[{ required: true, message: "Le client est requis" }]}
                            style={{ marginBottom: 0 }}
                        >
                            <PartnerSelect
                                loadInitially
                                filters={{ is_active: 1, is_customer: 1 }}
                            />
                        </Form.Item>
                    </Card>

                    {/* ── Section 2 : Email ── */}
                    <Card
                        size="small"
                        style={{ marginBottom: 16, borderLeft: "3px solid #52c41a" }}
                        styles={{ body: { padding: 0 } }}
                    >
                        {/* De */}
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                            <Row gutter={8} align="middle">
                                <Col flex="70px">
                                    <Text style={{ fontSize: 13 }}>
                                        <UserOutlined style={{ marginRight: 4 }} />De :
                                    </Text>
                                </Col>
                                <Col flex="1">
                                    <Form.Item
                                        name="fk_ctc_id_openby"
                                        rules={[{ required: true, message: "Expéditeur requis" }]}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <ContactSelect
                                            key={`openby-${partnerId}`}
                                            onSelect={handleFromContactSelect}
                                            partnerId={partnerId}
                                            filters={{ is_active: 1, ptrId: partnerId }}
                                            disabled={!partnerId}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>

                        {/* À */}
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                            <Row gutter={8} align="middle">
                                <Col flex="70px">
                                    <Text style={{ fontSize: 13 }}>
                                        <MailOutlined style={{ marginRight: 4 }} />À :
                                    </Text>
                                </Col>
                                <Col flex="1">
                                    <Form.Item
                                        name="fk_ctc_id_opento"
                                        rules={[{ required: true, message: "Destinataire requis" }]}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <ContactSelect
                                            key={`opento-${partnerId}`}
                                            initialData={fromContactInfo}
                                            partnerId={partnerId}
                                            filters={{ is_active: 1, ptrId: partnerId }}
                                            disabled={!partnerId}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>

                        {/* CC */}
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                            <Row gutter={8} align="middle">
                                <Col flex="70px">
                                    <Text type="secondary" style={{ fontSize: 13 }}>CC :</Text>
                                </Col>
                                <Col flex="1">
                                    <Form.Item
                                        name="tka_cc"
                                        style={{ marginBottom: 0 }}
                                    >
                                        <ContactSelect
                                            key={`cc-${partnerId}`}
                                            mode="multiple"
                                            partnerId={partnerId}
                                            filters={{ is_active: 1, ptrId: partnerId }}
                                            disabled={!partnerId}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>

                        {/* Objet */}
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                            <Row gutter={8} align="middle">
                                <Col flex="70px">
                                    <Text strong style={{ fontSize: 13 }}>Objet :</Text>
                                </Col>
                                <Col flex="1">
                                    <Form.Item
                                        name="tkt_label"
                                        rules={[{ required: true, message: "L'objet est requis" }]}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <Input placeholder="Objet du dossier..."  disabled={!partnerId} />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>

                        {/* Body - RichTextEditor */}
                        <div style={{ padding: "8px 16px 12px" }}>
                            <RichTextEditor
                                value={newBody}
                                onChange={setNewBody}
                                height={280}
                                placeholder="Corps du message / description du problème..."
                                disabled={!partnerId}
                            />
                        </div>
                    </Card>

                    {/* ── Section 3 : Caractéristiques du ticket ── */}
                    <Card
                        size="small"
                        title={<Text strong style={{ fontSize: 13 }}>Caractéristiques du dossier</Text>}
                        style={{ marginBottom: 16, borderLeft: "3px solid #faad14" }}
                        styles={{ body: { padding: "12px 16px" } }}
                    >
                        <Row gutter={[16, 8]}>
                            <Col xs={12} sm={8} md={6}>
                                <Form.Item
                                    name="fk_tkp_id"
                                    label="Priorité"
                                    style={{ marginBottom: 8 }}
                                >
                                    <TicketPrioritySelect
                                        loadInitially
                                        selectDefault={true}
                                        onDefaultSelected={(id) => {
                                            form.setFieldValue('fk_tkp_id', id);
                                        }}
                                        disabled={!partnerId}
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={12} sm={8} md={6}>
                                <Form.Item
                                    name="fk_tkg_id"
                                    label="Type"
                                    rules={[{ required: true, message: "Requis" }]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <TicketGradeSelect loadInitially disabled={!partnerId} />
                                </Form.Item>
                            </Col>
                            <Col xs={12} sm={8} md={6}>
                                <Form.Item
                                    name="fk_tks_id"
                                    label="Source"
                                    rules={[{ required: true, message: "Requis" }]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <TicketSourceSelect
                                        loadInitially
                                        selectDefault={true}
                                        onDefaultSelected={(id) => {
                                            form.setFieldValue('fk_tks_id', id);
                                        }}
                                        disabled={!partnerId}
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={12} sm={8} md={6}>
                                <Form.Item
                                    name="fk_tkc_id"
                                    label="Catégorie"
                                    style={{ marginBottom: 8 }}
                                >
                                    <TicketCategorySelect loadInitially disabled={!partnerId} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]}>
                            <Col xs={24} sm={12} md={8}>
                                <Form.Item
                                    name="fk_usr_id_assignedto"
                                    label={<><TeamOutlined /> Assigné à</>}
                                    style={{ marginBottom: 0 }}
                                >
                                    <UserSelect loadInitially disabled={!partnerId} />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>

                    {/* ── Footer : Durée + Bouton statut coloré ── */}
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 0",
                    }}>
                        <InputNumber
                            min={1}
                            prefix={<ClockCircleOutlined />}
                            placeholder="0"
                            value={newTps}
                            onChange={val => setNewTps(val || 0)}
                            suffix="min"
                            style={{ width: 160 }}
                            status={!newTps || newTps <= 0 ? 'error' : ''}
                            disabled={!partnerId}
                        />
                        <div>
                            <CanAccess permission="tickets.create">
                                <Dropdown.Button
                                    type="primary"
                                    icon={<DownOutlined />}
                                    menu={{ items: statusMenuItems }}
                                    onClick={() => form.submit()}
                                    loading={creatingTicket || loading}
                                    style={{
                                        "--ant-color-primary": mainButtonColor,
                                        "--ant-color-primary-hover": mainButtonColor,

                                    }}
                                    buttonsRender={([leftButton, rightButton]) => [
                                        <Button
                                            key="left"
                                            type="primary"
                                            icon={<SendOutlined />}
                                            loading={creatingTicket || loading}
                                            onClick={() => form.submit()}
                                            style={{
                                                backgroundColor: mainButtonColor,
                                                borderColor: mainButtonColor,
                                            }}
                                        >
                                            Créer le dossier → {newStatusLabel}
                                        </Button>,
                                        <Button
                                            key="right"
                                            type="primary"
                                            icon={<DownOutlined />}
                                            style={{
                                                backgroundColor: mainButtonColor,
                                                borderColor: mainButtonColor,
                                            }}
                                        />,
                                    ]}
                                />
                            </CanAccess>
                        </div>
                    </div>
                </Form>
            </div>
        </PageContainer>
    );
}
