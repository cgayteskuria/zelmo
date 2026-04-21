/**
 * API Accounts - Toutes les API liées aux comptes comptables
 *
 * Ce fichier contient toutes les API relatives à la comptabilité :
 * - Comptes comptables (accounts)
 * - Journaux comptables (account-journals)
 * - Lettrage comptable (account-lettering)
 * - Travail sur un compte comptable (account-working)
 * - Transferts comptables (account-transfers)
 * - Mouvements comptables (account-moves)
 * - Rapprochements bancaires (account-bank-reconciliations)
 */

import api from "./apiInstance";
import { createCrudApi } from "./apiCreateCrud";

/**
 * API Account Journals (Journaux comptables)
 */
export const accountJournalsApi = createCrudApi(api, "account-journals", true);

/**
 * API Accounts (Comptes comptables)
 */
export const accountsApi = {
  ...createCrudApi(api, "accounts", true),

  /**
   * Créer automatiquement un compte comptable
   * @param {string} accountLabel
   * @param {string} accountCode
   */
  autoCreateAccount: (accountLabel, accountCode) =>
    api.post("/accounts/auto-create", {
      accountLabel: accountLabel,
      accountCode: accountCode,
    }),
  // Récupérer la période d'écriture
  getWritingPeriod: () => api.get(`/accounts/writing-period`),
};

/**
 * API Account Lettering (Lettrage comptable)
 */
export const accountLetteringApi = {
  /**
   * Récupérer les lignes comptables à lettrer
   * @param {number} accId - ID du compte
   * @param {string} dateStart - Date de début (YYYY-MM-DD)
   * @param {string} dateEnd - Date de fin (YYYY-MM-DD)
   * @param {boolean} showLettered - Afficher les lignes déjà lettrées
   */
  getLines: (accId, dateStart, dateEnd, showLettered = false) =>
    api.get("/account-lettering", {
      params: {
        acc_id: accId,
        date_start: dateStart,
        date_end: dateEnd,
        show_lettered: showLettered ? 1 : 0,
      },
    }),

  getSettings: () => api.get("/account-lettering/settings"),

  saveSettings: (accId, dateStart, dateEnd) =>
    api.post("/account-lettering/settings", {
      acc_id: accId,
      date_start: dateStart,
      date_end: dateEnd,
    }),

  /**
   * Appliquer un lettrage sur des lignes comptables
   * @param {string} letteringCode - Code de lettrage
   * @param {number} accId - ID du compte
   * @param {Array<number>} amlIds - IDs des lignes à lettrer
   */
  apply: (letteringCode, accId, amlIds) =>
    api.post("/account-lettering/apply", {
      lettering_code: letteringCode,
      acc_id: accId,
      aml_ids: amlIds,
    }),

  /**
   * Supprimer un lettrage
   * @param {number} accId - ID du compte
   * @param {string} dateStart - Date de début (YYYY-MM-DD)
   * @param {string} dateEnd - Date de fin (YYYY-MM-DD)
   * @param {string} letteringCode - Code de lettrage à supprimer (optionnel)
   */
  remove: (accId, dateStart, dateEnd, letteringCode = null) =>
    api.post("/account-lettering/remove", {
      acc_id: accId,
      date_start: dateStart,
      date_end: dateEnd,
      lettering_code: letteringCode,
    }),
};

/**
 * API Account Working (Lettrage comptable)
 */
export const accountWorkingApi = {
  getLines: (accId, dateStart, dateEnd) =>
    api.get("/account-working", {
      params: { acc_id: accId, date_start: dateStart, date_end: dateEnd },
    }),

  getSettings: () => api.get("/account-working/settings"),

  saveSettings: (accId, dateStart, dateEnd) =>
    api.post("/account-working/settings", {
      acc_id: accId,
      date_start: dateStart,
      date_end: dateEnd,
    }),
};

/**
 * API Account Transfers (Transferts comptables)
 */
export const accountTransfersApi = {
  ...createCrudApi(api, "account-transfers", false),

  /**
   * Preview des mouvements à transférer
   * @param {string} startDate - Date de début (YYYY-MM-DD)
   * @param {string} endDate - Date de fin (YYYY-MM-DD)
   * @param {boolean} includeAccounted - Inclure les écritures déjà transférées
   */
  preview: (startDate, endDate, includeAccounted = false) =>
    api.post("/account-transfers/preview", {
      start_date: startDate,
      end_date: endDate,
      include_accounted: includeAccounted,
    }),

  /**
   * Valider et exécuter le transfert
   * @param {Array} movements - Liste des mouvements à transférer
   */
  transfer: (startDate, endDate, movements) =>
    api.post("/account-transfers", { startDate, endDate, movements }),
};

/**
 * API Account Moves (Écritures comptables)
 */
export const accountMovesApi = {
  ...createCrudApi(api, "account-moves", true),

  // Récupérer les lignes d'écriture d'un mouvement comptable
  getLines: (amoId) => api.get(`/account-moves/${amoId}/lines`),

  // Dupliquer une écriture comptable
  duplicate: (amoId) => api.post(`/account-moves/${amoId}/duplicate`),

  // Valider une écriture comptable
  validate: (amoId) => api.post(`/account-moves/${amoId}/validate`),
};

/**
 * API Accounting Editions (Éditions comptables)
 */
export const accountingEditionsApi = {
  // Génération de la Balance
  balance: (filters) => api.post("/accounting-editions/balance", filters),

  // Génération du Grand Livre
  grandLivre: (filters) =>
    api.post("/accounting-editions/grand-livre", filters),

  // Génération des Journaux
  journaux: (filters) => api.post("/accounting-editions/journaux", filters),

  // Génération des Journaux Centralisateur
  journauxCentralisateur: (filters) =>
    api.post("/accounting-editions/journaux-centralisateur", filters),

  // Génération du Bilan
  bilan: (filters) => api.post("/accounting-editions/bilan", filters),

  // Génération des PDF
  balancePdf: (filters) =>
    api.post("/accounting-editions/balance/pdf", filters),
  grandLivrePdf: (filters) =>
    api.post("/accounting-editions/grand-livre/pdf", filters),
  journauxPdf: (filters) =>
    api.post("/accounting-editions/journaux/pdf", filters),
  journauxCentralisateurPdf: (filters) =>
    api.post("/accounting-editions/journaux-centralisateur/pdf", filters),
  bilanPdf: (filters) => api.post("/accounting-editions/bilan/pdf", filters),
};

/**
 * Service API pour les clôtures comptables
 */
export const accountingClosuresApi = {
  //Liste des clôtures
  list: async (params) => api.get(`/accounting-closures`, { params }),

  // Détails d'une clôture
  get: async (id) => api.get(`/accounting-closures/${id}`),

  // Récupérer l'exercice en cours
  getCurrentExercise: async () =>
    api.get(`/accounting-closures/current-exercise`),

  // Vérifier si le worker est disponible
  checkWorkerStatus: async () => api.get(`/accounting-closures/worker-status`),

  // Démarrer le processus de clôture
  startClosure: async (data) => api.post(`/accounting-closures/start`, data),

  // Vérifier le statut du processus de clôture
  pollStatus: async (processId) =>
    api.post(`/accounting-closures/poll`, { process_id: processId }),

  // Télécharger l'archive ZIP de clôture
  downloadArchive: async (id) =>
    api.get(`/accounting-closures/${id}/download`, { responseType: "blob" }),

  // Supprimer une clôture (si autorisé)
  delete: async (id) => api.delete(`/accounting-closures/${id}`),
};

/**
 * API Account Bank Reconciliations (Rapprochements bancaires)
 */
export const accountBankReconciliationsApi = {
  ...createCrudApi(api, "account-bank-reconciliations", true),

  getLastReconciliation: (btsId) =>
    api.get(`/account-bank-reconciliations/last/${btsId}`),
  // Actions spécifiques

  getLines: (abrId, showPointed = false) =>
    api.get(`/account-bank-reconciliations/${abrId}/lines`, {
      params: { show_pointed: showPointed },
    }),

  updatePointing: (abrId, selectedLines) =>
    api.put(`/account-bank-reconciliations/${abrId}/pointing`, {
      pointed_lines: selectedLines,
    }),

  // Gestion des documents/fichiers
  getDocuments: (abrId) =>
    api.get(`/account-bank-reconciliations/${abrId}/documents`),

  uploadDocuments: (abrId, formData) =>
    api.post(`/account-bank-reconciliations/${abrId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

/**
 * API Accounting Backups (Sauvegardes comptables)
 */
export const accountingBackupsApi = {
  ...createCrudApi(api, "accounting-backups", false),

  // Télécharger un fichier de sauvegarde
  download: (abaId) =>
    api.get(`/accounting-backups/${abaId}/download`, { responseType: "blob" }),

  // Restaurer une sauvegarde
  restore: (abaId) => api.post(`/accounting-backups/${abaId}/restore`),
};

/**
 * API Accounting Imports (Imports comptables FEC/CIEL)
 */
export const accountingImportsApi = {
  list: (params) => api.get("/accounting-imports", { params }),
  get: (id) => api.get(`/accounting-imports/${id}`),
  delete: (id) => api.delete(`/accounting-imports/${id}`),

  // Upload fichier pour prévisualisation
  uploadForPreview: (formData) =>
    api.post("/accounting-imports/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Import final depuis données validées
  import: (data) => api.post("/accounting-imports/import", { data }),
};

/**
 * API Accounting Exports (Exports comptables FEC)
 */
export const accountingExportsApi = {
  list: (params) => api.get("/accounting-exports", { params }),
  get: (id) => api.get(`/accounting-exports/${id}`),
  create: (data) => api.post("/accounting-exports", data),
  delete: (id) => api.delete(`/accounting-exports/${id}`),

  // Télécharger un fichier export
  download: (id) =>
    api.get(`/accounting-exports/${id}/download`, {
      responseType: "blob",
    }),
};


/**
 * API Cases de déclaration TVA (mapping comptable par case)
 */
export const vatBoxesApi = {
  list:           (regime = 'reel') => api.get('/vat-boxes', { params: { regime } }),
  updateAccounts: (items)           => api.put('/vat-boxes/accounts', items),
};

/**
 * API Mapping TVA (admin — lecture du paramétrage CA3/CA12)
 */
export const vatReportMappingApi = {
  list: (regime = 'CA3') => api.get('/vat-report-mappings', { params: { regime } }),
};

/**
 * API Déclarations TVA (CA3 / CA12)
 */
export const vatDeclarationsApi = {
  list:         (params) => api.get('/vat-declarations', { params }),
  get:          (id)     => api.get(`/vat-declarations/${id}`),
  create:       (data)   => api.post('/vat-declarations', data),
  updateLabel:  (id, label) => api.patch(`/vat-declarations/${id}/label`, { vdc_label: label }),
  delete:       (id)     => api.delete(`/vat-declarations/${id}`),
  validate:     (id)     => api.post(`/vat-declarations/${id}/validate`),
  close:        (id)     => api.post(`/vat-declarations/${id}/close`),
  preview:      (data)   => api.post('/vat-declarations/preview', data),
  nextDeadline:     ()              => api.get('/vat-declarations/next-deadline'),
  boxLines:         (id, vdlId)    => api.get(`/vat-declarations/${id}/box-lines/${vdlId}`),
  updateLineAmount: (id, vdlId, amount) => api.patch(`/vat-declarations/${id}/lines/${vdlId}/amount`, { vdl_amount_tva: amount }),
};
