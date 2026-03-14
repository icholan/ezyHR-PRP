import React, { useEffect, useState } from 'react';
import {
    Wallet,
    Plus,
    Calendar,
    ChevronRight,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    History,
    FileText,
    ShieldCheck,
    AlertCircle,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { clsx } from 'clsx';
import { hasPermission } from '../utils/permissions';
import { Permission } from '../types/permissions';


const Payroll = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalPayout: 0,
        totalCpf: 0,
        pendingAudits: 0,
        activeRuns: 0
    });

    const entityId = user?.selected_entity_id;

    useEffect(() => {
        const fetchPayrollData = async () => {
            if (!entityId) return;
            try {
                setLoading(true);
                setRuns([]); // Clear stale data
                // In a real app, we'd have a specific list endpoint
                // For now, we fetch current runs
                const response = await api.get(`/api/v1/payroll/runs?entity_id=${entityId}`);
                setRuns(response.data);

                // Calculate some dummy summary stats based on fetched data
                const total = response.data.reduce((acc: number, run: any) => acc + Number(run.total_net), 0);
                const flags = response.data.reduce((acc: number, run: any) => acc + (run.ai_flags_count || 0), 0);

                setSummary({
                    totalPayout: total,
                    totalCpf: total * 0.17, // Placeholder ratio
                    pendingAudits: flags,
                    activeRuns: response.data.filter((r: any) => r.status === 'draft' || r.status === 'processing').length
                });
            } catch (error) {
                console.error("Failed to fetch payroll data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPayrollData();
    }, [entityId]);

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'approved': return 'bg-emerald-100 text-emerald-700 dark:text-emerald-400';
            case 'draft': return 'bg-gray-100 text-gray-700 dark:text-gray-300';
            case 'processing': return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700';
            case 'audited': return 'bg-amber-100 text-amber-700 dark:text-amber-400';
            default: return 'bg-gray-100 text-gray-700 dark:text-gray-300';
        }
    };

    return (
        <div className="space-y-8 pb-12">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">Payroll Management</h1>
                    <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Process monthly salaries and review compliance audits.</p>
                </div>
                {hasPermission(user, Permission.RUN_PAYROLL, entityId) && (
                    <button
                        onClick={() => navigate('/payroll/new')}
                        className="btn btn-primary flex items-center gap-2 py-3 px-6 shadow-lg shadow-primary-200"
                    >
                        <Plus className="w-5 h-5" />
                        Initialize New Run
                    </button>
                )}
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Payout', value: `$${summary.totalPayout.toLocaleString()}`, sub: '+2.4% vs last month', icon: Wallet, color: 'bg-primary-50 text-primary-600', trend: 'up' },
                    { label: 'CPF Liabilities', value: `$${summary.totalCpf.toLocaleString()}`, sub: 'Due by 15th Mar', icon: FileText, color: 'bg-indigo-50 text-indigo-600', trend: 'none' },
                    { label: 'AI Audit Flags', value: summary.pendingAudits, sub: 'Requires review', icon: ShieldCheck, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400', trend: 'down' },
                    { label: 'Active Runs', value: summary.activeRuns, sub: 'In progress', icon: Clock, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', trend: 'none' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20 transition-all hover:shadow-md group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", stat.color)}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            {stat.trend === 'up' && <ArrowUpRight className="w-5 h-5 text-emerald-500" />}
                            {stat.trend === 'down' && <ArrowDownRight className="w-5 h-5 text-rose-500" />}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-1">{stat.label}</p>
                            <p className="text-2xl font-bold text-dark-950 dark:text-gray-50 mb-1">{stat.value}</p>
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{stat.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Historical Runs */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">Payroll Runs</h2>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search period..."
                                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary-500/20 outline-none"
                            />
                        </div>
                        <button className="p-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
                            <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-gray-950/50 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="px-8 py-5 text-sm font-semibold text-gray-600 dark:text-gray-300">Period</th>
                                <th className="px-6 py-5 text-sm font-semibold text-gray-600 dark:text-gray-300">Status</th>
                                <th className="px-6 py-5 text-sm font-semibold text-gray-600 dark:text-gray-300">Employees</th>
                                <th className="px-6 py-5 text-sm font-semibold text-gray-600 dark:text-gray-300">Total Net</th>
                                <th className="px-6 py-5 text-sm font-semibold text-gray-600 dark:text-gray-300">AI Audit</th>
                                <th className="px-8 py-5 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-6 h-16 bg-gray-50 dark:bg-gray-800/30"></td>
                                    </tr>
                                ))
                            ) : runs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                                <History className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">No payroll runs found for this year.</p>
                                            <button onClick={() => navigate('/payroll/new')} className="text-primary-600 font-bold hover:underline">
                                                Create your first run
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : runs.map((run) => (
                                <tr key={run.id} className="hover:bg-primary-50/30 transition-all group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                                                <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                            </div>
                                            <span className="font-bold text-dark-950 dark:text-gray-50">
                                                {new Date(run.period).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className={clsx(
                                            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                                            getStatusColor(run.status)
                                        )}>
                                            {run.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 font-medium text-gray-600 dark:text-gray-300">
                                        {run.total_employees || '—'}
                                    </td>
                                    <td className="px-6 py-5 font-bold text-dark-950 dark:text-gray-50">
                                        ${Number(run.total_net).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-5">
                                        {run.ai_audit_run ? (
                                            <div className="flex items-center gap-2">
                                                <div className={clsx(
                                                    "w-2 h-2 rounded-full",
                                                    run.ai_flags_count > 0 ? "bg-rose-50 dark:bg-rose-900/200" : "bg-emerald-50 dark:bg-emerald-900/200"
                                                )} />
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500">
                                                    {run.ai_flags_count > 0 ? `${run.ai_flags_count} Flags` : 'Clean Audit'}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 italic">Not Audited</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button
                                            onClick={() => navigate(`/payroll/${run.id}`)}
                                            className="p-2 hover:bg-white dark:bg-gray-900 rounded-xl border border-transparent hover:border-gray-100 dark:border-gray-800 transition-all text-gray-400 dark:text-gray-500 hover:text-primary-600"
                                        >
                                            <ChevronRight className="w-6 h-6" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* AI Insight Card */}
            <div className="bg-dark-950 rounded-[32px] p-8 text-white relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-primary-400 font-bold tracking-wider text-xs uppercase">AI Compliance Assistant</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-3">Optimize your statutory contributions</h3>
                        <p className="text-dark-300 leading-relaxed">
                            Our AI engine automatically calculates CPF ceilings, SDL, and SHG for every employee based on their latest identity and residency status. It also flags anomalies like sudden salary spikes or inconsistent OT claims.
                        </p>
                    </div>
                    <div className="flex flex-col items-center gap-4 bg-dark-900/50 p-6 rounded-3xl border border-dark-800 backdrop-blur-sm">
                        <div className="text-center">
                            <p className="text-xs text-dark-400 uppercase tracking-widest mb-1">Audit Accuracy</p>
                            <p className="text-4xl font-bold">99.9%</p>
                        </div>
                        <div className="h-[1px] w-full bg-dark-800" />
                        <div className="flex gap-4">
                            <div className="text-center">
                                <p className="text-xs text-dark-400 mb-1">MOM Risks</p>
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-dark-400 mb-1">IRAS Compliance</p>
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary-600/20 to-transparent pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
            </div>
        </div>
    );
};

export default Payroll;
