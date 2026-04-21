import { useState, useEffect } from 'react';
import { message } from '../utils/antdStatic';
import { Link } from 'react-router-dom';
import { clearApplicationsCache } from './useApplications';
import {
    SettingOutlined, AuditOutlined, CreditCardOutlined, CustomerServiceOutlined, StockOutlined, BuildOutlined, ShoppingCartOutlined,
    AccountBookOutlined, ProfileOutlined, CalculatorOutlined, TeamOutlined, AimOutlined, DashboardOutlined, UserAddOutlined,
    FunnelPlotOutlined, ProjectOutlined, ScheduleOutlined, CalendarOutlined, ThunderboltOutlined, LaptopOutlined, ShoppingOutlined,
    ShopOutlined, ContainerOutlined, FileDoneOutlined, FileTextOutlined, AppstoreOutlined, FileSearchOutlined, PayCircleOutlined,
    SendOutlined, InboxOutlined, RetweetOutlined, DatabaseOutlined, SwapOutlined, EditOutlined, LinkOutlined,
    BankOutlined, ExportOutlined, BarChartOutlined, ImportOutlined, CloudUploadOutlined, LockOutlined, FileSyncOutlined, UserOutlined,
    ClockCircleOutlined, FolderOutlined, CheckSquareOutlined, EuroCircleOutlined
} from '@ant-design/icons';
//import * as Icons from '@ant-design/icons';
import { getMenusApi, companyApi } from '../services/api';
import { useIsMobile } from '../utils/deviceDetection';

// Dictionnaire de correspondance (Mapping)
const iconMap = {
    SettingOutlined,
    AuditOutlined,
    CreditCardOutlined,
    CustomerServiceOutlined,
    StockOutlined,
    BuildOutlined,
    ShoppingCartOutlined,
    AccountBookOutlined,
    ProfileOutlined,
    CalculatorOutlined,
    TeamOutlined,
    AimOutlined,
    DashboardOutlined,
    UserAddOutlined,
    FunnelPlotOutlined,
    ProjectOutlined,
    ScheduleOutlined,
    CalendarOutlined,
    ThunderboltOutlined,
    LaptopOutlined,
    ShoppingOutlined,
    ShopOutlined,
    ContainerOutlined,
    FileDoneOutlined,
    FileTextOutlined,
    AppstoreOutlined,
    FileSearchOutlined,
    PayCircleOutlined,
    SendOutlined,
    InboxOutlined,
    RetweetOutlined,
    DatabaseOutlined,
    SwapOutlined,
    EditOutlined,
    LinkOutlined,
    BankOutlined,
    ExportOutlined,
    BarChartOutlined,
    ImportOutlined,
    CloudUploadOutlined,
    LockOutlined,
    FileSyncOutlined,
    UserOutlined,
    ClockCircleOutlined,
    FolderOutlined,
    CheckSquareOutlined,
    EuroCircleOutlined

};

// Clés de cache (v2 : ajout mnu_display_mode)
const MENU_CACHE_KEY = 'app_menu_v2';
const LOGO_CACHE_KEYS = {
    SQUARE: 'company_logo_square_v1',
    LARGE: 'company_logo_large_v1',
    TIMESTAMP: 'company_logo_timestamp_v1'
};

// Durée de validité du cache des logos (24 heures en millisecondes)
const LOGO_CACHE_DURATION = 24 * 60 * 60 * 1000;
/**
 * Hook personnalisé pour gérer le menu de l'application
 *
 * Stratégie de cache avec sessionStorage :
 * 1. Au premier chargement de la session : appelle l'API et met en cache
 * 2. Pendant toute la session (F5, navigation) : utilise le cache (pas d'appel API)
 * 3. À la fermeture de l'onglet : le cache est automatiquement vidé
 *
 * @returns {Array} menuItems - Les items du menu formatés pour Ant Design
 */
/**
 * @param {number|null} appId - Si renseigné, filtre les menus par fk_app_id
 */
export const useMenu = (appId = null) => {
    const [menuItems, setMenuItems] = useState([]);
    const [rawMenus, setRawMenus] = useState(null);
    const isMobile = useIsMobile();

    /**
     * Reconstruit l'arborescence hiérarchique à partir d'une liste plate
     * Utilise mnu_parent pour identifier les relations parent-enfant
     * 
     * @param {Array} flatMenus - Liste plate des menus
     * @returns {Array} Arborescence hiérarchique des menus
     */
    const buildHierarchy = (flatMenus) => {
        if (!flatMenus || !Array.isArray(flatMenus)) {
            return [];
        }

        // Créer une map pour un accès rapide par ID
        const menuMap = new Map();
        flatMenus.forEach(menu => {
            menuMap.set(menu.mnu_id, { ...menu, children: [] });
        });

        // Construire la hiérarchie
        const rootMenus = [];
        menuMap.forEach(menu => {
            if (menu.mnu_parent === 0) {
                // Menu de niveau racine
                rootMenus.push(menu);
            } else {
                // Menu enfant - l'attacher à son parent
                const parent = menuMap.get(menu.mnu_parent);
                if (parent) {
                    parent.children.push(menu);
                } else {
                    // Si le parent n'existe pas, traiter comme menu racine
                    console.warn(`Parent ${menu.mnu_parent} introuvable pour le menu ${menu.mnu_id}`);
                    rootMenus.push(menu);
                }
            }
        });

        // Trier par mnu_order à tous les niveaux
        const sortByOrder = (menus) => {
            menus.sort((a, b) => a.mnu_order - b.mnu_order);
            menus.forEach(menu => {
                if (menu.children && menu.children.length > 0) {
                    sortByOrder(menu.children);
                }
            });
        };
        sortByOrder(rootMenus);

        return rootMenus;
    };

    /**
     * Filtre les menus selon le type de terminal courant
     * DESKTOP : visible uniquement sur desktop
     * MOBILE  : visible uniquement sur mobile
     * BOTH    : toujours visible (valeur par défaut)
     *
     * @param {Array} menus - Liste des menus à filtrer
     * @param {boolean} isMobile - true si terminal mobile
     * @returns {Array} Menus filtrés
     */
    const filterByDevice = (menus, isMobile) => {
        return menus.filter(menu => {
            const mode = menu.mnu_display_mode || 'BOTH';
            if (mode === 'MOBILE') return isMobile;
            if (mode === 'DESKTOP') return !isMobile;
            return true; // BOTH
        });
    };

    /**
     * Transforme les données brutes du menu en format Ant Design
     * Mappe les icônes au runtime avec React.createElement
     * Gère la récursivité complète pour tous les niveaux de sous-menus
     * Filtre les items selon mnu_display_mode et le terminal courant
     *
     * @param {Array} menus - Les données brutes du menu
     * @param {boolean} isMobile - true si terminal mobile
     * @returns {Array} Les items formatés pour Ant Design Menu
     */
    const buildMenuItems = (menus, isMobile) => {
        if (!menus || !Array.isArray(menus)) {
            return [];
        }

        return filterByDevice(menus, isMobile).map(menu => {
            // ── Titre de section (non-cliquable) ──────────────────────────
            // APRÈS
            if (menu.mnu_type === 'group') {
                const children = buildMenuItems(menu.children || [], isMobile);
                if (!children.length) return null;

                // Même logique d'icône que pour les autres items
                let groupIcon = null;
                if (menu.mnu_mif) {
                    const trimmed = menu.mnu_mif.trim();
                    const isImagePath = /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(trimmed);
                    if (isImagePath) {
                        groupIcon = (
                            <img
                                src={trimmed}
                                alt=""
                                style={{ width: 20, height: 20, objectFit: 'contain', verticalAlign: 'middle', marginRight: 6 }}
                            />
                        );
                    } else {
                        const match = trimmed.match(/<(\w+)\s*\/?>/);
                        const iconName = match ? match[1] : null;
                        const IconComponent = iconName ? iconMap[iconName] : null;
                        if (IconComponent) {
                            groupIcon = <IconComponent style={{ marginRight: 6, fontSize: 13 }} />;
                        }
                    }
                }

                return {
                    type: 'group',
                    label: groupIcon
                        ? <span>{groupIcon}{menu.mnu_lib}</span>
                        : menu.mnu_lib,
                    children,
                };
            }

            const hasChildrenCheck = menu.children && Array.isArray(menu.children) && menu.children.length > 0;
            // Feuilles : clé = mnu_href pour correspondre à location.pathname dans selectedKeys
            // Parents : clé = mnu_id (pas de href direct)
            const key = (!hasChildrenCheck && menu.mnu_href)
                ? menu.mnu_href
                : (menu.mnu_id ? String(menu.mnu_id) : `menu-${menu.mnu_lib || Math.random()}`);

            // Extraire le nom du composant depuis la string mnu_mif
            // "<CalculatorOutlined />" -> "CalculatorOutlined"
            let iconNode = null;
            if (menu.mnu_mif) {
                const trimmed = menu.mnu_mif.trim();

                // Icône image PNG/JPG/SVG/WEBP — ex: /public/crm.png
                const isImagePath = /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(trimmed);
                if (isImagePath) {
                    iconNode = (
                        <img
                            src={trimmed}
                            alt=""
                            style={{ width: 16, height: 16, objectFit: 'contain', verticalAlign: 'middle' }}
                        />
                    );
                } else {
                    // Icône Ant Design — ex: <LockOutlined />
                    const match = trimmed.match(/<(\w+)\s*\/?>/);
                    const iconName = match ? match[1] : null;
                    const IconComponent = iconName ? iconMap[iconName] : null;
                    if (IconComponent) iconNode = <IconComponent />;
                }
            }

            const hasChildren = hasChildrenCheck;

            // Construire récursivement les enfants (filtrés aussi par device)
            const children = hasChildren ? buildMenuItems(menu.children, isMobile) : undefined;

            // Si le parent n'a plus d'enfants visibles après filtrage (et pas de lien direct), l'ignorer
            if (hasChildren && (!children || children.length === 0) && !menu.mnu_href) {
                return null;
            }

            // Si l'item a des enfants, ne pas mettre de lien (juste un label)
            // Sinon, mettre un lien cliquable
            const label = (hasChildren && children?.length > 0)
                ? (menu.mnu_lib || 'Menu sans nom')
                : (
                    <Link to={menu.mnu_href || '/'} style={{ textAlign: 'left', display: 'block' }}>
                        {menu.mnu_lib || 'Menu sans nom'}
                    </Link>
                );

            return {
                key,
                icon: iconNode,
                label,
                children: children?.length > 0 ? children : undefined,
            };
        }).filter(Boolean);
    };

    // Supprime les doublons de clé pour éviter le warning Ant Design "Duplicated key"
    const deduplicateKeys = (items, seen = new Set()) => {
        return items.filter(item => {
            // Toujours récurser dans les enfants (y compris pour les items de type group sans key)
            if (item?.children) item.children = deduplicateKeys(item.children, seen);
            if (!item?.key) return true;
            if (seen.has(item.key)) return false;
            seen.add(item.key);
            return true;
        });
    };

    // Effect 1 : charge les données brutes depuis le cache ou l'API (une seule fois)
    useEffect(() => {
        let isMounted = true;

        const loadMenu = async () => {
            try {
                const cached = sessionStorage.getItem(MENU_CACHE_KEY);

                if (cached) {
                    try {
                        const cachedData = JSON.parse(cached);
                        if (isMounted) setRawMenus(cachedData);
                        return;
                    } catch (parseError) {
                        console.error('Erreur de parsing du cache, suppression...', parseError);
                        sessionStorage.removeItem(MENU_CACHE_KEY);
                    }
                }

                const response = await getMenusApi();

                if (response.status && response.menus && isMounted) {
                    const flatMenuData = response.menus;
                    sessionStorage.setItem(MENU_CACHE_KEY, JSON.stringify(flatMenuData));
                    if (isMounted) setRawMenus(flatMenuData);
                }
            } catch (error) {
                console.error('❌ Erreur lors du chargement du menu:', error);
                if (!menuItems.length && isMounted) {
                    message.error("Erreur lors du chargement du menu");
                }
            }
        };

        loadMenu();
        return () => { isMounted = false; };
    }, []); // Charger UNE SEULE FOIS au démarrage

    // Effect 2 : reconstruit le menu formaté quand les données, l'app ou le terminal changent
    useEffect(() => {
        if (!rawMenus) return;
        const filtered = appId !== null
            ? rawMenus.filter(m => m.fk_app_id === appId)
            : rawMenus;
        const hierarchicalMenu = buildHierarchy(filtered);
        const formattedMenu = deduplicateKeys(buildMenuItems(hierarchicalMenu, isMobile));
        setMenuItems(formattedMenu);
    }, [rawMenus, isMobile, appId]); // eslint-disable-line react-hooks/exhaustive-deps

    return menuItems;
};

/**
 * Hook personnalisé pour gérer les logos de l'application
 * 
 * @returns {Object} { logoSquare, logoLarge, isLoading }
 */
export const useLogos = () => {
    const [logoSquare, setLogoSquare] = useState('');
    const [logoLarge, setLogoLarge] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    /**
     * Vérifie si le cache des logos est encore valide
     */
    const isLogoCacheValid = () => {
        try {
            const timestamp = sessionStorage.getItem(LOGO_CACHE_KEYS.TIMESTAMP);
            if (!timestamp) return false;

            const now = Date.now();
            const cacheAge = now - parseInt(timestamp, 10);
            return cacheAge < LOGO_CACHE_DURATION;
        } catch (error) {
            console.error('Erreur lors de la vérification du cache des logos:', error);
            return false;
        }
    };

    /**
     * Récupère les logos depuis le cache
     */
    const getLogosFromCache = () => {
        try {
            if (!isLogoCacheValid()) {

                clearLogoCache();
                return null;
            }

            const square = sessionStorage.getItem(LOGO_CACHE_KEYS.SQUARE);
            const large = sessionStorage.getItem(LOGO_CACHE_KEYS.LARGE);

            if (square && large) {

                return { square, large };
            }

            return null;
        } catch (error) {
            console.error('Erreur lors de la lecture du cache des logos:', error);
            clearLogoCache();
            return null;
        }
    };

    /**
     * Stocke les logos dans le cache
     */
    const setLogosToCache = (squareBase64, largeBase64) => {
        try {
            sessionStorage.setItem(LOGO_CACHE_KEYS.SQUARE, squareBase64);
            sessionStorage.setItem(LOGO_CACHE_KEYS.LARGE, largeBase64);
            sessionStorage.setItem(LOGO_CACHE_KEYS.TIMESTAMP, Date.now().toString());

        } catch (error) {
            console.error('Erreur lors de la mise en cache des logos:', error);
        }
    };

    useEffect(() => {
        let isMounted = true;

        const loadLogos = async () => {
            try {
                // Vérifier d'abord le cache
                const cachedLogos = getLogosFromCache();
                if (cachedLogos) {
                    if (isMounted) {
                        setLogoSquare(cachedLogos.square);
                        setLogoLarge(cachedLogos.large);
                        setIsLoading(false);
                    }
                    return;
                }

                // Si pas de cache valide, charger depuis l'API                
                const [squareResponse, largeResponse] = await Promise.all([
                    companyApi.getLogo(1, 'square'),
                    companyApi.getLogo(1, 'large')
                ]);

                // Extraire la chaîne base64 de la réponse
                const squareBase64 = squareResponse?.data?.base64 || '';
                const largeBase64 = largeResponse?.data?.base64 || '';

                if (isMounted) {
                    setLogoSquare(squareBase64);
                    setLogoLarge(largeBase64);
                    setIsLoading(false);
                }

                // Sauvegarder dans le cache
                setLogosToCache(squareBase64, largeBase64);
            } catch (error) {
                console.error('❌ Erreur lors du chargement des logos:', error);
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadLogos();

        return () => {
            isMounted = false;
        };
    }, []);

    return { logoSquare, logoLarge, isLoading };
};

/**
 * Fonction utilitaire pour vider le cache du menu
 * Utile lors de la déconnexion ou du changement de droits
 */
export const clearMenuCache = () => {
    sessionStorage.removeItem(MENU_CACHE_KEY);
};

/**
 * Fonction utilitaire pour vider le cache des logos
 */
export const clearLogoCache = () => {
    try {
        sessionStorage.removeItem(LOGO_CACHE_KEYS.SQUARE);
        sessionStorage.removeItem(LOGO_CACHE_KEYS.LARGE);
        sessionStorage.removeItem(LOGO_CACHE_KEYS.TIMESTAMP);
    } catch (error) {
        console.error('Erreur lors de la suppression du cache des logos:', error);
    }
};

/**
 * Fonction utilitaire pour vider tous les caches (menu + logos)
 * À appeler lors de la déconnexion
 */
export const clearAllCache = () => {
    clearMenuCache();
    clearLogoCache();
    clearApplicationsCache();
};