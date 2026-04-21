import api from "./apiInstance";
import { createCrudApi } from "./apiCreateCrud";

export const timeProjectsApi = {
    ...createCrudApi(api, "time-projects", true),
};

export const timeEntriesApi = {
    ...createCrudApi(api, "time-entries", false),
    summary:              (params) => api.get("/time-entries/summary", { params }),
    submit:               (id)     => api.post(`/time-entries/${id}/submit`),
    submitBatch:          (ids)    => api.post("/time-entries/submit-batch",    { ids }),
    approveBatch:         (ids)    => api.post("/time-entries/approve-batch",   { ids }),
    rejectBatch:          (ids, reason) => api.post("/time-entries/reject-batch", { ids, reason }),
    generateInvoice:      (data)   => api.post("/time-entries/generate-invoice", data),
    descriptionSuggestions: (id)  => api.get(`/time-entries/${id}/description-suggestions`),
};

export const timeReportsApi = {
    report: (params) => api.get("/time-reports", { params }),
};
