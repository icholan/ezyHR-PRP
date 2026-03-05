import React from 'react';
import { Outlet } from 'react-router-dom';
import { Search, Bell, Globe2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import AdminSidebar from './AdminSidebar';
import ThemeToggle from '../ThemeToggle';

const AdminLayout = () => {
    const user = useAuthStore(state => state.user);
    return (
        <div className="flex min-h-screen bg-gray-50/50 dark:bg-gray-950 transition-colors duration-200">
            <AdminSidebar />

            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-8 flex items-center justify-between sticky top-0 z-10 transition-colors duration-200">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 px-4 py-2 bg-dark-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                            <Globe2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            <span className="text-sm font-bold text-dark-900 dark:text-gray-100 leading-none">Region: ap-southeast-1</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2 w-72 focus-within:bg-white dark:focus-within:bg-gray-900 border border-transparent focus-within:border-primary-300 dark:focus-within:border-primary-600 transition-all group">
                            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 group-focus-within:text-primary-500" />
                            <input
                                type="text"
                                placeholder="Search tenants or events..."
                                className="bg-transparent border-none outline-none px-3 text-sm w-full text-dark-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                        </div>

                        <ThemeToggle />

                        <button className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-all relative">
                            <Bell className="w-5 h-5" />
                        </button>

                        <div className="h-8 w-[1px] bg-gray-100 dark:bg-gray-800 mx-2" />

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-dark-900 dark:bg-gray-700 flex items-center justify-center text-white font-bold uppercase">
                                {user?.email?.charAt(0) || 'A'}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
