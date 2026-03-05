import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Users, Clock, X, Briefcase, Sun, Coffee, Star, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface RosterEntry {
    id: string;
    employment_id: string;
    entity_id: string;
    roster_date: string;
    shift_id: string | null;
    day_type: string;
    employee_name: string;
    shift_name: string | null;
}

interface Shift { id: string; name: string; }
interface Employee { id: string; full_name: string; employee_code: string; }
interface Group { id: string; name: string; }
type ViewMode = 'week' | 'month';

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getWeekDates = (baseDate: Date): Date[] => {
    const d = new Date(baseDate);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
        const dt = new Date(monday);
        dt.setDate(monday.getDate() + i);
        return dt;
    });
};

const getMonthDates = (year: number, month: number): Date[] =>
    Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1));

const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const todayStr = formatDate(new Date());

const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
    'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-cyan-500', 'bg-violet-500', 'bg-teal-500', 'bg-pink-500',
    'bg-sky-500', 'bg-orange-500'
];

const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const RosterManagement: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [weekBase, setWeekBase] = useState(new Date());
    const [monthYear, setMonthYear] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
    const [roster, setRoster] = useState<RosterEntry[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [showGenModal, setShowGenModal] = useState(false);
    const [selectedShiftId, setSelectedShiftId] = useState('');
    const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
    const [editingCell, setEditingCell] = useState<{ entry: RosterEntry; empName: string; dateStr: string } | null>(null);
    const [phDates, setPhDates] = useState<Set<string>>(new Set());
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const activeEntityId = useAuthStore(state => state.user?.selected_entity_id);

    const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase]);
    const monthDates = useMemo(() => getMonthDates(monthYear.year, monthYear.month), [monthYear]);
    const displayDates = viewMode === 'week' ? weekDates : monthDates;
    const startDate = formatDate(displayDates[0]);
    const endDate = formatDate(displayDates[displayDates.length - 1]);

    const fetchRoster = async () => {
        if (!activeEntityId) return;
        setLoading(true);
        try {
            const res = await api.get('/api/v1/attendance/roster', {
                params: { entity_id: activeEntityId, start_date: startDate, end_date: endDate }
            });
            setRoster(res.data);
        } catch { toast.error('Failed to load roster'); }
        finally { setLoading(false); }
    };

    const fetchShifts = async () => {
        if (!activeEntityId) return;
        try { const res = await api.get('/api/v1/attendance/shifts', { params: { entity_id: activeEntityId } }); setShifts(res.data); } catch { }
    };

    const fetchEmployees = async (groupId?: string) => {
        if (!activeEntityId) return;
        try {
            const params: any = { entity_id: activeEntityId };
            if (groupId) params.group_id = groupId;
            const res = await api.get('/api/v1/employees', { params });
            setEmployees(res.data);
        } catch { }
    };

    const fetchGroups = async () => {
        if (!activeEntityId) return;
        try { const res = await api.get('/api/v1/masters/groups', { params: { entity_id: activeEntityId } }); setGroups(res.data); } catch { }
    };

    const fetchPublicHolidays = async () => {
        if (!activeEntityId) return;
        try {
            const years = Array.from(new Set(displayDates.map(d => d.getFullYear())));
            const allDates = new Set<string>();
            for (const year of years) {
                const res = await api.get('/api/v1/attendance/public-holidays', {
                    params: { entity_id: activeEntityId, year }
                });
                res.data.forEach((ph: any) => allDates.add(ph.holiday_date));
            }
            setPhDates(allDates);
        } catch { }
    };

    useEffect(() => { fetchShifts(); fetchGroups(); }, [activeEntityId]);
    useEffect(() => { fetchEmployees(selectedGroupId || undefined); }, [activeEntityId, selectedGroupId]);
    useEffect(() => { fetchRoster(); fetchPublicHolidays(); }, [activeEntityId, startDate, endDate]);

    const employeeRows = useMemo(() => {
        const map: Record<string, { name: string; entries: Record<string, RosterEntry> }> = {};
        roster.forEach(r => {
            if (!map[r.employment_id]) map[r.employment_id] = { name: r.employee_name, entries: {} };
            map[r.employment_id].entries[r.roster_date] = r;
        });
        return Object.entries(map).sort((a, b) => a[1].name.localeCompare(b[1].name));
    }, [roster]);

    // Stats
    const stats = useMemo(() => {
        const total = roster.length;
        const working = roster.filter(r => r.day_type === 'normal').length;
        const rest = roster.filter(r => r.day_type === 'rest_day').length;
        const off = roster.filter(r => r.day_type === 'off_day').length;
        const ph = roster.filter(r => r.day_type === 'public_holiday').length;
        return { total, working, rest, off, ph, employees: employeeRows.length };
    }, [roster, employeeRows]);

    const navigate = (direction: -1 | 1) => {
        if (viewMode === 'week') {
            const d = new Date(weekBase);
            d.setDate(d.getDate() + direction * 7);
            setWeekBase(d);
        } else {
            const m = monthYear.month + direction;
            if (m < 0) setMonthYear({ year: monthYear.year - 1, month: 11 });
            else if (m > 11) setMonthYear({ year: monthYear.year + 1, month: 0 });
            else setMonthYear({ ...monthYear, month: m });
        }
    };

    const handleRegenerate = async () => {
        if (!activeEntityId || !selectedShiftId || selectedEmpIds.length === 0) {
            toast.error('Select a shift and at least one employee');
            return;
        }
        try {
            await api.post('/api/v1/attendance/roster/generate', {
                entity_id: activeEntityId,
                employment_ids: selectedEmpIds,
                start_date: startDate,
                end_date: endDate,
                shift_id: selectedShiftId
            });
            toast.success(`Roster regenerated for ${selectedEmpIds.length} employees!`);
            setShowGenModal(false);
            fetchRoster();
        } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed to generate'); }
    };

    const triggerClear = () => {
        if (selectedEmpIds.length === 0) {
            toast.error('Please select employees to clear');
            return;
        }
        setShowClearConfirm(true);
    };

    const confirmClear = async () => {
        try {
            await api.post('/api/v1/attendance/roster/clear', {
                entity_id: activeEntityId,
                employment_ids: selectedEmpIds,
                start_date: startDate,
                end_date: endDate
            });
            toast.success('Roster cleared successfully');
            setShowClearConfirm(false);
            fetchRoster();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to clear');
        }
    };

    const handleCellUpdate = async (rosterId: string, shiftId: string | null, dayType: string) => {
        try {
            await api.patch(`/api/v1/attendance/roster/${rosterId}`, { shift_id: shiftId, day_type: dayType });
            setEditingCell(null);
            fetchRoster();
        } catch { toast.error('Failed to update'); }
    };

    const getCellDisplay = (entry?: RosterEntry) => {
        if (!entry) return { label: '—', bg: 'bg-transparent', text: 'text-gray-300 dark:text-gray-600', ring: '' };
        if (entry.day_type === 'rest_day') return { label: 'RD', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', ring: 'ring-1 ring-red-200 dark:ring-red-800' };
        if (entry.day_type === 'off_day') return { label: 'OFF', bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400', ring: 'ring-1 ring-slate-200 dark:ring-slate-700' };
        if (entry.day_type === 'public_holiday') return { label: 'PH', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-1 ring-amber-200 dark:ring-amber-800' };
        if (entry.shift_name) {
            const abbr = entry.shift_name.substring(0, 3).toUpperCase();
            return { label: abbr, bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-400', ring: 'ring-1 ring-indigo-200 dark:ring-indigo-800' };
        }
        return { label: '—', bg: 'bg-transparent', text: 'text-gray-300', ring: '' };
    };

    const toggleEmpSelection = (empId: string) => {
        setSelectedEmpIds(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
    };

    const periodLabel = viewMode === 'week'
        ? `${weekDates[0].toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-SG', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : new Date(monthYear.year, monthYear.month).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

    const isMonthly = viewMode === 'month';

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                            <Calendar className="w-5 h-5 text-white" />
                        </div>
                        Shift Roster
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">{viewMode === 'week' ? 'Weekly' : 'Monthly'} view • {periodLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white min-w-[150px] shadow-sm"
                    >
                        <option value="">All Groups</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setShowGenModal(true); setSelectedEmpIds(employees.map(e => e.id)); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        <RefreshCw className="w-4 h-4" /> Regenerate Roster
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setSelectedEmpIds(employees.map(e => e.id)); triggerClear(); }}
                        className="flex items-center justify-center w-[44px] h-[44px] bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 rounded-xl hover:bg-red-100 transition-colors shadow-sm"
                        title="Clear Roster"
                    >
                        <Trash2 className="w-5 h-5" />
                    </motion.button>
                </div>
            </div>

            {/* ── Stats Bar ── */}
            <div className="grid grid-cols-5 gap-3">
                {[
                    { icon: Users, label: 'Employees', value: stats.employees, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400' },
                    { icon: Briefcase, label: 'Working', value: stats.working, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' },
                    { icon: Coffee, label: 'Rest Days', value: stats.rest, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' },
                    { icon: Sun, label: 'Off Days', value: stats.off, color: 'text-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-slate-300' },
                    { icon: Star, label: 'Public Holidays', value: stats.ph, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' },
                ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${color} transition-all`}>
                        <Icon className="w-5 h-5 opacity-80" />
                        <div>
                            <p className="text-lg font-bold leading-none">{value}</p>
                            <p className="text-[10px] opacity-60 font-medium mt-0.5">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── View Toggle + Navigation ── */}
            <div className="flex items-center justify-between">
                <div className="flex bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1 gap-0.5">
                    {(['week', 'month'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all uppercase tracking-wide ${viewMode === mode
                                ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <ChevronLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <span className="text-base font-bold text-gray-800 dark:text-white min-w-[220px] text-center">{periodLabel}</span>
                    <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="w-[140px]" />
            </div>

            {/* ── Calendar Grid ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left py-3 px-4 font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap w-48 sticky left-0 bg-gray-50 dark:bg-gray-800/90 z-10 border-b border-r border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Employee</div>
                                </th>
                                {displayDates.map((d, i) => {
                                    const dow = d.getDay();
                                    const isSun = dow === 0;
                                    const isSat = dow === 6;
                                    const isToday = formatDate(d) === todayStr;
                                    const isPH = phDates.has(formatDate(d));
                                    const dayLabel = SHORT_DAYS[dow === 0 ? 6 : dow - 1];
                                    return (
                                        <th key={i} className={`text-center py-2 px-0.5 whitespace-nowrap border-b border-gray-100 dark:border-gray-700
                                            ${isMonthly ? 'min-w-[44px]' : 'min-w-[76px]'}
                                            ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/20' : isPH ? 'bg-amber-50/80 dark:bg-amber-900/20' : isSat || isSun ? 'bg-gray-50/70 dark:bg-gray-700/30' : 'bg-gray-50/30 dark:bg-gray-800/50'}
                                        `}>
                                            <div className={`text-[9px] font-bold uppercase tracking-wider ${isSun ? 'text-red-400' : isSat ? 'text-amber-400' : 'text-gray-400'}`}>
                                                {dayLabel}
                                            </div>
                                            <div className={`${isMonthly ? 'text-xs' : 'text-sm'} font-bold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : isSun ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                                                {d.getDate()}
                                            </div>
                                            {isToday && <div className="w-1 h-1 bg-indigo-500 rounded-full mx-auto mt-0.5" />}
                                            {isPH && <div className="w-1 h-1 bg-amber-500 rounded-full mx-auto mt-0.5" />}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={displayDates.length + 1} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                        <span className="text-gray-400 text-sm">Loading roster...</span>
                                    </div>
                                </td></tr>
                            ) : employeeRows.length === 0 ? (
                                <tr><td colSpan={displayDates.length + 1} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center">
                                            <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                                        </div>
                                        <div>
                                            <p className="text-gray-500 dark:text-gray-400 font-semibold">No roster data</p>
                                            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Click "Auto-Generate" to create a roster for this period</p>
                                        </div>
                                    </div>
                                </td></tr>
                            ) : employeeRows.map(([empId, data], rowIdx) => (
                                <tr key={empId} className="group border-b border-gray-50 dark:border-gray-700/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                                    <td className="py-2 px-4 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-100 dark:border-gray-700 group-hover:bg-indigo-50/30 dark:group-hover:bg-indigo-900/10 transition-colors">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-7 h-7 ${getAvatarColor(data.name)} rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-sm flex-shrink-0`}>
                                                {getInitials(data.name)}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[140px]">{data.name}</span>
                                        </div>
                                    </td>
                                    {displayDates.map((d, i) => {
                                        const dateStr = formatDate(d);
                                        const entry = data.entries[dateStr];
                                        const cell = getCellDisplay(entry);
                                        const isToday = dateStr === todayStr;
                                        const isPH = phDates.has(dateStr);
                                        const dow = d.getDay();
                                        const isWeekend = dow === 0 || dow === 6;

                                        return (
                                            <td key={i} className={`py-1 px-0.5 text-center relative ${isToday ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : isPH ? 'bg-amber-50/40 dark:bg-amber-900/10' : isWeekend ? 'bg-gray-50/40 dark:bg-gray-700/10' : ''}`}>
                                                <button
                                                    onClick={() => entry ? setEditingCell({ entry, empName: data.name, dateStr }) : null}
                                                    className={`inline-flex items-center justify-center ${isMonthly ? 'w-8 h-6 text-[9px]' : 'w-12 h-7 text-[11px]'} rounded-md font-bold transition-all cursor-pointer hover:shadow-md hover:scale-105 ${cell.bg} ${cell.text} ${cell.ring}`}
                                                    title={entry?.shift_name || entry?.day_type || 'Not assigned'}
                                                >
                                                    {cell.label}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Legend ── */}
            <div className="flex items-center gap-2 px-1 flex-wrap">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mr-1">Legend</span>
                {shifts.slice(0, 6).map(s => (
                    <span key={s.id} className="px-2 py-1 text-[9px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md ring-1 ring-indigo-200 dark:ring-indigo-800">
                        {s.name.substring(0, 3).toUpperCase()} = {s.name}
                    </span>
                ))}
                <span className="px-2 py-1 text-[9px] font-bold bg-red-50 text-red-600 rounded-md ring-1 ring-red-200">RD</span>
                <span className="px-2 py-1 text-[9px] font-bold bg-slate-50 text-slate-500 rounded-md ring-1 ring-slate-200">OFF</span>
                <span className="px-2 py-1 text-[9px] font-bold bg-amber-50 text-amber-600 rounded-md ring-1 ring-amber-200">PH</span>
            </div>

            {/* ── Edit Cell Modal ── */}
            <AnimatePresence>
                {editingCell && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditingCell(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 ${getAvatarColor(editingCell.empName)} rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                                            {getInitials(editingCell.empName)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">{editingCell.empName}</h3>
                                            <p className="text-[11px] text-gray-400">
                                                {new Date(editingCell.dateStr + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setEditingCell(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                        <X className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                                {/* Current Assignment */}
                                <div className="mt-3 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Current: </span>
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        {editingCell.entry.day_type === 'rest_day' ? '🔴 Rest Day'
                                            : editingCell.entry.day_type === 'off_day' ? '⚪ Off Day'
                                                : editingCell.entry.day_type === 'public_holiday' ? '🟠 Public Holiday'
                                                    : editingCell.entry.shift_name ? `🕐 ${editingCell.entry.shift_name}` : '— None'}
                                    </span>
                                </div>
                            </div>

                            {/* Shift Options */}
                            <div className="px-6 py-4 space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Assign Shift</p>
                                <div className="grid grid-cols-1 gap-1">
                                    {shifts.map(s => {
                                        const isActive = editingCell.entry.shift_id === s.id && editingCell.entry.day_type === 'normal';
                                        return (
                                            <button key={s.id} onClick={() => handleCellUpdate(editingCell.entry.id, s.id, 'normal')}
                                                className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all flex items-center gap-3 ${isActive
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-700'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                                                    }`}>
                                                <Clock className={`w-4 h-4 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`} />
                                                <span className="font-medium">{s.name}</span>
                                                {isActive && <span className="ml-auto text-[10px] font-bold text-indigo-500">ACTIVE</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Day Type Options */}
                            <div className="px-6 pb-6 space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Or Set Day Type</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'rest_day', label: 'Rest Day', emoji: '🔴', bg: 'bg-red-50 dark:bg-red-900/20', ring: 'ring-red-300 dark:ring-red-700', activeText: 'text-red-700 dark:text-red-400' },
                                        { value: 'off_day', label: 'Off Day', emoji: '⚪', bg: 'bg-slate-50 dark:bg-slate-800', ring: 'ring-slate-300 dark:ring-slate-600', activeText: 'text-slate-700 dark:text-slate-300' },
                                        { value: 'public_holiday', label: 'PH', emoji: '🟠', bg: 'bg-amber-50 dark:bg-amber-900/20', ring: 'ring-amber-300 dark:ring-amber-700', activeText: 'text-amber-700 dark:text-amber-400' },
                                    ].map(dt => {
                                        const isActive = editingCell.entry.day_type === dt.value;
                                        return (
                                            <button key={dt.value} onClick={() => handleCellUpdate(editingCell.entry.id, null, dt.value)}
                                                className={`flex flex-col items-center gap-1 py-3 rounded-xl transition-all text-center ${isActive
                                                    ? `${dt.bg} ring-1 ${dt.ring} ${dt.activeText}`
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                <span className="text-lg">{dt.emoji}</span>
                                                <span className="text-[10px] font-bold">{dt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Auto-Generate Modal ── */}
            <AnimatePresence>
                {showGenModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowGenModal(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-8 pt-7 pb-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Regenerate Roster</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">{periodLabel}</p>
                                </div>
                                <button onClick={() => setShowGenModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                            <div className="px-8 pb-8 space-y-5 overflow-y-auto flex-1">
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                        💡 Rest days & off days are auto-assigned from each employee's employment record. Working days get the selected shift.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Default Shift</label>
                                    <select
                                        value={selectedShiftId}
                                        onChange={(e) => setSelectedShiftId(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white text-sm"
                                    >
                                        <option value="">Select a shift...</option>
                                        {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Employees <span className="text-indigo-500 normal-case">({selectedEmpIds.length}/{employees.length})</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedEmpIds(selectedEmpIds.length === employees.length ? [] : employees.map(e => e.id))}
                                            className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold uppercase tracking-wider"
                                        >
                                            {selectedEmpIds.length === employees.length ? 'Clear' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="max-h-52 overflow-y-auto space-y-0.5 bg-gray-50 dark:bg-gray-900 rounded-xl p-2 border border-gray-200 dark:border-gray-700">
                                        {employees.map(emp => (
                                            <label key={emp.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmpIds.includes(emp.id)}
                                                    onChange={() => toggleEmpSelection(emp.id)}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                                />
                                                <div className={`w-6 h-6 ${getAvatarColor(emp.full_name)} rounded-md flex items-center justify-center text-white text-[8px] font-bold`}>
                                                    {getInitials(emp.full_name)}
                                                </div>
                                                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{emp.full_name}</span>
                                                {emp.employee_code && (
                                                    <span className="text-[10px] text-gray-400 ml-auto font-mono">{emp.employee_code}</span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleRegenerate}
                                    disabled={!selectedShiftId || selectedEmpIds.length === 0}
                                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:shadow-none"
                                >
                                    Regenerate for {selectedEmpIds.length} Employee{selectedEmpIds.length !== 1 ? 's' : ''}
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* ── Custom Clear Confirmation Dialog ── */}
            <AnimatePresence>
                {showClearConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowClearConfirm(false)}>
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
                                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">Clear Roster?</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                                    This will delete the roster for <span className="font-bold text-gray-900 dark:text-white">{selectedEmpIds.length} employees</span> from <br />
                                    <span className="font-bold text-gray-700 dark:text-gray-300">{startDate}</span> to <span className="font-bold text-gray-700 dark:text-gray-300">{endDate}</span>.
                                </p>
                                <p className="text-red-500 text-xs font-bold mt-4 uppercase tracking-wider">This action cannot be undone.</p>
                            </div>
                            <div className="px-8 pb-8 flex gap-3">
                                <button
                                    onClick={() => setShowClearConfirm(false)}
                                    className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmClear}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all"
                                >
                                    Clear Now
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RosterManagement;
