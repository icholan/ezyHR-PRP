import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import EntitySwitcher from '../Dashboard/EntitySwitcher';
import ThemeToggle from '../ThemeToggle';
import { Bell, Search, UserCircle, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const user = useAuthStore((state) => state.user);

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
                <header className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10 transition-colors duration-200">
                    <div className="flex items-center gap-4 sm:gap-8">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl transition-all"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div className="hidden sm:block">
                            <EntitySwitcher />
                        </div>

                        <div className="hidden lg:flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2 w-64 xl:w-96 group border border-transparent focus-within:border-primary-300 dark:focus-within:border-primary-600 focus-within:bg-white dark:focus-within:bg-gray-900 transition-all">
                            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 group-focus-within:text-primary-500" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="bg-transparent border-none outline-none px-3 text-sm w-full placeholder:text-gray-400 dark:placeholder:text-gray-500 text-dark-900 dark:text-gray-100"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <ThemeToggle />

                        <button className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-all relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
                        </button>

                        <div className="h-8 w-[1px] bg-gray-100 dark:bg-gray-800 mx-1 sm:mx-2" />

                        <button className="flex items-center gap-3 p-1 sm:p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-all group">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-dark-900 dark:text-gray-100 leading-none mb-1">
                                    {user?.display_name || 'Loading...'}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 leading-none">
                                    {user?.is_tenant_admin ? 'Administrator' : 'Employee'}
                                </p>
                            </div>
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-all">
                                <UserCircle className="w-6 h-6 sm:w-7 sm:h-7" />
                            </div>
                        </button>
                    </div>
                </header>

                <main className="p-4 sm:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
