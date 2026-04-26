import { useEffect, useRef } from 'react';

/**
 * Appelle `callback` chaque fois que l'onglet redevient visible.
 * Utilise un ref pour toujours capturer la version courante du callback.
 *
 * Gère le cas où l'onglet a été masqué alors que le hook était désactivé
 * (ex: formDisabled encore false pendant le chargement) : si enabled devient
 * true alors que l'onglet est déjà redevenu visible, le refresh est déclenché
 * immédiatement plutôt qu'ignoré.
 *
 * @param {function} callback  Appelé à la reprise de focus (pas besoin d'être stable)
 * @param {object}   options
 * @param {boolean}  options.enabled  Active/désactive le listener (default: true)
 */
export function useVisibilityRefresh(callback, { enabled = true } = {}) {
    const callbackRef  = useRef(callback);
    // true si la page a été cachée au moins une fois pendant que le hook était désactivé
    const missedHideRef = useRef(document.visibilityState === 'hidden');

    useEffect(() => { callbackRef.current = callback; });

    // Toujours surveiller les passages en hidden, même quand disabled
    useEffect(() => {
        const track = () => {
            if (document.visibilityState === 'hidden') missedHideRef.current = true;
        };
        document.addEventListener('visibilitychange', track);
        return () => document.removeEventListener('visibilitychange', track);
    }, []);

    useEffect(() => {
        if (!enabled) return;

        // Si la page a été cachée pendant que le hook était désactivé et qu'elle
        // est déjà revenue visible, on a raté le visibilitychange → refresh immédiat
        if (missedHideRef.current && document.visibilityState === 'visible') {
            missedHideRef.current = false;
            callbackRef.current();
        }

        const handler = () => {
            if (document.visibilityState === 'visible') {
                missedHideRef.current = false;
                callbackRef.current();
            }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [enabled]);
}
