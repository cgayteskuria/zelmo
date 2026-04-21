import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { prospectLostReasonsApi } from "../../services/apiProspect";
import ProspectLostReason from "./ProspectLostReason";

export default function ProspectLostReasons() {
    const gridRef = useRef(null);
    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    const { handleRowClick } = useRowHandler(openForEdit, "id");

    const columns = [
        { key: "plr_label", title: "Libellé", filterType: "text", ellipsis: true },
        createEditActionColumn({ permission: "settings.prospectconf.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Raisons de perte" },
    ];

    return (
        <PageContainer
            title="Raisons de perte"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.prospectconf.create">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openForCreate} size="large">
                        Ajouter
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                fetchFn={(params) => prospectLostReasonsApi.list(params)}
                columns={columns}
                defaultSort={{ field: 'plr_label', order: 'ASC' }}
                onRowClick={handleRowClick}
            />
            {drawerOpen && (
                <ProspectLostReason open={drawerOpen} onClose={closeDrawer} reasonId={selectedItemId} onSubmit={handleFormSubmit} />
            )}
        </PageContainer>
    );
}
