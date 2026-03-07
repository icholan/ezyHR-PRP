import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    BarChart3,
    Globe,
    Settings,
    Activity,
    Database,
    ShieldAlert,
    Users,
    CreditCard,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Scale,
    ShieldCheck,
    PieChart
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const adminMenuItems = [
    { icon: BarChart3, label: 'Global Stats', path: '/admin/stats' },
    { icon: Globe, label: 'Tenants', path: '/admin/tenants' },
    { icon: Scale, label: 'Statutory Rules', path: '/admin/statutory-rules' },
    { icon: ShieldCheck, label: 'CPF Rates', path: '/admin/cpf-rates' },
    { icon: PieChart, label: 'CPF Allocations', path: '/admin/cpf-allocations' },
    { icon: Users, label: 'SHG Rates', path: '/admin/shg-rates' },
    { icon: Activity, label: 'SDL Rates', path: '/admin/sdl-rates' },
    { icon: CreditCard, label: 'Subscriptions', path: '/admin/billing' },
    { icon: Database, label: 'Infrastructure', path: '/admin/infra' },
    { icon: ShieldAlert, label: 'Security Logs', path: '/admin/security' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
];

const AdminSidebar = () => {
    const { logout } = useAuthStore();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    return (
        <aside className={clsx(
            "bg-dark-950 text-white flex flex-col h-screen sticky top-0 transition-all duration-300 relative",
            isCollapsed ? "w-20" : "w-72"
        )}>
            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex absolute -right-3 top-8 bg-dark-800 border-none rounded-full p-1.5 shadow-sm text-gray-400 hover:text-primary-400 z-50 transition-transform ring-4 ring-dark-950"
            >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            <div className={clsx(
                "flex items-center gap-3 border-b border-white/5",
                isCollapsed ? "p-4 pt-8 justify-center border-b-0" : "p-8"
            )}>
                <div className="w-10 h-10 min-w-10 bg-white rounded-xl flex items-center justify-center text-dark-950 shadow-lg flex-shrink-0">
                    <Activity className="w-6 h-6" />
                </div>
                {!isCollapsed && (
                    <div className="flex flex-col leading-none overflow-hidden animate-in fade-in duration-300">
                        <span className="font-['Outfit'] font-bold text-xl tracking-tight whitespace-nowrap">Platform</span>
                        <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest mt-1 whitespace-nowrap">Operator Admin</span>
                    </div>
                )}
            </div>

            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden nice-scrollbar">
                {adminMenuItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => clsx(
                            "flex items-center rounded-xl font-medium transition-all duration-200 group",
                            isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                            isActive
                                ? "bg-white/10 text-white"
                                : "text-white/50 hover:bg-white/5 hover:text-white"
                        )}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <item.icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                        {!isCollapsed && <span className="whitespace-nowrap animate-in fade-in duration-300">{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className={clsx("mt-auto border-t border-white/5", isCollapsed ? "p-3" : "p-4")}>
                {!isCollapsed && (
                    <div className="p-4 bg-white/5 rounded-2xl mb-4 animate-in fade-in zoom-in duration-300 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">System Health</span>
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] flex-shrink-0" />
                        </div>
                        <p className="text-xs font-medium text-white/80 whitespace-nowrap">All services operational</p>
                    </div>
                )}

                <button
                    onClick={handleLogout}
                    title={isCollapsed ? "Exit Admin" : undefined}
                    className={clsx(
                        "flex items-center w-full text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all",
                        isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
                    )}
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span className="font-medium whitespace-nowrap animate-in fade-in duration-300">Exit Admin</span>}
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
