import { useRef } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, SettingOutlined, CheckCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { taxsApi } from "../../services/api";
import Tax from "./Tax";

/**
 * Affiche la liste des taxes
 */
export default function Taxs() {
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

    const { handleRowClick } = useRowHandler(openForEdit, 'tax_id');

    const columns = [
        { key: "tax_label", title: "Libellé", ellipsis: true, filterType: "text" },
        { key: "tax_rate", title: "Taux (%)", width: 100, render: (value) => value ? `${value} %` : '-' },
        {
            key: "tax_use", title: "Usage", width: 110,
            filterType: "select",
            filterOptions: [
                { value: 'sale',     label: 'Ventes' },
                { value: 'purchase', label: 'Achats' },
            ],
            render: (value) => value === 'sale' ? 'Ventes' : value === 'purchase' ? 'Achats' : 'Inactif'
        },
        {
            key: "tax_exigibility", title: "Exigibilité", width: 130,
            filterType: "select",
            filterOptions: [
                { value: 'on_invoice', label: 'Sur facture' },
                { value: 'on_payment', label: 'Sur paiement' },
            ],
            render: (value) => value === 'on_payment' ? 'Sur paiement' : 'Sur facture'
        },
        {
            key: "tax_scope", title: "Portée", width: 110,
            filterType: "select",
            filterOptions: [
                { value: 'all',     label: 'Tous' },
                { value: 'conso',   label: 'Produits' },
                { value: 'service', label: 'Service' },
            ],
            render: (value) => value === 'conso' ? 'Produits' : value === 'service' ? 'Service' : 'Tous'
        },
        {
            key: "tax_is_active", title: "Actif", width: 70, align: "center",
            filterType: "select",
            filterOptions: [
                { value: 1, label: 'Actif' },
                { value: 0, label: 'Inactif' },
            ],
            render: (value) => value ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '18px' }} /> : ""
        },
        {
            key: "tax_is_default", title: "Défaut", width: 80, align: "center",
            render: (value) => value ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '18px' }} /> : ""
        },
        {
            key: "repartition_lines_count", title: "Ventilation", width: 130, align: "center",
            render: (value) => value > 0
                ? <Tag color="success" icon={<CheckCircleOutlined />}>Configuré</Tag>
                : <Tag color="warning" icon={<WarningOutlined />}>Manquant</Tag>
        },
        createEditActionColumn({ permission: "accountings.edit", onEdit: handleRowClick, mode: "table" })
    ];

    const breadcrumbItems = [
        { title: <Link to="/settings"><SettingOutlined /> Configuration</Link> },
        { title: "Taxes" }
    ];

    return (
        <PageContainer
            title="Taxes"
            breadcrumb={breadcrumbItems}
            actions={
                <CanAccess permission="accountings.create">
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
                fetchFn={taxsApi.list}
                onRowClick={handleRowClick}
                rowKey="tax_id"
                defaultSort={{ field: 'tax_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <Tax
                    open={drawerOpen}
                    onClose={closeDrawer}
                    taxId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
