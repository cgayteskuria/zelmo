import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { accountingBackupsApi } from "../../services/api";
import AccountingBackup from "./AccountingBackup";

/**
 * Liste des sauvegardes comptables
 */
export default function AccountingBackups() {
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
        { key: "aba_created", title: "Date", width: 180, filterType: "date", render: (value) => formatDate(value) },
        { key: "author", title: "Effectué par", width: 200 },
        { key: "aba_label", title: "Description", ellipsis: true },
        { key: "aba_size_human", title: "Taille", width: 120 },
        { key: "aba_tables_count", title: "Tables", width: 100, align: 'center' },
        createEditActionColumn({ permission: "accountings.view", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Sauvegardes Comptables"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openForCreate}
                    size="large"
                >
                    Créer une sauvegarde
                </Button>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={accountingBackupsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'aba_created', order: 'DESC' }}
            />

            {drawerOpen && (
                <AccountingBackup
                    open={drawerOpen}
                    onClose={closeDrawer}
                    backupId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
