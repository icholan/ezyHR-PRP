import React, { useState } from 'react';
import { Download, FileText, Calendar, Building2, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

const Reports = () => {
    const { user } = useAuthStore();
    const [reportType, setReportType] = useState('CPF91');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!user?.selected_entity_id) {
            setError("No entity selected. Please select an entity first.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await api.post('/api/v1/reporting/generate', {
                entity_id: user.selected_entity_id,
                report_type: reportType,
                year: year,
                month: reportType === 'CPF91' ? month : null
            });

            setSuccess(`Success! Your ${reportType} report is ready.`);

            // Authenticated download helper
            const downloadResponse = await api.get(response.data.download_url, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([downloadResponse.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', response.data.file_name);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to generate report. Ensure payroll is approved for this period.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">Statutory Reporting</h1>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-lg">Generate and download MOM/IRAS compliant files for submission.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Selection Card */}
                <div className="md:col-span-2 bg-white dark:bg-gray-900 rounded-[24px] border border-gray-100 dark:border-gray-800 p-8 shadow-sm dark:shadow-gray-950/20">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Report Type</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setReportType('CPF91')}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${reportType === 'CPF91'
                                        ? 'border-primary-600 bg-primary-50 text-primary-600'
                                        : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500'
                                        }`}
                                >
                                    <FileText className="w-8 h-8" />
                                    <div className="text-left">
                                        <p className="font-bold">CPF91 (FTP/EZPay)</p>
                                        <p className="text-xs opacity-70">Monthly CPF Contributions</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setReportType('IR8A')}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${reportType === 'IR8A'
                                        ? 'border-primary-600 bg-primary-50 text-primary-600'
                                        : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500'
                                        }`}
                                >
                                    <Building2 className="w-8 h-8" />
                                    <div className="text-left">
                                        <p className="font-bold">IR8A (AIS XML)</p>
                                        <p className="text-xs opacity-70">Annual Employment Income</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Internal Year</label>
                                <select
                                    className="input-field"
                                    value={year}
                                    onChange={(e) => setYear(parseInt(e.target.value))}
                                >
                                    <option>2026</option>
                                    <option>2025</option>
                                    <option>2024</option>
                                </select>
                            </div>
                            {reportType === 'CPF91' && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Month</label>
                                    <select
                                        className="input-field"
                                        value={month}
                                        onChange={(e) => setMonth(parseInt(e.target.value))}
                                    >
                                        <option value={1}>January</option>
                                        <option value={2}>February</option>
                                        <option value={3}>March</option>
                                        <option value={4}>April</option>
                                        <option value={5}>May</option>
                                        <option value={6}>June</option>
                                        <option value={7}>July</option>
                                        <option value={8}>August</option>
                                        <option value={9}>September</option>
                                        <option value={10}>October</option>
                                        <option value={11}>November</option>
                                        <option value={12}>December</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 text-sm">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                <span className="font-medium">{success}</span>
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="btn btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    Generate Report
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="p-6 bg-dark-950 rounded-[24px] text-white">
                        <ShieldCheck className="w-10 h-10 text-primary-400 mb-4" />
                        <h3 className="font-bold text-lg mb-2">Statutory Compliance</h3>
                        <p className="text-dark-300 text-sm leading-relaxed">
                            These files are generated directly from your approved payroll records and meet MOM and IRAS formatting standards.
                        </p>
                    </div>

                    <div className="p-6 border border-gray-100 dark:border-gray-800 rounded-[24px] bg-white dark:bg-gray-900">
                        <h3 className="font-bold mb-4">Need Help?</h3>
                        <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                CPF Submission Guide
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                IRAS AIS Manual Filing
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
