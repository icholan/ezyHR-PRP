import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({
    message,
    type,
    isVisible,
    onClose,
    duration = 3000
}) => {
    useEffect(() => {
        if (isVisible && duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onClose]);

    const typeConfig = {
        success: {
            icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
            bgColor: 'bg-green-50 dark:bg-green-900/20',
            borderColor: 'border-green-100 dark:border-green-900/30',
            textColor: 'text-green-800 dark:text-green-400'
        },
        error: {
            icon: <XCircleIcon className="w-5 h-5 text-red-500" />,
            bgColor: 'bg-red-50 dark:bg-red-900/20',
            borderColor: 'border-red-100 dark:border-red-900/30',
            textColor: 'text-red-800 dark:text-red-400'
        },
        info: {
            icon: <InformationCircleIcon className="w-5 h-5 text-primary-500" />,
            bgColor: 'bg-primary-50 dark:bg-primary-900/20',
            borderColor: 'border-primary-100 dark:border-primary-900/30',
            textColor: 'text-primary-800 dark:text-primary-400'
        }
    };

    const config = typeConfig[type];

    return (
        <div className="fixed top-6 right-6 z-[200] pointer-events-none">
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, x: 100, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        className={`pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl border ${config.bgColor} ${config.borderColor} shadow-2xl min-w-[320px] max-w-md`}
                    >
                        <div className="flex-shrink-0">
                            {config.icon}
                        </div>
                        <p className={`text-sm font-bold font-['Outfit'] flex-1 ${config.textColor}`}>
                            {message}
                        </p>
                        <button
                            onClick={onClose}
                            className={`p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${config.textColor}`}
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Toast;
