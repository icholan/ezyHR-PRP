import React, { useState, useEffect } from 'react';
import {
    Activity,
    Search,
    Filter,
    Calendar,
    User,
    ArrowRight,
    Eye,
    X,
    Building2,
    Database,
    Shield,
    Clock,
    Terminal,
    ChevronDown,
    Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../services/api';
import toast from 'react-hot-toast';

interface AuditLog {
    id: string;
    action: string;
    table_name: string;
    record_id: string;
    old_value: any;
    new_value: any;
    ip_address: string;
    created_at: string;
    user_id?: string;
}

interface SystemLog {
    id: string;
    action: string;
    ip_address: string;
    details: any;
    created_at: string;
}

const AuditTrail = () => {
    const [auditType, setAuditType] = useState<'data' | 'system'>('data');
    const [dataLogs, setDataLogs] = useState<AuditLog[]>([]);
    const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [filters, setFilters] = useState({
        action: '',
        tableName: '',
        searchTerm: ''
    });

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalRows, setTotalRows] = useState(0);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const endpoint = auditType === 'data' ? '/api/v1/audit/data' : '/api/v1/audit/system';
            const params: any = {
                skip: (page - 1) * limit,
                limit: limit
            };

            if (filters.action) params.action = filters.action;
            if (auditType === 'data' && filters.tableName) params.table_name = filters.tableName;

            const res = await api.get(endpoint, { params });
            if (auditType === 'data') {
                setDataLogs(res.data.items || []);
            } else {
                setSystemLogs(res.data.items || []);
            }
            setTotalRows(res.data.total || 0);
        } catch (error) {
            toast.error("Failed to fetch audit logs");
        } finally {
            setLoading(false);
        }
    };

    // Reset page to 1 when switching tabs
    useEffect(() => {
        setPage(1);
    }, [auditType]);

    useEffect(() => {
        fetchLogs();
    }, [auditType, page, limit, filters.action, filters.tableName]);

    const getActionColor = (action: string) => {
        switch (action.toUpperCase()) {
            case 'INSERT': return 'bg-green-100 text-green-600';
            case 'UPDATE': return 'bg-blue-100 text-blue-600';
            case 'DELETE': return 'bg-red-100 text-red-600';
            case 'LOGIN': return 'bg-purple-100 text-purple-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const DiffViewer = ({ oldVal, newVal }: { oldVal: any, newVal: any }) => {
        if (!oldVal && !newVal) return <p className="text-gray-400 italic">No data changes recorded</p>;

        return (
            <div className="grid grid-cols-2 gap-4 h-full">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Original Data</h4>
                    <pre className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl text-xs overflow-auto max-h-[400px] border border-gray-100 dark:border-gray-700">
                        {JSON.stringify(oldVal, null, 2)}
                    </pre>
                </div>
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest text-primary-600">Updated Data</h4>
                    <pre className="bg-primary-50/50 dark:bg-primary-900/10 p-4 rounded-xl text-xs overflow-auto max-h-[400px] border border-primary-100 dark:border-primary-900/20">
                        {JSON.stringify(newVal, null, 2)}
                    </pre>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-primary-600" />
                        Audit Trail
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Monitor all system activities and record-level changes across the platform.
                    </p>
                </div>

                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
                    <button
                        onClick={() => setAuditType('data')}
                        className={clsx(
                            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                            auditType === 'data' ? "bg-white dark:bg-gray-700 shadow-sm text-primary-600" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Data Changes
                    </button>
                    <button
                        onClick={() => setAuditType('system')}
                        className={clsx(
                            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                            auditType === 'system' ? "bg-white dark:bg-gray-700 shadow-sm text-primary-600" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        System Events
                    </button>
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-4 flex-1">
                        <div className="relative flex-1 min-w-[200px] max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20"
                                value={filters.searchTerm}
                                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none cursor-pointer text-gray-600 dark:text-gray-300 font-medium"
                                value={filters.action}
                                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                            >
                                <option value="">All Actions</option>
                                <option value="INSERT">Create (INSERT)</option>
                                <option value="UPDATE">Update (UPDATE)</option>
                                <option value="DELETE">Delete (DELETE)</option>
                                {auditType === 'system' && (
                                    <>
                                        <option value="LOGIN">Login</option>
                                        <option value="LOGOUT">Logout</option>
                                    </>
                                )}
                            </select>

                            {auditType === 'data' && (
                                <select
                                    className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none cursor-pointer text-gray-600 dark:text-gray-300 font-medium"
                                    value={filters.tableName}
                                    onChange={(e) => setFilters({ ...filters, tableName: e.target.value })}
                                >
                                    <option value="">All Tables</option>
                                    <option value="employees">Employees</option>
                                    <option value="users">Users</option>
                                    <option value="leave_requests">Leave Requests</option>
                                    <option value="attendance_records">Attendance records</option>
                                    <option value="payroll_runs">Payroll runs</option>
                                    <option value="entities">Entities</option>
                                    <option value="masters">System Data (Masters)</option>
                                    <option value="platform_admins">Platform Admins</option>
                                    <option value="roles">Roles</option>
                                </select>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                                <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest first:pl-8">Timestamp</th>
                                <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Action</th>
                                <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    {auditType === 'data' ? 'Table' : 'Type'}
                                </th>
                                <th className="p-6 text-xs font-bold text-gray-400 uppercase tracking-widest text-right last:pr-8">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                                            <p className="text-gray-500 font-medium">Loading activity logs...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (auditType === 'data' ? dataLogs : systemLogs).length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-[2rem] flex items-center justify-center text-gray-300">
                                                <Terminal className="w-10 h-10" />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xl font-bold text-gray-900 dark:text-white">No activity yet</p>
                                                <p className="text-gray-500 max-w-xs mx-auto">Activities will appear here once users start interacting with the platform.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (auditType === 'data' ? dataLogs : systemLogs).map((log) => (
                                <tr key={log.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="p-6 first:pl-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors">
                                                <Clock className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                                                    {new Date(log.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className={clsx(
                                            "inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                            getActionColor(log.action)
                                        )}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                {auditType === 'data' ? (log as AuditLog).table_name : (log as SystemLog).action}
                                            </span>
                                            <span className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1">
                                                <Activity className="w-3 h-3" />
                                                IP: {log.ip_address || 'Internal System'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-right last:pr-8">
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all shadow-sm"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            View {auditType === 'data' ? 'Changes' : 'Details'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-b-[32px]">
                    <div className="flex items-center gap-2">
                        <span>Show</span>
                        <select
                            className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary-500/20 text-gray-700 dark:text-gray-300 font-medium"
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span>entries</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <span>
                            Showing {totalRows === 0 ? 0 : ((page - 1) * limit) + 1} to {Math.min(page * limit, totalRows)} of {totalRows} records
                        </span>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors font-semibold"
                            >
                                Prev
                            </button>
                            <div className="px-3 font-semibold text-gray-900 dark:text-white">
                                {page} / {Math.max(1, Math.ceil(totalRows / limit))}
                            </div>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={totalRows === 0 || page >= Math.ceil(totalRows / limit)}
                                className="px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors font-semibold"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selection Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex items-center gap-6">
                                <div className={clsx(
                                    "w-16 h-16 rounded-[2rem] flex items-center justify-center text-2xl font-black shadow-lg",
                                    getActionColor(selectedLog.action)
                                )}>
                                    {selectedLog.action[0]}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                        {auditType === 'data' ? 'Data Change Review' : 'System Event Log'}
                                    </h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-sm font-bold text-primary-600">{selectedLog.action}</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                        <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                            <Clock className="w-4 h-4" />
                                            {new Date(selectedLog.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-3 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 max-h-[70vh] overflow-y-auto">
                            {auditType === 'data' ? (
                                <DiffViewer oldVal={selectedLog.old_value} newVal={selectedLog.new_value} />
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl space-y-2 border border-gray-100 dark:border-gray-700">
                                            <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.15em]">Action Key</p>
                                            <p className="text-xl font-bold text-gray-900 dark:text-white">{selectedLog.action}</p>
                                        </div>
                                        <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl space-y-2 border border-gray-100 dark:border-gray-700">
                                            <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.15em]">IP Address</p>
                                            <p className="text-xl font-bold text-gray-900 dark:text-white">{selectedLog.ip_address || 'Logged Internally'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Event Payload / Details</h4>
                                        <pre className="bg-gray-900 text-green-400 p-8 rounded-[2rem] text-sm overflow-auto shadow-inner border-[6px] border-gray-800 leading-relaxed font-mono">
                                            {JSON.stringify(selectedLog.details, null, 4)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-8 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-sm hover:scale-[1.02] transition-all active:scale-[0.98] shadow-xl shadow-gray-200 dark:shadow-none"
                            >
                                Close Log View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditTrail;
