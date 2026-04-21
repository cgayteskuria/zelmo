import { useAuth } from '../../contexts/AuthContext';

/**
 * Composant pour afficher conditionnellement selon les permissions
 * Usage: <CanAccess permission="partners.edit">...</CanAccess>
 */
export default function CanAccess({ permission, children, fallback = null }) {
    const { can } = useAuth();

    if (!can(permission)) {
        return fallback;
    }

    return children;
}
