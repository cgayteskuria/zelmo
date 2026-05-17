import { useState, useEffect, useCallback } from "react";
import { Timeline, Empty, Spin, Tag, App } from "antd";
import {
    PlusCircleOutlined,
    EditOutlined,
    DeleteOutlined,
    ClockCircleOutlined,
    MailOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { historyApi } from "../../services/api";

const ACTION_CONFIG = {
    created:    { color: "green",  icon: <PlusCircleOutlined />, label: "Création" },
    updated:    { color: "blue",   icon: <EditOutlined />,       label: "Modification" },
    deleted:    { color: "red",    icon: <DeleteOutlined />,     label: "Suppression" },
    email_sent: { color: "purple", icon: <MailOutlined />,       label: "Email envoyé" },
};

function formatValue(field, value, fieldConfig, allChanges) {
    if (value === null || value === undefined) return "—";

    // Formateur personnalisé en priorité (reçoit value + tous les changements du log)
    if (fieldConfig?.formatters?.[field]) {
        const result = fieldConfig.formatters[field](value, allChanges);
        return result ?? "—";
    }

    const str = String(value);
    if (str === "") return "—";

    // URI base64 : masquer le contenu
    if (str.startsWith("data:")) return "(fichier)";

    // Chaîne très longue (JSON, tokens…) : tronquer
    if (str.length > 120) return str.substring(0, 120) + "…";

    // Détection automatique de date ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = dayjs(str);
        if (d.isValid()) {
            return str.length > 10 ? d.format("DD/MM/YYYY HH:mm") : d.format("DD/MM/YYYY");
        }
    }

    return str;
}

export default function HistoryTimeline({ entityType, entityId, refreshKey = 0, fieldConfig }) {
    const { message } = App.useApp();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadHistory = useCallback(async () => {
        if (!entityId) return;
        setLoading(true);
        try {
            const res = await historyApi.getHistory(entityType, entityId, { per_page: 100 });
            setLogs(res.data?.data ?? res.data ?? []);
        } catch {
            message.error("Erreur lors du chargement de l'historique");
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId, refreshKey]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const hidden = fieldConfig?.hidden ?? [];
    const labels = fieldConfig?.labels ?? {};

    const timelineItems = logs.map((log) => {
        const cfg = ACTION_CONFIG[log.log_action] ?? {
            color: "gray",
            icon: <ClockCircleOutlined />,
            label: log.log_action,
        };
        const changes = log.log_details;

        const visibleChanges = changes
            ? Object.entries(changes).filter(([field]) => !hidden.includes(field))
            : [];

        return {
            key: log.log_id,
            color: cfg.color,
            dot: cfg.icon,
            children: (
                <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span>
                            <Tag color={cfg.color}>{cfg.label}</Tag>
                            {log.user_name && (
                                <strong style={{ marginLeft: 4 }}>{log.user_name}</strong>
                            )}
                        </span>
                        <span style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>
                            {dayjs(log.log_created).format("DD/MM/YYYY HH:mm")}
                        </span>
                    </div>

                    {visibleChanges.length > 0 && (
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: 16, fontSize: 12, color: "#555" }}>
                            {visibleChanges.map(([field, diff]) => {
                                const label = labels[field] ?? field;
                                const isChange = diff !== null && typeof diff === "object" && ("old" in diff || "new" in diff);
                                return (
                                    <li key={field}>
                                        <strong>{label}</strong>{" "}
                                        {isChange ? (
                                            <>
                                                <span style={{ color: "#aaa" }}>{formatValue(field, diff.old, fieldConfig, changes)}</span>
                                                {" → "}
                                                <span style={{ color: "#1677ff" }}>{formatValue(field, diff.new, fieldConfig, changes)}</span>
                                            </>
                                        ) : (
                                            <span style={{ color: "#1677ff" }}>{formatValue(field, diff, fieldConfig, changes)}</span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            ),
        };
    });

    return (
        <Spin spinning={loading}>
            {logs.length === 0 && !loading ? (
                <Empty description="Aucun historique disponible" />
            ) : (
                <div style={{ padding: "16px 8px" }}>
                    <Timeline items={timelineItems} />
                </div>
            )}
        </Spin>
    );
}
