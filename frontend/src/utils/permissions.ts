export const hasPermission = (user: any, permission: string, entityId?: string | null): boolean => {
    // 1. Platform admins have global access
    if (user?.is_platform_admin) return true;

    // 2. Tenant admins (global within their tenant) have all permissions
    if (user?.is_tenant_admin) return true;

    // 3. Entity-level check
    const targetEntityId = entityId || user?.selected_entity_id;
    if (!targetEntityId || !user?.entity_access) return false;

    const access = user.entity_access.find((a: any) => a.entity_id === targetEntityId);
    if (!access || !access.permissions) return false;

    return access.permissions.includes(permission);
};
