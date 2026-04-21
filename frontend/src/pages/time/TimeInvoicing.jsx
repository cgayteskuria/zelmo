import { useRef, useState, useEffect } from "react";
import { Button, Tag, Modal, InputNumber, Alert } from "antd";
import { message } from "../../utils/antdStatic";
import { useNavigate } from "react-router-dom";
import { FileTextOutlined, SelectOutlined, WarningOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import CanAccess from "../../components/common/CanAccess";
import { timeEntriesApi, timeConfigApi } from "../../services/api";

const STATUS_LABELS = { 0: "Brouillon", 1: "Soumis", 2: "Approuvé", 3: "Facturé", 4: "Rejeté" };
const STATUS_COLORS = { 0: "default", 1: "processing", 2: "success", 3: "purple", 4: "error" };

function formatDuration(minutes) {
    if (!minutes) return "0h";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export default function TimeInvoicing() {
    const navigate = useNavigate();
    const gridRef = useRef(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [invoiceRateOverride, setInvoiceRateOverride] = useState(null);
    const [configMissing, setConfigMissing] = useState(false);

    useEffect(() => {
        timeConfigApi.get(1).then(res => {
            const config = res.data?.data ?? res.data;
            setConfigMissing(!config?.fk_prt_id);
        }).catch(() => setConfigMissing(true));
    }, []);

    const reload = async () => {
        setSelectedRowKeys([]);
        setSelectedRows([]);
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    // Sélectionner automatiquement toutes les saisies approuvées
    const handleSelectApproved = async () => {
        try {
            const res = await timeEntriesApi.list({ grid_key: "time-invoicing", sort_by: "ten_date", limit: 1000, page: 1 });
            const rows = res?.data ?? [];
            if (!rows.length) { message.info("Aucune saisie approuvée en attente de facturation."); return; }
            setSelectedRowKeys(rows.map(r => r.ten_id));
            setSelectedRows(rows);
            message.success(`${rows.length} saisie(s) sélectionnée(s).`);
        } catch {
            message.error("Erreur lors de la sélection.");
        }
    };

    const handleGenerateInvoice = async () => {
        const ptrIds = [...new Set(selectedRows.map(r => r.fk_ptr_id).filter(Boolean))];
        if (ptrIds.length !== 1) {
            message.error("Sélectionnez uniquement des saisies du même client.");
            return;
        }
        try {
            const res = await timeEntriesApi.generateInvoice({
                entry_ids: selectedRowKeys,
                fk_ptr_id: ptrIds[0],
                hourly_rate_override: invoiceRateOverride || undefined,
            });
            message.success("Facture créée en brouillon !");
            setInvoiceModalOpen(false);
            setInvoiceRateOverride(null);
            await reload();
            navigate(`/invoices/${res.invoice_id}`);
        } catch (err) {
            message.error(err?.response?.data?.message ?? "Erreur lors de la génération.");
        }
    };

    const totalEstimate = selectedRows.reduce((sum, r) => {
        const rate = r.ten_hourly_rate ?? r.tpr_hourly_rate ?? 0;
        return sum + (r.ten_duration / 60) * rate;
    }, 0);

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
            key: "ten_hourly_rate",
            title: "Taux (€/h)",
            width: 100,
            align: "right",
            render: (v, row) => v ?? row.tpr_hourly_rate ?? "—",
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
        <PageContainer title="Générer des factures">
            {configMissing && (
                <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    message="Configuration incomplète"
                    description="Aucun produit de facturation n'est configuré pour le module temps. Veuillez définir un produit dans Paramètres > Temps avant de pouvoir générer des factures."
                    style={{ marginBottom: 12 }}
                />
            )}
            <Alert
                type="info"
                showIcon
                message="Facturation des saisies approuvées"
                description="Seules les saisies approuvées sont affichées. Sélectionnez les saisies à facturer pour un même client, puis cliquez sur « Confirmer la génération » pour créer une facture brouillon groupée par projet."
                style={{ marginBottom: 12 }}
                closable
            />

            <CanAccess permission="time.invoice">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <Button icon={<SelectOutlined />} onClick={handleSelectApproved}>
                        Sélectionner les saisies à facturer
                    </Button>

                    {hasSelected && (
                        <>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-muted)" }}>
                                — {selectedRowKeys.length} saisie(s)
                                {totalEstimate > 0 && ` · ${totalEstimate.toFixed(2)} € HT estimés`}
                            </span>
                            <Button
                                icon={<FileTextOutlined />}
                                type="primary"
                                onClick={() => setInvoiceModalOpen(true)}
                                disabled={configMissing}
                                title={configMissing ? "Configurez un produit de facturation dans Paramètres > Temps" : undefined}
                            >
                                Confirmer la génération
                            </Button>
                        </>
                    )}
                </div>
            </CanAccess>

            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={(params) => timeEntriesApi.list({ ...params, grid_key: "time-invoicing" })}
                rowKey="ten_id"
                defaultSort={{ field: "ten_date", order: "ASC" }}
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys, rows) => { setSelectedRowKeys(keys); setSelectedRows(rows); },
                }}
            />

            <Modal
                title="Générer une facture"
                open={invoiceModalOpen}
                onOk={handleGenerateInvoice}
                onCancel={() => { setInvoiceModalOpen(false); setInvoiceRateOverride(null); }}
                okText="Générer la facture"
                cancelText="Annuler"
            >
                <div style={{ marginBottom: 12 }}>
                    <strong>{selectedRowKeys.length}</strong> saisie(s) sélectionnée(s).
                    {totalEstimate > 0 && (
                        <div style={{ marginTop: 4, color: "var(--color-muted)", fontSize: 13 }}>
                            Montant estimé : <strong>{totalEstimate.toFixed(2)} € HT</strong>
                        </div>
                    )}
                </div>
                <div>
                    <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
                        Taux horaire uniforme (optionnel, remplace les taux individuels)
                    </label>
                    <InputNumber
                        min={0}
                        step={5}
                        value={invoiceRateOverride}
                        onChange={setInvoiceRateOverride}
                        addonAfter="€/h"
                        style={{ width: "100%" }}
                        placeholder="Laisser vide pour utiliser les taux des projets"
                    />
                </div>
            </Modal>
        </PageContainer>
    );
}
