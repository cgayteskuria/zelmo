import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined, SettingOutlined, StarFilled } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { prospectSourcesApi } from "../../services/apiProspect";
import ProspectSource from "./ProspectSource";

export default function ProspectSources() {
    const gridRef = useRef(null);
    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    const { handleRowClick } = useRowHandler(openForEdit, "id");

    const columns = [
        { key: "pso_label", title: "Libellé", filterType: "text", ellipsis: true },
        {
            key: "pso_is_default", title: "Par défaut", width: 120, align: "center",
            render: (value) => value == 1 ? <StarFilled style={{ color: '#faad14', fontSize: '18px' }} /> : null,
        },
        createEditActionColumn({ permission: "settings.prospectconf.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Sources de leads" },
    ];

    return (
        <PageContainer
            title="Sources de leads"
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
                fetchFn={(params) => prospectSourcesApi.list(params)}
                columns={columns}
                defaultSort={{ field: 'pso_label', order: 'ASC' }}
                onRowClick={handleRowClick}
            />
            {drawerOpen && (
                <ProspectSource open={drawerOpen} onClose={closeDrawer} sourceId={selectedItemId} onSubmit={handleFormSubmit} />
            )}
        </PageContainer>
    );
}
