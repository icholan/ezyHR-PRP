import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { PlayCircleIcon, PauseCircleIcon } from '@heroicons/react/24/outline';

interface Tenant {
    id: string;
    name: string;
    subscription_plan: string;
    billing_email: string;
    is_active: boolean;
    suspended_at?: string | null;
    suspended_reason?: string | null;
    created_at: string;
}

const TenantManagement: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTenants = async () => {
        try {
            setLoading(true);
            const res = await api.get('/platform/admin/tenants');
            setTenants(res.data);
        } catch (error) {
            console.error('Failed to fetch tenants:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const toggleTenantStatus = async (tenantId: string, isActive: boolean) => {
        try {
            if (isActive) {
                // Suspend
                const reason = window.prompt("Enter reason for suspension:");
                if (reason === null) return;
                await api.patch(`/platform/admin/tenants/${tenantId}/suspend`, null, { params: { reason } });
            } else {
                // Activate
                await api.patch(`/platform/admin/tenants/${tenantId}`, { is_active: true });
            }
            await fetchTenants();
        } catch (error) {
            console.error('Failed to toggle status:', error);
        }
    };

    if (loading) {
        return <div className="p-8">Loading Tenants...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Tenant Management</h1>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">View and manage all registered SaaS tenants.</p>

            <div className="bg-white dark:bg-gray-900 dark:bg-slate-800 shadow-sm dark:shadow-gray-950/20 border border-slate-200 dark:border-slate-700 sm:rounded-lg overflow-hidden mt-6">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-white">All Tenants</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 dark:divide-slate-700">
                        <thead className="bg-gray-50 dark:bg-gray-800 dark:bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tenant Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Billing Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">System Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Created</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700 dark:divide-slate-700">
                            {tenants.map(tenant => (
                                <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-slate-800">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-white">
                                        {tenant.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400">
                                        {tenant.billing_email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenant.is_active ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                            {tenant.is_active ? 'Active' : 'Suspended'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400">
                                        {new Date(tenant.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => toggleTenantStatus(tenant.id, tenant.is_active)}
                                            className={`inline-flex items-center gap-1 ${tenant.is_active ? 'text-red-600 dark:text-red-400 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                                        >
                                            {tenant.is_active ? (
                                                <><PauseCircleIcon className="w-5 h-5" /> Suspend</>
                                            ) : (
                                                <><PlayCircleIcon className="w-5 h-5" /> Activate</>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TenantManagement;
