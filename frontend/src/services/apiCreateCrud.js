export const createCrudApi = (api, resource, options = false) => {
  const crud = {
    list: (params = {}) => api.get(`/${resource}`, { params }),
    get: (id) => api.get(`/${resource}/${id}`),
    create: (data) => api.post(`/${resource}`, data),
    update: (id, data) => api.put(`/${resource}/${id}`, data),
    delete: (id) => api.delete(`/${resource}/${id}`),
  };

  // Ajouter l’endpoint options si demandé
  if (options) {
    crud.options = (params = {}) => api.get(`/${resource}/options`, { params });
  }

  return crud;
};
