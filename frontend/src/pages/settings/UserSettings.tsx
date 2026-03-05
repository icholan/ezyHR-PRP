import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import {
    UserPlusIcon,
    TrashIcon,
    PencilSquareIcon,
    ShieldCheckIcon,
    CheckCircleIcon,
    XCircleIcon,
    IdentificationIcon,
    LockClosedIcon,
    BuildingOfficeIcon,
    UserGroupIcon,
    EnvelopeIcon,
    KeyIcon,
    MagnifyingGlassIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    FunnelIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '../../store/useAuthStore';
import ConfirmModal from '../../components/ConfirmModal';
import Toast, { ToastType } from '../../components/Toast';

interface UserEntityAccess {
    id?: string;
    entity_id: string;
    role_id: string;
    managed_group_ids?: string[];
}

interface TenantUser {
    id: string;
    email: string;
    full_name: string;
    is_tenant_admin: boolean;
    is_active: boolean;
    created_at: string;
    last_login: string | null;
    person_id?: string | null;
    entity_access?: UserEntityAccess[];
}

interface PersonSummary {
    id: string;
    full_name: string;
}

const UserSettings: React.FC = () => {
    const { user: currentUser } = useAuthStore();
    const [users, setUsers] = useState<TenantUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Filtering & Pagination state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalUsers, setTotalUsers] = useState(0);


    // Form state
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserFullName, setNewUserFullName] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
    const [newUserPersonId, setNewUserPersonId] = useState<string>('');
    const [persons, setPersons] = useState<PersonSummary[]>([]);

    // Entity selection state
    const [entities, setEntities] = useState<{ id: string, name: string }[]>([]);
    const [roles, setRoles] = useState<{ id: string, name: string }[]>([]);
    const [groups, setGroups] = useState<Record<string, { id: string, name: string }[]>>({});
    const [selectedEntities, setSelectedEntities] = useState<UserEntityAccess[]>([]);
    const [editingUser, setEditingUser] = useState<TenantUser | null>(null);

    // Notification and Confirmation state
    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '',
        type: 'success',
        isVisible: false
    });
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; userId: string | null }>({
        isOpen: false,
        userId: null
    });
    const [confirmReset, setConfirmReset] = useState<{ isOpen: boolean; userId: string | null }>({
        isOpen: false,
        userId: null
    });

    const showToast = (message: string, type: ToastType = 'success') => {
        setToast({ message, type, isVisible: true });
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params: any = {
                skip: (currentPage - 1) * pageSize,
                limit: pageSize,
            };

            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }

            if (statusFilter !== 'all') {
                params.is_active = statusFilter === 'active';
            }

            const res = await api.get('/api/v1/users', { params });
            // Handle the new response format: { items: [], total: 0 }
            if (res.data && Array.isArray(res.data.items)) {
                setUsers(res.data.items);
                setTotalUsers(res.data.total);
            } else {
                // Fallback for old API if needed (though we just updated it)
                setUsers(Array.isArray(res.data) ? res.data : []);
                setTotalUsers(Array.isArray(res.data) ? res.data.length : 0);
            }
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    };

    // Refetch when page or filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers();
        }, 300); // Small debounce for search

        return () => clearTimeout(timer);
    }, [currentPage, pageSize, statusFilter, searchQuery]);

    useEffect(() => {
        const fetchEntitiesAndRoles = async () => {
            try {
                const [entRes, roleRes] = await Promise.all([
                    api.get('/api/v1/entities'),
                    api.get('/api/v1/roles')
                ]);
                setEntities(entRes.data);
                setRoles(roleRes.data);

                // Fetch employees for linking (using first entity as default if none selected)
                if (entRes.data.length > 0) {
                    const persRes = await api.get(`/api/v1/employees?entity_id=${entRes.data[0].id}`);
                    setPersons(persRes.data.map((e: any) => ({ id: e.person_id, full_name: e.full_name })));
                }

                // Fetch groups for all entities
                const groupData: Record<string, any[]> = {};
                await Promise.all(entRes.data.map(async (ent: any) => {
                    try {
                        const gRes = await api.get(`/api/v1/masters/groups?entity_id=${ent.id}`);
                        groupData[ent.id] = gRes.data;
                    } catch (e) {
                        console.error(`Failed to fetch groups for ${ent.id}`, e);
                    }
                }));
                setGroups(groupData);
            } catch (error) {
                console.error("Failed to fetch entities and roles", error);
            }
        };
        fetchEntitiesAndRoles();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = {
                email: newUserEmail,
                full_name: newUserFullName,
                is_tenant_admin: newUserIsAdmin,
                person_id: newUserPersonId || null,
                entity_access: newUserIsAdmin ? [] : selectedEntities.map(se => ({
                    entity_id: se.entity_id,
                    role_id: se.role_id,
                    managed_group_ids: se.managed_group_ids
                }))
            };

            if (newUserPassword) {
                payload.password = newUserPassword;
            }

            if (editingUser) {
                await api.patch(`/api/v1/users/${editingUser.id}`, payload);
            } else {
                await api.post('/api/v1/users', payload);
            }

            setIsAddUserModalOpen(false);
            setEditingUser(null);
            fetchUsers();
            resetForm();
            showToast(editingUser ? 'User updated successfully' : 'User invited successfully');
        } catch (error: any) {
            const message = error.response?.data?.detail || 'Failed to save user';
            setFormError(message);
            showToast(message, 'error');
            console.error('Failed to save user', error);
        }
    };

    const handleEditUser = async (user: TenantUser) => {
        try {
            const res = await api.get(`/api/v1/users/${user.id}`);
            const fullUser = res.data;
            setEditingUser(fullUser);
            setNewUserEmail(fullUser.email);
            setNewUserFullName(fullUser.full_name);
            setNewUserPassword('');
            setNewUserIsAdmin(fullUser.is_tenant_admin);
            setNewUserPersonId(fullUser.person_id || '');
            setSelectedEntities(fullUser.entity_access || []);
            setIsAddUserModalOpen(true);
        } catch (error) {
            console.error('Failed to fetch user details', error);
        }
    };

    const resetForm = () => {
        setNewUserEmail('');
        setNewUserFullName('');
        setNewUserPassword('');
        setNewUserIsAdmin(false);
        setNewUserPersonId('');
        setSelectedEntities([]);
        setEditingUser(null);
        setFormError(null);
        setIsAddUserModalOpen(false);
    };

    const handleDeactivate = (userId: string) => {
        setConfirmDelete({ isOpen: true, userId });
    };

    const handleConfirmDeactivate = async () => {
        if (!confirmDelete.userId) return;
        try {
            await api.delete(`/api/v1/users/${confirmDelete.userId}`);
            showToast('User deactivated successfully');
            fetchUsers();
        } catch (error: any) {
            const message = error.response?.data?.detail || 'Failed to deactivate user';
            showToast(message, 'error');
            console.error('Failed to deactivate user', error);
        }
    };

    const handleResetPassword = (userId: string) => {
        setConfirmReset({ isOpen: true, userId });
    };

    const handleConfirmResetPassword = async () => {
        if (!confirmReset.userId) return;
        try {
            await api.patch(`/api/v1/users/${confirmReset.userId}`, {
                password: 'Pass@123'
            });
            showToast('Password reset to Pass@123 successfully');
            setConfirmReset({ isOpen: false, userId: null }); // Close modal after success
        } catch (error: any) {
            const message = error.response?.data?.detail || 'Failed to reset password';
            showToast(message, 'error');
            console.error('Failed to reset password', error);
        }
    };

    const handleEntityRoleChange = (entityId: string, role_id: string, isSelected: boolean) => {
        if (isSelected) {
            // Update role if exists, else add
            const existing = selectedEntities.find(e => e.entity_id === entityId);
            if (existing) {
                setSelectedEntities(selectedEntities.map(e => e.entity_id === entityId ? { ...e, role_id } : e));
            } else {
                setSelectedEntities([...selectedEntities, { entity_id: entityId, role_id, managed_group_ids: [] }]);
            }
        } else {
            // Remove
            setSelectedEntities(selectedEntities.filter(e => e.entity_id !== entityId));
        }
    };

    const handleGroupToggle = (entityId: string, groupId: string, isSelected: boolean) => {
        setSelectedEntities(selectedEntities.map(e => {
            if (e.entity_id !== entityId) return e;
            const currentGroups = e.managed_group_ids || [];
            if (isSelected) {
                return { ...e, managed_group_ids: [...currentGroups, groupId] };
            } else {
                return { ...e, managed_group_ids: currentGroups.filter(id => id !== groupId) };
            }
        }));
    };


    if (!currentUser?.is_tenant_admin) {
        return (
            <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-xl shadow-sm dark:shadow-gray-950/20">
                <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Access Denied</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Only Tenant Administrators can view and manage users.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold font-['Outfit'] text-gray-900 dark:text-gray-100">User Management</h1>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Manage portal access and administrative roles for your team.</p>
                </div>
                <button
                    onClick={() => setIsAddUserModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/20 w-full sm:w-auto"
                >
                    <UserPlusIcon className="w-5 h-5" />
                    Invite User
                </button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-medium"
                    />
                    {loading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-1.5 rounded-2xl shadow-sm">
                    <div className="flex px-2 py-1 items-center gap-2 border-r border-gray-100 dark:border-gray-800">
                        <FunnelIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</span>
                    </div>
                    <div className="flex gap-1 p-1">
                        {(['all', 'active', 'inactive'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${statusFilter === status
                                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 shadow-xl shadow-gray-200/20 dark:shadow-gray-950/50 border border-gray-100 dark:border-gray-800 rounded-[24px] sm:rounded-3xl overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                    <table className="w-full divide-y divide-gray-100 dark:divide-gray-800">
                        <thead className="bg-gray-50/50 dark:bg-gray-800/50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Login</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                            {users.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No users found matching your criteria.
                                    </td>
                                </tr>
                            ) : users.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.full_name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.is_tenant_admin ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 ring-1 ring-inset ring-purple-600/20">
                                                <ShieldCheckIcon className="w-3.5 h-3.5" />
                                                Admin
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-500/10">
                                                Member
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {user.is_active ? (
                                            <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                                                <CheckCircleIcon className="w-4 h-4" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
                                                <XCircleIcon className="w-4 h-4" /> Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-3">
                                            <button
                                                title="Reset Password"
                                                onClick={() => handleResetPassword(user.id)}
                                                className="p-1 text-gray-400 dark:text-gray-500 hover:text-amber-500 transition-colors"
                                            >
                                                <KeyIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                title="Edit User"
                                                onClick={() => handleEditUser(user)}
                                                className="p-1 text-gray-400 dark:text-gray-500 hover:text-primary-600 transition-colors"
                                            >
                                                <PencilSquareIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                title="Deactivate User"
                                                onClick={() => handleDeactivate(user.id)}
                                                disabled={!user.is_active || user.id === currentUser?.id}
                                                className={`transition - colors ${(!user.is_active || user.id === currentUser?.id) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 dark:text-gray-500 hover:text-red-600 dark:text-red-400'} `}
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Show</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm rounded-lg px-2 py-1 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                        >
                            {[10, 20, 50].map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">results</span>
                    </div>

                    <div className="flex-1 flex justify-center items-center gap-4">
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Showing <span className="font-bold text-gray-900 dark:text-gray-100">{Math.min((currentPage - 1) * pageSize + 1, totalUsers)}</span> to <span className="font-bold text-gray-900 dark:text-gray-100">{Math.min(currentPage * pageSize, totalUsers)}</span> of <span className="font-bold text-gray-900 dark:text-gray-100">{totalUsers}</span> users
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className={`p-2 rounded-xl border transition-all ${currentPage === 1
                                ? 'border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900 hover:shadow-sm'
                                }`}
                        >
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.ceil(totalUsers / pageSize) }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === Math.ceil(totalUsers / pageSize) || Math.abs(p - currentPage) <= 1)
                                .map((p, idx, arr) => (
                                    <React.Fragment key={p}>
                                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-gray-400 px-1">...</span>}
                                        <button
                                            onClick={() => setCurrentPage(p)}
                                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${currentPage === p
                                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                                                : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    </React.Fragment>
                                ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalUsers / pageSize), p + 1))}
                            disabled={currentPage === Math.ceil(totalUsers / pageSize) || totalUsers === 0}
                            className={`p-2 rounded-xl border transition-all ${currentPage === Math.ceil(totalUsers / pageSize) || totalUsers === 0
                                ? 'border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900 hover:shadow-sm'
                                }`}
                        >
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md transition-all duration-300">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-['Outfit']">{editingUser ? 'Edit member' : 'Invite New member'}</h3>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{editingUser ? 'Update access rights and details.' : 'Define access rights and company permissions.'}</p>
                            </div>
                            <button
                                onClick={resetForm}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                            >
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="max-h-[80vh] overflow-y-auto">
                            {formError && (
                                <div className="px-8 pt-6">
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 animate-in slide-in-from-top-2">
                                        <XCircleIcon className="w-5 h-5 flex-shrink-0" />
                                        <p className="text-sm font-bold font-['Outfit']">{formError}</p>
                                    </div>
                                </div>
                            )}
                            <div className="p-8 space-y-8">
                                {/* Section 1: User Identity */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <IdentificationIcon className="w-5 h-5 text-primary-600" />
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider font-['Outfit']">User Identity</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5 flex flex-col items-start">
                                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={newUserFullName}
                                                onChange={e => setNewUserFullName(e.target.value)}
                                                className="w-full rounded-2xl border-none bg-gray-50 dark:bg-gray-800 py-3.5 px-4 focus:bg-white dark:focus:bg-gray-950 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium text-sm text-dark-950 dark:text-gray-100"
                                                placeholder="Enter full name"
                                            />
                                        </div>
                                        <div className="space-y-1.5 flex flex-col items-start">
                                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">Email Address</label>
                                            <div className="relative w-full">
                                                <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="email"
                                                    required
                                                    disabled={!!editingUser}
                                                    value={newUserEmail}
                                                    onChange={e => setNewUserEmail(e.target.value)}
                                                    className="w-full pl-11 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 py-3.5 focus:bg-white dark:focus:bg-gray-950 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium text-sm text-dark-950 dark:text-gray-100 disabled:opacity-50"
                                                    placeholder="name@company.com"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <ShieldCheckIcon className="w-5 h-5 text-primary-600" />
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider font-['Outfit']">Access & Identity</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5 flex flex-col items-start">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">Link to Employee</label>
                                        <select
                                            value={newUserPersonId}
                                            onChange={e => setNewUserPersonId(e.target.value)}
                                            className="w-full rounded-2xl border-none bg-gray-50 dark:bg-gray-800 py-3.5 px-4 focus:bg-white dark:focus:bg-gray-950 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium text-sm text-dark-950 dark:text-gray-100"
                                        >
                                            <option value="">-- Not Linked --</option>
                                            {persons.map(p => (
                                                <option key={p.id} value={p.id}>{p.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="p-3.5 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 flex items-center justify-between hover:bg-white dark:hover:bg-gray-950 ring-4 ring-transparent hover:ring-primary-500/5 transition-all cursor-pointer group h-[52px]" onClick={() => setNewUserIsAdmin(!newUserIsAdmin)}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg transition-colors ${newUserIsAdmin ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'} `}>
                                                <ShieldCheckIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-['Outfit']">Tenant Admin</span>
                                        </div>
                                        <div className={`w-10 h-5 rounded-full relative transition-all duration-300 ${newUserIsAdmin ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'} `}>
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${newUserIsAdmin ? 'left-6' : 'left-1'} `} />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                    <div className="space-y-1.5 flex flex-col items-start">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1">Password {editingUser && '(Optional)'}</label>
                                        <div className="relative w-full">
                                            <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="password"
                                                required={!editingUser}
                                                value={newUserPassword}
                                                onChange={e => setNewUserPassword(e.target.value)}
                                                className="w-full pl-11 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 py-3.5 focus:bg-white dark:focus:bg-gray-950 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium text-sm text-dark-950 dark:text-gray-100"
                                                placeholder="********"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Scope Of Access */}
                                {!newUserIsAdmin && entities.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                        <div className="flex items-center gap-2 mb-2">
                                            <BuildingOfficeIcon className="w-5 h-5 text-primary-600" />
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Scope of Access</h4>
                                        </div>
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 -mt-2 mb-4">Select the companies this member should manage and their specific role.</p>

                                        <div className="space-y-4">
                                            {entities.map(entity => {
                                                const currentAccess = selectedEntities.find(e => e.entity_id === entity.id);
                                                const isSelected = !!currentAccess;
                                                const currentRole = currentAccess?.role_id || (roles.length > 0 ? roles[0].id : '');
                                                const entityGroups = groups[entity.id] || [];

                                                return (
                                                    <div
                                                        key={entity.id}
                                                        className={`rounded-3xl border transition-all duration-300 overflow-hidden ${isSelected
                                                            ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-900/10 ring-1 ring-primary-500/20 shadow-md shadow-primary-500/5'
                                                            : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
                                                            } `}
                                                    >
                                                        <div className="p-5">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-4 flex-1">
                                                                    <div className={`p-2.5 rounded-2xl transition-all duration-300 ${isSelected ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'} `}>
                                                                        <BuildingOfficeIcon className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="flex flex-col text-left">
                                                                        <span className={`text-sm font-bold transition-colors ${isSelected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'} `}>{entity.name}</span>
                                                                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">Company Entity</span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    {isSelected && roles.length > 0 && (
                                                                        <select
                                                                            value={currentRole}
                                                                            onChange={(e) => handleEntityRoleChange(entity.id, e.target.value, true)}
                                                                            className="block w-32 rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-xs font-semibold"
                                                                        >
                                                                            {roles.map(r => (
                                                                                <option key={r.id} value={r.id}>{r.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleEntityRoleChange(entity.id, currentRole, !isSelected)}
                                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSelected
                                                                            ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                                                                            : 'bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/20'
                                                                            } `}
                                                                    >
                                                                        {isSelected ? 'Remove' : 'Grant Access'}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Groups restriction */}
                                                            {isSelected && entityGroups.length > 0 && (
                                                                <div className="mt-5 pl-14 pt-4 border-t border-primary-500/10 animate-in slide-in-from-top-2 duration-300">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <UserGroupIcon className="w-3.5 h-3.5 text-primary-500" />
                                                                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Restrict by Employment Groups</label>
                                                                        <span className="text-[9px] bg-primary-100 dark:bg-primary-900/30 text-primary-600 px-1.5 py-0.5 rounded-full font-bold ml-auto un-capitalize">Optional</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {entityGroups.map(group => (
                                                                            <label
                                                                                key={group.id}
                                                                                className={`flex items-center p-2.5 rounded-xl border transition-all cursor-pointer group/item ${currentAccess?.managed_group_ids?.includes(group.id)
                                                                                    ? 'border-primary-200 bg-white dark:bg-gray-900 dark:border-primary-900/30 shadow-sm'
                                                                                    : 'border-transparent bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                                                                                    } `}
                                                                            >
                                                                                <div className="relative flex items-center">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={currentAccess?.managed_group_ids?.includes(group.id)}
                                                                                        onChange={(e) => handleGroupToggle(entity.id, group.id, e.target.checked)}
                                                                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded-lg transition-all"
                                                                                    />
                                                                                </div>
                                                                                <span className={`ml-2 text-xs font-semibold truncate transition-colors ${currentAccess?.managed_group_ids?.includes(group.id) ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 group-hover/item:text-gray-700'
                                                                                    } `}>
                                                                                    {group.name}
                                                                                </span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-8 bg-gray-50/80 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex gap-4 justify-end backdrop-blur-sm sticky bottom-0">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-6 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-800 rounded-2xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all font-['Outfit']"
                                >
                                    Go Back
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-xl shadow-primary-500/20 hover:shadow-primary-500/40 transition-all font-['Outfit'] transform hover:-translate-y-0.5"
                                >
                                    {editingUser ? 'Save Changes' : 'Send Invitation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, userId: null })}
                onConfirm={handleConfirmDeactivate}
                title="Deactivate User"
                message="Are you sure you want to deactivate this user? They will no longer be able to log in to the portal."
                confirmLabel="Deactivate"
            />

            <ConfirmModal
                isOpen={confirmReset.isOpen}
                onClose={() => setConfirmReset({ isOpen: false, userId: null })}
                onConfirm={handleConfirmResetPassword}
                title="Reset Password"
                message="Are you sure you want to reset this user's password to 'Pass@123'?"
                confirmLabel="Reset Password"
                type="warning"
            />

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={() => setToast({ ...toast, isVisible: false })}
            />
        </div>
    );
};

export default UserSettings;
