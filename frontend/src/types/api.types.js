/**
 * Types et interfaces pour l'API
 * Définitions des structures de données utilisées dans l'application
 */

/**
 * @typedef {Object} User
 * @property {number} usr_id - ID de l'utilisateur
 * @property {string|null} usr_created - Date de création
 * @property {string|null} usr_updated - Date de mise à jour
 * @property {number|null} fk_usr_id_author - ID de l'auteur
 * @property {number|null} fk_usr_id_updater - ID du dernier modificateur
 * @property {string|null} usr_login - Login de l'utilisateur
 * @property {number|null} fk_usp_id - ID du profil utilisateur
 * @property {string|null} usr_firstname - Prénom
 * @property {string|null} usr_lastname - Nom
 * @property {string} usr_email - Email
 * @property {string|null} usr_tel - Téléphone
 * @property {string|null} usr_gridsettings - Paramètres de grille
 * @property {string|null} usr_mobile - Mobile
 * @property {string|null} usr_jobtitle - Titre du poste
 * @property {string|null} clts_id - IDs des clients
 * @property {string|null} cltsexclu_id - IDs des clients exclus
 * @property {number|null} usr_is_active - Utilisateur actif
 * @property {Blob|null} usr_pic - Photo de profil
 * @property {number|null} usr_is_seller - Est vendeur
 * @property {number|null} usr_is_technician - Est technicien
 * @property {string|null} usr_password_updated_at - Date de dernière modification du mot de passe
 * @property {number} usr_failed_login_attempts - Nombre de tentatives de connexion échouées
 * @property {string|null} usr_locked_until - Date/heure de fin de verrouillage
 * @property {number|null} usr_permanent_lock - Verrouillage permanent
 */

/**
 * @typedef {Object} LoginCredentials
 * @property {string} login - Login ou email de l'utilisateur
 * @property {string} password - Mot de passe
 * @property {string} host - Host de la base de données cible
 */

/**
 * @typedef {Object} AuthResponse
 * @property {boolean} success - Succès de l'authentification
 * @property {string} token - Token d'authentification
 * @property {string|null} refresh_token - Token de rafraîchissement
 * @property {User} user - Données de l'utilisateur
 * @property {string|null} message - Message de réponse
 */

/**
 * @typedef {Object} ApiError
 * @property {boolean} success - false
 * @property {string} message - Message d'erreur
 * @property {Object|null} errors - Détails des erreurs de validation
 * @property {number} status - Code HTTP de l'erreur
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {boolean} success - Succès de la requête
 * @property {Array} data - Données paginées
 * @property {Object} pagination - Informations de pagination
 * @property {number} pagination.current_page - Page actuelle
 * @property {number} pagination.per_page - Nombre d'éléments par page
 * @property {number} pagination.total - Total d'éléments
 * @property {number} pagination.last_page - Dernière page
 */

/**
 * @typedef {Object} CrudResponse
 * @property {boolean} success - Succès de l'opération
 * @property {Object|null} data - Données retournées
 * @property {string} message - Message de réponse
 */

/**
 * @typedef {Object} PasswordResetRequest
 * @property {string} email - Email de l'utilisateur
 * @property {string} host - Host de la base de données
 */

/**
 * @typedef {Object} PasswordReset
 * @property {string} token - Token de réinitialisation
 * @property {string} password - Nouveau mot de passe
 * @property {string} password_confirmation - Confirmation du nouveau mot de passe
 */

/**
 * Validation des credentials de connexion
 * @param {LoginCredentials} credentials
 * @returns {{valid: boolean, errors: Array<string>}}
 */
export const validateLoginCredentials = (credentials) => {
  const errors = [];

  if (!credentials.login || credentials.login.trim() === '') {
    errors.push('Le login est requis');
  }

  if (!credentials.password || credentials.password.trim() === '') {
    errors.push('Le mot de passe est requis');
  }

  if (!credentials.host || credentials.host.trim() === '') {
    errors.push('Le host est requis');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validation d'un email
 * @param {string} email
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validation d'un mot de passe
 * @param {string} password
 * @returns {{valid: boolean, errors: Array<string>}}
 */
export const validatePassword = (password) => {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export default {
  validateLoginCredentials,
  validateEmail,
  validatePassword
};
