import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { message } from '../../utils/antdStatic';

/**
 * Route protégée avec vérification optionnelle de permission/rôle
 * Usage:
 *   <ProtectedRoute>...</ProtectedRoute>  // Auth seulement
 *   <ProtectedRoute permission="partners.view">...</ProtectedRoute>
 *   <ProtectedRoute role="Administrateur">...</ProtectedRoute>
 */
export default function ProtectedRoute({
    children,
    permission = null,
    role = null,
    fallback = null
}) {
    const { isAuthenticated, can, hasRole, loading } = useAuth();

    const denied = !loading && isAuthenticated && (
        (permission && !can(permission)) ||
        (role && !hasRole(role))
    );

    // message.error doit être dans un effet — jamais pendant le rendu
    useEffect(() => {
        if (!denied) return;
        if (permission && !can(permission)) {
            message.error("Vous n'avez pas la permission d'accéder à cette page");
        } else if (role && !hasRole(role)) {
            message.error("Vous n'avez pas le rôle requis pour accéder à cette page");
        }
    }, [denied]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (denied) return fallback || <Navigate to="/dashboard" replace />;

    return children;
}
