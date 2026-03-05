import React, { useState, useEffect } from 'react';
import {
    Calendar, Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
    Clock, AlertCircle, CheckCircle2, MoreVertical, FileText, Download,
    Timer, User, Briefcase, Info, Calculator, HelpCircle, ArrowRight, Coffee, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface AttendanceLog {
    id: string;
    employment_id: string;
    work_date: string;
    status: string;
    actual_hours: number;
    scheduled_hours: number;
    normal_hours: number;
    ot_hours_1_5x: number;
    ot_hours_2x: number;
    lateness_minutes: number;
    early_leave_minutes: number;
    is_absent: boolean;
    calculation_log?: string;
    employee_name?: string;
    shift_name?: string;
}

const AttendanceLogs: React.FC = () => {
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [searchQuery, setSearchQuery] = useState('');

    const activeEntityId = useAuthStore(state => state.user?.selected_entity_id);

    const fetchLogs = async () => {
        if (!activeEntityId) return;
        setLoading(true);
        try {
            const res = await api.get('/api/v1/attendance/daily-attendance', {
                params: {
                    entity_id: activeEntityId,
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });
            setLogs(res.data);
        } catch (err: any) {
            toast.error('Failed to load logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [activeEntityId, dateRange]);

    const handleProcessDaily = async () => {
        if (!activeEntityId) return;
        setProcessing(true);
        try {
            // Process for each day in range (simplified for demo)
            const targetDate = dateRange.end;
            await api.post(`/api/v1/attendance/process-daily`, null, {
                params: {
                    entity_id: activeEntityId,
                    work_date: targetDate
                }
            });
            toast.success(`Processed records for ${targetDate}`);
            fetchLogs();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Processing failed');
        } finally {
            setProcessing(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        Attendance Logs
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Review, process and approve daily attendance records</p>
                </div>

                <div className="flex items-center gap-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={processing}
                        onClick={handleProcessDaily}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                    >
                        {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Process Today
                    </motion.button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Records</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{filteredLogs.length}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-amber-500 text-xs font-bold uppercase tracking-wider mb-1">Lateness Cases</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {filteredLogs.filter(l => l.lateness_minutes > 0).length}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-indigo-500 text-xs font-bold uppercase tracking-wider mb-1">Total OT Hours</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {filteredLogs.reduce((sum, l) => sum + (l.ot_hours_1_5x + l.ot_hours_2x), 0).toFixed(1)}h
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-rose-500 text-xs font-bold uppercase tracking-wider mb-1">Absences</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {filteredLogs.filter(l => l.is_absent).length}
                    </p>
                </div>
            </div>

            {/* toolbar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter by employee name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all dark:text-white"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-transparent text-sm outline-none dark:text-white font-medium"
                        />
                        <span className="text-gray-400 text-xs">to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="bg-transparent text-sm outline-none dark:text-white font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                                <th className="text-left py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Employee</th>
                                <th className="text-left py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Date / Shift</th>
                                <th className="text-center py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Hours</th>
                                <th className="text-center py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Exceptions</th>
                                <th className="text-center py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Status</th>
                                <th className="text-right py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {loading ? (
                                <tr><td colSpan={6} className="py-20 text-center text-gray-400 font-medium">Loading records...</td></tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr><td colSpan={6} className="py-20 text-center text-gray-400">No records found for this period.</td></tr>
                            ) : filteredLogs.map((log) => (
                                <React.Fragment key={log.id}>
                                    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400">
                                                    {log.employee_name?.charAt(0) || <User className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white capitalize">{log.employee_name || 'Unknown'}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Details</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="space-y-1">
                                                <p className="font-bold text-gray-700 dark:text-gray-300">
                                                    {new Date(log.work_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                    <Briefcase className="w-3 h-3" />
                                                    {log.shift_name || 'No Shift'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums">
                                                        {log.actual_hours.toFixed(2)}h
                                                    </span>
                                                    {log.calculation_log && (
                                                        <button
                                                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                                            className={`p-1 rounded-full transition-colors ${expandedLog === log.id ? 'bg-indigo-100 text-indigo-600' : 'text-gray-300 hover:text-indigo-600'}`}
                                                        >
                                                            <Calculator className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex gap-1">
                                                    {log.ot_hours_1_5x > 0 && <span className="text-[10px] font-black text-indigo-500">+{log.ot_hours_1_5x}h OT</span>}
                                                    {log.ot_hours_2x > 0 && <span className="text-[10px] font-black text-rose-500">+{log.ot_hours_2x}h OT</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {log.lateness_minutes > 0 && (
                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-black uppercase">Late {log.lateness_minutes}m</span>
                                                )}
                                                {log.early_leave_minutes > 0 && (
                                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[10px] font-black uppercase">Early {log.early_leave_minutes}m</span>
                                                )}
                                                {log.is_absent && (
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase">Absent</span>
                                                )}
                                                {!log.lateness_minutes && !log.early_leave_minutes && !log.is_absent && (
                                                    <span className="text-green-500"><CheckCircle2 className="w-4 h-4" /></span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${log.status === 'approved'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 transition-colors">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                    <AnimatePresence>
                                        {expandedLog === log.id && log.calculation_log && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-indigo-50/30 dark:bg-indigo-900/10"
                                            >
                                                <td colSpan={6} className="px-6 py-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="flex items-center gap-1.5 mr-2">
                                                            <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                                                                <Calculator className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                                            </div>
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Logic</span>
                                                        </div>

                                                        {log.calculation_log.split('|').map((step, idx) => {
                                                            const content = step.trim();
                                                            let Icon = Info;
                                                            let bgColor = "bg-white dark:bg-gray-800";
                                                            let iconColor = "text-gray-400";
                                                            let borderColor = "border-gray-100 dark:border-gray-700";

                                                            if (content.includes('Shift:')) {
                                                                Icon = Briefcase;
                                                            } else if (content.includes('Punch:')) {
                                                                Icon = Clock;
                                                                iconColor = "text-indigo-500";
                                                            } else if (content.includes('Elapsed:')) {
                                                                Icon = Timer;
                                                            } else if (content.includes('Break')) {
                                                                Icon = Coffee;
                                                                iconColor = "text-amber-500";
                                                                bgColor = "bg-amber-50/30 dark:bg-amber-900/10";
                                                                borderColor = "border-amber-100 dark:border-amber-900/30";
                                                            } else if (content.includes('Late:') || content.includes('Early Exit:')) {
                                                                Icon = AlertCircle;
                                                                iconColor = "text-rose-500";
                                                                bgColor = "bg-rose-50/30 dark:bg-rose-900/10";
                                                                borderColor = "border-rose-100 dark:border-rose-900/30";
                                                            } else if (content.includes('Payable:')) {
                                                                Icon = Target;
                                                                iconColor = "text-green-500";
                                                                bgColor = "bg-green-50/30 dark:bg-green-900/10";
                                                                borderColor = "border-green-100 dark:border-green-900/30";
                                                            }

                                                            return (
                                                                <motion.div
                                                                    key={idx}
                                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    transition={{ delay: idx * 0.03 }}
                                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${borderColor} ${bgColor} shadow-sm group hover:scale-105 transition-transform`}
                                                                >
                                                                    <Icon className={`w-3 h-3 ${iconColor}`} />
                                                                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">{content}</span>
                                                                    {idx < log.calculation_log!.split('|').length - 1 && (
                                                                        <ArrowRight className="w-3 h-3 text-gray-300 ml-1 opacity-50" />
                                                                    )}
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AttendanceLogs;
