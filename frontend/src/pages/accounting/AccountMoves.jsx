import { useRef, useState, useCallback } from "react";
import { Button, Space, Form } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import PeriodSelector from "../../components/common/PeriodSelector";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { accountMovesApi, accountJournalsApi } from "../../services/api";
import { formatStatus } from "../../configs/AccountConfig";
import { usePermission } from "../../hooks/usePermission";
import { useEffect } from "react";

/**
 * Affiche la liste des écritures comptables
 */
export default function AccountMoves() {
    const gridRef = useRef(null);
    const navigate = useNavigate();
    const { can } = usePermission();
    const [journalOptions, setJournalOptions] = useState([]);
    const [dateRange, setDateRange] = useState({ start: null, end: null });

    useEffect(() => {
        accountJournalsApi.options().then((res) => {
            const data = res?.data ?? [];
            setJournalOptions(data.map(j => ({ value: j.code, label: j.code + (j.label ? ' – ' + j.label : '') })));
        });
    }, []);

    // Synchronise le PeriodSelector avec les filtres restaurés par le backend
    const handleFiltersRestored = useCallback((filters) => {
        const start = filters?.amo_date_gte ?? null;
        const end = filters?.amo_date_lte ?? null;
        if (start || end) {
            setDateRange({ start, end });
        }
    }, []);

    // Quand la période change : met à jour les filtres dans ServerTable
    const handlePeriodChange = useCallback((newRange) => {
        setDateRange(newRange);
        gridRef.current?.updateFilters({
            amo_date_gte: newRange.start ?? null,
            amo_date_lte: newRange.end ?? null,
        });
    }, []);

    const handleCreate = () => {
        navigate('/account-moves/new');
    };

    const handleRowClick = (row) => {
        const rows = gridRef.current?.getData() || [];
        const ids = rows.map(r => r.id);
        const currentIndex = ids.indexOf(row.id);
        navigate(`/account-moves/${row.id}`, {
            state: { ids, currentIndex, basePath: '/account-moves' },
        });
    };

    const columns = [
        { key: "amo_id", title: "N° Mvt", width: 110, filterType: "text" },
        { key: "amo_valid", title: "Statut", width: 120, align: "center", render: (value) => formatStatus(value) },
        { key: "ajl_code", title: "Journal", width: 100, align: "center", filterType: "select", filterOptions: journalOptions },
        { key: "amo_date", title: "Date", align: "center", width: 120, filterType: "date", render: (value) => formatDate(value) },
        { key: "amo_label", title: "Libellé", ellipsis: true, filterType: "text" },
        { key: "amo_ref", title: "N° pièce", width: 200, filterType: "text" },
        { key: "amo_amount", title: "Montant", width: 150, align: "right", render: (value) => formatCurrency(value) },
        createEditActionColumn({ permission: "accountings.view", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Écritures comptables"
            actions={
                <Space>
                    {can('accountings.create') && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleCreate}
                            size="large"
                        >
                            Ajouter une écriture
                        </Button>
                    )}
                </Space>
            }
        >
            <Form layout="vertical" style={{ marginBottom: 12 }}>
                <Form.Item label="Période" style={{ marginBottom: 0 }}>
                    <PeriodSelector
                        value={dateRange}
                        onChange={handlePeriodChange}
                        presets={true}
                    />
                </Form.Item>
            </Form>

            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={accountMovesApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'amo_date', order: 'DESC' }}
                onFiltersRestored={handleFiltersRestored}
            />
        </PageContainer>
    );
}
