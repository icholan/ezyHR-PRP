import React, { useEffect, useState } from 'react';
import api from '../../services/api';

interface Tenant {
    id: string;
    name: string;
    subscription_plan: string;
    mrr: number;
    billing_email: string;
    is_active: boolean;
}

const SubscriptionManagement: React.FC = () => {
    const [subscriptions, setSubscriptions] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSubscriptions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/platform/admin/subscriptions');
            setSubscriptions(res.data);
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const handlePlanChange = async (tenantId: string, newPlan: string) => {
        try {
            // Default MRR mapping based on plan for demonstration
            let newMrr = 0;
            if (newPlan === 'starter') newMrr = 99;
            if (newPlan === 'pro') newMrr = 299;
            if (newPlan === 'enterprise') newMrr = 999;

            await api.patch(`/platform/admin/subscriptions/${tenantId}`, {
                subscription_plan: newPlan,
                mrr: newMrr
            });
            await fetchSubscriptions();
        } catch (error) {
            console.error('Failed to update subscription:', error);
        }
    };

    if (loading) {
        return <div className="p-8">Loading Subscriptions...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white">Subscription Management</h1>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Manage tenant billing plans and Monthly Recurring Revenue.</p>

            <div className="bg-white dark:bg-gray-900 dark:bg-slate-800 shadow-sm dark:shadow-gray-950/20 border border-slate-200 dark:border-slate-700 sm:rounded-lg overflow-hidden mt-6">
                <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-white">Active Subscriptions</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 dark:divide-slate-700">
                        <thead className="bg-gray-50 dark:bg-gray-800 dark:bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tenant Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Current Plan</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">MRR ($)</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 uppercase tracking-wider">Update Plan</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700 dark:divide-slate-700">
                            {subscriptions.map(tenant => (
                                <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-slate-800">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-white">
                                        {tenant.name}
                                        <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{tenant.billing_email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenant.is_active ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                            {tenant.is_active ? 'Active' : 'Suspended'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-slate-400 capitalize">
                                        {tenant.subscription_plan}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-white">
                                        ${(tenant.mrr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <select
                                            value={tenant.subscription_plan}
                                            onChange={(e) => handlePlanChange(tenant.id, e.target.value)}
                                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                        >
                                            <option value="trial">Trial</option>
                                            <option value="starter">Starter ($99)</option>
                                            <option value="pro">Pro ($299)</option>
                                            <option value="enterprise">Enterprise ($999)</option>
                                        </select>
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

export default SubscriptionManagement;
