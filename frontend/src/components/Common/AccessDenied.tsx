import React from 'react';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
    title?: string;
    message?: string;
    showHomeButton?: boolean;
}

const AccessDenied: React.FC<AccessDeniedProps> = ({ 
    title = "Access Restricted", 
    message = "You don't have the necessary capabilities to access this module. Please contact your system administrator if you believe this is an error.",
    showHomeButton = true
}) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full scale-150" />
                <div className="relative w-24 h-24 bg-white dark:bg-gray-900 rounded-[32px] border border-rose-100 dark:border-rose-900/30 shadow-2xl flex items-center justify-center text-rose-500">
                    <ShieldAlert className="w-12 h-12" />
                </div>
            </div>

            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">
                {title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-10">
                {message}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-8 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Go Back
                </button>
                {showHomeButton && (
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 active:scale-95"
                    >
                        <Home className="w-5 h-5" />
                        Return to Dashboard
                    </button>
                )}
            </div>
        </div>
    );
};

export default AccessDenied;
