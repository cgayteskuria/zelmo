/**
 * Service API centralisé avec Axios
 * Configure les appels API avec authentification par token Bearer
 * Utilise le proxy Vite configuré dans vite.config.js
 */

import axios from "axios";
import api from "./apiInstance";
import { createCrudApi } from "./apiCreateCrud.js";

export * from "./apiAccounts.js";
export * from "./apiTime.js";
export * from "./apiBizDocument.js";
export * from "./apiSettings.js";
export * from "./apiInvoiceOcr.js";
export * from "./apiExpenses.js";
export * from "./apiTickets.js";
export * from "./apiProspect.js";
export const dashboardApi = {
    activity: () => api.get("/dashboard/activity"),
};

export const sequencesApi = {
    list:   ()          => api.get("/sequences"),
    update: (id, data)  => api.put(`/sequences/${id}`, data),
};

export const profileApi = {
    get:            ()       => api.get("/auth/me"),
    update:         (data)   => api.put("/auth/me", data),
    changePassword: (data)   => api.post("/auth/me/password", data),
};

/**
 * Fonction de connexion avec token Bearer
 * @param {string} login - Email ou login
 * @param {string} password
 * @param {boolean} remember - Se souvenir de moi
 * @returns {Promise<{user: object, token: string}>}
 */
export const loginApi = async (login, password, remember = false) => {
  return api.post("/auth/login", { login, password, remember });
};

/**
 * Fonction de déconnexion
 */
export const logoutApi = async () => {
  return api.post("/auth/logout");
};

/**
 * Fonction pour la demande de réinitialisation du mot de passe
 * @param {string} email - Email de l'utilisateur
 * @returns {Promise<{message: string}>}
 */
export const forgotPasswordApi = async (email) => {
  return api.post("/auth/forgot-password", { email });
};

/**
 * Fonction pour réinitialiser le mot de passe avec un token
 * @param {string} token - Token de réinitialisation
 * @param {string} password - Nouveau mot de passe
 * @param {string} password_confirmation - Confirmation du mot de passe
 * @returns {Promise<{message: string}>}
 */
export const resetPasswordApi = async (
  token,
  password,
  password_confirmation,
) => {
  return api.post("/auth/reset-password", {
    token,
    password,
    password_confirmation,
  });
};
/**
 * Récupérer l'utilisateur connecté
 */
export const getMeApi = async () => {
  return api.get("/auth/me");
};

/**
 * Récupérer le menu dynamique depuis la base de données
 * Retourne la structure hiérarchique du menu (parents + enfants)
 */
export const getMenusApi = async () => {
  return api.get("/menus");
};

export const getApplicationsApi = async () => {
  return api.get("/applications");
};

export const applicationsApi = {
    list: () => api.get("/applications"),
};

/**
 * Vérifier si un compte auxiliaire existe déjà
 * @param {string} accountType - Type de compte (customer ou supplier)
 * @param {string} accountAuxiliary - Code du compte auxiliaire
 * @param {number} id - ID du partenaire (optionnel)
 * @param {boolean} generateNext - Générer le prochain code disponible si existe
 * @returns {Promise} Résultat de la vérification
 */
export const checkAccountAuxiliaryApi = async (
  accountType,
  accountAuxiliary,
  id = null,
  generateNext = false,
) => {
  return api.post("/partners/check-account-auxiliary", {
    account_type: accountType,
    account_auxiliary: accountAuxiliary,
    id,
    generate_next: generateNext,
  });
};

/**
 * Vérifier si un partenaire a des enregistrements liés
 * @param {number} partnerId - ID du partenaire
 * @param {string} checkType - Type de vérification (customer ou supplier)
 * @returns {Promise} Résultat de la vérification
 */
export const checkLinkedRecordsApi = async (partnerId, checkType) => {
  return api.post("/partners/check-linked-records", {
    ptr_id: partnerId,
    check_type: checkType,
  });
};


export const getBanksByCompanyApi = async (companyId) => {
  return api.get(`/company/${companyId}/bank-details`);
};

export const banksApi = {
  ...createCrudApi(api, "bank-details", true),
};
/**
 * Récupérer les contacts d'un partenaire
 * @param {number} partnerId - ID du partenaire
 * @returns {Promise} Liste des contacts
 */
export const getContactsByPartnerApi = async (partnerId) => {
  return api.get(`/partners/${partnerId}/contacts`);
};

/**
 * Récupérer la liste des commerciaux
 * @param {Object} params - Paramètres de filtrage optionnels
 * @returns {Promise} Liste des utilisateurs commerciaux
 */
export const getSellersApi = async (params = {}) => {
  return api.get("/users/sellers", { params });
};

/**
 * Récupérer la liste des salariés actifs
 * @param {Object} params - Paramètres de filtrage optionnels
 * @returns {Promise} Liste des utilisateurs actifs
 */
export const getEmployeesApi = async (params = {}) => {
  return api.get("/users/employees", { params });
};

export const partnersApi = {
  ...createCrudApi(api, "partners", true),

  // Gestion des documents/fichiers
  getDocuments: (partnerId) => api.get(`/partners/${partnerId}/documents`),

  uploadDocuments: (partnerId, formData) =>
    api.post(`/partners/${partnerId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Objets liés (devis, commandes, factures, BL, contrats)
  getLinkedObjects: (partnerId) => api.get(`/partners/${partnerId}/linked-objects`),

  // Contacts liés au partenaire
  getContacts: (partnerId) => api.get(`/partners/${partnerId}/contacts`),
};

export const customersApi = {
  ...createCrudApi(api, "customers", true),
};

export const suppliersApi = {
  ...createCrudApi(api, "suppliers", true),
};

export const prospectsApi = {
  ...createCrudApi(api, "prospects", true),
};
/**
 * API Prospects (liste filtrée des partenaires)
 */
//export const prospectsApi = {
//    list: (params = {}) => api.get("/prospects", { params }),
//};

// STOCK //
export const warehousesApi = {
  ...createCrudApi(api, "warehouses", true),
};

export const taxsApi = {
  ...createCrudApi(api, "taxs", true),
  getRepartitionLines: (id) => api.get(`/taxs/${id}/repartition-lines`),
  saveRepartitionLines: (id, data) => api.put(`/taxs/${id}/repartition-lines`, data),
};
export const taxTagsApi = {
  options: (params = {}) => api.get("/tax-tags/options", { params }),
};
export const taxPositionApi = {
  ...createCrudApi(api, "tax-positions", true),
};
export const paymentModesApi = createCrudApi(api, "payment-modes", true);
export const paymentConditionApi = createCrudApi(
  api,
  "payment-conditions",
  true,
);
//export const durationsApi = createCrudApi(api, "durations", true);
export const commitmentDurationsApi = createCrudApi(
  api,
  "commitment-durations",
  true,
);

export const rolesApi = {
  ...createCrudApi(api, "roles", true),

  getAllPermissions: () => api.get(`/roles/permissions`),
};

export const noticeDurationsApi = createCrudApi(api, "notice-durations", true);
export const renewDurationsApi = createCrudApi(api, "renew-durations", true);
export const invoicingDurationsApi = createCrudApi(
  api,
  "invoicing-durations",
  true,
);
export const quotePeriodsApi = createCrudApi(api, "quote-periods", true);
// devices
export const devicesApi = {
  ...createCrudApi(api, "devices", true),

  getContacts: (deviceId) => api.get(`/devices/${deviceId}/contacts`),

  linkContact: (deviceId, contactId) =>
    api.post(`/devices/${deviceId}/contacts`, { contact_id: contactId }),

  unlinkContact: (deviceId, ctdId) =>
    api.delete(`/devices/${deviceId}/contacts/${ctdId}`),
};

// contacts
export const contactsApi = {
  ...createCrudApi(api, "contacts", true),

  getDevices: (contactId) => api.get(`/contacts/${contactId}/devices`),

  linkDevice: (contactId, deviceId) =>
    api.post(`/contacts/${contactId}/devices`, { device_id: deviceId }),

  unlinkDevice: (contactId, ctdId) =>
    api.delete(`/contacts/${contactId}/devices/${ctdId}`),

  attachPartner: (contactId, ptrId) =>
    api.post(`/contacts/${contactId}/attach-partner`, { ptr_id: ptrId }),
};

// products
export const productsApi = {
  ...createCrudApi(api, "products", true),

  getStockData: (productId) => api.get(`/products/${productId}/stock`),
};

/**
 * API Stocks
 */
export const stocksApi = {
  ...createCrudApi(api, "stocks", true),
  getMovements: (productId, params = {}) =>
    api.get(`/stocks/${productId}/movements`, { params }),
};

/**
 * API Stock Movements (Mouvements de stock)
 */
export const stockMovementsApi = {
  ...createCrudApi(api, "stock-movements", false),
  transfer: (data) => api.post("/stock-movements/transfer", data),
};

/**
 * API Bons de livraison client
 */
export const customerDeliveryNotesApi = {
  ...createCrudApi(api, "customer-delivery-notes", false),

  getLines: (id) => api.get(`/customer-delivery-notes/${id}/lines`),
  saveLine: (id, data) =>
    api.post(`/customer-delivery-notes/${id}/lines`, data),
  deleteLine: (id, lineId) =>
    api.delete(`/customer-delivery-notes/${id}/lines/${lineId}`),
  validate: (id) => api.post(`/customer-delivery-notes/${id}/validate`),
  getLinkedObjects: (id) =>
    api.get(`/customer-delivery-notes/${id}/linked-objects`),
  printPdf: (id) => api.get(`/customer-delivery-notes/${id}/print-pdf`),
  getDocuments: (id) => api.get(`/customer-delivery-notes/${id}/documents`),
  uploadDocuments: (id, formData) =>
    api.post(`/customer-delivery-notes/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

/**
 * API Bons de réception fournisseur
 */
export const supplierReceptionNotesApi = {
  ...createCrudApi(api, "supplier-reception-notes", false),
  getLines: (id) => api.get(`/supplier-reception-notes/${id}/lines`),
  saveLine: (id, data) =>
    api.post(`/supplier-reception-notes/${id}/lines`, data),
  deleteLine: (id, lineId) =>
    api.delete(`/supplier-reception-notes/${id}/lines/${lineId}`),
  validate: (id) => api.post(`/supplier-reception-notes/${id}/validate`),
  getLinkedObjects: (id) =>
    api.get(`/supplier-reception-notes/${id}/linked-objects`),
  printPdf: (id) => api.get(`/supplier-reception-notes/${id}/print-pdf`),
  getDocuments: (id) => api.get(`/supplier-reception-notes/${id}/documents`),
  uploadDocuments: (id, formData) =>
    api.post(`/supplier-reception-notes/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

/**
 * API Compteur BL/BR brouillons
 */
export const deliveryNotesApi = {
  getDraftCounts: () => api.get("/delivery-notes/draft-counts"),
};

/**
 * API Note de frais Payments (Paiements de charges - pay_operation = 4)
 */
export const paymentsApi = {
  list: (params = {}) => api.get("/payments", { params: { ...params } }),
  get: (payId) => api.get(`/payments/${payId}`),
  getUnpaidInvoices: (ptrId, invOperation) =>
    api.get("/payments/unpaid-invoices", { params: { ptr_id: ptrId, inv_operation: invOperation } }),
  savePayment: (data) => api.post("/payments", data),
  deletePayment: (payId) => api.delete(`/payments/${payId}`),
};
/**
 * API Charge Types (Types de charges)
 */
export const chargeTypesApi = createCrudApi(api, "charge-types", true);

/**
 * API Documents (Gestion des fichiers)
 */
export const documentsApi = {
  download: (documentId) =>
    api.get(`/documents/${documentId}/download`, { responseType: "blob" }),

  delete: (documentId) => api.delete(`/documents/${documentId}`),
};

/**
 * API Users (Gestion des utilisateurs)
 */

export const usersApi = {
  ...createCrudApi(api, "users", true),

  // Obtenir les permissions et rôles d'un utilisateur
  getPermissions: (userId) => api.get(`/users/${userId}/permissions`),

  // Synchroniser les rôles d'un utilisateur
  syncRoles: (userId, roles) => api.put(`/users/${userId}/roles`, { roles }),

  // Synchroniser les permissions directes d'un utilisateur
  syncPermissions: (userId, permissions) =>
    api.put(`/users/${userId}/permissions`, { permissions }),

  // Ajouter une permission directe
  givePermission: (userId, permission) =>
    api.post(`/users/${userId}/permissions/give`, { permission }),

  // Retirer une permission directe
  revokePermission: (userId, permission) =>
    api.post(`/users/${userId}/permissions/revoke`, { permission }),
};

/***/

// Exportation de l'instance Axios pour d'autres requêtes
export default api;
