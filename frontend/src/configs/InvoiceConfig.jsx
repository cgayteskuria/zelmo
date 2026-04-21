import { Tag } from "antd";
import { TAX_TYPE } from "../utils/taxFormatters";
import api from '../services/api';

/**
 * Configuration complète du module Invoice
 * Utilisée pour les composants génériques (BizDocumentLineModal, FilesTab, etc.)
 */

/**
 * Constantes pour les statuts de facture
 */
export const INVOICE_STATUS = {
  DRAFT: 0,
  FINALIZED: 1,
  ACCOUNTED: 2,
};


/**
 * Constantes pour les type  de facture
 */
export const INVOICE_OPERATION = {
  CUSTOMER_INVOICE: 1,
  CUSTOMER_REFUND: 2,
  SUPPLIER_INVOICE: 3,
  SUPPLIER_REFUND: 4,
  CUSTOMER_DEPOSIT: 5,
  SUPPLIER_DEPOSIT: 6,
};

/**
 * Configuration des statuts de facture
 */
export const STATUS_CONFIG = {
  null: { label: "Brouillon", color: "default" },
  0: { label: "Brouillon", color: "default" },
  1: { label: "Validée", color: "orange" },
  2: { label: "Comptabilisée", color: "green" },
};

/**
 * Configuration des états de paiement basés sur le pourcentage (inv_payment_progress)
 */
export const PAYMENT_STATUS_CONFIG = {
  0: { label: "Non réglée", color: "orange" },
  partial: { label: "Partiellement réglée", color: "blue" },
  100: { label: "Réglée", color: "green" },
};

/**
 * Formatteur pour le statut de facture
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatStatus = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = STATUS_CONFIG[value] || { label: "Inconnu", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
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



export const getModuleConfig = (invOperation) => {

  const isCustomer = [1, 2, 5].includes(invOperation);

  return {
    // Type de taxe pour filtrer les produits
    taxType: { tax_use: isCustomer ? TAX_TYPE.SALE : TAX_TYPE.PURCHASE },

    field: isCustomer
      ? { pam: "fk_pam_id_customer", paymentCondition: "fk_dur_id_payment_condition_customer" }
      : { pam: "fk_pam_id_supplier", paymentCondition: "fk_dur_id_payment_condition_supplier" },

    // Filtre de produit
    productFilter: isCustomer
      ? { is_active: 1, is_saleable: 1 }
      : { is_active: 1, is_purchasable: 1 },

    // Identifiant du module
    name: "invoices",

    // Titre du module
    title: "Factures",
    titleSingular: "Facture",

    // Préfixe pour les permissions
    permissionPrefix: "invoices",

    // Endpoints API
    api: {
      base: "/api/invoices",
      lines: (invId) => `/api/invoices/${invId}/lines`,
      documents: (invId) => `/api/invoices/${invId}/documents`,
      duplicate: (invId) => `/api/invoices/${invId}/duplicate`,
      linkedObjects: (invId) => `/api/invoices/${invId}/linked-objects`,
      pdf: (invId) => `/api/invoices/${invId}/pdf`,
    },

    // Configuration des documents
    documents: {
      module: "invoices",
    },

    // Configuration du tableau de lignes
    linesTableConfig: {
      columnsConfig: {
        showMargin: isCustomer ? true : false,
        showMarginPercent: isCustomer ? true : false,
        showQtyReceived: true,
      },
    },

    // Configuration des totaux
    totalsConfig: {
      showSubscription: false,
      showOneTime: false,
      showTax: true,
      showTotalTTC: true,
      showPayment: true,
      showRemaining: true
    },

    // Configurations des statuts
    statusConfig: STATUS_CONFIG,
    paymentStatusConfig: PAYMENT_STATUS_CONFIG,

    // Fonctionnalités activées
    features: {
      showMarginTable: isCustomer ? true : false,
    //  showSubscription: isCustomer ? true : false, // Pas d'abonnement sur les factures
     // showPurchasePrice: isCustomer ? true : false, // Afficher prix d'achat
      showTaxPosition: isCustomer ? false  : true, // Afficher position fiscale
    },
  }
}

/**
 * Configuration pour le composant PaymentsTab
 */
export const PAYMENTS_TAB_CONFIG = {
  // Champs de mapping parent
  parentFields: {
    id: 'inv_id',
    status: 'inv_status',
    paymentProgress: 'inv_payment_progress',
    operation: 'inv_operation',
  },

  // Fonction d'extraction des données parent
  extractParentData: (parent) => ({
    id: parent?.inv_id,
    status: parent?.inv_status,
    paymentProgress: parent?.inv_payment_progress,
    operation: parent?.inv_operation,

  }),

  // Routes API pour les paiements
  api: {
    getParent: (parentId) => api.get(`/invoices/${parentId}`),
    getPayment: (paymentId) => api.get(`/invoices/payments/${paymentId}`),
    getPayments: (parentId) => api.get(`/invoices/${parentId}/payments`),
    getUnpaidInvoices: (parentId, paymentId) => api.get(`/invoices/${parentId}/unpaid-invoices/${paymentId}`),
    getAvailableCredits: (parentId) => api.get(`/invoices/${parentId}/available-credits`),
    savePayment: (parentId, paymentData) => api.post(`/invoices/${parentId}/payments`, paymentData),
    updatePayment: (paymentId, paymentData) => api.post(`/invoices/payments/${paymentId}`, paymentData),
    deletePayment: (paymentId,) => api.delete(`/invoices/payments/${paymentId}`),
    useCredit: (parentId, creditId) => api.post(`/invoices/${parentId}/use-credit`, { credit_id: creditId }),
    removeAllocation: (parentId, payId) => api.delete(`/invoices/${parentId}/payments/${payId}/allocation`),
  },

  // Configuration de l'affichage
  display: {
    // Statuts parent qui permettent d'enregistrer un paiement
    enablePaymentButtonStatuses: [1, 2], // Validé, Comptabilisé
  },

  // Fonction pour déterminer si on affiche les crédits disponibles
  canShowAvailableCredits: (operation) => {
    return operation === INVOICE_OPERATION.CUSTOMER_INVOICE ||
      operation === INVOICE_OPERATION.SUPPLIER_INVOICE;
  },
};

/**
 * Configuration pour le dialogue de paiement (PaymentDialog)
 * Utilisé pour les factures et sera réutilisé pour les contrats
 */
export const PAYMENT_DIALOG_CONFIG = {

  // Extraction des données du parent (facture)
  extractParentData: (invoiceData) => ({
    number: invoiceData?.inv_number,
    amountRemaining: invoiceData?.inv_amount_remaining,
    totalTTC: invoiceData?.inv_totalttc,
    date: invoiceData?.inv_date,
    paymentModeId: invoiceData?.fk_pam_id,
    fk_ptr_id: invoiceData?.fk_ptr_id,
    operation: invoiceData?.inv_operation,
  }),

  // Routes API (référence les routes de PAYMENTS_TAB_CONFIG)
  api: PAYMENTS_TAB_CONFIG.api,

  // Messages d'alerte
  alerts: {
    invoiceInfo: (number, amount) =>
      `Facture ${number} - Montant restant dû: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', }).format(amount)}`,
    overpaymentWarning: {
      //title: 'Le montant du règlement est supérieur au montant dû',
      description: 'Vous pouvez allouer le paiement à plusieurs factures en sélectionnant les lignes et en saisissant les montants.',
    },
    unAllocatedConfirmMsg: (amount, operation) => {
      let msg = "Une ";

      if (
        operation === INVOICE_OPERATION.CUSTOMER_INVOICE ||
        operation === INVOICE_OPERATION.CUSTOMER_REFUND ||
        operation === INVOICE_OPERATION.CUSTOMER_DEPOSIT
      ) {
        if (operation === INVOICE_OPERATION.CUSTOMER_REFUND) { msg += "créance"; } else { msg += "dette"; }
        msg += " client ";
      } else {
        if (operation === INVOICE_OPERATION.SUPPLIER_REFUND) { msg += "créance"; } else { msg += "dette"; }
        msg += " fournisseur ";
      }

      msg += `de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', }).format(amount)} sera automatiquement créé pour le trop-perçu.`
      return msg;
    },
  },

  paymentData: (invoiceData) => {
    return {
      module: 'invoice',
      fk_ptr_id: invoiceData?.fk_ptr_id,
      inv_operation: invoiceData?.operation
    }
  },

  showUnpayedInvoices: true,
  parentField: 'fk_inv_id',


};


