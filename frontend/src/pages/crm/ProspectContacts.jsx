import { useRef, useState } from "react";
import { Button } from "antd";
import { PlusOutlined, InboxOutlined, UnorderedListOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { prospectContactsApi, prospectContactsArchivedApi } from "../../services/api";
import Contact from "./Contact";

export default function ProspectContacts() {
    const gridRef = useRef(null);
    const [showArchived, setShowArchived] = useState(false);

    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();
    const { handleRowClick } = useRowHandler(openForEdit);

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    const columns = [
        { key: "ptr_name", title: "Société", filterType: "text", ellipsis: true, render: (v) => <strong>{v}</strong> },
        { key: "ctc_lastname", title: "Nom", filterType: "text", ellipsis: true },
        { key: "ctc_firstname", title: "Prénom", filterType: "text", ellipsis: true },
        { key: "ctc_job_title", title: "Fonction", filterType: "text", ellipsis: true, width: 180 },
        { key: "ctc_email", title: "Email", filterType: "text", ellipsis: true },
        { key: "ctc_mobile", title: "Mobile", width: 140, ellipsis: true },
        createEditActionColumn({ permission: "contacts.edit", onEdit: handleRowClick, mode: "table" }),
    ];

    return (
        <PageContainer
            title={showArchived ? "Personnes (prospects archivés)" : "Personnes"}
            actions={
                <>
                    <Button
                        icon={showArchived ? <UnorderedListOutlined /> : <InboxOutlined />}
                        onClick={() => setShowArchived(v => !v)}
                        size="large"
                        style={{ marginRight: 8 }}
                    >
                        {showArchived ? "Prospects actifs" : "Prospects archivés"}
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Ajouter un contact
                    </Button>
                </>
            }
        >
            <ServerTable
                key={showArchived ? 'archived' : 'active'}
                ref={gridRef}
                columns={columns}
                fetchFn={showArchived ? prospectContactsArchivedApi.list : prospectContactsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: "ctc_lastname", order: "ASC" }}
            />

            {drawerOpen && (
                <Contact
                    open={drawerOpen}
                    onClose={closeDrawer}
                    contactId={selectedItemId}
                    onSubmit={handleFormSubmit}
                    partnerType="prospect"
                />
            )}
        </PageContainer>
    );
}
