import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Button, Tooltip, Spin } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { ACTIVITY_TYPES } from "../../configs/OpportunityConfig";
import { formatDate } from "../../utils/formatters";

const HOUR_HEIGHT = 60; // 1px = 1 minute
const START_HOUR = 7;
const END_HOUR = 20;
const SNAP_MINUTES = 5;
const MAX_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const SHORT_DAY_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const SHORT_MONTH_FR = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function getWeekStart(d) {
    const dow = d.day();
    return (dow === 0 ? d.subtract(6, 'day') : d.subtract(dow - 1, 'day')).startOf('day');
}

function formatWeekRange(start) {
    const end = start.add(6, 'day');
    const sm = SHORT_MONTH_FR[start.month()];
    const em = SHORT_MONTH_FR[end.month()];
    if (start.month() === end.month() && start.year() === end.year())
        return `${start.date()}–${end.date()} ${sm} ${end.year()}`;
    return `${start.date()} ${sm} – ${end.date()} ${em} ${end.year()}`;
}

function snap(min) {
    return Math.round(min / SNAP_MINUTES) * SNAP_MINUTES;
}

function minToTime(day, minutesSinceStart) {
    const total = START_HOUR * 60 + minutesSinceStart;
    return day.hour(Math.floor(total / 60)).minute(total % 60).second(0);
}

function layoutDayActivities(acts) {
    if (!acts || acts.length === 0) return [];

    const items = acts.map(act => {
        const start = dayjs(act.pac_date);
        const end = act.pac_due_date ? dayjs(act.pac_due_date) : start.add(30, 'minute');
        const startMin = Math.max((start.hour() - START_HOUR) * 60 + start.minute(), 0);
        const rawEnd = (end.hour() - START_HOUR) * 60 + end.minute();
        const endMin = Math.max(rawEnd, startMin + 30);
        return { act, startMin, endMin, col: 0, numCols: 1 };
    });

    items.sort((a, b) => a.startMin - b.startMin);

    const colEndTimes = [];
    items.forEach(item => {
        let col = 0;
        while (col < colEndTimes.length && colEndTimes[col] > item.startMin) col++;
        colEndTimes[col] = item.endMin;
        item.col = col;
    });

    items.forEach(item => {
        const overlapping = items.filter(o => o.startMin < item.endMin && o.endMin > item.startMin);
        item.numCols = Math.max(...overlapping.map(o => o.col)) + 1;
    });

    return items.map(item => ({
        ...item,
        top: (item.startMin / 60) * HOUR_HEIGHT,
        height: Math.max(((item.endMin - item.startMin) / 60) * HOUR_HEIGHT, 24),
        left: (item.col / item.numCols) * 100,
        width: (1 / item.numCols) * 100,
    }));
}

/**
 * Calendrier semaine réutilisable pour les activités de prospection.
 *
 * Props:
 *   activities       – tableau d'activités (semaine en cours + éventuels retards)
 *   weekStart        – dayjs, lundi de la semaine affichée
 *   onWeekChange     – (newWeekStart: dayjs) => void
 *   onSlotClick      – (day: dayjs, hour: number) => void  [optionnel]
 *   onActivityClick  – (id: number) => void
 *   onActivityResize – (id, { pac_date, pac_due_date }) => void  [optionnel]
 *   loading          – boolean
 *   toolbarExtra     – nœud React affiché à droite de la barre de navigation [optionnel]
 */
export default function WeeklyCalendar({
    activities = [],
    weekStart,
    onWeekChange,
    onSlotClick,
    onActivityClick,
    onActivityResize,
    loading = false,
    toolbarExtra,
    hideSunday = false,
}) {
    const today = dayjs();

    // ── Resize drag state ─────────────────────────────────────────────────────
    // dragRef stores the in-flight drag without causing re-renders on every move
    const dragRef = useRef(null);
    const [dragPreview, setDragPreview] = useState(null);
    // { actId, startMin, endMin }

    const handleResizeStart = useCallback((e, act, handle, origStartMin, origEndMin, day) => {
        e.stopPropagation();
        e.preventDefault();
        dragRef.current = { actId: act.id, handle, startY: e.clientY, origStartMin, origEndMin, day };
        setDragPreview({ actId: act.id, startMin: origStartMin, endMin: origEndMin });
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragRef.current) return;
            const { handle, startY, origStartMin, origEndMin, actId } = dragRef.current;
            const deltaMin = snap(e.clientY - startY); // 1px = 1min

            let newStart = origStartMin;
            let newEnd = origEndMin;

            if (handle === 'bottom') {
                newEnd = Math.max(origStartMin + SNAP_MINUTES, origEndMin + deltaMin);
            } else {
                newStart = Math.min(origStartMin + deltaMin, origEndMin - SNAP_MINUTES);
            }

            newStart = Math.max(0, Math.min(newStart, MAX_MINUTES - SNAP_MINUTES));
            newEnd = Math.max(newStart + SNAP_MINUTES, Math.min(newEnd, MAX_MINUTES));

            setDragPreview({ actId, startMin: newStart, endMin: newEnd });
        };

        const onUp = () => {
            if (!dragRef.current) return;
            const { actId, day } = dragRef.current;

            setDragPreview(prev => {
                if (prev && onActivityResize) {
                    onActivityResize(actId, {
                        pac_date: minToTime(day, prev.startMin).format('YYYY-MM-DD HH:mm:ss'),
                        pac_due_date: minToTime(day, prev.endMin).format('YYYY-MM-DD HH:mm:ss'),
                    });
                }
                return null;
            });

            dragRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [onActivityResize]);

    // ── Données calendrier ─────────────────────────────────────────────────────
    const nowTop = useMemo(() => {
        const min = (today.hour() - START_HOUR) * 60 + today.minute();
        return min >= 0 && min < MAX_MINUTES ? (min / 60) * HOUR_HEIGHT : -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const overdueActivities = useMemo(() =>
        activities.filter(act => {
            const d = act.pac_due_date || act.pac_date;
            return d && dayjs(d).isBefore(weekStart, 'day') && !act.pac_is_done;
        }),
        [activities, weekStart]
    );

    const activityByDate = useMemo(() => {
        const map = {};
        activities.forEach(act => {
            const d = act.pac_due_date || act.pac_date;
            if (!d) return;
            const key = dayjs(d).format('YYYY-MM-DD');
            if (!map[key]) map[key] = [];
            map[key].push(act);
        });
        return map;
    }, [activities]);

    const weekDays = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
        return hideSunday ? days.filter(d => d.day() !== 0) : days;
    }, [weekStart, hideSunday]);

    return (
        <div>
            {/* ── Barre de navigation ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <Button icon={<LeftOutlined />} size="small"
                    onClick={() => onWeekChange(weekStart.subtract(7, 'day'))} />
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 210, textAlign: 'center' }}>
                    {formatWeekRange(weekStart)}
                </span>
                <Button icon={<RightOutlined />} size="small"
                    onClick={() => onWeekChange(weekStart.add(7, 'day'))} />
                <Button size="small" onClick={() => onWeekChange(getWeekStart(dayjs()))}>
                    Cette semaine
                </Button>
                {toolbarExtra && (
                    <div style={{ marginLeft: 'auto' }}>
                        {toolbarExtra}
                    </div>
                )}
            </div>

            {/* ── Activités en retard ── */}
            {overdueActivities.length > 0 && (
                <div style={{
                    marginBottom: 8,
                    padding: '8px 12px',
                    background: '#fff2f0',
                    border: '1px solid #ffccc7',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#cf1322', whiteSpace: 'nowrap', paddingTop: 2 }}>
                        En retard ({overdueActivities.length})
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {overdueActivities.map(act => {
                            const typeConfig = ACTIVITY_TYPES[act.pac_type];
                            const color = typeConfig?.color || '#666';
                            const dateStr = formatDate(act.pac_due_date || act.pac_date);
                            return (
                                <Tooltip
                                    key={act.id}
                                    title={
                                        <div>
                                            <div><strong>{typeConfig?.label}</strong> — {act.pac_subject}</div>
                                            <div style={{ color: '#ffa39e' }}>Prévu le {dateStr}</div>
                                            {act.ptr_name && <div>{act.ptr_name}</div>}
                                        </div>
                                    }
                                >
                                    <div
                                        onClick={() => onActivityClick(act.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            padding: '3px 8px',
                                            borderRadius: 4,
                                            background: '#fff',
                                            border: '1px solid #ffccc7',
                                            borderLeft: `3px solid ${color}`,
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            maxWidth: 220,
                                        }}
                                    >
                                        <span style={{ color, flexShrink: 0 }}>{typeConfig?.icon}</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {act.pac_subject}
                                        </span>
                                        <span style={{ fontSize: 11, color: '#cf1322', flexShrink: 0, marginLeft: 2 }}>
                                            {dateStr}
                                        </span>
                                    </div>
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Grille semaine ── */}
            <Spin spinning={loading}>
                <div style={{ display: 'flex', border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>

                    {/* Colonne des heures */}
                    <div style={{ width: 52, flexShrink: 0, background: '#fafafa', borderRight: '1px solid #e8e8e8' }}>
                        <div style={{ height: 52, borderBottom: '1px solid #e8e8e8' }} />
                        {HOURS.map(h => (
                            <div key={h} style={{
                                height: HOUR_HEIGHT,
                                borderTop: '1px solid #f0f0f0',
                                padding: '3px 8px 0',
                                fontSize: 11,
                                color: '#aaa',
                                textAlign: 'right',
                                boxSizing: 'border-box',
                            }}>
                                {`${h}:00`}
                            </div>
                        ))}
                    </div>

                    {/* Colonnes des 7 jours */}
                    {weekDays.map((day, di) => {
                        const dateKey = day.format('YYYY-MM-DD');
                        const layout = layoutDayActivities(activityByDate[dateKey]);
                        const isToday = day.isSame(today, 'day');
                        const isWeekend = di >= 5;

                        return (
                            <div key={di} style={{ flex: 1, borderLeft: '1px solid #e8e8e8', minWidth: 0 }}>
                                {/* En-tête du jour */}
                                <div style={{
                                    height: 52,
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    borderBottom: '1px solid #e8e8e8',
                                    background: isToday ? '#e6f4ff' : isWeekend ? '#fffcf8' : '#fafafa',
                                }}>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700,
                                        color: isWeekend ? '#ff7a45' : '#888',
                                        textTransform: 'uppercase', letterSpacing: '0.5px',
                                    }}>
                                        {SHORT_DAY_FR[day.day()]}
                                    </span>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: isToday ? '#1677ff' : 'transparent',
                                        color: isToday ? '#fff' : isWeekend ? '#ff7a45' : '#333',
                                        fontSize: 14, fontWeight: isToday ? 700 : 500,
                                        marginTop: 2,
                                    }}>
                                        {day.date()}
                                    </span>
                                </div>

                                {/* Zone temporelle */}
                                <div style={{
                                    position: 'relative',
                                    height: HOURS.length * HOUR_HEIGHT,
                                    background: isWeekend ? '#fffcf8' : '#fff',
                                    overflow: 'hidden',
                                }}>
                                    {/* Lignes horaires cliquables */}
                                    {HOURS.map((h, hi) => (
                                        <div
                                            key={h}
                                            onClick={() => onSlotClick?.(day, h)}
                                            title={onSlotClick ? `Nouvelle activité le ${day.format('DD/MM')} à ${h}:00` : undefined}
                                            style={{
                                                position: 'absolute',
                                                top: hi * HOUR_HEIGHT, left: 0, right: 0,
                                                height: HOUR_HEIGHT,
                                                borderTop: '1px solid #f0f0f0',
                                                cursor: onSlotClick ? 'pointer' : 'default',
                                            }}
                                            onMouseEnter={onSlotClick ? e => e.currentTarget.style.background = 'rgba(22,119,255,0.04)' : undefined}
                                            onMouseLeave={onSlotClick ? e => e.currentTarget.style.background = '' : undefined}
                                        />
                                    ))}

                                    {/* Cartes d'activité */}
                                    {layout.map(({ act, startMin, endMin, top, height, left, width }) => {
                                        const typeConfig = ACTIVITY_TYPES[act.pac_type];
                                        const color = typeConfig?.color || '#666';
                                        const isDone = !!act.pac_is_done;
                                        const isOverdue = !isDone && act.pac_due_date
                                            && dayjs(act.pac_due_date).isBefore(today);
                                        const borderColor = isDone ? '#d9d9d9' : isOverdue ? '#ff4d4f' : color;
                                        const bg = isDone ? '#f5f5f5' : isOverdue ? '#fff2f0' : `${color}1a`;

                                        // Appliquer le preview de redimensionnement si en cours
                                        const preview = dragPreview?.actId === act.id ? dragPreview : null;
                                        const effStartMin = preview ? preview.startMin : startMin;
                                        const effEndMin   = preview ? preview.endMin   : endMin;
                                        const effTop    = (effStartMin / 60) * HOUR_HEIGHT;
                                        const effHeight = Math.max(((effEndMin - effStartMin) / 60) * HOUR_HEIGHT, 24);

                                        const startTime = minToTime(day, effStartMin).format('HH:mm');
                                        const endTime   = minToTime(day, effEndMin).format('HH:mm');

                                        const canResize = !!onActivityResize && !isDone;

                                        return (
                                            <Tooltip
                                                key={act.id}
                                                placement="right"
                                                open={preview ? false : undefined}
                                                title={
                                                    <div>
                                                        <div><strong>{typeConfig?.label}</strong> — {act.pac_subject}</div>
                                                        <div style={{ color: '#ddd' }}>{startTime} – {endTime}</div>
                                                        {act.ptr_name && <div>{act.ptr_name}</div>}
                                                        {act.seller_name && <div style={{ color: '#aaa' }}>{act.seller_name}</div>}
                                                    </div>
                                                }
                                            >
                                                <div
                                                    onClick={e => { if (!dragRef.current) { e.stopPropagation(); onActivityClick(act.id); } }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: effTop + 1,
                                                        height: effHeight - 2,
                                                        left: `calc(${left}% + 2px)`,
                                                        width: `calc(${width}% - 4px)`,
                                                        borderRadius: 4,
                                                        borderLeft: `3px solid ${borderColor}`,
                                                        background: bg,
                                                        padding: '2px 5px 0',
                                                        cursor: 'pointer',
                                                        overflow: 'hidden',
                                                        zIndex: preview ? 20 : 2,
                                                        fontSize: 11,
                                                        lineHeight: '15px',
                                                        color: isDone ? '#aaa' : '#333',
                                                        textDecoration: isDone ? 'line-through' : 'none',
                                                        boxShadow: preview
                                                            ? '0 4px 12px rgba(0,0,0,0.18)'
                                                            : '0 1px 3px rgba(0,0,0,0.08)',
                                                        outline: preview ? `2px solid ${color}` : 'none',
                                                    }}
                                                >
                                                    {/* Poignée haut */}
                                                    {canResize && (
                                                        <div
                                                            onMouseDown={e => handleResizeStart(e, act, 'top', startMin, endMin, day)}
                                                            style={{
                                                                position: 'absolute',
                                                                top: 0, left: 0, right: 0,
                                                                height: 6,
                                                                cursor: 'ns-resize',
                                                                zIndex: 3,
                                                            }}
                                                        />
                                                    )}

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, paddingTop: 2 }}>
                                                        <span style={{ flexShrink: 0, color: isDone ? '#ccc' : color }}>
                                                            {typeConfig?.icon}
                                                        </span>
                                                        <span style={{
                                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap', fontWeight: 500,
                                                        }}>
                                                            {act.pac_subject}
                                                        </span>
                                                    </div>
                                                    {effHeight > 38 && (
                                                        <div style={{ fontSize: 10, color: isDone ? '#ccc' : '#999', marginTop: 1 }}>
                                                            {startTime} – {endTime}
                                                        </div>
                                                    )}
                                                    {effHeight > 54 && act.ptr_name && (
                                                        <div style={{
                                                            fontSize: 10, color: isDone ? '#ccc' : '#888',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        }}>
                                                            {act.ptr_name}
                                                        </div>
                                                    )}

                                                    {/* Poignée bas */}
                                                    {canResize && (
                                                        <div
                                                            onMouseDown={e => handleResizeStart(e, act, 'bottom', startMin, endMin, day)}
                                                            style={{
                                                                position: 'absolute',
                                                                bottom: 0, left: 0, right: 0,
                                                                height: 6,
                                                                cursor: 'ns-resize',
                                                                borderRadius: '0 0 4px 4px',
                                                                background: `linear-gradient(transparent, ${color}44)`,
                                                                zIndex: 3,
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </Tooltip>
                                        );
                                    })}

                                    {/* Ligne heure courante */}
                                    {isToday && nowTop >= 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: nowTop,
                                            left: 0, right: 0, height: 2,
                                            background: '#ff4d4f',
                                            zIndex: 10,
                                            pointerEvents: 'none',
                                        }}>
                                            <div style={{
                                                position: 'absolute', left: -4, top: -4,
                                                width: 10, height: 10,
                                                borderRadius: '50%', background: '#ff4d4f',
                                            }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Spin>
        </div>
    );
}
