import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Clock, Timer, Coffee, CheckCircle2,
    MoreVertical, Pencil, Trash2, X, AlertCircle, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface Shift {
    id: string;
    entity_id: string;
    name: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    work_hours: number;
    is_overnight: boolean;
    lateness_grace_minutes: number;
    early_exit_grace_minutes: number;
    late_penalty_rounding_block: number;
    early_penalty_rounding_block: number;
    offered_ot_1_5x: number;
    offered_ot_2_0x: number;
    breaks: ShiftBreakItem[];
}

interface ShiftBreakItem {
    id?: string;
    label: string;
    break_start: string;
    break_end: string;
    is_paid: boolean;
    sort_order: number;
}

const DEFAULT_BREAK: ShiftBreakItem = {
    label: '',
    break_start: '12:00',
    break_end: '13:00',
    is_paid: false,
    sort_order: 0
};

const ShiftSettings: React.FC = () => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('18:00');
    const [breakMinutes, setBreakMinutes] = useState(60);
    const [workHours, setWorkHours] = useState(8);
    const [isOvernight, setIsOvernight] = useState(false);
    const [latenessGraceMinutes, setLatenessGraceMinutes] = useState(5);
    const [earlyExitGraceMinutes, setEarlyExitGraceMinutes] = useState(0);
    const [lateRoundingBlock, setLateRoundingBlock] = useState(0);
    const [earlyRoundingBlock, setEarlyRoundingBlock] = useState(0);
    const [offeredOT15, setOfferedOT15] = useState(0);
    const [offeredOT20, setOfferedOT20] = useState(0);
    const [breaks, setBreaks] = useState<ShiftBreakItem[]>([]);

    const activeEntityId = useAuthStore(state => state.user?.selected_entity_id);

    const fetchShifts = async () => {
        if (!activeEntityId) return;
        setLoading(true);
        try {
            const response = await api.get(`/api/v1/attendance/shifts?entity_id=${activeEntityId}`);
            setShifts(response.data);
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to fetch shifts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShifts();
    }, [activeEntityId]);

    const handleOpenModal = (shift?: Shift) => {
        if (shift) {
            setEditingShift(shift);
            setName(shift.name);
            setStartTime(shift.start_time.substring(0, 5));
            setEndTime(shift.end_time.substring(0, 5));
            setBreakMinutes(shift.break_minutes);
            setWorkHours(shift.work_hours);
            setIsOvernight(shift.is_overnight);
            setLatenessGraceMinutes(shift.lateness_grace_minutes);
            setEarlyExitGraceMinutes(shift.early_exit_grace_minutes);
            setLateRoundingBlock(shift.late_penalty_rounding_block);
            setEarlyRoundingBlock(shift.early_penalty_rounding_block);
            setOfferedOT15(shift.offered_ot_1_5x);
            setOfferedOT20(shift.offered_ot_2_0x);
            setBreaks(shift.breaks || []);
        } else {
            setEditingShift(null);
            setName('');
            setStartTime('09:00');
            setEndTime('18:00');
            setBreakMinutes(60);
            setWorkHours(8);
            setIsOvernight(false);
            setLatenessGraceMinutes(5);
            setEarlyExitGraceMinutes(0);
            setLateRoundingBlock(0);
            setEarlyRoundingBlock(0);
            setOfferedOT15(0);
            setOfferedOT20(0);
            setBreaks([{ ...DEFAULT_BREAK, label: 'Lunch', sort_order: 1 }]);
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeEntityId) return;

        const payload = {
            entity_id: activeEntityId,
            name,
            start_time: startTime,
            end_time: endTime,
            break_minutes: Number(breakMinutes),
            work_hours: Number(workHours),
            is_overnight: isOvernight,
            lateness_grace_minutes: Number(latenessGraceMinutes),
            early_exit_grace_minutes: Number(earlyExitGraceMinutes),
            late_penalty_rounding_block: Number(lateRoundingBlock),
            early_penalty_rounding_block: Number(earlyRoundingBlock),
            offered_ot_1_5x: Number(offeredOT15),
            offered_ot_2_0x: Number(offeredOT20)
        };

        try {
            let savedShift: any;
            if (editingShift) {
                const res = await api.patch(`/api/v1/attendance/shifts/${editingShift.id}`, payload);
                savedShift = res.data;
                toast.success('Shift updated successfully');
            } else {
                const res = await api.post('/api/v1/attendance/shifts', payload);
                savedShift = res.data;
                toast.success('Shift created successfully');
            }
            // Save breaks via bulk PUT
            if (savedShift?.id && breaks.length > 0) {
                const breakPayload = breaks.map((b, i) => ({
                    label: b.label,
                    break_start: b.break_start,
                    break_end: b.break_end,
                    is_paid: b.is_paid,
                    sort_order: b.sort_order || i + 1
                }));
                await api.put(`/api/v1/attendance/shifts/${savedShift.id}/breaks`, breakPayload);
            } else if (savedShift?.id && breaks.length === 0) {
                await api.put(`/api/v1/attendance/shifts/${savedShift.id}/breaks`, []);
            }
            setIsModalOpen(false);
            fetchShifts();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to save shift');
        }
    };

    const handleDelete = (shift: Shift) => {
        setShiftToDelete(shift);
    };

    const confirmDelete = async () => {
        if (!shiftToDelete) return;
        try {
            await api.delete(`/api/v1/attendance/shifts/${shiftToDelete.id}`);
            toast.success('Shift deleted successfully');
            setShiftToDelete(null);
            fetchShifts();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to delete shift');
        }
    };

    const filteredShifts = shifts.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-6 h-6 text-indigo-600" />
                        Shift Management
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Define shift timings, breaks, and grace periods for your workforce.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Create Shift
                </button>
            </div>

            {/* toolbar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search shifts by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                    />
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode='popLayout'>
                    {filteredShifts.map((shift) => (
                        <motion.div
                            key={shift.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                                    <Clock className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleOpenModal(shift)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(shift)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{shift.name}</h3>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                    <Timer className="w-4 h-4 text-gray-400" />
                                    <span>{shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</span>
                                    {shift.is_overnight && (
                                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold uppercase">Overnight</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                    <Coffee className="w-4 h-4 text-gray-400" />
                                    <div className="flex flex-col">
                                        {(shift.breaks && shift.breaks.length > 0) ? (
                                            <>
                                                <span>{shift.breaks.length} break{shift.breaks.length > 1 ? 's' : ''} • {shift.breaks.filter(b => !b.is_paid).reduce((sum, b) => {
                                                    const [sh, sm] = b.break_start.split(':').map(Number);
                                                    const [eh, em] = b.break_end.split(':').map(Number);
                                                    let diff = (eh * 60 + em) - (sh * 60 + sm);
                                                    if (diff < 0) diff += 24 * 60;
                                                    return sum + diff;
                                                }, 0)} min unpaid</span>
                                                {shift.breaks.map((b, i) => (
                                                    <span key={i} className="text-[10px] text-gray-500">
                                                        {b.label}: {b.break_start.substring(0, 5)}–{b.break_end.substring(0, 5)} {b.is_paid ? '(paid)' : ''}
                                                    </span>
                                                ))}
                                            </>
                                        ) : (
                                            <span>{shift.break_minutes} mins Break</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                    <CheckCircle2 className="w-4 h-4 text-gray-400" />
                                    <span>{shift.work_hours} Working Hours</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                                    <AlertCircle className="w-4 h-4 text-gray-400" />
                                    <div className="flex flex-col">
                                        <span>Grace: {shift.lateness_grace_minutes}m (L) / {shift.early_exit_grace_minutes}m (E)</span>
                                        {(shift.late_penalty_rounding_block > 0 || shift.early_penalty_rounding_block > 0) && (
                                            <span className="text-[10px] text-gray-500">
                                                Rounding: {shift.late_penalty_rounding_block}m (L) / {shift.early_penalty_rounding_block}m (E)
                                            </span>
                                        )}
                                        {(shift.offered_ot_1_5x > 0 || shift.offered_ot_2_0x > 0) && (
                                            <span className="text-[10px] text-indigo-500 font-bold">
                                                Offered OT: {shift.offered_ot_1_5x}h (1.5x) / {shift.offered_ot_2_0x}h (2.0x)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {filteredShifts.length === 0 && !loading && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500">
                        <Clock className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No shifts found</p>
                        <p className="text-sm">Get started by creating your first shift template.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {editingShift ? 'Edit Shift' : 'Create New Shift'}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Shift Name</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. Regular 9-6"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Start Time</label>
                                        <input
                                            required
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">End Time</label>
                                        <input
                                            required
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Break (Mins)</label>
                                        <input
                                            required
                                            type="number"
                                            value={breakMinutes}
                                            onChange={(e) => setBreakMinutes(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Work Hours</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.1"
                                            value={workHours}
                                            onChange={(e) => setWorkHours(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">Overnight Shift</p>
                                        <p className="text-xs text-gray-500">Crosses midnight</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isOvernight}
                                            onChange={(e) => setIsOvernight(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Lateness Grace (Mins)</label>
                                        <input
                                            required
                                            type="number"
                                            value={latenessGraceMinutes}
                                            onChange={(e) => setLatenessGraceMinutes(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Early Exit Grace (Mins)</label>
                                        <input
                                            required
                                            type="number"
                                            value={earlyExitGraceMinutes}
                                            onChange={(e) => setEarlyExitGraceMinutes(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Late Rounding Block (Mins)</label>
                                        <input
                                            required
                                            type="number"
                                            value={lateRoundingBlock}
                                            onChange={(e) => setLateRoundingBlock(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Early Rounding Block (Mins)</label>
                                        <input
                                            required
                                            type="number"
                                            value={earlyRoundingBlock}
                                            onChange={(e) => setEarlyRoundingBlock(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Offered OT 1.5x (Hrs)</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.5"
                                            value={offeredOT15}
                                            onChange={(e) => setOfferedOT15(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Offered OT 2.0x (Hrs)</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.5"
                                            value={offeredOT20}
                                            onChange={(e) => setOfferedOT20(Number(e.target.value))}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                                        />
                                    </div>
                                </div>

                                {/* --- Meal Breaks Section --- */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Meal Breaks</label>
                                        <button
                                            type="button"
                                            onClick={() => setBreaks([...breaks, { ...DEFAULT_BREAK, label: '', sort_order: breaks.length + 1 }])}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Add Break
                                        </button>
                                    </div>
                                    {breaks.length === 0 && (
                                        <p className="text-xs text-gray-400 italic ml-1">No breaks configured. Will use flat Break (Mins) value above.</p>
                                    )}
                                    {breaks.map((brk, idx) => (
                                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <input
                                                type="text"
                                                placeholder="Label"
                                                value={brk.label}
                                                onChange={(e) => {
                                                    const updated = [...breaks];
                                                    updated[idx] = { ...updated[idx], label: e.target.value };
                                                    setBreaks(updated);
                                                }}
                                                className="w-24 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            />
                                            <input
                                                type="time"
                                                value={brk.break_start}
                                                onChange={(e) => {
                                                    const updated = [...breaks];
                                                    updated[idx] = { ...updated[idx], break_start: e.target.value };
                                                    setBreaks(updated);
                                                }}
                                                className="w-28 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            />
                                            <span className="text-xs text-gray-400">to</span>
                                            <input
                                                type="time"
                                                value={brk.break_end}
                                                onChange={(e) => {
                                                    const updated = [...breaks];
                                                    updated[idx] = { ...updated[idx], break_end: e.target.value };
                                                    setBreaks(updated);
                                                }}
                                                className="w-28 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            />
                                            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={brk.is_paid}
                                                    onChange={(e) => {
                                                        const updated = [...breaks];
                                                        updated[idx] = { ...updated[idx], is_paid: e.target.checked };
                                                        setBreaks(updated);
                                                    }}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                Paid
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setBreaks(breaks.filter((_, i) => i !== idx))}
                                                className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 transition-colors ml-auto"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-[0.98]"
                                >
                                    {editingShift ? 'Update Shift Template' : 'Create Shift Template'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {shiftToDelete && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShiftToDelete(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                    <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                                </div>
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">Delete Shift?</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                                    Are you sure you want to delete the <span className="font-bold text-gray-900 dark:text-white">{shiftToDelete.name}</span> shift? <br />
                                    This will not affect historical records, but the shift will no longer be available for new assignments.
                                </p>
                                <p className="text-red-500 text-xs font-bold mt-4 uppercase tracking-wider">Historical roster entries will be preserved.</p>
                            </div>
                            <div className="px-8 pb-8 flex gap-3">
                                <button
                                    onClick={() => setShiftToDelete(null)}
                                    className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all"
                                >
                                    Delete Now
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ShiftSettings;
