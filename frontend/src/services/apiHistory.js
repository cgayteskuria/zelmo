import api from "./apiInstance";

export const historyApi = {
    getHistory: (entityType, entityId, params = {}) =>
        api.get(`/history/${entityType}/${entityId}`, { params }),
};
