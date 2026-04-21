import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined, CloseCircleOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { formatCurrency,formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import CanAccess from "../../components/common/CanAccess";

import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { productsApi } from "../../services/api";
import Product from "./Product";

/**
 * Affiche la liste des produits avec une grid interactive
 */
export default function Products() {
    const gridRef = useRef(null);

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForCreate,
        openForEdit
    } = useDrawerManager();

    const formatBool = (value) => {
        return value == 1 ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
        ) : (
            ""
        );
    };

    const formatActive = (value) => {
        return value == 1 ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
        ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '18px' }} />
        );
    };

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };
    const { handleRowClick } = useRowHandler(openForEdit);

    const columns = [
        { key: "prt_is_active", title: "Actif", width: 80, align: "center", render: (value) => formatActive(value) },
        { key: "prt_ref", title: "Réf", width: 120, filterType: "text" },
        {
            key: "prt_type",
            title: "Type",
            width: 120,
            filterType: "select",
            filterOptions: [
                { value: "conso", label: "Produit" },
                { value: "service", label: "Service" },
            ],
            render: (value) => value === "service" ? "Service" : "Produit",
        },
        { key: "prt_label", title: "Produit", ellipsis: true, filterType: "text" },
        { key: "prt_priceunitht", title: "Px Unit. HT", width: 150, render: (value) => formatCurrency(value) },
        { key: "prt_subscription", title: "Abo.", width: 80, align: "center", render: (value) => formatBool(value) },
        {
            key: "stock_physical",
            title: "Stock Physique",
            width: 150,
            render: (value, record) => {
                if (!record.prt_stockable) return "";
                return new Intl.NumberFormat('fr-FR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(value || 0);
            }
        },
        {
            key: "stock_virtual",
            title: "Stock virtuel",
            width: 150,
            render: (value, record) => {
                if (!record.prt_stockable) return "";
                return new Intl.NumberFormat('fr-FR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(value || 0);
            }
        },
        createEditActionColumn({ permission: "products.view", onEdit: handleRowClick, mode: "table" }),
    ];

    return (
        <PageContainer
            title="Produits & services"
            actions={
                <CanAccess permission="products.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openForCreate}
                        size="large"
                    >
                        Ajouter un Produit
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={productsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'prt_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <Product
                    open={drawerOpen}
                    onClose={closeDrawer}
                    productId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
