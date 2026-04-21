import { useRef, useMemo } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import ServerTable from "../../components/table";
import { formatCurrency, formatDate } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import {
    formatStatus,
    formatDeliveryState,
    formatInvoicingState,
    STATUS_CONFIG,
    DELIVERY_STATE_CONFIG,
    INVOICING_STATE_CONFIG,
} from "../../configs/PurchaseOrderConfig.jsx";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { purchaseQuotationsApi, purchaseOrdersApi } from "../../services/api";

/**
 * Affiche la liste des devis/commandes fournisseurs
 * Adapte son comportement selon l'URL : /purchase-quotations ou /purchase-orders
 */
export default function PurchaseOrders() {
    const gridRef = useRef(null);
    const navigate = useNavigate();

    // Détecter si on est sur la page devis ou commandes
    const isQuotations = location.pathname.startsWith('/purchase-quotations');

    // Configuration selon le type de page
    const config = useMemo(() => {
        if (isQuotations) {
            return {
                title: "Devis fournisseurs",
                buttonLabel: "Ajouter un devis",
                showAddButton: true,
                showInvoicingColumn: false,
                showReceptionColumn: false,
                api: purchaseQuotationsApi,
                basePath: '/purchase-quotations'
            };
        }
        return {
            title: "Commandes fournisseurs",
            buttonLabel: null,
            showAddButton: false,
            showInvoicingColumn: true,
            showReceptionColumn: true,
            api: purchaseOrdersApi,
            basePath: '/purchase-orders'
        };
    }, [isQuotations]);

    // Handler pour créer un nouveau devis
    const handleCreate = () => {
        navigate(`${config.basePath}/new`);
    };

    // Handler pour ouvrir une commande/devis existant
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
                key: "por_number",
                title: "Numéro",
                width: 100,
                filterType: "text",
            },
            {
                key: "por_date",
                title: "Date",
                align: "center",
                width: 120,
                filterType: "date",
                render: (value) => formatDate(value),
            },
            {
                key: "ptr_name",
                title: "Fournisseur",
                filterType: "text",
                ellipsis: true,
            },
            {
                key: "por_externalreference",
                title: "Réf. Fournisseur",
                width: 150,
                filterType: "text",
            },
            {
                key: "por_status",
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

        if (config.showReceptionColumn) {
            baseColumns.push({
                key: "por_reception_state",
                title: "Réception",
                align: "center",
                width: 130,
                filterType: "select",
                filterOptions: Object.entries(DELIVERY_STATE_CONFIG)
                    .filter(([k]) => k !== 'null')
                    .map(([k, v]) => ({ value: String(k), label: v.label })),
                render: (value) => formatDeliveryState(value),
            });
        }

        if (config.showInvoicingColumn) {
            baseColumns.push({
                key: "por_invoicing_state",
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

        baseColumns.push(
            {
                key: "por_totalht",
                title: "Total HT",
                width: 120,
                align: "right",
                filterType: "numeric",
                render: (value) => formatCurrency(value),
            },
            {
                key: "por_totalttc",
                title: "Total TTC",
                width: 120,
                align: "right",
                filterType: "numeric",
                render: (value) => formatCurrency(value),
            },
            createEditActionColumn({ permission: "purchase-orders.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
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
                key={isQuotations ? 'purchase-quotations' : 'purchase-orders'}
                ref={gridRef}
                fetchFn={(params) => config.api.list(params)}
                columns={columns}
                defaultSort={{ field: 'por_number', order: 'DESC' }}
                onRowClick={handleRowClick}
            />
        </PageContainer>
    );
}
