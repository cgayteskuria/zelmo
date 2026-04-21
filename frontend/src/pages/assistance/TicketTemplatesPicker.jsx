import { useState, useCallback, useEffect, useRef } from "react";
import { Button, Input, Popover, Typography, Empty, Spin } from "antd";
import { FileTextOutlined, SearchOutlined } from "@ant-design/icons";
import { ticketsApi } from "../../services/api";

const { Text } = Typography;

/**
 * TicketTemplatesPicker – Bouton ouvrant un popover de recherche dans les templates de messages.
 * Quand l'utilisateur clique sur un template, son corps HTML est injecté dans le compositeur
 * via le callback `onSelect(body)`.
 */
export default function TicketTemplatesPicker({ onSelect }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const searchRef = useRef(null);

    // Charger les templates dès l'ouverture (et quand la recherche change)
    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await ticketsApi.getMessageTemplates({ search, emt_category: "ticket_reply" });
                setTemplates((res.data || []).filter((t) => t.category === "ticket_reply" || !t.category));
            } catch {
                // silencieux
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search, open]);

    const handleOpen = useCallback((vis) => {
        setOpen(vis);
        if (vis) {
            setSearch("");
            setTimeout(() => searchRef.current?.focus(), 100);
        }
    }, []);

    const handleSelect = useCallback((template) => {
        onSelect?.(template.body);
        setOpen(false);
    }, [onSelect]);

    const content = (
        <div style={{ width: 340 }}>
            <Input
                ref={searchRef}
                prefix={<SearchOutlined />}
                placeholder="Rechercher un template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 8 }}
            />
            <Spin spinning={loading}>
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {templates.length === 0 && !loading && (
                        <Empty description="Aucun template" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: "12px 0" }} />
                    )}
                    {templates.map((item) => (
                        <div
                            key={item.id}
                            style={{ cursor: "pointer", padding: "6px 8px", borderRadius: 4 }}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}
                        >
                            <Text style={{ fontSize: 13 }}>{item.name}</Text>
                        </div>
                    ))}
                </div>
            </Spin>
        </div>
    );

    return (
        <Popover
            content={content}
            title="Templates de réponse"
            trigger="click"
            open={open}
            onOpenChange={handleOpen}
            placement="topLeft"
            overlayStyle={{ zIndex: 1100 }}
        >
            <Button              
                icon={<FileTextOutlined />}
                title="Insérer un template"
            >
                Modèle
            </Button>
        </Popover>
    );
}
