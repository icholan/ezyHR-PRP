import React, { useState, useEffect } from 'react';
import { 
    Bell, 
    Check, 
    CheckCheck, 
    Filter, 
    Clock, 
    Calendar,
    AlertCircle,
    Info,
    ChevronRight,
    Search
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    sent_at: string;
}

const NotificationCentre: React.FC = () => {
    const { user } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/v1/notifications', {
                params: { only_unread: filter === 'unread' }
            });
            setNotifications(response.data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [filter, user]);

    const markAsRead = async (id: string) => {
        try {
            await api.put(`/api/v1/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/api/v1/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'DOCUMENT_EXPIRY':
            case 'DOCUMENT_EXPIRY_ADMIN':
                return <AlertCircle className="w-5 h-5 text-rose-500" />;
            default:
                return <Info className="w-5 h-5 text-indigo-500" />;
        }
    };

    const filteredNotifications = notifications.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10">
            <div className="max-w-5xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Notification Centre</h1>
                        <p className="text-slate-500">Manage all your alerts and system updates in one place.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={markAllAsRead}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
                        >
                            <CheckCheck className="w-4 h-4 text-indigo-600" />
                            Mark all as read
                        </button>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center bg-slate-100/50 rounded-xl p-1 w-full md:w-auto">
                        <button
                            onClick={() => setFilter('all')}
                            className={clsx(
                                "flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all",
                                filter === 'all' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={clsx(
                                "flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all",
                                filter === 'unread' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Unread
                            {notifications.filter(n => !n.is_read).length > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full text-[10px]">
                                    {notifications.filter(n => !n.is_read).length}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                        />
                    </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-slate-500 font-medium tracking-wide">Fetching your alerts...</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                <Bell className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">All caught up!</h3>
                            <p className="text-slate-500 max-w-xs text-center">No notifications found. Redefine your search or filter to see more.</p>
                        </div>
                    ) : (
                        filteredNotifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={clsx(
                                    "group relative p-6 rounded-3xl border transition-all duration-300",
                                    notif.is_read 
                                        ? "bg-white border-slate-100 hover:border-slate-200" 
                                        : "bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100 shadow-sm hover:shadow-md"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={clsx(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                                        notif.is_read ? "bg-slate-50 text-slate-400" : "bg-indigo-100/50 text-indigo-600"
                                    )}>
                                        {getIcon(notif.type)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className={clsx(
                                                "text-lg font-bold truncate",
                                                notif.is_read ? "text-slate-700" : "text-slate-900"
                                            )}>
                                                {notif.title}
                                            </h4>
                                            {!notif.is_read && (
                                                <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-500" />
                                            )}
                                        </div>
                                        <p className="text-slate-600 leading-relaxed mb-4">
                                            {notif.message}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {formatDate(notif.sent_at)}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(notif.sent_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!notif.is_read && (
                                            <button
                                                onClick={() => markAsRead(notif.id)}
                                                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 transition-all shadow-sm"
                                                title="Mark as read"
                                            >
                                                <Check className="w-5 h-5" />
                                            </button>
                                        )}
                                        <button className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 transition-all shadow-sm">
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationCentre;
