import React, { useEffect } from 'react';
import { Popover, Spin } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApplications } from '../hooks/useApplications';
import AppIcon from '../components/common/AppIcon';
import './layout.css';

const AppGrid = ({ applications, onClose }) => {
    const navigate = useNavigate();

    if (!applications.length) {
        return <div style={{ padding: 16 }}><Spin size="small" /></div>;
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
            padding: 8,
            minWidth: 230,
        }}>
            {applications.map(app => (
                <button
                    key={app.app_id}
                    onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                            window.open(window.location.origin + app.app_root_href, '_blank');
                        } else {
                            navigate(app.app_root_href);
                            onClose();
                        }
                    }}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '14px 8px',
                        border: '1px solid transparent',
                        borderRadius: 'var(--radius-card)',
                        background: 'transparent',
                        cursor: 'pointer',
                        transition: 'background var(--transition-fast)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text)',
                        lineHeight: 1.3,
                        textAlign: 'center',
                        fontFamily: 'var(--font)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                    <AppIcon icon={app.app_icon} size={40} alt={app.app_lib} />
                    <span>{app.app_lib}</span>
                </button>
            ))}
        </div>
    );
};

const AppLauncherOverlay = () => {
    const [open, setOpen] = React.useState(false);
    const { applications, loading } = useApplications();
    const location = useLocation();

    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            trigger="click"
            placement="bottomRight"
            content={
                loading
                    ? <div style={{ padding: 16 }}><Spin size="small" /></div>
                    : <AppGrid applications={applications} onClose={() => setOpen(false)} />
            }
            arrow={false}
            styles={{
                body: {
                    borderRadius: 'var(--radius-card)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    padding: 0,
                },
            }}
        >
            <button className="icon-btn apps"
            title="Applications"            
            >
                <AppstoreOutlined />
            </button>
        </Popover>
    );
};

export default AppLauncherOverlay;
