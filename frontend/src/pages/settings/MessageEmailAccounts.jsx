import { useRef } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { messageEmailAccountsApi } from "../../services/api";
import MessageEmailAccount from "./MessageEmailAccount";

/**
 * Affiche la liste des comptes email avec une grid interactive
 */
export default function MessageEmailAccounts() {
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

    const secureModeFormatter = (value) => {
        const modes = {
            basic: { label: "Authentification basique", color: "blue" },
            xoauth2: { label: "Microsoft 365 (OAuth2)", color: "green" }
        };

        const mode = modes[value] || { label: "Non défini", color: "default" };
        return <Tag color={mode.color}>{mode.label}</Tag>;
    };

    const columns = [
        { key: "eml_label", title: "Nom", ellipsis: true, filterType: "text" },
        { key: "eml_address", title: "Adresse email", width: 300 },
        { key: "eml_secure_mode", title: "Mode d'authentification", width: 250, render: (value) => secureModeFormatter(value) },
        createEditActionColumn({ permission: "settings.messageemailaccounts.edit", onEdit: handleRowClick, mode: "table" })
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Comptes email" }
    ];

    return (
        <PageContainer
            title="Comptes email"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.messageemailaccounts.create">
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
                fetchFn={messageEmailAccountsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'eml_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <MessageEmailAccount
                    open={drawerOpen}
                    onClose={closeDrawer}
                    emailAccountId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
