import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {  formatDate } from "../../utils/formatters";

import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";

import { useRowHandler } from "../../hooks/useRowHandler";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import StockMovements from "./StockDetails";
import { stocksApi } from "../../services/api";

/**
 * Page affichant la liste des stocks avec calculs de stock physique et virtuel
 */
export default function Stocks() {
    const gridRef = useRef(null);
    const navigate = useNavigate();

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForEdit
    } = useDrawerManager();

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };
    const { handleRowClick } = useRowHandler(openForEdit, "id");

    const formatStock = (value, record) => {
        if (value === null || value === undefined) return '-';

        const qty = parseFloat(value);
        const formatted = qty.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (record.prt_stock_alert_threshold && qty <= record.prt_stock_alert_threshold) {
            return <span style={{ color: 'red', fontWeight: 'bold' }}>{formatted}</span>;
        }

        return formatted;
    };

    const formatStockVirtual = (value, record) => {
        if (value === null || value === undefined) return '-';

        const qty = parseFloat(value);
        const formatted = qty.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        let color = 'green';
        let fontWeight = 'normal';

        if (qty < 0) {
            color = 'red';
            fontWeight = 'bold';
        } else if (qty === 0) {
            color = 'orange';
            fontWeight = 'bold';
        } else if (record.prt_stock_alert_threshold && qty <= record.prt_stock_alert_threshold) {
            color = 'orange';
        }

        return <span style={{ color, fontWeight }}>{formatted}</span>;
    };

    const columns = [
        { key: "prt_ref", title: "Réf Produit", width: 150, filterType: "text" },
        { key: "prt_label", title: "Libellé produit", ellipsis: true, filterType: "text" },
        { key: "prt_stock_alert_threshold", title: "Seuil d'alerte", width: 150, render: (value, record) => formatStock(value, record) },
        { key: "stock_physical", title: "Stock Physique", width: 150, render: (value, record) => formatStock(value, record) },
        { key: "stock_virtual", title: "Stock Virtuel", width: 150, render: (value, record) => formatStockVirtual(value, record) },
        { key: "last_entry_date", title: "Dernière entrée", width: 130, filterType: "date", render: (value) => formatDate(value) },
        { key: "last_exit_date", title: "Dernière sortie", width: 130, filterType: "date", render: (value) => formatDate(value) },
        createEditActionColumn({ permission: "products.edit", type: "view", header: "Mouvmt.", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Gestion des Stocks"
            actions={
                <CanAccess permission="products.create">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => navigate('/products')}
                        size="large"
                    >
                        Nouveau Produit
                    </Button>
                </CanAccess>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={stocksApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'prt_label', order: 'ASC' }}
            />

            {drawerOpen && (
                <StockMovements
                    open={drawerOpen}
                    onClose={closeDrawer}
                    productId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
