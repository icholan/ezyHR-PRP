import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Sparkles, ChevronDown, X, Edit2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface PublicHoliday {
    id: string;
    entity_id: string;
    name: string;
    holiday_date: string;
    observed_date: string | null;
    is_recurring: boolean;
    year: number;
}

const YEARS = [2025, 2026, 2027];

const PublicHolidays: React.FC = () => {
    const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
    const [selectedYear, setSelectedYear] = useState(2026);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
    const [holidayToDelete, setHolidayToDelete] = useState<PublicHoliday | null>(null);
    const [formName, setFormName] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formObserved, setFormObserved] = useState('');

    const activeEntityId = useAuthStore(state => state.user?.selected_entity_id);

    const fetchHolidays = async () => {
        if (!activeEntityId) return;
        setLoading(true);
        try {
            const res = await api.get('/api/v1/attendance/public-holidays', {
                params: { entity_id: activeEntityId, year: selectedYear }
            });
            setHolidays(res.data);
        } catch { toast.error('Failed to load holidays'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchHolidays(); }, [activeEntityId, selectedYear]);

    const handleSeed = async () => {
        if (!activeEntityId) return;
        try {
            const res = await api.post('/api/v1/attendance/public-holidays/seed', {
                entity_id: activeEntityId,
                year: selectedYear
            });
            toast.success(`Seeded ${res.data.length} holiday(s) for ${selectedYear}`);
            fetchHolidays();
        } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to seed holidays'); }
    };

    const handleAdd = async () => {
        if (!activeEntityId || !formName || !formDate) {
            toast.error('Name and date are required');
            return;
        }
        try {
            await api.post('/api/v1/attendance/public-holidays', {
                entity_id: activeEntityId,
                name: formName,
                holiday_date: formDate,
                observed_date: formObserved || null,
                is_recurring: false,
                year: selectedYear
            });
            toast.success('Holiday added');
            setShowAddModal(false);
            resetForm();
            fetchHolidays();
        } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to add holiday'); }
    };

    const handleUpdate = async () => {
        if (!editingHoliday || !formName) return;
        try {
            await api.patch(`/api/v1/attendance/public-holidays/${editingHoliday.id}`, {
                name: formName,
                holiday_date: formDate || undefined,
                observed_date: formObserved || null,
            });
            toast.success('Holiday updated');
            setEditingHoliday(null);
            resetForm();
            fetchHolidays();
        } catch (err: any) { toast.error('Failed to update'); }
    };

    const handleDelete = (holiday: PublicHoliday) => {
        setHolidayToDelete(holiday);
    };

    const confirmDelete = async () => {
        if (!holidayToDelete) return;
        try {
            await api.delete(`/api/v1/attendance/public-holidays/${holidayToDelete.id}`);
            toast.success('Holiday deleted');
            setHolidayToDelete(null);
            fetchHolidays();
        } catch { toast.error('Failed to delete'); }
    };

    const openEdit = (h: PublicHoliday) => {
        setEditingHoliday(h);
        setFormName(h.name);
        setFormDate(h.holiday_date);
        setFormObserved(h.observed_date || '');
    };

    const resetForm = () => {
        setFormName('');
        setFormDate('');
        setFormObserved('');
    };

    const getDayName = (dateStr: string) => {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'long' });
    };

    const formatDisplayDate = (dateStr: string) => {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-none">
                            <Calendar className="w-5 h-5 text-white" />
                        </div>
                        Public Holidays
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Manage gazetted public holidays for your entity</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Year Selector */}
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none dark:text-white shadow-sm"
                    >
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSeed}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-amber-200 dark:shadow-none"
                    >
                        <Sparkles className="w-4 h-4" /> Seed SG {selectedYear}
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setShowAddModal(true); resetForm(); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        <Plus className="w-4 h-4" /> Add Holiday
                    </motion.button>
                </div>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl">
                    <Calendar className="w-5 h-5 opacity-80" />
                    <div>
                        <p className="text-xl font-bold leading-none">{holidays.length}</p>
                        <p className="text-[10px] opacity-60 font-medium mt-0.5">Holidays in {selectedYear}</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <th className="text-left py-3 px-5 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">#</th>
                            <th className="text-left py-3 px-5 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Holiday</th>
                            <th className="text-left py-3 px-5 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Date</th>
                            <th className="text-left py-3 px-5 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Day</th>
                            <th className="text-left py-3 px-5 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Observed</th>
                            <th className="text-right py-3 px-5 font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
                        ) : holidays.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-12">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center">
                                        <Calendar className="w-7 h-7 text-amber-300" />
                                    </div>
                                    <div>
                                        <p className="text-gray-500 font-semibold">No holidays for {selectedYear}</p>
                                        <p className="text-gray-400 text-xs mt-1">Click "Seed SG {selectedYear}" to auto-populate gazetted holidays</p>
                                    </div>
                                </div>
                            </td></tr>
                        ) : holidays.map((h, i) => (
                            <motion.tr
                                key={h.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="border-b border-gray-50 dark:border-gray-700/40 hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors group"
                            >
                                <td className="py-3 px-5 text-gray-400 text-xs">{i + 1}</td>
                                <td className="py-3 px-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-lg flex items-center justify-center">
                                            <span className="text-sm">🎊</span>
                                        </div>
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">{h.name}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-5 text-gray-600 dark:text-gray-400 font-medium">{formatDisplayDate(h.holiday_date)}</td>
                                <td className="py-3 px-5">
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${getDayName(h.holiday_date) === 'Sunday'
                                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                        : getDayName(h.holiday_date) === 'Saturday'
                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                            : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                        }`}>
                                        {getDayName(h.holiday_date)}
                                    </span>
                                </td>
                                <td className="py-3 px-5 text-gray-500 dark:text-gray-400">
                                    {h.observed_date ? (
                                        <span className="text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-2.5 py-1 rounded-lg">
                                            {formatDisplayDate(h.observed_date)} ({getDayName(h.observed_date)})
                                        </span>
                                    ) : (
                                        <span className="text-gray-300 dark:text-gray-600">—</span>
                                    )}
                                </td>
                                <td className="py-3 px-5 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEdit(h)}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(h)}
                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        </button>
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add / Edit Modal */}
            <AnimatePresence>
                {(showAddModal || editingHoliday) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => { setShowAddModal(false); setEditingHoliday(null); }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                                <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                    {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
                                </h2>
                                <button onClick={() => { setShowAddModal(false); setEditingHoliday(null); }}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>
                            <div className="px-6 py-5 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Holiday Name</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. National Day"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={(e) => setFormDate(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:text-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Observed Date <span className="text-gray-400 normal-case">(if different)</span></label>
                                    <input
                                        type="date"
                                        value={formObserved}
                                        onChange={(e) => setFormObserved(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:text-white"
                                    />
                                    <p className="text-[10px] text-gray-400">When PH falls on Sunday, the next Monday is the observed date.</p>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={editingHoliday ? handleUpdate : handleAdd}
                                    disabled={!formName || !formDate}
                                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-200 dark:shadow-none disabled:shadow-none mt-2"
                                >
                                    {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {holidayToDelete && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setHolidayToDelete(null)}>
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
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">Delete Holiday?</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                                    Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">{holidayToDelete.name}</span>? <br />
                                    This will remove the holiday on <span className="font-bold text-gray-700 dark:text-gray-300">{formatDisplayDate(holidayToDelete.holiday_date)}</span>.
                                </p>
                                <p className="text-red-500 text-xs font-bold mt-4 uppercase tracking-wider">This action cannot be undone.</p>
                            </div>
                            <div className="px-8 pb-8 flex gap-3">
                                <button
                                    onClick={() => setHolidayToDelete(null)}
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

export default PublicHolidays;
