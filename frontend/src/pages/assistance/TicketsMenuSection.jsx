import { useState, useEffect, useCallback } from "react";
import { Tag } from "antd";
import * as AntIcons from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { ticketsApi } from "../../services/api";

/**
 * TicketsMenuSection – Section dynamique injectée dans la sidebar
 * pour le module assistance. Affiche :
 *  - "Mes tickets" avec compteur
 *  - Un item par statut avec icône, compteur coloré (tke_color)
 */

function DynamicIcon({ name }) {
    if (!name) return null;
    const IconComponent = AntIcons[name];
    return IconComponent ? <IconComponent /> : null;
}

export default function TicketsMenuSection() {
    const navigate = useNavigate();
    const location = useLocation();
    const [counts, setCounts] = useState(null);

    const loadCounts = useCallback(async () => {
        try {
            const res = await ticketsApi.sidebarCounts();
            setCounts(res);
        } catch {
            // silencieux
        }
    }, []);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    const urlParams = new URLSearchParams(location.search);
    const activeStatusId = urlParams.get("status_id");
    const isMine = urlParams.get("mine") === "1";

    const navItem = (key, isActive, icon, label, count, color, onClick) => (
        <button
            key={key}
            className={`nav-item${isActive ? " active" : ""}`}
            onClick={onClick}
        >
            {icon && <span className="nav-icon" style={{ fontSize: 16 }}>{icon}</span>}
            <span style={{ flex: 1 }}>{label}</span>
            {count > 0 && (
                <Tag
                    color={color || "default"}
                    style={{ margin: 0, fontSize: 11, lineHeight: "18px", padding: "0 5px", flexShrink: 0 }}
                >
                    {count}
                </Tag>
            )}
        </button>
    );

    return (
        <div style={{ marginTop: 4 }}>
            <div className="section-label">Dossiers</div>

            {navItem(
                "mine",
                isMine,
                <AntIcons.UserOutlined />,
                "Mes tickets",
                counts?.mine ?? 0,
                "#1677ff",
                () => navigate("/tickets?mine=1")
            )}

            {counts?.statuses?.map((s) =>
                navItem(
                    `status_${s.id}`,
                    activeStatusId === String(s.id),
                    <DynamicIcon name={s.icon} />,
                    s.label,
                    s.count,
                    s.color || "default",
                    () => navigate(`/tickets?status_id=${s.id}&label=${encodeURIComponent(s.label)}`)
                )
            )}
        </div>
    );
}
