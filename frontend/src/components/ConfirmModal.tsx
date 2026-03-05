import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    type = 'danger'
}) => {
    const colorMap = {
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20',
        warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20',
        info: 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/20'
    };

    const iconColorMap = {
        danger: 'text-red-600 bg-red-50 dark:bg-red-900/20',
        warning: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
        info: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800"
                    >
                        <div className="p-8">
                            <div className="flex items-start justify-between mb-6">
                                <div className={`p-3 rounded-2xl ${iconColorMap[type]}`}>
                                    <ExclamationTriangleIcon className="w-6 h-6" />
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-['Outfit'] mb-2">{title}</h3>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">{message}</p>

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-6 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all border border-transparent font-['Outfit']"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    className={`flex-1 px-6 py-3 text-sm font-bold rounded-2xl transition-all shadow-lg font-['Outfit'] transform hover:-translate-y-0.5 active:translate-y-0 ${colorMap[type]}`}
                                >
                                    {confirmLabel}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmModal;
