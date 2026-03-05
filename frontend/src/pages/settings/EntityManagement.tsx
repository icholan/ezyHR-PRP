import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { PlusIcon } from '@heroicons/react/24/outline';

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
    is_active: boolean;
    created_at: string;
}

const EntityManagement = () => {
    const { user } = useAuthStore();
    const [entities, setEntities] = useState<Entity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);

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
        attendance_roster_mode: 'manual'
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
            attendance_roster_mode: 'manual'
        });
        setEditingEntityId(null);
    };

    const openCreateModal = () => {
        resetForm();
        setIsMultiModalOpen(true);
    };

    const openEditModal = (entity: Entity) => {
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
            attendance_roster_mode: entity.attendance_roster_mode || 'manual'
        });
        setEditingEntityId(entity.id);
        setIsMultiModalOpen(true);
    };

    const handleSaveEntity = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError('');
            if (editingEntityId) {
                await api.patch(`/api/v1/entities/${editingEntityId}`, formData);
            } else {
                await api.post('/api/v1/entities', formData);
            }
            setIsMultiModalOpen(false);
            resetForm();
            fetchEntities();
        } catch (err: any) {
            setError('Failed to save entity. ' + (err.response?.data?.detail || err.message));
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
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Companies & Branches</h1>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        Manage the specific legal entities that make up your organization.
                    </p>
                </div>
                <div className="mt-4 sm:flex-none">
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm dark:shadow-gray-950/20"
                    >
                        <PlusIcon className="w-5 h-5" />
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
                <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-900 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6">
                                    Entity Name
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    UEN
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    CPF Reg No
                                </th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Status
                                </th>
                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                            {entities.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="whitespace-nowrap py-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                                        No entities found.
                                    </td>
                                </tr>
                            ) : (
                                entities.map((entity) => (
                                    <tr key={entity.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800">
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-6">
                                            {entity.name}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                                            {entity.uen || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                                            {entity.cpf_account_no || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                            {entity.is_active ? (
                                                <span className="inline-flex rounded-full bg-green-100 dark:bg-green-900/20 px-2 text-xs font-semibold leading-5 text-green-800 dark:text-green-400">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800 dark:text-red-300">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-3">
                                            <button
                                                onClick={() => openEditModal(entity)}
                                                className="text-primary-600 hover:text-primary-900 dark:text-primary-200 font-semibold"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEntity(entity.id, entity.name)}
                                                className="text-red-600 dark:text-red-400 hover:text-red-900 font-semibold disabled:opacity-50"
                                                disabled={!entity.is_active}
                                            >
                                                Deactivate
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Entity Add/Edit Modal */}
            {isMultiModalOpen && (
                <div className="fixed inset-0 bg-gray-50 dark:bg-gray-8000 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {editingEntityId ? 'Edit Company Configuration' : 'Add New Company'}
                            </h3>
                            <button
                                onClick={() => setIsMultiModalOpen(false)}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveEntity} className="px-6 py-4 space-y-6">

                            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company / Branch Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:shadow-gray-950/20 focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                        placeholder="e.g. Acme Pte Ltd"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="uen" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company UEN</label>
                                    <input
                                        type="text"
                                        id="uen"
                                        name="uen"
                                        value={formData.uen}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:shadow-gray-950/20 focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                        placeholder="202312345C"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="cpf_account_no" className="block text-sm font-medium text-gray-700 dark:text-gray-300">CPF Account / E-Submission No</label>
                                    <input
                                        type="text"
                                        id="cpf_account_no"
                                        name="cpf_account_no"
                                        value={formData.cpf_account_no}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:shadow-gray-950/20 focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                        placeholder="E.g. 202312345C-PTE-01"
                                    />
                                </div>

                                <div className="sm:col-span-2 border-t border-gray-200 dark:border-gray-700 my-2 pt-4">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Tax & Corporate Configuration</h4>
                                </div>

                                <div>
                                    <label htmlFor="iras_tax_ref" className="block text-sm font-medium text-gray-700 dark:text-gray-300">IRAS Tax Reference</label>
                                    <input
                                        type="text"
                                        id="iras_tax_ref"
                                        name="iras_tax_ref"
                                        value={formData.iras_tax_ref}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:shadow-gray-950/20 focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="industry_code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">SSIC Industry Code</label>
                                    <input
                                        type="text"
                                        id="industry_code"
                                        name="industry_code"
                                        value={formData.industry_code}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:shadow-gray-950/20 focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="registered_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Registered Address</label>
                                    <textarea
                                        id="registered_address"
                                        name="registered_address"
                                        rows={2}
                                        value={formData.registered_address}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:shadow-gray-950/20 focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                    />
                                </div>

                                <div className="flex items-center space-x-3 sm:col-span-2">
                                    <input
                                        type="checkbox"
                                        id="gst_registered"
                                        name="gst_registered"
                                        checked={formData.gst_registered}
                                        onChange={handleInputChange}
                                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                    />
                                    <label htmlFor="gst_registered" className="text-sm text-gray-700 dark:text-gray-300 font-medium">GST Registered Entity</label>
                                </div>

                                {formData.gst_registered && (
                                    <div className="sm:col-span-2">
                                        <label htmlFor="gst_no" className="block text-sm font-medium text-gray-700 dark:text-gray-300">GST Registration Number</label>
                                        <input
                                            type="text"
                                            id="gst_no"
                                            name="gst_no"
                                            value={formData.gst_no}
                                            onChange={handleInputChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm dark:shadow-gray-950/20 focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                        />
                                    </div>
                                )}

                                <div className="sm:col-span-2 border-t border-gray-200 dark:border-gray-700 my-2 pt-4">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Payroll & Work Configuration</h4>
                                </div>

                                <div>
                                    <label htmlFor="payroll_cutoff_day" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payroll Cutoff Day</label>
                                    <input
                                        type="number"
                                        id="payroll_cutoff_day"
                                        name="payroll_cutoff_day"
                                        min="1"
                                        max="31"
                                        value={formData.payroll_cutoff_day}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                        title="Day of the month when payroll calculates cycle ends"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="payment_day" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Default Payment Day</label>
                                    <input
                                        type="number"
                                        id="payment_day"
                                        name="payment_day"
                                        min="1"
                                        max="31"
                                        value={formData.payment_day}
                                        onChange={handleInputChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border"
                                    />
                                </div>

                                <div className="sm:col-span-2 border-t border-gray-200 dark:border-gray-700 my-2 pt-4">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Attendance Strategy</h4>
                                    <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest font-black">Choose how shifts are assigned to employees</p>
                                </div>

                                <div className="sm:col-span-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div
                                            onClick={() => setFormData(prev => ({ ...prev, attendance_roster_mode: 'manual' }))}
                                            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.attendance_roster_mode === 'manual' ? 'border-primary-500 bg-primary-50/10' : 'border-gray-100 dark:border-gray-800'}`}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.attendance_roster_mode === 'manual' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <span className={`text-sm font-black uppercase tracking-wider ${formData.attendance_roster_mode === 'manual' ? 'text-primary-600' : 'text-gray-500'}`}>Manual Roster</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-relaxed font-bold">Manager must assign specific shifts in the roster weekly. Most precise control.</p>
                                        </div>

                                        <div
                                            onClick={() => setFormData(prev => ({ ...prev, attendance_roster_mode: 'smart_match' }))}
                                            className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.attendance_roster_mode === 'smart_match' ? 'border-indigo-500 bg-indigo-50/10' : 'border-gray-100 dark:border-gray-800'}`}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.attendance_roster_mode === 'smart_match' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                </div>
                                                <span className={`text-sm font-black uppercase tracking-wider ${formData.attendance_roster_mode === 'smart_match' ? 'text-indigo-600' : 'text-gray-500'}`}>Smart-Match</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-relaxed font-bold">Auto-select shift based on punch time. Zero manual effort for HR. Great for flexible staffing.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setIsMultiModalOpen(false)}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                >
                                    {editingEntityId ? 'Save Changes' : 'Create Company'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntityManagement;
