import React, { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Calendar,
    Users,
    ShieldCheck,
    DollarSign,
    Target,
    AlertCircle,
    Info,
    ChevronRight,
    Search,
    Filter
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface CPFRate {
    id: string;
    citizenship_type: string;
    age_from: number;
    age_to: number;
    employee_rate: number;
    employer_rate: number;
    ow_ceiling: number;
    aw_ceiling_annual: number;
    effective_date: string;
    end_date: string | null;
    is_expired: boolean;
}

const CPFRates: React.FC = () => {
    const [rates, setRates] = useState<CPFRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCitizenship, setFilterCitizenship] = useState('ALL');
    const [filterAgeGroup, setFilterAgeGroup] = useState('ALL');
    const [showExpired, setShowExpired] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        citizenship_type: 'SC',
        age_from: 0,
        age_to: 35,
        employee_rate: 0.20,
        employer_rate: 0.17,
        ow_ceiling: 6800,
        aw_ceiling_annual: 102000,
        effective_date: new Date().toISOString().split('T')[0],
        end_date: ''
    });

    const fetchRates = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/platform/statutory/cpf?include_expired=${showExpired}`);
            setRates(response.data);
        } catch (error) {
            toast.error("Failed to fetch CPF rates");
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
            await api.post('/platform/statutory/cpf', {
                ...formData,
                end_date: formData.end_date || null
            });
            toast.success("CPF rate configuration added");
            setIsModalOpen(false);
            fetchRates();
        } catch (error) {
            toast.error("Failed to add configuration");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to expire this configuration? It will no longer be used for calculations.")) return;
        try {
            await api.delete(`/platform/statutory/cpf/${id}`);
            toast.success("Configuration marked as expired");
            fetchRates();
        } catch (error) {
            toast.error("Failed to expire configuration");
        }
    };

    const filteredRates = rates.filter(r => {
        const matchesSearch = r.citizenship_type.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCitizenship = filterCitizenship === 'ALL' || r.citizenship_type === filterCitizenship;

        let matchesAge = true;
        if (filterAgeGroup === 'UNDER_55') matchesAge = r.age_to <= 55;
        else if (filterAgeGroup === 'OVER_55') matchesAge = r.age_from >= 55;

        return matchesSearch && matchesCitizenship && matchesAge;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-dark-950 dark:text-white font-['Outfit'] tracking-tight">CPF Rate Configuration</h1>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Manage statutory CPF contribution rates and wage ceilings.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-primary px-6 py-3 flex items-center gap-2 shadow-xl shadow-primary-500/20"
                >
                    <Plus className="w-5 h-5" />
                    <span>Add Rate Configuration</span>
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Target className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Active Brackets</span>
                    </div>
                    <div className="text-3xl font-black text-dark-950 dark:text-white mb-1">{rates.length}</div>
                    <div className="text-sm font-medium text-gray-500">Total statutory CPF rules</div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">OW Ceiling</span>
                    </div>
                    <div className="text-3xl font-black text-dark-950 dark:text-white mb-1">$8,000.00</div>
                    <div className="text-sm font-medium text-gray-500">Statutory Monthly Ceiling</div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                            <Info className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Compliance</span>
                    </div>
                    <div className="text-3xl font-black text-dark-950 dark:text-white mb-1">MOM 2026</div>
                    <div className="text-sm font-medium text-gray-500">Based on latest EA rules</div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by citizenship type..."
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
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Show Expired</span>
                        </label>
                        <select
                            value={filterCitizenship}
                            onChange={e => setFilterCitizenship(e.target.value)}
                            className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="ALL">All Types</option>
                            <option value="SC">Singapore Citizen</option>
                            <option value="SPR_Y1">SPR (Year 1)</option>
                            <option value="SPR_Y2">SPR (Year 2)</option>
                            <option value="SPR_Y3">SPR (Year 3+)</option>
                        </select>
                        <select
                            value={filterAgeGroup}
                            onChange={e => setFilterAgeGroup(e.target.value)}
                            className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="ALL">All Ages</option>
                            <option value="UNDER_55">55 & Below</option>
                            <option value="OVER_55">Above 55</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-50 dark:border-gray-800">
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Citizenship & Age</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Employee Rate</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Employer Rate</th>
                                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ceilings (OW/AW)</th>
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
                                            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center text-primary-600 font-bold">
                                                {rate.citizenship_type}
                                            </div>
                                            <div>
                                                <div className="font-bold text-dark-950 dark:text-white capitalize">{rate.citizenship_type}</div>
                                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-tighter">Age {rate.age_from} - {rate.age_to}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-dark-950 dark:text-white">{(rate.employee_rate * 100).toFixed(1)}%</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider italic">Contribution</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-dark-950 dark:text-white">{(rate.employer_rate * 100).toFixed(1)}%</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider italic">Contribution</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full uppercase">OW</span>
                                                <span className="text-sm font-bold text-dark-950 dark:text-white">${rate.ow_ceiling.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full uppercase">AW</span>
                                                <span className="text-sm font-bold text-dark-950 dark:text-white">${rate.aw_ceiling_annual.toLocaleString()}</span>
                                            </div>
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
                    {filteredRates.length === 0 && !loading && (
                        <div className="p-20 text-center">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                                <Search className="w-10 h-10 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-dark-950 dark:text-white mb-2">No configurations found</h3>
                            <p className="text-gray-500">Try adjusting your search or add a new rate bracket.</p>
                        </div>
                    )}
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
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl overflow-hidden border border-white/20 dark:border-gray-800"
                        >
                            <form onSubmit={handleCreate}>
                                <div className="p-8 pb-4">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h2 className="text-2xl font-bold text-dark-950 dark:text-white font-['Outfit']">Add Rate Configuration</h2>
                                            <p className="text-sm text-gray-500">Define a new statutory CPF contribution bracket.</p>
                                        </div>
                                        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/10 rounded-2xl flex items-center justify-center text-primary-600">
                                            <Plus className="w-6 h-6" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Citizenship Type</label>
                                                <select
                                                    value={formData.citizenship_type}
                                                    onChange={e => setFormData({ ...formData, citizenship_type: e.target.value })}
                                                    className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none h-[60px]"
                                                >
                                                    <option value="SC">Singapore Citizen</option>
                                                    <option value="SPR_Y1">SPR (Year 1)</option>
                                                    <option value="SPR_Y2">SPR (Year 2)</option>
                                                    <option value="SPR_Y3">SPR (Year 3+)</option>
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Age From</label>
                                                    <input
                                                        type="number"
                                                        value={formData.age_from}
                                                        onChange={e => setFormData({ ...formData, age_from: parseInt(e.target.value) })}
                                                        className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Age To</label>
                                                    <input
                                                        type="number"
                                                        value={formData.age_to}
                                                        onChange={e => setFormData({ ...formData, age_to: parseInt(e.target.value) })}
                                                        className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">EE Rate (e.g. 0.20)</label>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={formData.employee_rate}
                                                        onChange={e => setFormData({ ...formData, employee_rate: parseFloat(e.target.value) })}
                                                        className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">ER Rate (e.g. 0.17)</label>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={formData.employer_rate}
                                                        onChange={e => setFormData({ ...formData, employer_rate: parseFloat(e.target.value) })}
                                                        className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Effective From</label>
                                                <input
                                                    type="date"
                                                    value={formData.effective_date}
                                                    onChange={e => setFormData({ ...formData, effective_date: e.target.value })}
                                                    className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none h-[60px]"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">OW Ceiling</label>
                                                    <input
                                                        type="number"
                                                        value={formData.ow_ceiling}
                                                        onChange={e => setFormData({ ...formData, ow_ceiling: parseInt(e.target.value) })}
                                                        className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">AW Ceiling (Annual)</label>
                                                    <input
                                                        type="number"
                                                        value={formData.aw_ceiling_annual}
                                                        onChange={e => setFormData({ ...formData, aw_ceiling_annual: parseInt(e.target.value) })}
                                                        className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end gap-4 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-3 font-bold text-gray-500 hover:text-dark-950 dark:hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary px-10 py-3 shadow-xl shadow-primary-500/20"
                                    >
                                        Save Configuration
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

export default CPFRates;
