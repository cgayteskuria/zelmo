import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useApplications } from "../../hooks/useApplications";
import { ticketsApi, dashboardApi } from "../../services/api";
import AppIcon from "../../components/common/AppIcon";

const DEFAULT_COLOR = "#5f6368";

function colorToGradient(color) {
    const c = color || DEFAULT_COLOR;
    return `linear-gradient(135deg,${c},${c}bb)`;
}

/* ── Shortcuts conditionnels ───────────────────────────────── */
const ALL_SHORTCUTS = [
    { label: "Nouveau ticket",   href: "/tickets/new",          permission: "tickets.create",  color: "#e8f0fe", iconColor: "#1a73e8",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg> },
    { label: "Créer un devis",   href: "/sale-orders/new",      permission: "sales.create",    color: "#fef0e7", iconColor: "#fa7b17",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z"/></svg> },
    { label: "Ajouter contact",  href: "/contacts/new",         permission: "partners.create", color: "#f3e8fd", iconColor: "#9334e8",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> },
    { label: "Émettre facture",  href: "/invoices/new",         permission: "invoices.create", color: "#e0f7fa", iconColor: "#00829b",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2z"/></svg> },
    { label: "Commande achat",   href: "/purchase-orders/new",  permission: "purchases.create",color: "#e6f4ea", iconColor: "#34a853",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 23.43 5H5.21l-.94-2H1z"/></svg> },
    { label: "Note de frais",    href: "/expenses/new",         permission: "expenses.create", color: "#fce8e6", iconColor: "#ea4335",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg> },
];

/* ── Date formatée ─────────────────────────────────────────── */
function useFormattedDate() {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const weekday = now.toLocaleDateString("fr-FR", { weekday: "long" });
    return { day, month: month.charAt(0).toUpperCase() + month.slice(1), weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1) };
}

/* ── Date relative ────────────────────────────────────────── */
function relativeDate(dateStr) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "À l'instant";
    if (m < 60) return `Il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Hier";
    if (d < 7) return `Il y a ${d} j`;
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/* ── Salutation selon l'heure ─────────────────────────────── */
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user, can } = useAuth();
    const { applications } = useApplications();
    const { day, month, weekday } = useFormattedDate();

    const [ticketCounts, setTicketCounts] = useState(null);
    const [activity, setActivity] = useState([]);

    useEffect(() => {
        if (can("tickets.view")) {
            ticketsApi.sidebarCounts().then(setTicketCounts).catch(() => {});
        }
        dashboardApi.activity().then(setActivity).catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const firstName = user?.firstname || user?.usr_firstname || user?.login || "vous";
    const shortcuts = ALL_SHORTCUTS.filter(s => can(s.permission));

    return (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", background: "var(--bg-content)" }}>

            {/* ── HERO ───────────────────────────────────────────── */}
            <div style={{ padding: "40px 40px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)", margin: 0, lineHeight: 1.2, fontFamily: "var(--font)" }}>
                        {getGreeting()},{" "}
                        <span style={{ background: "linear-gradient(135deg,var(--color-active),#9334e8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                            {firstName}
                        </span>
                    </h1>
                    <p style={{ marginTop: 6, fontSize: 16, color: "var(--color-muted)", fontFamily: "var(--font)" }}>
                        Voici un résumé de votre activité.
                    </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 36, fontWeight: 700, color: "var(--color-text)", lineHeight: 1 }}>{day}</div>
                    <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{month} · {weekday}</div>
                </div>
            </div>

            {/* ── KPI STRIP (uniquement si accès tickets) ─────────── */}
            {can("tickets.view") && ticketCounts && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, padding: "0 40px 24px", flexShrink: 0 }}>
                    {ticketCounts.statuses.map(s => (
                        <div
                            key={s.id}
                            onClick={() => navigate(`/tickets?status_id=${s.id}&label=${encodeURIComponent(s.label)}`)}
                            style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", padding: "16px 20px", cursor: "pointer", position: "relative", overflow: "hidden", transition: "box-shadow 0.15s ease, transform 0.15s ease" }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                        >
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "var(--radius-card) var(--radius-card) 0 0", background: s.color || "var(--color-active)" }} />
                            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)", lineHeight: 1 }}>{s.count}</div>
                            <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── MODULES GRID ────────────────────────────────────── */}
            <div style={{ padding: "0 40px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", fontFamily: "var(--font)" }}>Mes modules</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
                    {applications.map(app => {
                        const gradient = colorToGradient(app.app_color);
                        const desc = app.app_description ?? "";
                        return (
                            <div
                                key={app.app_id}
                                onClick={() => navigate(app.app_root_href)}
                                style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "hidden", cursor: "pointer", background: "#fff", display: "flex", flexDirection: "column", transition: "box-shadow 0.15s ease, transform 0.15s ease" }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                            >
                                <div style={{ padding: "20px", display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
                                    <AppIcon icon={app.app_icon} size={65} alt={app.app_lib} />                                    
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 4, fontFamily: "var(--font)" }}>{app.app_lib}</div>
                                        {desc && <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.45 }}>{desc}</div>}
                                    </div>
                                </div>
                                <div style={{ borderTop: "1px solid var(--color-border)", padding: "8px 20px", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                                    <span style={{ fontSize: 12, color: "var(--color-active)", fontWeight: 500 }}>Ouvrir →</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── ACTIVITÉ RÉCENTE + RACCOURCIS ───────────────────── */}
            {(activity.length > 0 || shortcuts.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: shortcuts.length > 0 ? "1fr 360px" : "1fr", gap: 16, padding: "24px 40px 40px", flexShrink: 0 }}>

                    {/* Activité récente */}
                    {activity.length > 0 && (
                        <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--bg-surface)" }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", fontFamily: "var(--font)" }}>Activité récente</span>
                            </div>
                            <div>
                                {activity.map((item, i) => (
                                    <div
                                        key={i}
                                        onClick={() => navigate(item.href)}
                                        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px", cursor: "pointer", borderBottom: i < activity.length - 1 ? "1px solid #f5f5f5" : "none", transition: "background 0.15s" }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                    >
                                        {/* Avatar initiales */}
                                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${item.mod_color}18`, color: item.mod_color, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                            {item.initials}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.4 }}>
                                                <strong style={{ fontWeight: 600 }}>{item.author}</strong>
                                                {" — "}
                                                <em style={{ color: "var(--color-muted)" }}>{item.label}</em>
                                                {" "}
                                                <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: `${item.mod_color}18`, color: item.mod_color, marginLeft: 2, verticalAlign: "middle" }}>
                                                    {item.module}
                                                </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                                                {item.partner && <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{item.partner}</span>}
                                                {item.status && (
                                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: `${item.color || "#ccc"}22`, color: item.color || "var(--color-muted)" }}>
                                                        {item.status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 11, color: "var(--color-muted)", flexShrink: 0, marginTop: 2 }}>
                                            {relativeDate(item.date)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Raccourcis rapides */}
                    {shortcuts.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
                                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--bg-surface)" }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", fontFamily: "var(--font)" }}>Raccourcis rapides</span>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--color-border)" }}>
                                    {shortcuts.map(s => (
                                        <button
                                            key={s.href}
                                            onClick={() => navigate(s.href)}
                                            style={{ background: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 13, color: "var(--color-text)", transition: "background 0.15s", textAlign: "left" }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                                        >
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: s.iconColor }}>
                                                {s.icon}
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{s.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}


        </div>
    );
}
