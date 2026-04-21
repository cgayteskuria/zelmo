import api from "./apiInstance";
import { createCrudApi } from "./apiCreateCrud";

/**
 * API Company (Gestion de la société)
 */
export const companyApi = {
  ...createCrudApi(api, "company"),

  // Upload de logo
  uploadLogo: (companyId, formData) =>
    api.post(`/company/${companyId}/upload-logo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Récupérer un logo en base64
  getLogo: (companyId, logoType) =>
    api.get(`/company/${companyId}/logo/${logoType}`),

  // Générer une icône SVG à partir du logo carré
  generateSvgIcon: (companyId) =>
    api.post(`/company/${companyId}/generate-svg-icon`),
};

/**
 * API Message Templates (Gestion des modèles de messages)
 */
export const messageTemplatesApi = {
  ...createCrudApi(api, "message-templates", true),

  /**
   * Parse un template avec les données fournies
   * @param {string} context - 'sale' ou 'invoice'
   * @param {string} templateType - suffixe du champ (ex: 'sale', 'sale_validation', 'invoice')
   * @param {number|null} documentId - ID du document (ord_id ou inv_id) pour charger les données automatiquement
   * @param {object} data - données supplémentaires pour le remplacement des variables
   */
  parse: (context, templateType, documentId = null, data = {}) =>
    api.post("/message-templates/parse", {
      context,
      template_type: templateType,
      document_id: documentId,
      data
    }),
};

/**
 * API Message Email Accounts (Gestion des comptes email)
 */
export const messageEmailAccountsApi = {
  ...createCrudApi(api, "message-email-accounts", true),

  autoDetectServers: (data) =>
    api.post("/message-email-accounts/auto-detect-servers", data),
  exchangeOAuthCode: (data) =>
    api.post("/message-email-accounts/oauth-exchange", data),
  getOAuthAuthUrl: (data) =>
    api.post("/message-email-accounts/oauth-auth-url", data),
  getGoogleOAuthAuthUrl: (data) =>
    api.post("/message-email-accounts/google-oauth-auth-url", data),
  exchangeGoogleOAuthCode: (data) =>
    api.post("/message-email-accounts/google-oauth-exchange", data),
};

/**
 * API Bank Details (Gestion des comptes bancaires)
 */
export const bankDetailsApi = {
  ...createCrudApi(api, "bank-details", true),

  // Validation IBAN
  validateIban: (iban) => api.post("/bank-details/validate-iban", { iban }),
};

/**
 * API Purchase Order Config (Configuration des commandes d'achat)
 */
export const purchaseOrderConfApi = {
  ...createCrudApi(api, "purchase-order-conf", false),
};

/**
 * API Sale Order Config (Configuration des ventes)
 */
export const saleOrderConfApi = {
  ...createCrudApi(api, "sale-order-conf", false),
};

/**
 * API Sale Order Config (Configuration des contract)
 */
export const contractConfApi = {
  ...createCrudApi(api, "contract-conf", false),
};

/**
 * API Sale Order Config (Configuration des factures)
 */
export const invoiceConfApi = {
  ...createCrudApi(api, "invoice-conf", false),
};

/**
 * API Durations (Gestion unifiée des durées)
 */
export const durationsApi = {
  // Liste des durées par type
  list: (type, params = {}) => api.get(`/durations/${type}`, { params }),

  // Récupérer une durée spécifique
  get: (type, id) => api.get(`/durations/${type}/${id}`),

  // Créer une nouvelle durée
  create: (type, data) => api.post(`/durations/${type}`, data),

  // Mettre à jour une durée
  update: (type, id, data) => api.put(`/durations/${type}/${id}`, data),

  // Supprimer une durée
  delete: (type, id) => api.delete(`/durations/${type}/${id}`),

  // Options pour les selects
  options: (type) => api.get(`/durations/${type}/options`),
};

/**
 * API Charge Types (Gestion des types de charges)
 */
export const chargeTypesApi = {
  ...createCrudApi(api, "charge-types", true),
};

/**
 * API Taxs (Gestion des taxes)
 */
export const taxsApi = {
  ...createCrudApi(api, "taxs", true),
};

/**
 * API Payment Modes (Gestion des modes de paiement)
 */
export const paymentModesApi = {
  ...createCrudApi(api, "payment-modes", true),
};

/**
 * API Account Config (Configuration comptable)
 */
export const accountConfigApi = {
  // Il n'y a qu'une seule configuration comptable (ID=1)
  get: (id = 1) => api.get(`/account-config/${id}`),
  update: (id = 1, data) => api.put(`/account-config/${id}`, data),
};

/**
 * API Ticket Config (Configuration du module assistance)
 */
export const ticketConfigApi = {
  // Il n'y a qu'une seule configuration (ID=1)
  get: (id = 1) => api.get(`/ticket-config/${id}`),
  update: (id = 1, data) => api.put(`/ticket-config/${id}`, data),
  forceEmailCollection: (data) =>
    api.post(`/ticket-config/force-email-collection`, data),
};

/**
 * API Ticket Categories (Catégories de tickets)
 */
export const ticketCategoriesApi = {
  ...createCrudApi(api, "ticket-categories"),
};

/**
 * API Ticket Grades (Grades de tickets)
 */
export const ticketGradesApi = {
  ...createCrudApi(api, "ticket-grades"),
};

/**
 * API Ticket Statuses (Statuts de tickets)
 */
export const ticketStatusesApi = {
  ...createCrudApi(api, "ticket-statuses"),
};

/**
 * API Expense Config (Configuration du module notes de frais)
 */
export const expenseConfigApi = {
  // Il n'y a qu'une seule configuration (ID=1)
  get: (id = 1) => api.get(`/expense-config/${id}`),
  update: (id = 1, data) => api.put(`/expense-config/${id}`, data),
};

/**
 * API Time Config (Configuration du module temps)
 */
export const timeConfigApi = {
  // Il n'y a qu'une seule configuration (ID=1)
  get: (id = 1) => api.get(`/time-config/${id}`),
  update: (id = 1, data) => api.put(`/time-config/${id}`, data),
};
