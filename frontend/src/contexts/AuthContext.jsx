import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { getUser, getToken, login as authLogin, logout as authLogout } from '../services/auth';
import { accountConfigApi } from '../services/apiSettings';
import useInactivityTimeout from '../hooks/useInactivityTimeout';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [acoVatRegime, setAcoVatRegime] = useState('debits');

    const fetchAccountConfig = useCallback(async () => {
        try {
            const response = await accountConfigApi.get();
            setAcoVatRegime(response.data?.aco_vat_regime || 'debits');
        } catch {
            // silently keep default
        }
    }, []);

    // Charger l'utilisateur depuis localStorage au montage
    useEffect(() => {
        const storedUser = getUser();
        if (storedUser) {
            setUser(storedUser);
            setPermissions(storedUser.permissions || []);
            setRoles(storedUser.roles || []);
            fetchAccountConfig();
        }
        setLoading(false);
    }, [fetchAccountConfig]);

    const login = (userData, token) => {
        authLogin(userData, token);
        setUser(userData);
        setPermissions(userData.permissions || []);
        setRoles(userData.roles || []);
        fetchAccountConfig();
    };

    const logout = useCallback(() => {
        authLogout();
        setUser(null);
        setPermissions([]);
        setRoles([]);
    }, []);

    // Gestion du timeout d'inactivité
    const handleInactivityTimeout = useCallback(() => {
        logout();
        window.location.href = '/login?reason=inactivity';
    }, [logout]);

    const { showWarning, remainingTime, dismissWarning } = useInactivityTimeout({
        onTimeout: handleInactivityTimeout,
        enabled: !!user, // Activer seulement si l'utilisateur est connecté
    });

    // Déclenchement automatique de la redirection quand le temps atteint 0
    useEffect(() => {
        if (showWarning && remainingTime <= 0) {
            handleInactivityTimeout();
        }
    }, [remainingTime, showWarning, handleInactivityTimeout]);

    // Formater le temps restant en minutes:secondes
    const formatRemainingTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    /**
     * Vérifier si l'utilisateur a une permission
     * Support des wildcards (ex: partners.*)
     */
    const can = (permission) => {
        if (!permissions || permissions.length === 0) return false;

        // Permission globale
        if (permissions.includes('*')) return true;

        // Correspondance exacte
        if (permissions.includes(permission)) return true;

        // Support wildcard (ex: partners.* correspond à partners.view)
        return permissions.some(p => {
            if (p.endsWith('.*')) {
                const prefix = p.slice(0, -2);
                return permission.startsWith(prefix + '.');
            }
            return false;
        });
    };

    /**
     * Vérifier si l'utilisateur a un rôle
     */
    const hasRole = (role) => {
        if (!roles || roles.length === 0) return false;
        return roles.includes(role);
    };

    /**
     * Vérifier si l'utilisateur a au moins un des rôles
     */
    const hasAnyRole = (rolesList) => {
        return rolesList.some(role => hasRole(role));
    };

    /**
     * Vérifier si l'utilisateur a au moins une des permissions
     */
    const canAny = (permissionList) => {
        return permissionList.some(permission => can(permission));
    };

    /**
     * Vérifier si l'utilisateur a toutes les permissions
     */
    const canAll = (permissionList) => {
        return permissionList.every(permission => can(permission));
    };

    const updateUser = (updatedUser) => {
        const merged = { ...user, ...updatedUser };
        localStorage.setItem('zelmo_user', JSON.stringify(merged));
        setUser(merged);
    };

    const value = {
        user,
        permissions,
        roles,
        loading,
        login,
        logout,
        updateUser,
        can,
        hasRole,
        hasAnyRole,
        canAny,
        canAll,
        isAuthenticated: !!user,
        acoVatRegime,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}

            {/* Modal d'avertissement d'inactivité */}
            <Modal
                title="Session inactive"
                open={showWarning}
                onOk={dismissWarning}
                onCancel={handleInactivityTimeout}
                okText="Rester connecté"
                cancelText="Se déconnecter"
                closable={false}
                maskClosable={false}
            >
                <p>
                    Votre session est inactive depuis un moment.
                </p>
                <p>
                    Vous serez automatiquement déconnecté dans{' '}
                    <strong>{formatRemainingTime(remainingTime)}</strong>.
                </p>
                <p>
                    Cliquez sur "Rester connecté" pour continuer votre session.
                </p>
            </Modal>
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
