import { useState, useEffect, useRef } from "react";
import {
    Drawer, Form, Input, InputNumber, Switch, Select, Button, Spin, Space,
    DatePicker, TimePicker, Popconfirm, Alert, Typography, Row, Col, Tooltip,
} from "antd";
import { SaveOutlined, DeleteOutlined, ClockCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { timeEntriesApi } from "../../services/api";
import { useEntityForm } from "../../hooks/useEntityForm";
import PartnerSelect from "../../components/select/PartnerSelect";
import TimeProjectSelect from "../../components/select/TimeProjectSelect";
import UserSelect from "../../components/select/UserSelect";
import CanAccess from "../../components/common/CanAccess";
import { useAuth } from "../../contexts/AuthContext";
import dayjs from "dayjs";

const TAG_OPTIONS = [
    { value: "réunion", label: "Réunion" },
    { value: "développement", label: "Développement" },
    { value: "support", label: "Support" },
    { value: "formation", label: "Formation" },
    { value: "déplacement", label: "Déplacement" },
    { value: "analyse", label: "Analyse" },
    { value: "rédaction", label: "Rédaction" },
];


export default function TimeEntryForm({ entryId, open, onClose, onSubmit, defaultValues }) {
    const [form] = Form.useForm();
    const { can } = useAuth();
    const projectSelectRef = useRef(null);

    const [selectedPtrId, setSelectedPtrId] = useState(null);
    const [projectRate, setProjectRate] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [liveAmount, setLiveAmount] = useState(null);

    const isBillable = Form.useWatch("ten_is_billable", form);
    const duration = Form.useWatch("ten_duration", form);
    const hourlyRate = Form.useWatch("ten_hourly_rate", form);

    const { submit, remove, loading, entity } = useEntityForm({
        api: timeEntriesApi,
        entityId: entryId,
        idField: "ten_id",
        form,
        open,
        transformData: (data) => ({
            ...data,
            ten_date:       data.ten_date       ? dayjs(data.ten_date)                    : null,
            ten_start_time: data.ten_start_time ? dayjs(data.ten_start_time, "HH:mm:ss") : null,
            ten_end_time:   data.ten_end_time   ? dayjs(data.ten_end_time,   "HH:mm:ss") : null,
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

    // Date par défaut = aujourd'hui à la création
    useEffect(() => {
        if (open && !entryId) {
            form.setFieldValue("ten_date", dayjs());
        }
    }, [open, entryId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Pré-remplir avec les valeurs par défaut (ex: depuis le timer)
    useEffect(() => {
        if (open && !entryId && defaultValues) {
            form.setFieldsValue({
                ten_date: defaultValues.date ? dayjs(defaultValues.date) : dayjs(),
                fk_ptr_id: defaultValues.partnerId ?? null,
                fk_tpr_id: defaultValues.projectId ?? null,
                ten_description: defaultValues.description ?? "",
                ten_duration: defaultValues.duration ?? null,
                ten_is_billable: true,
            });
            if (defaultValues.partnerId) setSelectedPtrId(defaultValues.partnerId);
        }
    }, [open, entryId, defaultValues]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reload du select projet après changement de client (après re-render avec les nouveaux filters)
    useEffect(() => {
        if (selectedPtrId !== null) {
            projectSelectRef.current?.reload?.("");
        }
    }, [selectedPtrId]);

    // Calcul durée depuis start/end
    const handleTimeChange = () => {
        const start = form.getFieldValue("ten_start_time");
        const end = form.getFieldValue("ten_end_time");
        if (start && end) {
            const diff = end.diff(start, "minute");
            if (diff > 0) form.setFieldValue("ten_duration", diff);
        }
    };

    // Montant temps réel
    useEffect(() => {
        if (!isBillable || !duration) { setLiveAmount(null); return; }
        const rate = hourlyRate ?? projectRate;
        if (!rate) { setLiveAmount(null); return; }
        setLiveAmount(((duration / 60) * rate).toFixed(2));
    }, [duration, hourlyRate, projectRate, isBillable]);

    // Suggestions de description quand un projet est sélectionné
    const handleProjectChange = async (tprId, option) => {
        setProjectRate(option?.hourlyRate ?? null);
        if (tprId) {
            try {
                const res = await timeEntriesApi.descriptionSuggestions(tprId);
                setSuggestions(res?.data ?? []);
            } catch {
                setSuggestions([]);
            }
        } else {
            setSuggestions([]);
        }
    };

    const handleClose = () => {
        form.resetFields();
        setSelectedPtrId(null);
        setProjectRate(null);
        setSuggestions([]);
        setLiveAmount(null);
        onClose?.();
    };

    const entryStatus = entity?.ten_status;
    const isLocked = entryStatus === 2 || entryStatus === 3; // Verrou total : APPROUVÉ, FACTURÉ (rejeté reste modifiable)

    return (
        <Drawer
            title={entryId ? "Modifier la saisie" : "Nouvelle saisie"}
            placement="right"
            onClose={handleClose}
            open={open}
            size="large"
            forceRender
            footer={
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    {entryId && !isLocked && (
                        <CanAccess permission="time.edit">
                            <Popconfirm
                                title="Supprimer cette saisie ?"
                                onConfirm={remove}
                                okText="Supprimer"
                                okButtonProps={{ danger: true }}
                                cancelText="Annuler"
                            >
                                <Button danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </CanAccess>
                    )}
                    <Space style={{ marginLeft: "auto" }}>
                        <Button onClick={handleClose}>Annuler</Button>
                        {!isLocked && (
                            <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()}>
                                Enregistrer
                            </Button>
                        )}
                    </Space>
                </Space>
            }
        >
            <Spin spinning={loading} tip="Chargement...">
                {entryStatus === 4 && entity?.ten_rejection_reason && (
                    <Alert
                        type="warning"
                        message="Saisie rejetée"
                        description={entity.ten_rejection_reason}
                        style={{ marginBottom: 16 }}
                        showIcon
                    />
                )}
                {isLocked && (
                    <Alert
                        type="warning"
                        showIcon
                        message={entryStatus === 3 ? "Saisie facturée — modification impossible" : "Saisie approuvée — modification impossible"}
                        description={
                            entryStatus === 3
                                ? "Cette saisie a été facturée. Elle est définitivement verrouillée et ne peut plus être modifiée ni supprimée."
                                : "Cette saisie a été approuvée par un responsable. Elle ne peut plus être modifiée. Si une correction est nécessaire, contactez votre responsable."
                        }
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form form={form} layout="vertical" onFinish={submit} disabled={isLocked}>
                    <Form.Item name="ten_id" hidden><Input /></Form.Item>

                    <Row gutter={12}>
                        <Col span={7}>
                            <Form.Item name="ten_date" label="Date" rules={[{ required: true, message: "Champ requis" }]}>
                                <DatePicker format="DD/MM/YYYY" style={{ width: "auto" }} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="ten_start_time" label="Heure début">
                                <TimePicker format="HH:mm" minuteStep={15} style={{ width: "auto" }} onChange={handleTimeChange} />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="ten_end_time" label="Heure de fin">
                                <TimePicker format="HH:mm" minuteStep={15} style={{ width: "auto" }} onChange={handleTimeChange} />
                            </Form.Item>
                        </Col>
                        <Col span={5}>
                            <Form.Item
                                name="ten_duration"
                                label="Min"
                                rules={[{ required: true, message: "Requis" }]}
                            >
                                <InputNumber min={1} style={{ width: "100%" }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="fk_ptr_id" label="Client" rules={[{ required: true, message: "Champ requis" }]}>
                        <PartnerSelect
                            loadInitially
                            filters={{ is_customer: 1 }}
                            onChange={(v) => {
                                setSelectedPtrId(v ?? null);
                                form.setFieldValue("fk_tpr_id", null);
                                setSuggestions([]);
                            }}
                        />
                    </Form.Item>

                    <Form.Item name="fk_tpr_id" label="Projet" rules={[{ required: true, message: "Champ requis" }]}>
                        <TimeProjectSelect
                            ref={projectSelectRef}
                            filters={selectedPtrId ? { fk_ptr_id: selectedPtrId } : {}}
                            loadInitially={!!selectedPtrId}
                            onChange={(v, opt) => handleProjectChange(v, opt)}
                        />
                    </Form.Item>

                    <Form.Item name="ten_description" label={<Space size={4}>Description<Tooltip title="Décrivez brièvement la tâche réalisée. Les suggestions affichées proviennent des dernières saisies du même projet."><InfoCircleOutlined style={{ color: "var(--color-muted)", fontSize: 13 }} /></Tooltip></Space>}>
                        <Input.TextArea
                            rows={2}
                            placeholder="Ce que vous avez fait…"
                            list="time-entry-suggestions"
                        />
                        {suggestions.length > 0 && (
                            <datalist id="time-entry-suggestions">
                                {suggestions.map((s, i) => <option key={i} value={s} />)}
                            </datalist>
                        )}
                    </Form.Item>

                    <Form.Item name="ten_tags" label="Tags">
                        <Select
                            mode="multiple"
                            options={TAG_OPTIONS}
                            placeholder="Catégories…"
                            allowClear
                        />
                    </Form.Item>

                    <Row gutter={16} align="middle">
                        <Col flex="auto">
                            <Form.Item name="ten_is_billable" label="Facturable" valuePropName="checked" initialValue={true}>
                                <Switch />
                            </Form.Item>
                        </Col>
                        {isBillable && (
                            <Col flex="160px">
                                <Form.Item
                                    name="ten_hourly_rate"
                                    label={<Space size={4}>Taux HT (€/h)<Tooltip title="Taux horaire appliqué pour calculer le montant facturable. Laissez vide pour utiliser le taux par défaut du projet."><InfoCircleOutlined style={{ color: "var(--color-muted)", fontSize: 13 }} /></Tooltip></Space>}
                                    extra={projectRate ? `Défaut projet : ${projectRate} €/h` : null}
                                >
                                    <InputNumber min={0} step={5} style={{ width: "100%" }} placeholder={projectRate ?? "—"} />
                                </Form.Item>
                            </Col>
                        )}
                    </Row>

                    {liveAmount !== null && (
                        <div style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-card)",
                            padding: "8px 12px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                        }}>
                            <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                                <ClockCircleOutlined /> {(duration / 60).toFixed(2)}h × {hourlyRate ?? projectRate} €/h
                            </span>
                            <Typography.Text strong style={{ fontSize: 15 }}>
                                {liveAmount} € HT
                            </Typography.Text>
                        </div>
                    )}

                    {can("time.view.all") && (
                        <Form.Item name="fk_usr_id" label={<Space size={4}>Collaborateur<Tooltip title="Saisie pour le compte d'un autre collaborateur. Par défaut, la saisie vous est attribuée."><InfoCircleOutlined style={{ color: "var(--color-muted)", fontSize: 13 }} /></Tooltip></Space>}>
                            <UserSelect loadInitially />
                        </Form.Item>
                    )}
                </Form>
            </Spin>
        </Drawer>
    );
}
