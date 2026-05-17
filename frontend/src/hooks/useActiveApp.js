import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const MENU_CACHE_KEY = 'app_menu_v2';

/**
 * Détecte dynamiquement l'application active en comparant le chemin courant
 * aux routes (mnu_href) connues pour chaque application.
 *
 * Stratégie (dans l'ordre) :
 * 1. app.menus (chargé via la relation Eloquent dans getApplicationsApi, réactif)
 * 2. Cache menu sessionStorage (fk_app_id → routes)
 * 3. Fallback app_root_href prefix
 *
 * @param {Array} applications - Liste des applications (depuis useApplications)
 * @returns {{ activeApp: Object|null, activeAppId: number|null }}
 */
export const useActiveApp = (applications) => {
    const { pathname, state } = useLocation();

    const activeApp = useMemo(() => {
        if (!applications || applications.length === 0) return null;

        // 0. Navigation depuis un menu : le state porte l'app source (évite les conflits sur les routes partagées)
        if (state?.sourceAppId) {
            const sourceApp = applications.find(a => a.app_id === state.sourceAppId);
            if (sourceApp) return sourceApp;
        }

        // 1. Menus chargés avec chaque application (via relation fk_app_id, réactif)
        for (const app of applications) {
            if (app.menus && Array.isArray(app.menus) && app.menus.length > 0) {
                const match = app.menus.some(
                    menu => menu.mnu_href && (pathname === menu.mnu_href || pathname.startsWith(menu.mnu_href + '/'))
                );
                if (match) return app;
            }
        }

        // 2. Cache menu sessionStorage (fk_app_id → routes)
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
            // Cache absent ou corrompu — on passe au fallback
        }

        for (const app of applications) {
            const routes = hrefsByApp[app.app_id] || [];
            const match = routes.some(
                route => route && (pathname === route || pathname.startsWith(route + '/'))
            );
            if (match) return app;
        }

        // 3. Fallback : app dont app_root_href est un préfixe exact du chemin
        for (const app of applications) {
            if (app.app_root_href && pathname.startsWith(app.app_root_href)) {
                return app;
            }
        }

        return null;
    }, [pathname, state, applications]);

    return {
        activeApp,
        activeAppId: activeApp?.app_id ?? null,
    };
};
