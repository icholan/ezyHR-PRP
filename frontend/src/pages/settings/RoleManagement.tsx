import React, { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
    Plus, Pencil, Trash2, ShieldAlert, X,
    Shield, Search, CheckCircle2, ChevronRight,
    Users, Lock, Layout, Activity,
    Eye, Edit, Trash
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
}

const AVAILABLE_PERMISSIONS = [
    { id: 'view_employees', label: 'View Employees', group: 'Employee Management', icon: Users },
    { id: 'edit_employees', label: 'Edit Employees', group: 'Employee Management', icon: Edit },
    { id: 'delete_employees', label: 'Delete Employees', group: 'Employee Management', icon: Trash },
    { id: 'view_payroll', label: 'View Payroll', group: 'Payroll', icon: Eye },
    { id: 'run_payroll', label: 'Run Payroll', group: 'Payroll', icon: Activity },
    { id: 'approve_payroll', label: 'Approve Payroll', group: 'Payroll', icon: CheckCircle2 },
    { id: 'view_attendance', label: 'View Attendance', group: 'Attendance', icon: Eye },
    { id: 'edit_attendance', label: 'Edit Attendance', group: 'Attendance', icon: Edit },
    { id: 'manage_shifts', label: 'Manage Shifts', group: 'Attendance', icon: Layout },
    { id: 'view_leave', label: 'View Leave', group: 'Leave Management', icon: Eye },
    { id: 'approve_leave', label: 'Approve Leave', group: 'Leave Management', icon: CheckCircle2 },
    { id: 'manage_leave_types', label: 'Manage Leave Types', group: 'Leave Management', icon: Layout },
    { id: 'view_reports', label: 'View Reports', group: 'System', icon: Eye },
    { id: 'manage_roles', label: 'Manage Roles', group: 'System', icon: Lock },
];

const RoleManagement: React.FC = () => {
    const { user: currentUser } = useAuthStore();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/v1/roles');
            setRoles(res.data);
        } catch (error) {
            console.error('Failed to fetch roles', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser?.is_tenant_admin) {
            fetchRoles();
        }
    }, [currentUser]);

    const handleOpenModal = (role?: Role) => {
        setSearchQuery('');
        if (role) {
            setEditingRoleId(role.id);
            setRoleName(role.name);
            setRoleDescription(role.description || '');
            setSelectedPermissions(role.permissions);
        } else {
            setEditingRoleId(null);
            setRoleName('');
            setRoleDescription('');
            setSelectedPermissions([]);
        }
        setIsModalOpen(true);
    };

    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: roleName,
                description: roleDescription,
                permissions: selectedPermissions
            };

            if (editingRoleId) {
                await api.put(`/api/v1/roles/${editingRoleId}`, payload);
            } else {
                await api.post('/api/v1/roles', payload);
            }
            setIsModalOpen(false);
            fetchRoles();
        } catch (error) {
            console.error('Failed to save role', error);
        }
    };

    const handleDeleteRole = async (role: Role) => {
        if (['HR Admin', 'Manager', 'Employee'].includes(role.name)) return;
        if (!window.confirm(`Are you sure you want to delete the ${role.name} role?`)) return;

        try {
            await api.delete(`/api/v1/roles/${role.id}`);
            fetchRoles();
        } catch (error) {
            console.error('Failed to delete role', error);
            alert('Cannot delete this role as it may be assigned to active users.');
        }
    };

    const togglePermission = (permId: string) => {
        setSelectedPermissions(prev =>
            prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
        );
    };

    const toggleCategory = (category: string, perms: typeof AVAILABLE_PERMISSIONS) => {
        const categoryPermIds = perms.map(p => p.id);
        const allSelected = categoryPermIds.every(id => selectedPermissions.includes(id));

        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(id => !categoryPermIds.includes(id)));
        } else {
            setSelectedPermissions(prev => {
                const others = prev.filter(id => !categoryPermIds.includes(id));
                return [...others, ...categoryPermIds];
            });
        }
    };

    const filteredPermissions = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return AVAILABLE_PERMISSIONS.filter(p =>
            p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    const groupedPermissions = useMemo(() => {
        return filteredPermissions.reduce((acc, perm) => {
            if (!acc[perm.group]) acc[perm.group] = [];
            acc[perm.group].push(perm);
            return acc;
        }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);
    }, [filteredPermissions]);

    if (!currentUser?.is_tenant_admin) {
        return (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/10">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">Access Denied</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Only Tenant Administrators can manage Custom Roles and system permissions.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-bold font-['Outfit'] text-dark-950 dark:text-gray-50 tracking-tight">Roles & Permissions</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium italic">Define granular access control profiles for your organization.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    Create Custom Role
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-primary-100 dark:border-primary-900 border-t-primary-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {roles.map(role => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                key={role.id}
                                className="group bg-white dark:bg-gray-900 rounded-[32px] p-6 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/10 hover:shadow-2xl hover:shadow-primary-600/5 hover:-translate-y-1 transition-all duration-300 flex flex-col"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                                        <Shield className="w-6 h-6" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenModal(role)} title="Edit Role" className="p-2 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        {!['HR Admin', 'Manager', 'Employee'].includes(role.name) && (
                                            <button onClick={() => handleDeleteRole(role)} title="Delete Role" className="p-2 text-gray-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50 mb-1">{role.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex-1 line-clamp-2">{role.description || 'Custom access profile.'}</p>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md">
                                            Capabilities
                                        </span>
                                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-md">
                                            {role.permissions.length} total
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 min-h-[56px]">
                                        {role.permissions.slice(0, 4).map(p => (
                                            <span key={p} className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                                                {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                                            </span>
                                        ))}
                                        {role.permissions.length > 4 && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500">
                                                +{role.permissions.length - 4} more
                                            </span>
                                        )}
                                        {role.permissions.length === 0 && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500 italic py-2">No permissions assigned</span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Role Builder Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800"
                        >
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-200 dark:shadow-primary-900/30 cursor-default">
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">{editingRoleId ? 'Refine Role Profile' : 'Forge Custom Role'}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Configure exact system permissions and scope.</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-rose-500 hover:border-rose-100 dark:hover:border-rose-900/30 transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                                {/* Identity & Search */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Role Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={roleName}
                                                onChange={e => setRoleName(e.target.value)}
                                                className="input-field py-3 text-base"
                                                placeholder="e.g. Senior Auditor"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Scope Description</label>
                                            <textarea
                                                value={roleDescription}
                                                onChange={e => setRoleDescription(e.target.value)}
                                                className="input-field py-3 min-h-[80px]"
                                                placeholder="Clarify why this role exists and who it serves."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="input-field pl-12 py-3 bg-gray-50/50 dark:bg-gray-800/20 border-dashed focus:border-solid hover:bg-white dark:hover:bg-gray-900"
                                                placeholder="Search capabilities..."
                                            />
                                        </div>
                                        <div className="bg-primary-50 dark:bg-primary-900/10 rounded-2xl p-4 flex items-center justify-between border border-primary-100/50 dark:border-primary-800/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center font-bold text-xs">
                                                    {selectedPermissions.length}
                                                </div>
                                                <span className="text-xs font-bold text-primary-900 dark:text-primary-200">Capabilities Selected</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPermissions([])}
                                                className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline uppercase tracking-wider"
                                            >
                                                Resync All
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Permission Matrix */}
                                <div className="space-y-10">
                                    {Object.keys(groupedPermissions).length === 0 && (
                                        <div className="py-20 text-center space-y-4 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[32px]">
                                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto text-gray-400">
                                                <Search className="w-8 h-8" />
                                            </div>
                                            <p className="text-gray-500 dark:text-gray-400 font-medium italic">No matching capabilities found for "{searchQuery}"</p>
                                        </div>
                                    )}

                                    {Object.entries(groupedPermissions).map(([group, perms]) => {
                                        const allInGroup = perms.map(p => p.id).every(id => selectedPermissions.includes(id));
                                        return (
                                            <div key={group} className="space-y-4">
                                                <div className="flex items-center justify-between px-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1 h-4 bg-primary-600 rounded-full" />
                                                        <h5 className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{group}</h5>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCategory(group, perms)}
                                                        className={clsx(
                                                            "text-[10px] font-bold px-3 py-1 rounded-full border transition-all",
                                                            allInGroup
                                                                ? "border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100"
                                                                : "border-primary-100 bg-primary-50 text-primary-600 hover:bg-primary-100"
                                                        )}
                                                    >
                                                        {allInGroup ? 'Relinquish All' : 'Select Category'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                                                    {perms.map(perm => {
                                                        const isChecked = selectedPermissions.includes(perm.id);
                                                        const P_Icon = perm.icon || Shield;
                                                        return (
                                                            <label
                                                                key={perm.id}
                                                                className={clsx(
                                                                    "group flex items-center gap-4 p-4 rounded-3xl cursor-pointer transition-all duration-300 border shadow-sm",
                                                                    isChecked
                                                                        ? "bg-primary-600 text-white border-primary-500 shadow-primary-200 dark:shadow-primary-900/20 translate-x-1"
                                                                        : "bg-white dark:bg-gray-800/40 text-gray-500 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 border-gray-100 dark:border-gray-700"
                                                                )}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    className="hidden"
                                                                    onChange={() => togglePermission(perm.id)}
                                                                />
                                                                <div className={clsx(
                                                                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors shrink-0",
                                                                    isChecked ? "bg-white/20" : "bg-gray-50 dark:bg-gray-800"
                                                                )}>
                                                                    <P_Icon className={clsx("w-5 h-5", isChecked ? "text-white" : "text-gray-400 group-hover:text-primary-500")} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className={clsx("text-sm font-bold", isChecked ? "text-white" : "text-dark-950 dark:text-gray-100")}>{perm.label}</p>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <ChevronRight className={clsx("w-3 h-3 op-50", isChecked ? "text-white/50" : "text-gray-400")} />
                                                                        <span className={clsx("text-[10px] font-medium", isChecked ? "text-white/70" : "text-gray-400")}>{perm.group}</span>
                                                                    </div>
                                                                </div>
                                                                <div className={clsx(
                                                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                                                                    isChecked ? "bg-white border-white" : "border-gray-200 dark:border-gray-600"
                                                                )}>
                                                                    {isChecked && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-8 py-6 border-t border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-between">
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium italic hidden sm:block">
                                    Changes will manifest immediately for assigned users.
                                </p>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900 rounded-2xl transition-all border border-gray-200 dark:border-gray-700 active:scale-95"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveRole}
                                        disabled={!roleName || selectedPermissions.length === 0}
                                        className="flex-1 sm:flex-none px-8 py-3 text-sm font-extrabold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed rounded-2xl shadow-xl shadow-primary-200 dark:shadow-primary-900/30 transition-all active:scale-95"
                                    >
                                        {editingRoleId ? 'Solidify Status' : 'Initiate Profile'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RoleManagement;
