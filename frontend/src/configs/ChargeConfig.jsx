import { Tag } from "antd";
import api from '../services/api';

/**
 * Configuration complète du module Charge
 * Utilisée pour la gestion des charges (salaires, impôts, etc.)
 */

/**
 * Constantes pour les statuts de charge
 */
export const CHARGE_STATUS = {
  DRAFT: 0,
  FINALIZED: 1,
  ACCOUNTED: 2,
};

/**
 * Configuration des statuts de charge
 */
export const STATUS_CONFIG = {
  null: { label: "Brouillon", color: "default" },
  0: { label: "Brouillon", color: "default" },
  1: { label: "Finalisé", color: "blue" },
  2: { label: "Comptabilisé", color: "green" },
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
 * Formatteur pour le statut de charge
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

/**
 * Configuration du module
 */
export const MODULE_CONFIG = {
  // Identifiant du module
  name: "charges",

  // Titre du module
  title: "Charges",
  titleSingular: "Charge",

  // Préfixe pour les permissions
  permissionPrefix: "charges",

  // Endpoints API
  api: {
    base: "/api/charges",
    documents: (cheId) => `/api/charges/${cheId}/documents`,
    duplicate: (cheId) => `/api/charges/${cheId}/duplicate`,
    pdf: (cheId) => `/api/charges/${cheId}/pdf`,
  },

  // Configuration des documents
  documents: {
    module: "charges",
  },

  // Configurations des statuts
  statusConfig: STATUS_CONFIG,
};

/**
 * Configuration complète exportée par défaut
 */
export default MODULE_CONFIG;

/**
 * Configuration pour le composant PaymentsTab
 */
export const PAYMENTS_TAB_CONFIG = {
  name: "charges",

  // Champs de mapping parent
  parentFields: {
    id: 'che_id',
    status: 'che_status',
    paymentProgress: 'che_payment_progress',
  },

  // Fonction d'extraction des données parent
  extractParentData: (parent) => ({
    id: parent?.che_id,
    status: parent?.che_status,
    paymentProgress: parent?.che_payment_progress,
  }),

  // Routes API pour les paiements
  api: {
    getParent: (parentId) => api.get(`/charges/${parentId}`),
    getPayment: (paymentId) => api.get(`/charges/payments/${paymentId}`),
    getPayments: (parentId) => api.get(`/charges/${parentId}/payments`),
    getUnpaidCharges: (parentId, paymentId) => api.get(`/charges/${parentId}/unpaid-charges/${paymentId}`),
    getAvailableCredits: (parentId) => api.get(`/charges/${parentId}/available-credits`),
    savePayment: (parentId, paymentData) => api.post(`/charges/${parentId}/payments`, paymentData),
    updatePayment: (paymentId, paymentData) => api.post(`/charges/payments/${paymentId}`, paymentData),
    deletePayment: (paymentId) => api.delete(`/charges/payments/${paymentId}`),
    useCredit: (parentId, creditId) => api.post(`/charges/${parentId}/use-credit`, { credit_id: creditId }),
    removeAllocation: (parentId, payId) => api.delete(`/charges/${parentId}/payments/${payId}/allocation`),
  },

  // Configuration de l'affichage
  display: {
    // Statuts parent qui permettent d'enregistrer un paiement
    enablePaymentButtonStatuses: [1, 2], // Finalisé, Comptabilisé
  },

  // Fonction pour déterminer si on affiche les crédits disponibles (pas pour les charges)
  canShowAvailableCredits: () => false,

};

/**
 * Configuration pour le dialogue de paiement (PaymentDialog)
 * Utilisé pour les charges
 */
export const PAYMENT_DIALOG_CONFIG = {

  // Extraction des données du parent (charge)
  extractParentData: (chargeData) => ({
    number: chargeData?.che_number,
    amountRemaining: Number(chargeData?.che_amount_remaining ?? chargeData?.che_totalttc ?? 0),
    totalTTC: Number(chargeData?.che_totalttc ?? 0),
    date: chargeData?.che_date,
    paymentModeId: chargeData?.fk_pam_id,
    fk_cht_id: chargeData?.fk_cht_id,
  }),

  // Routes API (référence les routes de PAYMENTS_TAB_CONFIG)
  api: PAYMENTS_TAB_CONFIG.api,

  // Messages d'alerte
  alerts: {
    invoiceInfo: (number, amount) =>
      `Charge ${number} - Montant restant dû: ${new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount)}`,
    overpaymentWarning: {
      title: 'Le montant du règlement est supérieur au montant dû',
      description: 'Vous pouvez allouer le paiement à plusieurs charges en sélectionnant les lignes et en saisissant les montants.',
    },
    unAllocatedConfirmMsg: (amount) => {
      return `Un trop versé de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', }).format(amount)} sera automatiquement créé.`;
    },
  },

  paymentData: (chargeData) => {
    return {
      module: 'charge',
      fk_cht_id: chargeData?.fk_cht_id,
    }
  },

  showUnpayedInvoices: true, // Afficher les charges non réglées si trop versé
  parentField: 'fk_che_id',

};
