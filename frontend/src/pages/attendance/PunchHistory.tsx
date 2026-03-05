import React, { useState, useEffect } from 'react';
import {
    History, Search, Filter, Plus, Edit2, Trash2, Calendar,
    User, Clock, AlertCircle, CheckCircle2, MoreVertical,
    ChevronLeft, ChevronRight, X, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface RawPunch {
    id: string;
    employment_id: string;
    employee_name: string;
    work_date: string;
    clock_in: string | null;
    clock_out: string | null;
    source: string;
    is_approved: boolean;
    attendance_roster_mode?: string;
}

interface EmployeeSummary {
    id: string;
    full_name: string;
}

const PunchHistory: React.FC = () => {
    const [punches, setPunches] = useState<RawPunch[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPunch, setEditingPunch] = useState<RawPunch | null>(null);
    const [employees, setEmployees] = useState<EmployeeSummary[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        employment_id: '',
        work_date: new Date().toISOString().split('T')[0],
        clock_in: '',
        clock_out: '',
        source: 'manual'
    });

    const activeEntityId = useAuthStore(state => state.user?.selected_entity_id);

    const fetchPunches = async () => {
        if (!activeEntityId) return;
        setLoading(true);
        try {
            const res = await api.get('/api/v1/attendance/records', {
                params: {
                    entity_id: activeEntityId,
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });
            setPunches(res.data);
        } catch (err: any) {
            toast.error('Failed to load punch history');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        if (!activeEntityId) return;
        try {
            const res = await api.get('/api/v1/employees', {
                params: { entity_id: activeEntityId }
            });
            setEmployees(res.data);
        } catch (err: any) {
            console.error('Failed to load employees for manual punch');
        }
    };

    useEffect(() => {
        fetchPunches();
        fetchEmployees();
    }, [activeEntityId, dateRange]);

    const handleOpenModal = (punch?: RawPunch) => {
        if (punch) {
            setEditingPunch(punch);
            setFormData({
                employment_id: punch.employment_id,
                work_date: punch.work_date,
                clock_in: punch.clock_in ? new Date(punch.clock_in).toISOString().slice(0, 16) : '',
                clock_out: punch.clock_out ? new Date(punch.clock_out).toISOString().slice(0, 16) : '',
                source: punch.source
            });
        } else {
            setEditingPunch(null);
            setFormData({
                employment_id: '',
                work_date: new Date().toISOString().split('T')[0],
                clock_in: '',
                clock_out: '',
                source: 'manual'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeEntityId) return;

        const payload = {
            ...formData,
            entity_id: activeEntityId,
            clock_in: formData.clock_in ? new Date(formData.clock_in).toISOString() : null,
            clock_out: formData.clock_out ? new Date(formData.clock_out).toISOString() : null,
        };

        try {
            if (editingPunch) {
                await api.patch(`/api/v1/attendance/records/${editingPunch.id}`, payload);
                toast.success('Punch record updated');
            } else {
                await api.post('/api/v1/attendance/records', payload);
                toast.success('Manual punch created');
            }
            setIsModalOpen(false);
            fetchPunches();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Operation failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this punch record? This will affect attendance calculations.')) return;
        try {
            await api.delete(`/api/v1/attendance/records/${id}`);
            toast.success('Record deleted');
            fetchPunches();
        } catch (err: any) {
            toast.error('Failed to delete record');
        }
    };

    const filteredPunches = punches.filter(p =>
        p.employee_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                            <History className="w-5 h-5 text-white" />
                        </div>
                        Punch History
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Manage raw clock-in/out records for all employees</p>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                    <Plus className="w-4 h-4" />
                    Manual Punch
                </motion.button>
            </div>

            {/* toolbar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col md:flex-row gap-4 items-center justify-between transition-all">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all dark:text-white"
                    />
                </div>

                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="bg-transparent text-sm outline-none dark:text-white font-medium"
                    />
                    <span className="text-gray-400 text-xs px-1">to</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="bg-transparent text-sm outline-none dark:text-white font-medium"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700">
                                <th className="text-left py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Employee</th>
                                <th className="text-left py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Work Date</th>
                                <th className="text-center py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Clock In</th>
                                <th className="text-center py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Clock Out</th>
                                <th className="text-center py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Strategy</th>
                                <th className="text-center py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Source</th>
                                <th className="text-right py-4 px-6 font-black text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-[0.2em]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {loading ? (
                                <tr><td colSpan={6} className="py-20 text-center text-gray-400 font-medium whitespace-nowrap">Fetching history...</td></tr>
                            ) : filteredPunches.length === 0 ? (
                                <tr><td colSpan={6} className="py-20 text-center text-gray-400 whitespace-nowrap">No punch records found.</td></tr>
                            ) : filteredPunches.map((punch) => (
                                <tr key={punch.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center font-black text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-110">
                                                {punch.employee_name?.charAt(0) || <User className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white capitalize">{punch.employee_name || 'Unknown'}</p>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">ID: {punch.employment_id.slice(0, 8)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <p className="font-bold text-gray-700 dark:text-gray-300">
                                            {new Date(punch.work_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </td>
                                    <td className="py-4 px-6 text-center tabular-nums font-medium text-gray-600 dark:text-gray-400">
                                        {punch.clock_in ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-gray-900 dark:text-white font-bold">{new Date(punch.clock_in).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(punch.clock_in).toLocaleDateString()}</span>
                                            </div>
                                        ) : '—'}
                                    </td>
                                    <td className="py-4 px-6 text-center tabular-nums font-medium text-gray-600 dark:text-gray-400">
                                        {punch.clock_out ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-gray-900 dark:text-white font-bold">{new Date(punch.clock_out).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(punch.clock_out).toLocaleDateString()}</span>
                                            </div>
                                        ) : <span className="text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded text-[10px] uppercase">Active</span>}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        {punch.attendance_roster_mode === 'smart_match' ? (
                                            <div className="flex flex-col items-center">
                                                <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">Smart-Match</span>
                                                <span className="text-[8px] text-gray-400 mt-0.5">Auto-Shift</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-black uppercase tracking-wider border border-gray-200 dark:border-gray-700">Manual</span>
                                                <span className="text-[8px] text-gray-400 mt-0.5">Roster-based</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${punch.source === 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {punch.source}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(punch)}
                                                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(punch.id)}
                                                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual Punch / Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white dark:border-gray-800"
                        >
                            <div className="p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                                        {editingPunch ? 'Edit Punch Record' : 'Create Manual Punch'}
                                    </h3>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                                    >
                                        <X className="w-6 h-6 text-gray-400" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Employee</label>
                                        <select
                                            required
                                            disabled={!!editingPunch}
                                            value={formData.employment_id}
                                            onChange={(e) => setFormData({ ...formData, employment_id: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all dark:text-white font-bold"
                                        >
                                            <option value="">Select Employee</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Work Date</label>
                                            <div className="relative">
                                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                                                <input
                                                    type="date"
                                                    required
                                                    value={formData.work_date}
                                                    onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all dark:text-white font-bold"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Source</label>
                                            <input
                                                type="text"
                                                value={formData.source}
                                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all dark:text-white font-bold"
                                                placeholder="manual, web, mobile..."
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2 text-indigo-500">Clock In Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                                                <input
                                                    type="datetime-local"
                                                    value={formData.clock_in}
                                                    onChange={(e) => setFormData({ ...formData, clock_in: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-3 bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all dark:text-white font-bold text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2 text-rose-500">Clock Out Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500" />
                                                <input
                                                    type="datetime-local"
                                                    value={formData.clock_out}
                                                    onChange={(e) => setFormData({ ...formData, clock_out: e.target.value })}
                                                    className="w-full pl-12 pr-4 py-3 bg-rose-50/50 dark:bg-rose-900/10 border-2 border-transparent focus:border-rose-500 rounded-2xl outline-none transition-all dark:text-white font-bold text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
                                        >
                                            <Save className="w-5 h-5" />
                                            {editingPunch ? 'Update Record' : 'Save Record'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PunchHistory;
