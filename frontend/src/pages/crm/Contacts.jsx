import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";

import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { contactsApi } from "../../services/api";
import Contact from "./Contact";

/**
 * Affiche la liste des contacts avec une grid interactive
 */
export default function Contacts() {
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
        { key: "ptr_name", title: "Client", ellipsis: true, filterType: "text" },
        { key: "ctc_firstname", title: "Nom", ellipsis: true, filterType: "text" },
        { key: "ctc_lastname", title: "Prénom", ellipsis: true, filterType: "text" },
        { key: "ctc_email", title: "Email", ellipsis: true, filterType: "text" },
        { key: "ctc_phone", title: "Tél", ellipsis: true },
        { key: "ctc_mobile", title: "Mobile", ellipsis: true },
        { key: "devices", title: "Appareil", ellipsis: true },
        createEditActionColumn({ permission: "contacts.edit", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Contacts"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openForCreate}
                    size="large"
                >
                    Ajouter un Contact
                </Button>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={contactsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'ctc_lastname', order: 'ASC' }}
            />

            {drawerOpen && (
                <Contact
                    open={drawerOpen}
                    onClose={closeDrawer}
                    contactId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
