import { useRef, useMemo } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import ServerTable from "../../components/table";
import { formatCurrency, formatDate } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import { formatStatus, STATUS_CONFIG } from "../../configs/ContractConfig.jsx";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { customerContractsApi, supplierContractsApi } from "../../services/api";

/**
 * Affiche la liste des contrats clients (con_operation = 1) ou fournisseurs (con_operation = 2)
 * Adapte son comportement selon l'URL : /customercontracts ou /suppliercontracts
 */
export default function Contracts() {
    const gridRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Détecter si on est sur la page contrats clients ou fournisseurs
    const isSupplierContracts = location.pathname.startsWith('/suppliercontracts');

    // Configuration selon le type de page
    const config = useMemo(() => {
        if (isSupplierContracts) {
            return {
                title: "Contrats fournisseurs",
                buttonLabel: "Ajouter un contrat fournisseur",
                showAddButton: true,
                api: supplierContractsApi,
                basePath: '/suppliercontracts'
            };
        }
        return {
            title: "Contrats clients",
            buttonLabel: "Ajouter un contrat client",
            showAddButton: true,
            api: customerContractsApi,
            basePath: '/customercontracts'
        };
    }, [isSupplierContracts]);

    // Handler pour créer un nouveau contrat
    const handleCreate = () => {
        const operation = isSupplierContracts ? 2 : 1;
        navigate(`${config.basePath}/new?con_operation=${operation}`);
    };

    // Handler pour ouvrir un contrat existant
    const handleRowClick = (row) => {
        navigate(`${config.basePath}/${row.id}`);
    };

    // Colonnes du tableau
    const columns = useMemo(() => [
        {
            key: "con_number",
            title: "Réf",
            width: 100,
            filterType: "text",
        },
        {
            key: "con_date",
            title: "Date",
            align: "center",
            width: 120,
            filterType: "date",
            render: (value) => formatDate(value),
        },
        {
            key: "ptr_name",
            title: "Tiers",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "con_status",
            title: "Statut",
            width: 150,
            align: "center",
            filterType: "select",
            filterOptions: Object.entries(STATUS_CONFIG)
                .filter(([k]) => k !== 'null')
                .map(([k, v]) => ({ value: String(k), label: v.label })),
            render: (value) => formatStatus(value),
        },
        {
            key: "con_totalhtsub",
            title: "Total Abonnement",
            width: 160,
            align: "right",
            filterType: "numeric",
            render: (value) => formatCurrency(value),
        },
        {
            key: "con_totalht",
            title: "Total HT",
            width: 120,
            align: "right",
            filterType: "numeric",
            render: (value) => formatCurrency(value),
        },
        {
            key: "con_totalttc",
            title: "Total TTC",
            width: 120,
            align: "right",
            filterType: "numeric",
            render: (value) => formatCurrency(value),
        },
        {
            key: "con_next_invoice_date",
            title: "Prochaine facture",
            align: "center",
            width: 150,
            filterType: "date",
            render: (value) => formatDate(value),
        },
        createEditActionColumn({ permission: "contracts.edit", onEdit: handleRowClick, idField: "id", mode: "table" }),
    ], [handleRowClick]);

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
                key={isSupplierContracts ? 'supplier-contracts' : 'customer-contracts'}
                ref={gridRef}
                fetchFn={(params) => config.api.list(params)}
                columns={columns}
                defaultSort={{ field: 'con_number', order: 'DESC' }}
                onRowClick={handleRowClick}
            />
        </PageContainer>
    );
}
