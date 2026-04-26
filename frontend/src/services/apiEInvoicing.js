import api from "./apiInstance";

/**
 * API Facturation Électronique (PA/PDP configurable)
 */
export const eInvoicingApi = {
  // -----------------------------------------------------------------------
  // Paramètres & configuration PA  (interface useEntityForm: get / update)
  // -----------------------------------------------------------------------
  get: () =>
    api.get("/e-invoicing/settings"),

  update: (_id, data) =>
    api.put("/e-invoicing/settings", data),

  testConnection: () =>
    api.post("/e-invoicing/settings/test-connection"),

  registerEntity: () =>
    api.post("/e-invoicing/settings/register-entity"),

  searchDirectory: (q) =>
    api.get("/e-invoicing/directory/search", { params: { q } }),

  // -----------------------------------------------------------------------
  // Transmission (émission factures client)
  // -----------------------------------------------------------------------
  transmitInvoice: (invId) =>
    api.post(`/e-invoicing/invoices/${invId}/transmit`),

  getTransmissionStatus: (invId) =>
    api.get(`/e-invoicing/invoices/${invId}/status`),

  downloadFactureX: (invId) =>
    api.get(`/e-invoicing/invoices/${invId}/facture-x`, { responseType: "blob" }),

  // -----------------------------------------------------------------------
  // Réception (boîte de réception factures fournisseur)
  // -----------------------------------------------------------------------
  listReceived: (params = {}) =>
    api.get("/e-invoicing/received", { params }),

  countPendingReceived: () =>
    api.get("/e-invoicing/received/count-pending"),

  getReceived: (id) =>
    api.get(`/e-invoicing/received/${id}`),

  updateReceivedStatus: (id, status) =>
    api.post(`/e-invoicing/received/${id}/status`, { status }),

  importReceived: (id) =>
    api.post(`/e-invoicing/received/${id}/import`),

  // -----------------------------------------------------------------------
  // E-reporting
  // -----------------------------------------------------------------------
  listEReporting: () =>
    api.get("/e-invoicing/ereporting"),

  buildEReporting: (period, type) =>
    api.post("/e-invoicing/ereporting/build", { period, type }),

  transmitEReporting: (eer_id) =>
    api.post("/e-invoicing/ereporting/transmit", { eer_id }),
};
