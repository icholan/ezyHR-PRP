import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const PrivacyToggle = () => {
    const { privacyMode, togglePrivacyMode } = useAuthStore();

    return (
        <button
            onClick={togglePrivacyMode}
            className={clsx(
                "group relative flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-300 overflow-hidden",
                privacyMode 
                    ? "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/10 dark:border-rose-900/30" 
                    : "bg-white border-gray-100 text-gray-600 hover:border-primary-200 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-400"
            )}
            title={privacyMode ? "Disable Privacy Mode" : "Enable Privacy Mode"}
        >
            <div className="relative z-10 flex items-center gap-2">
                <motion.div
                    initial={false}
                    animate={{ rotate: privacyMode ? 0 : 360 }}
                    transition={{ duration: 0.5, type: 'spring' }}
                >
                    {privacyMode ? (
                        <EyeOff className="w-4 h-4" />
                    ) : (
                        <Eye className="w-4 h-4" />
                    )}
                </motion.div>
                <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                    {privacyMode ? "Privacy On" : "Privacy Off"}
                </span>
            </div>

            {/* Background Animation */}
            <motion.div
                initial={false}
                animate={{
                    opacity: privacyMode ? 1 : 0,
                    scale: privacyMode ? 1.5 : 0
                }}
                className="absolute inset-0 bg-rose-50/50 dark:bg-rose-900/20 pointer-events-none"
            />
        </button>
    );
};

export default PrivacyToggle;
