import api from "./apiInstance"; // <-- Ajuste le chemin vers ton instance axios

/**
 * Service de gestion de l'authentification
 * Utilise l'authentification par token Bearer (Sanctum Personal Access Tokens)
 * Stocke le token et les infos utilisateur en localStorage
 */

const USER_KEY = "zelmo_user";
const TOKEN_KEY = "zelmo_token";

/**
 * Stocke les informations utilisateur et le token après connexion
 * @param {object} user - Les données utilisateur
 * @param {string} token - Le token d'authentification
 */
export const login = (user, token) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Récupère les informations utilisateur du cache
 * @returns {object|null} L'utilisateur ou null
 */
export const getUser = () => {
  try {
    const user = localStorage.getItem(USER_KEY);
    if (!user) return null;
    return JSON.parse(user);
  } catch (error) {
    console.error("Error parsing user from localStorage:", error);
    // Si les données sont corrompues, nettoyer le localStorage
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
};

/**
 * Récupère le token d'authentification
 * @returns {string|null} Le token ou null
 */
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Vérifie si l'utilisateur est connecté (basé sur le cache local)
 * ATTENTION : Cette vérification est basée sur le cache.
 * Pour une vérification réelle, utilisez getMeApi() dans api.js
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  return !!getUser() && !!getToken();
};

/**
 * Déconnecte l'utilisateur (supprime les données locales)
 */
export const logout = () => {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  // Supprime le header d'autorisation pour les prochaines requêtes
  if (api && api.defaults.headers.common["Authorization"]) {
    delete api.defaults.headers.common["Authorization"];
  }
};

/**
 * Récupérer les permissions de l'utilisateur
 * @returns {array} Liste des permissions
 */
export const getUserPermissions = () => {
  const user = getUser();
  return user?.permissions || [];
};

/**
 * Récupérer les rôles de l'utilisateur
 * @returns {array} Liste des rôles
 */
export const getUserRoles = () => {
  const user = getUser();
  return user?.roles || [];
};

/**
 * Vérifier si l'utilisateur a une permission
 * Support des wildcards (ex: partners.*)
 * @param {string} permission - La permission à vérifier
 * @returns {boolean}
 */
export const can = (permission) => {
  const permissions = getUserPermissions();

  // Permission globale
  if (permissions.includes("*")) return true;

  // Correspondance exacte
  if (permissions.includes(permission)) return true;

  // Support wildcard (ex: partners.* correspond à partners.view)
  return permissions.some((p) => {
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix + ".");
    }
    return false;
  });
};

/**
 * Vérifier si l'utilisateur a un rôle
 * @param {string} role - Le rôle à vérifier
 * @returns {boolean}
 */
export const hasRole = (role) => {
  const roles = getUserRoles();
  return roles.includes(role);
};
