import React from 'react';
import { Drawer, Menu } from 'antd';
import { useLocation } from 'react-router-dom';
import { useMenu, useLogos } from '../hooks/useMenu.jsx';
import AppIcon from '../components/common/AppIcon';
import './layout.css';

const MobileDrawer = ({ open, onClose, activeApp }) => {
    const location = useLocation();
    const menuItems = useMenu(activeApp?.app_id ?? null);
    const { logoLarge, isLoading } = useLogos();

    return (
        <Drawer
            open={open}
            onClose={onClose}
            placement="left"
            width={280}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {!isLoading && logoLarge ? (
                        <img
                            src={logoLarge}
                            alt="Logo"
                            style={{ height: 32, maxWidth: 140, objectFit: 'contain' }}
                        />
                    ) : (
                        <span style={{
                            fontFamily: 'var(--font)',
                            fontWeight: 'var(--font-medium)',
                            color: 'var(--color-active)',
                            fontSize: 'var(--text-md)',
                        }}>
                            Zelmo
                        </span>
                    )}
                    {activeApp && (
                        <AppIcon icon={activeApp.app_icon} size={20} alt={activeApp.app_lib} />
                    )}
                </div>
            }
            styles={{
                header: {
                    background: 'var(--bg-surface)',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '12px 16px',
                },
                body: {
                    padding: 8,
                    background: 'var(--bg-surface)',
                },
            }}
        >
            <Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                items={menuItems}
                onClick={onClose}
                style={{ border: 'none', background: 'transparent' }}
            />
        </Drawer>
    );
};

export default MobileDrawer;
