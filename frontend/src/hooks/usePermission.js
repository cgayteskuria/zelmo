import { useAuth } from '../contexts/AuthContext';

/**
 * Hook pour vérifier les permissions dans les composants
 * Returns: { can, canAny, canAll, hasRole, hasAnyRole, permissions, roles }
 */
function usePermission() {
    const { can, canAny, canAll, hasRole, hasAnyRole, permissions, roles } = useAuth();

    return {
        can,
        canAny,
        canAll,
        hasRole,
        hasAnyRole,
        permissions,
        roles,
    };
}

// Export nommé et export par défaut pour plus de flexibilité
export { usePermission };
export default usePermission;
