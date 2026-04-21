import { useRef, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tag, Space, Alert, Typography } from "antd";
import { PlusOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import PageContainer from "../../components/common/PageContainer";
import ServerTable from "../../components/table";
import { vatDeclarationsApi } from "../../services/apiAccounts";
import { usePermission } from "../../hooks/usePermission";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import dayjs from "dayjs";

const { Text } = Typography;

const STATUS_CONFIG = {
    draft: { color: "default", label: "Brouillon" },
    closed: { color: "green", label: "Clôturée" },
};

const TYPE_LABELS = {
    monthly: "Mensuelle",
    quarterly: "Trimestrielle",
    mini_reel: "Mini-réel",
};


const SYSTEM_LABELS = {
    reel: "CA3",
    simplifie: "CA12 (Simplifié)",
};

export default function VatDeclarations() {
    const navigate = useNavigate();
    const gridRef = useRef(null);
    const { can } = usePermission();
    const [deadline, setDeadline] = useState(null);
    const [hasDraft, setHasDraft] = useState(false);

    const loadDeadline = useCallback(async () => {
        try {
            const res = await vatDeclarationsApi.nextDeadline();
            setDeadline(res.data?.[0] ?? null);
        } catch {
            // silencieux
        }
    }, []);

    useEffect(() => { loadDeadline(); }, [loadDeadline]);

   /* const checkHasDraft = useCallback(async () => {
        try {
            const res = await vatDeclarationsApi.list({ filters: { vdc_status: 'draft' }, limit: 1 });
            setHasDraft((res?.total ?? 0) > 0);
        } catch {  }
    }, []);*/

 //   useEffect(() => { checkHasDraft(); }, [checkHasDraft]);

    const handleRowClick = (record) => navigate(`/vat-declarations/${record.vdc_id}`);

    const getDeadlineAlert = () => {
        if (!deadline) return null;
        const days = deadline.days_remaining;
        const overdue = deadline.overdue;
        let type = "info";
        let msg = `Prochaine échéance CA3 le ${dayjs(deadline.deadline).format("DD/MM/YYYY")} (dans ${days} j)`;
        if (overdue) { type = "error"; msg = `Échéance CA3 dépassée ! Période ${deadline.period_label} — était due le ${dayjs(deadline.deadline).format("DD/MM/YYYY")}`; }
        else if (days <= 5) type = "error";
        else if (days <= 10) type = "warning";
        return <Alert type={type} title={msg} showIcon style={{ marginBottom: 16 }} icon={<ExclamationCircleOutlined />} />;
    };

    const columns = [
        {
            key: "vdc_label",
            title: "Libellé",
            width: 160,
            render: (v) => v || "—",
        },
        {
            key: "vdc_period_start",
            title: "Période",
            filterType: "date",
            render: (v, r) => `${dayjs(v).format("DD/MM/YYYY")} — ${dayjs(r.vdc_period_end).format("DD/MM/YYYY")}`,
        },
        {
            key: "vdc_type",
            title: "Type",
            width: 140,
            filterType: "select",
            filterOptions: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
            render: (v) => TYPE_LABELS[v] || v,
        },
        {
            key: "vdc_system",
            title: "Formulaire",
            width: 130,
            filterType: "select",
            filterOptions: Object.entries(SYSTEM_LABELS).map(([value, label]) => ({ value, label })),
            render: (v) => SYSTEM_LABELS[v] || "CA3",
        },
        {
            key: "vdc_status",
            title: "Statut",
            width: 110,
            filterType: "select",
            filterOptions: Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label })),
            render: (v) => {
                const cfg = STATUS_CONFIG[v] || { color: "default", label: v };
                return <Tag color={cfg.color}>{cfg.label}</Tag>;
            },
        },
        {
            key: "box16_amount",
            title: "TVA brute (16)",
            width: 155,
            align: "right",
            sortable: false,
            render: (v) => v != null ? Number(v).toLocaleString("fr-FR") + " €" : "—",
        },
        {
            key: "box23_amount",
            title: "TVA déductible (23)",
            width: 160,
            align: "right",
            sortable: false,
            render: (v) => v != null ? Number(v).toLocaleString("fr-FR") + " €" : "—",
        },
        {
            key: "box28_amount",
            title: "TVA nette (28)",
            width: 130,
            align: "right",
            sortable: false,
            render: (v) => {
                if (v == null) return "—";
                const n = Number(v);
                const color = n >= 0 ? "#cf1322" : "#389e0d";
                return <Text style={{ color, fontWeight: 600 }}>{n.toLocaleString("fr-FR")} €</Text>;
            },
        },
        {
            key: "amo_piece",
            title: "Écriture OD",
            width: 130,
            sortable: false,
            render: (v) => v || "—",
        },
        createEditActionColumn({ permission: "accountings.edit", onEdit: handleRowClick, mode: "table" }),
    ];

    return (
        <PageContainer
            title="Déclarations TVA"
            actions={
                <Space>
                    {can('accountings.create') && (
                        <Button type="primary"
                            icon={<PlusOutlined />}
                            size="large"
                            disabled={hasDraft}
                            title={hasDraft ? "Un brouillon est déjà en cours — validez ou supprimez-le avant d'en créer un nouveau." : undefined}
                            onClick={() => navigate("/vat-declarations/new")}>
                            Nouvelle déclaration
                        </Button>
                    )}
                </Space>
            }
        >
            {getDeadlineAlert()}
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={vatDeclarationsApi.list}
                onRowClick={handleRowClick}
                rowKey="vdc_id"
                defaultSort={{ field: "vdc_period_start", order: "DESC" }}
            />
        </PageContainer>
    );
}
