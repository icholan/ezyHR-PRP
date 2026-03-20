import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ChevronLeft, Edit3, Save, X, UserX, User, Briefcase,
    CreditCard, Mail, Phone, MapPin, Calendar, Building2,
    DollarSign, Shield, Clock, BadgeCheck, XCircle, AlertTriangle,
    Plus, Trash2, Layers, Send
} from 'lucide-react';
import api from '../services/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import SearchableSelect from '../components/Common/SearchableSelect';
import DatePicker from '../components/DatePicker';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission } from '../utils/permissions';
import { Permission } from '../types/permissions';


interface PersonDetail {
    id: string;
    full_name: string;
    nric_fin_last_4: string | null;
    nationality: string | null;
    race: string | null;
    religion: string | null;
    date_of_birth: string | null;
    gender: string | null;
    contact_number: string | null;
    mobile_number: string | null;
    whatsapp_number: string | null;
    personal_email: string | null;
    highest_education: string | null;
    language: string | null;
    pr_start_date: string | null;
    work_pass_start: string | null;
    address: string | null;
}

interface EmploymentDetail {
    id: string;
    entity_id: string;
    employee_code: string | null;
    employment_type: string;
    job_title: string | null;
    designation: string | null;
    department_id: string | null;
    department_name: string | null;
    grade_id: string | null;
    group_id: string | null;
    citizenship_type: string;
    pr_year: number | null;
    work_pass_type: string | null;
    work_pass_no: string | null;
    work_pass_expiry: string | null;
    foreign_worker_levy: number;
    join_date: string;
    resign_date: string | null;
    cessation_date: string | null;
    probation_end_date: string | null;
    working_days_per_week: number | null;
    rest_day: string | null;
    work_hours_per_day: number | null;
    normal_work_hours_per_week: number | null;
    basic_salary: number;
    payment_mode: string;
    is_ot_eligible: boolean;
    is_active: boolean;
}

interface BankDetail {
    id: string;
    bank_name: string;
    account_name: string;
    account_number_masked: string;
    is_default: boolean;
}

interface YTDDetail {
    year: number;
    ytd_ow: number;
    ytd_aw: number;
    ytd_cpf_ee: number;
    ytd_cpf_er: number;
    last_updated_period: string | null;
}

interface SalaryComponent {
    id?: string;
    component: string;
    amount: number;
    category: string;
    is_taxable: boolean;
    is_cpf_liable: boolean;
    effective_date: string;
    end_date?: string | null;
}

interface PersonDocument {
    id?: string;
    document_type: string;
    document_number: string;
    expiry_date: string;
    issue_date?: string | null;
    issuing_country?: string | null;
    remarks?: string | null;
    is_active: boolean;
}

interface EmployeeData {
    person: PersonDetail;
    employment: EmploymentDetail;
    bank_account: BankDetail | null;
    salary_components: SalaryComponent[];
    documents: PersonDocument[];
}

type TabId = 'overview' | 'employment' | 'financial' | 'leave' | 'documents';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'financial', label: 'Financial', icon: CreditCard },
    { id: 'leave', label: 'Leave Balances', icon: Calendar },
    { id: 'documents', label: 'Documents', icon: Shield },
];


const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    contract: 'Contract',
    director: 'Director',
    intern: 'Intern',
};

const REST_DAY_OPTIONS = [
    { value: 'Monday', label: 'Monday' },
    { value: 'Tuesday', label: 'Tuesday' },
    { value: 'Wednesday', label: 'Wednesday' },
    { value: 'Thursday', label: 'Thursday' },
    { value: 'Friday', label: 'Friday' },
    { value: 'Saturday', label: 'Saturday' },
    { value: 'Sunday', label: 'Sunday' },
];

const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
};

const EmployeeProfile = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();


    const [data, setData] = useState<EmployeeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [showYtdModal, setShowYtdModal] = useState(false);
    const [selectedYtd, setSelectedYtd] = useState<YTDDetail | null>(null);
    const [submittingYtd, setSubmittingYtd] = useState(false);

    // Invite State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [invitePassword, setInvitePassword] = useState<string | null>(null);

    // Editable copies
    const [editPerson, setEditPerson] = useState<Partial<PersonDetail>>({});
    const [editEmployment, setEditEmployment] = useState<Partial<EmploymentDetail>>({});
    const [editSalaryComponents, setEditSalaryComponents] = useState<SalaryComponent[]>([]);
    const [editDocuments, setEditDocuments] = useState<PersonDocument[]>([]);

    // Master data
    const [departments, setDepartments] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);

    // YTD Data
    const [ytdData, setYtdData] = useState<YTDDetail[]>([]);
    const [loadingYtd, setLoadingYtd] = useState(false);

    useEffect(() => {
        if (data?.employment?.entity_id) {
            const fetchMasters = async () => {
                try {
                    const [deptsRes, gradesRes, groupsRes] = await Promise.all([
                        api.get('/api/v1/masters/departments', { params: { entity_id: data.employment.entity_id } }),
                        api.get('/api/v1/masters/grades', { params: { entity_id: data.employment.entity_id } }),
                        api.get('/api/v1/masters/groups', { params: { entity_id: data.employment.entity_id } })
                    ]);
                    setDepartments(deptsRes.data || []);
                    setGrades(gradesRes.data || []);
                    setGroups(groupsRes.data || []);
                } catch (error) {
                    console.error('Error fetching master data:', error);
                }
            };
            fetchMasters();
        }
    }, [data?.employment?.entity_id]);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const resp = await api.get(`/api/v1/employees/${id}`);
                setData(resp.data);
            } catch (err) {
                console.error('Failed to fetch employee', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id]);

    const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
    const [loadingLeave, setLoadingLeave] = useState(false);

    useEffect(() => {
        if (activeTab === 'leave' && data?.employment?.id) {
            const fetchBalances = async () => {
                setLoadingLeave(true);
                try {
                    const resp = await api.get(`/api/v1/leave/balances?employment_id=${data.employment.id}`);
                    setLeaveBalances(resp.data);
                } catch (err) {
                    console.error('Failed to fetch leave balances', err);
                } finally {
                    setLoadingLeave(false);
                }
            };
            fetchBalances();
        }
    }, [activeTab, data?.employment?.id]);

    useEffect(() => {
        if (activeTab === 'financial' && data?.person?.id) {
            const fetchYTD = async () => {
                setLoadingYtd(true);
                try {
                    const resp = await api.get(`/api/v1/payroll/ytd/${data.person.id}`);
                    setYtdData(resp.data);
                } catch (err) {
                    console.error('Failed to fetch YTD data', err);
                } finally {
                    setLoadingYtd(false);
                }
            };
            fetchYTD();
        }
    }, [activeTab, data?.person?.id]);

    const enterEditMode = () => {
        if (!data) return;
        setEditPerson({ ...data.person });
        setEditEmployment({ ...data.employment });
        setEditSalaryComponents([...(data.salary_components || [])]);
        setEditDocuments([...(data.documents || [])]);
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setEditPerson({});
        setEditEmployment({});
        setEditSalaryComponents([]);
        setEditDocuments([]);
    };

    const DOCUMENT_TYPES = [
        'NRIC', 'FIN', 'Passport', 'S Pass', 'Employement Pass', 'Driving Licence', 'Others'
    ];

    const renderDocumentsTab = () => {
        const docs = editing ? editDocuments : data?.documents || [];

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Employee Documents</h2>
                        <p className="text-sm text-gray-400 dark:text-gray-500">Track and manage employee identification and work documents.</p>
                    </div>
                    {editing && (
                        <button
                            onClick={() => setEditDocuments([...editDocuments, { 
                                document_type: 'NRIC', 
                                document_number: '', 
                                expiry_date: new Date().toISOString().split('T')[0], 
                                is_active: true 
                            }])}
                            className="btn btn-secondary flex items-center gap-2"
                        >
                            <Plus size={18} />
                            Add Document
                        </button>
                    )}
                </div>

                <div className="grid gap-4">
                    {docs.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                            <Shield className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 text-lg">No documents added yet</p>
                            {editing && (
                                <p className="text-sm text-gray-400 mt-1">Click "Add Document" to start tracking</p>
                            )}
                        </div>
                    ) : (
                        docs.map((doc, idx) => {
                            const isExpired = new Date(doc.expiry_date) < new Date();
                            const isExpiringSoon = !isExpired && new Date(doc.expiry_date).getTime() < (Date.now() + 30 * 24 * 60 * 60 * 1000);

                            return (
                                <div key={idx} className={clsx(
                                    "p-5 rounded-2xl border transition-all duration-300",
                                    isExpired ? "bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/30" :
                                    isExpiringSoon ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30" :
                                    "bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800"
                                )}>
                                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-end">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Document Type</label>
                                            {editing ? (
                                                <select
                                                    value={doc.document_type}
                                                    onChange={(e) => {
                                                        const newDocs = [...editDocuments];
                                                        newDocs[idx].document_type = e.target.value;
                                                        setEditDocuments(newDocs);
                                                    }}
                                                    className="input-field"
                                                >
                                                    {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            ) : (
                                                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 min-h-[48px] border border-gray-100 dark:border-gray-700/50">
                                                    <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{doc.document_type}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 md:col-span-1">
                                            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Document Number</label>
                                            {editing ? (
                                                <input
                                                    type="text"
                                                    value={doc.document_number}
                                                    onChange={(e) => {
                                                        const newDocs = [...editDocuments];
                                                        newDocs[idx].document_number = e.target.value;
                                                        setEditDocuments(newDocs);
                                                    }}
                                                    className="input-field"
                                                    placeholder="Enter number"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 min-h-[48px] border border-gray-100 dark:border-gray-700/50">
                                                    <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{doc.document_number}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Expiry Date</label>
                                            {editing ? (
                                                <input
                                                    type="date"
                                                    value={doc.expiry_date}
                                                    onChange={(e) => {
                                                        const newDocs = [...editDocuments];
                                                        newDocs[idx].expiry_date = e.target.value;
                                                        setEditDocuments(newDocs);
                                                    }}
                                                    className="input-field"
                                                />
                                            ) : (
                                                <div className={clsx(
                                                    "flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 min-h-[48px] border",
                                                    isExpired ? "border-red-200 dark:border-red-900/50" : 
                                                    isExpiringSoon ? "border-amber-200 dark:border-amber-900/50" : 
                                                    "border-gray-100 dark:border-gray-700/50"
                                                )}>
                                                    <Calendar size={16} className={clsx(
                                                        isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-gray-400"
                                                    )} />
                                                    <span className={clsx(
                                                        "text-sm font-medium",
                                                        isExpired ? "text-red-600 dark:text-red-400" : 
                                                        isExpiringSoon ? "text-amber-600 dark:text-amber-400" : 
                                                        "text-dark-950 dark:text-gray-100"
                                                    )}>{doc.expiry_date}</span>
                                                    {isExpired && (
                                                        <span className="ml-auto text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full uppercase tracking-wider border border-red-200 dark:border-red-800/50">
                                                            Expired
                                                        </span>
                                                    )}
                                                    {isExpiringSoon && (
                                                        <span className="ml-auto text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 dark:border-amber-800/50">
                                                            Expiring
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2 lg:col-span-1">
                                            <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Issuing Country</label>
                                            {editing ? (
                                                <input
                                                    type="text"
                                                    value={doc.issuing_country || ''}
                                                    onChange={(e) => {
                                                        const newDocs = [...editDocuments];
                                                        newDocs[idx].issuing_country = e.target.value;
                                                        setEditDocuments(newDocs);
                                                    }}
                                                    className="input-field"
                                                    placeholder="e.g. Singapore"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-3 min-h-[48px] border border-gray-100 dark:border-gray-700/50">
                                                    <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{doc.issuing_country || '—'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {editing && (
                                            <button
                                                onClick={() => {
                                                    const newDocs = [...editDocuments];
                                                    newDocs.splice(idx, 1);
                                                    setEditDocuments(newDocs);
                                                }}
                                                className="p-3 text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="mt-6">
                                        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Remarks</label>
                                        {editing ? (
                                            <textarea
                                                value={doc.remarks || ''}
                                                onChange={(e) => {
                                                    const newDocs = [...editDocuments];
                                                    newDocs[idx].remarks = e.target.value;
                                                    setEditDocuments(newDocs);
                                                }}
                                                rows={1}
                                                className="input-field py-3 min-h-[48px] resize-none"
                                                placeholder="Add additional notes..."
                                            />
                                        ) : (
                                            <div className="bg-white/50 dark:bg-gray-800/20 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700/50">
                                                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                                    {doc.remarks || 'No remarks provided.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    const handleSave = async () => {
        if (!data) return;
        setSaving(true);
        try {
            const payload: any = {};

            // Helper to sanitize value: convert empty string to null
            const sanitizeValue = (val: any) => {
                if (typeof val === 'string' && val.trim() === '') return null;
                return val;
            };

            // Only send changed person fields
            const personChanges: any = {};
            for (const key of Object.keys(editPerson) as (keyof PersonDetail)[]) {
                if (key === 'id' || key === 'nric_fin_last_4') continue;
                if (editPerson[key] !== (data.person as any)[key]) {
                    personChanges[key] = sanitizeValue(editPerson[key]);
                }
            }
            if (Object.keys(personChanges).length > 0) {
                payload.person = personChanges;
            }

            // Only send changed employment fields
            // Only send changed employment fields
            const empChanges: any = {};
            for (const key of Object.keys(editEmployment) as (keyof EmploymentDetail)[]) {
                if (key === 'id' || key === 'department_name') continue;
                if (editEmployment[key] !== (data.employment as any)[key]) {
                    empChanges[key] = sanitizeValue(editEmployment[key]);
                }
            }
            if (Object.keys(empChanges).length > 0) {
                payload.employment = empChanges;
            }

            // Salary components are synced as a whole if changed
            // For simplicity, we send them if we are in edit mode
            payload.salary_components = editSalaryComponents.map(sc => ({
                component: sc.component,
                amount: sc.amount,
                category: sc.category,
                is_taxable: sc.is_taxable,
                is_cpf_liable: sc.is_cpf_liable,
                effective_date: sc.effective_date,
                end_date: sc.end_date
            }));

            payload.documents = editDocuments.map(doc => ({
                document_type: doc.document_type,
                document_number: doc.document_number,
                expiry_date: doc.expiry_date,
                issue_date: doc.issue_date,
                issuing_country: doc.issuing_country,
                remarks: doc.remarks,
                is_active: doc.is_active
            }));

            const resp = await api.put(`/api/v1/employees/${id}`, payload);
            setData(resp.data);
            setEditing(false);
            toast.success('Changes saved successfully');
        } catch (err: any) {
            console.error('Failed to update employee', err);
            const msg = err.response?.data?.detail || 'Error saving changes. Please try again.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async () => {
        setDeactivating(true);
        try {
            await api.delete(`/api/v1/employees/${id}`);
            // Refresh data
            const resp = await api.get(`/api/v1/employees/${id}`);
            setData(resp.data);
            setShowDeactivateModal(false);
        } catch (err) {
            console.error('Failed to deactivate employee', err);
            alert('Error deactivating employee.');
        } finally {
            setDeactivating(false);
        }
    };

    const handleInvite = async () => {
        if (!data?.person?.id) return;
        setInviting(true);
        setInvitePassword(null);
        try {
            const resp = await api.post('/api/v1/employees/invite', { person_id: data.person.id });
            setInvitePassword(resp.data.temporary_password);
            toast.success('Employee invited successfully!');
        } catch (err: any) {
            console.error('Failed to invite employee', err);
            toast.error(err.response?.data?.detail || 'Failed to invite employee.');
        } finally {
            setInviting(false);
        }
    };

    // Helper for editable fields
    const fieldValue = (section: 'person' | 'employment', key: string) => {
        if (editing) {
            const src = section === 'person' ? editPerson : editEmployment;
            return (src as any)[key] ?? '';
        }
        if (!data) return '';
        return (data[section] as any)[key] ?? '';
    };

    const updateField = (section: 'person' | 'employment', key: string, value: any) => {
        if (section === 'person') {
            setEditPerson(prev => {
                const updated = { ...prev, [key]: value };
                // Sync citizenship_type when nationality changes
                if (key === 'nationality') {
                    let citizenship = 'foreigner';
                    if (value === 'Singapore Citizen') citizenship = 'citizen';
                    else if (value === 'SPR') citizenship = 'pr';
                    setEditEmployment(e => ({ ...e, citizenship_type: citizenship }));
                }
                return updated;
            });
        } else {
            setEditEmployment(prev => ({ ...prev, [key]: value }));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-primary-200 dark:border-primary-900 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <p className="text-lg font-semibold">Employee not found</p>
                <button onClick={() => navigate('/employees')} className="mt-4 text-primary-600 hover:underline">
                    Back to Employees
                </button>
            </div>
        );
    }

    const { person, employment, bank_account } = data;
    const initials = person.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            {/* Back + Actions Bar */}
            {/* Back + Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button
                    onClick={() => navigate('/employees')}
                    className="text-gray-500 dark:text-gray-400 hover:text-dark-950 dark:hover:text-gray-100 font-medium flex items-center gap-1 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back to Employees
                </button>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    {editing ? (
                        <>
                            <button
                                onClick={cancelEdit}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all text-sm"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 sm:flex-none btn btn-primary flex items-center justify-center gap-2 py-2.5 px-6 shadow-lg shadow-primary-200 dark:shadow-primary-900/30 text-sm"
                            >
                                {saving ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save
                            </button>
                        </>
                    ) : (
                        <>
                            {employment.is_active && hasPermission(user, Permission.DELETE_EMPLOYEES, employment.entity_id) && (
                                <button
                                    onClick={() => setShowDeactivateModal(true)}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800 transition-all text-sm"
                                >
                                    <UserX className="w-4 h-4" />
                                    Deactivate
                                </button>
                            )}
                            {employment.is_active && hasPermission(user, Permission.EDIT_EMPLOYEES, employment.entity_id) && (
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold font-premium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 transition-all text-sm"
                                >
                                    <Send className="w-4 h-4" />
                                    Invite to Portal
                                </button>
                            )}
                            {hasPermission(user, Permission.EDIT_EMPLOYEES, employment.entity_id) && (
                                <button
                                    onClick={enterEditMode}
                                    className="flex-1 sm:flex-none btn btn-primary flex items-center justify-center gap-2 py-2.5 px-6 shadow-lg shadow-primary-200 dark:shadow-primary-900/30 text-sm"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    Edit
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Profile Header Card */}
            <div className="bg-white dark:bg-gray-900 rounded-[24px] sm:rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
                    <div className="w-20 h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-primary-200 dark:shadow-primary-900/40 shrink-0">
                        {initials}
                    </div>
                    <div className="flex-1">
                        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                            <h1 className="text-2xl sm:text-3xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">
                                {person.full_name}
                            </h1>
                            <span className={clsx(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                                employment.is_active
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                    : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                            )}>
                                {employment.is_active ? <BadgeCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                {employment.is_active ? 'Active' : 'Terminated'}
                            </span>
                        </div>
                        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-2 sm:mt-1">
                            {employment.job_title || 'No Title'} · {employment.employee_code || 'No Code'}
                        </p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    {[
                        { label: 'Department', value: employment.department_name || 'Unassigned', icon: Building2 },
                        { label: 'Join Date', value: formatDate(employment.join_date), icon: Calendar },
                        { label: 'Employment', value: EMPLOYMENT_TYPE_LABELS[employment.employment_type] || employment.employment_type, icon: Briefcase },
                    ].map((stat, i) => (
                        <div key={i} className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 flex items-center gap-3 border border-transparent dark:border-gray-800">
                            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">{stat.label}</p>
                                <p className="text-sm font-bold text-dark-950 dark:text-gray-100 truncate">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 sm:gap-2 bg-white dark:bg-gray-800/50 p-1.5 sm:p-2 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto scrollbar-none">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={clsx(
                            "flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0",
                            activeTab === tab.id
                                ? "bg-primary-600 text-white shadow-lg shadow-primary-200 dark:shadow-primary-900/30"
                                : "text-gray-500 hover:text-dark-950 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white dark:bg-gray-900 rounded-[24px] sm:rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/10 dark:shadow-gray-900/50 p-6 sm:p-10">
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Personal Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field label="Full Name" icon={User} value={fieldValue('person', 'full_name')} editing={editing} onChange={v => updateField('person', 'full_name', v)} />
                            <Field label="NRIC/FIN (masked)" value={person.nric_fin_last_4 || '****'} editing={false} disabled />
                            <Field label="Personal Email" icon={Mail} value={fieldValue('person', 'personal_email')} editing={editing} onChange={v => updateField('person', 'personal_email', v)} />
                            <Field label="Contact Number" icon={Phone} value={fieldValue('person', 'contact_number')} editing={editing} onChange={v => updateField('person', 'contact_number', v)} />
                            <Field label="Mobile Number" icon={Phone} value={fieldValue('person', 'mobile_number')} editing={editing} onChange={v => updateField('person', 'mobile_number', v)} />
                            <Field label="WhatsApp Number" icon={Phone} value={fieldValue('person', 'whatsapp_number')} editing={editing} onChange={v => updateField('person', 'whatsapp_number', v)} />
                            <Field label="Date of Birth" icon={Calendar} value={editing ? fieldValue('person', 'date_of_birth') : formatDate(person.date_of_birth)} editing={editing} type="date" onChange={v => updateField('person', 'date_of_birth', v)} />
                            <SelectField label="Gender" value={fieldValue('person', 'gender')} editing={editing} onChange={v => updateField('person', 'gender', v)} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Nationality</label>
                                {editing ? (
                                    <SearchableSelect
                                        options={[
                                            { id: 'Singapore Citizen', label: 'Singapore Citizen' },
                                            { id: 'SPR', label: 'SPR (Permanent Resident)' },
                                            { id: 'Foreigner', label: 'Foreigner' }
                                        ]}
                                        value={fieldValue('person', 'nationality')}
                                        onChange={v => updateField('person', 'nationality', v)}
                                        placeholder="Select Nationality"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                                        <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{person.nationality || '—'}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Race</label>
                                {editing ? (
                                    <SearchableSelect
                                        options={[
                                            { id: 'Chinese', label: 'Chinese' },
                                            { id: 'Malay', label: 'Malay' },
                                            { id: 'Indian', label: 'Indian' },
                                            { id: 'Eurasian', label: 'Eurasian' },
                                            { id: 'Others', label: 'Others' }
                                        ]}
                                        value={fieldValue('person', 'race')}
                                        onChange={v => updateField('person', 'race', v)}
                                        placeholder="Select Race"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                                        <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{person.race || '—'}</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Highest Education</label>
                                {editing ? (
                                    <SearchableSelect
                                        options={[
                                            { id: '', label: 'Select Education Level' },
                                            { id: 'Below Secondary', label: 'Below Secondary' },
                                            { id: 'Secondary', label: 'Secondary' },
                                            { id: 'Post Secondary (Non-Tertiary)', label: 'Post Secondary (Non-Tertiary)' },
                                            { id: 'Diploma', label: 'Diploma' },
                                            { id: 'Professional Qualification', label: 'Professional Qualification' },
                                            { id: "Bachelor's Degree", label: "Bachelor's Degree" },
                                            { id: 'Postgraduate Diploma', label: 'Postgraduate Diploma' },
                                            { id: "Master's Degree", label: "Master's Degree" },
                                            { id: 'Doctorate', label: 'Doctorate' }
                                        ]}
                                        value={fieldValue('person', 'highest_education')}
                                        onChange={v => updateField('person', 'highest_education', v)}
                                        placeholder="Select Education Level"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                                        <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{person.highest_education || '—'}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Language</label>
                                {editing ? (
                                    <SearchableSelect
                                        options={[
                                            { id: '', label: 'Select Language' },
                                            { id: 'English', label: 'English' },
                                            { id: 'Mandarin', label: 'Mandarin' },
                                            { id: 'Malay', label: 'Malay' },
                                            { id: 'Tamil', label: 'Tamil' },
                                            { id: 'Others', label: 'Others' }
                                        ]}
                                        value={fieldValue('person', 'language')}
                                        onChange={v => updateField('person', 'language', v)}
                                        placeholder="Select Language"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                                        <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{person.language || '—'}</span>
                                    </div>
                                )}
                            </div>
                            {person.nationality === 'SPR' && (
                                <Field label="PR Start Date" icon={Calendar} value={editing ? fieldValue('person', 'pr_start_date') : formatDate(person.pr_start_date)} editing={editing} type="date" onChange={v => updateField('person', 'pr_start_date', v)} />
                            )}
                        </div>
                        <div>
                            <Field label="Address" icon={MapPin} value={fieldValue('person', 'address')} editing={editing} multiline onChange={v => updateField('person', 'address', v)} />
                        </div>

                        <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 pt-4">Emergency Contact</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field label="Emergency Contact Name" icon={User} value={fieldValue('person', 'emergency_contact_name')} editing={editing} onChange={v => updateField('person', 'emergency_contact_name', v)} />
                            <Field label="Relationship" value={fieldValue('person', 'emergency_contact_relationship')} editing={editing} onChange={v => updateField('person', 'emergency_contact_relationship', v)} />
                            <Field label="Emergency Contact Number" icon={Phone} value={fieldValue('person', 'emergency_contact_number')} editing={editing} onChange={v => updateField('person', 'emergency_contact_number', v)} />
                        </div>
                    </div>
                )}

                {activeTab === 'employment' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Employment Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field label="Employee Code" value={fieldValue('employment', 'employee_code')} editing={editing} onChange={v => updateField('employment', 'employee_code', v)} />
                            <Field label="Job Title" icon={Briefcase} value={fieldValue('employment', 'job_title')} editing={editing} onChange={v => updateField('employment', 'job_title', v)} />
                            <Field label="Designation" value={fieldValue('employment', 'designation')} editing={editing} onChange={v => updateField('employment', 'designation', v)} />

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Department</label>
                                {editing ? (
                                    <SearchableSelect
                                        options={[
                                            { id: '', label: 'Select Department' },
                                            ...departments.map(d => ({ id: d.id, label: d.name }))
                                        ]}
                                        value={fieldValue('employment', 'department_id')}
                                        onChange={v => updateField('employment', 'department_id', v)}
                                        placeholder="Select Department"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                                        <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{employment.department_name || '—'}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Employment Group</label>
                                {editing ? (
                                    <SearchableSelect
                                        options={[
                                            { id: '', label: 'Select Group' },
                                            ...groups.map(g => ({ id: g.id, label: g.name }))
                                        ]}
                                        value={fieldValue('employment', 'group_id')}
                                        onChange={v => updateField('employment', 'group_id', v)}
                                        placeholder="Select Group"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                                        <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{groups.find(g => g.id === employment.group_id)?.name || '—'}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Grade</label>
                                {editing ? (
                                    <SearchableSelect
                                        options={[
                                            { id: '', label: 'Select Grade' },
                                            ...grades.map(g => ({ id: g.id, label: g.name }))
                                        ]}
                                        value={fieldValue('employment', 'grade_id')}
                                        onChange={v => updateField('employment', 'grade_id', v)}
                                        placeholder="Select Grade"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                                        <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{grades.find(g => g.id === employment.grade_id)?.name || '—'}</span>
                                    </div>
                                )}
                            </div>

                            <SelectField label="Employment Type" value={fieldValue('employment', 'employment_type')} editing={editing} onChange={v => updateField('employment', 'employment_type', v)} options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                            <Field label="Join Date" icon={Calendar} value={editing ? fieldValue('employment', 'join_date') : formatDate(employment.join_date)} editing={editing} type="date" onChange={v => updateField('employment', 'join_date', v)} />
                            <Field label="Resign Date" icon={Calendar} value={editing ? (fieldValue('employment', 'resign_date') || '') : formatDate(employment.resign_date)} editing={editing} type="date" onChange={v => updateField('employment', 'resign_date', v)} />
                            <Field label="Cessation Date" icon={Calendar} value={editing ? (fieldValue('employment', 'cessation_date') || '') : formatDate(employment.cessation_date)} editing={editing} type="date" onChange={v => updateField('employment', 'cessation_date', v)} />
                            <Field label="Probation End" icon={Clock} value={editing ? (fieldValue('employment', 'probation_end_date') || '') : formatDate(employment.probation_end_date)} editing={editing} type="date" onChange={v => updateField('employment', 'probation_end_date', v)} />


                            <div className="flex items-center gap-3 pt-6">
                                <input
                                    type="checkbox"
                                    id="ot-eligible"
                                    className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                    checked={editing ? !!editEmployment.is_ot_eligible : employment.is_ot_eligible}
                                    disabled={!editing}
                                    onChange={e => updateField('employment', 'is_ot_eligible', e.target.checked)}
                                />
                                <label htmlFor="ot-eligible" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Eligible for Overtime (Part IV EA)
                                </label>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 pt-4">Work Schedule</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field label="Working Days Per Week" value={fieldValue('employment', 'working_days_per_week')} editing={editing} type="number" onChange={v => updateField('employment', 'working_days_per_week', parseFloat(v))} />
                            <SelectField label="Rest Day" value={fieldValue('employment', 'rest_day')} editing={editing} options={REST_DAY_OPTIONS} onChange={v => updateField('employment', 'rest_day', v)} />
                            <Field label="Work Hours Per Day" value={fieldValue('employment', 'work_hours_per_day')} editing={editing} type="number" onChange={v => updateField('employment', 'work_hours_per_day', parseFloat(v))} />
                            <Field label="Normal Work Hours Per Week" value={fieldValue('employment', 'normal_work_hours_per_week')} editing={editing} type="number" onChange={v => updateField('employment', 'normal_work_hours_per_week', parseFloat(v))} />
                        </div>

                        {(editing ? editPerson.nationality === 'Foreigner' : person.nationality === 'Foreigner') && (
                            <>
                                <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 pt-4">Work Pass & Levy</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Work Pass Type</label>
                                        {editing ? (
                                            <SearchableSelect
                                                options={[
                                                    { id: '', label: 'Select Work Pass Type' },
                                                    { id: 'Employment Pass', label: 'Employment Pass' },
                                                    { id: 'S Pass', label: 'S Pass' },
                                                    { id: 'Work Permit', label: 'Work Permit' },
                                                    { id: 'Dependent Pass (with LOC)', label: 'Dependent Pass (with LOC)' },
                                                    { id: 'Others', label: 'Others' }
                                                ]}
                                                value={fieldValue('employment', 'work_pass_type')}
                                                onChange={v => updateField('employment', 'work_pass_type', v)}
                                                placeholder="Select Type"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                                                <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{employment.work_pass_type || '—'}</span>
                                            </div>
                                        )}
                                    </div>
                                    <Field label="Work Pass No" value={fieldValue('employment', 'work_pass_no')} editing={editing} onChange={v => updateField('employment', 'work_pass_no', v)} />
                                    <Field label="Work Pass Start Date" icon={Calendar} value={editing ? (fieldValue('person', 'work_pass_start') || '') : formatDate(person.work_pass_start)} editing={editing} type="date" onChange={v => updateField('person', 'work_pass_start', v)} />
                                    <Field label="Work Pass Expiry" icon={Calendar} value={editing ? (fieldValue('employment', 'work_pass_expiry') || '') : formatDate(employment.work_pass_expiry)} editing={editing} type="date" onChange={v => updateField('employment', 'work_pass_expiry', v)} />
                                    <Field label="Foreign Worker Levy ($)" icon={DollarSign} type="number" value={fieldValue('employment', 'foreign_worker_levy')} editing={editing} onChange={v => updateField('employment', 'foreign_worker_levy', parseFloat(v) || 0)} />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'financial' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Financial Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field
                                label="Monthly Basic Salary (SGD)"
                                icon={DollarSign}
                                value={editing ? fieldValue('employment', 'basic_salary') : `$${Number(employment.basic_salary).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`}
                                editing={editing}
                                type={editing ? 'number' : 'text'}
                                onChange={v => updateField('employment', 'basic_salary', parseFloat(v))}
                            />
                            <SelectField
                                label="Payment Mode"
                                value={fieldValue('employment', 'payment_mode')}
                                editing={editing}
                                onChange={v => updateField('employment', 'payment_mode', v)}
                                options={[
                                    { value: 'bank_transfer', label: 'Bank Transfer' },
                                    { value: 'cheque', label: 'Cheque' },
                                    { value: 'cash', label: 'Cash' },
                                ]}
                            />
                        </div>

                        {/* Recurring Allowances & Deductions */}
                        <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 font-premium">Recurring Allowances & Deductions</h3>
                                    <p className="text-sm text-gray-500">Fixed monthly adjustments to gross/net pay</p>
                                </div>
                                {editing && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newComp: SalaryComponent = {
                                                id: 'new-' + Math.random().toString(36).substr(2, 9),
                                                component: 'Fixed Allowance',
                                                amount: 0,
                                                category: 'allowance',
                                                effective_date: editEmployment.join_date || new Date().toISOString().split('T')[0],
                                                is_taxable: true,
                                                is_cpf_liable: true
                                            };
                                            setEditSalaryComponents([...editSalaryComponents, newComp]);
                                        }}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Component
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {(editing ? editSalaryComponents : (data.salary_components || [])).length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                                        <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm text-gray-500">No recurring allowances or deductions.</p>
                                    </div>
                                ) : (
                                    (editing ? editSalaryComponents : data.salary_components).map((comp, idx) => (
                                        <div key={comp.id || idx} className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Category</label>
                                                    {editing ? (
                                                        <select
                                                            value={comp.category}
                                                            onChange={(e) => {
                                                                const newList = [...editSalaryComponents];
                                                                newList[idx].category = e.target.value;
                                                                setEditSalaryComponents(newList);
                                                            }}
                                                            className="input-field py-2 text-sm"
                                                        >
                                                            <option value="allowance">Allowance (+)</option>
                                                            <option value="deduction">Deduction (-)</option>
                                                        </select>
                                                    ) : (
                                                        <div className={clsx(
                                                            "px-2 py-1 rounded-lg text-xs font-bold w-fit",
                                                            comp.category === 'allowance' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                        )}>
                                                            {comp.category === 'allowance' ? 'Allowance' : 'Deduction'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Component Name</label>
                                                    {editing ? (
                                                        <input
                                                            type="text"
                                                            value={comp.component}
                                                            onChange={(e) => {
                                                                const newList = [...editSalaryComponents];
                                                                newList[idx].component = e.target.value;
                                                                setEditSalaryComponents(newList);
                                                            }}
                                                            className="input-field py-2 text-sm"
                                                        />
                                                    ) : (
                                                        <p className="font-semibold text-dark-950 dark:text-gray-50">{comp.component}</p>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Amount (SGD)</label>
                                                    {editing ? (
                                                        <div className="relative">
                                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                            <input
                                                                type="number"
                                                                value={comp.amount}
                                                                onChange={(e) => {
                                                                    const newList = [...editSalaryComponents];
                                                                    newList[idx].amount = parseFloat(e.target.value) || 0;
                                                                    setEditSalaryComponents(newList);
                                                                }}
                                                                className="input-field py-2 pl-10 text-sm font-bold"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <p className="font-bold text-dark-950 dark:text-gray-50">${Number(comp.amount).toLocaleString('en-SG', { minimumFractionDigits: 2 })}</p>
                                                    )}
                                                </div>
                                            </div>
                                            {editing && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newList = editSalaryComponents.filter((_, i) => i !== idx);
                                                        setEditSalaryComponents(newList);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 pt-4 font-premium">Bank Account</h3>
                        {data.bank_account ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field label="Bank Name" value={data.bank_account.bank_name} editing={false} disabled />
                                <Field label="Account Holder" value={data.bank_account.account_name} editing={false} disabled />
                                <Field label="Account Number (masked)" value={data.bank_account.account_number_masked} editing={false} disabled />
                                <div className="flex items-center gap-2 pt-6">
                                    <BadgeCheck className={clsx("w-5 h-5", data.bank_account.is_default ? "text-emerald-500" : "text-gray-300 dark:text-gray-600")} />
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {data.bank_account.is_default ? 'Default Account' : 'Not Default'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-8 text-center text-gray-400 dark:text-gray-500">
                                No bank account linked
                            </div>
                        )}

                        {/* YTD Summary Section */}
                        <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 font-premium">Year-To-Date (YTD) Summary</h3>
                                    <p className="text-sm text-gray-500">Annual CPF-liable wages for the current calendar year</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const currentYear = new Date().getFullYear();
                                        const existing = ytdData.find(y => y.year === currentYear);
                                        setSelectedYtd(existing || { year: currentYear, ytd_ow: 0, ytd_aw: 0, ytd_cpf_ee: 0, ytd_cpf_er: 0, last_updated_period: null });
                                        setShowYtdModal(true);
                                    }}
                                    className="px-4 py-2 text-xs font-bold text-primary-600 hover:bg-primary-50 rounded-xl border border-primary-200 transition-all"
                                >
                                    Adjust YTD
                                </button>
                            </div>

                            {loadingYtd ? (
                                <div className="h-32 bg-gray-50 dark:bg-gray-800/50 rounded-[24px] animate-pulse"></div>
                            ) : ytdData.length === 0 ? (
                                <div className="bg-gray-50 dark:bg-gray-800/20 rounded-2xl p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 text-center">
                                    <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm text-gray-500">No YTD data available for this year. Data will populate after the first payroll run.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {ytdData.map((ytd) => (
                                        <React.Fragment key={ytd.year}>
                                            <YTDCard label={`YTD OW (${ytd.year})`} value={ytd.ytd_ow} color="bg-primary-50 text-primary-700" />
                                            <YTDCard label="YTD AW" value={ytd.ytd_aw} color="bg-orange-50 text-orange-700" />
                                            <YTDCard label="CPF (EE)" value={ytd.ytd_cpf_ee} color="bg-emerald-50 text-emerald-700" />
                                            <YTDCard label="CPF (ER)" value={ytd.ytd_cpf_er} color="bg-blue-50 text-blue-700" />
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'leave' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Leave Balances</h2>
                        </div>

                        {loadingLeave ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="h-32 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl animate-pulse"></div>
                                ))}
                            </div>
                        ) : leaveBalances.length === 0 ? (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400">
                                No leave balances configured for this employee.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {leaveBalances.map((bal, i) => (
                                    <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[24px] p-6 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50 flex flex-col hover:-translate-y-1 transition-all duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <h3 className="font-bold text-dark-950 dark:text-gray-50">{bal.leave_type_name}</h3>
                                            </div>
                                            <span className="text-2xl font-black text-primary-600 dark:text-primary-400">{bal.available_days}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-2 text-sm mt-auto">
                                            <div className="text-gray-500 dark:text-gray-400">Allocated</div>
                                            <div className="text-right font-medium text-dark-950 dark:text-gray-100">{bal.total_days}</div>
                                            {bal.carried_over_days > 0 && (
                                                <>
                                                    <div className="text-gray-500 dark:text-gray-400">Carry Forward</div>
                                                    <div className="text-right font-medium text-dark-950 dark:text-gray-100">{bal.carried_over_days}</div>
                                                </>
                                            )}
                                            <div className="text-gray-500 dark:text-gray-400">Consumed</div>
                                            <div className="text-right font-medium text-rose-600 dark:text-rose-400">{bal.used_days}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'documents' && renderDocumentsTab()}
            </div>

            {/* Deactivate Confirmation Modal */}
            {
                showDeactivateModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowDeactivateModal(false)}>
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                                    <AlertTriangle className="w-7 h-7" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">Deactivate Employee</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">This action can be reversed later.</p>
                                </div>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 mb-8">
                                Are you sure you want to deactivate <strong>{person.full_name}</strong>?
                                Their resign date will be set to today and their employment status will be marked as inactive.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setShowDeactivateModal(false)}
                                    className="px-6 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeactivate}
                                    disabled={deactivating}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200 dark:shadow-rose-900/30 transition-all"
                                >
                                    {deactivating ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <UserX className="w-4 h-4" />
                                    )}
                                    Confirm Deactivate
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* YTD Adjustment Modal */}
            {showYtdModal && selectedYtd && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50 font-premium">Adjust YTD Totals ({selectedYtd.year})</h3>
                            <button onClick={() => setShowYtdModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">YTD Ordinary Wages (OW)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={selectedYtd.ytd_ow}
                                        onChange={e => setSelectedYtd({ ...selectedYtd, ytd_ow: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">YTD Additional Wages (AW)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={selectedYtd.ytd_aw}
                                        onChange={e => setSelectedYtd({ ...selectedYtd, ytd_aw: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">YTD CPF Employee Share</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={selectedYtd.ytd_cpf_ee}
                                        onChange={e => setSelectedYtd({ ...selectedYtd, ytd_cpf_ee: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">YTD CPF Employer Share</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={selectedYtd.ytd_cpf_er}
                                        onChange={e => setSelectedYtd({ ...selectedYtd, ytd_cpf_er: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100 italic">
                                Note: These totals are used to calculate the annual CPF AW Ceiling. Manual adjustments should only be made for mid-year data migration or error corrections.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowYtdModal(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 transition-all font-premium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setSubmittingYtd(true);
                                    try {
                                        await api.put(`/api/v1/payroll/ytd/${data?.person?.id}`, selectedYtd);
                                        toast.success("YTD Totals Updated");
                                        // Refresh YTD data
                                        const resp = await api.get(`/api/v1/payroll/ytd/${data?.person?.id}`);
                                        setYtdData(resp.data);
                                        setShowYtdModal(false);
                                    } catch (err) {
                                        toast.error("Failed to update YTD");
                                    } finally {
                                        setSubmittingYtd(false);
                                    }
                                }}
                                disabled={submittingYtd}
                                className="btn btn-primary px-8 py-2.5 shadow-lg shadow-primary-200"
                            >
                                {submittingYtd ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-100 dark:border-gray-800 text-center relative">
                        {!invitePassword ? (
                            <>
                                <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-6">
                                    <Send className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold font-premium text-dark-950 dark:text-gray-50 mb-2">Invite to Self-Service Portal</h3>
                                <p className="text-sm text-gray-500 mb-8">
                                    This will create a secure login account for <strong>{person.full_name}</strong> and generate a temporary password.
                                    They must have a valid email address configured in their profile.
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={() => setShowInviteModal(false)}
                                        className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleInvite}
                                        disabled={inviting}
                                        className="btn flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                                    >
                                        {inviting ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>Generate Login</>
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6">
                                    <BadgeCheck className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold font-premium text-dark-950 dark:text-gray-50 mb-2">Account Created!</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Copy this temporary password and securely send it to the employee. They will be required to change it upon their first login.
                                </p>
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-8 select-all">
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Temporary Password</p>
                                    <p className="text-2xl tracking-widest font-mono text-dark-950 dark:text-emerald-400 font-black">{invitePassword}</p>
                                </div>
                                <button
                                    onClick={() => setShowInviteModal(false)}
                                    className="btn btn-primary w-full shadow-lg shadow-primary-200"
                                >
                                    Done
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


/* ── Reusable Field Components ─────────────────────── */

interface FieldProps {
    label: string;
    value: string | number;
    editing: boolean;
    icon?: React.ElementType;
    type?: string;
    multiline?: boolean;
    disabled?: boolean;
    onChange?: (val: string) => void;
}

const Field = ({ label, value, editing, icon: Icon, type = 'text', multiline, disabled, onChange }: FieldProps) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</label>
        {editing && !disabled ? (
            <div className="relative">
                {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />}
                {multiline ? (
                    <textarea
                        className={clsx("input-field min-h-[100px] pt-4", Icon && "pl-12")}
                        value={value ?? ''}
                        onChange={e => onChange?.(e.target.value)}
                    />
                ) : (
                    <input
                        type={type}
                        className={clsx("input-field", Icon && "pl-12")}
                        value={value ?? ''}
                        onChange={e => onChange?.(e.target.value)}
                    />
                )}
            </div>
        ) : (
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                {Icon && <Icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
                <span className="text-sm font-medium text-dark-950 dark:text-gray-100">{value || '—'}</span>
            </div>
        )}
    </div>
);

interface SelectFieldProps {
    label: string;
    value: string;
    editing: boolean;
    options: { value: string; label: string }[];
    onChange?: (val: string) => void;
}

const SelectField = ({ label, value, editing, options, onChange }: SelectFieldProps) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</label>
        {editing ? (
            <select
                className="input-field"
                value={value}
                onChange={e => onChange?.(e.target.value)}
            >
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        ) : (
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 min-h-[48px]">
                <span className="text-sm font-medium text-dark-950 dark:text-gray-100">
                    {options.find(o => o.value === value)?.label || value || '—'}
                </span>
            </div>
        )}
    </div>
);

const YTDCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className={clsx("rounded-2xl p-5 border border-transparent dark:border-gray-800 shadow-sm", color)}>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{label}</p>
        <p className="text-lg font-black font-premium">
            ${Number(value).toLocaleString('en-SG', { minimumFractionDigits: 2 })}
        </p>
    </div>
);

export default EmployeeProfile;
