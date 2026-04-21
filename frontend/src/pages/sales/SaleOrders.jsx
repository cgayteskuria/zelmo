import { useRef, useMemo } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import ServerTable from "../../components/table";
import { formatCurrency, formatDate } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import { formatStatus, formatInvoicingState, formatDeliveryState, STATUS_CONFIG, INVOICING_STATE_CONFIG, DELIVERY_STATE_CONFIG } from "../../configs/SaleOrderConfig.jsx";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { saleOrdersApi, saleQuotationsApi } from "../../services/api";

/**
 * Affiche la liste des commandes client (ord_status >= 3) ou devis (ord_status < 3)
 * Adapte son comportement selon l'URL : /sale-orders ou /sale-quotations
 */
export default function SaleOrders() {
    const gridRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Détecter si on est sur la page devis ou commandes
    const isQuotations = location.pathname.startsWith('/sale-quotations');

    const saleOrderType = useMemo(() => {
        if (location.pathname.startsWith('/sale-quotations')) return 'quotations';
        if (location.pathname.startsWith('/sale-orders')) return 'orders';
    }, [location.pathname]);

    // Configuration selon le type de page
    const config = useMemo(() => {
        if (isQuotations) {
            return {
                title: "Devis clients",
                buttonLabel: "Ajouter un devis",
                showAddButton: true,
                showInvoicingColumn: false,
                showDeliveryColumn: false,
                api: saleQuotationsApi,
                basePath: '/sale-quotations'
            };
        }
        return {
            title: "Commandes clients",
            buttonLabel: null,
            showAddButton: false,
            showInvoicingColumn: true,
            showDeliveryColumn: true,
            api: saleOrdersApi,
            basePath: '/sale-orders'
        };
    }, [isQuotations]);

    // Handler pour créer un nouveau devis/commande
    const handleCreate = () => {
        navigate(`${config.basePath}/new`);
    };

    // Handler pour ouvrir un devis/commande existant
    const handleRowClick = (row) => {
        const rows = gridRef.current?.getData() || [];
        const ids = rows.map(r => r.id);
        const currentIndex = ids.indexOf(row.id);
        navigate(`${config.basePath}/${row.id}`, {
            state: { ids, currentIndex, basePath: config.basePath },
        });
    };

    // Colonnes dynamiques selon le type de page
    const columns = useMemo(() => {
        const baseColumns = [
            {
                key: "ord_number",
                title: "Numéro",
                width: 100,
                filterType: "text",
            },
            {
                key: "ord_date",
                title: "Date",
                align: "center",
                width: 120,
                filterType: "date",
                render: (value) => formatDate(value),
            },
            {
                key: "ptr_name",
                title: "Client",
                filterType: "text",
                ellipsis: true,
            },
            {
                key: "ord_refclient",
                title: "Réf. Client",
                width: 150,
                filterType: "text",
            },
            {
                key: "ord_status",
                title: "Statut",
                width: 140,
                align: "center",
                filterType: "select",
                filterOptions: Object.entries(STATUS_CONFIG)
                    .filter(([k]) => k !== 'null')
                    .map(([k, v]) => ({ value: String(k), label: v.label })),
                render: (value) => formatStatus(value),
            },
        ];

        // Ajouter les colonnes conditionnelles
        if (config.showInvoicingColumn) {
            baseColumns.push({
                key: "ord_invoicing_state",
                title: "Facturation",
                align: "center",
                width: 150,
                filterType: "select",
                filterOptions: Object.entries(INVOICING_STATE_CONFIG)
                    .filter(([k]) => k !== 'null')
                    .map(([k, v]) => ({ value: String(k), label: v.label })),
                render: (value) => formatInvoicingState(value),
            });
        }
        if (config.showDeliveryColumn) {
            baseColumns.push({
                key: "ord_delivery_state",
                title: "Livraison",
                align: "center",
                width: 130,
                filterType: "select",
                filterOptions: Object.entries(DELIVERY_STATE_CONFIG)
                    .filter(([k]) => k !== 'null')
                    .map(([k, v]) => ({ value: String(k), label: v.label })),
                render: (value) => formatDeliveryState(value),
            });
        }

        // Ajouter les colonnes de fin
        baseColumns.push(
            {
                key: "ord_totalht",
                title: "Total HT",
                width: 120,
                align: "right",
                filterType: "numeric",
                render: (value) => formatCurrency(value),
            },
            {
                key: "ord_totalttc",
                title: "Total TTC",
                width: 120,
                align: "right",
                filterType: "numeric",
                render: (value) => formatCurrency(value),
            },
            createEditActionColumn({ permission: "sale-orders.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
        );

        return baseColumns;
    }, [config, handleRowClick]);

    return (
        <PageContainer
            title={config.title}
            actions={
                config.showAddButton ? (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        size="large"
                    >
                        {config.buttonLabel}
                    </Button>
                ) : null
            }
        >
            <ServerTable
                key={saleOrderType}
                ref={gridRef}
                fetchFn={(params) => config.api.list(params)}
                columns={columns}
                defaultSort={{ field: 'ord_number', order: 'DESC' }}
                onRowClick={handleRowClick}
            />
        </PageContainer>
    );
}
