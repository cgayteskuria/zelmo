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
import { taxPositionApi } from "../../services/api";
import TaxPosition from "./TaxPosition";

/**
 * Affiche la liste des positions fiscales avec une grid interactive
 */
export default function TaxPositions() {
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
        { key: "tap_label", title: "Libellé", ellipsis: true, filterType: "text" },      
        createEditActionColumn({ permission: "settings.taxs.edit", onEdit: handleRowClick, mode: "table" })
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Position fiscale" }
    ];

    return (
        <PageContainer
            title="Positions fiscales"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.taxs.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Ajouter une position fiscale
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={taxPositionApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'tap_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <TaxPosition
                    open={drawerOpen}
                    onClose={closeDrawer}
                    taxPositionId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
