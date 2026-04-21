import api from '../services/api';

/**
 * Récupère les informations de la company et la banque par défaut depuis le cache ou via API
 * @returns {Promise<{company: Object, defaultBank: Object}>}
 */
export const getCompanyInfo = async () => {
  const cached = sessionStorage.getItem('companyInfo');
  if (cached) {
    return JSON.parse(cached);
  }

  const response = await api.get('/company/info');
  const companyInfo = {
    company: response.data.company,
    defaultBank: response.data.default_bank,
  };

  sessionStorage.setItem('companyInfo', JSON.stringify(companyInfo));
  return companyInfo;
};

/**
 * Récupère uniquement les informations de la company depuis le cache ou via API
 * @returns {Promise<Object>}
 */
export const getCompany = async () => {
  const info = await getCompanyInfo();
  return info.company;
};

/**
 * Récupère uniquement la banque par défaut depuis le cache ou via API
 * @returns {Promise<Object|null>}
 */
export const getDefaultBank = async () => {
  const info = await getCompanyInfo();
  return info.defaultBank;
};

/**
 * Efface le cache des informations de la company
 * Utile après une mise à jour des informations de la company
 */
export const clearCompanyInfoCache = () => {
  sessionStorage.removeItem('companyInfo');
};
