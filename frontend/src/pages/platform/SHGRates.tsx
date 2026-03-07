import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Trash2, Calendar,
    Search, Filter, ShieldCheck,
    DollarSign, Info, Target, X, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface SHGRate {
    id: string;
    shg_type: string;
    wage_from: number;
    wage_to: number | null;
    deduction_amount: number;
    effective_date: string;
    end_date: string | null;
    is_expired: boolean;
}

const SHGRates: React.FC = () => {
    const [rates, setRates] = useState<SHGRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [showExpired, setShowExpired] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        shg_type: 'CDAC',
        wage_from: 0,
        wage_to: '' as string | number,
        deduction_amount: 0,
        effective_date: new Date().toISOString().split('T')[0],
        end_date: ''
    });

    const fetchRates = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/platform/statutory/shg?include_expired=${showExpired}`);
            setRates(response.data);
        } catch (error) {
            toast.error("Failed to fetch SHG rates");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates();
    }, [showExpired]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/platform/statutory/shg', {
                ...formData,
                wage_to: formData.wage_to === '' ? null : Number(formData.wage_to),
                end_date: formData.end_date || null
            });
            toast.success("SHG rate configuration added");
            setIsModalOpen(false);
            fetchRates();
        } catch (error) {
            toast.error("Failed to add configuration");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to expire this configuration? It will no longer be used for calculations.")) return;
        try {
            await api.delete(`/platform/statutory/shg/${id}`);
            toast.success("Configuration marked as expired");
            fetchRates();
        } catch (error) {
            toast.error("Failed to expire configuration");
        }
    };

    const filteredRates = rates.filter(r => {
        const matchesSearch = r.shg_type.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'ALL' || r.shg_type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <Users className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-dark-950 dark:text-white font-['Outfit'] tracking-tight">Self-Help Group (SHG) Rates</h1>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Manage statutory deductions for CDAC, MBMF, SINDA, and ECF.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-primary px-6 py-3 flex items-center gap-2 shadow-xl shadow-primary-500/20 bg-indigo-600 hover:bg-indigo-700"
                >
                    <Plus className="w-5 h-5" />
                    <span>Add SHG Configuration</span>
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600">
                            <Target className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Active Funds</span>
                    </div>
                    <div className="text-3xl font-black text-dark-950 dark:text-white mb-1">4 Funds</div>
                    <div className="text-sm font-medium text-gray-500">CDAC, MBMF, SINDA, ECF</div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Max Deduction</span>
                    </div>
                    <div className="text-3xl font-black text-dark-950 dark:text-white mb-1">$30.00</div>
                    <div className="text-sm font-medium text-gray-500">Highest monthly SHG rate</div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600">
                            <Info className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Compliance</span>
                    </div>
                    <div className="text-3xl font-black text-dark-950 dark:text-white mb-1">Statutory</div>
                    <div className="text-sm font-medium text-gray-500">Based on standard funds</div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by fund type..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border-none ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary-500 outline-none font-medium text-sm transition-all"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showExpired}
                                onChange={e => setShowExpired(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Show Expired</span>
                        </label>
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="ALL">All Funds</option>
                            <option value="CDAC">CDAC</option>
                            <option value="MBMF">MBMF</option>
                            <option value="SINDA">SINDA</option>
                            <option value="ECF">ECF</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-50 dark:border-gray-800">
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Fund Type</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Wage Range</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Deduction Amount</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Effective Date</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {filteredRates.map((rate) => (
                                <tr key={rate.id} className={clsx(
                                    "hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group",
                                    rate.is_expired && "opacity-60 grayscale-[0.5]"
                                )}>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                                                {rate.shg_type.charAt(0)}
                                            </div>
                                            <div className="font-bold text-dark-950 dark:text-white uppercase tracking-tight">{rate.shg_type}</div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <div className="font-bold text-dark-950 dark:text-white">
                                                ${rate.wage_from.toLocaleString()} - {rate.wage_to ? `$${rate.wage_to.toLocaleString()}` : 'Above'}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider italic">Gross Monthly Salary</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-dark-950 dark:text-white italic text-indigo-600">${rate.deduction_amount.toFixed(2)}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider italic">Contribution</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-sm font-bold text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(rate.effective_date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {rate.is_expired ? (
                                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full uppercase tracking-wider">Expired</span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full uppercase tracking-wider">Active</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {!rate.is_expired && (
                                            <button
                                                onClick={() => handleDelete(rate.id)}
                                                className="p-3 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/40 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800"
                        >
                            <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-dark-950 dark:text-white">Add SHG Configuration</h3>
                                        <p className="text-xs text-gray-500 font-medium tracking-tight">Set deduction rules for self-help groups.</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Fund Type</label>
                                        <select
                                            value={formData.shg_type}
                                            onChange={e => setFormData({ ...formData, shg_type: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="CDAC">CDAC (Chinese)</option>
                                            <option value="MBMF">MBMF (Muslim)</option>
                                            <option value="SINDA">SINDA (Indian)</option>
                                            <option value="ECF">ECF (Eurasian)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Effective Date</label>
                                        <input
                                            type="date"
                                            value={formData.effective_date}
                                            onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Wage From ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.wage_from}
                                            onChange={e => setFormData({ ...formData, wage_from: Number(e.target.value) })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Wage To ($) - Optional</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.wage_to}
                                            onChange={e => setFormData({ ...formData, wage_to: e.target.value === '' ? '' : Number(e.target.value) })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Leave blank for no upper limit"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Deduction Amount ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.deduction_amount}
                                        onChange={e => setFormData({ ...formData, deduction_amount: Number(e.target.value) })}
                                        className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-8 py-3 text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save Configuration
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SHGRates;
