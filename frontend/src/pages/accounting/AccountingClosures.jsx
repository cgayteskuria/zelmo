import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { accountingClosuresApi } from "../../services/api";
import AccountingClosure from "./AccountingClosure";

/**
 * Liste des clôtures d'exercices comptables
 */
export default function AccountingClosures() {
    const gridRef = useRef(null);

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit
    } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };

    const { handleRowClick } = useRowHandler(openForEdit);

    const columns = [
        { key: "aex_closing_date", title: "Date de clôture", width: 180, filterType: "date", render: (value) => formatDate(value, 'DD/MM/YYYY HH:mm') },
        { key: "exercise_period", title: "Période", width: 250 },
        { key: "author", title: "Effectué par", ellipsis: true },
        createEditActionColumn({ permission: "accountings.view", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Clôtures d'exercices"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openForCreate}
                    size="large"
                >
                    Clôturer l'exercice
                </Button>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={accountingClosuresApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'aex_closing_date', order: 'DESC' }}
            />

            {drawerOpen && (
                <AccountingClosure
                    open={drawerOpen}
                    onClose={closeDrawer}
                    closureId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
