import { useRef, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { formatCurrency,formatDate } from "../../utils/formatters";
import ServerTable from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { Tag, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { createEditActionColumn } from "../../components/table/EditActionColumn";
import { useDrawerManager } from "../../hooks/useDrawerManager";

import { useRowHandler } from "../../hooks/useRowHandler";

import { paymentsApi } from "../../services/api";
import Payment from "./Payment";
import StandalonePaymentDialog from "../../components/bizdocument/StandalonePaymentDialog";

/**
 * Configuration des statuts de paiement
 */
const PAYMENT_STATUS_CONFIG = {
    0: { label: "Brouillion", color: "orange" },
    // 1: { label: "Validé", color: "green" },
    2: { label: "Comptabilisé", color: "green" },
};

/**
 * Formatteur pour le statut de paiement
 */
const formatPaymentStatus = (value) => {
    const config = PAYMENT_STATUS_CONFIG[value] || { label: "Inconnu", color: "default" };
    return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};

/**
 * Affiche la liste des paiements client, fournisseur ou charge
 * Adapte son comportement selon l'URL : /customerpayments, /supplierpayments ou /chargepayments
 */
export default function Payments() {
    const gridRef = useRef(null);
    const location = useLocation();

    const {
        drawerOpen,
        selectedItemId,
        closeDrawer,
        openForEdit
    } = useDrawerManager();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const handleFormSubmit = async () => {
        if (gridRef.current?.reload) {
            await gridRef.current.reload();
        }
    };
    const { handleRowClick } = useRowHandler(openForEdit);

    const paymentType = useMemo(() => {
        if (location.pathname.startsWith('/customer-payments')) return 'customer';
        if (location.pathname.startsWith('/supplier-payments')) return 'supplier';
        if (location.pathname.startsWith('/charge-payments')) return 'charge';
        if (location.pathname.startsWith('/expense-payments')) return 'expense';
    }, [location.pathname]);

    const config = useMemo(() => {
        if (paymentType === 'customer') {
            return {
                title: "Paiements clients",
                partnerLabel: "Client",
                api: paymentsApi,
                apiParams: { pay_operation: 1 },
                basePath: '/customer-payments'
            };
        }
        if (paymentType === 'supplier') {
            return {
                title: "Paiements fournisseurs",
                partnerLabel: "Fournisseur",
                api: paymentsApi,
                apiParams: { pay_operation: 2 },
                basePath: '/supplier-payments'
            };
        }
        if (paymentType === 'charge') {
            return {
                title: "Paiements de charges",
                partnerLabel: "Tiers",
                api: paymentsApi,
                apiParams: { pay_operation: 3 },
                basePath: '/charge-payments'
            };
        }
        if (paymentType === 'expense') {
            return {
                title: "Paiements note de frais",
                partnerLabel: "Salarié",
                api: paymentsApi,
                apiParams: { pay_operation: 4 },
                basePath: '/expense-payments',
            };
        }
    }, [paymentType]);

    const columns = useMemo(() => [
        { key: "pay_number", title: "N°", width: 110 },
        { key: "pay_date", title: "Date", align: "center", width: 120, filterType: "date", render: (value) => formatDate(value) },
        { key: "ptr_name", title: config?.partnerLabel, ellipsis: true, filterType: "text" },
        { key: "pay_reference", title: "Référence", width: 120, filterType: "text" },
        { key: "pay_amount", title: "Montant", width: 120, align: "right", render: (value) => formatCurrency(value) },
        { key: "pam_label", title: "Mode", width: 150 },
        { key: "bts_label", title: "Banque", width: 150 },
        { key: "pay_status", title: "Statut", width: 120, align: "center", render: (value) => formatPaymentStatus(value) },
        createEditActionColumn({ permission: "payments.view", type: "view", onEdit: handleRowClick, mode: "table" })
    ], [config?.partnerLabel, handleRowClick]);

    const showCreateButton = paymentType === 'customer' || paymentType === 'supplier';

    return (
        <PageContainer
            title={config?.title}
            actions={showCreateButton && (
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateDialogOpen(true)}
                >
                    Saisir un règlement
                </Button>
            )}
        >
            <ServerTable
                key={paymentType}
                ref={gridRef}
                columns={columns}
                fetchFn={(params) => config.api.list({ ...params, ...(config.apiParams || {}) })}
                onRowClick={handleRowClick}
                defaultSort={{ field: 'pay_date', order: 'DESC' }}
            />

            {drawerOpen && (
                <Payment
                    open={drawerOpen}
                    onClose={closeDrawer}
                    paymentId={selectedItemId}
                    onSubmit={handleFormSubmit}
                    paymentType={paymentType}
                />
            )}

            {createDialogOpen && (
                <StandalonePaymentDialog
                    open={createDialogOpen}
                    onClose={() => setCreateDialogOpen(false)}
                    onSuccess={handleFormSubmit}
                    paymentType={paymentType}
                />
            )}
        </PageContainer>
    );
}
