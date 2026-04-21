import { useRef } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, SettingOutlined, StarFilled } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { prospectPipelineStagesApi } from "../../services/apiProspect";
import ProspectPipelineStage from "./ProspectPipelineStage";

export default function ProspectPipelineStages() {
    const gridRef = useRef(null);
    const { drawerOpen, selectedItemId, closeDrawer, openForCreate, openForEdit } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) await gridRef.current.reload();
    };

    const { handleRowClick } = useRowHandler(openForEdit, "id");

    const columns = [
        { key: "pps_order", title: "Ordre", width: 80 },
        { key: "pps_label", title: "Libellé", filterType: "text", ellipsis: true },
        {
            key: "pps_color", title: "Couleur", width: 100,
            render: (value) => value ? <Tag color={value}>■■■</Tag> : null,
        },
        {
            key: "pps_default_probability", title: "Probabilité", width: 110, align: "right",
            render: (value) => value != null ? `${value}%` : '-',
        },
        {
            key: "pps_is_default", title: "Par défaut", width: 110, align: "center",
            render: (value) => value == 1 ? <StarFilled style={{ color: '#faad14', fontSize: '18px' }} /> : null,
        },
        createEditActionColumn({ permission: "settings.prospectconf.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Étapes du pipeline" },
    ];

    return (
        <PageContainer
            title="Étapes du pipeline"
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
                fetchFn={(params) => prospectPipelineStagesApi.list(params)}
                columns={columns}
                defaultSort={{ field: 'pps_order', order: 'ASC' }}
                onRowClick={handleRowClick}
            />
            {drawerOpen && (
                <ProspectPipelineStage
                    open={drawerOpen}
                    onClose={closeDrawer}
                    stageId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
