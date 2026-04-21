import { useRef, useState } from "react";
import { Button, Tag, Space } from "antd";
import { PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, SwapOutlined } from "@ant-design/icons";
import {  formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useDrawerManager } from "../../hooks/useDrawerManager";
import { useRowHandler } from "../../hooks/useRowHandler";
import CanAccess from "../../components/common/CanAccess";
import { stockMovementsApi } from "../../services/api";
import StockMovement from "./StockMovement";
import StockTransfer from "./StockTransfer";

/**
 * Page de liste des mouvements de stock
 */
export default function StockMovementsList() {
    const gridRef = useRef(null);
    const [transferOpen, setTransferOpen] = useState(false);

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

    const { handleRowClick } = useRowHandler(openForEdit, "id");

    const formatQuantity = (value, record) => {
        if (value === null || value === undefined) return '-';

        const qty = parseFloat(value);
        const formatted = qty.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const isEntry = record.stm_direction === 1;
        return (
            <span style={{
                color: isEntry ? 'green' : 'red',
                fontWeight: 'bold'
            }}>
                {isEntry ? '+' : '-'}{formatted}
            </span>
        );
    };

    const formatDirection = (value) => {
        const isEntry = value === 1;
        return isEntry ? (
            <Tag color="green" icon={<ArrowUpOutlined />}>Entrée</Tag>
        ) : (
            <Tag color="red" icon={<ArrowDownOutlined />}>Sortie</Tag>
        );
    };

    const formatPrice = (value) => {
        if (!value) return '-';
        return parseFloat(value).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' €';
    };

    const columns = [
        { key: "stm_date", title: "Date", width: 120, filterType: "date", render: (value) => formatDate(value) },
        { key: "prt_ref", title: "Réf Produit", width: 120, filterType: "text" },
        { key: "prt_label", title: "Produit", ellipsis: true, filterType: "text" },
        { key: "stm_direction", title: "Type", width: 100, render: (value) => formatDirection(value) },
        { key: "stm_qty", title: "Quantité", width: 120, align: 'right', render: (value, record) => formatQuantity(value, record) },
        { key: "warehouse_name", title: "Entrepôt", width: 150 },
        { key: "stm_label", title: "Libellé", width: 200 },
        { key: "stm_origin_doc_ref", title: "Doc. Origine", width: 120 },
        { key: "stm_unit_price", title: "Prix Unit.", width: 100, align: 'right', render: (value) => formatPrice(value) },
        { key: "stm_total_value", title: "Valeur", width: 100, align: 'right', render: (value) => formatPrice(value) },
    ];

    return (
        <PageContainer
            title="Mouvements de Stock"
            actions={
                <Space>
                    <CanAccess permission="stocks.create">
                        <Button
                            icon={<SwapOutlined />}
                            onClick={() => setTransferOpen(true)}
                            size="large"
                        >
                            Transfert inter-entrepôts
                        </Button>
                    </CanAccess>
                    <CanAccess permission="stocks.create">
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={openForCreate}
                            size="large"
                        >
                            Nouveau mouvement
                        </Button>
                    </CanAccess>
                </Space>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={stockMovementsApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'stm_date', order: 'DESC' }}
            />

            {drawerOpen && (
                <StockMovement
                    open={drawerOpen}
                    onClose={closeDrawer}
                    movementId={selectedItemId}
                    onSubmit={handleFormSubmit}
                />
            )}

            {transferOpen && (
                <StockTransfer
                    open={transferOpen}
                    onClose={() => setTransferOpen(false)}
                    onSubmit={handleFormSubmit}
                />
            )}
        </PageContainer>
    );
}
