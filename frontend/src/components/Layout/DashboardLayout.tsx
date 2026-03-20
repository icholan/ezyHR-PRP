import React, { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import EntitySwitcher from '../Dashboard/EntitySwitcher';
import ThemeToggle from '../ThemeToggle';
import { Bell, Search, UserCircle, Menu, X, Building2, ChevronDown, Lock, User, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import PasswordModal from '../Shared/PasswordModal';
import { NotificationBell } from './NotificationBell';

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex min-h-screen bg-gray-50/50 dark:bg-gray-950 transition-colors duration-200">
            {/* Sidebar Overlay for Mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Hidden on mobile, shown as drawer or fixed on desktop */}
            <div className={`
                fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <Sidebar onClose={() => setIsSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 transition-colors duration-200">
                    <div className="flex items-center gap-4 sm:gap-8">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl transition-all"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        {(user?.is_tenant_admin || (user?.entity_access && user.entity_access.length > 1)) && (
                            <div className="hidden sm:block">
                                <EntitySwitcher />
                            </div>
                        )}

                        {user?.is_tenant_admin && (
                            <div className="hidden lg:flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2 w-64 xl:w-96 group border border-transparent focus-within:border-primary-300 dark:focus-within:border-primary-600 focus-within:bg-white dark:focus-within:bg-gray-900 transition-all">
                                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 group-focus-within:text-primary-500" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="bg-transparent border-none outline-none px-3 text-sm w-full placeholder:text-gray-400 dark:placeholder:text-gray-500 text-dark-900 dark:text-gray-100"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <ThemeToggle />

                        <NotificationBell />

                        {!user?.is_tenant_admin && (
                            <button 
                                className="hidden sm:flex h-10 px-4 items-center gap-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-sm font-bold hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all"
                                onClick={() => toast('Support feature coming soon!')}
                            >
                                <Building2 className="w-4 h-4" />
                                Support
                            </button>
                        )}

                        <div className="h-8 w-[1px] bg-gray-100 dark:bg-gray-800 mx-1 sm:mx-2" />

                        <div className="relative">
                            <button 
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-3 p-1 sm:p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all group"
                            >
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-bold text-dark-900 dark:text-gray-100 leading-none mb-1">
                                        {user?.display_name || user?.full_name || 'User'}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-none">
                                        {user?.entity_access?.find(a => a.entity_id === user?.selected_entity_id)?.role_name || (user?.is_tenant_admin ? 'Administrator' : 'Employee')}
                                    </p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-all overflow-hidden">
                                    {user?.avatar_url ? (
                                        <img 
                                            src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${user.avatar_url}`} 
                                            alt="U" 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <UserCircle className="w-6 h-6" />
                                    )}
                                </div>
                                <ChevronDown className={clsx("w-4 h-4 text-gray-400 transition-transform duration-200", isUserMenuOpen && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                                {isUserMenuOpen && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-0" 
                                            onClick={() => setIsUserMenuOpen(false)} 
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                            className="absolute right-0 mt-2 w-56 p-2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-gray-200/50 dark:shadow-gray-950/50 border border-gray-100 dark:border-gray-800 z-50"
                                        >
                                            <NavLink
                                                to="/profile"
                                                onClick={() => setIsUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
                                            >
                                                <User className="w-4 h-4" />
                                                My Profile
                                            </NavLink>
                                            <button
                                                onClick={() => {
                                                    setIsPasswordModalOpen(true);
                                                    setIsUserMenuOpen(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
                                            >
                                                <Lock className="w-4 h-4" />
                                                Change Password
                                            </button>
                                            <div className="h-[1px] bg-gray-100 dark:bg-gray-800 my-2 mx-2" />
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Sign Out
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                <main className="p-4 sm:p-8">
                    <Outlet />
                </main>
            </div>

            <PasswordModal 
                isOpen={isPasswordModalOpen} 
                onClose={() => setIsPasswordModalOpen(false)} 
            />
        </div>
    );
};

export default DashboardLayout;
