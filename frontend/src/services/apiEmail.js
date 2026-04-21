import api from "./apiInstance";

/**
 * API pour l'envoi d'emails
 */
export const emailApi = {
  /**
   * Envoyer un email avec pièces jointes.
   * @param {FormData} formData - Contient : email_account_id, to, cc, bcc, subject, body, attachments[], document_ids
   */
  send: (formData) =>
    api.post("/emails/send", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    }),

  /**
   * Récupérer le compte email par défaut selon le contexte.
   * @param {string} context - 'sale' | 'default'
   */
  getDefaultAccount: (context = "default") =>
    api.get("/emails/default-account", { params: { context } }),
};
