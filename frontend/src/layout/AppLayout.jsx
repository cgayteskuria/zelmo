import React, { useState, useEffect } from 'react';
import './layout.css';
import { useApplications } from '../hooks/useApplications';
import { useActiveApp } from '../hooks/useActiveApp';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import MobileDrawer from './MobileDrawer';

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH = 256;
const SIDEBAR_WIDTH_COLLAPSED = 64;
const COLLAPSE_KEY = 'zelmo_sidebar_collapsed';

const AppLayout = ({ children }) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const getInitialCollapsed = () => {
        try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; }
    };
    const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialCollapsed);

    const { applications } = useApplications();
    const { activeApp } = useActiveApp(applications);

    useEffect(() => {
        const check = () => {
            const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
            setIsMobile(mobile);
            if (mobile) setDrawerOpen(false);
        };
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const handleToggleSidebar = () => {
        if (isMobile) {
            setDrawerOpen(prev => !prev);
        } else {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* ignore */ }
        }
    };

    const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

    return (
        <div className="app-root">
            {/* ── Bandeau supérieur ─────────────────────────────────── */}
            <TopBar
                activeApp={activeApp}
                onMenuOpen={handleToggleSidebar}
            />

            {/* ── Corps de l'application ───────────────────────────── */}
            <div className="app-body">

                {/* ── Sidebar desktop ──────────────────────────────── */}
                {!isMobile && (
                    <Sidebar
                        activeApp={activeApp}
                        collapsed={sidebarCollapsed}
                        onToggle={handleToggleSidebar}
                    />
                )}

                {/* ── Drawer mobile ────────────────────────────────── */}
                {isMobile && (
                    <MobileDrawer
                        open={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                        activeApp={activeApp}
                    />
                )}

                {/* ── Zone contenu blanc avec arrondi concave ──────── */}
                <div
                    className="content-area"
                    style={!isMobile ? {
                        marginLeft: sidebarWidth,
                        transition: `margin-left 0.2s ease`,
                    } : undefined}
                >
                    <main className="content-main">
                        {children}
                    </main>
                </div>

            </div>
        </div>
    );
};

export default AppLayout;
