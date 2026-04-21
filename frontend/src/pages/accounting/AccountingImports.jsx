import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatDate } from "../../utils/formatters";

import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { accountingImportsApi } from "../../services/api";
import AccountingImport from "./AccountingImport";

/**
 * Liste des imports comptables FEC/CIEL
 */
export default function AccountingImports() {
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
        { key: "author", title: "Par", width: 150 },
        { key: "aie_type", title: "Format", ellipsis: true },
        { key: "aie_moves_number", title: "Écritures", width: 120, align: "right" },
        createEditActionColumn({ permission: "accountings.view", onEdit: handleRowClick, mode: "table" }),
    ];

    return (
        <PageContainer
            title="Imports Comptables"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openForCreate}
                    size="large"
                >
                    Nouvel import
                </Button>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={accountingImportsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'aie_created', order: 'DESC' }}
            />

            {drawerOpen && (
                <AccountingImport
                    open={drawerOpen}
                    onClose={closeDrawer}
                    importId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
