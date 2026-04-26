import { useState, useEffect, useCallback } from "react";
import {
    Table, Tag, Button, Space, Badge, Select, Tooltip, Modal,
    Descriptions, Popconfirm, Alert
} from "antd";
import {
    CheckCircleOutlined, CloseCircleOutlined, ImportOutlined,
    EyeOutlined, ReloadOutlined, InboxOutlined
} from "@ant-design/icons";
import { message } from "../../utils/antdStatic";
import { eInvoicingApi } from "../../services/apiEInvoicing";
import PageContainer from "../../components/common/PageContainer";
import dayjs from "dayjs";

const STATUS_OPTIONS = [
    { value: "", label: "Tous les statuts" },
    { value: "PENDING", label: "En attente" },
    { value: "ACCEPTEE", label: "Acceptée" },
    { value: "REFUSEE", label: "Refusée" },
    { value: "EN_PAIEMENT", label: "En paiement" },
];

const STATUS_COLOR = {
    PENDING:      "default",
    DEPOSEE:      "default",
    QUALIFIEE:    "processing",
    MISE_A_DISPO: "processing",
    ACCEPTEE:     "success",
    PAYEE:        "success",
    REFUSEE:      "error",
    LITIGE:       "error",
    EN_PAIEMENT:  "warning",
};

const STATUS_LABEL = {
    PENDING:      "En attente",
    DEPOSEE:      "Déposée",
    QUALIFIEE:    "Qualifiée",
    MISE_A_DISPO: "Mise à disposition",
    ACCEPTEE:     "Acceptée",
    PAYEE:        "Payée",
    REFUSEE:      "Refusée",
    LITIGE:       "Litige",
    EN_PAIEMENT:  "En paiement",
};

export default function EInvoicingInbox() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [statusFilter, setStatusFilter] = useState("");
    const [importedFilter, setImportedFilter] = useState("");
    const [detailRecord, setDetailRecord] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (importedFilter !== "") params.imported = importedFilter;
            const res = await eInvoicingApi.listReceived(params);
            setData(res.data?.data ?? []);
        } catch {
            message.error("Erreur lors du chargement de la boîte de réception.");
        } finally {
            setLoading(false);
        }
    }, [statusFilter, importedFilter]);

    useEffect(() => { load(); }, [load]);

    const handleUpdateStatus = async (id, status) => {
        setActionLoading(`status-${id}-${status}`);
        try {
            await eInvoicingApi.updateReceivedStatus(id, status);
            message.success("Statut mis à jour.");
            load();
        } catch {
            message.error("Erreur lors de la mise à jour du statut.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleImport = async (id) => {
        setActionLoading(`import-${id}`);
        try {
            const res = await eInvoicingApi.importReceived(id);
            message.success("Facture importée avec succès. Une facture fournisseur brouillon a été créée.");
            load();
        } catch (err) {
            message.error(err?.response?.data?.message ?? "Erreur lors de l'import.");
        } finally {
            setActionLoading(null);
        }
    };

    const columns = [
        {
            title: "Émetteur",
            key: "sender",
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    <span style={{ fontWeight: 500 }}>{r.eir_sender_name ?? "—"}</span>
                    <span style={{ fontSize: 12, color: "#888" }}>SIREN : {r.eir_sender_siren ?? "—"}</span>
                </Space>
            ),
        },
        {
            title: "N° facture",
            dataIndex: "eir_invoice_number",
            render: (v) => v ?? "—",
        },
        {
            title: "Date",
            dataIndex: "eir_invoice_date",
            render: (v) => v ? dayjs(v).format("DD/MM/YYYY") : "—",
            sorter: (a, b) => (a.eir_invoice_date ?? "").localeCompare(b.eir_invoice_date ?? ""),
        },
        {
            title: "Montant HT",
            dataIndex: "eir_amount_ht",
            align: "right",
            render: (v) => v != null ? `${parseFloat(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—",
        },
        {
            title: "Montant TTC",
            dataIndex: "eir_amount_ttc",
            align: "right",
            render: (v) => v != null ? `${parseFloat(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—",
        },
        {
            title: "Reçue le",
            dataIndex: "eir_created",
            render: (v) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
        },
        {
            title: "Statut",
            key: "status",
            render: (_, r) => (
                <Space direction="vertical" size={2}>
                    <Tag color={STATUS_COLOR[r.eir_our_status] ?? "default"}>
                        {STATUS_LABEL[r.eir_our_status] ?? r.eir_our_status ?? "—"}
                    </Tag>
                    {r.eir_imported_at && (
                        <Tag color="success" style={{ fontSize: 11 }}>Importée</Tag>
                    )}
                </Space>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            align: "right",
            render: (_, r) => (
                <Space wrap>
                    <Tooltip title="Voir le détail">
                        <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => setDetailRecord(r)}
                        />
                    </Tooltip>
                    {!r.eir_imported_at && (
                        <Popconfirm
                            title="Importer cette facture ?"
                            description="Une facture fournisseur brouillon sera créée."
                            onConfirm={() => handleImport(r.eir_id)}
                            okText="Importer"
                            cancelText="Annuler"
                        >
                            <Button
                                size="small"
                                icon={<ImportOutlined />}
                                loading={actionLoading === `import-${r.eir_id}`}
                            >
                                Importer
                            </Button>
                        </Popconfirm>
                    )}
                    {r.eir_our_status !== "ACCEPTEE" && (
                        <Button
                            size="small"
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            loading={actionLoading === `status-${r.eir_id}-ACCEPTEE`}
                            onClick={() => handleUpdateStatus(r.eir_id, "ACCEPTEE")}
                        >
                            Accepter
                        </Button>
                    )}
                    {r.eir_our_status !== "REFUSEE" && (
                        <Button
                            size="small"
                            danger
                            icon={<CloseCircleOutlined />}
                            loading={actionLoading === `status-${r.eir_id}-REFUSEE`}
                            onClick={() => handleUpdateStatus(r.eir_id, "REFUSEE")}
                        >
                            Refuser
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const pendingCount = data.filter(
        (r) => !r.eir_imported_at && r.eir_our_status !== "ACCEPTEE" && r.eir_our_status !== "REFUSEE"
    ).length;

    return (
        <PageContainer
            title={
                <Space>
                    <InboxOutlined />
                    Boîte de réception e-facturation
                    {pendingCount > 0 && (
                        <Badge count={pendingCount} />
                    )}
                </Space>
            }
            actions={
                <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                    Actualiser
                </Button>
            }
        >
            <Space style={{ marginBottom: 16 }}>
                <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={STATUS_OPTIONS}
                    style={{ width: 200 }}
                    placeholder="Filtrer par statut"
                />
                <Select
                    value={importedFilter}
                    onChange={setImportedFilter}
                    options={[
                        { value: "", label: "Toutes" },
                        { value: "0", label: "Non importées" },
                        { value: "1", label: "Importées" },
                    ]}
                    style={{ width: 160 }}
                    placeholder="Import"
                />
            </Space>

            {pendingCount > 0 && (
                <Alert
                    type="warning"
                    message={`${pendingCount} facture${pendingCount > 1 ? "s" : ""} en attente d'action`}
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Table
                dataSource={data}
                columns={columns}
                rowKey="eir_id"
                loading={loading}
                size="small"
                pagination={{ pageSize: 20 }}
            />

            <Modal
                title="Détail de la facture reçue"
                open={!!detailRecord}
                onCancel={() => setDetailRecord(null)}
                footer={<Button onClick={() => setDetailRecord(null)}>Fermer</Button>}
                width={700}
            >
                {detailRecord && (
                    <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="Émetteur" span={2}>{detailRecord.eir_sender_name}</Descriptions.Item>
                        <Descriptions.Item label="SIREN">{detailRecord.eir_sender_siren}</Descriptions.Item>
                        <Descriptions.Item label="SIRET">{detailRecord.eir_sender_siret}</Descriptions.Item>
                        <Descriptions.Item label="N° facture">{detailRecord.eir_invoice_number}</Descriptions.Item>
                        <Descriptions.Item label="Date">{detailRecord.eir_invoice_date ? dayjs(detailRecord.eir_invoice_date).format("DD/MM/YYYY") : "—"}</Descriptions.Item>
                        <Descriptions.Item label="Échéance">{detailRecord.eir_due_date ? dayjs(detailRecord.eir_due_date).format("DD/MM/YYYY") : "—"}</Descriptions.Item>
                        <Descriptions.Item label="Montant HT">{detailRecord.eir_amount_ht != null ? `${parseFloat(detailRecord.eir_amount_ht).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—"}</Descriptions.Item>
                        <Descriptions.Item label="Montant TTC">{detailRecord.eir_amount_ttc != null ? `${parseFloat(detailRecord.eir_amount_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—"}</Descriptions.Item>
                        <Descriptions.Item label="Statut PA">{detailRecord.eir_pa_status}</Descriptions.Item>
                        <Descriptions.Item label="Notre statut">
                            <Tag color={STATUS_COLOR[detailRecord.eir_our_status] ?? "default"}>
                                {STATUS_LABEL[detailRecord.eir_our_status] ?? detailRecord.eir_our_status}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Reçue le">{detailRecord.eir_created ? dayjs(detailRecord.eir_created).format("DD/MM/YYYY HH:mm") : "—"}</Descriptions.Item>
                        <Descriptions.Item label="Importée le">{detailRecord.eir_imported_at ? dayjs(detailRecord.eir_imported_at).format("DD/MM/YYYY HH:mm") : "Non importée"}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </PageContainer>
    );
}
