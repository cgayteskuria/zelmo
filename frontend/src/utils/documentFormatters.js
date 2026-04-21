import { Tag } from 'antd';

/**
 * Factory pour créer des formatters de statuts/états
 *
 * Ce fichier fournit des fonctions génériques pour formater les statuts, états de facturation,
 * états de livraison, etc. pour tous les types de documents (SaleOrder, PurchaseOrder, Invoice, Contract).
 *
 * Usage:
 * import { createDocumentFormatters } from './documentFormatters';
 * import { SALE_ORDER_CONFIG } from '../configs/saleOrderConfig';
 *
 * const { formatStatus, formatInvoicingState, formatDeliveryState } =
 *   createDocumentFormatters(SALE_ORDER_CONFIG);
 */

/**
 * Crée un formatter pour un type de statut/état donné
 *
 * @param {Object} statusConfig - Configuration du statut avec format { value: { label, color } }
 * @returns {Function} Fonction qui prend une valeur et retourne un Tag Ant Design
 *
 * @example
 * const statusConfig = {
 *   0: { label: "Brouillon", color: "default" },
 *   1: { label: "En cours", color: "blue" },
 *   2: { label: "Terminé", color: "green" }
 * };
 * const formatStatus = createStatusFormatter(statusConfig);
 * formatStatus(1); // <Tag color="blue">En cours</Tag>
 */
export const createStatusFormatter = (statusConfig) => {
  return (value) => {
    // Gérer les valeurs null/undefined
    if (value === null || value === undefined) {
      const defaultConfig = statusConfig[0] || { label: '-', color: 'default' };
      return <Tag color={defaultConfig.color}>{defaultConfig.label}</Tag>;
    }

    // Rechercher la configuration pour cette valeur
    const config = statusConfig[value];

    if (!config) {
      // Valeur inconnue : afficher avec couleur par défaut
      return <Tag color="default">Inconnu ({value})</Tag>;
    }

    return <Tag color={config.color}>{config.label}</Tag>;
  };
};

/**
 * Crée un ensemble complet de formatters pour un module de document
 *
 * @param {Object} moduleConfig - Configuration complète du module (saleOrderConfig, purchaseOrderConfig, etc.)
 * @returns {Object} Objet contenant les formatters et les configurations
 *
 * @example
 * import { SALE_ORDER_CONFIG } from '../configs/saleOrderConfig';
 *
 * export const {
 *   formatStatus,
 *   formatInvoicingState,
 *   formatDeliveryState,
 *   STATUSES,
 *   STATUS_CONFIG
 * } = createDocumentFormatters(SALE_ORDER_CONFIG);
 */
export const createDocumentFormatters = (moduleConfig) => {
  // Créer les formatters pour chaque type de statut/état
  const formatters = {
    formatStatus: createStatusFormatter(moduleConfig.statusConfig),
  };

  // Ajouter formatInvoicingState si le module le supporte
  if (moduleConfig.invoicingStateConfig) {
    formatters.formatInvoicingState = createStatusFormatter(moduleConfig.invoicingStateConfig);
  }

  // Ajouter formatDeliveryState si le module le supporte
  if (moduleConfig.deliveryStateConfig) {
    formatters.formatDeliveryState = createStatusFormatter(moduleConfig.deliveryStateConfig);
  }

  // Exporter aussi les constantes pour un accès facile
  return {
    ...formatters,

    // Constantes de statuts
    STATUSES: moduleConfig.statuses,
    STATUS_CONFIG: moduleConfig.statusConfig,

    // Constantes d'états (si disponibles)
    ...(moduleConfig.invoicingStateConfig && {
      INVOICING_STATE_CONFIG: moduleConfig.invoicingStateConfig,
    }),
    ...(moduleConfig.deliveryStateConfig && {
      DELIVERY_STATE_CONFIG: moduleConfig.deliveryStateConfig,
    }),
  };
};

/**
 * Helper pour créer un formatter personnalisé avec mapping de valeurs
 *
 * Utile pour les cas où les valeurs en base ne correspondent pas directement
 * aux clés de configuration.
 *
 * @param {Object} statusConfig - Configuration du statut
 * @param {Function} valueMapper - Fonction de mapping value → config key
 * @returns {Function} Formatter
 *
 * @example
 * // Si en base on a 'DRAFT', 'IN_PROGRESS' mais dans la config on a 0, 1
 * const mapper = (value) => {
 *   const mapping = { 'DRAFT': 0, 'IN_PROGRESS': 1, 'COMPLETED': 2 };
 *   return mapping[value];
 * };
 * const formatStatus = createCustomFormatter(statusConfig, mapper);
 */
export const createCustomFormatter = (statusConfig, valueMapper) => {
  return (value) => {
    const mappedValue = valueMapper(value);
    const config = statusConfig[mappedValue];

    if (!config) {
      return <Tag color="default">-</Tag>;
    }

    return <Tag color={config.color}>{config.label}</Tag>;
  };
};

/**
 * Helper pour formatter un boolean en Tag (Oui/Non)
 *
 * @param {boolean} value - Valeur boolean
 * @param {Object} options - Options de personnalisation
 * @returns {JSX.Element} Tag Ant Design
 *
 * @example
 * formatBoolean(true); // <Tag color="green">Oui</Tag>
 * formatBoolean(false); // <Tag color="red">Non</Tag>
 * formatBoolean(true, { trueLabel: 'Actif', falseLabel: 'Inactif' });
 */
export const formatBoolean = (value, options = {}) => {
  const {
    trueLabel = 'Oui',
    falseLabel = 'Non',
    trueColor = 'green',
    falseColor = 'red',
  } = options;

  if (value === true || value === 1) {
    return <Tag color={trueColor}>{trueLabel}</Tag>;
  }

  return <Tag color={falseColor}>{falseLabel}</Tag>;
};

/**
 * Helper pour formatter une date avec statut (ex: date d'échéance avec alerte si dépassée)
 *
 * @param {string|Date} date - Date à formatter
 * @param {Object} options - Options de personnalisation
 * @returns {JSX.Element} Tag Ant Design avec date et couleur selon le statut
 *
 * @example
 * formatDateStatus('2024-12-31'); // <Tag color="green">31/12/2024</Tag>
 * formatDateStatus('2023-01-01'); // <Tag color="red">01/01/2023 (Dépassé)</Tag>
 */
export const formatDateStatus = (date, options = {}) => {
  const {
    pastColor = 'red',
    futureColor = 'green',
    todayColor = 'orange',
    dateFormat = 'DD/MM/YYYY',
    showPastLabel = true,
  } = options;

  if (!date) {
    return <Tag color="default">-</Tag>;
  }

  const dateObj = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateObj.setHours(0, 0, 0, 0);

  let color = futureColor;
  let label = dateObj.toLocaleDateString('fr-FR');

  if (dateObj < today) {
    color = pastColor;
    if (showPastLabel) {
      label += ' (Dépassé)';
    }
  } else if (dateObj.getTime() === today.getTime()) {
    color = todayColor;
  }

  return <Tag color={color}>{label}</Tag>;
};

