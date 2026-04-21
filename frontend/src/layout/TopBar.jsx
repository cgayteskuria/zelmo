import { MenuOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLogos } from '../hooks/useMenu.jsx';
import AppLauncherOverlay from './AppLauncherOverlay';
import UserMenu from './UserMenu';
import AppIcon from '../components/common/AppIcon';
import TimeTracker from './TimeTracker';
import './layout.css';

const TopBar = ({ onMenuOpen, activeApp }) => {
    const { logoSquare, isLoading } = useLogos();
    const navigate = useNavigate();

    return (
        <header className="app-header">
            {/* ── Gauche : hamburger + logo + module actif ── */}
            <div className="header-left">
                <button className="icon-btn" onClick={onMenuOpen ?? (() => {})} title="Menu">
                    <MenuOutlined />
                </button>

                {!isLoading && logoSquare ? (
                    <img
                        src={logoSquare}
                        alt="Zelmo"
                        onClick={() => navigate('/dashboard')}
                        style={{ height: 36, maxWidth: 120, objectFit: 'contain', cursor: 'pointer' }}
                    />
                ) : (
                    <span
                        onClick={() => navigate('/dashboard')}
                        style={{
                            fontFamily: 'var(--font)',
                            fontWeight: 'var(--font-medium)',
                            fontSize: 'var(--text-md)',
                            color: 'var(--color-active)',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        Zelmo
                    </span>
                )}

                {activeApp && (
                    <>
                        <span style={{ color: 'var(--color-border)', fontSize: 18, margin: '0 4px' }}>|</span>
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: 'var(--font)',
                            fontWeight: 'var(--font-medium)',
                            fontSize: 'var(--text-lg)',
                            color: 'var(--color-text)',
                            userSelect: 'none',
                        }}>
                            <AppIcon icon={activeApp.app_icon} size={35} alt={activeApp.app_lib} />
                            <span>{activeApp.app_lib}</span>
                        </span>
                    </>
                )}
            </div>

            {/* ── Centre : vide (barre de recherche future) ── */}
            <div className="header-center" />

            {/* ── Droite : timer (module time uniquement) + launcher + avatar ── */}
            <div className="header-right">
                {activeApp?.app_slug === 'time' && <TimeTracker />}
                <AppLauncherOverlay />
                <UserMenu />
            </div>
        </header>
    );
};

export default TopBar;
