import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Calendar,
    FileText,
    ChevronRight,
    Loader2,
    Info
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import { hasPermission } from '../utils/permissions';
import { Permission } from '../types/permissions';


const PayrollNew = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const [loading, setLoading] = useState(false);

    // Default to current month
    const today = new Date();
    const [period, setPeriod] = useState({
        month: today.getMonth() + 1,
        year: today.getFullYear()
    });
    const [notes, setNotes] = useState('');

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    const canCreate = hasPermission(user, Permission.RUN_PAYROLL, user?.selected_entity_id);

    const handleCreate = async () => {
        if (!user?.selected_entity_id) {
            toast.error("No entity selected");
            return;
        }

        setLoading(true);
        try {
            // Backend expects YYYY-MM-01 format
            const periodStr = `${period.year}-${period.month.toString().padStart(2, '0')}-01`;

            const response = await api.post('/api/v1/payroll/runs', {
                entity_id: user.selected_entity_id,
                period: periodStr,
                notes: notes
            });

            toast.success("Payroll run initialized successfully");
            navigate(`/payroll/${response.data.id}`);
        } catch (error: any) {
            const detail = error.response?.data?.detail;
            toast.error(detail || "Failed to initialize payroll run");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/payroll')}
                    className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">Initialize New Run</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Set the period and notes for this payroll batch.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 border border-gray-100 dark:border-gray-800 shadow-sm transition-all overflow-hidden relative">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16" />

                        <div className="space-y-8 relative z-10">
                            {/* Month & Year Selectors */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-gray-400 dark:text-gray-500 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    SELECT PERIOD
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">Month</p>
                                        <div className="relative group">
                                            <select
                                                value={period.month}
                                                onChange={(e) => setPeriod({ ...period, month: parseInt(e.target.value) })}
                                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-dark-950 dark:text-gray-50 font-bold focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer"
                                            >
                                                {months.map((m, i) => (
                                                    <option key={m} value={i + 1}>{m}</option>
                                                ))}
                                            </select>
                                            <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 rotate-90 pointer-events-none group-hover:text-primary-500 transition-colors" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">Year</p>
                                        <div className="relative group">
                                            <select
                                                value={period.year}
                                                onChange={(e) => setPeriod({ ...period, year: parseInt(e.target.value) })}
                                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-dark-950 dark:text-gray-50 font-bold focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer"
                                            >
                                                {years.map(y => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                            <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 rotate-90 pointer-events-none group-hover:text-primary-500 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-gray-400 dark:text-gray-500 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    OPTIONAL NOTES
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any specific comments for this run (e.g., Year end bonus adjustments)"
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 px-6 text-dark-950 dark:text-gray-50 font-medium h-32 focus:ring-2 focus:ring-primary-500 transition-all resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                />
                            </div>

                                <button
                                    onClick={handleCreate}
                                    disabled={loading || !canCreate}
                                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-2xl py-4 font-bold transition-all shadow-xl shadow-primary-200 flex items-center justify-center gap-2 group"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            {canCreate ? 'Initialize Batch' : 'Insufficient Permissions'}
                                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                        </div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-dark-950 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl" />

                        <div className="relative z-10 space-y-6">
                            <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center mb-2">
                                <Info className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold font-['Outfit']">What happens next?</h3>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-dark-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-white/10">1</div>
                                    <p className="text-sm text-dark-300 leading-relaxed">
                                        <span className="text-white font-bold">Draft Batch Creation:</span> We'll create a new payroll batch for the selected period.
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-dark-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-white/10">2</div>
                                    <p className="text-sm text-dark-300 leading-relaxed">
                                        <span className="text-white font-bold">Calculations:</span> Once created, you can trigger the calculation engine to compute CPF, SDL, SHG, and Net Pay for all active employees.
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-dark-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-white/10">3</div>
                                    <p className="text-sm text-dark-300 leading-relaxed">
                                        <span className="text-white font-bold">Review & Audit:</span> Use the AI Compliance Audit to catch any anomalies before final approval.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary-50 dark:bg-primary-900/10 rounded-[32px] p-6 border border-primary-100 dark:border-primary-800/20">
                        <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">PRO TIP</p>
                        <p className="text-sm text-primary-700 dark:text-primary-300 leading-relaxed">
                            If this is a December run, the system will automatically include the 13th Month (AWS) pro-rata for all eligible employees.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayrollNew;
