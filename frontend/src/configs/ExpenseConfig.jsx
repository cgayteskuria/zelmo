import { Tag } from "antd";
import api from "../services/api";

/**
 * Statuts des notes de frais
 */
export const EXPENSE_REPORT_STATUS = {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ACCOUNTED: 'accounted'
};

/**
 * Labels des statuts
 */
export const EXPENSE_REPORT_STATUS_LABELS = {
    [EXPENSE_REPORT_STATUS.DRAFT]: 'Brouillon',
    [EXPENSE_REPORT_STATUS.SUBMITTED]: 'En attente',
    [EXPENSE_REPORT_STATUS.APPROVED]: 'Approuvée',
    [EXPENSE_REPORT_STATUS.REJECTED]: 'Rejetée',
    [EXPENSE_REPORT_STATUS.ACCOUNTED]: 'Approuvée & Comptabilisée'
};

/**
 * Couleurs des statuts
 */
export const EXPENSE_REPORT_STATUS_COLORS = {
    [EXPENSE_REPORT_STATUS.DRAFT]: 'default',
    [EXPENSE_REPORT_STATUS.SUBMITTED]: 'warning',
    [EXPENSE_REPORT_STATUS.APPROVED]: 'success',
    [EXPENSE_REPORT_STATUS.REJECTED]: 'error',
    [EXPENSE_REPORT_STATUS.ACCOUNTED]: 'green'
};

/**
 * Methodes de paiement
 */
export const PAYMENT_METHODS = {
    CASH: 'cash',
    CREDIT_CARD: 'credit_card',
    BANK_TRANSFER: 'bank_transfer',
    OTHER: 'other'
};

/**
 * Configuration des états de paiement basés sur le pourcentage (exr_payment_progress)
 */
export const PAYMENT_STATUS_CONFIG = {
    0: { label: "Non réglée", color: "orange" },
    partial: { label: "Partiellement réglée", color: "blue" },
    100: { label: "Réglée", color: "green" },
};

/**
 * Formatteur pour l'état de paiement basé sur le pourcentage
 * @param {object|number} params - Soit un objet avec params.value (inv_payment_progress), soit directement la valeur
 * @returns {JSX.Element} Tag formaté avec pourcentage
 */
export const formatPaymentStatus = (params) => {
    const value = (params !== null && typeof params === 'object') ? params.value : params;
    const progress = parseFloat(value) || 0;

    let config;
    let label;

    if (progress === 0) {
        config = PAYMENT_STATUS_CONFIG[0];
        label = config.label;
    } else if (progress >= 100) {
        config = PAYMENT_STATUS_CONFIG[100];
        label = config.label;
    } else {
        config = PAYMENT_STATUS_CONFIG.partial;
        label = `${config.label} (${progress.toFixed(0)}%)`;
    }

    return <Tag color={config.color} variant='outlined'>{label}</Tag>;
};


/**
 * Formate le statut d'une note de frais
 */
export const formatStatus = (params) => {
    if (params) {
        const status = params.value || params;
        const label = EXPENSE_REPORT_STATUS_LABELS[status] || status;
        const color = EXPENSE_REPORT_STATUS_COLORS[status] || 'default';

        return (
            <Tag color={color} variant='outlined'> {label} </Tag>
        );
    }
};

/**
 * Formate la methode de paiement
 *//*
export const formatPaymentMethod = (params) => {
const method = params.value || params;
return PAYMENT_METHOD_LABELS[method] || method;
};*/

/**
 * Options de filtrage des statuts
 */
export const STATUS_FILTER_OPTIONS = Object.entries(EXPENSE_REPORT_STATUS_LABELS).map(
    ([value, label]) => ({ value, label })
);

/**
 * Options de filtrage des methodes de paiement
 *//*
export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(
([value, label]) => ({ value, label })
);*/

// ============================================
// WORKFLOW HELPERS
// ============================================

/**
 * Verifie si une note de frais peut etre editee
 */
export const canEdit = (status) => {
    return [EXPENSE_REPORT_STATUS.DRAFT, EXPENSE_REPORT_STATUS.REJECTED].includes(status);
};

/**
 * Verifie si une note de frais peut etre soumise
 */
export const canSubmit = (status, expenseCount, mileageExpenseCount = 0) => {
    return status === EXPENSE_REPORT_STATUS.DRAFT && (expenseCount > 0 || mileageExpenseCount > 0);
};

/**
 * Verifie si une note de frais peut etre approuvee
 */
export const canApprove = (status) => {
    return status === EXPENSE_REPORT_STATUS.SUBMITTED;
};

/**
 * Verifie si une note de frais peut etre rejetee
 */
export const canReject = (status) => {
    return status === EXPENSE_REPORT_STATUS.SUBMITTED;
};



/**
 * Verifie si une note de frais peut etre desapprouvee
 * Possible uniquement si approuvée ET aucun paiement effectué (paymentProgress = 0)
 */
export const canUnapprove = (status, paymentProgress = 0) => {
    return status === EXPENSE_REPORT_STATUS.APPROVED && paymentProgress === 0;
};

/**
 * Configuration des actions de workflow
 */
export const WORKFLOW_ACTIONS = {
    submit: {
        key: 'submit',
        label: 'Soumettre',
        type: 'primary',
        confirmMessage: 'Etes-vous sur de vouloir soumettre cette note de frais ?'
    },
    approve: {
        key: 'approve',
        label: 'Approuver',
        type: 'primary',
        confirmMessage: 'Etes-vous sur de vouloir approuver cette note de frais ?'
    },
    reject: {
        key: 'reject',
        label: 'Rejeter',
        type: 'default',
        danger: true,
        requiresReason: true
    },
    unapprove: {
        key: 'unapprove',
        label: 'Désapprouver',
        type: 'default',
        danger: true,
        confirmMessage: 'Etes-vous sur de vouloir désapprouver cette note de frais ? Elle retournera en statut "Soumis".'
    },
};

/**
 * Retourne les actions disponibles selon le statut
 * @param {string} status - Le statut de la note de frais
 * @param {number} expenseCount - Nombre de dépenses dans la note
 * @param {number} paymentProgress - Pourcentage de paiement (0-100)
 */
export const getAvailableActions = (status, expenseCount = 0, paymentProgress = 0) => {
    const actions = [];

    if (canSubmit(status, expenseCount)) {
        actions.push(WORKFLOW_ACTIONS.submit);
    }
    if (canApprove(status)) {
        actions.push(WORKFLOW_ACTIONS.approve);
        actions.push(WORKFLOW_ACTIONS.reject);
    }
    if (canUnapprove(status, paymentProgress)) {
        actions.push(WORKFLOW_ACTIONS.unapprove);
    }


    return actions;
};

// ============================================
// PAYMENTS TAB CONFIGURATION
// ============================================

/**
 * Configuration de l'onglet Paiements pour les notes de frais
 */
export const PAYMENTS_TAB_CONFIG = {
    name: "expense-reports",
    api: {
        getParent: (parentId) => api.get(`/expense-reports/${parentId}`),
        getPayment: (paymentId) => api.get(`/expense-reports/payments/${paymentId}`),
        getPayments: (parentId) => api.get(`/expense-reports/${parentId}/payments`),
        getUnpaidExpenseReports: (parentId, paymentId) => api.get(`/expense-reports/${parentId}/unpaid-expense-reports/${paymentId || 0}`),
        getAvailableCredits: (parentId) => api.get(`/expense-reports/${parentId}/available-credits`),
        savePayment: (parentId, paymentData) => api.post(`/expense-reports/${parentId}/payments`, paymentData),
        updatePayment: (paymentId, paymentData) => api.post(`/expense-reports/payments/${paymentId}`, paymentData),
        deletePayment: (paymentId) => api.delete(`/expense-reports/payments/${paymentId}`),
        useCredit: (parentId, creditId) => api.post(`/expense-reports/${parentId}/use-credit`, { credit_id: creditId }),
        removeAllocation: (parentId, payId) => api.delete(`/expense-reports/${parentId}/payments/${payId}/allocation`),
    },
    display: {
        enablePaymentButtonStatuses: [EXPENSE_REPORT_STATUS.APPROVED, EXPENSE_REPORT_STATUS.ACCOUNTED], // Paiement uniquement pour les notes approuvées
    },
    canShowAvailableCredits: () => true,
};

/**
 * Configuration du dialogue de paiement pour les notes de frais
 */
export const PAYMENT_DIALOG_CONFIG = {
    extractParentData: (expenseReportData) => ({
        number: expenseReportData?.exr_number,
        amountRemaining: Number(expenseReportData?.exr_amount_remaining ?? expenseReportData?.exr_total_amount_ttc ?? 0),
        totalTTC: Number(expenseReportData?.exr_total_amount_ttc ?? 0),
        date: expenseReportData?.exr_approval_date,
        paymentModeId: null,
        employeeId: expenseReportData?.fk_usr_id,
    }),
    api: PAYMENTS_TAB_CONFIG.api,
    showUnpayedInvoices: true, // Activer pour afficher les autres notes de frais du même salarié
    parentField: 'fk_exr_id',

    // Messages d'alerte
    alerts: {
        invoiceInfo: (number, amount) =>
            `Note de frais ${number} - Montant restant dû: ${new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR',
            }).format(amount)}`,
        overpaymentWarning: {
            title: 'Le montant du règlement est supérieur au montant dû',
            description: 'Vous pouvez allouer le paiement à plusieurs notes de frais du même salarié en sélectionnant les lignes et en saisissant les montants.',
        },
        unAllocatedConfirmMsg: (amount) => {
            return `Un trop versé de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', }).format(amount)} sera automatiquement créé.`;
        },
    },

    // Données supplémentaires pour le paiement
    paymentData: (parentData) => ({
        module: 'expense-reports',
        employeeId: parentData?.employeeId,
    }),
};
