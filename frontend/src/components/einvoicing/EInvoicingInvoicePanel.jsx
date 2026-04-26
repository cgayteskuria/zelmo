import { useState, useEffect, useCallback } from "react";
import {
    Space, Button, Tag, Typography, Timeline, Spin, Alert, Descriptions, Divider
} from "antd";
import {
    CheckCircleOutlined, CloseCircleOutlined, CloudDownloadOutlined,
    ReloadOutlined, ClockCircleOutlined
} from "@ant-design/icons";
import { eInvoicingApi } from "../../services/apiEInvoicing";
import { message } from "../../utils/antdStatic";

const { Text } = Typography;

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
    ERROR:        "error",
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
    ERROR:        "Erreur",
};

// Ordered statuses for the timeline
const STATUS_ORDER = [
    "PENDING", "DEPOSEE", "QUALIFIEE", "MISE_A_DISPO",
    "ACCEPTEE", "EN_PAIEMENT", "PAYEE",
];

export default function EInvoicingInvoicePanel({ invoiceId, invOperation }) {
    const [loading, setLoading] = useState(true);
    const [transmission, setTransmission] = useState(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const isCustomerInvoice = invOperation === 1 || invOperation === 2;
    const isReceivedSupplier = invOperation === 3;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await eInvoicingApi.getTransmissionStatus(invoiceId);
            setTransmission(res.data?.data ?? null);
        } catch {
            setTransmission(null);
        } finally {
            setLoading(false);
        }
    }, [invoiceId]);

    useEffect(() => { load(); }, [load]);

    const handleDownload = async () => {
        try {
            const res = await eInvoicingApi.downloadFactureX(invoiceId);
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `facture-x-${invoiceId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            message.error("Impossible de télécharger le fichier Facture-X.");
        }
    };

    const handleUpdateStatus = async (status) => {
        setUpdatingStatus(true);
        try {
            await eInvoicingApi.updateReceivedStatus(invoiceId, status);
            message.success("Statut mis à jour.");
            load();
        } catch {
            message.error("Erreur lors de la mise à jour du statut.");
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (loading) return <Spin style={{ display: "block", marginTop: 32 }} />;

    if (!transmission) {
        return (
            <Alert
                type="info"
                message="Aucune transmission e-facturation trouvée pour cette facture."
                showIcon
                style={{ margin: 16 }}
            />
        );
    }

    const currentStatus = transmission.status ?? "PENDING";
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);

    const timelineItems = STATUS_ORDER
        .filter(s => !["EN_PAIEMENT", "PAYEE"].includes(s) || ["EN_PAIEMENT", "PAYEE"].includes(currentStatus))
        .map((s, idx) => {
            const isPast = currentIdx > idx;
            const isCurrent = s === currentStatus;
            const isRefused = currentStatus === "REFUSEE" || currentStatus === "LITIGE" || currentStatus === "ERROR";
            return {
                color: isCurrent
                    ? (isRefused ? "red" : "blue")
                    : isPast ? "green" : "gray",
                dot: isCurrent && isRefused ? <CloseCircleOutlined /> : isCurrent ? <ClockCircleOutlined /> : undefined,
                children: (
                    <Space>
                        <Text strong={isCurrent}>{STATUS_LABEL[s] ?? s}</Text>
                        {isCurrent && (
                            <Tag color={STATUS_COLOR[currentStatus] ?? "default"}>
                                {STATUS_LABEL[currentStatus] ?? currentStatus}
                            </Tag>
                        )}
                    </Space>
                ),
            };
        });

    if (currentStatus === "REFUSEE" || currentStatus === "LITIGE" || currentStatus === "ERROR") {
        timelineItems.push({
            color: "red",
            dot: <CloseCircleOutlined />,
            children: (
                <Space>
                    <Text strong>{STATUS_LABEL[currentStatus] ?? currentStatus}</Text>
                    {transmission.error_message && (
                        <Text type="danger" style={{ fontSize: 12 }}>
                            — {transmission.error_message}
                        </Text>
                    )}
                </Space>
            ),
        });
    }

    return (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Descriptions
                size="small"
                column={2}
                items={[
                    { label: "Statut PA", children: <Tag color={STATUS_COLOR[currentStatus] ?? "default"}>{STATUS_LABEL[currentStatus] ?? currentStatus}</Tag> },
                    { label: "ID transmis", children: <Text code>{transmission.pa_invoice_id ?? "—"}</Text> },
                    { label: "Transmis le", children: transmission.transmitted_at ?? "—" },
                    { label: "Dernière mise à jour", children: transmission.last_event_at ?? "—" },
                ]}
            />

            <Divider style={{ margin: "8px 0" }} />

            <Timeline items={timelineItems} />

            {transmission.error_message && (
                <Alert type="error" message={transmission.error_message} showIcon />
            )}

            <Space wrap>
                {isCustomerInvoice && (
                    <Button icon={<CloudDownloadOutlined />} onClick={handleDownload}>
                        Télécharger Facture-X
                    </Button>
                )}
                {isReceivedSupplier && (
                    <>
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleUpdateStatus("ACCEPTEE")}
                            loading={updatingStatus}
                            disabled={currentStatus === "ACCEPTEE"}
                        >
                            Accepter
                        </Button>
                        <Button
                            danger
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleUpdateStatus("REFUSEE")}
                            loading={updatingStatus}
                            disabled={currentStatus === "REFUSEE"}
                        >
                            Refuser
                        </Button>
                        <Button
                            onClick={() => handleUpdateStatus("EN_PAIEMENT")}
                            loading={updatingStatus}
                            disabled={currentStatus === "EN_PAIEMENT"}
                        >
                            Marquer en paiement
                        </Button>
                    </>
                )}
                <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                    Actualiser
                </Button>
            </Space>
        </Space>
    );
}
