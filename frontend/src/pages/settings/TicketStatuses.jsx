import { useRef } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import * as AntIcons from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { ticketStatusesApi } from "../../services/api";
import TicketStatusForm from "./TicketStatusForm";


export default function TicketStatuses() {
    const gridRef = useRef(null);

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };

    const { handleRowClick } = useRowHandler(openForEdit, "tke_id");

    const columns = [
        { key: "tke_label", title: "Libellé", ellipsis: true, filterType: "text" },
        { key: "tke_order", title: "Ordre", width: 100 },
        {
            key: "tke_icon",
            title: "Icône",
            width: 80,
            align: "center",
            render: (value) => {
                if (!value) return "-";
                const Icon = AntIcons[value];
                return Icon ? <Icon style={{ fontSize: 18 }} /> : value;
            },
        },
        {
            key: "tke_color",
            title: "Couleur",
            width: 120,
            render: (value) => value ? <Tag color={value}>{value}</Tag> : "-",
        },
        createEditActionColumn({ permission: "settings.ticketingconf.edit", onEdit: handleRowClick, mode: "table" }),
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Statuts de tickets" },
    ];

    return (
        <PageContainer
            title="Statuts de tickets"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.ticketingconf.create">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Ajouter
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={ticketStatusesApi.list}
                onRowClick={handleRowClick}
                rowKey="tke_id"
                defaultSort={{ field: 'tke_order', order: 'ASC' }}
            />

            {drawerOpen && (
                <TicketStatusForm
                    open={drawerOpen}
                    onClose={closeDrawer}
                    ticketStatusId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
