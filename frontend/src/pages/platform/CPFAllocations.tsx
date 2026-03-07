import React, { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Calendar,
    Target,
    ShieldCheck,
    Search,
    PieChart,
    ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface CPFAllocation {
    id: string;
    age_from: number;
    age_to: number;
    oa_ratio: number;
    sa_ratio: number;
    ma_ratio: number;
    effective_date: string;
    end_date: string | null;
    is_expired: boolean;
}

const CPFAllocations: React.FC = () => {
    const [allocations, setAllocations] = useState<CPFAllocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showExpired, setShowExpired] = useState(false);

    const [formData, setFormData] = useState({
        age_from: 0,
        age_to: 35,
        oa_ratio: 0.6217,
        sa_ratio: 0.1621,
        ma_ratio: 0.2162,
        effective_date: new Date().toISOString().split('T')[0]
    });

    const fetchAllocations = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/platform/statutory/cpf-allocations?include_expired=${showExpired}`);
            setAllocations(response.data);
        } catch (error) {
            toast.error("Failed to fetch CPF allocations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllocations();
    }, [showExpired]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/platform/statutory/cpf-allocations', formData);
            toast.success("Allocation configuration added");
            setIsModalOpen(false);
            fetchAllocations();
        } catch (error) {
            toast.error("Failed to add configuration");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to expire this allocation rule?")) return;
        try {
            await api.delete(`/platform/statutory/cpf-allocations/${id}`);
            toast.success("Rule marked as expired");
            fetchAllocations();
        } catch (error) {
            toast.error("Failed to expire rule");
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <PieChart className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-dark-950 dark:text-white font-['Outfit'] tracking-tight">CPF Allocation Ratios</h1>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Define age-based splits for OA, SA/RA, and MediSave accounts.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-primary px-6 py-3 flex items-center gap-2 shadow-xl shadow-indigo-500/20"
                >
                    <Plus className="w-5 h-5" />
                    <span>Add Allocation Rule</span>
                </button>
            </header>

            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                    <h3 className="font-bold text-dark-950 dark:text-white">Statutory Allocation Rules</h3>
                    <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showExpired}
                            onChange={e => setShowExpired(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Show Expired</span>
                    </label>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-50 dark:border-gray-800">
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Age Group</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ordinary (OA)</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Special/Ret (SA)</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">MediSave (MA)</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Effective</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {allocations.map((alloc) => (
                                <tr key={alloc.id} className={clsx(
                                    "hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group",
                                    alloc.is_expired && "opacity-60 grayscale-[0.5]"
                                )}>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                {alloc.age_from}
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-gray-300" />
                                            <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                {alloc.age_to}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="font-bold text-dark-950 dark:text-white">{(alloc.oa_ratio * 100).toFixed(2)}%</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="font-bold text-dark-950 dark:text-white">{(alloc.sa_ratio * 100).toFixed(2)}%</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="font-bold text-dark-950 dark:text-white">{(alloc.ma_ratio * 100).toFixed(2)}%</span>
                                    </td>
                                    <td className="px-8 py-6 text-sm font-bold text-gray-500">
                                        {new Date(alloc.effective_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {!alloc.is_expired && (
                                            <button
                                                onClick={() => handleDelete(alloc.id)}
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

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-dark-950/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl p-8 border border-white/20 dark:border-gray-800"
                        >
                            <h2 className="text-2xl font-bold text-dark-950 dark:text-white mb-6">Add Allocation Rule</h2>
                            <form onSubmit={handleCreate} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Age From</label>
                                        <input
                                            type="number"
                                            value={formData.age_from}
                                            onChange={e => setFormData({ ...formData, age_from: parseInt(e.target.value) })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Age To</label>
                                        <input
                                            type="number"
                                            value={formData.age_to}
                                            onChange={e => setFormData({ ...formData, age_to: parseInt(e.target.value) })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">OA Ratio (e.g. 0.6217)</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={formData.oa_ratio}
                                            onChange={e => setFormData({ ...formData, oa_ratio: parseFloat(e.target.value) })}
                                            className="w-full p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-600 border-none font-bold outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">SA/RA Ratio</label>
                                            <input
                                                type="number"
                                                step="0.0001"
                                                value={formData.sa_ratio}
                                                onChange={e => setFormData({ ...formData, sa_ratio: parseFloat(e.target.value) })}
                                                className="w-full p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 border-none font-bold outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">MA Ratio</label>
                                            <input
                                                type="number"
                                                step="0.0001"
                                                value={formData.ma_ratio}
                                                onChange={e => setFormData({ ...formData, ma_ratio: parseFloat(e.target.value) })}
                                                className="w-full p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-900/10 text-rose-600 border-none font-bold outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-3 font-bold text-gray-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary px-8 py-3"
                                    >
                                        Save Rule
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CPFAllocations;
