import { useRef, useState } from "react";
import { Button, Tag, Alert } from "antd";
import { message } from '../../utils/antdStatic';
import { PlusOutlined, CheckOutlined, SendOutlined, SelectOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";
import { timeEntriesApi } from "../../services/api";
import TimeEntryForm from "./TimeEntryForm";

const STATUS_LABELS = { 0: "Brouillon", 1: "Soumis", 2: "Approuvé", 3: "Facturé", 4: "Rejeté" };
const STATUS_COLORS = { 0: "default", 1: "processing", 2: "success", 3: "purple", 4: "error" };

function formatDuration(minutes) {
    if (!minutes) return "0h";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export default function TimeEntries() {
    const gridRef = useRef(null);

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    const reload = async () => {
        setSelectedRowKeys([]);
        setSelectedRowKeys([]);
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    const handleRowClick = (row) => openForEdit(row.ten_id);

    // Sélectionner automatiquement toutes les saisies en brouillon
    const handleSelectDrafts = async () => {
        try {
            const res = await timeEntriesApi.list({ "filters[ten_status]": 0, limit: 1000, page: 1 });
            const rows = res?.data ?? [];
            if (!rows.length) { message.info("Aucune saisie en brouillon."); return; }
            setSelectedRowKeys(rows.map(r => r.ten_id));
            message.success(`${rows.length} saisie(s) en brouillon sélectionnée(s).`);
        } catch {
            message.error("Erreur lors de la sélection.");
        }
    };

    const handleSubmitBatch = async () => {
        try {
            await timeEntriesApi.submitBatch(selectedRowKeys);
            message.success(`${selectedRowKeys.length} saisie(s) soumise(s).`);
            await reload();
        } catch {
            message.error("Erreur lors de la soumission.");
        }
    };

    // ── Colonnes ──
    const columns = [
        {
            key: "ten_date",
            title: "Date",
            width: 110,
            render: (v) => v ? new Date(v).toLocaleDateString("fr-FR") : "—",
            filterType: "date",
        },
        {
            key: "tpr_lib",
            title: "Projet",
            ellipsis: true,
            filterType: "text",
            render: (v, row) => (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {row.tpr_color && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: row.tpr_color }} />}
                    {v || "—"}
                </span>
            ),
        },
        { key: "ptr_name", title: "Client", ellipsis: true, filterType: "text" },
        { key: "ten_description", title: "Description", ellipsis: true },
        {
            key: "ten_duration",
            title: "Durée",
            width: 90,
            align: "right",
            render: (v) => formatDuration(v),
        },
        {
            key: "ten_is_billable",
            title: "Fact.",
            width: 60,
            align: "center",
            render: (v) => v ? <CheckOutlined style={{ color: "#22c55e" }} /> : null,
        },
        {
            key: "ten_status",
            title: "Statut",
            width: 100,
            render: (v) => <Tag color={STATUS_COLORS[v] ?? "default"}>{STATUS_LABELS[v] ?? v}</Tag>,
        },
        { key: "usr_fullname", title: "Collaborateur", width: 150, ellipsis: true },
        createEditActionColumn({ permission: "time.edit", onEdit: handleRowClick, mode: "table" }),
    ];

    const hasSelected = selectedRowKeys.length > 0;

    return (
        <PageContainer
            title="Saisies de temps"
            actions={
                <CanAccess permission="time.create">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Nouvelle saisie
                    </Button>
                </CanAccess>
            }
        >
            {/* Explication workflow */}
            <Alert
                type="info"
                showIcon
                title="Les saisies doivent être soumises pour validation avant de pouvoir être approuvées et facturées."
                style={{ marginBottom: 12 }}
                closable
            />

            {/* Bouton sélection brouillons + batch actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <Button icon={<SelectOutlined />} onClick={handleSelectDrafts}>
                    Sélectionner les saisies à soumettre
                </Button>

                {hasSelected && (
                    <>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>
                            — {selectedRowKeys.length} saisie(s) sélectionnée(s)
                        </span>
                        <CanAccess permission="time.create">
                            <Button icon={<SendOutlined />} type="primary" onClick={handleSubmitBatch}>
                                Soumettre
                            </Button>
                        </CanAccess>
                    </>
                )}
            </div>

            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={(params) => timeEntriesApi.list({ ...params, grid_key: "time-entries" })}
                onRowClick={handleRowClick}
                rowKey="ten_id"
                defaultSort={{ field: "ten_date", order: "DESC" }}
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
                    getCheckboxProps: (row) => ({
                        // Soumis (1), Approuvé (2), Facturé (3) : non sélectionnables
                        disabled: row.ten_status === 1 || row.ten_status === 2 || row.ten_status === 3,
                    }),
                }}
            />

            {drawerOpen && (
                <TimeEntryForm
                    open={drawerOpen}
                    onClose={closeDrawer}
                    entryId={selectedItemId}
                    onSubmit={reload}
                />
            )}
        </PageContainer>
    );
}
