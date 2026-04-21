import { useState, useCallback, useEffect } from "react";
import { Modal, Input, Tag, Button, Spin, Typography, Space, Alert } from "antd";
import { MergeCellsOutlined, SearchOutlined } from "@ant-design/icons";
import { ticketsApi } from "../../services/api";
import { TICKET_STATUS_COLORS } from "../../configs/TicketConfig";

const { Text } = Typography;

/**
 * TicketMergeModal – Recherche un ticket cible et fusionne le ticket courant dedans.
 * Tous les articles du ticket courant sont déplacés vers le ticket cible,
 * puis le ticket courant est marqué comme fusionné.
 */
export default function TicketMergeModal({ open, ticketId, ticketLabel, onMerged, onClose }) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [merging, setMerging] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);

    // Recherche avec debounce
    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await ticketsApi.search({ search, exclude_id: ticketId });
                setResults(res.data || []);
            } catch {
                // silencieux
            } finally {
                setLoading(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [search, open, ticketId]);

    const handleOpen = useCallback(() => {
        setSearch("");
        setResults([]);
        setSelectedTicket(null);
    }, []);

    const handleMerge = useCallback(async () => {
        if (!selectedTicket) return;
        setMerging(true);
        try {
            await ticketsApi.merge(ticketId, selectedTicket.id);
            onMerged?.(selectedTicket.id);
        } catch {
            // Erreurs gérées par l'intercepteur Axios
        } finally {
            setMerging(false);
        }
    }, [selectedTicket, ticketId, onMerged]);

    return (
        <Modal
            open={open}
            onCancel={onClose}
            afterOpenChange={(vis) => vis && handleOpen()}
            title={
                <Space>
                    <MergeCellsOutlined />
                    Fusionner le dossier #{ticketId}
                </Space>
            }
            footer={[
                <Button key="cancel" onClick={onClose}>Annuler</Button>,
                <Button
                    key="merge"
                    type="primary"
                    danger
                    loading={merging}
                    disabled={!selectedTicket}
                    icon={<MergeCellsOutlined />}
                    onClick={handleMerge}
                >
                    Fusionner dans #{selectedTicket?.id}
                </Button>,
            ]}
            width={600}
        >
            <Alert
                type="warning"
                showIcon
                message="Tous les messages du dossier courant seront déplacés vers le dossier cible. Cette opération est irréversible."
                style={{ marginBottom: 16 }}
            />

            <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                Ticket source : <strong>#{ticketId} — {ticketLabel}</strong>
            </Text>

            <Input
                prefix={<SearchOutlined />}
                placeholder="Rechercher par #ID ou objet ou client..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedTicket(null); }}
                autoFocus
                style={{ marginBottom: 12 }}
            />

            <Spin spinning={loading}>
                <div style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    border: "1px solid #d9d9d9",
                    borderRadius: 6,
                }}>
                    {results.length === 0 ? (
                        <div style={{ padding: "12px 16px", color: "#999", textAlign: "center" }}>
                            {search ? "Aucun résultat" : "Tapez pour rechercher..."}
                        </div>
                    ) : results.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                cursor: "pointer",
                                backgroundColor: selectedTicket?.id === item.id ? "#e6f4ff" : undefined,
                                padding: "8px 12px",
                                borderBottom: "1px solid #f0f0f0",
                            }}
                            onClick={() => setSelectedTicket(item)}
                        >
                            <Space style={{ width: "100%", justifyContent: "space-between" }}>
                                <Space>
                                    <Text strong>#{item.id}</Text>
                                    <Text>{item.label}</Text>
                                </Space>
                                <Space>
                                    {item.partner_name && (
                                        <Text type="secondary" style={{ fontSize: 12 }}>{item.partner_name}</Text>
                                    )}
                                    {item.status_label && (
                                        <Tag color={TICKET_STATUS_COLORS[item.status_label] || "default"} style={{ fontSize: 11 }}>
                                            {item.status_label}
                                        </Tag>
                                    )}
                                </Space>
                            </Space>
                        </div>
                    ))}
                </div>
            </Spin>
        </Modal>
    );
}
