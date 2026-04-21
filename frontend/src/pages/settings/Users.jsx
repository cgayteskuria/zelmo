import { useRef } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { usersApi } from "../../services/api";
import User from "./User";

/**
 * Page de liste des utilisateurs
 */
export default function Users() {
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
    const { handleRowClick } = useRowHandler(openForEdit, "usr_id");

    const columns = [
        { key: "usr_login", title: "Login / Email", ellipsis: true, filterType: "text" },
        { key: "usr_firstname", title: "Prénom", width: 150, filterType: "text" },
        { key: "usr_lastname", title: "Nom", width: 150, filterType: "text" },
        {
            key: "roles",
            title: "Rôles",
            ellipsis: true,
            render: (value) => (
                <>
                    {value?.map(role => (
                        <Tag color="cyan" key={role.id}>
                            {role.name}
                        </Tag>
                    ))}
                </>
            )
        },
        {
            key: "usr_cat",
            title: "Catégories",
            ellipsis: true,
            render: (_value, record) => (
                <>
                    {record.usr_is_seller && <Tag color="blue">Commercial</Tag>}
                    {record.usr_is_technician && <Tag color="purple">Technicien</Tag>}
                    {record.usr_is_employee && <Tag color="orange">Salarié</Tag>}
                </>
            )
        },
        {
            key: "usr_is_active", title: "Statut", width: 100,
            render: (value) => (
                value ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                        Actif
                    </Tag>
                ) : (
                    <Tag icon={<CloseCircleOutlined />} color="error">
                        Inactif
                    </Tag>
                )
            )
        },
        createEditActionColumn({ permission: "users.edit", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            actions={
                <CanAccess permission="users.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Ajouter un utilisateur
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={usersApi.list}
                onRowClick={handleRowClick}
                rowKey="usr_id"
                defaultSort={{ field: 'usr_lastname', order: 'ASC' }}
            />

            {drawerOpen && (
                <User
                    open={drawerOpen}
                    onClose={closeDrawer}
                    userId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
