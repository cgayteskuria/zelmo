import { useAuth } from '../../contexts/AuthContext';

/**
 * Composant pour afficher conditionnellement selon les permissions
 * Usage: <CanAccess permission="partners.edit">...</CanAccess>
 * Usage multiple (OR): <CanAccess permission={["partners.edit", "customers.edit"]}>...</CanAccess>
 */
export default function CanAccess({ permission, children, fallback = null }) {
    const { can, canAny } = useAuth();

    const hasAccess = Array.isArray(permission) ? canAny(permission) : can(permission);

    if (!hasAccess) {
        return fallback;
    }

    return children;
}
