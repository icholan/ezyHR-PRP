import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
    requirePlatformAdmin?: boolean;
    requireSetup?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false, requirePlatformAdmin = false, requireSetup }) => {
    const { isAuthenticated, user } = useAuthStore();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requirePlatformAdmin && !user?.is_platform_admin) {
        return <Navigate to="/dashboard" replace />;
    }

    if (requireAdmin && !requirePlatformAdmin && !user?.is_platform_admin && !user?.is_tenant_admin) {
        return <Navigate to="/dashboard" replace />;
    }

    // Traps new admins in the onboarding wizard
    if (requireSetup === true && user?.is_tenant_admin && !user?.setup_complete) {
        return <Navigate to="/onboarding" replace />;
    }
    
    // Prevents already-onboarded admins from returning to the wizard
    if (requireSetup === false && user?.setup_complete) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
