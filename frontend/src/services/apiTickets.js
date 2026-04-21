import api from "./apiInstance";
import { createCrudApi } from "./apiCreateCrud";

/**
 * API Tickets (Module assistance)
 */
export const ticketsApi = {
    ...createCrudApi(api, "tickets", false),

    // Options pour les selects
    statusOptions: (params = {}) => api.get("/tickets/status-options", { params }),
    priorityOptions: (params = {}) => api.get("/tickets/priority-options", { params }),
    sourceOptions: (params = {}) => api.get("/tickets/source-options", { params }),
    categoryOptions: (params = {}) => api.get("/tickets/category-options", { params }),
    gradeOptions: (params = {}) => api.get("/tickets/grade-options", { params }),

    // Articles (messages/notes du ticket)
    getArticles: (ticketId) => api.get(`/tickets/${ticketId}/articles`),

    createArticle: (ticketId, data) => api.post(`/tickets/${ticketId}/articles`, data),

    updateArticle: (ticketId, articleId, data) => api.patch(`/tickets/${ticketId}/articles/${articleId}`, data),

    deleteArticle: (ticketId, articleId) =>
        api.delete(`/tickets/${ticketId}/articles/${articleId}`),

    // Documents pour les articles
    getArticleDocuments: (ticketId, articleId) =>
        api.get(`/tickets/${ticketId}/articles/${articleId}/documents`),

    uploadArticleDocuments: (ticketId, articleId, formData) =>
        api.post(`/tickets/${ticketId}/articles/${articleId}/documents`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    // Historique des modifications
    getHistory: (ticketId) => api.get(`/tickets/${ticketId}/history`),

    // Liens entre tickets
    getLinks: (ticketId) => api.get(`/tickets/${ticketId}/links`),
    createLink: (ticketId, data) => api.post(`/tickets/${ticketId}/links`, data),
    deleteLink: (ticketId, linkId) => api.delete(`/tickets/${ticketId}/links/${linkId}`),

    // Fusion de tickets
    merge: (ticketId, targetId) => api.post(`/tickets/${ticketId}/merge`, { target_id: targetId }),

    // Recherche de tickets (pour fusion / liens)
    search: (params = {}) => api.get(`/tickets/search`, { params }),

    // Compteurs sidebar (par statut + mes tickets)
    sidebarCounts: () => api.get("/tickets/sidebar-counts"),

    // Templates de messages (pour le compositeur)
    getMessageTemplates: (params = {}) => api.get(`/tickets/message-templates`, { params }),
};
