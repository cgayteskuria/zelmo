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

import { chargeTypesApi } from "../../services/api";
import ChargeType from "./ChargeType";

/**
 * Affiche la liste des types de charges
 */
export default function ChargeTypes() {
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

    const { handleRowClick } = useRowHandler(openForEdit, 'cht_id');

    const columns = [
        { key: "cht_label", title: "Libellé", ellipsis: true, filterType: "text" },
        {
            key: "account",
            title: "Compte comptable",
            width: 200,
            render: (value) => value ? `${value.acc_code} - ${value.acc_label}` : '-'
        },
        createEditActionColumn({ permission: "settings.charges.edit", onEdit: handleRowClick, mode: "table" })
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Types de charges" }
    ];

    return (
        <PageContainer
            title="Types de charges"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="settings.charges.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Ajouter
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={chargeTypesApi.list}
                onRowClick={handleRowClick}
                rowKey="cht_id"
                defaultSort={{ field: 'cht_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <ChargeType
                    open={drawerOpen}
                    onClose={closeDrawer}
                    onSubmit={handleFormSubmit}
                    chargeTypeId={selectedItemId}
                />
            )}
        </PageContainer>
    );
}
