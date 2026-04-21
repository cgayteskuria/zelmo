import { useRef, useState } from "react";
import { Button, Tag, Modal, Input, Alert } from "antd";
import { message } from "../../utils/antdStatic";
import { CheckOutlined, CloseOutlined, SelectOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import CanAccess from "../../components/common/CanAccess";
import { timeEntriesApi } from "../../services/api";
import TimeEntryForm from "./TimeEntryForm";
import { useDrawerManager } from "../../hooks/useDrawerManager";

const STATUS_LABELS = { 0: "Brouillon", 1: "Soumis", 2: "Approuvé", 3: "Facturé", 4: "Rejeté" };
const STATUS_COLORS = { 0: "default", 1: "processing", 2: "success", 3: "purple", 4: "error" };

function formatDuration(minutes) {
    if (!minutes) return "0h";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export default function TimeApproval() {
    const gridRef = useRef(null);
    const { drawerOpen, selectedItemId, closeDrawer, openForEdit } = useDrawerManager();
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    const reload = async () => {
        setSelectedRowKeys([]);
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    // Sélectionner automatiquement toutes les saisies soumises
    const handleSelectPending = async () => {
        try {
            const res = await timeEntriesApi.list({ grid_key: "time-approval", sort_by: "ten_date", limit: 1000, page: 1 });
            const rows = res?.data ?? [];
            if (!rows.length) { message.info("Aucune saisie en attente d'approbation."); return; }
            setSelectedRowKeys(rows.map(r => r.ten_id));
            message.success(`${rows.length} saisie(s) sélectionnée(s).`);
        } catch {
            message.error("Erreur lors de la sélection.");
        }
    };

    const handleApproveBatch = async () => {
        try {
            await timeEntriesApi.approveBatch(selectedRowKeys);
            message.success(`${selectedRowKeys.length} saisie(s) approuvée(s).`);
            await reload();
        } catch {
            message.error("Erreur lors de l'approbation.");
        }
    };

    const handleRejectConfirm = async () => {
        if (!rejectReason.trim()) { message.warning("Veuillez saisir un motif de rejet."); return; }
        try {
            await timeEntriesApi.rejectBatch(selectedRowKeys, rejectReason);
            message.success(`${selectedRowKeys.length} saisie(s) rejetée(s).`);
            setRejectModalOpen(false);
            setRejectReason("");
            await reload();
        } catch {
            message.error("Erreur lors du rejet.");
        }
    };

    const columns = [
        {
            key: "ten_date",
            title: "Date",
            width: 110,
            render: (v) => v ? new Date(v).toLocaleDateString("fr-FR") : "—",
            filterType: "date",
        },
        { key: "usr_fullname", title: "Collaborateur", width: 150, ellipsis: true, filterType: "text" },
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
            key: "ten_status",
            title: "Statut",
            width: 100,
            render: (v) => <Tag color={STATUS_COLORS[v] ?? "default"}>{STATUS_LABELS[v] ?? v}</Tag>,
        },
    ];

    const hasSelected = selectedRowKeys.length > 0;

    return (
        <PageContainer title="Approbation des saisies">
            <Alert
                type="info"
                showIcon
                message="Approbation des saisies soumises"
                description="Seules les saisies soumises par les collaborateurs sont affichées. Sélectionnez les saisies à traiter, puis approuvez-les ou refusez-les avec un motif. Les saisies approuvées pourront ensuite être facturées."
                style={{ marginBottom: 12 }}
                closable
            />

            {/* Bouton sélection + actions batch au-dessus du tableau */}
            <CanAccess permission="time.approve">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <Button icon={<SelectOutlined />} onClick={handleSelectPending}>
                        Sélectionner les saisies à approuver
                    </Button>

                    {hasSelected && (
                        <>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>
                                — {selectedRowKeys.length} saisie(s)
                            </span>
                            <Button icon={<CheckOutlined />} type="primary" onClick={handleApproveBatch}>
                                Confirmer l'approbation
                            </Button>
                            <Button icon={<CloseOutlined />} danger onClick={() => setRejectModalOpen(true)}>
                                Refuser
                            </Button>
                        </>
                    )}
                </div>
            </CanAccess>

            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={(params) => timeEntriesApi.list({ ...params, grid_key: "time-approval" })}
                onRowClick={(row) => openForEdit(row.ten_id)}
                rowKey="ten_id"
                defaultSort={{ field: "ten_date", order: "ASC" }}
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
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

            <Modal
                title="Motif de refus"
                open={rejectModalOpen}
                onOk={handleRejectConfirm}
                onCancel={() => { setRejectModalOpen(false); setRejectReason(""); }}
                okText="Confirmer le refus"
                okButtonProps={{ danger: true }}
                cancelText="Annuler"
            >
                <Input.TextArea
                    rows={3}
                    placeholder="Expliquez la raison du refus…"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    maxLength={500}
                    showCount
                />
            </Modal>
        </PageContainer>
    );
}
