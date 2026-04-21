import { useRef } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, StarFilled, SettingOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";

import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { warehousesApi } from "../../services/api";
import Warehouse from "./Warehouse";

/**
 * Affiche la liste des entrepôts avec une grid interactive
 */
export default function Warehouses() {
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

    const formatWarehouseType = (value) => {
        const types = {
            1: { label: 'Entrepôt principal', color: 'blue' },
            2: { label: 'Zone', color: 'green' },
            3: { label: 'Emplacement', color: 'orange' },
            4: { label: 'Virtuel', color: 'purple' }
        };
        const type = types[value] || { label: 'Inconnu', color: 'default' };
        return <Tag color={type.color}>{type.label}</Tag>;
    };

    const formatActive = (value) => {
        return value == 1 ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
        ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '18px' }} />
        );
    };

    const formatDefault = (value) => {
        return value == 1 ? (
            <StarFilled style={{ color: '#faad14', fontSize: '18px' }} />
        ) : null;
    };

    const columns = [
        { key: "whs_code", title: "Code", width: 120 },
        { key: "whs_label", title: "Nom", ellipsis: true, filterType: "text" },
        { key: "whs_type", title: "Type", width: 180, render: (value) => formatWarehouseType(value) },
        { key: "whs_city", title: "Ville", width: 150 },
        { key: "whs_is_active", title: "Actif", width: 80, align: "center", render: (value) => formatActive(value) },
        { key: "whs_is_default", title: "Par défaut", width: 100, align: "center", render: (value) => formatDefault(value) },
        createEditActionColumn({ permission: "stocks.edit", onEdit: handleRowClick, mode: "table" })
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Entrepôts" }
    ];

    return (
        <PageContainer
            title="Entrepôts"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="stocks.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Nouvel entrepôt
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={warehousesApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'whs_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <Warehouse
                    open={drawerOpen}
                    onClose={closeDrawer}
                    warehouseId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
