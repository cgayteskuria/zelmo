import { useState, useEffect, useCallback } from "react";
import { Table, Tag, Button, Space, Select, Modal, Alert, Descriptions } from "antd";
import { ReloadOutlined, SendOutlined, BarChartOutlined } from "@ant-design/icons";
import { message } from "../../utils/antdStatic";
import { eInvoicingApi } from "../../services/apiEInvoicing";
import PageContainer from "../../components/common/PageContainer";
import dayjs from "dayjs";

const STATUS_COLOR = {
    PENDING:     "warning",
    TRANSMITTED: "success",
    ERROR:       "error",
};
const STATUS_LABEL = {
    PENDING:     "En attente",
    TRANSMITTED: "Transmis",
    ERROR:       "Erreur",
};

const TYPE_LABEL = {
    B2C:     "B2C (ventes aux particuliers)",
    B2B_INTL: "B2B International",
};

export default function EReportingDashboard() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [transmitting, setTransmitting] = useState(null);
    const [buildPeriod, setBuildPeriod] = useState(dayjs().format("YYYY-MM"));
    const [buildType, setBuildType] = useState("B2C");
    const [buildLoading, setBuildLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await eInvoicingApi.listEReporting();
            setData(res.data?.data ?? []);
        } catch {
            message.error("Erreur lors du chargement des données d'e-reporting.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleTransmit = async (eerId) => {
        setTransmitting(eerId);
        try {
            await eInvoicingApi.transmitEReporting(eerId);
            message.success("Données d'e-reporting transmises au PA.");
            load();
        } catch (err) {
            message.error(err?.response?.data?.message ?? "Erreur lors de la transmission.");
        } finally {
            setTransmitting(null);
        }
    };

    const handleBuild = async () => {
        setBuildLoading(true);
        try {
            await eInvoicingApi.buildEReporting(buildPeriod, buildType);
            message.success("Période construite avec succès.");
            load();
        } catch (err) {
            message.error(err?.response?.data?.message ?? "Erreur lors de la construction de la période.");
        } finally {
            setBuildLoading(false);
        }
    };

    const currentYear = dayjs().year();
    const periodOptions = [];
    for (let y = currentYear; y >= currentYear - 2; y--) {
        for (let m = 12; m >= 1; m--) {
            const val = `${y}-${String(m).padStart(2, "0")}`;
            periodOptions.push({ value: val, label: val });
        }
    }

    const columns = [
        {
            title: "Période",
            dataIndex: "eer_period",
            sorter: (a, b) => (a.eer_period ?? "").localeCompare(b.eer_period ?? ""),
        },
        {
            title: "Type",
            dataIndex: "eer_type",
            render: (v) => TYPE_LABEL[v] ?? v,
        },
        {
            title: "Montant HT",
            dataIndex: "eer_amount_ht",
            align: "right",
            render: (v) => v != null ? `${parseFloat(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—",
        },
        {
            title: "Montant TTC",
            dataIndex: "eer_amount_ttc",
            align: "right",
            render: (v) => v != null ? `${parseFloat(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "—",
        },
        {
            title: "Statut",
            dataIndex: "eer_status",
            render: (v) => (
                <Tag color={STATUS_COLOR[v] ?? "default"}>
                    {STATUS_LABEL[v] ?? v ?? "—"}
                </Tag>
            ),
        },
        {
            title: "Transmis le",
            dataIndex: "eer_transmitted_at",
            render: (v) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
        },
        {
            title: "Actions",
            key: "actions",
            align: "right",
            render: (_, r) => (
                <Button
                    size="small"
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={r.eer_status === "TRANSMITTED"}
                    loading={transmitting === r.eer_id}
                    onClick={() => handleTransmit(r.eer_id)}
                >
                    Transmettre
                </Button>
            ),
        },
    ];

    const pendingCount = data.filter((r) => r.eer_status === "PENDING").length;

    return (
        <PageContainer
            title={
                <Space>
                    <BarChartOutlined />
                    E-reporting
                </Space>
            }
            actions={
                <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                    Actualiser
                </Button>
            }
        >
            <Alert
                type="info"
                message="L'e-reporting couvre les transactions non soumises à e-facturation : ventes B2C (particuliers) et B2B international (hors France)."
                showIcon
                style={{ marginBottom: 16 }}
            />

            {pendingCount > 0 && (
                <Alert
                    type="warning"
                    message={`${pendingCount} période${pendingCount > 1 ? "s" : ""} en attente de transmission`}
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Space style={{ marginBottom: 16 }}>
                <Select
                    value={buildPeriod}
                    onChange={setBuildPeriod}
                    options={periodOptions}
                    style={{ width: 140 }}
                />
                <Select
                    value={buildType}
                    onChange={setBuildType}
                    options={[
                        { value: "B2C", label: "B2C" },
                        { value: "B2B_INTL", label: "B2B International" },
                    ]}
                    style={{ width: 180 }}
                />
                <Button icon={<BarChartOutlined />} onClick={handleBuild} loading={buildLoading}>
                    Construire la période
                </Button>
            </Space>

            <Table
                dataSource={data}
                columns={columns}
                rowKey="eer_id"
                loading={loading}
                size="small"
                pagination={{ pageSize: 20 }}
            />
        </PageContainer>
    );
}
