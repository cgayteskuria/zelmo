import api from "./apiInstance";
import { createCrudApi } from "./apiCreateCrud";

/**
 * API Sale Quotations (Devis - ord_status < 3 ou null)
 */
export const saleQuotationsApi = {
  list: (params = {}) => api.get("/sale-quotations", { params }),
};

/**
 * API Sale Orders (Commandes - ord_status >= 3)
 */
export const saleOrdersApi = {
  list: (params = {}) => api.get("/sale-orders", { params }),
};

/**
 * API Sale Orders génériques (Tous les sale orders)
 * Utilisé pour les opérations CRUD et détails
 */
export const saleOrdersGenericApi = {
  ...createCrudApi(api, "sale-orders", true),

  // Actions spécifiques
  getLines: (orderId) => api.get(`/sale-orders/${orderId}/lines`),

  // Sauvegarder ou mettre à jour une ligne de commande
  saveLine: (orderId, lineData) =>
    api.post(`/sale-orders/${orderId}/lines`, lineData),

  // Supprimer une ligne de commande
  deleteLine: (orderId, lineId) =>
    api.delete(`/sale-orders/${orderId}/lines/${lineId}`),

  // Mettre à jour l'ordre des lignes
  updateLinesOrder: (orderId, lines) =>
    api.put(`/sale-orders/${orderId}/lines/order`, { lines }),

  // Récupérer les objets liés à une commande
  getLinkedObjects: (orderId) =>
    api.get(`/sale-orders/${orderId}/linked-objects`),

  // Gestion des documents/fichiers
  getDocuments: (orderId) => api.get(`/sale-orders/${orderId}/documents`),

  uploadDocuments: (orderId, formData) =>
    api.post(`/sale-orders/${orderId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Générer le PDF d'une commande/devis
  printPdf: (orderId) => api.get(`/sale-orders/${orderId}/print-pdf`),

  // Dupliquer une commande/devis
  duplicate: (orderId) => api.post(`/sale-orders/${orderId}/duplicate`),

  // Générer une facture à partir d'une commande avec les lignes sélectionnées
  generateInvoice: (orderId, linesWithQty) =>
    api.post(`/sale-orders/${orderId}/generate-invoice`, {
      lines: linesWithQty,
    }),
};

/**
 * API Sale Quotations (Devis - ord_status < 3 ou null)
 */
export const purchaseQuotationsApi = {
  list: (params = {}) => api.get("/purchase-quotations", { params }),
};

/**
 * API Purchase Orders (Commandes fournisseurs)
 */
export const purchaseOrdersApi = {
  list: (params = {}) => api.get("/purchase-orders", { params }),
};

/**
 * API Purchase Orders génériques (Tous les purchase orders)
 * Utilisé pour les opérations CRUD et détails
 */
export const purchaseOrdersGenericApi = {
  ...createCrudApi(api, "purchase-orders", true),

  // Actions spécifiques
  getLines: (porId) => api.get(`/purchase-orders/${porId}/lines`),

  // Sauvegarder ou mettre à jour une ligne de commande
  saveLine: (porId, lineData) =>
    api.post(`/purchase-orders/${porId}/lines`, lineData),

  // Supprimer une ligne de commande
  deleteLine: (porId, lineId) =>
    api.delete(`/purchase-orders/${porId}/lines/${lineId}`),

  // Mettre à jour l'ordre des lignes
  updateLinesOrder: (porId, lines) =>
    api.put(`/purchase-orders/${porId}/lines/order`, { lines }),

  // Récupérer les objets liés à une commande
  getLinkedObjects: (porId) =>
    api.get(`/purchase-orders/${porId}/linked-objects`),

  // Gestion des documents/fichiers
  getDocuments: (porId) => api.get(`/purchase-orders/${porId}/documents`),

  uploadDocuments: (porId, formData) =>
    api.post(`/purchase-orders/${porId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Générer le PDF d'une commande fournisseur
  printPdf: (porId) => api.get(`/purchase-orders/${porId}/print-pdf`),

  // Dupliquer une commande fournisseur
  duplicate: (porId) => api.post(`/purchase-orders/${porId}/duplicate`),
};

/**
 * API Customer Invoices (Factures client)
 */
export const customerInvoicesApi = {
  list: (params = {}) => api.get("/customer-invoices", { params }),
};

/**
 * API Supplier Invoices (Factures fournisseur)
 */
export const supplierInvoicesApi = {
  list: (params = {}) => api.get("/supplier-invoices", { params }),
};

/**
 * API Invoices génériques (Toutes les factures)
 * Utilisé pour les opérations CRUD et détails
 */
export const invoicesGenericApi = {
  ...createCrudApi(api, "invoices", true),

  // Actions spécifiques
  getLines: (invId) => api.get(`/invoices/${invId}/lines`),

  // Sauvegarder ou mettre à jour une ligne de facture
  saveLine: (invId, lineData) => api.post(`/invoices/${invId}/lines`, lineData),

  // Supprimer une ligne de facture
  deleteLine: (invId, lineId) =>
    api.delete(`/invoices/${invId}/lines/${lineId}`),

  // Mettre à jour l'ordre des lignes
  updateLinesOrder: (invId, lines) =>
    api.put(`/invoices/${invId}/lines/order`, { lines }),

  // Récupérer les objets liés à une facture
  getLinkedObjects: (invId) => api.get(`/invoices/${invId}/linked-objects`),

  // Récupérer les paiements d'une facture
  getPayments: (invId) => api.get(`/invoices/${invId}/payments`),

  // Récupérer les acomptes/avoirs disponibles pour une facture
  getAvailableCredits: (invId) =>
    api.get(`/invoices/${invId}/available-credits`),

  // Gestion des documents/fichiers
  getDocuments: (invId) => api.get(`/invoices/${invId}/documents`),

  uploadDocuments: (invId, formData) =>
    api.post(`/invoices/${invId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Générer le PDF d'une facture
  printPdf: (invId) => api.get(`/invoices/${invId}/print-pdf`),

  // Dupliquer une facture
  duplicate: (invId) => api.post(`/invoices/${invId}/duplicate`),

  // Vérifier si un avoir ou acompte est utilisé
  checkUsage: (invId) => api.get(`/invoices/${invId}/check-usage`),

  calculateDueDate: (durId, baseDate) =>
    api.post(`/invoices/calculate-due-date`, {
      dur_id: durId,
      base_date: baseDate,
    }),

  // Mettre à jour les taxes des lignes en fonction de la position fiscale
  updateLinesTaxPosition: (invId, fkTapId) =>
    api.post(`/invoices/${invId}/update-lines-tax-position`, {
      fk_tap_id: fkTapId,
    }),
};

/**
 * API Charges (Gestion des charges - salaires, impôts, etc.)
 */
export const chargesApi = {
  list: (params = {}) => api.get("/charges", { params }),
};

/**
 * API Charges génériques (Toutes les charges)
 * Utilisé pour les opérations CRUD et détails
 */
export const chargesGenericApi = {
  ...createCrudApi(api, "charges", true),

  // Récupérer les paiements d'une charge
  getPayments: (cheId) => api.get(`/charges/${cheId}/payments`),

  // Gestion des documents/fichiers
  getDocuments: (cheId) => api.get(`/charges/${cheId}/documents`),

  uploadDocuments: (cheId, formData) =>
    api.post(`/charges/${cheId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Générer le PDF d'une charge
  printPdf: (cheId) => api.get(`/charges/${cheId}/print-pdf`),

  // Dupliquer une charge
  duplicate: (cheId) => api.post(`/charges/${cheId}/duplicate`),
};

/**
 * API Customer Contracts (Contrats client - con_operation = 1)
 */
export const customerContractsApi = {
  list: (params = {}) => api.get("/customercontracts", { params }),
};

/**
 * API Supplier Contracts (Contrats fournisseur - con_operation = 2)
 */
export const supplierContractsApi = {
  list: (params = {}) => api.get("/suppliercontracts", { params }),
};
/**
 * API Contracts génériques (Tous les contrats)
 * Utilisé pour les opérations CRUD et détails
 */
export const contractsGenericApi = {
  ...createCrudApi(api, "contracts", true),

  // Actions spécifiques
  getLines: (contractId) => api.get(`/contracts/${contractId}/lines`),

  // Sauvegarder ou mettre à jour une ligne de contrat
  saveLine: (contractId, lineData) =>
    api.post(`/contracts/${contractId}/lines`, lineData),

  // Supprimer une ligne de contrat
  deleteLine: (contractId, lineId) =>
    api.delete(`/contracts/${contractId}/lines/${lineId}`),

  // Mettre à jour l'ordre des lignes
  updateLinesOrder: (contractId, lines) =>
    api.put(`/contracts/${contractId}/lines/order`, { lines }),

  // Récupérer les objets liés à un contrat
  getLinkedObjects: (contractId) =>
    api.get(`/contracts/${contractId}/linked-objects`),

  // Gestion des documents/fichiers
  getDocuments: (contractId) => api.get(`/contracts/${contractId}/documents`),

  uploadDocuments: (contractId, formData) =>
    api.post(`/contracts/${contractId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Générer le PDF d'un contrat
  printPdf: (contractId) => api.get(`/contracts/${contractId}/print-pdf`),

  // Dupliquer un contrat
  duplicate: (contractId) => api.post(`/contracts/${contractId}/duplicate`),

  // Calculer la prochaine date de facturation
  calculateNextInvoiceDate: (contractId, durId, baseDate, isFirstDur) =>
    api.post(`/contracts/${contractId}/calculate-next-invoice-date`, {
      dur_id: durId,
      base_date: baseDate,
    }),

  // Calculer la date de fin d'engagement
  calculateEndCommitmentDate: (durId, baseDate) =>
    api.post(`/contracts/calculate-end-commitment-date`, {
      dur_id: durId,
      base_date: baseDate,
    }),

  // Récupérer les données de résiliation
  getTerminationData: (contractId) =>
    api.get(`/contracts/${contractId}/termination-data`),

  // Résilier un contrat
  terminate: (
    contractId,
    terminatedDate,
    terminatedInvoiceDate,
    terminatedReason,
  ) =>
    api.post(`/contracts/${contractId}/terminate`, {
      terminated_date: terminatedDate,
      terminated_invoice_date: terminatedInvoiceDate,
      terminated_reason: terminatedReason,
    }),

  // Récupérer les contrats éligibles à la facturation
  getEligibleForInvoicing: (params = {}) =>
    api.get("/contracts/eligible-for-invoicing", { params }),

  // Générer des factures à partir de plusieurs contrats
  generateInvoices: (contractIds, invoiceDate = null) =>
    api.post("/contracts/generate-invoices", {
      contract_ids: contractIds,
      invoice_date: invoiceDate,
    }),

  // Générer une facture à partir d'un contrat spécifique
  generateInvoice: (contractId, invoiceDate = null) =>
    api.post(`/contracts/${contractId}/generate-invoice`, {
      invoice_date: invoiceDate,
    }),
};
