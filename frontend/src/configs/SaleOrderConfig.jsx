import { Tag } from "antd";
import { TAX_TYPE } from "../utils/taxFormatters";

/**
 * Configuration complète du module SaleOrder
 * Utilisée pour les composants génériques (BizDocumentLineModal, FilesTab, etc.)
 */

/**
 * Constantes pour les statuts de commande
 */
export const ORDER_STATUS = {
  DRAFT: 0,
  FINALIZED: 1,
  REFUSED_QUOTE: 2,
  CONFIRMED: 3,
  CANCELLED: 4,
  INVOICED: 5
};

// Constantes d'état de facturation
export const ORDER_INVOICING_STATUS = {
  NOT_INVOICED: 0,
  PARTIALLY: 1,
  FULLY: 2,
  IN_CONTRACT: 3,
};

export const ORDER_DELIVERY_STATUS = {
  NOT_DELIVERED: 0,
  PARTIALLY: 1,
  FULLY: 2,
};


/**
 * Configuration des statuts de commande client
 */
export const STATUS_CONFIG = {
  null: { label: "Brouillon", color: "default" },
  0: { label: "Brouillon", color: "default" },
  1: { label: "Attente validation", color: "orange" },
  2: { label: "Refusé", color: "red" },
  3: { label: "En cours", color: "blue" },
  4: { label: "Annulé", color: "magenta" },
  5: { label: "Terminé", color: "green" },
};

/**
 * Configuration des états de facturation
 */
export const INVOICING_STATE_CONFIG = {
  null: { label: "Non facturée", color: "orange" },
  0: { label: "Non facturée", color: "orange" },
  1: { label: "Partiellement facturée", color: "orange" },
  2: { label: "Facturée", color: "green" },
  3: { label: "Facturée / En contrat", color: "green" },
};

/**
 * Configuration des états de livraison
 */
export const DELIVERY_STATE_CONFIG = {
  null: { label: "Non réalisée", color: "default" },
  0: { label: "Non réalisée", color: "orange" },
  1: { label: "Partiellement réalisée", color: "orange" },
  2: { label: "Réalisée", color: "green" },
};

/**
 * Formatteur pour le statut de commande
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatStatus = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = STATUS_CONFIG[value] || { label: "Inconnu", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};

/**
 * Formatteur pour l'état de facturation
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatInvoicingState = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = INVOICING_STATE_CONFIG[value] || { label: "-", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};

/**
 * Formatteur pour l'état de livraison
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatDeliveryState = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = DELIVERY_STATE_CONFIG[value] || { label: "-", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};


export const getModuleConfig = () => {

  return {

    // Type de taxe pour filtrer les produits
    taxType: { tax_use: TAX_TYPE.SALE },

    field: { pam: "fk_pam_id_customer", paymentCondition: "fk_dur_id_payment_condition_customer" },

    // Filtre de produit (is_saleable = 1 pour vente)
    productFilter: { is_active: 1, is_saleable: 1 },

    // Identifiant du module
    name: "sale-orders",

    // Titre du module
    title: "Commandes clients",
    titleSingular: "Commande client",

    // Préfixe pour les permissions
    permissionPrefix: "sale-orders",

    // Endpoints API
    api: {
      base: "/api/sale-orders",
      lines: (orderId) => `/api/sale-orders/${orderId}/lines`,
      documents: (orderId) => `/api/sale-orders/${orderId}/documents`,
      duplicate: (orderId) => `/api/sale-orders/${orderId}/duplicate`,
      linkedObjects: (orderId) => `/api/sale-orders/${orderId}/linked-objects`,
      pdf: (orderId) => `/api/sale-orders/${orderId}/pdf`,
    },

    // Configuration des documents
    documents: {
      module: "sale-orders",
    },


    // Configuration du tableau de lignes
    linesTableConfig: {
      columnsConfig: {
        showMargin: true,
        showMarginPercent: true,
        showQtyReceived: false,
        showIsSubscription: true,
      },
    },

    // Configuration des totaux
    totalsConfig: {
      showSubscription: true,
      showOneTime: true,
    },

    // Configurations des statuts
    statusConfig: STATUS_CONFIG,
    invoicingStateConfig: INVOICING_STATE_CONFIG,
    deliveryStateConfig: DELIVERY_STATE_CONFIG,

    // Fonctionnalités activées
    features: {
      showMarginTable: true,
      showSubscription: true, // Afficher checkbox abonnement
      showPurchasePrice: true, // Afficher prix d'achat
    },
  }

}


