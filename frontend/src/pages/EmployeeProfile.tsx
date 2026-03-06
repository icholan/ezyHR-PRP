import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ChevronLeft, Edit3, Save, X, UserX, User, Briefcase,
    CreditCard, Mail, Phone, MapPin, Calendar, Building2,
    DollarSign, Shield, Clock, BadgeCheck, XCircle, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

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
    pr_start_date: string | null;
    work_pass_start: string | null;
    address: string | null;
}

interface EmploymentDetail {
    id: string;
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

interface EmployeeData {
    person: PersonDetail;
    employment: EmploymentDetail;
    bank_account: BankDetail | null;
}

type TabId = 'overview' | 'employment' | 'financial' | 'leave';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'employment', label: 'Employment', icon: Briefcase },
    { id: 'financial', label: 'Financial', icon: CreditCard },
    { id: 'leave', label: 'Leave Balances', icon: Calendar },
];

const CITIZENSHIP_LABELS: Record<string, string> = {
    citizen: 'Singapore Citizen',
    pr: 'Permanent Resident',
    ep: 'Employment Pass',
    s_pass: 'S Pass',
    wp: 'Work Permit',
    dp: 'Dependant Pass',
    ltvp: 'LTVP',
};

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

    const [data, setData] = useState<EmployeeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [deactivating, setDeactivating] = useState(false);

    // Editable copies
    const [editPerson, setEditPerson] = useState<Partial<PersonDetail>>({});
    const [editEmployment, setEditEmployment] = useState<Partial<EmploymentDetail>>({});

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

    const enterEditMode = () => {
        if (!data) return;
        setEditPerson({ ...data.person });
        setEditEmployment({ ...data.employment });
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setEditPerson({});
        setEditEmployment({});
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
            setEditPerson(prev => ({ ...prev, [key]: value }));
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
                            {employment.is_active && (
                                <button
                                    onClick={() => setShowDeactivateModal(true)}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800 transition-all text-sm"
                                >
                                    <UserX className="w-4 h-4" />
                                    Deactivate
                                </button>
                            )}
                            <button
                                onClick={enterEditMode}
                                className="flex-1 sm:flex-none btn btn-primary flex items-center justify-center gap-2 py-2.5 px-6 shadow-lg shadow-primary-200 dark:shadow-primary-900/30 text-sm"
                            >
                                <Edit3 className="w-4 h-4" />
                                Edit
                            </button>
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
                        { label: 'Citizenship', value: CITIZENSHIP_LABELS[employment.citizenship_type] || employment.citizenship_type, icon: Shield },
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
                            <Field label="Nationality" value={fieldValue('person', 'nationality')} editing={editing} onChange={v => updateField('person', 'nationality', v)} />
                            <Field label="Race" value={fieldValue('person', 'race')} editing={editing} onChange={v => updateField('person', 'race', v)} />
                            <Field label="Highest Education" value={fieldValue('person', 'highest_education')} editing={editing} onChange={v => updateField('person', 'highest_education', v)} />
                            {person.nationality === 'SPR' && (
                                <Field label="PR Start Date" icon={Calendar} value={editing ? fieldValue('person', 'pr_start_date') : formatDate(person.pr_start_date)} editing={editing} type="date" onChange={v => updateField('person', 'pr_start_date', v)} />
                            )}
                            {person.nationality === 'Foreigner' && (
                                <Field label="Work Pass Start Date" icon={Calendar} value={editing ? fieldValue('person', 'work_pass_start') : formatDate(person.work_pass_start)} editing={editing} type="date" onChange={v => updateField('person', 'work_pass_start', v)} />
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
                            <SelectField label="Employment Type" value={fieldValue('employment', 'employment_type')} editing={editing} onChange={v => updateField('employment', 'employment_type', v)} options={Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                            <SelectField label="Citizenship / Pass" value={fieldValue('employment', 'citizenship_type')} editing={editing} onChange={v => updateField('employment', 'citizenship_type', v)} options={Object.entries(CITIZENSHIP_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
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

                        {data.employment.citizenship_type !== 'citizen' && (
                            <>
                                <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 pt-4">Work Pass & Levy</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Field label="Work Pass Type" value={fieldValue('employment', 'work_pass_type')} editing={editing} onChange={v => updateField('employment', 'work_pass_type', v)} />
                                    <Field label="Work Pass Number" value={fieldValue('employment', 'work_pass_no')} editing={editing} onChange={v => updateField('employment', 'work_pass_no', v)} />
                                    <Field label="Work Pass Expiry" icon={Calendar} value={editing ? fieldValue('employment', 'work_pass_expiry') : formatDate(employment.work_pass_expiry)} editing={editing} type="date" onChange={v => updateField('employment', 'work_pass_expiry', v)} />
                                    <Field
                                        label="Foreign Worker Levy ($)"
                                        icon={DollarSign}
                                        value={editing ? fieldValue('employment', 'foreign_worker_levy') : `$${Number(employment.foreign_worker_levy || 0).toLocaleString('en-SG', { minimumFractionDigits: 2 })}`}
                                        editing={editing}
                                        type={editing ? 'number' : 'text'}
                                        onChange={v => updateField('employment', 'foreign_worker_levy', parseFloat(v) || 0)}
                                    />
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

                        <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 pt-4">Bank Account</h3>
                        {bank_account ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Field label="Bank Name" value={bank_account.bank_name} editing={false} disabled />
                                <Field label="Account Holder" value={bank_account.account_name} editing={false} disabled />
                                <Field label="Account Number (masked)" value={bank_account.account_number_masked} editing={false} disabled />
                                <div className="flex items-center gap-2 pt-6">
                                    <BadgeCheck className={clsx("w-5 h-5", bank_account.is_default ? "text-emerald-500" : "text-gray-300 dark:text-gray-600")} />
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        {bank_account.is_default ? 'Default Account' : 'Not Default'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-8 text-center text-gray-400 dark:text-gray-500">
                                No bank account linked
                            </div>
                        )}
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
                                            <span className="text-2xl font-black text-primary-600 dark:text-primary-400">{bal.balance}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-2 text-sm mt-auto">
                                            <div className="text-gray-500 dark:text-gray-400">Allocated</div>
                                            <div className="text-right font-medium text-dark-950 dark:text-gray-100">{bal.allocated}</div>
                                            {bal.carry_forward > 0 && (
                                                <>
                                                    <div className="text-gray-500 dark:text-gray-400">Carry Forward</div>
                                                    <div className="text-right font-medium text-dark-950 dark:text-gray-100">{bal.carry_forward}</div>
                                                </>
                                            )}
                                            <div className="text-gray-500 dark:text-gray-400">Consumed</div>
                                            <div className="text-right font-medium text-rose-600 dark:text-rose-400">{bal.consumed}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Deactivate Confirmation Modal */}
            {showDeactivateModal && (
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

export default EmployeeProfile;
