import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import ServerTable from "../../components/table";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";
import { accountJournalsApi } from "../../services/api";
import AccountJournal from "./AccountJournal";

/**
 * Liste des journaux comptables
 */
export default function AccountJournals() {
    const gridRef = useRef(null);

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const { handleRowClick } = useRowHandler(openForEdit);

    const handleSubmit = ({ action }) => {
        gridRef.current?.reload();
        if (action !== 'delete') {
            closeDrawer();
        }
    };

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Journaux comptables" }
    ];

    const columns = [
        { key: "ajl_code", title: "Code", width: 120, filterType: "text" },
        { key: "ajl_label", title: "Libellé", ellipsis: true, filterType: "text" },
        { key: "ajl_type", title: "Type", width: 150 },
        createEditActionColumn({ permission: "accountings.view", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Journaux comptables"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="accountings.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Ajouter un journal
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={accountJournalsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'ajl_code', order: 'ASC' }}
            />

            {drawerOpen && (
                <AccountJournal
                    journalId={selectedItemId}
                    open={drawerOpen}
                    onClose={closeDrawer}
                    onSubmit={handleSubmit}
                />
            )}
        </PageContainer>
    );
}
