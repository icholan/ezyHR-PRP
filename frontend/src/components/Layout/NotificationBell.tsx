import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Calendar, Clock, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    sent_at: string;
}

export const NotificationBell: React.FC = () => {
    const { user } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.length;

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const response = await api.get('/api/v1/notifications', {
                params: { only_unread: true }
            });
            setNotifications(response.data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Refresh every 5 minutes
        const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await api.put(`/api/v1/notifications/${id}/read`);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/api/v1/notifications/read-all');
            setNotifications([]);
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-semibold text-slate-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-height-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={clsx(
                                            "p-4 transition-colors group relative",
                                            notif.is_read ? "bg-white" : "bg-indigo-50/30"
                                        )}
                                    >
                                        <div className="flex gap-3">
                                            <div className={clsx(
                                                "mt-1 w-2 h-2 rounded-full flex-shrink-0",
                                                notif.is_read ? "bg-transparent" : "bg-indigo-500"
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className={clsx(
                                                    "text-sm font-semibold mb-1",
                                                    notif.is_read ? "text-slate-700" : "text-slate-900"
                                                )}>
                                                    {notif.title}
                                                </p>
                                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                                                    {notif.message}
                                                </p>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDate(notif.sent_at)}
                                                </div>
                                            </div>
                                            {!notif.is_read && (
                                                <button
                                                    onClick={() => markAsRead(notif.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white rounded-md transition-all shadow-sm border border-slate-100"
                                                    title="Mark as read"
                                                >
                                                    <Check className="w-3 h-3 text-indigo-600" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <Link
                        to="/notifications"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-center gap-2 p-3 bg-slate-50 text-indigo-600 hover:text-indigo-700 font-semibold text-xs border-t border-slate-100 transition-colors"
                    >
                        See All Notifications
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            )}
        </div>
    );
};
