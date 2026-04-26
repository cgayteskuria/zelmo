import { useRef, useMemo, useState, lazy, Suspense } from "react";
import { Button, Dropdown, Space, Tag, Tooltip } from "antd";
import { PlusOutlined, DownOutlined, FilePdfOutlined, CloudUploadOutlined, EditOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import ServerTable from "../../components/table";
import { formatCurrency, formatDate } from "../../utils/formatters";
import PageContainer from "../../components/common/PageContainer";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import CanAccess from "../../components/common/CanAccess";

import { formatStatus, formatPaymentStatus, STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "../../configs/InvoiceConfig.jsx";
import { customerInvoicesApi, supplierInvoicesApi } from "../../services/api";

const InvoiceOcrImportDrawer = lazy(() => import("../../components/bizdocument/InvoiceOcrImportDrawer"));

/**
 * Affiche la liste des factures client ou fournisseur
 * Adapte son comportement selon l'URL : /customer-invoices ou /supplier-invoices
 */
export default function Invoices() {
    const gridRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const [ocrDrawerOpen, setOcrDrawerOpen] = useState(false);

    // Détecter si on est sur les factures client ou fournisseur
    const isCustomer = location.pathname.startsWith('/customer-invoices');

    // Détecter le type de paiement selon l'URL
    const invoiceType = useMemo(() => {
        if (location.pathname.startsWith('/customer-invoices')) return 'customer';
        if (location.pathname.startsWith('/supplier-invoices')) return 'supplier';
    }, [location.pathname]);


    // Configuration selon le type de page
    const config = useMemo(() => {
        if (isCustomer) {
            return {
                title: "Factures & avoirs clients",
                buttonLabel: "Ajouter une facture",
                showAddButton: true,
                api: customerInvoicesApi,
                basePath: '/customer-invoices'
            };
        }
        return {
            title: "Factures & avoirs fournisseurs",
            buttonLabel: "Ajouter une facture",
            showAddButton: true,
            api: supplierInvoicesApi,
            basePath: '/supplier-invoices'
        };
    }, [isCustomer]);

    // Handler pour créer une nouvelle facture
    const handleCreate = () => {
        // 1 => custinvoice, 3 => supplierinvoice
        const operation = isCustomer ? 1 : 3;
        navigate(`${config.basePath}/new?inv_operation=${operation}`);
    };

    // Handler pour créer un avoir
    const handleCreateRefund = () => {
        // 2 => custrefund, 4 => supplierrefund
        const operation = isCustomer ? 2 : 4;
        navigate(`${config.basePath}/new?inv_operation=${operation}`);
    };

    // Handler pour créer une facture d'acompte
    const handleCreateDeposit = () => {
        // 5 => custdeposit, 6 => supplierdeposit
        const operation = isCustomer ? 5 : 6;
        navigate(`${config.basePath}/new?inv_operation=${operation}`);
    };

    // Handler pour importer depuis PDF (OCR)
    const handleImportFromPdf = () => {
        setOcrDrawerOpen(true);
    };

    // Handler pour le succès de l'import OCR
    const handleOcrImportSuccess = (data) => {
        setOcrDrawerOpen(false);
        // Naviguer vers la facture créée
        navigate(`${config.basePath}/${data.inv_id}`);
        // Rafraîchir la grille
        gridRef.current?.reload();
    };

    // Handler pour ouvrir une facture existante
    const handleRowClick = (row) => {
        const rows = gridRef.current?.getData() || [];
        const ids = rows.map(r => r.id);
        const currentIndex = ids.indexOf(row.id);
        navigate(`${config.basePath}/${row.id}`, {
            state: { ids, currentIndex, basePath: config.basePath },
        });
    };

    // Colonnes
    const columns = useMemo(() => [
        {
            key: "inv_number",
            title: "Numéro",
            width: 120,
            filterType: "text",
        },
        {
            key: "ptr_name",
            title: isCustomer ? "Client" : "Fournisseur",
            filterType: "text",
            ellipsis: true,
        },
        {
            key: "inv_externalreference",
            title: "Réf. externe",
            width: 200,
            filterType: "text",
        },
        {
            key: "inv_date",
            title: "Date",
            align: "center",
            width: 120,
            filterType: "date",
            render: (value) => formatDate(value),
        },
        {
            key: "inv_duedate",
            title: "Échéance",
            align: "center",
            width: 120,
            filterType: "date",
            render: (value, record) => {
                if (!value) return '';
                const formatted = formatDate(value);
                const progress = parseFloat(record?.inv_payment_progress) || 0;
                const today = new Date();
                const dueDateObj = new Date(value);
                if (progress < 100 && dueDateObj < today) {
                    return <span style={{ color: 'red', fontWeight: 'bold' }}>{formatted}</span>;
                }
                return formatted;
            },
        },
        {
            key: "inv_totalht",
            title: "Total HT",
            width: 120,
            align: "right",
            filterType: "numeric",
            render: (value) => formatCurrency(value),
        },
        {
            key: "inv_totalttc",
            title: "Total TTC",
            width: 120,
            align: "right",
            filterType: "numeric",
            render: (value) => formatCurrency(value),
        },
        {
            key: "inv_status",
            title: "Statut",
            width: 120,
            align: "center",
            filterType: "select",
            filterOptions: Object.entries(STATUS_CONFIG)
                .filter(([key]) => key !== 'null')
                .map(([key, cfg]) => ({ value: String(key), label: cfg.label })),
            render: (value) => formatStatus(value),
        },
        {
            key: "inv_payment_progress",
            title: "Paiement",
            width: 120,
            align: "center",
            filterType: "select",
            filterOptions: [
                { value: "0", label: PAYMENT_STATUS_CONFIG[0].label },
                { value: "partial", label: PAYMENT_STATUS_CONFIG.partial.label },
                { value: "100", label: PAYMENT_STATUS_CONFIG[100].label },
            ],
            render: (value) => formatPaymentStatus(value),
        },
        ...(isCustomer ? [{
            key: "eit_status",
            title: (
                <Tooltip title="Statut e-facturation (PDP)">
                    <CloudUploadOutlined />
                </Tooltip>
            ),
            width: 60,
            align: "center",
            render: (value) => {
                if (!value) return null;
                const colors = {
                    ACCEPTEE: "success", PAYEE: "success",
                    REFUSEE: "error", LITIGE: "error", ERROR: "error",
                    EN_PAIEMENT: "warning",
                    QUALIFIEE: "processing", MISE_A_DISPO: "processing",
                    DEPOSEE: "default", PENDING: "default",
                };
                const labels = {
                    ACCEPTEE: "Acceptée", PAYEE: "Payée",
                    REFUSEE: "Refusée", LITIGE: "Litige", ERROR: "Erreur",
                    EN_PAIEMENT: "En paiement",
                    QUALIFIEE: "Qualifiée", MISE_A_DISPO: "Dispo.",
                    DEPOSEE: "Déposée", PENDING: "En attente",
                };
                return (
                    <Tooltip title={`PDP : ${labels[value] ?? value}`}>
                        <Tag color={colors[value] ?? "default"} style={{ fontSize: 10, padding: "0 4px" }}>
                            {labels[value] ?? value}
                        </Tag>
                    </Tooltip>
                );
            },
        }] : []),
        {
            key: "actions",
            title: " ",
            width: 50,
            fixed: "right",
            sortable: false,
            render: (_, record) => {
                if (record.eit_status) return null;
                return (
                    <CanAccess permission="invoices.edit">
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleRowClick(record); }}
                        />
                    </CanAccess>
                );
            },
        },
    ], [isCustomer, handleRowClick]);

    // Menu items pour le dropdown
    const menuItems = [
        {
            key: 'refund',
            label: 'Ajouter un avoir',
            icon: <PlusOutlined />,
        },
        {
            key: 'deposit',
            label: "Ajouter une facture d'acompte",
            icon: <PlusOutlined />,
        },
    ];

    // Handler pour le menu dropdown
    const handleMenuClick = ({ key }) => {
        if (key === 'refund') {
            handleCreateRefund();
        } else if (key === 'deposit') {
            handleCreateDeposit();
        }

    };

    return (
        <PageContainer
            title={config.title}
            actions={
                config.showAddButton ? (
                    <Space>
                        {!isCustomer && (
                            <Button
                                type="secondary"
                                size="large"
                                icon={<FilePdfOutlined />}
                                onClick={handleImportFromPdf}
                            >
                                Ajouter depuis un PDF
                            </Button>
                        )}
                        <Space.Compact>
                            <Button
                                type="primary"
                                size="large"
                                onClick={handleCreate}
                            >
                                <PlusOutlined /> {config.buttonLabel}
                            </Button>
                            <Dropdown
                                menu={{ items: menuItems, onClick: handleMenuClick }}
                                placement="bottomRight">
                                <Button
                                    type="primary"
                                    size="large"
                                    style={{ backgroundColor: '#FFFFFF' }}
                                    icon={<DownOutlined />}
                                />
                            </Dropdown>
                        </Space.Compact>

                    </Space>
                ) : null
            }
        >

            <ServerTable
                key={invoiceType}
                ref={gridRef}
                fetchFn={(params) => config.api.list(params)}
                columns={columns}
                defaultSort={{ field: 'inv_number', order: 'DESC' }}
                onRowClick={handleRowClick}
            />

            {/* Drawer pour import OCR (factures fournisseur uniquement) */}
            {!isCustomer && ocrDrawerOpen && (
                <Suspense >
                    <InvoiceOcrImportDrawer
                        open={ocrDrawerOpen}
                        onClose={() => setOcrDrawerOpen(false)}
                        onSuccess={handleOcrImportSuccess}
                    />
                </Suspense>
            )}
        </PageContainer>
    );
}
