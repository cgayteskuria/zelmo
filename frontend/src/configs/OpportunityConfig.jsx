import { Tag } from "antd";
import {
    PhoneOutlined,
    MailOutlined,
    TeamOutlined,
    FileTextOutlined,
    CheckSquareOutlined,
} from "@ant-design/icons";

/**
 * Configuration du module Prospection / Opportunités
 */

// Types d'activités
export const ACTIVITY_TYPES = {
    call: { label: "Appel", icon: <PhoneOutlined />, color: "#1677ff", default: "1" },
    email: { label: "Email", icon: <MailOutlined />, color: "#13c2c2" },
    meeting: { label: "Réunion", icon: <TeamOutlined />, color: "#722ed1" },
    note: { label: "Note", icon: <FileTextOutlined />, color: "#faad14" },
    task: { label: "Tâche", icon: <CheckSquareOutlined />, color: "#52c41a" },
};

export const getDefaultActivityType = () =>
    Object.entries(ACTIVITY_TYPES).find(([, config]) => config.default)?.[0];
/**
 * Formatter pour la colonne étape du pipeline (Tag coloré)
 */
export const formatPipelineStage = (label, color) => {
    if (!label) return null;
    return <Tag color={color || "default"}>{label}</Tag>;
};

/**
 * Formatter pour la probabilité (barre de progression)
 */
export const formatProbability = (value) => {
    if (value === null || value === undefined) return null;
    const color = value >= 60 ? "#52c41a" : value >= 30 ? "#faad14" : "#ff4d4f";
    return <span style={{ color, fontWeight: 500 }}>{value}%</span>;
};

/**
 * Formatter pour le type d'activité (icône + label)
 */
export const formatActivityType = (type) => {
    const config = ACTIVITY_TYPES[type];
    if (!config) return type;
    return (
        <span style={{ color: config.color }}>
            {config.icon} {config.label}
        </span>
    );
};

/**
 * Options pour le select de type d'activité
 */
export const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPES).map(([value, config]) => ({
    value,
    label: config.label,
}));
