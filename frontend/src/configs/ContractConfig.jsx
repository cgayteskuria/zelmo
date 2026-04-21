import { Tag } from "antd";
import { TAX_TYPE } from "../utils/taxFormatters";

/**
 * Configuration complète du module Contract
 * Utilisée pour les composants génériques
 */

/**
 * Constantes pour les statuts de contrat
 */
export const CONTRACT_STATUS = {
  DRAFT: 0,
  ACTIVE: 1,
  TERMINATING: 2,
  TERMINATED: 3,
  FINISHED: 4
};

/**
 * Constantes pour les type  de facture
 */
export const CONTRACT_OPERATION = {
  CUSTOMER_CONTRACT: 1,
  SUPPLIER_CONTRACT: 2,
};

/**
 * Configuration des statuts de contrat
 */
export const STATUS_CONFIG = {
  null: { label: "Brouillon", color: "default" },
  0: { label: "Brouillon", color: "default" },
  1: { label: "Actif", color: "green" },
  2: { label: "En cours de résiliation", color: "orange" },
  3: { label: "Résilié", color: "red" },
  4: { label: "Terminé", color: "blue" },
};

/**
 * Formatteur pour le statut de contrat
 * @param {object|number} params - Soit un objet avec params.value, soit directement la valeur
 * @returns {JSX.Element} Tag formaté
 */
export const formatStatus = (params) => {
  const value = (params !== null && typeof params === 'object') ? params.value : params;
  const config = STATUS_CONFIG[value] || { label: "Inconnu", color: "default" };
  return <Tag color={config.color} variant='outlined'>{config.label}</Tag>;
};


/**
 * Retourne la configuration du module selon le type de contrat
 * @param {number} operation - Type d'opération (1 = client, 2 = fournisseur)
 * @returns {object} Configuration du module
 */
export const getModuleConfig = (operation) => {

  const isCustomer = [CONTRACT_OPERATION.CUSTOMER_CONTRACT].includes(operation);

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

    name: "contracts",

    // Titre du module
    title: "Contrats",
    titleSingular: "Contrat",

    // Préfixe pour les permissions
    permissionPrefix: "contracts",

    // Endpoints API
    api: {
      base: "/api/contracts",
      lines: (contractId) => `/api/contracts/${contractId}/lines`,
      documents: (contractId) => `/api/contracts/${contractId}/documents`,
      duplicate: (contractId) => `/api/contracts/${contractId}/duplicate`,
      linkedObjects: (contractId) => `/api/contracts/${contractId}/linked-objects`,
      pdf: (contractId) => `/api/contracts/${contractId}/pdf`,
    },

    // Configuration des documents
    documents: {
      module: "contracts",
    },

    // Configuration du tableau de lignes
    linesTableConfig: {
      columnsConfig: {
        showMargin: true,
        showMarginPercent: true,
        showQtyReceived: false,
      },
    },

    // Fonctionnalités activées
    features: {
      showMarginTable: isCustomer ? true : false,
      showSubscription:  false , // abonnement    
      showPurchasePrice: isCustomer ? true : false, // Afficher prix d'achat
    },

    // Configuration des totaux
    totalsConfig: {
      showSubscription: true,
      showOneTime: true,
      showTax: true,
      showTotalTTC: true,
    },

    // Configurations des statuts
    statusConfig: STATUS_CONFIG,
  }


};

