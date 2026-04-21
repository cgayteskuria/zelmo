/**
 * Instance Axios configurée
 * Fichier séparé pour éviter les dépendances circulaires
 */

import axios from "axios";
import { logout, getToken } from "./auth";
import { getApiBaseUrl } from "../utils/config";

// Callback pour signaler l'activité utilisateur (utilisé par useInactivityTimeout)
let onActivityCallback = null;

/**
 * Définit le callback appelé lors de chaque requête API (signale l'activité)
 * @param {Function} callback - Fonction à appeler lors d'une activité
 */
export const setActivityCallback = (callback) => {
  onActivityCallback = callback;
};

// Configuration de base d'Axios
// L'URL est déterminée dynamiquement en fonction du tenant
const api = axios.create({
  baseURL: getApiBaseUrl(), // URL dynamique basée sur le tenant
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 10000,
  withCredentials: false,
});

// Compteur d'appels pour le diagnostic
const apiCallCounter = {};

/**
 * Intercepteur de requêtes : ajoute le token d'authentification
 */
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Signaler l'activité utilisateur (reset du timer d'inactivité)
    if (onActivityCallback) {
      onActivityCallback();
    }

    // Diagnostic: compter les appels
    const endpoint = `${config.method?.toUpperCase()} ${config.url}`;
    apiCallCounter[endpoint] = (apiCallCounter[endpoint] || 0) + 1;
    if (apiCallCounter[endpoint] > 1) {
      // console.warn(`[API] ⚠️ Appel multiple détecté pour ${endpoint}`);
      // console.trace('[API] Stack trace');
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Intercepteur de réponses : gère les erreurs globalement
 */
api.interceptors.response.use(
  (response) => {
    // Retourne directement les données (pas besoin de response.data partout)
    return response.data;
  },
  (error) => {
    // Gestion des erreurs HTTP
    if (error.response) {
      // Erreur avec réponse du serveur (4xx, 5xx)
      const { status, data } = error.response;

      // Si 401 (non autorisé), déconnecter l'utilisateur
      if (status === 401) {
        logout();
        window.location.href = "/login";
      }

      // Retourner un message d'erreur formaté
      return Promise.reject({
        status,
        data,
        message: data?.message || "Une erreur est survenue",
      });
    } else if (error.request) {
      // Erreur réseau (pas de réponse du serveur)
      return Promise.reject({
        status: null,
        message: "Erreur réseau : impossible de contacter le serveur",
      });
    } else {
      // Erreur lors de la configuration de la requête
      return Promise.reject({
        status: null,
        message: error.message || "Erreur inconnue",
      });
    }
  },
);

export default api;
