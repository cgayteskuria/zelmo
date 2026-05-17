import { useState, useEffect, useCallback } from "react";
import { Timeline, Button, Empty, Spin, Tag, Popconfirm, Space, Tooltip, Switch, App } from "antd";
import {
    PlusOutlined, CheckOutlined, DeleteOutlined, EditOutlined,
    ClockCircleOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { prospectActivitiesApi } from "../../services/apiProspect";
import { ACTIVITY_TYPES, formatActivityType } from "../../configs/OpportunityConfig";
import ActivityFormModal from "./ActivityFormModal";

export default function ActivityTimeline({ opportunityId, partnerId, partnerInitialData, contactId, contactInitialData, defaultPartnerId, defaultPartnerInitialData }) {
    const { message } = App.useApp();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [includeOppActivities, setIncludeOppActivities] = useState(false);

    // Mode partner = partnerId sans opportunityId ni contactId
    const isPartnerMode = !opportunityId && !!partnerId && !contactId;
    // Mode contact = contactId sans partnerId ni opportunityId
    const isContactMode = !opportunityId && !partnerId && !!contactId;

    const loadActivities = useCallback(async () => {
        if (!opportunityId && !partnerId && !contactId) return;
        setLoading(true);
        try {
            let res;
            if (opportunityId) {
                res = await prospectActivitiesApi.byOpportunity(opportunityId);
                setActivities(res.data || []);
            } else if (contactId) {
                res = await prospectActivitiesApi.byContact(contactId);
                setActivities(res?.data || []);
            } else {
                res = await prospectActivitiesApi.byPartner(partnerId, {
                    include_opportunity_activities: includeOppActivities ? 1 : 0,
                });
                setActivities(res?.data || []);
            }
        } catch {
            message.error("Erreur lors du chargement des activités");
        } finally {
            setLoading(false);
        }
    }, [opportunityId, partnerId, contactId, includeOppActivities]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    const handleFormSubmit = () => {
        loadActivities();
    };

    const handleMarkDone = async (id) => {
        try {
            await prospectActivitiesApi.markAsDone(id);
            message.success("Activité terminée");
            loadActivities();
        } catch {
            message.error("Erreur");
        }
    };

    const handleDelete = async (id) => {
        try {
            await prospectActivitiesApi.delete(id);
            message.success("Activité supprimée");
            loadActivities();
        } catch {
            message.error("Erreur");
        }
    };

    const handleEdit = (activityId) => {
        setSelectedActivityId(activityId);
        setDrawerOpen(true);
    };

    const handleCreate = () => {
        setSelectedActivityId(null);
        setDrawerOpen(true);
    };

    const timelineItems = activities.map((act) => {
        const config = ACTIVITY_TYPES[act.pac_type] || {};
        const isDone = act.pac_is_done;
        const isOverdue = act.pac_due_date && !isDone && dayjs(act.pac_due_date).isBefore(dayjs());

        return {
            key: act.pac_id,
            color: isDone ? "green" : isOverdue ? "red" : config.color || "blue",
            dot: isDone ? <CheckCircleOutlined /> : config.icon || <ClockCircleOutlined />,
            children: (
                <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Space size={4}>
                            {formatActivityType(act.pac_type)}
                            <strong>{act.pac_subject}</strong>
                            {isDone && <Tag color="green">Terminé</Tag>}
                            {isOverdue && <Tag color="red">En retard</Tag>}
                        </Space>
                        <Space size={4}>
                            {!isDone && (
                                <Tooltip title="Marquer comme terminé">
                                    <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => handleMarkDone(act.pac_id)} />
                                </Tooltip>
                            )}
                            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(act.pac_id)} />
                            <Popconfirm title="Supprimer cette activité ?" onConfirm={() => handleDelete(act.pac_id)} okText="Oui" cancelText="Non">
                                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </Space>
                    </div>
                    <div style={{ color: "#888", fontSize: 12 }}>
                        {dayjs(act.pac_date).format("DD/MM/YYYY HH:mm")}
                        {act.pac_due_date && <> — Échéance : {dayjs(act.pac_due_date).format("DD/MM/YYYY")}</>}

                        {act.author_name && <> — par {act.author_name}</>}
                    </div>
                    {isContactMode && act.ptr_name && (
                        <div style={{ fontSize: 12, color: "#888" }}>Société : {act.ptr_name}</div>
                    )}
                    {act.pac_description && (
                        <div style={{ marginTop: 4, color: "#555" }}>{act.pac_description}</div>
                    )}
                </div>
            ),
        };
    });

    return (
        <div>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Button type="secondary" icon={<PlusOutlined />} onClick={handleCreate}>
                    Ajouter une activité
                </Button>
                {isPartnerMode && (
                    <Space>
                        <Switch checked={includeOppActivities} onChange={setIncludeOppActivities} size="small" />
                        <span>Voir aussi les activités liées aux opportunités</span>
                    </Space>
                )}

            </div>

            <Spin spinning={loading}>
                {activities.length === 0 ? (
                    <Empty description="Aucune activité" />
                ) : (
                    <Timeline items={timelineItems} />
                )}
            </Spin>

            {drawerOpen && (
                <ActivityFormModal
                    open={drawerOpen}
                    onClose={() => { setDrawerOpen(false); setSelectedActivityId(null); }}
                    activityId={selectedActivityId}
                    defaultValues={
                        isContactMode
                            ? { ctc_ids: [contactId], fk_ptr_id: defaultPartnerId ?? undefined, partnerInitialData: defaultPartnerInitialData, contactInitialData }
                            : opportunityId
                                ? { fk_opp_id: opportunityId, fk_ptr_id: partnerId, partnerInitialData }
                                : { fk_ptr_id: partnerId, partnerInitialData }
                    }
                    onSubmit={handleFormSubmit}
                />
            )}
        </div>
    );
}
