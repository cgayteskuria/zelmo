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

import { messageTemplatesApi } from "../../services/api";
import MessageTemplate from "./MessageTemplate";

/**
 * Affiche la liste des modèles de messages avec une grid interactive
 */
export default function MessageTemplates() {
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

    const categoryFormatter = (value) => {
        const categories = {
            ticket_reply: { label: "Ticket réponse prédéfini", color: "blue" },
            system:       { label: "Système", color: "green" },
        };
        const cat = categories[value] || { label: "Non définie", color: "default" };
        return <Tag color={cat.color}>{cat.label}</Tag>;
    };

    const columns = [
        { key: "emt_label",    title: "Nom",       ellipsis: true, filterType: "text" },
        { key: "emt_category", title: "Catégorie", width: 200, render: (value) => categoryFormatter(value) },
        { key: "emt_subject", title: "Sujet", width: 300 },
        createEditActionColumn({ permission: "settings.messagetemplates.edit", onEdit: handleRowClick, mode: "table" })
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Modèles de messages" }
    ];

    return (
        <PageContainer
            title="Modèles de messages"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.messagetemplates.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Ajouter un modèle
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={messageTemplatesApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'emt_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <MessageTemplate
                    open={drawerOpen}
                    onClose={closeDrawer}
                    messageTemplateId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
