import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Button, Tag, Spin, Modal, Badge, Typography, Space, Popover } from "antd";
import { message } from "../../utils/antdStatic";
import {
    PlusOutlined, AppstoreOutlined, UnorderedListOutlined,
    CalendarOutlined, UserOutlined, ArrowRightOutlined, ArrowLeftOutlined, WarningFilled,
} from "@ant-design/icons";
import {
    DndContext, DragOverlay, PointerSensor, KeyboardSensor,
    useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import dayjs from "dayjs";
import ServerTable from "../../components/table";
import { formatCurrency, formatDate } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { formatProbability, ACTIVITY_TYPES } from "../../configs/OpportunityConfig";
import { opportunitiesApi, prospectActivitiesApi } from "../../services/apiProspect";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import Opportunity from "./Opportunity";
import LostReasonSelect from "../../components/select/LostReasonSelect";
import ActivityFormModal from "../../components/crm/ActivityFormModal";

const { Text } = Typography;

function getRelativeDate(dateStr) {
    const date = dayjs(dateStr);
    const today = dayjs().startOf('day');
    const diff = date.startOf('day').diff(today, 'day');
    if (diff < 0) return { label: `En retard de ${Math.abs(diff)} jour${Math.abs(diff) > 1 ? 's' : ''}`, overdue: true };
    if (diff === 0) return { label: "Aujourd'hui", overdue: false };
    if (diff === 1) return { label: "Demain", overdue: false };
    return { label: date.format('DD/MM/YYYY'), overdue: false };
}

function getInitials(name) {
    if (!name) return '';
    return name.split(' ').map(p => p[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}

function ActivityStatusDot({ opportunity, onOpenActivity, onSchedule, refreshKey }) {
    const [open, setOpen] = useState(false);
    const [activities, setActivities] = useState(null);
    const { activity_status: status } = opportunity;

    useEffect(() => {
        setActivities(null);
    }, [refreshKey]);

    const handleOpenChange = (newOpen) => {
        setOpen(newOpen);
        if (newOpen && activities === null) {
            prospectActivitiesApi.byOpportunity(opportunity.opp_id)
                .then(res => setActivities((res.data || []).filter(a => a.pac_is_done == 0)))
                .catch(() => setActivities([]));
        }
    };

    const iconEl = status === 'upcoming'
        ? (
            <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 16, height: 16, borderRadius: '50%',
                background: '#52c41a', color: '#fff', fontSize: 9, flexShrink: 0,
            }}>
                <ArrowRightOutlined />
            </span>
        )
        : status === 'overdue'
            ? (
                <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#ff4d4f', color: '#fff', fontSize: 9, flexShrink: 0,
                }}>
                    <ArrowLeftOutlined />
                </span>
            )
            : <WarningFilled style={{ color: '#fa8c16', fontSize: 15, flexShrink: 0 }} />;

    const popoverContent = (
      
        <div style={{ width: 270 }} onClick={e => e.stopPropagation()}>
            {activities === null ? (
                <div style={{ padding: '8px 0', textAlign: 'center' }}><Spin size="small" /></div>
            ) : (
                <>                 
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {activities.map(act => {
                            const { label, overdue } = getRelativeDate(act.pac_date);
                            const typeConf = ACTIVITY_TYPES[act.pac_type];
                            return (
                                <div
                                    key={act.pac_id}
                                    onClick={() => { setOpen(false); onOpenActivity(act.pac_id); }}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 10,
                                        padding: '7px 4px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                                    onMouseLeave={e => e.currentTarget.style.background = ''}
                                >
                                    <span style={{ color: typeConf?.color ?? '#8c8c8c', fontSize: 15, marginTop: 1, flexShrink: 0 }}>
                                        {typeConf?.icon}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {act.pac_subject}
                                        </div>
                                        <div style={{ fontSize: 11, color: overdue ? '#ff4d4f' : '#8c8c8c' }}>
                                            {label}{act.seller_name ? ` · ${getInitials(act.seller_name)}` : ''}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {activities.length === 0 && (
                            <div style={{ padding: '6px 4px', color: '#bfbfbf', fontSize: 12 }}>
                                Aucune activité en attente
                            </div>
                        )}
                    </div>
                    <div
                        onClick={() => { setOpen(false); onSchedule(opportunity); }}
                        style={{
                            padding: '8px 4px 2px', cursor: 'pointer', color: '#1677ff',
                            fontSize: 13, borderTop: '1px solid #f0f0f0', marginTop: 4,
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        <PlusOutlined /> Programmer une activité
                    </div>
                </>
            )}
        </div>
    );

    return (
        <Popover
            open={open}
            onOpenChange={handleOpenChange}
            trigger="click"
            placement="rightTop"
            title={null}
            content={popoverContent}
        >
            <span data-no-row-click style={{ cursor: 'pointer', display: 'inline-flex' }}>
                {iconEl}
            </span>
        </Popover>
    );
}

function OpportunityCard({ opportunity, isDragOverlay = false, onCardClick, onOpenActivity, onSchedule, activityRefreshKey }) {
    return (
        <div
            style={{
                padding: "10px 12px",
                marginBottom: 8,
                background: "#fff",
                borderRadius: 6,
                border: "1px solid #f0f0f0",
                cursor: isDragOverlay ? "grabbing" : "grab",
                opacity: isDragOverlay ? 0.9 : 1,
                boxShadow: isDragOverlay ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
            }}
            onClick={(e) => {
                if (!isDragOverlay && onCardClick && !e.target.closest('[data-no-row-click]')) {
                    e.stopPropagation();
                    onCardClick(opportunity.opp_id);
                }
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{opportunity.opp_label}</span>
                {!isDragOverlay && (
                    <ActivityStatusDot
                        opportunity={opportunity}
                        onOpenActivity={onOpenActivity}
                        onSchedule={onSchedule}
                        refreshKey={activityRefreshKey}
                    />
                )}
            </div>
            <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 4 }}>
                <UserOutlined style={{ marginRight: 4 }} />
                {opportunity.ptr_name}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text strong style={{ fontSize: 13, color: "#1677ff" }}>
                    {formatCurrency(opportunity.opp_amount)}
                </Text>
                {opportunity.opp_close_date && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        <CalendarOutlined style={{ marginRight: 2 }} />
                        {formatDate(opportunity.opp_close_date)}
                    </Text>
                )}
            </div>
            {opportunity.seller_name && (
                <div style={{ fontSize: 11, color: "#bfbfbf", marginTop: 4 }}>
                    {opportunity.seller_name}
                </div>
            )}
        </div>
    );
}

function DraggableCard({ opportunity, onCardClick, onOpenActivity, onSchedule, activityRefreshKey }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `opp-${opportunity.opp_id}`,
        data: { opportunity },
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
                opacity: isDragging ? 0.4 : 1,
            }}
            {...listeners}
            {...attributes}
        >
            <OpportunityCard
                opportunity={opportunity}
                onCardClick={onCardClick}
                onOpenActivity={onOpenActivity}
                onSchedule={onSchedule}
                activityRefreshKey={activityRefreshKey}
            />
        </div>
    );
}

function StageColumn({ stage, opportunities, count, totalAmount, onCardClick, onOpenActivity, onSchedule, activityRefreshKey }) {
    const { isOver, setNodeRef } = useDroppable({
        id: `stage-${stage.id}`,
        data: { stage },
    });

    return (
        <div
            ref={setNodeRef}
            style={{ flex: "0 0 280px", minWidth: 280, maxWidth: 280, display: "flex", flexDirection: "column", height: "100%" }}
        >
            <div style={{
                padding: "10px 12px",
                borderRadius: "8px 8px 0 0",
                background: stage.color || "#f0f0f0",
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.2)",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{stage.label}</span>
                    <Badge count={count} style={{ backgroundColor: "rgba(255,255,255,0.3)", color: "#fff" }} />
                </div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                    {formatCurrency(totalAmount)}
                </div>
            </div>
            <div style={{
                flex: 1,
                padding: 8,
                background: isOver ? "#e6f4ff" : "#fafafa",
                borderRadius: "0 0 8px 8px",
                border: isOver ? "2px dashed #1677ff" : "1px solid #f0f0f0",
                overflowY: "auto",
                transition: "background 0.2s, border 0.2s",
                minHeight: 100,
            }}>
                {opportunities.map((opp) => (
                    <DraggableCard
                        key={opp.opp_id}
                        opportunity={opp}
                        onCardClick={onCardClick}
                        onOpenActivity={onOpenActivity}
                        onSchedule={onSchedule}
                        activityRefreshKey={activityRefreshKey}
                    />
                ))}
                {opportunities.length === 0 && (
                    <div style={{ textAlign: "center", color: "#bfbfbf", padding: "20px 0", fontSize: 12 }}>
                        Aucune opportunité
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Opportunities() {
    const gridRef = useRef(null);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem("opportunities.viewMode") || "list");

    const handleSetViewMode = (mode) => {
        localStorage.setItem("opportunities.viewMode", mode);
        setViewMode(mode);
    };

    // Pipeline state
    const [pipelineData, setPipelineData] = useState([]);
    const [pipelineLoading, setPipelineLoading] = useState(false);
    const [activeCard, setActiveCard] = useState(null);
    const [lostModalOpen, setLostModalOpen] = useState(false);
    const [lostReasonId, setLostReasonId] = useState(null);
    const [pendingDrop, setPendingDrop] = useState(null);

    // Activity modal state
    const [activityModalOpen, setActivityModalOpen] = useState(false);
    const [activityId, setActivityId] = useState(null);
    const [activityDefaults, setActivityDefaults] = useState({});
    const [activityRefreshKey, setActivityRefreshKey] = useState(0);

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit,
    } = useDrawerManager();

    const { handleRowClick } = useRowHandler(openForEdit);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor),
    );

    const loadPipeline = useCallback(async () => {
        try {
            setPipelineLoading(true);
            const res = await opportunitiesApi.pipeline({ include_closed: true });
            setPipelineData(res.data);
        } catch {
            message.error("Erreur lors du chargement du pipeline");
        } finally {
            setPipelineLoading(false);
        }
    }, []);

    useEffect(() => {
        if (viewMode === "pipeline") loadPipeline();
    }, [viewMode, loadPipeline]);

    const handleOpenActivity = useCallback((id) => {
        setActivityId(id);
        setActivityDefaults({});
        setActivityModalOpen(true);
    }, []);

    const handleScheduleActivity = useCallback((opportunity) => {
        setActivityId(null);
        setActivityDefaults({
            fk_opp_id: opportunity.opp_id,
            fk_ptr_id: opportunity.fk_ptr_id,
            partnerInitialData: { ptr_id: opportunity.fk_ptr_id, ptr_name: opportunity.ptr_name },
        });
        setActivityModalOpen(true);
    }, []);

    const handleActivitySubmit = useCallback(() => {
        setActivityModalOpen(false);
        setActivityRefreshKey(k => k + 1);
        if (viewMode === "list") {
            gridRef.current?.reload?.();
        } else {
            loadPipeline();
        }
    }, [viewMode, loadPipeline]);

    const handleFormSubmit = async () => {
        if (viewMode === "list") {
            if (gridRef.current?.reload) await gridRef.current.reload();
        } else {
            await loadPipeline();
        }
    };

    const handleDragStart = (event) => {
        setActiveCard(event.active.data.current?.opportunity || null);
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveCard(null);
        if (!over) return;

        const opportunity = active.data.current?.opportunity;
        const targetStage = over.data.current?.stage;
        if (!opportunity || !targetStage) return;
        if (opportunity.fk_pps_id === targetStage.id) return;

        if (targetStage.is_lost) {
            setPendingDrop({ opportunity, targetStage });
            setLostReasonId(null);
            setLostModalOpen(true);
            return;
        }

        if (targetStage.is_won) {
            Modal.confirm({
                title: "Marquer comme gagné ?",
                content: `Confirmer que "${opportunity.opp_label}" est gagnée ?`,
                okText: "Confirmer",
                cancelText: "Annuler",
                onOk: async () => {
                    try {
                        await opportunitiesApi.markAsWon(opportunity.opp_id);
                        message.success("Opportunité marquée comme gagnée !");
                        loadPipeline();
                    } catch {
                        message.error("Erreur");
                    }
                },
            });
            return;
        }

        try {
            await opportunitiesApi.update(opportunity.opp_id, { fk_pps_id: targetStage.id });
            setPipelineData((prev) =>
                prev.map((col) => {
                    const stageId = col.stage.id;
                    let opps = [...col.opportunities];
                    if (stageId === opportunity.fk_pps_id) opps = opps.filter((o) => o.opp_id !== opportunity.opp_id);
                    if (stageId === targetStage.id) opps.push({ ...opportunity, fk_pps_id: targetStage.id });
                    return {
                        ...col,
                        opportunities: opps,
                        count: opps.length,
                        total_amount: opps.reduce((sum, o) => sum + (parseFloat(o.opp_amount) || 0), 0),
                    };
                }),
            );
        } catch {
            message.error("Erreur lors du déplacement");
            loadPipeline();
        }
    };

    const handleConfirmLost = async () => {
        if (!pendingDrop) return;
        try {
            await opportunitiesApi.markAsLost(pendingDrop.opportunity.opp_id, { fk_plr_id: lostReasonId });
            message.success("Opportunité marquée comme perdue");
            setLostModalOpen(false);
            setPendingDrop(null);
            loadPipeline();
        } catch {
            message.error("Erreur");
        }
    };

    const columns = useMemo(() => [
        {
            key: "activity_status",
            title: "",
            width: 40,
            align: "center",
            render: (value, record) => (
                <ActivityStatusDot
                    opportunity={{ ...record, opp_id: record.id, activity_status: value }}
                    onOpenActivity={handleOpenActivity}
                    onSchedule={handleScheduleActivity}
                    refreshKey={activityRefreshKey}
                />
            ),
        },
        {
            key: "opp_label",
            title: "Titre",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "ptr_name",
            title: "Prospect",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "pps_label",
            title: "Étape",
            width: 140,
            align: "center",
            filterType: "text",
            render: (value, record) => value ? <Tag color={record.pps_color}>{value}</Tag> : null,
        },
        {
            key: "opp_amount",
            title: "Montant",
            width: 120,
            align: "right",
            filterType: "numeric",
            render: (value) => formatCurrency(value),
        },
        {
            key: "opp_probability",
            title: "Proba.",
            width: 80,
            align: "center",
            render: (value) => formatProbability(value),
        },
        {
            key: "opp_weighted_amount",
            title: "Pondéré",
            width: 120,
            align: "right",
            render: (value) => formatCurrency(value),
        },
        {
            key: "opp_close_date",
            title: "Clôture prévue",
            width: 130,
            align: "center",
            filterType: "date",
            render: (value) => formatDate(value),
        },
        {
            key: "seller_name",
            title: "Commercial",
            width: 150,
            filterType: "text",
            ellipsis: true,
        },
        createEditActionColumn({ permission: "opportunities.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ], [handleRowClick, handleOpenActivity, handleScheduleActivity, activityRefreshKey]);

    return (
        <PageContainer
            title="Opportunités"
            actions={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Space.Compact>
                        <Button
                            icon={<UnorderedListOutlined />}
                            type={viewMode === "list" ? "primary" : "default"}
                            onClick={() => handleSetViewMode("list")}
                        >
                            Liste
                        </Button>
                        <Button
                            icon={<AppstoreOutlined />}
                            type={viewMode === "pipeline" ? "primary" : "default"}
                            onClick={() => handleSetViewMode("pipeline")}
                        >
                            Pipeline
                        </Button>
                    </Space.Compact>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Nouvelle opportunité
                    </Button>
                </div>
            }
        >
            {viewMode === "list" ? (
                <ServerTable
                    ref={gridRef}
                    fetchFn={(params) => opportunitiesApi.list(params)}
                    columns={columns}
                    defaultSort={{ field: "opp_created", order: "DESC" }}
                    onRowClick={handleRowClick}
                />
            ) : (
                <Spin spinning={pipelineLoading}>
                    <DndContext
                        sensors={sensors}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div style={{
                            display: "flex",
                            gap: 12,
                            overflowX: "auto",
                            paddingBottom: 16,
                            height: "calc(100vh - 200px)",
                            alignItems: "stretch",
                        }}>
                            {pipelineData.map((col) => (
                                <StageColumn
                                    key={col.stage.id}
                                    stage={col.stage}
                                    opportunities={col.opportunities}
                                    count={col.count}
                                    totalAmount={col.total_amount}
                                    onCardClick={openForEdit}
                                    onOpenActivity={handleOpenActivity}
                                    onSchedule={handleScheduleActivity}
                                    activityRefreshKey={activityRefreshKey}
                                />
                            ))}
                        </div>
                        <DragOverlay>
                            {activeCard ? <OpportunityCard opportunity={activeCard} isDragOverlay /> : null}
                        </DragOverlay>
                    </DndContext>
                </Spin>
            )}

            <Modal
                title="Raison de la perte"
                open={lostModalOpen}
                onOk={handleConfirmLost}
                onCancel={() => { setLostModalOpen(false); setPendingDrop(null); }}
                okText="Confirmer"
                cancelText="Annuler"
            >
                <p>Pourquoi cette opportunité est-elle perdue ?</p>
                <LostReasonSelect value={lostReasonId} onChange={setLostReasonId} style={{ width: "100%" }} loadInitially />
            </Modal>

            {drawerOpen && (
                <Opportunity
                    open={drawerOpen}
                    onClose={closeDrawer}
                    opportunityId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}

            <ActivityFormModal
                open={activityModalOpen}
                onClose={() => setActivityModalOpen(false)}
                onSubmit={handleActivitySubmit}
                activityId={activityId}
                defaultValues={activityDefaults}
            />
        </PageContainer>
    );
}
