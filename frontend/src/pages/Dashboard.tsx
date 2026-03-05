import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Wallet, CalendarClock, ShieldAlert, TrendingUp, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const stats = [
    { label: 'Total Employees', value: '1,284', change: '+12', trend: 'up', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Active Payroll', value: '$452,000', change: '+2.4%', trend: 'up', icon: Wallet, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Leave Requests', value: '24', change: '-5', trend: 'down', icon: CalendarClock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'AI Audit Flags', value: '3', change: 'Critical', trend: 'neutral', icon: ShieldAlert, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20' },
];

const Dashboard = () => {
    const user = useAuthStore((state) => state.user);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.selected_entity_id) {
            setLoading(true);
            const timer = setTimeout(() => setLoading(false), 500);
            return () => clearTimeout(timer);
        }
    }, [user?.selected_entity_id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-dark-950 dark:text-gray-50 mb-2 font-['Outfit']">Dashboard Overview</h1>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                        Welcome back, {user?.display_name?.split(' ')[0] || 'User'}. Here's a snapshot of your workforce health.
                    </p>
                </div>
                <button className="btn btn-primary px-6 py-3 flex items-center justify-center gap-2 w-full sm:w-auto">
                    <TrendingUp className="w-4 h-4" />
                    Generate Report
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow group"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`${stat.bg} ${stat.color} w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full ${stat.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' :
                                stat.trend === 'down' ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20' :
                                    'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                }`}>
                                {stat.trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
                                {stat.trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
                                {stat.change}
                            </div>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium">{stat.label}</p>
                        <h3 className="text-xl sm:text-2xl font-bold text-dark-900 dark:text-gray-100 mt-1">{stat.value}</h3>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-[24px] sm:rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <h2 className="text-lg sm:text-xl font-bold text-dark-900 dark:text-gray-100">Payroll Trends</h2>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-1 rounded-xl w-fit">
                            <button className="px-3 py-1.5 text-[10px] sm:text-xs font-bold bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm rounded-lg">All Entities</button>
                            <button className="px-3 py-1.5 text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400">By Dept</button>
                        </div>
                    </div>
                    <div className="h-[250px] sm:h-[300px] flex items-end justify-between gap-2 sm:gap-4 px-2 sm:px-4">
                        {[45, 60, 55, 75, 85, 70].map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                                <div
                                    className="w-full bg-primary-100 dark:bg-primary-900/30 rounded-lg sm:rounded-xl relative group-hover:bg-primary-500 transition-all duration-500"
                                    style={{ height: `${val}%` }}
                                >
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-dark-900 dark:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        ${val * 10}k
                                    </div>
                                </div>
                                <span className="text-[8px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">M{i + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-dark-950 dark:bg-gray-900 rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 text-white relative overflow-hidden border border-transparent dark:border-gray-800">
                    <h2 className="text-lg sm:text-xl font-bold mb-6">Recent AI Audit Flags</h2>
                    <div className="space-y-4 relative z-10">
                        {[
                            { type: 'Salary Spike', msg: '25% increase for User #1024', severity: 'high' },
                            { type: 'Missing CPF', msg: 'Admin User missing deduction', severity: 'medium' },
                            { type: 'Ghost Check', msg: 'Shared bank account detected', severity: 'critical' },
                        ].map((flag, i) => (
                            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer group">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${flag.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                                        }`}>{flag.type}</span>
                                    <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-white transition-colors" />
                                </div>
                                <p className="text-sm font-medium text-white/80">{flag.msg}</p>
                            </div>
                        ))}
                    </div>
                    <button className="w-full mt-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-bold text-sm transition-all italic">
                        View All Audit Reports
                    </button>
                    <div className="absolute bottom-[-20%] right-[-20%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl" />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
