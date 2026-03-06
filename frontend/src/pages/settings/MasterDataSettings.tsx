import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus, Search, Building2, Award, Users, Briefcase,
    ChevronRight, Mail, Phone, MapPin, Hash,
    MoreVertical, Pencil, Trash2, X,
    LayoutGrid, List, Sliders, Info, CalendarDays, ShieldCheck, Clock, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

// Common types
interface MasterItem {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    is_active: boolean;
}

interface CustomerItem extends MasterItem {
    uen: string | null;
    billing_address: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_number: string | null;
}

interface LeaveTypeItem {
    id: string;
    name: string;
    code: string;
    is_paid: boolean;
    is_statutory: boolean;
    description: string | null;
}

const TABS = [
    { id: 'departments', label: 'Departments', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { id: 'grades', label: 'Grades', icon: Award, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { id: 'groups', label: 'Groups', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { id: 'customers', label: 'Customers', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'leave_types', label: 'Leave Types', icon: CalendarDays, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
];

const MasterDataSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('departments');
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [modalError, setModalError] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [deleteConfirmItem, setDeleteConfirmItem] = useState<any | null>(null);

    // Form state (shared)
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [uen, setUen] = useState('');
    const [billingAddress, setBillingAddress] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactNumber, setContactNumber] = useState('');

    // Leave-type specific
    const [isPaid, setIsPaid] = useState(true);
    const [isStatutory, setIsStatutory] = useState(false);

    const activeEntityId = useAuthStore(state => state.user?.selected_entity_id);

    const isLeaveTab = activeTab === 'leave_types';

    const fetchItems = async () => {
        if (!activeEntityId) return;
        setLoading(true);
        setError('');
        try {
            let response;
            if (isLeaveTab) {
                response = await api.get(`/api/v1/leave/types?entity_id=${activeEntityId}`);
            } else {
                response = await api.get(`/api/v1/masters/${activeTab}?entity_id=${activeEntityId}`);
            }
            setItems(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch items');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
        setIsModalOpen(false);
        setEditingItem(null);
        setSearchQuery('');
    }, [activeTab, activeEntityId]);

    const handleOpenModal = (item?: any) => {
        if (item) {
            setEditingItem(item);
            setName(item.name || '');
            setCode(item.code || '');
            setDescription(item.description || '');
            if (activeTab === 'customers') {
                setUen(item.uen || '');
                setBillingAddress(item.billing_address || '');
                setContactName(item.contact_name || '');
                setContactEmail(item.contact_email || '');
                setContactNumber(item.contact_number || '');
            }
            if (isLeaveTab) {
                setIsPaid(item.is_paid ?? true);
                setIsStatutory(item.is_statutory ?? false);
            }
        } else {
            setEditingItem(null);
            setName(''); setCode(''); setDescription('');
            setUen(''); setBillingAddress(''); setContactName(''); setContactEmail(''); setContactNumber('');
            setIsPaid(true); setIsStatutory(false);
        }
        setModalError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeEntityId) return;

        try {
            if (isLeaveTab) {
                const payload = { name, code, is_paid: isPaid, is_statutory: isStatutory, description: description || null };
                if (editingItem) {
                    await api.patch(`/api/v1/leave/types/${editingItem.id}?entity_id=${activeEntityId}`, payload);
                    toast.success('Leave type updated successfully');
                } else {
                    await api.post(`/api/v1/leave/types?entity_id=${activeEntityId}`, payload);
                    toast.success('Leave type created successfully');
                }
            } else {
                const payload: any = { name, code: code || null };
                payload.entity_id = activeEntityId;
                if (activeTab === 'customers') {
                    payload.uen = uen || null;
                    payload.billing_address = billingAddress || null;
                    payload.contact_name = contactName || null;
                    payload.contact_email = contactEmail || null;
                    payload.contact_number = contactNumber || null;
                } else {
                    payload.description = description || null;
                }
                if (editingItem) {
                    await api.patch(`/api/v1/masters/${activeTab}/${editingItem.id}?entity_id=${activeEntityId}`, payload);
                    toast.success('Record updated successfully');
                } else {
                    await api.post(`/api/v1/masters/${activeTab}?entity_id=${activeEntityId}`, payload);
                    toast.success('Record created successfully');
                }
            }
            setIsModalOpen(false);
            fetchItems();
        } catch (err: any) {
            setModalError(err.response?.data?.detail || 'Failed to save item');
        }
    };

    const handleDeletePrompt = (item: any) => {
        setDeleteConfirmItem(item);
    };

    const confirmDelete = async () => {
        if (!activeEntityId || !deleteConfirmItem) return;
        try {
            if (isLeaveTab) {
                await api.delete(`/api/v1/leave/types/${deleteConfirmItem.id}?entity_id=${activeEntityId}`);
            } else {
                await api.delete(`/api/v1/masters/${activeTab}/${deleteConfirmItem.id}?entity_id=${activeEntityId}`);
            }
            setDeleteConfirmItem(null);
            toast.success('Record deleted successfully');
            fetchItems();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to delete item');
            setError(err.response?.data?.detail || 'Failed to delete item');
        }
    };

    const filteredItems = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return items.filter(i =>
            (i.is_active !== false) && (
                i.name.toLowerCase().includes(q) ||
                (i.code && i.code.toLowerCase().includes(q))
            )
        );
    }, [items, searchQuery]);

    const activeTabInfo = TABS.find(t => t.id === activeTab)!;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-['Outfit'] text-dark-950 dark:text-gray-50 tracking-tight">Master Data</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium italic">Configure structural reference data for optimization.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    Add {isLeaveTab ? 'Leave Type' : activeTabInfo.label.slice(0, -1)}
                </button>
            </div>

            {/* Navigation & Controls */}
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex gap-2 p-1.5 bg-gray-100/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-[24px] border border-gray-200/50 dark:border-gray-700/50 overflow-x-auto no-scrollbar lg:min-w-max">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "relative flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold transition-all duration-300 whitespace-nowrap",
                                    isActive
                                        ? "bg-white dark:bg-gray-900 text-dark-950 dark:text-gray-50 shadow-sm ring-1 ring-gray-200/50 dark:ring-gray-700/50"
                                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800/30"
                                )}
                            >
                                <Icon className={clsx("w-4 h-4", isActive ? tab.color : "text-gray-400")} />
                                {tab.label}
                                {isActive && (
                                    <motion.div
                                        layoutId="tab-indicator"
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-600 rounded-full mb-1.5"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={`Search ${activeTabInfo.label.toLowerCase()}...`}
                            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[24px] shadow-sm focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-medium text-dark-950 dark:text-gray-50"
                        />
                    </div>
                    <div className="flex p-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[24px] shadow-sm sm:h-[58px]">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={clsx(
                                "flex-1 sm:flex-none p-3 rounded-[16px] transition-all flex justify-center",
                                viewMode === 'grid'
                                    ? "bg-gray-100 dark:bg-gray-800 text-primary-600 shadow-sm"
                                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            )}
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={clsx(
                                "flex-1 sm:flex-none p-3 rounded-[16px] transition-all flex justify-center",
                                viewMode === 'list'
                                    ? "bg-gray-100 dark:bg-gray-800 text-primary-600 shadow-sm"
                                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            )}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 animate-pulse" />
                    ))}
                </div>
            ) : error ? (
                <div className="p-12 text-center bg-rose-50 dark:bg-rose-900/10 rounded-[32px] border border-rose-100 dark:border-rose-900/30">
                    <Info className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                    <p className="text-rose-600 dark:text-rose-400 font-bold">{error}</p>
                    <button onClick={fetchItems} className="mt-4 text-sm font-bold text-rose-500 hover:underline">Retry Connection</button>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="py-24 text-center bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/5">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-gray-300">
                        <Search className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">No {activeTabInfo.label} Found</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">Try refining your search or add a new record to get started.</p>
                </div>
            ) : viewMode === 'list' ? (
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                key={item.id}
                                className="group flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-gray-900 rounded-[24px] border border-gray-100 dark:border-gray-800 p-4 shadow-sm hover:shadow-xl hover:shadow-primary-600/5 hover:-translate-y-0.5 transition-all duration-300"
                            >
                                <div className="flex items-center gap-5">
                                    <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 hidden sm:flex", activeTabInfo.bg)}>
                                        <activeTabInfo.icon className={clsx("w-6 h-6", activeTabInfo.color)} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 group-hover:text-primary-600 transition-colors tracking-tight line-clamp-1">{item.name}</h3>
                                            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0">{item.code || 'NO CODE'}</span>

                                            {isLeaveTab && (
                                                <div className="flex gap-2">
                                                    <span className={clsx(
                                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold",
                                                        item.is_paid ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                                    )}>
                                                        {item.is_paid ? 'Paid' : 'Unpaid'}
                                                    </span>
                                                    {item.is_statutory && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                                                            MOM Statutory
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {activeTab === 'customers' ? (
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {item.contact_name || 'No Contact'}</span>
                                                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> <span className="truncate max-w-[120px] sm:max-w-[200px]">{item.contact_email || 'No Email'}</span></span>
                                                <span className="flex items-center gap-1.5 truncate max-w-[150px] sm:max-w-[250px]"><MapPin className="w-3.5 h-3.5" /> {item.billing_address || 'No Address'}</span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate max-w-[250px] sm:max-w-xl">
                                                {item.description || 'No detailed description provided.'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-auto shrink-0">
                                    <button
                                        onClick={() => handleOpenModal(item)}
                                        className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeletePrompt(item)}
                                        className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={item.id}
                                className="group bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-2xl hover:shadow-primary-600/5 hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center", activeTabInfo.bg)}>
                                        <activeTabInfo.icon className={clsx("w-7 h-7", activeTabInfo.color)} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenModal(item)}
                                            className="p-3 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-2xl transition-all"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePrompt(item)}
                                            className="p-3 text-gray-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50 group-hover:text-primary-600 transition-colors uppercase tracking-tight">{item.name}</h3>
                                    <div className="flex items-center gap-2">
                                        <Hash className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{item.code || 'NO CODE'}</span>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-800 space-y-3">
                                    {isLeaveTab ? (
                                        <div className="flex gap-2 flex-wrap">
                                            <span className={clsx(
                                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold",
                                                item.is_paid ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                            )}>
                                                <CheckCircle2 className="w-3 h-3" />
                                                {item.is_paid ? 'Paid' : 'Unpaid'}
                                            </span>
                                            {item.is_statutory && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    MOM Statutory
                                                </span>
                                            )}
                                            {item.description && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                                            )}
                                        </div>
                                    ) : activeTab === 'customers' ? (
                                        <>
                                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                                <Users className="w-4 h-4 shrink-0 text-primary-500" />
                                                <span className="font-medium">{item.contact_name || 'No Contact'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                                <Mail className="w-4 h-4 shrink-0 text-primary-500" />
                                                <span className="font-medium truncate">{item.contact_email || 'No Email'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                                <MapPin className="w-4 h-4 shrink-0 text-primary-500" />
                                                <span className="font-medium line-clamp-1">{item.billing_address || 'No Address'}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium line-clamp-2 min-h-[40px]">
                                            {item.description || 'No detailed description provided for this record.'}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800"
                        >
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                                <div className="flex items-center gap-4">
                                    <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", activeTabInfo.bg)}>
                                        <activeTabInfo.icon className={clsx("w-6 h-6", activeTabInfo.color)} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">
                                            {editingItem ? 'Edit' : 'Add'} {isLeaveTab ? 'Leave Type' : activeTabInfo.label.slice(0, -1)}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-tight">System reference data configuration.</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:border-rose-100 transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-6">
                                {modalError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-2xl flex items-start gap-3 border border-rose-100 dark:border-rose-800"
                                    >
                                        <Info className="w-5 h-5 shrink-0 mt-0.5" />
                                        <p className="text-sm font-medium">{modalError}</p>
                                    </motion.div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Display Name <span className="text-rose-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="input-field py-3 text-base font-bold"
                                            placeholder={isLeaveTab ? 'e.g. Childcare Leave' : 'e.g. Engineering'}
                                        />
                                    </div>

                                    <div className="col-span-2 md:col-span-1">
                                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Reference Code <span className="text-rose-500">*</span></label>
                                        <div className="relative">
                                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                required={isLeaveTab}
                                                value={code}
                                                onChange={e => setCode(e.target.value.toUpperCase())}
                                                className="input-field pl-10 py-3 font-mono text-sm"
                                                placeholder={isLeaveTab ? 'CHILDCARE' : 'ENG-01'}
                                            />
                                        </div>
                                    </div>

                                    {isLeaveTab ? (
                                        <>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block">Options</label>
                                                <div className="space-y-3">
                                                    {/* is_paid toggle */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsPaid(p => !p)}
                                                        className={clsx(
                                                            "w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all",
                                                            isPaid
                                                                ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                                                                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle2 className={clsx("w-4 h-4", isPaid ? "text-emerald-600" : "text-gray-400")} />
                                                            <span className={clsx("text-sm font-bold", isPaid ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500")}>Paid Leave</span>
                                                        </div>
                                                        <div className={clsx("w-10 h-5 rounded-full transition-all relative", isPaid ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600")}>
                                                            <div className={clsx("w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow", isPaid ? "left-5" : "left-0.5")} />
                                                        </div>
                                                    </button>
                                                    {/* is_statutory toggle */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsStatutory(s => !s)}
                                                        className={clsx(
                                                            "w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all",
                                                            isStatutory
                                                                ? "border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800"
                                                                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <ShieldCheck className={clsx("w-4 h-4", isStatutory ? "text-purple-600" : "text-gray-400")} />
                                                            <span className={clsx("text-sm font-bold", isStatutory ? "text-purple-700 dark:text-purple-400" : "text-gray-500")}>MOM Statutory</span>
                                                        </div>
                                                        <div className={clsx("w-10 h-5 rounded-full transition-all relative", isStatutory ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-600")}>
                                                            <div className={clsx("w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow", isStatutory ? "left-5" : "left-0.5")} />
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Description (Optional)</label>
                                                <textarea
                                                    value={description}
                                                    onChange={e => setDescription(e.target.value)}
                                                    className="input-field py-3 h-24 resize-none"
                                                    placeholder="Describe applicability, accrual rules, etc."
                                                />
                                            </div>
                                        </>
                                    ) : activeTab === 'customers' ? (
                                        <>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">UEN (Registration)</label>
                                                <input type="text" value={uen} onChange={e => setUen(e.target.value)} className="input-field py-3" placeholder="202412345G" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Billing Site Address</label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-4 top-4 w-4 h-4 text-gray-400" />
                                                    <textarea value={billingAddress} onChange={e => setBillingAddress(e.target.value)} className="input-field pl-10 pt-3 h-20 resize-none" placeholder="Full corporate address..." />
                                                </div>
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Primary Contact</label>
                                                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="input-field py-3 font-bold" placeholder="Contact Name" />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Phone Line</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input type="text" value={contactNumber} onChange={e => setContactNumber(e.target.value)} className="input-field pl-10 py-3" placeholder="+65 1234 5678" />
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Corporate Email</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="input-field pl-10 py-3" placeholder="contact@customer.com" />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Operational Description</label>
                                            <textarea value={description} onChange={e => setDescription(e.target.value)} className="input-field py-3 h-28 resize-none" placeholder="Clarify the purpose or scope of this record..." />
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all border border-gray-200 dark:border-gray-700 active:scale-95"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!name || (isLeaveTab && !code)}
                                        className="px-8 py-3 text-sm font-extrabold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 rounded-2xl shadow-xl shadow-primary-200 dark:shadow-primary-900/40 transition-all active:scale-95"
                                    >
                                        {editingItem ? 'Save Changes' : 'Create Record'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Custom Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirmItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800 p-8 text-center"
                        >
                            <div className="w-20 h-20 rounded-[24px] bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="w-10 h-10 text-rose-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-dark-950 dark:text-gray-50 mb-2">Confirm Deletion</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium mb-8 leading-relaxed">
                                Are you sure you want to deactivate <strong className="text-dark-950 dark:text-gray-200">{deleteConfirmItem.name}</strong>? This action will hide it from active selections.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setDeleteConfirmItem(null)}
                                    className="flex-1 py-3.5 px-4 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-2xl transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3.5 px-4 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-2xl shadow-lg shadow-rose-200 dark:shadow-rose-900/30 transition-all active:scale-[0.98]"
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MasterDataSettings;
