import { useAuth } from '../contexts/AuthContext';

/**
 * Composant pour afficher conditionnellement selon les rôles
 * Usage: <HasRole role="Administrateur">...</HasRole>
 */
export default function HasRole({ role, children, fallback = null }) {
    const { hasRole } = useAuth();

    if (!hasRole(role)) {
        return fallback;
    }

    return children;
}
