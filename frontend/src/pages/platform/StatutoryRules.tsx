import React, { useState, useEffect } from 'react';
import {
    Gavel, Plus, Trash2, Calendar,
    Clock, Save, X, ChevronRight,
    ArrowRight, Info, AlertCircle,
    CheckCircle2, Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface RuleStep {
    min_tenure: number;
    days: number;
}

interface StatutoryRule {
    id: string;
    leave_type_code: string;
    effective_from: string;
    effective_to: string | null;
    tenure_unit: 'months' | 'years';
    progression: RuleStep[];
    notes: string | null;
}

const StatutoryRules: React.FC = () => {
    const [rules, setRules] = useState<StatutoryRule[]>([]);
    const [availableTypes, setAvailableTypes] = useState<{ code: string, name: string, is_statutory: boolean }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [editingRule, setEditingRule] = useState<StatutoryRule | null>(null);
    const [formData, setFormData] = useState({
        leave_type_code: 'ANNUAL',
        effective_from: new Date().toISOString().split('T')[0],
        tenure_unit: 'years' as 'months' | 'years',
        progression: [] as RuleStep[],
        notes: ''
    });

    const fetchRules = async () => {
        setLoading(true);
        try {
            const [rulesRes, typesRes] = await Promise.all([
                api.get('/api/v1/leave/rules/statutory'),
                api.get('/api/v1/leave/seed-standard/available')
            ]);
            setRules(rulesRes.data);
            setAvailableTypes(typesRes.data);
        } catch (error) {
            toast.error("Failed to fetch statutory rules or leave types");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleOpenModal = (rule?: StatutoryRule) => {
        if (rule) {
            setEditingRule(rule);
            setFormData({
                leave_type_code: rule.leave_type_code,
                effective_from: rule.effective_from,
                tenure_unit: rule.tenure_unit,
                progression: [...rule.progression],
                notes: rule.notes || ''
            });
        } else {
            setEditingRule(null);
            setFormData({
                leave_type_code: 'ANNUAL',
                effective_from: new Date().toISOString().split('T')[0],
                tenure_unit: 'years',
                progression: [{ min_tenure: 0, days: 7 }],
                notes: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleAddStep = () => {
        setFormData({
            ...formData,
            progression: [...formData.progression, { min_tenure: 0, days: 0 }]
        });
    };

    const handleRemoveStep = (index: number) => {
        const newProgression = formData.progression.filter((_, i) => i !== index);
        setFormData({ ...formData, progression: newProgression });
    };

    const handleStepChange = (index: number, field: keyof RuleStep, value: number) => {
        const newProgression = [...formData.progression];
        newProgression[index] = { ...newProgression[index], [field]: value };
        setFormData({ ...formData, progression: newProgression });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Progression must be sorted by min_tenure for engine
            const sortedProgression = [...formData.progression].sort((a, b) => a.min_tenure - b.min_tenure);
            const payload = { ...formData, progression: sortedProgression };

            await api.post('/api/v1/leave/rules/statutory', payload);
            toast.success("Statutory rule updated successfully");
            setIsModalOpen(false);
            fetchRules();
        } catch (error) {
            toast.error("Failed to save rule");
        }
    };

    const handleRetire = async (id: string) => {
        if (!window.confirm("Are you sure you want to retire this rule? It will no longer be active for new applications.")) return;
        try {
            await api.delete(`/api/v1/leave/rules/statutory/${id}`);
            toast.success("Rule retired successfully");
            fetchRules();
        } catch (error) {
            toast.error("Failed to retire rule");
        }
    };

    // Group rules by type
    const groupedRules = rules.reduce((acc, rule) => {
        if (!acc[rule.leave_type_code]) acc[rule.leave_type_code] = [];
        acc[rule.leave_type_code].push(rule);
        return acc;
    }, {} as Record<string, StatutoryRule[]>);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-['Outfit'] text-dark-950 dark:text-gray-50 tracking-tight flex items-center gap-3">
                        <Scale className="w-8 h-8 text-primary-600" />
                        Statutory Leave Rules
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium italic">Configure global MOM progression tables for automated leave calculation.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    New Statutory Rule
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Clock className="w-10 h-10 animate-spin text-primary-500" />
                </div>
            ) : Object.keys(groupedRules).length === 0 ? (
                <div className="py-24 text-center bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/5">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-gray-300">
                        <Gavel className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">No Statutory Rules Configured</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">MOM rules are required for automated statutory leave entitlements.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {Object.entries(groupedRules).map(([type, typeRules]) => (
                        <div key={type} className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                            <div className="px-8 py-6 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center">
                                        <Calendar className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50 uppercase tracking-tight">{type}</h2>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{typeRules.length} version(s) defined</p>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {typeRules.sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime()).map((rule) => (
                                    <div key={rule.id} className="p-8">
                                        <div className="flex flex-col lg:flex-row gap-8 lg:items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <span className={clsx(
                                                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                        !rule.effective_to ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                                                    )}>
                                                        {!rule.effective_to ? 'Currently Active' : 'Retired Version'}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                                                        <Clock className="w-4 h-4" />
                                                        <span>{new Date(rule.effective_from).toLocaleDateString()}</span>
                                                        {rule.effective_to && (
                                                            <>
                                                                <ArrowRight className="w-3 h-3" />
                                                                <span>{new Date(rule.effective_to).toLocaleDateString()}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                                                    {rule.progression.map((step, idx) => (
                                                        <div key={idx} className="bg-gray-50/50 dark:bg-gray-800/20 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col items-center">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                                                                {idx === 0 ? 'Start' : `Yr ${step.min_tenure}`}
                                                            </span>
                                                            <span className="text-xl font-bold text-dark-950 dark:text-gray-50">{step.days}d</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {rule.notes && (
                                                    <div className="mt-6 flex gap-2 text-sm text-gray-400 font-medium italic">
                                                        <Info className="w-4 h-4 shrink-0" />
                                                        <p>{rule.notes}</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {!rule.effective_to && (
                                                    <button
                                                        onClick={() => handleRetire(rule.id)}
                                                        className="p-3 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all"
                                                        title="Retire this version"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenModal(rule)}
                                                    className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-bold rounded-2xl hover:border-primary-500 hover:text-primary-600 transition-all active:scale-95"
                                                >
                                                    View Definition
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800"
                        >
                            <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
                                        <Scale className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">
                                            {editingRule ? 'Update' : 'Configure'} Statutory Rule
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-tight">Define tenure-based progression for statutory leave types.</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:border-rose-100 transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-1">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Leave Type Code</label>
                                        <select
                                            value={formData.leave_type_code}
                                            onChange={e => setFormData({ ...formData, leave_type_code: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none h-[60px]"
                                        >
                                            {availableTypes.filter(t => t.is_statutory || ['ANNUAL', 'SICK', 'HOSPITALISATION'].includes(t.code)).map(t => (
                                                <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                                            ))}
                                            {availableTypes.length === 0 && (
                                                <>
                                                    <option value="ANNUAL">ANNUAL</option>
                                                    <option value="SICK">SICK</option>
                                                    <option value="HOSPITALISATION">HOSPITALISATION</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Effective From</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.effective_from}
                                            onChange={e => setFormData({ ...formData, effective_from: e.target.value })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none h-[60px]"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Tenure Unit</label>
                                        <select
                                            value={formData.tenure_unit}
                                            onChange={e => setFormData({ ...formData, tenure_unit: e.target.value as 'months' | 'years' })}
                                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none h-[60px]"
                                        >
                                            <option value="years">Years Service</option>
                                            <option value="months">Months Service</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="text-sm font-bold text-dark-950 dark:text-gray-50">Progression Table</label>
                                        <button
                                            type="button"
                                            onClick={handleAddStep}
                                            className="text-xs font-bold text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-all"
                                        >
                                            + Add Step
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.progression.map((step, idx) => (
                                            <div key={idx} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-left-2 duration-300">
                                                <div className="flex-1 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Min Tenure ({formData.tenure_unit})</label>
                                                        <input
                                                            type="number"
                                                            value={step.min_tenure}
                                                            onChange={e => handleStepChange(idx, 'min_tenure', parseInt(e.target.value) || 0)}
                                                            className="w-full bg-white dark:bg-gray-900 border-none rounded-xl p-2 font-bold text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Entitlement (Days)</label>
                                                        <input
                                                            type="number"
                                                            step="0.5"
                                                            value={step.days}
                                                            onChange={e => handleStepChange(idx, 'days', parseFloat(e.target.value) || 0)}
                                                            className="w-full bg-white dark:bg-gray-900 border-none rounded-xl p-2 font-bold text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveStep(idx)}
                                                    className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Reference Notes (Optional)</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full p-4 rounded-3xl bg-gray-50 dark:bg-gray-800 border-none font-medium text-dark-950 dark:text-gray-50 focus:ring-2 focus:ring-primary-500 outline-none h-24 resize-none"
                                        placeholder="e.g. As per MOM Employment Act Chapter X Amendment 2024."
                                    />
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-3xl flex gap-3 items-start">
                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div className="text-xs font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                                        <p className="font-bold mb-1">Warning: Global Rule Change</p>
                                        Saving this rule will create a new version effective from the specified date. All future leave calculations for all tenants will use this progression table.
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all border border-gray-200 dark:border-gray-700 active:scale-95"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-8 py-3 text-sm font-extrabold text-white bg-primary-600 hover:bg-primary-700 rounded-2xl shadow-xl shadow-primary-200 dark:shadow-primary-900/40 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Update Global Rules
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

export default StatutoryRules;
