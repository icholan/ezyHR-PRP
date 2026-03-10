import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Wallet,
    Calendar,
    Clock,
    Settings,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    LogOut,
    FileText,
    Key,
    Building2,
    BookOpen,
    History as HistoryIcon,
    Link as LinkIcon
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

const menuGroups = [
    {
        title: 'General',
        items: [
            { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
            { icon: ShieldCheck, label: 'Audit Trail', path: '/audit', isAdmin: true },
            { icon: FileText, label: 'Reports', path: '/reports' },
        ]
    },
    {
        title: 'People & Payroll',
        items: [
            { icon: Users, label: 'Employees', path: '/employees' },
            { icon: LinkIcon, label: 'Multi-Entity Linking', path: '/employees/multi-management', isAdmin: true },
            { icon: Wallet, label: 'Payroll', path: '/payroll' },
            { icon: FileText, label: 'KET Management', path: '/ket' },
            { icon: Calendar, label: 'My Leave', path: '/leave/my' },
        ]
    },
    {
        title: 'Time & Attendance',
        items: [
            { icon: Clock, label: 'Time Clock', path: '/attendance/clock' },
            { icon: HistoryIcon, label: 'Punch History', path: '/attendance/history' },
            { icon: FileText, label: 'Attendance Logs', path: '/attendance/logs' },
            { icon: FileText, label: 'Import Timesheet', path: '/attendance/import' },
            { icon: Calendar, label: 'Roster', path: '/attendance/roster' },
            { icon: Calendar, label: 'Public Holidays', path: '/attendance/public-holidays' },
            { icon: ShieldCheck, label: 'Team Leave & Entitlement', path: '/attendance/leave/team', isAdmin: true },
        ]
    },
    {
        title: 'Configuration',
        items: [
            { icon: Settings, label: 'Users', path: '/settings/users' },
            { icon: Building2, label: 'Companies', path: '/settings/entities' },
            { icon: Key, label: 'Roles', path: '/settings/roles' },
            { icon: BookOpen, label: 'Master Data', path: '/settings/master' },
            { icon: Clock, label: 'Shifts', path: '/settings/shifts' },
        ]
    }
];

interface SidebarProps {
    onClose?: () => void;
}

const Sidebar = ({ onClose }: SidebarProps) => {
    const { logout, user } = useAuthStore();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    return (
        <aside className={clsx(
            "bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col h-screen sticky top-0 transition-all duration-300 relative",
            isCollapsed ? "w-20" : "w-72"
        )}>
            {/* Collapse Toggle - hidden on small screens */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex absolute -right-3 top-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full p-1.5 shadow-sm text-gray-400 hover:text-primary-600 z-50 transition-transform"
            >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            <div className={clsx(
                "flex items-center",
                isCollapsed ? "p-4 pt-8 justify-center" : "p-8 justify-between"
            )}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 min-w-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-200 dark:shadow-primary-900/30 flex-shrink-0">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    {!isCollapsed && (
                        <span className="font-['Outfit'] font-bold text-xl tracking-tight text-dark-900 dark:text-gray-100 whitespace-nowrap animate-in fade-in duration-300">
                            ezyHR <span className="text-primary-600 dark:text-primary-400">V2</span>
                        </span>
                    )}
                </div>
                {!isCollapsed && onClose && (
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}
            </div>

            <nav className="flex-1 px-3 space-y-6 overflow-y-auto overflow-x-hidden nice-scrollbar pb-6">
                {menuGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-1">
                        {!isCollapsed && (
                            <h3 className="px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2 mt-4 first:mt-0">
                                {group.title}
                            </h3>
                        )}
                        {group.items.filter(item => !(item as any).isAdmin || user?.is_tenant_admin).map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => clsx(
                                    "flex items-center rounded-xl font-medium transition-all duration-200 group",
                                    isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                                    isActive
                                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 shadow-sm shadow-primary-500/5"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-dark-900 dark:hover:text-gray-100"
                                )}
                                onClick={() => onClose?.()}
                                title={isCollapsed ? item.label : undefined}
                            >
                                <item.icon className={clsx(
                                    "w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                                    "group-[.active]:text-primary-600 dark:group-[.active]:text-primary-400"
                                )} />
                                {!isCollapsed && (
                                    <span className="whitespace-nowrap animate-in fade-in duration-300">
                                        {item.label}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className={clsx("mt-auto", isCollapsed ? "p-3" : "p-4")}>
                {!isCollapsed && (
                    <div className="bg-dark-950 dark:bg-gray-800 rounded-2xl p-4 text-white mb-4 relative overflow-hidden group animate-in fade-in zoom-in duration-300">
                        <div className="relative z-10">
                            <p className="text-xs text-dark-300 dark:text-gray-400 mb-1">Current Plan</p>
                            <p className="font-semibold mb-3">Enterprise Pro</p>
                            <div className="w-full bg-dark-800 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-primary-500 h-full w-3/4 rounded-full" />
                            </div>
                        </div>
                        <div className="absolute top-[-20%] right-[-20%] w-24 h-24 bg-primary-500/20 rounded-full blur-2xl group-hover:bg-primary-500/30 transition-all" />
                    </div>
                )}

                <button
                    onClick={handleLogout}
                    title={isCollapsed ? "Sign Out" : undefined}
                    className={clsx(
                        "flex items-center w-full text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all",
                        isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                    )}
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span className="font-medium whitespace-nowrap animate-in fade-in duration-300">Sign Out</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
