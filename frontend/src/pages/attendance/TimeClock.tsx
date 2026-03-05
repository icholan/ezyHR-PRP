import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Play, Square, History, Calendar, CheckCircle2, User, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface AttendanceRecord {
    id: string;
    work_date: string;
    clock_in: string | null;
    clock_out: string | null;
    status?: 'in' | 'out';
    source: string;
}

const TimeClock: React.FC = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [status, setStatus] = useState<'out' | 'in' | 'loading'>('loading');
    const [record, setRecord] = useState<AttendanceRecord | null>(null);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);

    const user = useAuthStore(state => state.user);
    const employmentId = user?.employment_id;
    const entityId = user?.selected_entity_id;

    // Update digital clock every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchStatus = async () => {
        if (!employmentId) {
            setStatus('out');
            return;
        }
        try {
            const res = await api.get(`/api/v1/attendance/current/${employmentId}`);
            setRecord(res.data);
            setStatus(res.data?.clock_in && !res.data?.clock_out ? 'in' : 'out');
        } catch (err) {
            setStatus('out');
        }
    };

    const fetchHistory = async () => {
        if (!entityId || !employmentId) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await api.get('/api/v1/attendance/daily-attendance', {
                params: {
                    entity_id: entityId,
                    employment_id: employmentId,
                    start_date: today,
                    end_date: today
                }
            });
            setHistory(res.data);
            // Note: DailyAttendance model might differ from raw records, 
            // but for simple history we use the list endpoint
            // In a real app, we might need a dedicated "recent punches" endpoint
        } catch (err) { }
    };

    useEffect(() => {
        fetchStatus();
        fetchHistory();
    }, [employmentId]);

    const handlePunch = async () => {
        if (!entityId || !employmentId) return;

        const punchType = status === 'in' ? 'out' : 'in';
        setStatus('loading');

        try {
            await api.post('/api/v1/attendance/punch', {
                entity_id: entityId,
                employment_id: employmentId,
                punch_type: punchType,
                timestamp: new Date().toISOString(),
                source: 'web'
            });

            toast.success(`Successfully punched ${punchType}`);
            await fetchStatus();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to record attendance');
            await fetchStatus();
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-SG', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Main Clock Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl shadow-indigo-100 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden relative"
            >
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-full -mr-32 -mt-32 blur-3xl" />

                <div className="p-10 md:p-16 relative flex flex-col items-center text-center">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase text-xs mb-8">
                        <Clock className="w-4 h-4" />
                        Current Time
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white mb-4 tabular-nums tracking-tighter">
                        {formatTime(currentTime)}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-semibold text-lg mb-12">
                        {formatDate(currentTime)}
                    </p>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-6 mb-12">
                        <div className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 ${status === 'in'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${status === 'in' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            {status === 'in' ? 'Currently Clocked In' : 'Currently Clocked Out'}
                        </div>

                        {record?.clock_in && (
                            <div className="text-sm font-bold text-gray-400">
                                Since: <span className="text-gray-900 dark:text-gray-200">{new Date(record.clock_in).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        )}
                    </div>

                    {/* Punch Button */}
                    <div className="relative">
                        {!employmentId && (
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-max px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-xl border border-amber-100 dark:border-amber-800 animate-bounce">
                                <AlertCircle className="w-3 h-3 inline mr-1" />
                                No Employment ID found for your account
                            </div>
                        )}
                        <motion.button
                            whileHover={{ scale: employmentId ? 1.05 : 1 }}
                            whileTap={{ scale: employmentId ? 0.95 : 1 }}
                            disabled={status === 'loading' || !employmentId}
                            onClick={handlePunch}
                            className={`group relative w-64 h-64 rounded-full flex flex-col items-center justify-center transition-all shadow-2xl ${status === 'in'
                                ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-200 dark:shadow-none'
                                : 'bg-gradient-to-br from-indigo-500 to-blue-600 shadow-indigo-200 dark:shadow-none'
                                } disabled:grayscale disabled:cursor-not-allowed`}
                        >
                            {/* Ring animation for In state */}
                            {status === 'in' && (
                                <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping opacity-20" />
                            )}

                            <div className="text-white">
                                {status === 'in' ? <Square className="w-16 h-16 fill-current mb-2" /> : <Play className="w-16 h-16 fill-current mb-2 ml-2" />}
                            </div>
                            <span className="text-white text-xl font-black uppercase tracking-widest">
                                {status === 'in' ? 'Punch Out' : 'Punch In'}
                            </span>

                            <div className="absolute bottom-10 flex items-center gap-1 text-[10px] text-white/60 font-bold uppercase tracking-widest">
                                <MapPin className="w-3 h-3" />
                                Office Location
                            </div>
                        </motion.button>
                    </div>
                </div>
            </motion.div>

            {/* Attendance History Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 p-8 shadow-sm"
            >
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center">
                            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wider">Today's Log</h2>
                    </div>
                </div>

                <div className="space-y-4">
                    {history.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 font-medium italic">
                            No punch history for today yet.
                        </div>
                    ) : (
                        history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                                        {(h.status === 'in' || (h.clock_in && !h.clock_out)) ? <Play className="w-5 h-5 text-green-500" /> : <Square className="w-4 h-4 text-rose-500" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-widest">{(h.status === 'in' || (h.clock_in && !h.clock_out)) ? 'Clock In' : 'Clock Out'}</p>
                                        <p className="text-gray-400 text-sm font-medium">Recorded via {h.source}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
                                        {new Date(h.clock_in || h.clock_out || '').toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase">Verification Successful</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </motion.div>

            {/* Account Info & Helpful Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 flex items-center gap-6"
                >
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center">
                        <User className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Logged in as</h3>
                        <p className="text-xl font-black text-gray-900 dark:text-white capitalize">{user?.display_name || 'Employee'}</p>
                        <p className="text-xs text-indigo-500 font-bold">Emp ID: {employmentId?.toString().substring(0, 8)}</p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-700 flex items-center gap-6"
                >
                    <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Attendance Tip</h3>
                        <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">Don't forget to clock out before you leave for your lunch break!</p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default TimeClock;
