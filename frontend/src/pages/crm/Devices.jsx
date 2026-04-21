import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { formatDate } from "../../utils/formatters";

import { devicesApi } from "../../services/api";
import Device from "./Device";

/**
 * Affiche la liste des appareils
 */
export default function Devices() {
    const gridRef = useRef(null);

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit
    } = useDrawerManager();

    const handleFormSubmit = async () => {
        gridRef.current?.reload();
    };

    const { handleRowClick } = useRowHandler(openForEdit);

    const columns = [
        { key: "ptr_name", title: "Client", filterType: "text", ellipsis: true },
        { key: "dev_hostname", title: "Hostname", filterType: "text", ellipsis: true },
        { key: "dev_lastloggedinuser", title: "Last Logged User", filterType: "text", ellipsis: true },
        { key: "dev_os", title: "OS", filterType: "text", ellipsis: true },
        {
            key: "dev_lastseen",
            title: "Dernière vue",
            width: 140,
            align: "center",
            filterType: "date",
            render: (value) => formatDate(value),
        },
        createEditActionColumn({ permission: "devices.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ];

    return (
        <PageContainer
            title="Appareils"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openForCreate}
                    size="large"
                >
                    Ajouter un appareil
                </Button>
            }
        >
            <ServerTable
                ref={gridRef}
                fetchFn={(params) => devicesApi.list(params)}
                columns={columns}
                defaultSort={{ field: 'dev_hostname', order: 'ASC' }}
                onRowClick={handleRowClick}
            />

            {drawerOpen && (
                <Device
                    open={drawerOpen}
                    onClose={closeDrawer}
                    deviceId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
