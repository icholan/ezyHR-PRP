import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { PlusIcon, SparklesIcon, CheckCircleIcon, XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Entity {
    id: string;
    tenant_id: string;
    name: string;
    uen?: string;
    cpf_account_no?: string;
    iras_tax_ref?: string;
    registered_address?: string;
    gst_registered: boolean;
    gst_no?: string;
    industry_code?: string;
    payroll_cutoff_day: number;
    payment_day: number;
    work_week_hours: number;
    attendance_roster_mode: string;
    website?: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_account_name?: string;
    bank_branch_code?: string;
    bank_swift_code?: string;
    logo_url?: string;
    is_active: boolean;
    created_at: string;
}

interface AvailableLeaveType {
    code: string;
    name: string;
    is_statutory: boolean;
    category: string;
}

const EntityManagement = () => {
    const { user } = useAuthStore();
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    const [view, setView] = useState<'list' | 'form'>('list');

    // Seeding States
    const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
    const [availableLeaveTypes, setAvailableLeaveTypes] = useState<AvailableLeaveType[]>([]);
    const [selectedSeedCodes, setSelectedSeedCodes] = useState<string[]>([]);
    const [seedingEntity, setSeedingEntity] = useState<{ id: string, name: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        uen: '',
        cpf_account_no: '',
        iras_tax_ref: '',
        registered_address: '',
        gst_registered: false,
        gst_no: '',
        industry_code: '',
        payroll_cutoff_day: 25,
        payment_day: 28,
        work_week_hours: 44.0,
        attendance_roster_mode: 'manual',
        website: '',
        bank_name: '',
        bank_account_no: '',
        bank_account_name: '',
        bank_branch_code: '',
        bank_swift_code: '',
        logo_url: ''
    });

    const isTenantAdmin = user?.is_tenant_admin;

    const fetchEntities = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/v1/entities');
            setEntities(response.data);
            setError('');
        } catch (err: any) {
            setError('Failed to load entities. ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEntities();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (type === 'number') {
            setFormData(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setModalError('Logo file size should be less than 2MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, logo_url: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            uen: '',
            cpf_account_no: '',
            iras_tax_ref: '',
            registered_address: '',
            gst_registered: false,
            gst_no: '',
            industry_code: '',
            payroll_cutoff_day: 25,
            payment_day: 28,
            work_week_hours: 44.0,
            attendance_roster_mode: 'manual',
            website: '',
            bank_name: '',
            bank_account_no: '',
            bank_account_name: '',
            bank_branch_code: '',
            bank_swift_code: '',
            logo_url: ''
        });
        setEditingEntityId(null);
    };

    const openCreateForm = () => {
        resetForm();
        setModalError('');
        setView('form');
    };

    const openEditForm = (entity: Entity) => {
        setFormData({
            name: entity.name,
            uen: entity.uen || '',
            cpf_account_no: entity.cpf_account_no || '',
            iras_tax_ref: entity.iras_tax_ref || '',
            registered_address: entity.registered_address || '',
            gst_registered: entity.gst_registered,
            gst_no: entity.gst_no || '',
            industry_code: entity.industry_code || '',
            payroll_cutoff_day: entity.payroll_cutoff_day,
            payment_day: entity.payment_day,
            work_week_hours: entity.work_week_hours,
            attendance_roster_mode: entity.attendance_roster_mode || 'manual',
            website: entity.website || '',
            bank_name: entity.bank_name || '',
            bank_account_no: entity.bank_account_no || '',
            bank_account_name: entity.bank_account_name || '',
            bank_branch_code: entity.bank_branch_code || '',
            bank_swift_code: entity.bank_swift_code || '',
            logo_url: entity.logo_url || ''
        });
        setEditingEntityId(entity.id);
        setModalError('');
        setView('form');
    };

    const handleSaveEntity = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setModalError('');
            setError('');
            if (editingEntityId) {
                await api.patch(`/api/v1/entities/${editingEntityId}`, formData);
            } else {
                await api.post('/api/v1/entities', formData);
            }
            setView('list');
            resetForm();
            fetchEntities();
        } catch (err: any) {
            setModalError(err.response?.data?.detail || err.message);
        }
    };

    const handleDeleteEntity = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to deactivate ${name}? This may impact users assigned exclusively to this entity.`)) return;

        try {
            await api.delete(`/api/v1/entities/${id}`);
            fetchEntities();
        } catch (err: any) {
            setError('Failed to delete entity. ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleSeedLeaves = async (id: string, name: string) => {
        try {
            setLoading(true);
            setModalError('');
            const response = await api.get('/api/v1/leave/seed-standard/available');
            setAvailableLeaveTypes(response.data);
            setSelectedSeedCodes(response.data.map((t: any) => t.code)); // Default all selected
            setSeedingEntity({ id, name });
            setIsSeedModalOpen(true);
            setError('');
        } catch (err: any) {
            setError('Failed to fetch available leave types. ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleProceedSeeding = async () => {
        if (!seedingEntity) return;
        if (selectedSeedCodes.length === 0) {
            setModalError('Please select at least one leave type to seed.');
            return;
        }

        try {
            setLoading(true);
            setModalError('');
            const response = await api.post(`/api/v1/leave/seed-standard/${seedingEntity.id}`, {
                codes: selectedSeedCodes
            });
            alert(response.data.message);
            setIsSeedModalOpen(false);
            setSeedingEntity(null);
            setError('');
        } catch (err: any) {
            setModalError(err.response?.data?.detail || err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSeedCode = (code: string) => {
        setSelectedSeedCodes(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    if (!isTenantAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Access Denied</h2>
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Only Tenant Administrators can configure company entities.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {view === 'list' ? (
                <>
                    <div className="sm:flex sm:items-center sm:justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">Companies & Branches</h1>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                Manage the specific legal entities that make up your organization.
                            </p>
                        </div>
                        <div className="mt-4 sm:mt-0 sm:flex-none">
                            <button
                                type="button"
                                onClick={openCreateForm}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transform hover:-translate-y-0.5"
                            >
                                <PlusIcon className="w-5 h-5 stroke-2" />
                                Add Company
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-900/30">
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                            <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {entities.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                                    <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-2xl flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Companies Found</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">
                                        Get started by adding your first company or branch to manage its settings and employees.
                                    </p>
                                    <button
                                        onClick={openCreateForm}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                        Add Company
                                    </button>
                                </div>
                            ) : (
                                entities.map((entity) => (
                                    <div
                                        key={entity.id}
                                        className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300 transform hover:-translate-y-1"
                                    >
                                        <div className="p-6 relative">
                                            {/* Abstract background shape */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-100 to-transparent dark:from-primary-900/20 rounded-bl-full opacity-50 transition-opacity group-hover:opacity-100"></div>

                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                                                    {entity.logo_url ? (
                                                        <img src={entity.logo_url} alt={`${entity.name} logo`} className="w-6 h-6 object-contain" />
                                                    ) : (
                                                        <svg className="w-6 h-6 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {entity.is_active ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20 dark:ring-green-500/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-400"></span>
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/10 dark:ring-red-500/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400"></span>
                                                            Inactive
                                                        </span>
                                                    )}
                                                    {entity.gst_registered && (
                                                        <span className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-400 ring-1 ring-inset ring-purple-600/10">
                                                            GST Reg.
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 relative z-10" title={entity.name}>
                                                {entity.name}
                                            </h3>

                                            {entity.website && (
                                                <a
                                                    href={entity.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline mb-2 block relative z-10 truncate max-w-[200px]"
                                                >
                                                    {entity.website.replace(/^https?:\/\/(www\.)?/, '')}
                                                </a>
                                            )}

                                            <div className="space-y-2 mt-4 relative z-10">
                                                <div className="flex items-center text-sm">
                                                    <span className="text-gray-500 w-16 font-medium">UEN</span>
                                                    <span className="text-gray-900 dark:text-gray-300 font-mono text-xs bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded">{entity.uen || 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center text-sm">
                                                    <span className="text-gray-500 w-16 font-medium">CPF Reg</span>
                                                    <span className="text-gray-900 dark:text-gray-300 font-mono text-xs bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded">{entity.cpf_account_no || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center sm:px-6">
                                            <button
                                                onClick={() => handleSeedLeaves(entity.id, entity.name)}
                                                className="text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 text-sm font-semibold flex items-center gap-1.5 transition-colors p-1 -ml-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                title="Seed Standard Leave Types"
                                            >
                                                <SparklesIcon className="w-4 h-4" />
                                                <span>Leaves</span>
                                            </button>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => openEditForm(entity)}
                                                    className="text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 font-medium text-sm transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
                                                <button
                                                    onClick={() => handleDeleteEntity(entity.id, entity.name)}
                                                    disabled={!entity.is_active}
                                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    Deactivate
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </>
            ) : (
                <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setView('list')}
                                className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-gray-500 dark:text-gray-400"
                            >
                                <ArrowLeftIcon className="w-5 h-5 stroke-2" />
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {editingEntityId ? 'Edit Configuration' : 'Create New Company'}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Configure company details, payroll, and banking settings.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <form onSubmit={handleSaveEntity} className="p-8 space-y-10">

                            <div className="grid grid-cols-1 gap-y-10 gap-x-8 sm:grid-cols-2">
                                <div className="sm:col-span-2 relative">
                                    <div className="flex items-center gap-x-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-sm">01</div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Basic Information</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Company / Branch Name <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                name="name"
                                                required
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                                placeholder="e.g. Acme Pte Ltd"
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Business Website</label>
                                            <input
                                                type="text"
                                                name="website"
                                                value={formData.website}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                                placeholder="e.g. www.example.com"
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Company Logo</label>
                                            <div className="flex items-center gap-4">
                                                <div className="relative w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                                                    {formData.logo_url ? (
                                                        <img src={formData.logo_url} alt="Logo Preview" className="w-full h-full object-contain" />
                                                    ) : (
                                                        <PlusIcon className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        onChange={handleLogoUpload}
                                                        accept="image/*"
                                                        className="hidden"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                                                    >
                                                        {formData.logo_url ? 'Change Logo' : 'Upload Logo'}
                                                    </button>
                                                    {formData.logo_url && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                                                            className="text-[10px] font-bold text-red-500 hover:text-red-700"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="sm:col-span-2 relative">
                                    <div className="flex items-center gap-x-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-sm">02</div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tax & Registration</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Company UEN <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                name="uen"
                                                required
                                                value={formData.uen}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                                placeholder="202312345C"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CPF Submission No</label>
                                            <input
                                                type="text"
                                                name="cpf_account_no"
                                                value={formData.cpf_account_no}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                                placeholder="E.g. 202312345C-PTE-01"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">IRAS Tax Ref</label>
                                            <input
                                                type="text"
                                                name="iras_tax_ref"
                                                value={formData.iras_tax_ref}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Industry Code (SSIC)</label>
                                            <input
                                                type="text"
                                                name="industry_code"
                                                value={formData.industry_code}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Registered Address</label>
                                            <textarea
                                                name="registered_address"
                                                rows={2}
                                                value={formData.registered_address}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all resize-none"
                                            />
                                        </div>
                                        <div className="sm:col-span-2 flex items-center p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <input
                                                id="gst_registered_full"
                                                type="checkbox"
                                                name="gst_registered"
                                                checked={formData.gst_registered}
                                                onChange={handleInputChange}
                                                className="h-5 w-5 rounded-md border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <label htmlFor="gst_registered_full" className="ml-3 text-sm font-bold text-gray-700 dark:text-gray-300">GST Registered Entity</label>
                                        </div>
                                        {formData.gst_registered && (
                                            <div className="sm:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">GST Registration No</label>
                                                <input
                                                    type="text"
                                                    name="gst_no"
                                                    value={formData.gst_no}
                                                    onChange={handleInputChange}
                                                    className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="sm:col-span-2 relative">
                                    <div className="flex items-center gap-x-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">03</div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Banking & Payroll</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bank Name</label>
                                            <input
                                                type="text"
                                                name="bank_name"
                                                value={formData.bank_name}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                                placeholder="e.g. DBS Bank"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Account Number</label>
                                            <input
                                                type="text"
                                                name="bank_account_no"
                                                value={formData.bank_account_no}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Account Holder Name</label>
                                            <input
                                                type="text"
                                                name="bank_account_name"
                                                value={formData.bank_account_name}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bank/Branch Code</label>
                                            <input
                                                type="text"
                                                name="bank_branch_code"
                                                value={formData.bank_branch_code}
                                                onChange={handleInputChange}
                                                className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary-500 focus:ring-primary-500/20 p-4 transition-all"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Payroll Cutoff Day</label>
                                                <input
                                                    type="number"
                                                    name="payroll_cutoff_day"
                                                    min="1"
                                                    max="31"
                                                    value={formData.payroll_cutoff_day}
                                                    onChange={handleInputChange}
                                                    className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Payment Day</label>
                                                <input
                                                    type="number"
                                                    name="payment_day"
                                                    min="1"
                                                    max="31"
                                                    value={formData.payment_day}
                                                    onChange={handleInputChange}
                                                    className="block w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                <div className="sm:col-span-2 relative">
                                    <div className="flex items-center gap-x-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-sm">04</div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Attendance Strategy</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div
                                            onClick={() => setFormData(prev => ({ ...prev, attendance_roster_mode: 'manual' }))}
                                            className={`cursor-pointer p-6 rounded-3xl border-2 transition-all duration-300 ${formData.attendance_roster_mode === 'manual' ? 'border-primary-500 bg-primary-50/30' : 'border-gray-100 dark:border-gray-800 hover:border-primary-200'}`}
                                        >
                                            <div className="flex items-center gap-4 mb-3">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${formData.attendance_roster_mode === 'manual' ? 'bg-primary-600 text-white shadow-primary-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <span className="font-bold text-gray-900 dark:text-white text-lg">Manual Roster</span>
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">Managers assign specific shifts manually. Most precise control.</p>
                                        </div>

                                        <div
                                            onClick={() => setFormData(prev => ({ ...prev, attendance_roster_mode: 'smart_match' }))}
                                            className={`cursor-pointer p-6 rounded-3xl border-2 transition-all duration-300 ${formData.attendance_roster_mode === 'smart_match' ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-100 dark:border-gray-800 hover:border-indigo-200'}`}
                                        >
                                            <div className="flex items-center gap-4 mb-3">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${formData.attendance_roster_mode === 'smart_match' ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                </div>
                                                <span className="font-bold text-gray-900 dark:text-white text-lg">Smart-Match</span>
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">Auto-assigns shifts based on clock-in times. Low maintenance.</p>
                                        </div>
                                    </div>

                                    {modalError && (
                                        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-900/30 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-start">
                                                <XMarkIcon className="h-5 w-5 text-red-400 mr-3" />
                                                <div>
                                                    <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Submission Error</h3>
                                                    <p className="mt-1 text-sm text-red-700 dark:text-red-400">{modalError}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-10 flex items-center justify-end gap-4 border-t border-gray-100 dark:border-gray-800 mt-10">
                                        <button
                                            type="button"
                                            onClick={() => setView('list')}
                                            className="px-8 py-3 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-8 py-3 rounded-2xl shadow-lg shadow-primary-500/30 text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 transition-all focus:ring-4 focus:ring-primary-500/20 transform hover:-translate-y-0.5 disabled:opacity-50"
                                        >
                                            {loading ? 'Saving...' : (editingEntityId ? 'Save Changes' : 'Create Company')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Seed Leaves Selection Modal */}
            {
                isSeedModalOpen && seedingEntity && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSeedModalOpen(false)}></div>

                        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-800">
                            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/95 dark:bg-gray-900/95 backdrop-blur z-10 shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-orange-500 flex items-center gap-2">
                                        <SparklesIcon className="w-6 h-6 text-amber-500 stroke-2" />
                                        Seed Standard Leave Types
                                    </h3>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                                        Select the types to seed for <span className="font-bold text-gray-900 dark:text-white px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 ml-1">{seedingEntity.name}</span>
                                    </p>
                                </div>
                                <button onClick={() => setIsSeedModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 p-2 rounded-full transition-colors self-start">
                                    <XMarkIcon className="h-5 w-5 stroke-2" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                                {modalError && (
                                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-900/30 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0">
                                                <XMarkIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                                            </div>
                                            <div className="ml-3">
                                                <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Configuration Error</h3>
                                                <div className="mt-1 text-sm text-red-700 dark:text-red-400">
                                                    <p>{modalError}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {['Statutory', 'Company Benefits'].map((category) => (
                                    <div key={category} className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <h4 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest shrink-0">{category}</h4>
                                            <div className="h-px w-full bg-gray-200 dark:bg-gray-800"></div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {availableLeaveTypes.filter(t => t.category === category).map((type) => (
                                                <div
                                                    key={type.code}
                                                    onClick={() => toggleSeedCode(type.code)}
                                                    className={`
                                                relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group
                                                ${selectedSeedCodes.includes(type.code)
                                                            ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10 shadow-sm shadow-primary-500/10'
                                                            : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'}
                                            `}
                                                >
                                                    <div className="flex-1">
                                                        <p className={`text-base font-bold mb-0.5 transition-colors ${selectedSeedCodes.includes(type.code) ? 'text-primary-800 dark:text-primary-300' : 'text-gray-900 dark:text-white group-hover:text-primary-600'}`}>
                                                            {type.name}
                                                        </p>
                                                        <p className={`text-xs font-mono font-medium ${selectedSeedCodes.includes(type.code) ? 'text-primary-600/70 dark:text-primary-400/70' : 'text-gray-500 dark:text-gray-400'}`}>{type.code}</p>
                                                    </div>
                                                    <div className="shrink-0 ml-3">
                                                        {selectedSeedCodes.includes(type.code) ? (
                                                            <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center animate-in zoom-in duration-200">
                                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 group-hover:border-primary-400 transition-colors" />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="px-6 py-5 bg-gray-50/80 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 shrink-0">
                                <div className="flex gap-2 mr-auto">
                                    <button
                                        onClick={() => setSelectedSeedCodes(availableLeaveTypes.map(t => t.code))}
                                        className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-primary-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => setSelectedSeedCodes([])}
                                        className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-red-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsSeedModalOpen(false)}
                                        className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-bold shadow-sm transition-colors focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleProceedSeeding}
                                        disabled={loading || selectedSeedCodes.length === 0}
                                        className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg shadow-primary-500/30 dark:shadow-none flex items-center justify-center gap-2 transform active:scale-95 transition-all focus:ring-4 focus:ring-primary-500/20"
                                    >
                                        {loading ? 'Seeding...' : 'Proceed Seeding'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default EntityManagement;
