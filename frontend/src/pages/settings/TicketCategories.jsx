import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { ticketCategoriesApi } from "../../services/api";
import TicketCategory from "./TicketCategory";

export default function TicketCategories() {
    const gridRef = useRef(null);

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };

    const { handleRowClick } = useRowHandler(openForEdit, "tkc_id");

    const columns = [
        { key: "tkc_label", title: "Libellé", ellipsis: true, filterType: "text" },
        createEditActionColumn({ permission: "settings.ticketingconf.edit", onEdit: handleRowClick, mode: "table" }),
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Catégories de tickets" },
    ];

    return (
        <PageContainer
            title="Catégories de tickets"
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
                fetchFn={ticketCategoriesApi.list}
                onRowClick={handleRowClick}
                rowKey="tkc_id"
                defaultSort={{ field: 'tkc_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <TicketCategory
                    open={drawerOpen}
                    onClose={closeDrawer}
                    ticketCategoryId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
