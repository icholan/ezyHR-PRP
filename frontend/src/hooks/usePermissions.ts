import { useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';


export const usePermissions = () => {
    const { user } = useAuthStore();

    const hasPermission = useCallback((permission: string): boolean => {

        if (!user) return false;

        // Platform Admins and Tenant Admins have all permissions
        if (user.is_platform_admin || user.is_tenant_admin) return true;

        // Check across all entities for non-tenant admins
        if (user.entity_access) {
            return user.entity_access.some(access => 
                access.permissions?.includes(permission)
            );
        }

        return false;
    }, [user]);

    const hasEntityPermission = useCallback((entityId: string, permission: string): boolean => {

        if (!user) return false;
        if (user.is_platform_admin || user.is_tenant_admin) return true;

        if (user.entity_access) {
            const access = user.entity_access.find(a => a.entity_id === entityId);
            return access?.permissions?.includes(permission) || false;
        }

        return false;
    }, [user]);

    return {
        hasPermission,
        hasEntityPermission,
        isTenantAdmin: user?.is_tenant_admin || false,
        isPlatformAdmin: user?.is_platform_admin || false
    };
};
