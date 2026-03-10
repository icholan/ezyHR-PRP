import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, X, FileText, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface PreviewRow {
    row_index: number;
    employee_code: string;
    employment_id: string | null;
    employee_name: string | null;
    work_date: string | null;
    clock_in: string | null;
    clock_out: string | null;
    matched_shift_name?: string;
    normal_hours: number;
    ot_hours_1_5x: number;
    ot_hours_2x: number;
    lateness_mins: number;
    early_exit_mins: number;
    calculation_breakdown: string[];
    is_valid: boolean;
    validation_errors: string[];
}

interface PreviewResult {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    data: PreviewRow[];
}

interface ImportResult {
    success_count: number;
    error_count: number;
    errors: { row: number; error: string }[];
}

const ImportTimesheet: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [selectedBreakdown, setSelectedBreakdown] = useState<string[] | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeEntityId = useAuthStore(state => state.user?.selected_entity_id);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && validateFile(droppedFile)) {
            setFile(droppedFile);
            resetStates();
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && validateFile(selectedFile)) {
            setFile(selectedFile);
            resetStates();
        }
    };

    const validateFile = (file: File) => {
        const validTypes = [
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
            toast.error('Please upload a valid CSV or Excel file');
            return false;
        }
        return true;
    };

    const resetStates = () => {
        setPreviewResult(null);
        setImportResult(null);
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/api/v1/attendance/import/template', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Timesheet_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    const handlePreview = async () => {
        if (!file || !activeEntityId) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post(`/api/v1/attendance/import/preview?entity_id=${activeEntityId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setPreviewResult(response.data);
            if (response.data.invalid_rows > 0) {
                toast.error(`Found ${response.data.invalid_rows} row(s) with errors. Please review.`);
            } else {
                toast.success('File parsed successfully! Ready for import.');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to parse timesheet');
            if (error.response?.data?.detail === "Not enough permissions to import timesheets") {
                toast.error("Only HR Admins can perform imports");
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleConfirmImport = async () => {
        if (!previewResult || !activeEntityId) return;

        const validRecords = previewResult.data.filter(r => r.is_valid).map(r => ({
            employment_id: r.employment_id,
            work_date: r.work_date,
            clock_in: r.clock_in,
            clock_out: r.clock_out
        }));

        if (validRecords.length === 0) {
            toast.error("No valid records to import.");
            return;
        }

        setIsConfirming(true);
        try {
            const response = await api.post(`/api/v1/attendance/import/confirm`, {
                entity_id: activeEntityId,
                records: validRecords
            });

            setImportResult(response.data);

            if (response.data.error_count > 0) {
                toast.error(`Import completed with ${response.data.error_count} database errors`);
            } else {
                toast.success(`Successfully imported ${response.data.success_count} records!`);
                setFile(null);
            }

            setPreviewResult(null);

        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Failed to confirm import');
        } finally {
            setIsConfirming(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        resetStates();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6 w-full px-4 xl:px-8 mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
                            <Upload className="w-5 h-5 text-white" />
                        </div>
                        Import Timesheet
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Bulk upload clock in/out data via CSV or Excel</p>
                </div>
                <div>
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm font-medium text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Download Template
                    </button>
                </div>
            </div>

            {/* Upload Area */}
            {!previewResult && !importResult && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                        border-2 border-dashed rounded-3xl p-10 mt-6 transition-all duration-300 relative overflow-hidden group
                        ${isDragging
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10'
                            : file
                                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/10'
                                : 'border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'}
                    `}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        id="file-upload"
                    />

                    {!file ? (
                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer text-center h-48">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 ${isDragging ? 'bg-emerald-100 text-emerald-600 scale-110' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:scale-110 group-hover:bg-emerald-50 group-hover:text-emerald-500'}`}>
                                <FileSpreadsheet className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Drop your timesheet here</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mb-6">
                                Support for .csv and .xlsx files. Make sure to follow the template format for successful imports.
                            </p>
                            <span className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all group-hover:scale-105 inline-block">
                                Browse Files
                            </span>
                        </label>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center py-8">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400 relative">
                                <FileText className="w-8 h-8" />
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{file.name}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                                {(file.size / 1024).toFixed(1)} KB • Ready to preview
                            </p>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={clearFile}
                                    disabled={isUploading}
                                    className="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" /> Cancel
                                </button>
                                <button
                                    onClick={handlePreview}
                                    disabled={isUploading}
                                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                                >
                                    {isUploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Parsing...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" /> Preview Data
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Preview Grid */}
            <AnimatePresence>
                {previewResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl overflow-hidden shadow-sm flex flex-col"
                    >
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 dark:bg-gray-800/80">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    Eyeball Verification
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review the parsed {previewResult.total_rows} records before importing.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center px-4 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl">
                                    <p className="text-[10px] font-black tracking-widest uppercase text-green-500">Valid</p>
                                    <p className="text-xl font-black text-gray-900 dark:text-white">{previewResult.valid_rows}</p>
                                </div>
                                <div className="text-center px-4 py-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl">
                                    <p className="text-[10px] font-black tracking-widest uppercase text-rose-500">Errors</p>
                                    <p className="text-xl font-black text-gray-900 dark:text-white">{previewResult.invalid_rows}</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto w-full custom-scrollbar">
                            <table className="w-full text-sm min-w-[1100px]">
                                <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10 shadow-sm border-b border-gray-100 dark:border-gray-700">
                                    <tr>
                                        <th className="text-left py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Row</th>
                                        <th className="text-left py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Employee</th>
                                        <th className="text-left py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Date</th>
                                        <th className="text-left py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Matched Shift</th>
                                        <th className="text-left py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Clock In</th>
                                        <th className="text-left py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Clock Out</th>
                                        <th className="text-right py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Lateness (m)</th>
                                        <th className="text-right py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Early Exp (m)</th>
                                        <th className="text-right py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Normal (h)</th>
                                        <th className="text-right py-4 px-6 font-black text-amber-500/80 text-[10px] uppercase tracking-widest">OT 1.5x (h)</th>
                                        <th className="text-right py-4 px-6 font-black text-rose-500/80 text-[10px] uppercase tracking-widest">OT 2.0x (h)</th>
                                        <th className="text-left py-4 px-6 font-black text-gray-400 text-[10px] uppercase tracking-widest">Status / Errors</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {previewResult.data.map((row, idx) => (
                                        <tr key={idx} className={`transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/30 ${!row.is_valid ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''}`}>
                                            <td className="py-3 px-6 text-gray-500 font-medium text-xs">{row.row_index}</td>
                                            <td className="py-3 px-6">
                                                <p className="font-bold text-gray-900 dark:text-white">{row.employee_name || "Unknown"}</p>
                                                <p className="text-xs text-gray-500 font-mono">{row.employee_code}</p>
                                            </td>
                                            <td className="py-3 px-6 font-medium text-gray-900 dark:text-gray-300">
                                                {row.work_date ? new Date(row.work_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="py-3 px-6 font-medium text-gray-900 dark:text-gray-300">
                                                {row.matched_shift_name ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                                        {row.matched_shift_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-6 font-medium text-gray-900 dark:text-gray-300">
                                                {row.clock_in ? new Date(row.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="py-3 px-6 font-medium text-gray-900 dark:text-gray-300">
                                                {row.clock_out ? new Date(row.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="py-3 px-6 font-bold text-right">
                                                {row.lateness_mins > 0 ? (
                                                    <span className="text-rose-600 dark:text-rose-400">{row.lateness_mins}</span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-6 font-bold text-right">
                                                {row.early_exit_mins > 0 ? (
                                                    <span className="text-rose-600 dark:text-rose-400">{row.early_exit_mins}</span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-6 font-bold text-gray-900 dark:text-white text-right">
                                                {row.normal_hours > 0 ? row.normal_hours.toFixed(2) : '-'}
                                            </td>
                                            <td className="py-3 px-6 font-bold text-amber-600 dark:text-amber-400 text-right">
                                                {row.ot_hours_1_5x > 0 ? row.ot_hours_1_5x.toFixed(2) : '-'}
                                            </td>
                                            <td className="py-3 px-6 font-bold text-rose-600 dark:text-rose-400 text-right">
                                                {row.ot_hours_2x > 0 ? row.ot_hours_2x.toFixed(2) : '-'}
                                            </td>
                                            <td className="py-3 px-6">
                                                <div className="flex items-center gap-2">
                                                    {row.is_valid ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-md text-[10px] font-black uppercase tracking-wider">
                                                            <Check className="w-3 h-3" /> Valid
                                                        </span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            {row.validation_errors.map((err, i) => (
                                                                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-md text-[10px] font-bold">
                                                                    <X className="w-3 h-3 flex-shrink-0" /> {err}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {row.is_valid && row.calculation_breakdown && row.calculation_breakdown.length > 0 && (
                                                        <button
                                                            onClick={() => setSelectedBreakdown(row.calculation_breakdown)}
                                                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md transition-colors"
                                                            title="View Calculation Breakdown"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-gray-800">
                            <button
                                onClick={clearFile}
                                disabled={isConfirming}
                                className="px-6 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-sm transition-colors disabled:opacity-50"
                            >
                                Cancel Import
                            </button>

                            <button
                                onClick={handleConfirmImport}
                                disabled={isConfirming || previewResult.valid_rows === 0}
                                className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 dark:shadow-none transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
                            >
                                {isConfirming ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving to Database...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        {previewResult.invalid_rows > 0
                                            ? `Import ${previewResult.valid_rows} Valid Records (Skip ${previewResult.invalid_rows})`
                                            : `Import All ${previewResult.valid_rows} Records`}
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Calculation Breakdown Modal */}
            <AnimatePresence>
                {selectedBreakdown && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm"
                            onClick={() => setSelectedBreakdown(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><rect width="16" height="20" x="4" y="2" rx="2" /><line x1="8" x2="16" y1="6" y2="6" /><line x1="16" x2="16" y1="14" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></svg>
                                        Calculation Breakdown
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Exact steps taken to compute hours</p>
                                </div>
                                <button
                                    onClick={() => setSelectedBreakdown(null)}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 bg-white dark:bg-gray-800 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <div className="space-y-4">
                                    {selectedBreakdown.map((step, idx) => {
                                        let icon = <CheckCircle2 className="w-5 h-5" />;
                                        let colorClass = "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700";

                                        if (step.includes("Late:") || step.includes("Early Exit:")) {
                                            icon = <AlertTriangle className="w-5 h-5 text-rose-500" />;
                                            colorClass = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/50";
                                        } else if (step.includes("Payable:")) {
                                            icon = <span className="text-xl leading-none">💰</span>;
                                            colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50 font-bold text-base";
                                        } else if (step.includes("Bonus") || step.includes("Rest Day")) {
                                            icon = <span className="text-xl leading-none">✨</span>;
                                            colorClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50";
                                        } else if (step.includes("Shift") || step.includes("Punch")) {
                                            icon = <span className="text-xl leading-none">⏰</span>;
                                            colorClass = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/50";
                                        }

                                        return (
                                            <div key={idx} className={`flex items-start gap-3 p-4 rounded-xl border ${colorClass}`}>
                                                <div className="flex-shrink-0 mt-0.5">{icon}</div>
                                                <div className="text-[15px] leading-relaxed">{step}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Final Import Results (DB layer) */}
            <AnimatePresence>
                {importResult && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl overflow-hidden shadow-sm"
                    >
                        <div className="p-8 text-center flex flex-col items-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${importResult.error_count === 0
                                ? 'bg-green-100 text-green-600'
                                : importResult.success_count > 0 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                                }`}>
                                {importResult.error_count === 0 ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                            </div>

                            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Import Complete</h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
                                Successfully saved {importResult.success_count} records to the database.
                                {importResult.error_count > 0 && ` However, ${importResult.error_count} records failed during insertion.`}
                            </p>

                            {importResult.errors && importResult.errors.length > 0 && (
                                <div className="w-full text-left bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-gray-700">
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Database Errors</h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                        {importResult.errors.map((err, idx) => (
                                            <div key={idx} className="flex gap-3 items-start p-3 bg-white dark:bg-gray-800 rounded-xl border border-rose-100 dark:border-rose-900/30">
                                                <span className="flex-shrink-0 px-2 py-1 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded text-xs font-bold font-mono">
                                                    Row {err.row}
                                                </span>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                                    {err.error}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={clearFile}
                                className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-lg"
                            >
                                Import Another File
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ImportTimesheet;
