import { useState, useEffect, useCallback } from "react";
import { Card, Row, Col, Statistic, DatePicker, Select, Spin, Table, Progress, Tag } from "antd";
import {
    ClockCircleOutlined, CheckCircleOutlined, EuroOutlined,
    TeamOutlined, HourglassOutlined,
} from "@ant-design/icons";
import PageContainer from "../../components/common/PageContainer";
import PartnerSelect from "../../components/select/PartnerSelect";
import UserSelect from "../../components/select/UserSelect";
import { timeReportsApi } from "../../services/api";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

function formatH(minutes) {
    if (!minutes) return "0h";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// ── Horizontal bar chart ──────────────────────────────────────────────────────
function HBarChart({ data, maxMinutes, color = "#7c3aed" }) {
    if (!data?.length) return <div style={{ color: "var(--color-muted)", fontSize: 13 }}>Aucune donnée</div>;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.map((row, i) => {
                const pct = maxMinutes ? (row.total_minutes / maxMinutes) * 100 : 0;
                return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 130, fontSize: 13, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.label}>
                            {row.label}
                        </div>
                        <div style={{ flex: 1, background: "var(--bg-subtle)", borderRadius: 4, height: 18, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 4, transition: "width .4s", minWidth: pct > 0 ? 4 : 0 }} />
                        </div>
                        <div style={{ width: 48, fontSize: 12, flexShrink: 0, textAlign: "right", color: "var(--color-muted)" }}>
                            {formatH(row.total_minutes)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ data }) {
    if (!data?.length) return <div style={{ color: "var(--color-muted)", fontSize: 13 }}>Aucune donnée</div>;
    const total = data.reduce((s, d) => s + d.total_minutes, 0);
    if (!total) return <div style={{ color: "var(--color-muted)", fontSize: 13 }}>Aucune donnée</div>;

    const COLORS = ["#7c3aed", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#84cc16", "#f97316"];
    const R = 70, cx = 90, cy = 90, stroke = 28;
    const circ = 2 * Math.PI * R;
    let offset = 0;
    const slices = data.slice(0, 10).map((d, i) => {
        const pct = d.total_minutes / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const rotation = offset * 360 - 90;
        offset += pct;
        return { ...d, dash, gap, rotation, color: d.color && d.color !== "#94a3b8" ? d.color : COLORS[i % COLORS.length] };
    });

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <svg width={180} height={180} viewBox="0 0 180 180">
                {slices.map((s, i) => (
                    <circle key={i}
                        cx={cx} cy={cy} r={R}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={stroke}
                        strokeDasharray={`${s.dash} ${s.gap}`}
                        strokeDashoffset={0}
                        transform={`rotate(${s.rotation} ${cx} ${cy})`}
                    />
                ))}
                <text x={cx} y={cy - 6} textAnchor="middle" fontSize={13} fill="var(--color-muted)">Total</text>
                <text x={cx} y={cy + 14} textAnchor="middle" fontSize={15} fontWeight="600" fill="var(--color-text)">{formatH(total)}</text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {slices.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                        <span style={{ color: "var(--color-text)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                        <span style={{ color: "var(--color-muted)", marginLeft: "auto", paddingLeft: 8 }}>{formatH(s.total_minutes)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Stacked bar chart (heures par semaine) ────────────────────────────────────
function StackedWeekBar({ data }) {
    if (!data?.length) return <div style={{ color: "var(--color-muted)", fontSize: 13 }}>Aucune donnée</div>;
    const maxMinutes = Math.max(...data.map(w => w.approved_minutes + w.pending_minutes + w.draft_minutes), 1);

    return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160, overflowX: "auto", paddingBottom: 4 }}>
            {data.map((w, i) => {
                const totalH = w.approved_minutes + w.pending_minutes + w.draft_minutes;
                const pct = (totalH / maxMinutes) * 100;
                const apPct = totalH ? (w.approved_minutes / totalH) * 100 : 0;
                const penPct = totalH ? (w.pending_minutes / totalH) * 100 : 0;
                const drPct = 100 - apPct - penPct;
                const label = w.week_start ? dayjs(w.week_start).format("DD/MM") : `S${i + 1}`;

                return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: "0 0 40px" }}>
                        <div style={{ fontSize: 10, color: "var(--color-muted)" }}>{formatH(totalH)}</div>
                        <div style={{ width: 28, height: `${pct}%`, maxHeight: 130, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 3 }}>
                            <div style={{ height: `${apPct}%`, background: "#10b981" }} title={`Approuvé: ${formatH(w.approved_minutes)}`} />
                            <div style={{ height: `${penPct}%`, background: "#f59e0b" }} title={`En attente: ${formatH(w.pending_minutes)}`} />
                            <div style={{ height: `${drPct}%`, background: "#e2e8f0" }} title={`Brouillon: ${formatH(w.draft_minutes)}`} />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--color-muted)", textAlign: "center" }}>{label}</div>
                    </div>
                );
            })}
            <div style={{ marginLeft: 16, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, flexShrink: 0 }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#10b981", borderRadius: 2, marginRight: 4 }} />Approuvé</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#f59e0b", borderRadius: 2, marginRight: 4 }} />En attente</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#e2e8f0", borderRadius: 2, marginRight: 4 }} />Brouillon</span>
            </div>
        </div>
    );
}

// ── Heatmap journalier ────────────────────────────────────────────────────────
function DayHeatmap({ data, from, to }) {
    if (!data?.length) return <div style={{ color: "var(--color-muted)", fontSize: 13 }}>Aucune donnée</div>;

    const byDay = {};
    data.forEach(d => { byDay[d.day] = d.total_minutes; });
    const maxMin = Math.max(...Object.values(byDay), 1);

    const start = from ? dayjs(from).startOf("isoWeek") : dayjs(data[0].day).startOf("isoWeek");
    const end = to ? dayjs(to) : dayjs(data[data.length - 1].day);
    const weeks = [];
    let cursor = start;
    while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            week.push(cursor);
            cursor = cursor.add(1, "day");
        }
        weeks.push(week);
    }

    const DAYS_FR = ["L", "M", "M", "J", "V", "S", "D"];

    return (
        <div style={{ overflowX: "auto" }}>
            <div style={{ display: "flex", gap: 3 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 22 }}>
                    {DAYS_FR.map((d, i) => (
                        <div key={i} style={{ height: 16, fontSize: 10, color: "var(--color-muted)", lineHeight: "16px" }}>{d}</div>
                    ))}
                </div>
                {weeks.map((week, wi) => (
                    <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ fontSize: 10, color: "var(--color-muted)", textAlign: "center", height: 18, lineHeight: "18px" }}>
                            {week[0].format("DD/MM")}
                        </div>
                        {week.map((day, di) => {
                            const key = day.format("YYYY-MM-DD");
                            const mins = byDay[key] ?? 0;
                            const intensity = mins / maxMin;
                            const bg = mins === 0
                                ? "var(--bg-subtle)"
                                : `rgba(124, 58, 237, ${0.15 + intensity * 0.85})`;
                            return (
                                <div key={di} title={`${day.format("DD/MM/YYYY")} — ${formatH(mins)}`}
                                    style={{ width: 16, height: 16, borderRadius: 3, background: bg, cursor: mins > 0 ? "default" : undefined }} />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Summary table ─────────────────────────────────────────────────────────────
function SummaryTable({ data }) {
    const totalApproved = data.reduce((s, r) => s + r.approved_minutes, 0);
    const max = totalApproved || 1;
    const columns = [
        {
            title: "Collaborateur",
            dataIndex: "label",
            key: "label",
            ellipsis: true,
        },
        {
            title: "Saisies",
            dataIndex: "total_minutes",
            key: "total_minutes",
            width: 90,
            align: "right",
            render: (v) => formatH(v),
        },
        {
            title: "Approuvées",
            dataIndex: "approved_minutes",
            key: "approved_minutes",
            width: 100,
            align: "right",
            render: (v) => formatH(v),
        },
        {
            title: "Montant HT",
            dataIndex: "billable_amount",
            key: "billable_amount",
            width: 110,
            align: "right",
            render: (v) => v > 0 ? `${Number(v).toFixed(2)} €` : "—",
        },
        {
            title: "Avancement",
            key: "progress",
            width: 130,
            render: (_, row) => {
                const pct = max ? Math.round((row.approved_minutes / max) * 100) : 0;
                return <Progress percent={pct} showInfo={false} size="small" strokeColor="#7c3aed" />;
            },
        },
        {
            title: "Statut",
            key: "status",
            width: 100,
            render: (_, row) => {
                if (row.approved_minutes >= row.total_minutes && row.total_minutes > 0) return <Tag color="success">Complet</Tag>;
                if (row.approved_minutes > 0) return <Tag color="processing">Partiel</Tag>;
                return <Tag color="default">En attente</Tag>;
            },
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={data}
            rowKey="label"
            pagination={false}
            size="small"
            summary={() => (
                <Table.Summary.Row>
                    <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><strong>{formatH(data.reduce((s, r) => s + r.total_minutes, 0))}</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><strong>{formatH(totalApproved)}</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right"><strong>{data.reduce((s, r) => s + Number(r.billable_amount), 0).toFixed(2)} €</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} colSpan={2} />
                </Table.Summary.Row>
            )}
        />
    );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function TimeReports() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs().endOf("month")]);
    const [ptrId, setPtrId] = useState(null);
    const [usrId, setUsrId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateRange?.[0]) params.from = dateRange[0].format("YYYY-MM-DD");
            if (dateRange?.[1]) params.to   = dateRange[1].format("YYYY-MM-DD");
            if (ptrId) params.fk_ptr_id = ptrId;
            if (usrId) params.fk_usr_id = usrId;
            const res = await timeReportsApi.report(params);
            setData(res);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [dateRange, ptrId, usrId]);

    useEffect(() => { load(); }, [load]);

    const kpis = data?.kpis;
    const byUser    = data?.by_user?.map(r => ({ ...r, total_minutes: Number(r.total_minutes), approved_minutes: Number(r.approved_minutes), billable_amount: Number(r.billable_amount) })) ?? [];
    const byProject = data?.by_project?.map(r => ({ ...r, total_minutes: Number(r.total_minutes) })) ?? [];
    const byWeek    = data?.by_week?.map(r => ({ ...r, approved_minutes: Number(r.approved_minutes), pending_minutes: Number(r.pending_minutes), draft_minutes: Number(r.draft_minutes) })) ?? [];
    const byDay     = data?.by_day?.map(r => ({ ...r, total_minutes: Number(r.total_minutes) })) ?? [];
    const maxUser   = byUser.length ? Math.max(...byUser.map(u => u.total_minutes), 1) : 1;

    return (
        <PageContainer title="Rapports — Vue d'ensemble">
            {/* Filtres */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    format="DD/MM/YYYY"
                    allowClear={false}
                    style={{ width: "auto" }}
                />
                <PartnerSelect
                    loadInitially
                    filters={{ is_customer: 1 }}
                    value={ptrId}
                    onChange={(v) => setPtrId(v ?? null)}
                    style={{ width: 220 }}
                    placeholder="Tous les clients"
                    allowClear
                />
                <UserSelect
                    loadInitially
                    value={usrId}
                    onChange={(v) => setUsrId(v ?? null)}
                    style={{ width: 200 }}
                    placeholder="Tous les collaborateurs"
                    allowClear
                />
            </div>

            <Spin spinning={loading}>
                {/* KPIs */}
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={12} sm={8} md={6} lg={5}>
                        <Card size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <Statistic
                                title="Heures saisies"
                                value={kpis ? formatH(kpis.total_hours * 60) : "—"}
                                prefix={<ClockCircleOutlined style={{ color: "#7c3aed" }} />}
                                valueStyle={{ fontSize: 22 }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={5}>
                        <Card size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <Statistic
                                title="Heures approuvées"
                                value={kpis ? formatH(kpis.approved_hours * 60) : "—"}
                                prefix={<CheckCircleOutlined style={{ color: "#10b981" }} />}
                                valueStyle={{ fontSize: 22, color: "#10b981" }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={5}>
                        <Card size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <Statistic
                                title="Montant facturable HT"
                                value={kpis ? `${Number(kpis.billable_amount).toFixed(2)} €` : "—"}
                                prefix={<EuroOutlined style={{ color: "#f59e0b" }} />}
                                valueStyle={{ fontSize: 22, color: "#f59e0b" }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={4}>
                        <Card size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <Statistic
                                title="Moy. / collaborateur"
                                value={kpis ? formatH(kpis.avg_per_user * 60) : "—"}
                                prefix={<TeamOutlined style={{ color: "#6366f1" }} />}
                                valueStyle={{ fontSize: 22 }}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={5}>
                        <Card size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <Statistic
                                title="En attente d'approbation"
                                value={kpis ? `${formatH(kpis.pending_minutes)} (${kpis.pending_count})` : "—"}
                                prefix={<HourglassOutlined style={{ color: "#ef4444" }} />}
                                valueStyle={{ fontSize: 22, color: kpis?.pending_count > 0 ? "#ef4444" : undefined }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Charts row 1 */}
                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                    <Col xs={24} lg={14}>
                        <Card title="Heures par collaborateur" size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <HBarChart data={byUser} maxMinutes={maxUser} />
                        </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                        <Card title="Répartition par projet" size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <DonutChart data={byProject} />
                        </Card>
                    </Col>
                </Row>

                {/* Charts row 2 */}
                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                    <Col xs={24} lg={14}>
                        <Card title="Heures par semaine" size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <StackedWeekBar data={byWeek} />
                        </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                        <Card title="Activité journalière" size="small" style={{ borderRadius: "var(--radius-card)" }}>
                            <DayHeatmap
                                data={byDay}
                                from={dateRange?.[0]?.format("YYYY-MM-DD")}
                                to={dateRange?.[1]?.format("YYYY-MM-DD")}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Summary table */}
                {byUser.length > 0 && (
                    <Card title="Récapitulatif par collaborateur" size="small" style={{ borderRadius: "var(--radius-card)" }}>
                        <SummaryTable data={byUser} />
                    </Card>
                )}
            </Spin>
        </PageContainer>
    );
}
