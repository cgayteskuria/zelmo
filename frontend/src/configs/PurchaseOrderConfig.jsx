import { Tag } from "antd";
import { TAX_TYPE } from "../utils/taxFormatters";

/**
 * Configuration complète du module PurchaseOrder
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
 * Configuration des statuts de commande fournisseur
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
  null: { label: "Non facturé", color: "orange" },
  0: { label: "Non facturé", color: "orange" },
  1: { label: "Partiellement", color: "orange" },
  2: { label: "Totalement", color: "green" },
  3: { label: "En contrat", color: "blue" },
};

/**
 * Configuration des états de livraison
 */
export const DELIVERY_STATE_CONFIG = {
  null: { label: "Non livré", color: "default" },
  0: { label: "Non livré", color: "orange" },
  1: { label: "Partiellement", color: "orange" },
  2: { label: "Totalement", color: "green" },
};

/**
 * Formatteur pour le statut de commande fournisseur
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatStatus = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = STATUS_CONFIG[value] || { label: "Inconnu", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};

/**
 * Formatteur pour l'état de facturation fournisseur
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
    taxType: { tax_use: TAX_TYPE.PURCHASE },

    // Filtre de produit (is_purchasable = 1 pour achat)
    productFilter: { is_active: 1, is_purchasable: 1 },

    field: { pam: "fk_pam_id_supplier", paymentCondition: "fk_dur_id_payment_condition_supplier" },

    // Identifiant du module
    name: "purchase-orders",

    // Titre du module
    title: "Commandes fournisseurs",
    titleSingular: "Commande fournisseur",

    // Préfixe pour les permissions
    permissionPrefix: "purchase-orders",

    // Endpoints API
    api: {
      base: "/api/purchase-orders",
      lines: (porId) => `/api/purchase-orders/${porId}/lines`,
      documents: (porId) => `/api/purchase-orders/${porId}/documents`,
      duplicate: (porId) => `/api/purchase-orders/${porId}/duplicate`,
      linkedObjects: (porId) => `/api/purchase-orders/${porId}/linked-objects`,
      pdf: (porId) => `/api/purchase-orders/${porId}/pdf`,
    },

    // Configuration des documents
    documents: {
      module: "purchase-orders",
    },


    // Configuration du tableau de lignes
    linesTableConfig: {
      columnsConfig: {
        showTax: true,
        showMargin: false, // Pas de marge pour les achats
        showMarginPercent: false, // Pas de % marge pour les achats
      },
    },

    // Configuration des totaux
    totalsConfig: {
      showSubscription: true, // Pas d'abonnement pour les commandes fournisseur
      showOneTime: true, // Pas de mise en service pour les commandes fournisseur         
    },

    // Configurations des statuts
    statusConfig: STATUS_CONFIG,
    receptionStateConfig: DELIVERY_STATE_CONFIG,
    invoicingStateConfig: INVOICING_STATE_CONFIG,

    // Fonctionnalités activées
    features: {
      showSubscription: true, // Afficher checkbox abonnement
      showPurchasePrice: false, // Ne pas afficher prix d'achat (c'est le prix unitaire)
    },
  }
}