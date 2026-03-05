import React, { useState, useEffect } from 'react';
import {
    Clock,
    MapPin,
    Calendar,
    CheckCircle2,
    AlertCircle,
    History,
    Timer,
    ArrowUpRight,
    ArrowDownLeft
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import { clsx } from 'clsx';

const Attendance = () => {
    const { user } = useAuthStore();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<any>(null); // To store today's actual record (punch)
    const [dailySummary, setDailySummary] = useState<any>(null); // To store computed daily record
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchTodayStatus();
    }, [user?.selected_entity_id]);

    const fetchTodayStatus = async () => {
        if (!user?.selected_entity_id) return;
        const empId = "c85569f9-dad1-4973-a3b1-cba216a78a9d"; // Placeholder for demo
        try {
            // 1. Get live punch status
            const currentRes = await api.get(`/api/v1/attendance/current?employment_id=${empId}`);
            setStatus(currentRes.data);

            // 2. Get computed daily summary
            const today = new Date().toISOString().split('T')[0];
            const summaryRes = await api.get(`/api/v1/attendance/daily?entity_id=${user.selected_entity_id}&start_date=${today}&end_date=${today}`);
            if (summaryRes.data.length > 0) {
                setDailySummary(summaryRes.data[0]);
            }
        } catch (err: any) {
            console.error("Failed to fetch attendance status", err);
            if (err.response?.status === 500) {
                setError("Server Error: Unable to fetch attendance status.");
            }
        }
    };

    const handlePunch = async (type: 'in' | 'out') => {
        if (!user?.selected_entity_id) {
            setError("No entity selected");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // In a real app, we'd get geolocation here
            await api.post('/api/v1/attendance/punch', {
                entity_id: user.selected_entity_id,
                employment_id: "c85569f9-dad1-4973-a3b1-cba216a78a9d", // Placeholder mapping to seeded emp
                punch_type: type,
                timestamp: new Date().toISOString(),
                source: 'web'
            });

            // Refresh status
            await fetchTodayStatus();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Punch failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">Attendance & Time</h1>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-lg">Manage your daily clock-ins and view shift schedules.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Punch Clock Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 p-8 shadow-sm dark:shadow-gray-950/20 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 mb-6">
                            <Clock className="w-8 h-8" />
                        </div>

                        <h2 className="text-4xl font-bold text-dark-950 dark:text-gray-50 mb-2 tabular-nums font-['Outfit']">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium mb-8">
                            {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>

                        <div className="flex flex-col w-full gap-4">
                            <button
                                onClick={() => handlePunch('in')}
                                disabled={loading || !!status?.clock_in}
                                className={clsx(
                                    "flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all",
                                    status?.clock_in
                                        ? "bg-gray-100 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                                )}
                            >
                                <ArrowDownLeft className="w-5 h-5" />
                                Clock In
                            </button>

                            <button
                                onClick={() => handlePunch('out')}
                                disabled={loading || (status && !!status.clock_out) || !status}
                                className={clsx(
                                    "flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all",
                                    (status && !!status.clock_out) || !status
                                        ? "bg-gray-100 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                        : "bg-dark-950 text-white hover:bg-dark-900 shadow-lg shadow-gray-200"
                                )}
                            >
                                <ArrowUpRight className="w-5 h-5" />
                                Clock Out
                            </button>
                        </div>

                        {error && (
                            <div className="mt-6 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-medium p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl w-full">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="bg-dark-950 rounded-[32px] p-8 text-white">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white dark:bg-gray-900/10 rounded-xl flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-primary-400" />
                            </div>
                            <h3 className="font-bold">Live Location</h3>
                        </div>
                        <p className="text-dark-300 text-sm mb-4">You are clocking in from:</p>
                        <div className="p-4 bg-white dark:bg-gray-900/5 rounded-2xl border border-white/10">
                            <p className="font-medium">1 Raffles Place</p>
                            <p className="text-xs text-dark-400">Singapore 048616</p>
                        </div>
                    </div>
                </div>

                {/* Status & History */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Shift Info */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 p-8 shadow-sm dark:shadow-gray-950/20">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">Current Shift</h3>
                            <span className="px-4 py-1.5 bg-primary-50 text-primary-600 rounded-full text-xs font-bold uppercase tracking-wider">
                                Active
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                                    <Timer className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Schedule</p>
                                    <p className="font-bold text-dark-900 dark:text-gray-100">09:00 AM - 06:00 PM</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Work Hours</p>
                                    <p className="font-bold text-dark-900 dark:text-gray-100">8.0 Hours (Net)</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Today's Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20">
                            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium mb-1">Time In</p>
                            <p className="text-2xl font-bold text-dark-950 dark:text-gray-50">
                                {status?.clock_in ? new Date(status.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20">
                            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium mb-1">Time Out</p>
                            <p className="text-2xl font-bold text-dark-950 dark:text-gray-50">
                                {status?.clock_out ? new Date(status.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20">
                            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium mb-1">Overtime</p>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {dailySummary?.ot_hours_1_5x ? `${dailySummary.ot_hours_1_5x} hrs` : '0.0 hrs'}
                            </p>
                        </div>
                    </div>

                    {/* Recent History (Mocked for UI) */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm dark:shadow-gray-950/20">
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <History className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                <h3 className="font-bold text-dark-950 dark:text-gray-50">Recent History</h3>
                            </div>
                            <button className="text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors">
                                View full log
                            </button>
                        </div>
                        <div className="divide-y divide-gray-50 dark:divide-gray-800">
                            {[
                                { date: 'Yesterday', in: '09:00 AM', out: '07:30 PM', status: 'Worked', ot: '1.5 hrs' },
                                { date: '28 Feb', in: '08:55 AM', out: '06:05 PM', status: 'Worked', ot: '0.0 hrs' },
                                { date: '27 Feb', in: '09:02 AM', out: '06:00 PM', status: 'Worked', ot: '0.0 hrs' }
                            ].map((row, i) => (
                                <div key={i} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 font-bold text-xs">
                                            {row.date.slice(0, 2)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-dark-900 dark:text-gray-100">{row.date}</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">{row.status}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-12 text-right">
                                        <div>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">Clock</p>
                                            <p className="text-sm font-bold tabular-nums">{row.in} - {row.out}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">OT</p>
                                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{row.ot}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Attendance;
