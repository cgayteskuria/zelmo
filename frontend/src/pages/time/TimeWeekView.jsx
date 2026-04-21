import { useState, useEffect } from "react";
import { Button, Spin } from "antd";
import { LeftOutlined, RightOutlined, PlusOutlined } from "@ant-design/icons";
import { timeEntriesApi } from "../../services/api";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

const DAYS_FR = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES; // 48

function formatDuration(minutes) {
    if (!minutes) return "0h";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function minutesToSlot(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return Math.floor((h * 60 + m) / SLOT_MINUTES);
}

export default function TimeWeekView({ onEntryClick, onCreateEntry }) {
    const [weekStart, setWeekStart] = useState(() => dayjs().isoWeekday(1));
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);

    const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));

    useEffect(() => {
        const from = weekStart.format("YYYY-MM-DD");
        const to   = weekStart.add(6, "day").format("YYYY-MM-DD");
        setLoading(true);
        timeEntriesApi.list({
                "filters[ten_date_gte]": from,
                "filters[ten_date_lte]": to,
                limit: 500,
                grid_key: "time-week-view", // clé isolée pour ne pas polluer time-entries
                sort_by: "ten_date",        // force le skip du chargement des settings sauvegardés
            })
            .then(res => setEntries(res?.data ?? []))
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, [weekStart]);

    // Calcul totaux par jour
    const totalsByDay = days.map(d => {
        const dateStr = d.format("YYYY-MM-DD");
        return entries
            .filter(e => e.ten_date === dateStr)
            .reduce((s, e) => s + (e.ten_duration || 0), 0);
    });

    // Entrées par jour avec position en grille
    const entriesByDay = days.map(d => {
        const dateStr = d.format("YYYY-MM-DD");
        return entries.filter(e => e.ten_date === dateStr).map(entry => {
            const startSlot = entry.ten_start_time ? minutesToSlot(entry.ten_start_time) : null;
            const durationSlots = entry.ten_duration ? Math.max(1, Math.round(entry.ten_duration / SLOT_MINUTES)) : 1;
            return { ...entry, startSlot, durationSlots };
        });
    });

    // Heures affichées (7h à 20h pour ne pas tout afficher)
    const START_HOUR = 7;
    const END_HOUR   = 21;
    const visibleSlots = Array.from(
        { length: (END_HOUR - START_HOUR) * 2 },
        (_, i) => START_HOUR * 2 + i
    );

    return (
        <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
            {/* Navigation semaine */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--bg-surface)" }}>
                <Button icon={<LeftOutlined />} size="small" onClick={() => setWeekStart(w => w.subtract(7, "day"))} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Semaine du {weekStart.format("D MMMM")} au {weekStart.add(6, "day").format("D MMMM YYYY")}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                    <Button size="small" onClick={() => setWeekStart(dayjs().isoWeekday(1))}>Aujourd'hui</Button>
                    <Button icon={<RightOutlined />} size="small" onClick={() => setWeekStart(w => w.add(7, "day"))} />
                </div>
            </div>

            <Spin spinning={loading}>
                <div style={{ display: "flex" }}>
                    {/* Colonne heures */}
                    <div style={{ flexShrink: 0, width: 44, borderRight: "1px solid var(--color-border)" }}>
                        <div style={{ height: 56, borderBottom: "1px solid var(--color-border)" }} />
                        {visibleSlots.map((slot, i) => (
                            i % 2 === 0 ? (
                                <div key={slot} style={{
                                    height: 60, borderBottom: "1px solid #f0f0f0",
                                    display: "flex", alignItems: "flex-start", paddingTop: 2,
                                    justifyContent: "center", fontSize: 10, color: "var(--color-muted)",
                                }}>
                                    {String(Math.floor(slot / 2)).padStart(2, "0")}h
                                </div>
                            ) : (
                                <div key={slot} style={{ height: 60, borderBottom: "1px solid #f8f8f8" }} />
                            )
                        ))}
                    </div>

                    {/* Colonnes jours */}
                    {days.map((day, di) => {
                        const isToday = day.isSame(dayjs(), "day");
                        const dayEntries = entriesByDay[di];
                        const total = totalsByDay[di];

                        return (
                            <div
                                key={di}
                                style={{
                                    flex: 1,
                                    borderRight: di < 6 ? "1px solid var(--color-border)" : "none",
                                    position: "relative",
                                }}
                            >
                                {/* En-tête jour */}
                                <div style={{
                                    height: 56,
                                    borderBottom: "1px solid var(--color-border)",
                                    padding: "6px 8px",
                                    background: isToday ? "#eff6ff" : "transparent",
                                    textAlign: "center",
                                }}>
                                    <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{DAYS_FR[di]}</div>
                                    <div style={{
                                        fontSize: 15, fontWeight: isToday ? 700 : 500,
                                        color: isToday ? "var(--color-active)" : "var(--color-text)",
                                    }}>
                                        {day.format("D")}
                                    </div>
                                    {total > 0 && (
                                        <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 2 }}>
                                            {formatDuration(total)}
                                        </div>
                                    )}
                                </div>

                                {/* Slots */}
                                <div style={{ position: "relative" }}>
                                    {visibleSlots.map((slot, si) => (
                                        <div
                                            key={slot}
                                            style={{
                                                height: 60,
                                                borderBottom: si % 2 === 1 ? "1px solid #f0f0f0" : "1px solid #f8f8f8",
                                                cursor: "pointer",
                                            }}
                                            onClick={() => onCreateEntry?.()}
                                        />
                                    ))}

                                    {/* Entrées positionnées */}
                                    {dayEntries.map(entry => {
                                        if (entry.startSlot === null) return null;
                                        const slotOffset = entry.startSlot - START_HOUR * 2;
                                        if (slotOffset < 0 || slotOffset >= visibleSlots.length) return null;
                                        const top = slotOffset * 60;
                                        const height = Math.max(entry.durationSlots * 60, 28);
                                        const color = entry.tpr_color || "var(--color-active)";

                                        return (
                                            <div
                                                key={entry.ten_id}
                                                onClick={(e) => { e.stopPropagation(); onEntryClick?.(entry); }}
                                                style={{
                                                    position: "absolute",
                                                    top,
                                                    left: 2,
                                                    right: 2,
                                                    height: height - 2,
                                                    background: `${color}22`,
                                                    borderLeft: `3px solid ${color}`,
                                                    borderRadius: 4,
                                                    padding: "2px 4px",
                                                    cursor: "pointer",
                                                    overflow: "hidden",
                                                    zIndex: 2,
                                                }}
                                            >
                                                <div style={{ fontSize: 10, fontWeight: 600, color, lineHeight: 1.3 }}>
                                                    {formatDuration(entry.ten_duration)}
                                                </div>
                                                {height > 40 && (
                                                    <div style={{ fontSize: 10, color: "var(--color-text)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                                        {entry.tpr_lib || entry.ptr_name || entry.ten_description || "—"}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Entrées sans horaire : empilées en bas de l'en-tête */}
                                    {dayEntries.filter(e => e.startSlot === null).map((entry, ei) => (
                                        <div
                                            key={entry.ten_id}
                                            onClick={() => onEntryClick?.(entry)}
                                            style={{
                                                position: "absolute",
                                                top: ei * 24,
                                                left: 2, right: 2,
                                                height: 22,
                                                background: `${entry.tpr_color || "#6366f1"}22`,
                                                borderLeft: `3px solid ${entry.tpr_color || "#6366f1"}`,
                                                borderRadius: 3,
                                                padding: "2px 4px",
                                                fontSize: 10,
                                                cursor: "pointer",
                                                zIndex: 2,
                                                overflow: "hidden",
                                                whiteSpace: "nowrap",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {formatDuration(entry.ten_duration)} {entry.tpr_lib || entry.ten_description || ""}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Spin>
        </div>
    );
}
