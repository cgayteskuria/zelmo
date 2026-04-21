/**
 * Configuration de l'application
 * Gestion multi-tenant et configuration de sécurité
 */

// =============================================================================
// CONFIGURATION MULTI-TENANT
// =============================================================================

/**
 * Configuration basée sur l'URL du frontend (window.location.host)
 * Chaque clé correspond à un hostname:port du frontend
 * et pointe vers l'URL du backend correspondant
 */
export const TENANT_CONFIG = {
  // Développement local avec Vite
  'localhost:5173': {
    apiUrl: '/api', // Utilise le proxy Vite
    name: 'Développement Local',
  },
  'localhost:5174': {
    apiUrl: '/api',
    name: 'Développement Local (5174)',
  },
  'localhost:5175': {
    apiUrl: '/api',
    name: 'Développement Local (5175)',
  },

  
  // Configuration par défaut (fallback)
  '_default': {
    apiUrl: '/api', // Par défaut, utilise le proxy ou le même domaine
    name: 'Zelmo',
  },
};

/**
 * Récupère la configuration du tenant actuel basée sur l'URL du navigateur
 * @returns {Object} Configuration du tenant
 */
export const getTenantConfig = () => {
  const host = window.location.host;
  return TENANT_CONFIG[host] || TENANT_CONFIG['_default'];
};

/**
 * Récupère l'URL de base de l'API pour le tenant actuel
 * @returns {string} URL de base de l'API
 */
export const getApiBaseUrl = () => {
  return getTenantConfig().apiUrl;
};

/**
 * Récupère le nom du tenant actuel
 * @returns {string} Nom du tenant
 */
export const getTenantName = () => {
  return getTenantConfig().name;
};

// =============================================================================
// ANCIENNE CONFIGURATION (conservée pour compatibilité)
// =============================================================================

// Configuration des bases de données disponibles (LEGACY - utiliser TENANT_CONFIG)
export const DB_HOSTS = {
  production: {
    url: 'https://api.production.example.com',
    name: 'Production Database'
  },
  staging: {
    url: 'https://api.staging.example.com',
    name: 'Staging Database'
  },
  development: {
    url: 'http://localhost:8000',
    name: 'Development Database'
  },
  client1: {
    url: 'https://api.client1.example.com',
    name: 'Client 1 Database'
  },
  client2: {
    url: 'https://api.client2.example.com',
    name: 'Client 2 Database'
  }
};

// Configuration par défaut (LEGACY)
export const DEFAULT_HOST = 'development';

// Récupère l'URL de l'API en fonction du host sélectionné (LEGACY)
export const getApiUrl = (host = null) => {
  const selectedHost = host || localStorage.getItem('selectedHost') || DEFAULT_HOST;
  return DB_HOSTS[selectedHost]?.url || DB_HOSTS[DEFAULT_HOST].url;
};

// Récupère le nom du host sélectionné (LEGACY)
export const getHostName = (host = null) => {
  const selectedHost = host || localStorage.getItem('selectedHost') || DEFAULT_HOST;
  return DB_HOSTS[selectedHost]?.name || DB_HOSTS[DEFAULT_HOST].name;
};

// Définit le host à utiliser (LEGACY)
export const setSelectedHost = (host) => {
  if (DB_HOSTS[host]) {
    localStorage.setItem('selectedHost', host);
    return true;
  }
  console.error(`Host "${host}" non trouvé dans la configuration`);
  return false;
};

// Récupère le host sélectionné (LEGACY)
export const getSelectedHost = () => {
  return localStorage.getItem('selectedHost') || DEFAULT_HOST;
};

// =============================================================================
// CONFIGURATION DES ENDPOINTS API
// =============================================================================

export const API_ENDPOINTS = {
  // Authentification
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REFRESH: '/api/auth/refresh',
  ME: '/api/auth/me',
  RESET_PASSWORD: '/api/auth/reset-password',
  REQUEST_RESET: '/api/auth/request-reset',

  // Utilisateurs
  USERS: '/api/users',
  USER_BY_ID: (id) => `/api/users/${id}`,

  // Generic CRUD
  RESOURCE: (resource) => `/api/${resource}`,
  RESOURCE_BY_ID: (resource, id) => `/api/${resource}/${id}`,
};

// =============================================================================
// CONFIGURATION DE SÉCURITÉ
// =============================================================================

export const SECURITY_CONFIG = {
  // Durée de validité du token en millisecondes (1 heure)
  TOKEN_EXPIRY: 3600000,

  // Timeout d'inactivité en millisecondes (2 heures)
  INACTIVITY_TIMEOUT: 7200000,

  // Délai d'avertissement avant déconnexion (5 minutes avant)
  INACTIVITY_WARNING: 300000,

  // Nombre maximum de tentatives de connexion
  MAX_LOGIN_ATTEMPTS: 5,

  // Durée de blocage en millisecondes (15 minutes)
  LOCKOUT_DURATION: 900000,

  // Clés de stockage local
  STORAGE_KEYS: {
    TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    USER: 'user_data',
    HOST: 'selectedHost',
    TOKEN_EXPIRY: 'token_expiry',
    LAST_ACTIVITY: 'last_activity',
  }
};
