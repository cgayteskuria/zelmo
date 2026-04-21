import { useMemo } from 'react';
import { Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMenu } from '../hooks/useMenu.jsx';
import { useApplications } from '../hooks/useApplications.js';
import TicketsMenuSection from '../pages/assistance/TicketsMenuSection.jsx';
import AppIcon from '../components/common/AppIcon.jsx';
import './layout.css';

export const SIDEBAR_WIDTH = 256;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

/** Vérifie récursivement si un menu item avec la clé donnée existe */
function hasMenuKey(items, key) {
    for (const item of items) {
        if (item.key === key) return true;
        if (item.children?.length && hasMenuKey(item.children, key)) return true;
    }
    return false;
}

/** Collecte récursivement les clés de tous les parents dont un enfant correspond au pathname */
function findOpenKeys(items, pathname, parents = []) {
    for (const item of items) {
        if (item.children?.length) {
            const found = findOpenKeys(item.children, pathname, [...parents, item.key]);
            if (found) return found;
        } else if (item.key === pathname) {
            return parents;
        }
    }
    return null;
}

const Sidebar = ({ activeApp, collapsed }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const menuItems = useMenu(activeApp?.app_id ?? null);
    const { applications } = useApplications();

    const defaultOpenKeys = useMemo(
        () => findOpenKeys(menuItems, location.pathname) ?? [],
        [menuItems] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const isAssistanceApp = useMemo(() => hasMenuKey(menuItems, '/tickets'), [menuItems]);

    const sidebarStyle = {
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH,
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        paddingTop: 56,
    };

    /* ── Dashboard : liste des modules ──────────────────────── */
    if (!activeApp) {
        return (
            <aside className={`app-sidebar${collapsed ? ' collapsed' : ''}`} style={sidebarStyle}>
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                    {!collapsed && <div className="section-label">Modules</div>}
                    {applications.map(app => (
                        <button
                            key={app.app_id}
                            className={`nav-item${location.pathname === app.app_root_href ? ' active' : ''}`}
                            onClick={() => navigate(app.app_root_href)}
                        >
                            <span className="nav-icon" style={{ fontSize: 18, display: 'flex', alignItems: 'center' }}>
                                <AppIcon icon={app.app_icon} size={18} alt={app.app_lib} />
                            </span>
                            {!collapsed && <span>{app.app_lib}</span>}
                        </button>
                    ))}
                </div>
            </aside>
        );
    }

    /* ── App active : menu habituel ─────────────────────────── */
    return (
        <aside className={`app-sidebar${collapsed ? ' collapsed' : ''}`} style={sidebarStyle}>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    defaultOpenKeys={defaultOpenKeys}
                    items={menuItems}
                    inlineCollapsed={collapsed}
                    style={{ border: 'none', background: 'transparent' }}
                />
                {isAssistanceApp && !collapsed && <TicketsMenuSection />}
            </div>
        </aside>
    );
};

export default Sidebar;
