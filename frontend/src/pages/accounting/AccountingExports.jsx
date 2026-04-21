import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { accountingExportsApi } from "../../services/api";
import AccountingExport from "./AccountingExport";

/**
 * Liste des exports comptables FEC
 */
export default function AccountingExports() {
    const gridRef = useRef(null);

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit,
    } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };

    const { handleRowClick } = useRowHandler(openForEdit);

    const columns = [
        { key: "aie_created", title: "Date", width: 180, filterType: "date", render: (value) => formatDate(value) },
        { key: "author", title: "Par", ellipsis: true },
        { key: "aie_transfer_start", title: "Période du", width: 120, filterType: "date", render: (value) => formatDate(value) },
        { key: "aie_transfer_end", title: "au", width: 120, filterType: "date", render: (value) => formatDate(value) },
        createEditActionColumn({ permission: "accountings.view", onEdit: handleRowClick, mode: "table" }),
    ];

    return (
        <PageContainer
            title="Exports Comptables"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openForCreate}
                    size="large"
                >
                    Nouvel export
                </Button>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={accountingExportsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'aie_created', order: 'DESC' }}
            />

            {drawerOpen && (
                <AccountingExport
                    open={drawerOpen}
                    onClose={closeDrawer}
                    exportId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
