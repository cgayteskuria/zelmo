import { useRef, useState } from "react";
import { Button, Tag } from "antd";
import { PlusOutlined, EyeOutlined, EditOutlined } from "@ant-design/icons";
import { formatCurrency,formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useNavigate } from "react-router-dom";
import { accountBankReconciliationsApi } from "../../services/api";
import NewBankReconciliationModal from "../../components/accounting/NewBankReconciliationModal";

/**
 * Liste des rapprochements bancaires
 */
export default function AccountBankReconciliations() {
    const gridRef = useRef(null);
    const navigate = useNavigate();
    const [modalOpen, setModalOpen] = useState(false);

    const handleView = (row) => {
        const rows = gridRef.current?.getData() || [];
        const ids = rows.map(r => r.id);
        const currentIndex = ids.indexOf(row.id);
        navigate(`/account-bank-reconciliations/${row.id}`, {
            state: { ids, currentIndex, basePath: '/account-bank-reconciliations' },
        });
    };

    const handleNewReconciliation = () => {
        setModalOpen(true);
    };

    const handleModalClose = (abrId) => {
        setModalOpen(false);
        if (abrId) {
            navigate(`/account-bank-reconciliations/${abrId}`);
        }
    };

    const getStatusTag = (status) => {
        if (status === 0 || status === null) {
            return <Tag color="blue" variant='outlined'>En cours</Tag>;
        } else if (status === 1) {
            return <Tag color="green" variant='outlined'>Finalisé</Tag>;
        }
    };

    const getActionButton = (record) => {
        const isHistorical = record.abr_status === 1;

        if (isHistorical) {
            return (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleView(record);
                    }}
                >
                    Voir
                </Button>
            );
        } else {
            return (
                <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleView(record);
                    }}
                >
                    Éditer
                </Button>
            );
        }
    };

    const columns = [
        { key: "abr_label", title: "Référence", width: 110 },
        { key: "bank", title: "Banque", ellipsis: true },
        { key: "abr_date_start", title: "Période du", width: 100, filterType: "date", render: (value) => formatDate(value) },
        { key: "abr_date_end", title: "au", width: 100, filterType: "date", render: (value) => formatDate(value) },
        { key: "abr_initial_balance", title: "Solde initial", width: 120, render: (value) => formatCurrency(value) },
        { key: "abr_final_balance", title: "Solde final", width: 120, render: (value) => formatCurrency(value) },
        {
            key: "abr_gap",
            title: "Écart",
            width: 110,
            render: (value) => value == null ? '-' : (
                <span style={{ color: Math.abs(value) < 0.01 ? '#3f8600' : '#cf1322', fontWeight: 500 }}>
                    {formatCurrency(value)}
                </span>
            ),
        },
        { key: "abr_status", title: "Statut", width: 120, render: (value) => getStatusTag(value) },
        { key: "author", title: "Auteur", ellipsis: true },
        { key: "abr_created", title: "Date création", width: 150, filterType: "date", render: (value) => formatDate(value) },
        { key: "actions", title: "Actions", width: 100, render: (_value, record) => getActionButton(record) },
    ];

    return (
        <PageContainer
            title="Rapprochements bancaires"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleNewReconciliation}
                    size="large"
                >
                    Nouveau rapprochement
                </Button>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={accountBankReconciliationsApi.list}
                onRowClick={handleView}
                defaultSort={{ field: 'abr_created', order: 'DESC' }}
            />

            <NewBankReconciliationModal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onSuccess={handleModalClose}
            />
        </PageContainer>
    );
}
