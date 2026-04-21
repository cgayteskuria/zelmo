import { useState, useEffect } from 'react';
import { getApplicationsApi } from '../services/api';

const CACHE_KEY = 'app_applications_v1';

/**
 * Hook pour charger la liste des applications accessibles à l'utilisateur.
 *
 * Stratégie de cache identique à useMenu :
 * - sessionStorage : vidé à la fermeture de l'onglet / au logout
 * - Premier chargement : appel API → mise en cache
 * - Navigations suivantes : utilise le cache
 *
 * @returns {{ applications: Array, loading: boolean }}
 */
export const useApplications = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    try {
                        const data = JSON.parse(cached);
                        if (isMounted) {
                            setApplications(data);
                            setLoading(false);
                        }
                        return;
                    } catch {
                        sessionStorage.removeItem(CACHE_KEY);
                    }
                }

                const response = await getApplicationsApi();
                if (response?.status && response.applications && isMounted) {
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify(response.applications));
                    setApplications(response.applications);
                }
            } catch (error) {
                console.error('Erreur lors du chargement des applications:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        load();
        return () => { isMounted = false; };
    }, []);

    return { applications, loading };
};

/**
 * Vide le cache des applications.
 * À appeler lors de la déconnexion (dans clearAllCache de useMenu.jsx).
 */
export const clearApplicationsCache = () => {
    sessionStorage.removeItem(CACHE_KEY);
};
