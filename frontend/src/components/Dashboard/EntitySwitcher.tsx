import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

interface Entity {
    id: string;
    name: string;
    is_active: boolean;
}

const EntitySwitcher = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user, setEntity } = useAuthStore();

    const selected = entities.find(e => e.id === user?.selected_entity_id) || entities[0];

    useEffect(() => {
        const fetchEntities = async () => {
            try {
                setLoading(true);
                const res = await api.get<{ id: string, name: string, is_active: boolean }[]>('/api/v1/entities');
                const activeEntities = res.data.filter(e => e.is_active);
                setEntities(activeEntities);
                if (!user?.selected_entity_id && activeEntities.length > 0) {
                    setEntity(activeEntities[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch entities for switcher", error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchEntities();
        }
    }, [user]);

    if (loading || !selected) {
        return (
            <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl">
                <div className="animate-pulse w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="space-y-2">
                    <div className="animate-pulse h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    <div className="animate-pulse h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 transition-all hover:bg-primary-50/30 dark:hover:bg-primary-900/10 group"
            >
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    <Building2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium leading-none mb-1">Working entity</p>
                    <p className="text-sm font-bold text-dark-900 dark:text-gray-100 leading-none">{selected?.name}</p>
                </div>
                <ChevronDown className={clsx(
                    "w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200",
                    isOpen && "rotate-180"
                )} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-gray-950/50 border border-gray-100 dark:border-gray-800 p-2 z-20 overflow-hidden"
                        >
                            <p className="px-3 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Switch Entity</p>
                            <div className="space-y-1">
                                {entities.map((entity) => (
                                    <button
                                        key={entity.id}
                                        onClick={() => {
                                            setEntity(entity.id);
                                            setIsOpen(false);
                                        }}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all",
                                            selected?.id === entity.id
                                                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                                                : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-dark-900 dark:hover:text-gray-100"
                                        )}
                                    >
                                        <div className="flex flex-col items-start px-1">
                                            <span className="font-semibold text-sm">{entity.name}</span>
                                        </div>
                                        {selected?.id === entity.id && <Check className="w-4 h-4" />}
                                    </button>
                                ))}
                            </div>
                            {user?.is_tenant_admin && (
                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            navigate('/settings/entities');
                                        }}
                                        className="w-full px-3 py-2 text-primary-600 dark:text-primary-400 text-sm font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl text-left transition-all"
                                    >
                                        + Add New Entity
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EntitySwitcher;
