import { useState, useEffect } from "react";
import { Row, Col, Card, Statistic, Spin, Table, Tag, Typography } from "antd";
import { message } from '../../utils/antdStatic';
import { FunnelPlotOutlined, DollarOutlined, TrophyOutlined, CloseCircleOutlined, RiseOutlined, ScheduleOutlined, } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { Column, DualAxes } from "@ant-design/charts";
import PageContainer from "../../components/common/PageContainer";
import { opportunitiesApi, prospectActivitiesApi } from "../../services/api";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { formatActivityType } from "../../configs/OpportunityConfig";

const { Text } = Typography;

export default function ProspectDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [upcoming, setUpcoming] = useState([]);
    const [salesReps, setSalesReps] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [statsRes, upcomingRes, salesRes] = await Promise.all([
                    opportunitiesApi.statistics(),
                    prospectActivitiesApi.upcoming({ limit: 10 }),
                    opportunitiesApi.salesRepStats(),
                ]);
                setStats(statsRes.data);
                setUpcoming(upcomingRes.data);
                setSalesReps(salesRes.data);
            } catch {
                message.error("Erreur lors du chargement du dashboard");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading || !stats) {
        return (
            <PageContainer title="Dashboard Commercial">
                <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>
            </PageContainer>
        );
    }

    // Funnel chart config
    const funnelConfig = {
        data: stats.by_stage.map((s) => ({ stage: s.label, montant: s.amount, count: s.count })),
        xField: "stage",
        yField: "montant",
        label: {
            text: (d) => `${formatCurrency(d.montant)} (${stats.by_stage.find(s => s.label === d.stage)?.count || 0})`,
            position: "inside",
        },
        colorField: "stage",
        style: {
            radiusTopLeft: 4,
            radiusTopRight: 4,
        },
        height: 300,
    };

    // Monthly stats chart config
    const monthlyData = [];
    stats.monthly_stats.forEach((m) => {
        monthlyData.push({ month: m.label, value: m.won, type: "Gagné" });
        monthlyData.push({ month: m.label, value: m.lost, type: "Perdu" });
    });

    const monthlyConfig = {
        data: monthlyData,
        xField: "month",
        yField: "value",
        colorField: "type",
        group: true,
        style: {
            radiusTopLeft: 4,
            radiusTopRight: 4,
        },
        color: ["#52c41a", "#ff4d4f"],
        height: 300,
        label: {
            text: (d) => d.value > 0 ? formatCurrency(d.value) : "",
            position: "inside",
        },
    };

    // Top opportunities table columns
    const topColumns = [
        {
            title: "Opportunité",
            dataIndex: "opp_label",
            key: "opp_label",
            ellipsis: true,
            render: (text, record) => (
                <a onClick={() => navigate(`/opportunities/${record.opp_id}`)}>{text}</a>
            ),
        },
        { title: "Prospect", dataIndex: "ptr_name", key: "ptr_name", ellipsis: true },
        {
            title: "Montant",
            dataIndex: "opp_amount",
            key: "opp_amount",
            width: 120,
            align: "right",
            render: (v) => formatCurrency(v),
        },
        {
            title: "Proba.",
            dataIndex: "opp_probability",
            key: "opp_probability",
            width: 70,
            align: "center",
            render: (v) => `${v}%`,
        },
        {
            title: "Clôture",
            dataIndex: "opp_close_date",
            key: "opp_close_date",
            width: 110,
            render: (v) => formatDate(v),
        },
    ];

    // Sales rep table columns
    const salesRepColumns = [
        { title: "Commercial", dataIndex: "seller_name", key: "seller_name" },
        { title: "Total", dataIndex: "total_opps", key: "total_opps", width: 70, align: "center" },
        { title: "Ouvertes", dataIndex: "open_opps", key: "open_opps", width: 80, align: "center" },
        {
            title: "Gagnées",
            dataIndex: "won_opps",
            key: "won_opps",
            width: 80,
            align: "center",
            render: (v) => <Text type="success">{v}</Text>,
        },
        {
            title: "Perdues",
            dataIndex: "lost_opps",
            key: "lost_opps",
            width: 80,
            align: "center",
            render: (v) => <Text type="danger">{v}</Text>,
        },
        {
            title: "Pipeline",
            dataIndex: "pipeline_amount",
            key: "pipeline_amount",
            width: 120,
            align: "right",
            render: (v) => formatCurrency(v),
        },
        {
            title: "Gagné (€)",
            dataIndex: "won_amount",
            key: "won_amount",
            width: 120,
            align: "right",
            render: (v) => <Text type="success">{formatCurrency(v)}</Text>,
        },
        {
            title: "Taux",
            key: "rate",
            width: 70,
            align: "center",
            render: (_, r) => {
                const closed = (r.won_opps || 0) + (r.lost_opps || 0);
                return closed > 0 ? `${Math.round(r.won_opps / closed * 100)}%` : "—";
            },
        },
    ];

    return (
        <PageContainer title="Dashboard Commercial">
            {/* KPI Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small">
                        <Statistic
                            title="Pipeline total"
                            value={stats.pipeline_total}
                            prefix={<DollarOutlined />}
                            formatter={(v) => formatCurrency(v)}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small">
                        <Statistic
                            title="Pondéré total"
                            value={stats.pipeline_weighted}
                            prefix={<RiseOutlined />}
                            formatter={(v) => formatCurrency(v)}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small">
                        <Statistic
                            title="Opportunités ouvertes"
                            value={stats.open_count}
                            prefix={<FunnelPlotOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small">
                        <Statistic
                            title="Taux de conversion"
                            value={stats.conversion_rate}
                            suffix="%"
                            styles=
                            {{
                                content: { color: stats.conversion_rate >= 30 ? "#3f8600" : "#cf1322" }
                            }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small">
                        <Statistic
                            title="Gagné ce mois"
                            value={stats.won_this_month}
                            prefix={<TrophyOutlined />}
                            styles=
                            {{
                                content: { color: "#3f8600" }
                            }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small">
                        <Statistic
                            title="Perdu ce mois"
                            value={stats.lost_this_month}
                            prefix={<CloseCircleOutlined />}
                            styles=
                            {{
                                content: { color: "#cf1322" }
                            }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Charts */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={12}>
                    <Card title="Montant par étape du pipeline" size="small">
                        <Column {...funnelConfig} />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="Gagné vs Perdu (6 derniers mois)" size="small">
                        <Column {...monthlyConfig} />
                    </Card>
                </Col>
            </Row>

            {/* Top opportunities + Upcoming activities */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={12}>
                    <Card title="Top 5 opportunités" size="small">
                        <Table
                            dataSource={stats.top_opportunities}
                            columns={topColumns}
                            rowKey="opp_id"
                            pagination={false}
                            size="small"
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card
                        title="Prochaines relances / tâches"
                        size="small"
                        extra={<a onClick={() => navigate("/prospect-activities")}>Voir tout</a>}
                    >
                        <div>
                            {upcoming.length === 0 ? (
                                <div style={{ textAlign: "center", color: "#999", padding: "16px 0" }}>
                                    Aucune tâche à venir
                                </div>
                            ) : (
                                upcoming.map((item) => (
                                    <div
                                        key={item.pac_id ?? item.id}
                                        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                                        onClick={() => item.fk_opp_id && navigate(`/opportunities/${item.fk_opp_id}`)}
                                    >
                                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>
                                            {formatActivityType(item.pac_type)}
                                        </span>
                                        <div>
                                            <div>
                                                {item.pac_subject}
                                                {item.pac_due_date && new Date(item.pac_due_date) < new Date() && (
                                                    <Tag color="red" style={{ marginLeft: 8 }}>En retard</Tag>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                                                {item.ptr_name}
                                                {item.opp_label && ` · ${item.opp_label}`}
                                                {item.pac_due_date && ` · ${formatDate(item.pac_due_date)}`}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Sales rep performance */}
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Card title="Performance par commercial" size="small">
                        <Table
                            dataSource={salesReps}
                            columns={salesRepColumns}
                            rowKey="fk_usr_id_seller"
                            pagination={false}
                            size="small"
                        />
                    </Card>
                </Col>
            </Row>
        </PageContainer>
    );
}
