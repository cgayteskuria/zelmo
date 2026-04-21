import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { Drawer, Form, Input, InputNumber, DatePicker, Button, Row, Col, Spin, Tabs, Space, Popconfirm, Modal, Tag, Card, Statistic, Divider } from "antd";
import { message } from '../../utils/antdStatic';
import { SaveOutlined, DeleteOutlined, TrophyOutlined, CloseCircleOutlined, UserSwitchOutlined, } from "@ant-design/icons";
import dayjs from "dayjs";
import CanAccess from "../../components/common/CanAccess";
import PartnerSelect from "../../components/select/PartnerSelect";
import UserSelect from "../../components/select/UserSelect";
import PipelineStageSelect from "../../components/select/PipelineStageSelect";
import ProspectSourceSelect from "../../components/select/ProspectSourceSelect";
import LostReasonSelect from "../../components/select/LostReasonSelect";
import ContactSelect from "../../components/select/ContactSelect";
import ActivityTimeline from "../../components/crm/ActivityTimeline";
import { opportunitiesApi } from "../../services/apiProspect";
import { useEntityForm } from "../../hooks/useEntityForm";
import { getUser } from "../../services/auth";

const FilesTab = lazy(() => import("../../components/bizdocument/FilesTab"));

export default function Opportunity({ opportunityId, open, onClose, onSubmit, defaultValues = {}, }) {
    const [form] = Form.useForm();
    const [lostModalOpen, setLostModalOpen] = useState(false);
    const [lostReasonId, setLostReasonId] = useState(null);

    const partnerId = Form.useWatch("fk_ptr_id", form);
    const [defaultSeller, setDefaultSeller] = useState(() => {
        if (!opportunityId) {
            const currentUser = getUser();
            if (currentUser?.id) {
                return {
                    usr_id: currentUser.id,
                    usr_firstname: currentUser.firstname,
                    usr_lastname: currentUser.lastname,
                };
            }
        }
        return null;
    });
    // Auto-remplir le commercial avec l'utilisateur connecté lors de la création
    useEffect(() => {
        if (!opportunityId) {
            const currentUser = getUser();
            if (currentUser?.id) {
                form.setFieldValue('fk_usr_id_seller', currentUser.id);

            }
        }
    }, [opportunityId, form]);

    const { submit, remove, loading, entity, reload } = useEntityForm({
        api: opportunitiesApi,
        entityId: opportunityId,
        idField: "opp_id",
        form,
        open,

        transformData: (data) => ({
            ...data,
            opp_close_date: data.opp_close_date ? dayjs(data.opp_close_date) : null,
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
        const payload = {
            ...values,
            opp_close_date: values.opp_close_date?.format("YYYY-MM-DD") || null,
        };
        await submit(payload);
    };

    const handleDelete = async () => {
        await remove();
    };

    // Marquer Gagné
    const handleMarkWon = async () => {
        try {
            await opportunitiesApi.markAsWon(opportunityId);
            message.success("Opportunité marquée comme gagnée !");
            onSubmit?.({ action: "update" });
            reload();
        } catch {
            message.error("Erreur");
        }
    };

    // Marquer Perdu
    const handleMarkLost = async () => {
        try {
            await opportunitiesApi.markAsLost(opportunityId, { fk_plr_id: lostReasonId });
            message.success("Opportunité marquée comme perdue");
            setLostModalOpen(false);
            onSubmit?.({ action: "update" });
            reload();
        } catch {
            message.error("Erreur");
        }
    };

    // Convertir en client
    const handleConvertCustomer = async () => {
        try {
            await opportunitiesApi.convertToCustomer(opportunityId);
            message.success("Prospect converti en client !");
            onSubmit?.({ action: "update" });
        } catch {
            message.error("Erreur lors de la conversion");
        }
    };

    const handleClose = () => {
        form.resetFields();
        onClose?.();
    };

    // Appliquer defaultValues à l'ouverture en mode création
    const handleAfterOpenChange = (isOpen) => {
        if (isOpen && !opportunityId && defaultValues && Object.keys(defaultValues).length > 0) {
            form.setFieldsValue(defaultValues);
        }
    };

    const isWon = Boolean(entity?.stage?.pps_is_won);
    const isLost = Boolean(entity?.stage?.pps_is_lost);
    const isClosed = isWon || isLost;

    const pageLabel = Form.useWatch("opp_label", form);

    const tabItems = useMemo(() => {
        const items = [
            {
                key: "general",
                label: "Général",
                children: (
                    <>
                        <Row gutter={[16, 8]} className="box">

                            {/* Identité */}
                            <Col span={16}>
                                <Form.Item name="opp_label" label="Titre" rules={[{ required: true, message: "Le titre est requis" }]}>
                                    <Input placeholder="Titre de l'opportunité" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="fk_pso_id" label="Source">
                                    <ProspectSourceSelect
                                        loadInitially={entity}
                                        initialData={entity?.source}
                                        selectDefault={entity}
                                        onDefaultSelected={(id) => {
                                            form.setFieldValue('fk_pso_id', id);
                                        }}
                                    />
                                </Form.Item>
                            </Col>
                            {/* Qui */}
                            <Col span={12}>
                                <Form.Item name="fk_ptr_id" label="Prospect" rules={[{ required: true, message: "Le prospect est requis" }]}>
                                    <PartnerSelect initialData={entity?.partner} filters={{ is_prospect: 1 }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="fk_ctc_id" label="Contact principal">
                                    <ContactSelect
                                        initialData={entity?.contact}
                                        filters={{ ptrId: partnerId }} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="fk_usr_id_seller" label="Commercial" rules={[{ required: true, message: "Le commercial est requis" }]}>
                                    <UserSelect
                                        initialData={entity?.seller ?? defaultSeller}
                                        filters={{ is_seller: 1 }}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]} className="box" style={{ marginTop: 15 }}>
                            {/* Pipeline */}
                            <Col span={6}>
                                <Form.Item name="fk_pps_id" label="Étape" rules={[{ required: true, message: "L'étape est requise" }]}>
                                    <PipelineStageSelect initialData={entity?.stage} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="opp_amount" label="Montant estimé HT">
                                    <Space.Compact style={{ width: "100%" }}>
                                        <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                                        <span
                                            style={{
                                                padding: "0 11px",
                                                display: "flex",
                                                alignItems: "center",
                                                border: "1px solid #d9d9d9",
                                                borderLeft: 0,
                                                background: "#fafafa"
                                            }}
                                        >
                                            €
                                        </span>
                                    </Space.Compact>
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="opp_probability" label="Probabilité (%)">
                                    <Space.Compact style={{ width: "100%" }}>
                                        <InputNumber min={0} precision={2} style={{ width: "100%" }} />
                                        <span
                                            style={{
                                                padding: "0 11px",
                                                display: "flex",
                                                alignItems: "center",
                                                border: "1px solid #d9d9d9",
                                                borderLeft: 0,
                                                background: "#fafafa"
                                            }}
                                        >
                                            %
                                        </span>
                                    </Space.Compact>
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="opp_close_date" label="Clôture prévue">
                                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={[16, 8]} className="box" style={{ marginTop: 15 }}>
                            {/* Texte libre */}
                            <Col span={24}>
                                <Form.Item name="opp_description" label="Description">
                                    <Input.TextArea rows={3} placeholder="Description de l'opportunité" />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="opp_notes" label="Notes internes">
                                    <Input.TextArea rows={2} placeholder="Notes internes" />
                                </Form.Item>
                            </Col>

                        </Row>
                    </>
                ),
            },
        ];

        // Onglet Activités (si édition)
        if (opportunityId) {
            items.push({
                key: "activities",
                label: `Activités${entity?.activities_count ? ` (${entity.activities_count})` : ""}`,
                children: (
                    <ActivityTimeline opportunityId={opportunityId} partnerId={entity?.fk_ptr_id} />
                ),
            });
        }

        // Onglet Documents (si édition)
        if (opportunityId) {
            items.push({
                key: "documents",
                label: `Documents${entity?.documents_count ? ` (${entity.documents_count})` : ""}`,
                children: (
                    <Suspense fallback={<Spin />}>
                        <FilesTab
                            module="opportunities"
                            recordId={opportunityId}
                            getDocumentsApi={opportunitiesApi.getDocuments}
                            uploadDocumentsApi={opportunitiesApi.uploadDocuments}
                            permissionView="opportunities.view"
                            permissionCreate="opportunities.create"
                        />
                    </Suspense>
                ),
            });
        }

        return items;
    }, [opportunityId, entity, partnerId]);

    // Footer actions
    const drawerActions = (
        <div style={{ width: "100%", display: "flex", paddingRight: "15px", paddingLeft: 15, gap: 8 }}>

            {opportunityId && !isClosed && (
                <CanAccess permission="opportunities.edit">
                    <Button type="primary" style={{ background: "#52c41a" }} icon={<TrophyOutlined />} onClick={handleMarkWon}>
                        Gagné
                    </Button>
                    <Button danger icon={<CloseCircleOutlined />} onClick={() => setLostModalOpen(true)}>
                        Perdu
                    </Button>
                </CanAccess>
            )}
            {opportunityId && isWon && (
                <CanAccess permission="opportunities.edit">
                    <Popconfirm title="Convertir ce prospect en client ?" onConfirm={handleConvertCustomer} okText="Oui" cancelText="Non">
                        <Button
                            icon={<UserSwitchOutlined />} type="primary">Convertir en client</Button>
                    </Popconfirm>
                </CanAccess>
            )}
            {/* Séparateur flexible */}
            <div style={{ flex: 1 }} />
            {opportunityId && (
                <>
                    <div style={{ flex: 1 }} />
                    <CanAccess permission="opportunities.delete">
                        <Popconfirm title="Supprimer cette opportunité ?" onConfirm={handleDelete} okText="Oui" cancelText="Non">
                            <Button danger icon={<DeleteOutlined />}>Supprimer</Button>
                        </Popconfirm>
                    </CanAccess>
                </>
            )}
            <Button onClick={handleClose}>Annuler</Button>
            <CanAccess permission={opportunityId ? "opportunities.edit" : "opportunities.create"}>
                <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={loading}>
                    {opportunityId ? "Enregistrer" : "Créer"}
                </Button>
            </CanAccess>
        </div>
    );

    return (
        <>
            <Drawer
                title={pageLabel ? `Opportunité - ${pageLabel}` : "Nouvelle opportunité"}
                placement="right"
                onClose={handleClose}
                open={open}
                size="large"
                footer={drawerActions}
                destroyOnHidden
                forceRender
                afterOpenChange={handleAfterOpenChange}
            >
                <Spin spinning={loading} tip="Chargement...">
                    <Form form={form} layout="vertical" onFinish={handleFormSubmit}>
                        <Form.Item name="opp_id" hidden><Input /></Form.Item>

                        <Tabs items={tabItems} defaultActiveKey="general" />
                    </Form>
                </Spin>
            </Drawer>

            {/* Modal raison de perte */}
            <Modal
                title="Raison de la perte"
                open={lostModalOpen}
                onOk={handleMarkLost}
                onCancel={() => setLostModalOpen(false)}
                okText="Confirmer"
                cancelText="Annuler"
            >
                <p>Pourquoi cette opportunité est-elle perdue ?</p>
                <LostReasonSelect value={lostReasonId} onChange={setLostReasonId} style={{ width: "100%" }} loadInitially />
            </Modal>
        </>
    );
}
