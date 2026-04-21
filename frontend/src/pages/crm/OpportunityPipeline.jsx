import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Tag, Spin, Modal, Typography, Badge } from "antd";
import { message } from '../../utils/antdStatic';
import { PlusOutlined, UnorderedListOutlined, CalendarOutlined, UserOutlined } from "@ant-design/icons";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, useDroppable, useDraggable, } from "@dnd-kit/core";
import PageContainer from "../../components/common/PageContainer";
import LostReasonSelect from "../../components/select/LostReasonSelect";
import { opportunitiesApi } from "../../services/apiProspect";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Opportunity from "./Opportunity";

const { Text } = Typography;

// ——— Draggable Opportunity Card ———
function OpportunityCard({ opportunity, isDragOverlay = false, onCardClick }) {
    const style = {
        padding: "10px 12px",
        marginBottom: 8,
        background: "#fff",
        borderRadius: 6,
        border: "1px solid #f0f0f0",
        cursor: isDragOverlay ? "grabbing" : "grab",
        opacity: isDragOverlay ? 0.9 : 1,
        boxShadow: isDragOverlay ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
    };

    return (
        <div
            style={style}
            onClick={(e) => {
                if (!isDragOverlay && onCardClick) {
                    e.stopPropagation();
                    onCardClick(opportunity.opp_id);
                }
            }}
        >
            <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
                {opportunity.opp_label}
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

function DraggableCard({ opportunity, onCardClick }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `opp-${opportunity.opp_id}`,
        data: { opportunity },
    });

    const style = {
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <OpportunityCard opportunity={opportunity} onCardClick={onCardClick} />
        </div>
    );
}

// ——— Droppable Stage Column ———
function StageColumn({ stage, opportunities, count, totalAmount, onCardClick }) {
    const { isOver, setNodeRef } = useDroppable({
        id: `stage-${stage.id}`,
        data: { stage },
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                flex: "0 0 280px",
                minWidth: 280,
                maxWidth: 280,
                display: "flex",
                flexDirection: "column",
                height: "100%",
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: "10px 12px",
                    borderRadius: "8px 8px 0 0",
                    background: stage.color || "#f0f0f0",
                    color: "#fff",
                    textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{stage.label}</span>
                    <Badge count={count} style={{ backgroundColor: "rgba(255,255,255,0.3)", color: "#fff" }} />
                </div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                    {formatCurrency(totalAmount)}
                </div>
            </div>

            {/* Cards area */}
            <div
                style={{
                    flex: 1,
                    padding: 8,
                    background: isOver ? "#e6f4ff" : "#fafafa",
                    borderRadius: "0 0 8px 8px",
                    border: isOver ? "2px dashed #1677ff" : "1px solid #f0f0f0",
                    overflowY: "auto",
                    transition: "background 0.2s, border 0.2s",
                    minHeight: 100,
                }}
            >
                {opportunities.map((opp) => (
                    <DraggableCard key={opp.opp_id} opportunity={opp} onCardClick={onCardClick} />
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

// ——— Main Pipeline Page ———
export default function OpportunityPipeline() {
    const navigate = useNavigate();
    const [pipelineData, setPipelineData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCard, setActiveCard] = useState(null);
    const [lostModalOpen, setLostModalOpen] = useState(false);
    const [lostReasonId, setLostReasonId] = useState(null);
    const [pendingDrop, setPendingDrop] = useState(null);

    // Drawer pour ouvrir une opportunité
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedOppId, setSelectedOppId] = useState(null);

    const openDrawer = (oppId) => {
        setSelectedOppId(oppId);
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setSelectedOppId(null);
    };

    const openForCreate = () => {
        setSelectedOppId(null);
        setDrawerOpen(true);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor),
    );

    const loadPipeline = useCallback(async () => {
        try {
            setLoading(true);
            const res = await opportunitiesApi.pipeline({ include_closed: true });
            setPipelineData(res.data);
        } catch {
            message.error("Erreur lors du chargement du pipeline");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPipeline();
    }, [loadPipeline]);

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

        // Si l'étape cible est "Perdu" → demander la raison
        if (targetStage.is_lost) {
            setPendingDrop({ opportunity, targetStage });
            setLostReasonId(null);
            setLostModalOpen(true);
            return;
        }

        // Si l'étape cible est "Gagné" → confirmation directe
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

        // Changement d'étape normal
        try {
            await opportunitiesApi.update(opportunity.opp_id, { fk_pps_id: targetStage.id });
            // Optimistic update
            setPipelineData((prev) =>
                prev.map((col) => {
                    const stageId = col.stage.id;
                    let opps = [...col.opportunities];
                    if (stageId === opportunity.fk_pps_id) {
                        opps = opps.filter((o) => o.opp_id !== opportunity.opp_id);
                    }
                    if (stageId === targetStage.id) {
                        opps.push({ ...opportunity, fk_pps_id: targetStage.id });
                    }
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

    const handleDrawerSubmit = () => {
        loadPipeline();
    };

    return (
        <PageContainer
            title="Pipeline des opportunités"
            actions={
                <div style={{ display: "flex", gap: 8 }}>
                    <Button icon={<UnorderedListOutlined />} onClick={() => navigate("/opportunities")} size="large">
                        Liste
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Nouvelle opportunité
                    </Button>
                </div>
            }
        >
            <Spin spinning={loading}>
                <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div
                        style={{
                            display: "flex",
                            gap: 12,
                            overflowX: "auto",
                            paddingBottom: 16,
                            height: "calc(100vh - 200px)",
                            alignItems: "stretch",
                        }}
                    >
                        {pipelineData.map((col) => (
                            <StageColumn
                                key={col.stage.id}
                                stage={col.stage}
                                opportunities={col.opportunities}
                                count={col.count}
                                totalAmount={col.total_amount}
                                onCardClick={openDrawer}
                            />
                        ))}
                    </div>

                    <DragOverlay>
                        {activeCard ? <OpportunityCard opportunity={activeCard} isDragOverlay /> : null}
                    </DragOverlay>
                </DndContext>
            </Spin>

            {/* Modal raison de perte */}
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

            {/* Drawer Opportunité */}
            {drawerOpen && (
                <Opportunity
                    open={drawerOpen}
                    onClose={closeDrawer}
                    opportunityId={selectedOppId}
                    onSubmit={handleDrawerSubmit}
                />
            )}
        </PageContainer>
    );
}
