import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
    Calendar, Clock, FileText, ChevronRight,
    MapPin, Wallet, Briefcase, Palmtree, Receipt
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const ESSDashboard = () => {
    const { user } = useAuthStore();
    const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
    const [loadingLeave, setLoadingLeave] = useState(true);
    const [claims, setClaims] = useState<any[]>([]);
    const [loadingClaims, setLoadingClaims] = useState(true);

    useEffect(() => {
        const fetchLeave = async () => {
            try {
                const resp = await api.get('/api/v1/leave/me/balances');
                setLeaveBalances(resp.data);
            } catch (err) {
                console.error('Failed to fetch leave balances', err);
            } finally {
                setLoadingLeave(false);
            }
        };

        const fetchClaims = async () => {
            try {
                if (user?.selected_entity_id) {
                    const resp = await api.get('/api/v1/claims/my', {
                        params: { entity_id: user.selected_entity_id }
                    });
                    setClaims(resp.data);
                }
            } catch (err) {
                console.error('Failed to fetch claims', err);
            } finally {
                setLoadingClaims(false);
            }
        };

        fetchLeave();
        fetchClaims();
    }, [user?.selected_entity_id]);

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="bg-gradient-to-br from-primary-600 to-indigo-800 rounded-[32px] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl shadow-primary-900/20">
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black font-premium mb-2">
                            {greeting()}, {user?.display_name || 'Team Member'}! 👋
                        </h1>
                        <p className="text-primary-100 text-lg">
                            Welcome to your Self-Service Portal. Here's what's happening today.
                        </p>
                    </div>
                </div>

                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-400 opacity-20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Leave & Quick Actions */}
                <div className="lg:col-span-2 space-y-8">
                    {/* My Leave Balances */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                    <Palmtree className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-bold font-premium text-dark-950 dark:text-gray-50">My Leave Balances</h2>
                            </div>
                            <Link to="/leave/my" className="text-sm font-bold text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-4 py-2 rounded-xl transition-colors">
                                Apply Leave
                            </Link>
                        </div>

                        {loadingLeave ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[1, 2].map(i => (
                                    <div key={i} className="h-32 bg-gray-50 dark:bg-gray-800/50 rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : leaveBalances.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                <Palmtree className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">No leave balances available right now.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {leaveBalances.slice(0, 4).map((bal: any, idx: number) => (
                                    <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 border border-transparent dark:border-gray-800 hover:border-emerald-100 dark:hover:border-emerald-900/30 transition-colors">
                                        <p className="text-sm font-bold text-gray-500 mb-2">{bal.leave_type_name}</p>
                                        <div className="flex items-end justify-between">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-dark-950 dark:text-gray-50 font-premium">{bal.available_days}</span>
                                                <span className="text-sm text-gray-500 font-medium">days left</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* My Claims Overview */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl">
                                    <Receipt className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-bold font-premium text-dark-950 dark:text-gray-50">My Recent Claims</h2>
                            </div>
                            <Link to="/claims/my" className="text-sm font-bold text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-4 py-2 rounded-xl transition-colors">
                                Submit Claim
                            </Link>
                        </div>

                        {loadingClaims ? (
                            <div className="space-y-4">
                                {[1, 2].map(i => (
                                    <div key={i} className="h-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : claims.length === 0 ? (
                            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">No claims found.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {claims.slice(0, 3).map((claim: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/30 rounded-2xl group hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-primary-600 shadow-sm">
                                                <Briefcase className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-dark-950 dark:text-gray-50">{claim.title}</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{claim.category?.name || 'General'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-dark-950 dark:text-gray-50">S${claim.amount.toLocaleString()}</p>
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                claim.status === 'approved' ? 'text-emerald-500' :
                                                claim.status === 'rejected' ? 'text-rose-500' :
                                                'text-amber-500'
                                            }`}>{claim.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Upcoming Shifts */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                                <Clock className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-bold font-premium text-dark-950 dark:text-gray-50">Upcoming Schedule</h2>
                        </div>
                        
                        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">Your upcoming shifts will appear here.</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Recent Documents / Payslips */}
                <div className="space-y-8">
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50 top-8 sticky">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
                                <Wallet className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-bold font-premium text-dark-950 dark:text-gray-50">Recent Payslips</h2>
                        </div>

                        <div className="space-y-3">
                            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium text-sm">No recent payslips found.</p>
                            </div>
                            {/* In the future, map over payslips here */}
                        </div>

                        <Link
                            to="/me/payslips"
                            className="mt-6 font-bold text-sm text-center block w-full py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300 transition-colors"
                        >
                            View All Payslips
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ESSDashboard;
