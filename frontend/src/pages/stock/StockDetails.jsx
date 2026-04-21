import { useState, useEffect, useRef } from "react";
import { Drawer, Spin, Descriptions, Tag } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { stocksApi } from "../../services/api";
import ServerTable from "../../components/table";
import { formatDate } from "../../utils/formatters";

/**
 * Drawer affichant les mouvements de stock d'un produit
 */
export default function StockMovements({ open, onClose, productId }) {
    const [loading, setLoading] = useState(true);
    const [stockInfo, setStockInfo] = useState(null);
    const gridRef = useRef(null);

    useEffect(() => {
        if (productId && open) {
            loadStockInfo();
        }
    }, [productId, open]);

    const loadStockInfo = async () => {
        setLoading(true);
        try {
            const stockData = await stocksApi.get(productId);
            setStockInfo(stockData.data || stockData);
        } catch (error) {
            console.error("Erreur chargement:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatQuantity = (value, record) => {
        if (value === null || value === undefined) return '-';
        const qty = parseFloat(value);
        const formatted = qty.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const isEntry = record.stm_direction === 1;
        return (
            <span style={{ color: isEntry ? 'green' : 'red', fontWeight: 'bold' }}>
                {isEntry ? '+' : '-'}{formatted}
            </span>
        );
    };

    const formatDirection = (value) => {
        const isEntry = value === 1;
        return isEntry
            ? <Tag color="green" icon={<ArrowUpOutlined />}>Entrée</Tag>
            : <Tag color="red" icon={<ArrowDownOutlined />}>Sortie</Tag>;
    };

    const formatPrice = (value) => {
        if (!value) return '-';
        return parseFloat(value).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' €';
    };

    const columns = [
        {
            key: "stm_date",
            title: "Date",
            width: 150,
            filterType: "date",
            render: (value) => formatDate(value),
        },
        { key: "stm_ref", title: "Référence", width: 120, filterType: "text" },
        {
            key: "stm_direction",
            title: "Type",
            width: 100,
            filterType: "select",
            filterOptions: [
                { value: "1", label: "Entrée" },
                { value: "-1", label: "Sortie" },
            ],
            render: (value) => formatDirection(value),
        },
        { key: "stm_label", title: "Libellé", filterType: "text", ellipsis: true },
        {
            key: "stm_qty",
            title: "Quantité",
            width: 120,
            align: "right",
            render: (value, record) => formatQuantity(value, record),
        },
        { key: "warehouse", title: "Entrepôt", width: 150, filterType: "text" },
        { key: "stm_origin_doc_ref", title: "Doc. Origine", width: 120, filterType: "text" },
        { key: "stm_lot_number", title: "Lot", width: 100, filterType: "text" },
        {
            key: "stm_unit_price",
            title: "Prix Unit.",
            width: 110,
            align: "right",
            filterType: "numeric",
            render: (value) => formatPrice(value),
        },
        {
            key: "stm_total_value",
            title: "Valeur Totale",
            width: 120,
            align: "right",
            filterType: "numeric",
            render: (value) => formatPrice(value),
        },
    ];

    const formatStockValue = (value, decimals = 2) => {
        if (value === null || value === undefined) return '0,00';
        return parseFloat(value).toLocaleString('fr-FR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    return (
        <Drawer
            title="Mouvements de Stock"
            size="large"
            open={open}
            onClose={onClose}
            destroyOnHidden
        >
            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Spin size="large" />
                </div>
            ) : (
                <>
                    <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
                        <Descriptions.Item label="Référence">
                            {stockInfo?.prt_ref || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Libellé">
                            {stockInfo?.prt_label || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Stock Physique">
                            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                                {formatStockValue(stockInfo?.psk_qty_physical)}
                            </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Valeur Totale">
                            {formatStockValue(stockInfo?.psk_total_value)} €
                        </Descriptions.Item>
                        <Descriptions.Item label="Prix Moyen">
                            {formatStockValue(stockInfo?.psk_average_price, 4)} €
                        </Descriptions.Item>
                        <Descriptions.Item label="Entrepôt">
                            {stockInfo?.warehouse_name || '-'}
                        </Descriptions.Item>
                    </Descriptions>

                    <ServerTable
                        ref={gridRef}
                        fetchFn={(params) => stocksApi.getMovements(productId, params)}
                        columns={columns}
                        defaultSort={{ field: 'stm_date', order: 'DESC' }}
                    />
                </>
            )}
        </Drawer>
    );
}
