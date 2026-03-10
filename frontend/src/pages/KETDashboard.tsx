import React, { useEffect, useState } from 'react';
import {
    FileText,
    Search,
    Filter,
    MoreHorizontal,
    Calendar,
    BadgeCheck,
    Clock,
    AlertCircle,
    ChevronRight,
    ArrowUpRight,
    Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface KETSummary {
    id: string;
    employment_id: string;
    employee_name: string;
    employee_code: string | null;
    job_title: string | null;
    status: 'pending' | 'draft' | 'issued' | 'signed' | 'revoked';
    version: number;
    updated_at: string;
}

const KETDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ total: 0, draft: 0, issued: 0, signed: 0, pending: 0 });
    const [items, setItems] = useState<KETSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const user = useAuthStore((state) => state.user);
    const entityId = user?.selected_entity_id;

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/api/v1/ket/dashboard?entity_id=${entityId || ''}`);
                setStats(response.data.stats);
                setItems(response.data.items);
            } catch (error) {
                console.error("Failed to fetch KET dashboard", error);
                toast.error("Could not load KET data");
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, [entityId]);

    const filteredItems = items.filter(item => {
        const matchesSearch = item.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' ? true : item.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'signed': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
            case 'issued': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
            case 'draft': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
            case 'pending': return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400';
            default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'signed': return <BadgeCheck className="w-3.5 h-3.5" />;
            case 'issued': return <ArrowUpRight className="w-3.5 h-3.5" />;
            case 'draft': return <FileText className="w-3.5 h-3.5" />;
            case 'pending': return <AlertCircle className="w-3.5 h-3.5" />;
            default: return <Clock className="w-3.5 h-3.5" />;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">KET Management</h1>
                    <p className="text-gray-500 dark:text-gray-400">Compliance tracking for Key Employment Terms (MOM Singapore).</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                    { label: 'Total Employees', value: stats.total, icon: FileText, color: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' },
                    { label: 'Pending KET', value: stats.pending, icon: AlertCircle, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
                    { label: 'Drafts', value: stats.draft, icon: Clock, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
                    { label: 'Issued', value: stats.issued, icon: ArrowUpRight, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
                    { label: 'Signed', value: stats.signed, icon: BadgeCheck, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className="bg-white dark:bg-gray-900 p-6 rounded-[28px] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                        <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center", stat.color)}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-2xl font-black text-dark-950 dark:text-gray-50">{stat.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Filter Hub */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search employee or code..."
                        className="w-full bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary-500/10 outline-none text-sm transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded-2xl w-full md:w-auto">
                    {['all', 'pending', 'draft', 'issued', 'signed'].map((st) => (
                        <button
                            key={st}
                            onClick={() => setFilterStatus(st)}
                            className={clsx(
                                "flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                                filterStatus === st
                                    ? "bg-white dark:bg-gray-900 text-primary-600 shadow-sm"
                                    : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
                            )}
                        >
                            {st}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Employee</th>
                                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Job Title</th>
                                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Version</th>
                                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Last Update</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            <AnimatePresence mode='popLayout'>
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={6} className="px-8 py-8 h-20">
                                                <div className="bg-gray-100 dark:bg-gray-800 h-10 w-full rounded-2xl"></div>
                                            </td>
                                        </tr>
                                    ))
                                ) : filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center text-gray-500 font-['Outfit']">
                                            No KET records match your criteria.
                                        </td>
                                    </tr>
                                ) : filteredItems.map((item, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={item.id}
                                        className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors group"
                                    >
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                                                    {item.employee_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-dark-950 dark:text-gray-100 group-hover:text-primary-600 transition-colors">{item.employee_name}</p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.employee_code || 'No Code'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{item.job_title || 'Unspecified'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={clsx(
                                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm",
                                                getStatusColor(item.status)
                                            )}>
                                                {getStatusIcon(item.status)}
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="text-xs font-bold text-gray-500 py-1 px-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                                    v{item.version}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                {new Date(item.updated_at).toLocaleDateString('en-SG', {
                                                    day: '2-digit', month: 'short', year: 'numeric'
                                                })}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            {item.status === 'pending' ? (
                                                <button
                                                    onClick={() => navigate(`/ket/${item.employment_id}`)}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-95"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Generate
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => navigate(`/ket/${item.id}`)}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-primary-500 hover:text-primary-600 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
                                                >
                                                    View Details
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default KETDashboard;
