import { useRef, useMemo } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, AppstoreOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ServerTable from "../../components/table";
import { formatCurrency, formatDate } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { formatProbability } from "../../configs/OpportunityConfig";
import { opportunitiesApi } from "../../services/apiProspect";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import Opportunity from "./Opportunity";

export default function Opportunities() {
    const gridRef = useRef(null);
    const navigate = useNavigate();

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit,
    } = useDrawerManager();

    const { handleRowClick } = useRowHandler(openForEdit);

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };

    const columns = useMemo(() => [
        {
            key: "opp_label",
            title: "Titre",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "ptr_name",
            title: "Prospect",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "pps_label",
            title: "Étape",
            width: 140,
            align: "center",
            filterType: "text",
            render: (value, record) => value ? <Tag color={record.pps_color}>{value}</Tag> : null,
        },
        {
            key: "opp_amount",
            title: "Montant",
            width: 120,
            align: "right",
            filterType: "numeric",
            render: (value) => formatCurrency(value),
        },
        {
            key: "opp_probability",
            title: "Proba.",
            width: 80,
            align: "center",
            render: (value) => formatProbability(value),
        },
        {
            key: "opp_weighted_amount",
            title: "Pondéré",
            width: 120,
            align: "right",
            render: (value) => formatCurrency(value),
        },
        {
            key: "opp_close_date",
            title: "Clôture prévue",
            width: 130,
            align: "center",
            filterType: "date",
            render: (value) => formatDate(value),
        },
        {
            key: "seller_name",
            title: "Commercial",
            width: 150,
            filterType: "text",
            ellipsis: true,
        },
        createEditActionColumn({ permission: "opportunities.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ], [handleRowClick]);

    return (
        <PageContainer
            title="Opportunités"
            actions={
                <div style={{ display: "flex", gap: 8 }}>
                    <Button icon={<AppstoreOutlined />} onClick={() => navigate("/opportunities/pipeline")} size="large">
                        Pipeline
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Nouvelle opportunité
                    </Button>
                </div>
            }
        >
            <ServerTable
                ref={gridRef}
                fetchFn={(params) => opportunitiesApi.list(params)}
                columns={columns}
                defaultSort={{ field: "opp_created", order: "DESC" }}
                onRowClick={handleRowClick}
            />

            {drawerOpen && (
                <Opportunity
                    open={drawerOpen}
                    onClose={closeDrawer}
                    opportunityId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
