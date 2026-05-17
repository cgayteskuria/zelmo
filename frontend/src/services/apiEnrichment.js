import api from './apiInstance';

export const enrichmentApi = {
    search:             (data)   => api.post('/crm-enrichment/search', data),
    reveal:             (data)   => api.post('/crm-enrichment/reveal', data),
    revealStatus:       (crrId)  => api.get(`/crm-enrichment/reveal/${crrId}`),
    checkExists:        (ids)    => api.get('/crm-enrichment/check-exists', { params: { ids } }),
    enrichOrganization: (params) => api.get('/crm-enrichment/enrich-organization', { params }),
    importPerson:       (data)   => api.post('/crm-enrichment/import-person', data),
    getConfig:          ()       => api.get('/crm-enrichment/config'),
    updateConfig:       (data)   => api.put('/crm-enrichment/config', data),
    testConnection:     (data)   => api.post('/crm-enrichment/test', data ?? {}),
};
