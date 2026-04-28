import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined, SettingOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import ServerTable from "../../components/table";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";
import { accountsApi } from "../../services/api";
import Account from "./Account";

/**
 * Liste des comptes comptables
 */
export default function Accounts() {
    const gridRef = useRef(null);

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit
    } = useDrawerManager();
    const { handleRowClick } = useRowHandler(openForEdit, 'acc_id');

    const handleSubmit = ({ action }) => {
        gridRef.current?.reload();
        if (action !== 'delete') {
            closeDrawer();
        }
    };

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Plan comptable" }
    ];

    const formatActive = (value) => value == 1
        ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
        : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;

    const columns = [
        {
            key: "acc_is_active",
            title: "Actif",
            width: 80,
            align: "center",
            filterType: "select",
            filterOptions: [
                { value: "1", label: "Oui" },
                { value: "0", label: "Non" },
            ],
            render: (value) => formatActive(value),
        },
        { key: "acc_code", title: "N° Compte", width: 150, filterType: "text" },
        { key: "acc_label", title: "Libellé", ellipsis: true, filterType: "text" },
        {
            key: "acc_is_letterable",
            title: "Lettrable",
            width: 110,
            align: "center",
            render: (_, row) => row.acc_is_letterable ? "Oui" : "Non",
        },
        createEditActionColumn({ permission: "accountings.view", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Plan comptable"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="accountings.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Ajouter un compte
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={accountsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'acc_code', order: 'ASC' }}
                csv={true}
            />

            {drawerOpen && (
                <Account
                    open={drawerOpen}
                    onClose={closeDrawer}
                    onSubmit={handleSubmit}
                    accountId={selectedItemId}
                />
            )}
        </PageContainer>
    );
}
