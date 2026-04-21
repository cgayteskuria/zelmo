import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined, SettingOutlined } from "@ant-design/icons";
import { Link, useParams } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { durationsApi } from "../../services/api";
import Duration from "./Duration";

/**
 * Mapping des types de durées
 */
const DURATION_TYPES = {
    'commitment-durations': {
        label: 'Durées d\'abonnement',
        permission: 'settings.contractconf'
    },
    'notice-durations': {
        label: 'Durées de préavis',
        permission: 'settings.contractconf'
    },
    'renew-durations': {
        label: 'Durées de renouvellement',
        permission: 'settings.contractconf'
    },
    'invoicing-durations': {
        label: 'Fréquences de facturation',
        permission: 'settings.contractconf'
    },
    'payment-conditions': {
        label: 'Conditions de paiement',
        permission: 'settings.invoiceconf'
    },
};

/**
 * Affiche la liste des durées filtrées par type
 */
export default function Durations() {
    const { type } = useParams();
    const gridRef = useRef(null);

    const typeConfig = DURATION_TYPES[type] || {
        label: 'Durées',
        permission: 'settings'
    };

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

    const { handleRowClick } = useRowHandler(openForEdit, 'dur_id');

    const timeUnitFormatter = (value) => {
        const units = {
            'day': 'Jour(s)',
            'monthly': 'Mois',
            'annually': 'Année(s)'
        };
        return units[value] || value;
    };

    const modeFormatter = (value) => {
        const modes = {
            'advance': 'À terme échu',
            'arrears': 'À terme à échoir',
            '': '-'
        };
        return modes[value] || value || '-';
    };

    const columns = [
        { key: "dur_label", title: "Libellé", ellipsis: true, filterType: "text" },
        { key: "dur_value", title: "Valeur", width: 100 },
        { key: "dur_time_unit", title: "Unité", width: 120, render: (value) => timeUnitFormatter(value) },
        { key: "dur_mode", title: "Mode", width: 150, render: (value) => modeFormatter(value) },
        { key: "dur_order", title: "Ordre", width: 100 },
        createEditActionColumn({ permission: `${typeConfig.permission}.edit`, onEdit: handleRowClick, mode: "table" })
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: typeConfig.label }
    ];

    return (
        <PageContainer
            title={typeConfig.label}
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission={`${typeConfig.permission}.create`}>
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
                key={type}
                ref={gridRef}
                columns={columns}
                fetchFn={(params) => durationsApi.list(type, params)}
                onRowClick={handleRowClick}
                rowKey="dur_id"
                defaultSort={{ field: 'dur_order', order: 'ASC' }}
            />

            {drawerOpen && (
                <Duration
                    open={drawerOpen}
                    onClose={closeDrawer}
                    durationId={selectedItemId}
                    durationType={type}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
