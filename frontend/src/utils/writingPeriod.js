import dayjs from 'dayjs';
import { accountsApi } from '../services/api';

/**
 * Récupère la période d'écriture depuis le cache ou via API
 */
export const getWritingPeriod = async () => {
  const cached = sessionStorage.getItem('writingPeriod');
  if (cached) {
    return JSON.parse(cached);
  }
  const response = await accountsApi.getWritingPeriod();
  const period = {
    startDate: response.startDate,
    endDate: response.endDate,
  };
  sessionStorage.setItem('writingPeriod', JSON.stringify(period));
  return period;
};

/**
 * Génère une fonction de validation de date basée sur une période
 * Si writingPeriod n'est pas fourni, elle est récupérée automatiquement
 */
export const createDateValidator = () => {
  return async (_, value) => {
    if (!value || !value.isValid || !value.isValid()) {
      return Promise.resolve(); // champ vide ou invalide -> ok
    }

    let period = JSON.parse(sessionStorage.getItem("writingPeriod") || "null");
    if (!period) {
      period = await getWritingPeriod(); // AWAIT ajouté ici
    }

    if (!period?.startDate || !period?.endDate) {
      return Promise.resolve(); // pas de période définie -> ok
    }

    // Normaliser en YYYY-MM-DD pour éviter les faux positifs si l'API renvoie un datetime complet
    // ex: "2025-06-01T00:00:00Z" → "2025-06-01" < "2025-06-01T..." serait true par erreur
    const orderDateStr = value.format("YYYY-MM-DD");
    const start = dayjs(period.startDate).format("YYYY-MM-DD");
    const end   = dayjs(period.endDate).format("YYYY-MM-DD");

    if (orderDateStr < start) {
      return Promise.reject(
        new Error(`La date doit être >= ${dayjs(period.startDate).format("DD/MM/YYYY")}`)
      );
    }

    if (orderDateStr > end) {
      return Promise.reject(
        new Error(`La date doit être <= ${dayjs(period.endDate).format("DD/MM/YYYY")}`)
      );
    }

    return Promise.resolve();
  };
};