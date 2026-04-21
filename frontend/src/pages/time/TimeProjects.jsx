import { useRef } from "react";
import { Button, Tag, Progress } from "antd";
import { PlusOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";
import { timeProjectsApi } from "../../services/api";
import TimeProjectForm from "./TimeProjectForm";

const STATUS_LABELS = { 0: "Actif", 1: "Archivé" };
const STATUS_COLORS = { 0: "green", 1: "default" };

function BudgetCell({ consumed, budget }) {
    if (budget == null) return <span style={{ color: "var(--color-muted)", fontSize: 12 }}>{consumed}h / ∞</span>;
    const pct = Math.min(Math.round((consumed / budget) * 100), 100);
    const color = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f97316" : "#22c55e";
    return (
        <div style={{ minWidth: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                <span>{consumed}h</span>
                <span style={{ color: "var(--color-muted)" }}>{budget}h</span>
            </div>
            <Progress percent={pct} showInfo={false} strokeColor={color} size="small" />
        </div>
    );
}

export default function TimeProjects() {
    const gridRef = useRef(null);
    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    const { handleRowClick } = useRowHandler(openForEdit, "tpr_id");

    const columns = [
        {
            key: "tpr_color",
            title: "",
            width: 40,
            align: "center",
            render: (value) => value ? (
                <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: value }} />
            ) : null,
        },
        { key: "tpr_lib", title: "Projet", ellipsis: true, filterType: "text" },
        { key: "ptr_name", title: "Client", ellipsis: true, filterType: "text" },
        {
            key: "tpr_deadline",
            title: "Deadline",
            width: 120,
            render: (v) => v ? new Date(v).toLocaleDateString("fr-FR") : "—",
        },
        {
            key: "hours_consumed",
            title: "Budget heures",
            width: 160,
            render: (consumed, row) => (
                <BudgetCell consumed={Number(consumed || 0)} budget={row.tpr_budget_hours ? Number(row.tpr_budget_hours) : null} />
            ),
        },
        {
            key: "tpr_hourly_rate",
            title: "Taux HT",
            width: 100,
            align: "right",
            render: (v) => v ? `${Number(v).toFixed(0)} €/h` : "—",
        },
        {
            key: "tpr_status",
            title: "Statut",
            width: 90,
            render: (v) => <Tag color={STATUS_COLORS[v] ?? "default"}>{STATUS_LABELS[v] ?? v}</Tag>,
        },
        createEditActionColumn({ permission: "time.projects.edit", onEdit: handleRowClick, mode: "table" }),
    ];

    const breadcrumbItems = [
        { title: <Link to="/time-entries"><ClockCircleOutlined /> Suivi de temps</Link> },
        { title: "Projets" },
    ];

    return (
        <PageContainer
            title="Projets"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="time.projects.edit">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Nouveau projet
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={timeProjectsApi.list}
                onRowClick={handleRowClick}
                rowKey="tpr_id"
                defaultSort={{ field: "tpr_lib", order: "ASC" }}
            />

            {drawerOpen && (
                <TimeProjectForm
                    open={drawerOpen}
                    onClose={closeDrawer}
                    projectId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
