import api from "./apiInstance";
import { createCrudApi } from "./apiCreateCrud";

// API Notes de Frais
export const expenseReportsApi = {
  ...createCrudApi(api, "expense-reports", false),

  // Workflow actions
  submit: (id) => {
    return api.post(`/expense-reports/${id}/submit`);
  },

  approve: (id) => {
    return api.post(`/expense-reports/${id}/approve`);
  },

  reject: (id, reason) => {
    return api.post(`/expense-reports/${id}/reject`, {
      exr_rejection_reason: reason,
    });
  },

  unapprove: (id) => {
    return api.post(`/expense-reports/${id}/unapprove`);
  },


};

export const myExpenseReportsApi = {
  ...createCrudApi(api, "my-expense-reports", false),
  // Liste des notes de frais de l'utilisateur connecté
  myList: (params = {}) => {
    return api.get("/my-expense-reports", { params });
  },

  // Workflow actions
  submit: (id) => {
    return api.post(`/my-expense-reports/${id}/submit`);
  },
};

/**
 * Factory pour créer une API de dépenses liée à une note de frais
 * @param {string} basePath - Chemin de base ('expense-reports' ou 'my-expense-reports')
 * @param {number|string} expenseReportId - ID de la note de frais
 * @returns {Object} API des dépenses
 */

export const createExpensesApi = (basePath, expenseReportId) => {
  
  const baseUrl = `/${basePath}/${expenseReportId}/expenses`;

  return {
    // Liste des dépenses de la note de frais
    list: (params = {}) => {
      return api.get(baseUrl, { params });
    },

    // Récupérer une dépense
    get: (id) => {
      return api.get(`${baseUrl}/${id}`);
    },

    // Créer une dépense
    create: (data) => {
      return api.post(baseUrl, data);
    },

    // Mettre à jour une dépense
    update: (id, data) => {
      return api.put(`${baseUrl}/${id}`, data);
    },

    // Supprimer une dépense
    delete: (id) => {
      return api.delete(`${baseUrl}/${id}`);
    },

    // Création avec justificatif (multipart/form-data)
    createWithReceipt: (data, file) => {
      const formData = new FormData();

      // Ajouter les champs de données
      Object.keys(data).forEach((key) => {
        if (key === "lines") {
          formData.append(key, JSON.stringify(data[key]));
        } else if (data[key] !== null && data[key] !== undefined) {
          formData.append(key, data[key]);
        }
      });

      // Ajouter le fichier
      if (file) {
        formData.append("receipt", file);
      }

      return api.post(baseUrl, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },

    // Upload de justificatif
    uploadReceipt: (id, file) => {
      const formData = new FormData();
      formData.append("receipt", file);
      return api.post(`${baseUrl}/${id}/upload-receipt`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },  
  };
};

// API Categories de depenses
export const expenseCategoriesApi = {
  ...createCrudApi(api, "expense-categories", false),

  // Liste des categories actives
  active: () => {
    return api.get("/expense-categories/active");
  },

  // Options pour select
  options: (params = {}) => {
    return api.get("/expense-categories/options", { params });
  },

  // Toggle actif/inactif
  toggleActive: (id) => {
    return api.post(`/expense-categories/${id}/toggle-active`);
  },

  // Categories les plus utilisees
  mostUsed: (limit = 10) => {
    return api.get("/expense-categories/most-used", { params: { limit } });
  },

  // Statistiques par categorie
  statistics: (params = {}) => {
    return api.get("/expense-categories/statistics", { params });
  },
};

// ============================================
// MILEAGE EXPENSES (Frais kilometriques)
// ============================================

/**
 * Factory pour creer une API de frais kilometriques liee a une note de frais
 * @param {string} basePath - Chemin de base ('expense-reports' ou 'my-expense-reports')
 * @param {number|string} expenseReportId - ID de la note de frais
 * @returns {Object} API des frais kilometriques
 */
export const createMileageExpensesApi = (basePath, expenseReportId) => {
  const baseUrl = `/${basePath}/${expenseReportId}/mileage-expenses`;

  return {
    list: (params = {}) => api.get(baseUrl, { params }),
    get: (id) => api.get(`${baseUrl}/${id}`),
    create: (data) => api.post(baseUrl, data),
    update: (id, data) => api.put(`${baseUrl}/${id}`, data),
    delete: (id) => api.delete(`${baseUrl}/${id}`),
  };
};

/**
 * API Vehicules (nested sous users)
 */
export const createVehiclesApi = (userId) => ({
  list: (params = {}) => api.get(`/users/${userId}/vehicles`, { params }),
  get: (id) => api.get(`/users/${userId}/vehicles/${id}`),
  create: (data) => api.post(`/users/${userId}/vehicles`, data, data instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : {}),
  update: (id, data) => api.put(`/users/${userId}/vehicles/${id}`, data),
  delete: (id) => api.delete(`/users/${userId}/vehicles/${id}`),
  options: (params = {}) => api.get(`/users/${userId}/vehicles/options`, { params }),
  uploadRegistration: (id, file) => {
    const formData = new FormData();
    formData.append("registration_card", file);
    return api.post(`/users/${userId}/vehicles/${id}/registration`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadRegistration: (id) => api.get(`/users/${userId}/vehicles/${id}/registration`, { responseType: "blob" }),
  deleteRegistration: (id) => api.delete(`/users/${userId}/vehicles/${id}/registration`),
});

/**
 * API Mes vehicules (utilisateur connecte)
 */
export const myVehiclesApi = {
  list: (params = {}) => api.get("/my-vehicles", { params }),
  options: (params = {}) => api.get("/my-vehicles/options", { params }),
};

/**
 * API Bareme kilometrique (settings)
 */
export const mileageScaleApi = {
  ...createCrudApi(api, "mileage-scale", false),
  getByYear: (year) => api.get(`/mileage-scale/year/${year}`),
  duplicate: (data) => api.post("/mileage-scale/duplicate", data),
};

/**
 * Previsualisation du calcul kilometrique
 */
export const mileageCalculatePreview = (data) => {
  return api.post("/mileage-expenses/calculate-preview", data);
};

// API OCR pour les depenses
export const expenseOcrApi = {
  // Verifier si l'OCR est active
  isEnabled: () => {
    return api.get("/expense-ocr/is-enabled");
  },

  // Traiter un justificatif via OCR
  processReceipt: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/expense-ocr/process", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
