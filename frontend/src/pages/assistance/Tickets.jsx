import { useRef, useState } from "react";
import { Button, Space, Switch } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import {  formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { formatTicketStatus } from "../../configs/TicketConfig.jsx";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { ticketsApi } from "../../services/api.js";

/**
 * Page liste des dossiers d'assistance (tickets)
 */
export default function Tickets() {
    const gridRef = useRef(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [viewClosed, setViewClosed] = useState(false);

    const statusId = searchParams.get("status_id") || null;
    const mine = searchParams.get("mine") === "1";
    const filterLabel = searchParams.get("label") || null;

    // Titre dynamique selon le filtre actif
    const pageTitle = mine
        ? "Mes tickets"
        : filterLabel
            ? filterLabel
            : "Dossiers d'assistance";

    const handleCreate = () => {
        navigate("/tickets/new");
    };

    const handleRowClick = (row) => {
        const rows = gridRef.current?.getData() || [];
        const ids = rows.map(r => r.id);
        const currentIndex = ids.indexOf(row.id);
        navigate(`/tickets/${row.id}`, {
            state: { ids, currentIndex, basePath: '/tickets' },
        });
    };


    const columns = [
        { key: "tkt_number", title: "N°", width: 120, filterType: "text" },
        {
            key: "tke_label",
            title: "Statut",
            width: 160,
            render: (value) => formatTicketStatus({ value })
        },
        { key: "tkp_label", title: "Priorité", width: 100 },
        { key: "ptr_name", title: "Client", ellipsis: true, filterType: "text" },
        { key: "tkt_label", title: "Titre", ellipsis: true, filterType: "text" },
        {
            key: "tkt_opendate",
            title: "Ouvert le",
            width: 120,
            align: "center",
            filterType: "date",
            render: (value) => formatDate(value)
        },
        {
            key: "tkt_updated",
            title: "Modifié",
            width: 140,
            align: "center",
            filterType: "date",
            render: (value) => formatDate(value)
        },
        { key: "assignedTo", title: "Intervenant", width: 150 },
        { key: "tkg_label", title: "Type", width: 120 },
        { key: "tkc_label", title: "Catégorie", width: 120 },
        createEditActionColumn({
            permission: "tickets.edit",
            onEdit: handleRowClick,
            mode: "table"
        })
    ];

    return (
        <PageContainer
            title={pageTitle}
            actions={
                <Space>
                    
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        size="large"
                    >
                        Nouveau dossier
                    </Button>
                </Space>
            }
        >
            <ServerTable
                key={`${statusId ?? "all"}-${mine ? "mine" : "all"}`}
                ref={gridRef}
                columns={columns}
                fetchFn={(params) => ticketsApi.list({
                    ...params,
                    ...(statusId ? { status_id: statusId } : { viewClosed }),
                    ...(mine ? { mine: true } : {}),
                })}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'tkt_updated', order: 'DESC' }}
            />
        </PageContainer>
    );
}
