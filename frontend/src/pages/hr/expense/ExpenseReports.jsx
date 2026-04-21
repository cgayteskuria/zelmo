import {  useMemo, useState, useEffect, lazy, Suspense } from "react";
import { Button, Space, Select, DatePicker, Input, Table, Spin, Grid } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { formatCurrency,formatDate } from "../../../utils/formatters";
import PageContainer from "../../../components/common/PageContainer";
import { formatStatus, formatPaymentStatus, STATUS_FILTER_OPTIONS } from "../../../configs/ExpenseConfig";
import CanAccess from "../../../components/common/CanAccess";
import { expenseReportsApi, myExpenseReportsApi } from "../../../services/api";
import { createEditActionColumn } from "../../../components/table/EditActionColumn";

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

// Lazy load du composant mobile
const ExpenseReportsMobileView = lazy(() => import("./ExpenseReportsMobileView"));

/**
 * Affiche la liste des notes de frais
 */
export default function ExpenseReports() {
    const navigate = useNavigate();
    const location = useLocation();
    const screens = useBreakpoint();
    const isMobile = !screens.md; // md = 768px

    // Détecter le type de paiement selon l'URL
    const expenseType = useMemo(() => {
        if (location.pathname.startsWith('/expense-reports')) return 'expense-reports';
        if (location.pathname.startsWith('/my-expense-reports')) return 'my-expense-reports';
    }, [location.pathname]);

    // États
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });
    const [sorter, setSorter] = useState({});
    const [filters, setFilters] = useState({
        status: undefined,
        dateRange: undefined,
        search: undefined
    });

    // Handler pour créer une nouvelle note de frais
    const handleCreate = () => {
        navigate(`/${expenseType}/new`);
    };

    // Handler pour ouvrir une note de frais existante
    const handleRowClick = (record) => {
        const ids = data.map(r => r.id);
        const currentIndex = ids.indexOf(record.id);
        navigate(`/${expenseType}/${record.id}`, {
            state: { ids, currentIndex, basePath: `/${expenseType}` },
        });
    };

    // Handler pour appliquer les filtres
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, current: 1 })); // Reset à la première page
    };

    // Fonction de récupération des données avec filtres
    const fetchData = async (params = {}) => {
        setLoading(true);
        try {
            const queryParams = {
                page: params.current || pagination.current,
                page_size: params.pageSize || pagination.pageSize,
                status: filters.status,
                date_from: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
                date_to: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
                search: filters.search,
                sort_by: sorter.field,
                sort_order: sorter.order === 'ascend' ? 'asc' : sorter.order === 'descend' ? 'desc' : undefined,
            };

            // Supprimer les paramètres undefined
            Object.keys(queryParams).forEach(key =>
                queryParams[key] === undefined && delete queryParams[key]
            );

            let result;
            if (expenseType === "expense-reports") {
                result = await expenseReportsApi.list(queryParams);
            } else if (expenseType === "my-expense-reports") {
                result = await myExpenseReportsApi.list(queryParams);
            }

            setData(result.data || []);
            setPagination(prev => ({
                ...prev,
                total: result.total || 0,
                current: params.current || prev.current,
            }));
        } catch (error) {
            console.error("Erreur lors du chargement des données:", error);
        } finally {
            setLoading(false);
        }
    };

    // Charger les données au montage et quand les filtres changent
    useEffect(() => {
        fetchData();
    }, [expenseType, filters, sorter]);

    // Handler pour les changements de table (pagination, tri, filtres)
    const handleTableChange = (newPagination, tableFilters, newSorter) => {
        setPagination(newPagination);
        setSorter({
            field: newSorter.field,
            order: newSorter.order,
        });
        fetchData({ current: newPagination.current, pageSize: newPagination.pageSize });
    };

    // Handler pour le changement de page mobile
    const handleMobilePageChange = (page, pageSize) => {
        setPagination(prev => ({ ...prev, current: page, pageSize }));
        fetchData({ current: page, pageSize });
    };

    // Configuration des colonnes pour desktop
    const columns = useMemo(() => [
        {
            title: "Référence",
            dataIndex: "exr_number",
            key: "exr_number",
            width: 140,
            sorter: true,
            fixed: 'left',
        },
        {
            title: "Titre",
            dataIndex: "exr_title",
            key: "exr_title",
            sorter: true,
            ellipsis: true,
        },
        {
            title: "Période du",
            dataIndex: "exr_period_from",
            key: "exr_period_from",
            width: 110,
            align: "center",
            sorter: true,
            render: (date) => formatDate(date),
        },
        {
            title: "Au",
            dataIndex: "exr_period_to",
            key: "exr_period_to",
            width: 110,
            align: "center",
            sorter: true,
            render: (date) => formatDate(date),
        },
        {
            title: "Soumise le",
            dataIndex: "exr_submission_date",
            key: "exr_submission_date",
            width: 110,
            align: "center",
            sorter: true,
            render: (date) => formatDate(date),
        },
        {
            title: "Montant TTC",
            dataIndex: "exr_total_amount_ttc",
            key: "exr_total_amount_ttc",
            width: 140,
            align: "right",
            sorter: true,
            render: (amount) => formatCurrency(amount),
        },
        {
            title: "Salarié",
            dataIndex: "employee",
            key: "employee",
            sorter: true,
            ellipsis: true,
        },
        {
            title: "Approbateur",
            dataIndex: "approver_name",
            key: "approver_name",
            width: 150,
            sorter: true,
            ellipsis: true,
        },
        {
            title: "Statut",
            dataIndex: "exr_status",
            key: "exr_status",
            width: 140,
            align: "center",
            sorter: true,
            render: (status) => formatStatus({ value: status }),
        },
        {
            title: "Paiement",
            dataIndex: "exr_payment_progress",
            key: "exr_payment_progress",
            width: 120,
            align: "center",
            sorter: true,
            render: (payment) => formatPaymentStatus({ value: payment }),
        },
          createEditActionColumn({ permission: expenseType === "my-expense-reports" ? "expenses.my.edit" : "expenses.edit", mode:"table", onEdit: handleRowClick, idField: "id" })
    ], []);

    return (
        <PageContainer
            title={(expenseType === "expense-reports") ? "Notes de frais de mon équipe" : "Mes notes de frais"}
            actions={
                <CanAccess permission={expenseType === "my-expense-reports" ? "expenses.my.create" : "expenses.create"}>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                        size="large"
                    >
                        {isMobile ? "Nouvelle" : "Nouvelle note de frais"}
                    </Button>
                </CanAccess>
            }
        >
            {/* Barre de filtres */}
            <div style={{
                marginBottom: 16,
                padding: isMobile ? '12px' : '16px',
                background: '#fafafa',
                borderRadius: '8px'
            }}>
                <Space 
                    wrap 
                    size="middle" 
                    orientation={isMobile ? "vertical" : "horizontal"}
                    style={{ width: isMobile ? '100%' : 'auto' }}
                >
                    <Select
                        placeholder="Statut"
                        allowClear
                        style={{ width: isMobile ? '100%' : 160 }}
                        value={filters.status}
                        onChange={(value) => handleFilterChange('status', value)}
                        options={STATUS_FILTER_OPTIONS}
                    />

                    <RangePicker
                        placeholder={['Date début', 'Date fin']}
                        format="DD/MM/YYYY"
                        value={filters.dateRange}
                        onChange={(dates) => handleFilterChange('dateRange', dates)}
                        style={{ width: isMobile ? '100%' : 'auto' }}
                    />

                    <Input
                        placeholder="Rechercher..."
                        prefix={<SearchOutlined />}
                        allowClear
                        style={{ width: isMobile ? '100%' : 250 }}
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />

                    <Button
                        style={{ width: isMobile ? '100%' : 'auto' }}
                        onClick={() => {
                            setFilters({
                                status: undefined,
                                dateRange: undefined,
                                search: undefined
                            });
                        }}
                    >
                        Réinitialiser
                    </Button>
                </Space>
            </div>

            {/* Affichage conditionnel selon la taille d'écran */}
            {isMobile ? (
                <Suspense fallback={
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                        <Spin size="large" />
                    </div>
                }>
                    <ExpenseReportsMobileView
                        data={data}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={handleMobilePageChange}
                        onRowClick={handleRowClick}
                    />
                </Suspense>
            ) : (
                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading}
                    pagination={pagination}
                    onChange={handleTableChange}
                    onRow={(record) => ({
                        onClick: () => handleRowClick(record),
                        style: { cursor: 'pointer' }
                    })}
                    scroll={{ x: 1400 }}
                />
            )}
        </PageContainer>
    );
}