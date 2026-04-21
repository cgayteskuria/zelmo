import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const MENU_CACHE_KEY = 'app_menu_v2';

/**
 * Détecte dynamiquement l'application active en comparant le chemin courant
 * aux routes (mnu_href) connues pour chaque fk_app_id dans le cache menu.
 *
 * Entièrement dynamique : aucun préfixe hardcodé.
 * Dépend uniquement du cache sessionStorage (chargé par useMenu).
 *
 * @param {Array} applications - Liste des applications (depuis useApplications)
 * @returns {{ activeApp: Object|null, activeAppId: number|null }}
 */
export const useActiveApp = (applications) => {
    const { pathname } = useLocation();

    const activeApp = useMemo(() => {
        if (!applications || applications.length === 0) return null;

        // Construire le mapping fk_app_id → routes depuis le cache menu
        const hrefsByApp = {};
        try {
            const cached = sessionStorage.getItem(MENU_CACHE_KEY);
            if (cached) {
                const menus = JSON.parse(cached);
                menus.forEach(menu => {
                    if (menu.fk_app_id && menu.mnu_href) {
                        if (!hrefsByApp[menu.fk_app_id]) {
                            hrefsByApp[menu.fk_app_id] = [];
                        }
                        hrefsByApp[menu.fk_app_id].push(menu.mnu_href);
                    }
                });
            }
        } catch {
            // Cache absent ou corrompu — on ne peut pas détecter l'app
            return null;
        }

        // Chercher l'application dont une route est un préfixe du chemin courant
        for (const app of applications) {
            const routes = hrefsByApp[app.app_id] || [];
            const match = routes.some(
                route => route && (pathname === route || pathname.startsWith(route + '/'))
            );
            if (match) return app;
        }

        // Fallback : app dont app_root_href est un préfixe
        for (const app of applications) {
            if (app.app_root_href && pathname.startsWith(app.app_root_href)) {
                return app;
            }
        }

        return null;
    }, [pathname, applications]);

    return {
        activeApp,
        activeAppId: activeApp?.app_id ?? null,
    };
};
