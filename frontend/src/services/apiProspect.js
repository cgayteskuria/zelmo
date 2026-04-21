import api from "./apiInstance";
import { createCrudApi } from "./apiCreateCrud";

/**
 * API Opportunités (Module prospection)
 */
export const opportunitiesApi = {
    ...createCrudApi(api, "opportunities", false),

    // Pipeline / Kanban
    pipeline: (params = {}) => api.get("/opportunities/pipeline", { params }),

    // Statistiques dashboard
    statistics: (params = {}) => api.get("/opportunities/statistics", { params }),
    salesRepStats: (params = {}) => api.get("/opportunities/sales-rep-stats", { params }),

    // Actions
    markAsWon: (id) => api.post(`/opportunities/${id}/mark-won`),
    markAsLost: (id, data = {}) => api.post(`/opportunities/${id}/mark-lost`, data),
    convertToCustomer: (id) => api.post(`/opportunities/${id}/convert-customer`),

    // Options
    stageOptions: (params = {}) => api.get("/prospect-pipeline-stages/options", { params }),
    sourceOptions: (params = {}) => api.get("/prospect-sources/options", { params }),
    lostReasonOptions: (params = {}) => api.get("/prospect-lost-reasons/options", { params }),
    opportunityOptions: (params = {}) => api.get("/opportunities/options", { params }),

    // Par tiers
    byPartner: (ptrId) => api.get(`/opportunities/by-partner/${ptrId}`),

    // Documents
    getDocuments: (id) => api.get(`/opportunities/${id}/documents`),
    uploadDocuments: (id, formData) =>
        api.post(`/opportunities/${id}/documents`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
};

/**
 * API Activités de prospection
 */
export const prospectActivitiesApi = {
    ...createCrudApi(api, "prospect-activities", false),

    // Activités par opportunité
    byOpportunity: (oppId) => api.get(`/opportunities/${oppId}/activities`),

    // Activités par tiers
    byPartner: (ptrId, params = {}) => api.get(`/prospect-activities/by-partner/${ptrId}`, { params }),

    // Prochaines activités (dashboard)
    upcoming: (params = {}) => api.get("/prospect-activities/upcoming", { params }),

    // Marquer comme terminée
    markAsDone: (id) => api.post(`/prospect-activities/${id}/mark-done`),
};


/**
 * API Settings Prospection
 */
export const prospectPipelineStagesApi = {
    ...createCrudApi(api, "prospect-pipeline-stages", true),
};

export const prospectSourcesApi = {
    ...createCrudApi(api, "prospect-sources", true),
};

export const prospectLostReasonsApi = {
    ...createCrudApi(api, "prospect-lost-reasons", true),
};
