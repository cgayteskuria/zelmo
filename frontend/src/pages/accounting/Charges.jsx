import { useRef } from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { formatCurrency,formatDate  } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { formatStatus, formatPaymentStatus } from "../../configs/ChargeConfig.jsx";
import { createEditActionColumn } from "../../components/table/EditActionColumn";

import { chargesApi } from "../../services/api";

/**
 * Affiche la liste des charges (salaires, impôts, etc.)
 */
export default function Charges() {
    const gridRef = useRef(null);
    const navigate = useNavigate();

    const handleCreate = () => {
        navigate('/charges/new');
    };

    const handleRowClick = (row) => {
        const rows = gridRef.current?.getData() || [];
        const ids = rows.map(r => r.id);
        const currentIndex = ids.indexOf(row.id);
        navigate(`/charges/${row.id}`, {
            state: { ids, currentIndex, basePath: '/charges' },
        });
    };

    const columns = [
        { key: "che_number", title: "Réf", width: 120 },
        { key: "che_date", title: "Date", align: "center", width: 120, filterType: "date", render: (value) => formatDate(value) },
        { key: "che_label", title: "Libellé", ellipsis: true, filterType: "text" },
        { key: "cht_label", title: "Type", width: 200 },
        { key: "che_totalttc", title: "Montant", width: 120, align: "right", render: (value) => formatCurrency(value) },
        { key: "che_payment_progress", title: "Règlement", width: 150, align: "center", render: (value) => formatPaymentStatus({ value }) },
        { key: "che_status", title: "Statut", width: 120, align: "center", render: (value) => formatStatus({ value }) },
        createEditActionColumn({ permission: "charges.edit", onEdit: handleRowClick, mode: "table" })
    ];

    return (
        <PageContainer
            title="Charges"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreate}
                    size="large"
                >
                    Ajouter une charge
                </Button>
            }
        >
            <ServerTable
                ref={gridRef}
                columns={columns}
                fetchFn={chargesApi.list}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'che_date', order: 'DESC' }}
            />
        </PageContainer>
    );
}
