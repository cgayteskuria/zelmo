import { Tag } from "antd";

/**
 * Configuration du module Ticket (Assistance)
 * Couleurs des statuts basees sur l'ancien code PHP TicketEntity.php
 */

export const TICKET_STATUS_COLORS = {
    "Nouveau":                  "red",
    "Ouvert":                   "gold",
    "Planifié":                 "cyan",
    "Attente interv. sur site": "orange",
    "Attente retour":           "orange",
    "Clos":                     "green",
};

/**
 * Formatter pour la colonne statut 
 */
export const formatTicketStatus = (params) => {
    const label = (params !== null && typeof params === "object") ? params.value : params;
    if (!label) return null;
    const color = TICKET_STATUS_COLORS[label] || "default";
    return <Tag color={color}>{label}</Tag>;
};

/**
 * Types d'articles
 */
export const ARTICLE_TYPE = {
    RESPONSE: 0,
    NOTE: 1,
};

/**
 * Couleurs et alignement des bulles du thread (style SMS/email)
 * - from_contact : message reçu d'un contact client (fk_ctc_id_from set, is_note=0) → gauche, bleu
 * - from_agent   : réponse d'un agent interne (fk_usr_id set, is_note=0) → droite, vert
 * - note         : note interne (tka_is_note=1) → centré, ambre
 */
export const ARTICLE_COLORS = {
    from_contact: { bg: '#e6f4ff', border: '#1677ff', side: 'left' },
    from_agent:   { bg: '#f6ffed', border: '#52c41a', side: 'right' },
    note:         { bg: '#fffbe6', border: '#faad14', side: 'center' },
};

/**
 * Détermine le type d'un article pour l'affichage thread
 */
export const getArticleDisplayType = (article) => {
    if (article.tka_is_note === 1) return 'note';
    if (article.fk_ctc_id_from) return 'from_contact';
    return 'from_agent';
};
