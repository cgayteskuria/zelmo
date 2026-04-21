import { useEffect, useRef, useState, useCallback } from 'react';
import { SECURITY_CONFIG } from '../utils/config';
import { setActivityCallback } from '../services/apiInstance';

/**
 * Hook pour gérer le timeout d'inactivité utilisateur
 *
 * @param {Object} options - Options de configuration
 * @param {Function} options.onTimeout - Callback appelé lors du timeout (déconnexion)
 * @param {Function} options.onWarning - Callback appelé lors de l'avertissement avant timeout
 * @param {number} options.timeout - Durée d'inactivité avant déconnexion (ms), défaut: 2h
 * @param {number} options.warningTime - Temps avant timeout pour afficher l'avertissement (ms), défaut: 5min
 * @param {boolean} options.enabled - Activer/désactiver le hook
 *
 * @returns {Object} { resetTimer, showWarning, remainingTime, dismissWarning }
 */
const useInactivityTimeout = ({
  onTimeout,
  onWarning,
  timeout = SECURITY_CONFIG.INACTIVITY_TIMEOUT,
  warningTime = SECURITY_CONFIG.INACTIVITY_WARNING,
  enabled = true,
} = {}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(warningTime);

  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  /**
   * Réinitialise le timer d'inactivité
   */
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Annuler les timers existants
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Masquer l'avertissement si affiché
    setShowWarning(false);
    setRemainingTime(warningTime);

    if (!enabled) return;

    // Programmer l'avertissement
    const warningDelay = timeout - warningTime;
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingTime(warningTime);

      // Démarrer le compte à rebours
      countdownIntervalRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            clearInterval(countdownIntervalRef.current);
          }
          return Math.max(0, newTime);
        });
      }, 1000);

      if (onWarning) {
        onWarning();
      }
    }, warningDelay);

    // Programmer le timeout
    timeoutRef.current = setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      }
    }, timeout);
  }, [enabled, onTimeout, onWarning, timeout, warningTime]);

  /**
   * Ferme l'avertissement et réinitialise le timer
   */
  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    resetTimer();
  }, [resetTimer]);

  /**
   * Gestionnaire d'événements pour détecter l'activité utilisateur
   */
  const handleActivity = useCallback(() => {
    // Éviter de reset trop fréquemment (throttle de 1 seconde)
    const now = Date.now();
    if (now - lastActivityRef.current > 1000) {
      resetTimer();
    }
  }, [resetTimer]);

  // Configuration des event listeners
  useEffect(() => {
    if (!enabled) return;

    // Événements à surveiller pour détecter l'activité
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Ajouter les listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Configurer le callback pour les appels API
    setActivityCallback(handleActivity);

    // Démarrer le timer initial
    resetTimer();

    // Nettoyage
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      setActivityCallback(null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [enabled, handleActivity, resetTimer]);

  return {
    resetTimer,
    showWarning,
    remainingTime,
    dismissWarning,
  };
};

export default useInactivityTimeout;
