import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import {
    BuildingOfficeIcon,
    CurrencyDollarIcon,
    CheckBadgeIcon,
    UserPlusIcon
} from '@heroicons/react/24/outline';

interface TenantStats {
    total_tenants: number;
    active_tenants: number;
    total_mrr: number;
    new_this_month: number;
}

interface Tenant {
    id: string;
    name: string;
    subscription_plan: string;
    is_active: string;
    mrr: number;
    created_at: string;
}

const PlatformDashboard: React.FC = () => {
    const [stats, setStats] = useState<TenantStats | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [statsRes, tenantsRes] = await Promise.all([
                    api.get('/platform/admin/stats'),
                    api.get('/platform/admin/tenants')
                ]);
                setStats(statsRes.data);
                setTenants(tenantsRes.data);
            } catch (error) {
                console.error("Failed to fetch platform configuration", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading || !stats) {
        return <div className="p-8">Loading Platform Insights...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Platform Dashboard</h1>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white dark:bg-gray-900 dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-gray-950/20 border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg">
                            <BuildingOfficeIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 dark:text-blue-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Total Tenants</dt>
                                <dd className="text-2xl font-semibold text-slate-900 dark:text-white">{stats.total_tenants}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-gray-950/20 border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/20 dark:bg-green-900/50 p-3 rounded-lg">
                            <CheckBadgeIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Active Tenants</dt>
                                <dd className="text-2xl font-semibold text-slate-900 dark:text-white">{stats.active_tenants}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-gray-950/20 border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-purple-100 dark:bg-purple-900/50 p-3 rounded-lg">
                            <CurrencyDollarIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">Total MRR</dt>
                                <dd className="text-2xl font-semibold text-slate-900 dark:text-white">${stats.total_mrr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 dark:bg-slate-800 rounded-xl shadow-sm dark:shadow-gray-950/20 border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-orange-100 dark:bg-orange-900/50 p-3 rounded-lg">
                            <UserPlusIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">New This Month</dt>
                                <dd className="text-2xl font-semibold text-slate-900 dark:text-white">{stats.new_this_month}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 dark:bg-slate-800 shadow-sm dark:shadow-gray-950/20 border border-slate-200 dark:border-slate-700 sm:rounded-lg overflow-hidden mt-6">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-white">Recent Tenant Registrations</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 dark:divide-slate-700">
                        <thead className="bg-gray-50 dark:bg-gray-800 dark:bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tenant Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Plan</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">MRR</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Joined Date</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700 dark:divide-slate-700">
                            {tenants.map(tenant => (
                                <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-slate-800">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-white">
                                        {tenant.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 capitalize">
                                        {tenant.subscription_plan}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400">
                                        ${(tenant.mrr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenant.is_active ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                            {tenant.is_active ? 'Active' : 'Suspended'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400">
                                        {new Date(tenant.created_at).toLocaleDateString()}
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

export default PlatformDashboard;
