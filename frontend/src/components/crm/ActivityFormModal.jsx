import { useState, useEffect, useRef } from "react";
import { Drawer, Form, Input, Select, DatePicker, Switch, Row, Col, Button, Spin, Space, Popconfirm } from "antd";
import { SaveOutlined, DeleteOutlined, EnvironmentOutlined, PlusOutlined } from "@ant-design/icons";
import Opportunity from "../../pages/crm/Opportunity";
import { getUser } from "../../services/auth";
import dayjs from "dayjs";
import { prospectActivitiesApi } from "../../services/apiProspect";
import { useEntityForm } from "../../hooks/useEntityForm";
import UserSelect from "../select/UserSelect";
import PartnerSelect from "../select/PartnerSelect";
import OpportunitySelect from "../select/OpportunitySelect";
import ContactSelect from "../select/ContactSelect";
import CanAccess from "../common/CanAccess";
import { ACTIVITY_TYPE_OPTIONS, ACTIVITY_TYPES, getDefaultActivityType } from "../../configs/OpportunityConfig";

export default function ActivityFormModal({
    open,
    onClose,
    onSubmit,
    activityId = null,
    defaultValues = {},
}) {
    const [form] = Form.useForm();

    const fkPtrId = Form.useWatch('fk_ptr_id', form);
    const pacDate = Form.useWatch('pac_date', form);
    const pacIsDone = Form.useWatch('pac_is_done', form);
    const pacType = Form.useWatch('pac_type', form);
    const pacSubject = Form.useWatch('pac_subject', form);

    const [pageLabel, setPageLabel] = useState("Nouvelle activité");
    const [partnerInitialData, setPartnerInitialData] = useState(null);
    const [contactsInitialData, setContactsInitialData] = useState(null);
    const [subjectIsAuto, setSubjectIsAuto] = useState(false);
    const [opportunityDrawerOpen, setOpportunityDrawerOpen] = useState(false);
    const [opportunityDefaults, setOpportunityDefaults] = useState({});

    // Mémorise la dernière valeur auto-remplie pour pac_due_date
    const lastAutoFilled = useRef(null);
    // Mémorise le dernier sujet auto-saisi pour détecter les modifications manuelles
    const lastAutoSubject = useRef(null);
    const skipSubjectWatch = useRef(false);

    const [defaultSeller] = useState(() => {
        const currentUser = getUser();
        if (currentUser?.id) {
            return { usr_id: currentUser.id, usr_firstname: currentUser.firstname, usr_lastname: currentUser.lastname };
        }
        return null;
    });

    const { submit, remove, loading, entity } = useEntityForm({
        api: prospectActivitiesApi,
        entityId: activityId,
        idField: "pac_id",
        form,
        open,
        transformData: (data) => ({
            ...data,
            pac_date: data.pac_date ? dayjs(data.pac_date) : dayjs(),
            pac_due_date: data.pac_due_date ? dayjs(data.pac_due_date) : null,
            pac_is_done: !!data.pac_is_done,
            ctc_ids: data.ctc_ids ?? [],
        }),
        onDataLoaded: (data) => {
            if (data.partner) setPartnerInitialData(data.partner);
            if (data.contacts?.length) setContactsInitialData(data.contacts);
            setPageLabel(`Activité - ${data.pac_subject}`);
        },
        onSuccess: ({ action, data }) => { onSubmit?.({ action, data }); onClose?.(); },
        onDelete: ({ id }) => { onSubmit?.({ action: "delete", id }); onClose?.(); },
    });

    // Auto-remplit pac_due_date = pac_date + 30 min si non modifié manuellement
    useEffect(() => {
        if (!pacDate) return;
        const currentDue = form.getFieldValue('pac_due_date');
        const autoTarget = dayjs(pacDate).add(30, 'minute');
        if (!currentDue || (lastAutoFilled.current && currentDue.isSame(lastAutoFilled.current))) {
            form.setFieldValue('pac_due_date', autoTarget);
            lastAutoFilled.current = autoTarget;
        }
    }, [pacDate]);

    // Auto-remplit pac_subject = label du type si non modifié manuellement
    useEffect(() => {
        if (!pacType) return;
        const typeLabel = ACTIVITY_TYPES[pacType]?.label;
        if (!typeLabel) return;
        const currentSubject = form.getFieldValue('pac_subject');
        if (!currentSubject || currentSubject === lastAutoSubject.current) {
            skipSubjectWatch.current = true;
            form.setFieldValue('pac_subject', typeLabel);
            lastAutoSubject.current = typeLabel;
            setSubjectIsAuto(true);
        }
    }, [pacType]);

    // Détecte si l'utilisateur modifie manuellement le sujet
    useEffect(() => {
        if (skipSubjectWatch.current) {
            skipSubjectWatch.current = false;
            return;
        }
        if (pacSubject === lastAutoSubject.current) return;
        if (!pacSubject) {
            // Vidé → re-remplit avec le type courant
            const typeLabel = ACTIVITY_TYPES[form.getFieldValue('pac_type')]?.label;
            if (typeLabel) {
                skipSubjectWatch.current = true;
                form.setFieldValue('pac_subject', typeLabel);
                lastAutoSubject.current = typeLabel;
                setSubjectIsAuto(true);
            }
            return;
        }
        // Valeur différente de l'auto → mode manuel
        lastAutoSubject.current = null;
        setSubjectIsAuto(false);
    }, [pacSubject]);

    // Initialisation à la création
    useEffect(() => {
        if (!open || activityId) return;
        form.resetFields();
        lastAutoFilled.current = null;
        lastAutoSubject.current = null;
        skipSubjectWatch.current = false;
        setSubjectIsAuto(false);
        setPartnerInitialData(null);
        setContactsInitialData(null);

        const init = {
            pac_date: dayjs(),
            pac_is_done: false,
            pac_type: getDefaultActivityType(),
            ...defaultValues,
            ctc_ids: defaultValues.ctc_ids ?? (defaultValues.fk_ctc_id ? [defaultValues.fk_ctc_id] : []),
        };
        delete init.fk_ctc_id;
        delete init.partnerInitialData;
        delete init.contactInitialData;
        form.setFieldsValue(init);

        if (defaultValues.partnerInitialData) setPartnerInitialData(defaultValues.partnerInitialData);
        if (defaultValues.contactInitialData) {
            const cd = defaultValues.contactInitialData;
            setContactsInitialData(Array.isArray(cd) ? cd : [cd]);
        }

        const currentUser = getUser();
        if (currentUser?.id) form.setFieldValue('fk_usr_id_seller', currentUser.id);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, activityId]);

    const handleOpportunitySelect = (val, option) => {
        if (option?.fk_ptr_id) {
            form.setFieldValue('fk_ptr_id', option.fk_ptr_id);
            setPartnerInitialData({ ptr_id: option.fk_ptr_id, ptr_name: option.ptr_name });
        }
        if (!val) setPartnerInitialData(null);
    };

    const handlePartnerChange = (val) => {
        form.setFieldValue('fk_opp_id', undefined);
        form.setFieldValue('ctc_ids', []);
        setContactsInitialData(null);
        if (!val) setPartnerInitialData(null);
    };

    const handleFormSubmit = async (values) => {
        const payload = {
            ...values,
            pac_date: values.pac_date?.format("YYYY-MM-DD HH:mm:ss"),
            pac_due_date: values.pac_due_date?.format("YYYY-MM-DD HH:mm:ss") || null,
            pac_is_done: values.pac_is_done ? 1 : 0,
            ctc_ids: values.ctc_ids ?? [],
        };
        await submit(payload);
    };

    const handleCreateOpportunity = () => {
        const ctcIds = form.getFieldValue('ctc_ids') ?? [];
        setOpportunityDefaults({
            fk_ptr_id: form.getFieldValue('fk_ptr_id'),
            fk_ctc_id: ctcIds[0] ?? undefined,
            fk_usr_id_seller: form.getFieldValue('fk_usr_id_seller'),
            partnerInitialData: partnerInitialData ?? entity?.partner ?? null,
        });
        setOpportunityDrawerOpen(true);
    };

    const handleOpportunityCreated = ({ action, data }) => {
        setOpportunityDrawerOpen(false);
        if (action === 'create' && data?.opp_id) {
            form.setFieldValue('fk_opp_id', data.opp_id);
        }
    };

    const handleClose = () => {
        form.resetFields();
        lastAutoFilled.current = null;
        lastAutoSubject.current = null;
        skipSubjectWatch.current = false;
        setSubjectIsAuto(false);
        onClose?.();
    };

    const drawerActions = (
        <div style={{ display: "flex", alignItems: "center", width: "100%", paddingRight: 15, paddingLeft: 15  }}>
            {/* Gauche : Marquer comme effectué */}
            <Space align="center">
                <span style={{ fontSize: 13, color: pacIsDone ? "#52c41a" : undefined }}>
                    Effectué
                </span>
                <Switch
                    checked={!!pacIsDone}
                    onChange={(val) => form.setFieldValue('pac_is_done', val)}
                />
            </Space>

            <CanAccess permission="opportunities.create">
                <Button icon={<PlusOutlined />} onClick={handleCreateOpportunity} style={{ marginLeft: 15}}>
                    Créer une opportunité
                </Button>
            </CanAccess>

            <div style={{ flex: 1 }} />

            {/* Droite : Supprimer | Annuler | Enregistrer */}
            <Space>
                {activityId && (
                    <CanAccess permission="opportunities.delete">
                        <Popconfirm title="Supprimer cette activité ?" onConfirm={() => remove()} okText="Oui" cancelText="Non">
                            <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
                        </Popconfirm>
                    </CanAccess>
                )}
                <Button onClick={handleClose}>Annuler</Button>
                <CanAccess permission={activityId ? "opportunities.edit" : "opportunities.create"}>
                    <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={loading}>
                        {activityId ? "Enregistrer" : "Créer"}
                    </Button>
                </CanAccess>
            </Space>
        </div>
    );

    return (
        <>
        <Opportunity
            open={opportunityDrawerOpen}
            opportunityId={null}
            onClose={() => setOpportunityDrawerOpen(false)}
            onSubmit={handleOpportunityCreated}
            defaultValues={opportunityDefaults}
            zIndex={1050}
        />
        <Drawer
            title={pageLabel}
            placement="right"
            onClose={handleClose}
            open={open}
            size={900}
            footer={drawerActions}
            destroyOnHidden
            forceRender
            zIndex={1010}
        >
            <Spin spinning={loading} tip="Chargement...">
                <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                    <Form.Item name="pac_id" hidden><Input /></Form.Item>
                    <Form.Item name="pac_is_done" hidden valuePropName="checked"><Switch /></Form.Item>

                    {/* Ligne 1 : Sujet + Type */}
                    <Row gutter={[16, 8]}>
                        <Col span={16}>
                            <Form.Item name="pac_subject" label="Sujet" rules={[{ required: true, message: "Le sujet est requis" }]}>
                                <Input
                                    placeholder="Sujet de l'activité"
                                    style={subjectIsAuto ? { color: '#aaa', fontStyle: 'italic' } : undefined}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="pac_type" label="Type" rules={[{ required: true, message: "Le type est requis" }]}>
                                <Select options={ACTIVITY_TYPE_OPTIONS} placeholder="Type" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Ligne 2+3 : Début + Fin (auto-remplie) */}
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="pac_date" label="Début" rules={[{ required: true, message: "La date de début est requise" }]}>
                                <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" placeholder="Date de début" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="pac_due_date" label="Fin" rules={[{ required: true, message: "La date de fin est requise" }]}>
                                <DatePicker
                                    showTime
                                    style={{ width: "100%" }}
                                    format="DD/MM/YYYY HH:mm"
                                    placeholder="Date de fin"
                                    onChange={() => { lastAutoFilled.current = null; }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Ligne 4 : Organisation + Contact(s) */}
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="fk_ptr_id" label="Organisation" rules={[{ required: true, message: "L'organisation est requise" }]}>
                                <PartnerSelect
                                    initialData={partnerInitialData ?? entity?.partner}
                                    filters={{ is_prospect: 1 }}
                                    onChange={handlePartnerChange}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="ctc_ids" label="Contact(s)">
                                <ContactSelect
                                    key={fkPtrId ?? 'no-partner'}
                                    initialData={contactsInitialData ?? entity?.contacts}
                                    filters={fkPtrId ? { ptrId: fkPtrId } : {}}
                                    mode="multiple"
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Ligne 5 : Commercial + Opportunité */}
                    <Row gutter={[16, 8]}>
                        <Col span={12}>
                            <Form.Item name="fk_usr_id_seller" label="Commercial" rules={[{ required: true }]}>
                                <UserSelect 
                                initialData={entity?.seller ?? defaultSeller} 
                                filters={{ is_seller: 1 }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="fk_opp_id" label="Opportunité">
                                <OpportunitySelect
                                    key={fkPtrId ?? 'no-partner'}
                                    initialData={!fkPtrId || fkPtrId === entity?.opportunity?.fk_ptr_id ? entity?.opportunity : null}
                                    onSelect={handleOpportunitySelect}
                                    filters={{ fk_ptr_id: fkPtrId }}
                                    disabled={!fkPtrId}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Ligne 6 : Emplacement */}
                    <Row gutter={[16, 8]}>
                        <Col span={24}>
                            <Form.Item name="pac_location" label="Emplacement">
                                <Input
                                    placeholder="Lieu de l'activité"
                                    prefix={<EnvironmentOutlined style={{ color: "#aaa" }} />}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Ligne 7 : Description */}
                    <Row gutter={[16, 8]}>
                        <Col span={24}>
                            <Form.Item name="pac_description" label="Description">
                                <Input.TextArea rows={4} placeholder="Description détaillée" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Spin>
        </Drawer>
        </>
    );
}
