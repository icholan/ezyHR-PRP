import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Download,
    Printer,
    ShieldAlert,
    CheckCircle2,
    Users,
    Wallet,
    Building,
    AlertTriangle,
    ChevronDown,
    MoreHorizontal,
    FileCheck,
    Loader2,
    Trash2
} from 'lucide-react';
import api from '../services/api';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission } from '../utils/permissions';
import { Permission } from '../types/permissions';
import PrivacyToggle from '../components/Payroll/PrivacyToggle';


const PayrollDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [run, setRun] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { user, privacyMode } = useAuthStore(state => ({
        user: state.user,
        privacyMode: state.privacyMode
    }));


    const fetchDetail = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/api/v1/payroll/runs/${id}`);
            setRun(response.data);
        } catch (error) {
            console.error("Failed to fetch payroll details", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const handleProcess = async () => {
        const t = toast.loading("Processing payroll calculations...");
        try {
            await api.post(`/api/v1/payroll/runs/${id}/process`);
            toast.success("Payroll records processed successfully", { id: t });
            fetchDetail();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Processing failed", { id: t });
        }
    };

    const handleAudit = async () => {
        const t = toast.loading("Running AI Compliance Audit...");
        try {
            const res = await api.post(`/api/v1/payroll/runs/${id}/audit`);
            toast.success(`Audit complete: ${res.data.flags_found} flags found`, { id: t });
            fetchDetail();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Audit failed", { id: t });
        }
    };

    const handleApprove = async () => {
        if (!window.confirm("Are you sure you want to approve this payroll run? This will lock the records and update YTD data.")) return;
        const t = toast.loading("Finalizing approval...");
        try {
            await api.post(`/api/v1/payroll/runs/${id}/approve`);
            toast.success("Payroll run approved successfully", { id: t });
            fetchDetail();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Approval failed", { id: t });
        }
    };

    const handleExport = async (type: 'cpf91' | 'giro') => {
        try {
            // Use browser download
            const response = await api.get(`/api/v1/payroll/runs/${id}/export/${type}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = type === 'cpf91' ? `CPF91_${id?.slice(0, 6)}.txt` : `GIRO_${id?.slice(0, 6)}.csv`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error: any) {
            toast.error("Export failed. Ensure the run is approved.");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("CRITICAL: Are you sure you want to delete this entire payroll batch? This will permanently remove all records and REVERSE all YTD contributions for this period. This action cannot be undone.")) return;

        const t = toast.loading("Deleting payroll batch...");
        try {
            await api.delete(`/api/v1/payroll/runs/${id}`);
            toast.success("Payroll batch deleted successfully", { id: t });
            navigate('/payroll');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || "Delete failed", { id: t });
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
    );

    if (!run) return (
        <div className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Payroll run not found.</p>
            <button onClick={() => navigate('/payroll')} className="mt-4 text-primary-600 font-bold">Return to Dashboard</button>
        </div>
    );

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/payroll')}
                        className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-all shadow-sm dark:shadow-gray-950/20"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">
                                {new Date(run.period).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })} Run
                            </h1>
                            <span className={clsx(
                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                run.status === 'approved' ? "bg-emerald-100 text-emerald-700 dark:text-emerald-400" : "bg-primary-100 dark:bg-primary-900/30 text-primary-700"
                            )}>
                                {run.status}
                            </span>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">Batch ID: {run.id.slice(0, 8)} • Run by {run.run_by_name || 'System Admin'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <PrivacyToggle />
                    {run.status === 'approved' && hasPermission(user, Permission.VIEW_PAYROLL, run.entity_id) && (
                        <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                            <button
                                onClick={() => handleExport('cpf91')}
                                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-r border-gray-100 dark:border-gray-800 flex items-center gap-2"
                            >
                                <Download className="w-3.5 h-3.5" />
                                CPF91
                            </button>
                            <button
                                onClick={() => handleExport('giro')}
                                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                            >
                                <Download className="w-3.5 h-3.5" />
                                GIRO
                            </button>
                        </div>
                    )}
                    {run.status === 'processed' && hasPermission(user, Permission.APPROVE_PAYROLL, run.entity_id) && (
                        <button
                            onClick={handleApprove}
                            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
                        >
                            <FileCheck className="w-4 h-4" />
                            Approve
                        </button>
                    )}
                    {(run.status === 'draft' || !run.records || run.records.length === 0) && hasPermission(user, Permission.RUN_PAYROLL, run.entity_id) && (
                        <button
                            onClick={handleProcess}
                            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
                        >
                            <Loader2 className="w-4 h-4" />
                            Process
                        </button>
                    )}
                    {hasPermission(user, Permission.APPROVE_PAYROLL, run.entity_id) && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-sm transition-all border border-rose-100"
                            title="Hard Delete Batch"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Net Payable', value: privacyMode ? '••••••' : `$${Number(run.total_net || 0).toLocaleString()}`, icon: Wallet, color: 'text-primary-600', bg: 'bg-primary-50' },
                    { label: 'Total CPF Liability', value: privacyMode ? '••••••' : `$${(Number(run.total_cpf_ee || 0) + Number(run.total_cpf_er || 0)).toLocaleString()}`, icon: Building, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Total Employees', value: run.records?.length || 0, icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20 flex items-center gap-4">
                        <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center", stat.bg)}>
                            <stat.icon className={clsx("w-7 h-7", stat.color)} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-1">{stat.label}</p>
                            <p className="text-2xl font-bold text-dark-950 dark:text-gray-50">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Employee Records Table */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-lg font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">Employee Breakdown</h2>
                        <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">{run.records?.length || 0} Records</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Employee</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Gross</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">CPF (EE)</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Net Pay</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {run.records?.map((record: any) => (
                                        <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800/50 transition-all">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-dark-950 dark:text-gray-50">{record.employee_name || 'Staff'}</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">{record.employee_code || 'EMP001'}</p>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-600 dark:text-gray-300">
                                                {privacyMode ? '••••••' : `$${Number(record.gross_salary).toFixed(2)}`}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-rose-600 dark:text-rose-400">
                                                {privacyMode ? '••••••' : `-$${Number(record.cpf_employee).toFixed(2)}`}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-dark-950 dark:text-gray-50">
                                                {privacyMode ? '••••••' : `$${Number(record.net_salary).toFixed(2)}`}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => navigate(`/payroll/${id}/payslip/${record.id}`)}
                                                    className="px-3 py-1.5 text-[10px] font-bold text-primary-600 hover:bg-primary-50 rounded-lg transition-all border border-primary-100"
                                                >
                                                    View Payslip
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Side Panel: AI Audit & Actions */}
                <div className="space-y-6">
                    {/* AI Audit Panel */}
                    <div className="bg-dark-950 rounded-[32px] p-6 text-white shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold font-['Outfit']">AI Compliance Audit</h2>
                            <ShieldAlert className={clsx(
                                "w-6 h-6",
                                run.ai_flags_count > 0 ? "text-rose-500 animate-pulse" : "text-emerald-500"
                            )} />
                        </div>

                        {run.ai_audit_run ? (
                            <div className="space-y-4">
                                {run.ai_flags_count > 0 ? (
                                    <>
                                        <div className="bg-rose-50 dark:bg-rose-900/200/10 border border-rose-500/20 rounded-2xl p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-bold text-rose-500 mb-1">{run.ai_flags_count} Anomalies Detected</p>
                                                    <p className="text-xs text-dark-300">The engine detected variances that deviate from historical averages.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {/* Placeholder for real flags */}
                                            <div className="p-3 bg-white dark:bg-gray-900/5 rounded-xl border border-white/5 hover:bg-white dark:bg-gray-900/10 transition-all cursor-pointer">
                                                <p className="text-xs font-bold text-primary-400 mb-1">Salary Spike: Tan Wei Ming</p>
                                                <p className="text-[10px] text-dark-400 font-medium">Gross salary is 45% higher than Jan 2024 average.</p>
                                            </div>
                                            <button className="w-full py-2 text-xs font-bold text-dark-400 border border-dark-800 rounded-xl hover:bg-white dark:bg-gray-900/5 transition-all">
                                                Review All Flags
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-6">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                                        <p className="font-bold text-emerald-500">Audit Passed</p>
                                        <p className="text-xs text-dark-400 mt-1">No statutory or financial anomalies found.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <ShieldAlert className="w-12 h-12 text-dark-700 mx-auto mb-3" />
                                <p className="text-dark-400 text-sm mb-4">Initial calculations are complete. Run AI audit now?</p>
                                {hasPermission(user, Permission.RUN_PAYROLL, run.entity_id) && (
                                    <button
                                        onClick={handleAudit}
                                        className="btn btn-primary w-full py-3"
                                    >
                                        Run Audit Engine
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Statutory Summary Card */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] p-6 border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20">
                        <h2 className="text-lg font-bold text-dark-950 dark:text-gray-50 font-['Outfit'] mb-4">Statutory Summary</h2>
                        <div className="space-y-3">
                            {[
                                { label: 'CPF ER Contribution', value: run.total_cpf_er },
                                { label: 'CPF EE Deduction', value: run.total_cpf_ee },
                                { label: 'SDL (Statutory Board)', value: run.total_sdl },
                                { label: 'SHG (CDAC/MBMF/etc)', value: run.total_shg },
                                { label: 'FWL (Foreign Levies)', value: run.total_fwl || 0 },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">{item.label}</span>
                                    <span className="text-sm font-bold text-dark-950 dark:text-gray-50">
                                        {privacyMode ? '••••••' : `$${Number(item.value).toFixed(2)}`}
                                    </span>
                                </div>
                            ))}
                            <div className="pt-2 flex items-center justify-between">
                                <span className="text-sm font-bold text-primary-600">Total Statutory</span>
                                <span className="text-lg font-black text-primary-600">
                                    {privacyMode ? '••••••' : `$${(Number(run.total_cpf_er) + Number(run.total_cpf_ee) + Number(run.total_sdl) + Number(run.total_shg)).toFixed(2)}`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayrollDetail;
