import { useRef } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";
import ServerTable from "../../components/table";

import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import Role from "./Role";
import { rolesApi } from "../../services/api";
import { useDrawerManager } from "../../hooks/useDrawerManager";


/**
 * Page de gestion des rôles
 */
export default function Roles() {
    const gridRef = useRef(null);

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const { handleRowClick } = useRowHandler(openForEdit);

    /**
     * Callback après une action (create, update, delete)
     */
    const handleSubmit = ({ action }) => {
        gridRef.current?.reload();
        if (action !== 'delete') {
            closeDrawer();
        }
    };

    /**
     * Configuration du breadcrumb
     */
    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Gestion des rôles" }
    ];

    /**
     * Colonnes de la grille
     */
    const columns = [
        { key: "id", title: "ID", width: 80 },
        { key: "name", title: "Nom du rôle", ellipsis: true, filterType: "text" },
        {
            key: "permissions_count", title: "Permissions", width: 150,
            render: (value) => (
                <Tag color="blue">{value || 0} permissions</Tag>
            ),
        },
        {
            key: "created_at", title: "Créé le", width: 180,
            render: (value) => new Date(value).toLocaleString('fr-FR'),
        },
        createEditActionColumn({ permission: "settings.roles.edit", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Gestion des rôles"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.roles.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                    >
                        Ajouter un rôle
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={rolesApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'name', order: 'ASC' }}
            />

            {drawerOpen && (
                <Role
                    roleId={selectedItemId}
                    open={drawerOpen}
                    onClose={closeDrawer}
                    onSubmit={handleSubmit}
                />
            )}
        </PageContainer>
    );
}
