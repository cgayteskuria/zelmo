import { useState, useCallback, useEffect } from "react";
import { Button, Select, Tag, Typography, Popconfirm, Space, Spin } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { ticketsApi } from "../../services/api";
import { TICKET_STATUS_COLORS } from "../../configs/TicketConfig";
import CanAccess from "../../components/common/CanAccess";

const { Text } = Typography;

const LINK_TYPES = [
    { value: "related", label: "Lié à" },
    { value: "blocks", label: "Bloque" },
    { value: "blocked_by", label: "Bloqué par" },
    { value: "duplicate", label: "Doublon de" },
    { value: "child", label: "Sous-ticket de" },
];

/**
 * TicketLinksPanel – Panneau latéral listant les tickets liés avec possibilité d'en ajouter.
 */
export default function TicketLinksPanel({ ticketId }) {
    const navigate = useNavigate();
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [linkType, setLinkType] = useState("related");
    const [saving, setSaving] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    const loadLinks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await ticketsApi.getLinks(ticketId);
            setLinks(res.data || []);
        } catch {
            // silencieux
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        loadLinks();
    }, [loadLinks]);

    const handleSearch = useCallback(async (val) => {
        if (!val || val.length < 1) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            const res = await ticketsApi.search({ search: val, exclude_id: ticketId });
            setSearchResults((res.data || []).map((t) => ({
                value: t.id,
                label: `#${t.id} — ${t.label}${t.partner_name ? ` (${t.partner_name})` : ""}`,
            })));
        } catch {
            // silencieux
        } finally {
            setSearchLoading(false);
        }
    }, [ticketId]);

    const handleAdd = useCallback(async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            await ticketsApi.createLink(ticketId, { fk_tkt_id_to: selectedId, tkl_type: linkType });
            setAdding(false);
            setSelectedId(null);
            setSearchResults([]);
            loadLinks();
        } catch {
            // silencieux
        } finally {
            setSaving(false);
        }
    }, [selectedId, linkType, ticketId, loadLinks]);

    const handleDelete = useCallback(async (linkId) => {
        try {
            await ticketsApi.deleteLink(ticketId, linkId);
            loadLinks();
        } catch {
            // silencieux
        }
    }, [ticketId, loadLinks]);

    return (
        <div>
            {/* En-tête section avec bouton + */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, paddingBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Tickets liés
                </span>
                <CanAccess permission="tickets.create">
                    <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setAdding((v) => !v)} />
                </CanAccess>
            </div>

            {adding && (
                <div style={{ marginBottom: 8, padding: "8px", background: "#fff", borderRadius: 6, border: "1px solid #e8e8e8" }}>
                    <Select
                        showSearch
                        value={selectedId}
                        placeholder="Rechercher un ticket..."
                        filterOption={false}
                        onSearch={handleSearch}
                        onChange={setSelectedId}
                        loading={searchLoading}
                        options={searchResults}
                        style={{ width: "100%", marginBottom: 6 }}
                        size="small"
                    />
                    <Select
                        value={linkType}
                        onChange={setLinkType}
                        options={LINK_TYPES}
                        style={{ width: "100%", marginBottom: 6 }}
                        size="small"
                    />
                    <Space>
                        <Button size="small" type="primary" loading={saving} onClick={handleAdd} disabled={!selectedId}>Lier</Button>
                        <Button size="small" onClick={() => { setAdding(false); setSelectedId(null); }}>Annuler</Button>
                    </Space>
                </div>
            )}

            <Spin spinning={loading} size="small">
                {links.length === 0 && !loading && (
                    <Text type="secondary" style={{ fontSize: 11 }}>Aucun ticket lié</Text>
                )}
                {links.map((link) => (
                    <div key={link.tkl_id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 0", borderBottom: "1px solid #f5f5f5", minWidth: 0 }}>
                        {/* Numéro cliquable */}
                        <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: "auto", fontSize: 11, fontWeight: 600, flexShrink: 0 }}
                            onClick={() => navigate(`/tickets/${link.ticket?.tkt_id}`)}
                        >
                            TK-{link.ticket?.tkt_id}
                        </Button>
                        {/* Label avec ellipsis */}
                        <span
                            style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, color: "#555" }}
                            title={link.ticket?.tkt_label}
                        >
                            {link.ticket?.tkt_label}
                        </span>
                        {/* Badge statut */}
                        {link.ticket?.status && (
                            <Tag
                                color={TICKET_STATUS_COLORS[link.ticket.status?.tke_label] || "default"}
                                style={{ fontSize: 10, padding: "0 4px", margin: 0, flexShrink: 0, lineHeight: "18px" }}
                            >
                                {link.ticket.status?.tke_label}
                            </Tag>
                        )}
                        {/* Supprimer */}
                        <CanAccess permission="tickets.delete">
                            <Popconfirm title="Supprimer ce lien ?" onConfirm={() => handleDelete(link.tkl_id)} okText="Oui" cancelText="Non">
                                <Button type="text" danger icon={<DeleteOutlined />} size="small" style={{ flexShrink: 0 }} />
                            </Popconfirm>
                        </CanAccess>
                    </div>
                ))}
            </Spin>
        </div>
    );
}
