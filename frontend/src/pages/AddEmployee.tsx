import React, { useState, useEffect } from 'react';
import {
    User,
    Briefcase,
    CreditCard,
    ChevronRight,
    ChevronLeft,
    Save,
    CheckCircle2,
    Calendar,
    Mail,
    Phone,
    MapPin,
    Building2,
    DollarSign,
    Smartphone,
    MessageCircle,
    Globe,
    Shield,
    AlertCircle,
    GraduationCap,
    FileText,
    Clock,
    Hash,
    Tag,
    Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { clsx } from 'clsx';
import DatePicker from '../components/DatePicker';
import { useAuthStore } from '../store/useAuthStore';

const REQUIRED_PERSON_FIELDS: { key: string; label: string }[] = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'nric_fin', label: 'NRIC / FIN' },
    { key: 'date_of_birth', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'race', label: 'Race' },
    { key: 'mobile_number', label: 'Mobile Number' },
];

const AddEmployee = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const selectedEntityId = user?.selected_entity_id;
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [sameAsMobile, setSameAsMobile] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Master data
    const [departments, setDepartments] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        person: {
            full_name: '',
            nric_fin: '',
            personal_email: '',
            contact_number: '',
            mobile_number: '',
            whatsapp_number: '',
            date_of_birth: '',
            gender: 'male',
            nationality: 'Singapore Citizen',
            race: 'Chinese',
            language: 'English',
            highest_education: '',
            pr_start_date: '',
            work_pass_start: '',
            address: ''
        },
        employment: {
            entity_id: selectedEntityId || '00000000-0000-0000-0000-000000000000',
            employee_code: '',
            job_title: '',
            employment_type: 'full_time',
            citizenship_type: 'citizen',
            work_pass_type: '',
            work_pass_no: '',
            work_pass_expiry: '',
            join_date: new Date().toISOString().split('T')[0],
            cessation_date: '',
            designation: '',
            department_id: '',
            group_id: '',
            grade_id: '',
            working_days_per_week: '',
            rest_day: '',
            work_hours_per_day: '',
            normal_work_hours_per_week: '',
            basic_salary: 0,
            is_ot_eligible: true
        },
        bank_account: {
            bank_name: '',
            account_name: '',
            account_number: '',
            is_default: true
        }
    });

    // Sync entity ID and fetch master data
    useEffect(() => {
        if (selectedEntityId) {
            setFormData(prev => ({
                ...prev,
                employment: { ...prev.employment, entity_id: selectedEntityId }
            }));

            const fetchMasters = async () => {
                try {
                    const [deptsRes, gradesRes, groupsRes] = await Promise.all([
                        api.get('/api/v1/masters/departments', { params: { entity_id: selectedEntityId } }),
                        api.get('/api/v1/masters/grades', { params: { entity_id: selectedEntityId } }),
                        api.get('/api/v1/masters/groups', { params: { entity_id: selectedEntityId } })
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
    }, [selectedEntityId]);

    const handleInputChange = (section: string, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...(prev as any)[section],
                [field]: value
            }
        }));
        // Clear error for this field when user types
        if (formErrors[field]) {
            setFormErrors(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validateStep1 = (): boolean => {
        const errors: Record<string, string> = {};
        for (const { key, label } of REQUIRED_PERSON_FIELDS) {
            const val = (formData.person as any)[key];
            if (!val || (typeof val === 'string' && val.trim() === '')) {
                errors[key] = `${label} is required`;
            }
        }
        // Foreigner-specific mandatory fields
        if (formData.person.nationality === 'Foreigner') {
            const foreignerFields: { key: string; section: 'person' | 'employment'; label: string }[] = [
                { key: 'work_pass_type', section: 'employment', label: 'Work Pass Type' },
                { key: 'work_pass_no', section: 'employment', label: 'Work Pass No' },
                { key: 'work_pass_start', section: 'person', label: 'Work Pass Start Date' },
                { key: 'work_pass_expiry', section: 'employment', label: 'Work Pass Expiry Date' },
            ];
            for (const { key, section, label } of foreignerFields) {
                const val = (formData[section] as any)[key];
                if (!val || (typeof val === 'string' && val.trim() === '')) {
                    errors[key] = `${label} is required`;
                }
            }
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep2 = (): boolean => {
        const errors: Record<string, string> = {};
        const requiredFields = [
            { key: 'department_id', label: 'Department' },
            { key: 'designation', label: 'Designation' },
            { key: 'group_id', label: 'Employment Group' },
            { key: 'working_days_per_week', label: 'Working Days' },
            { key: 'normal_work_hours_per_week', label: 'Work Hours' },
        ];

        for (const { key, label } of requiredFields) {
            const val = (formData.employment as any)[key];
            if (!val || (typeof val === 'string' && val.trim() === '')) {
                errors[key] = `${label} is required`;
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep3 = (): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.employment.basic_salary || formData.employment.basic_salary <= 0) {
            errors.basic_salary = 'Basic Salary must be greater than 0';
        }

        const bankFields = [
            { key: 'bank_name', label: 'Bank Name' },
            { key: 'account_name', label: 'Account Holder Name' },
            { key: 'account_number', label: 'Account Number' },
        ];

        for (const { key, label } of bankFields) {
            const val = (formData.bank_account as any)[key];
            if (!val || (typeof val === 'string' && val.trim() === '')) {
                errors[key] = `${label} is required`;
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        setStep(s => Math.min(3, s + 1));
    };

    const handleSameAsMobile = (checked: boolean) => {
        setSameAsMobile(checked);
        if (checked) {
            handleInputChange('person', 'whatsapp_number', formData.person.mobile_number);
        } else {
            handleInputChange('person', 'whatsapp_number', '');
        }
    };

    const handleSubmit = async () => {
        if (!validateStep3()) return;
        setLoading(true);

        // Sanitize payload: convert empty strings to null for optional fields
        const sanitizeValue = (val: any) => {
            if (typeof val === 'string' && val.trim() === '') return null;
            return val;
        };

        const sanitizedData = {
            person: Object.fromEntries(
                Object.entries(formData.person).map(([k, v]) => [k, sanitizeValue(v)])
            ),
            employment: Object.fromEntries(
                Object.entries(formData.employment).map(([k, v]) => [k, sanitizeValue(v)])
            ),
            bank_account: Object.fromEntries(
                Object.entries(formData.bank_account).map(([k, v]) => [k, sanitizeValue(v)])
            )
        };

        try {
            await api.post('/api/v1/employees', sanitizedData);
            navigate('/employees');
        } catch (error: any) {
            console.error("Failed to create employee", error);

            if (error.response?.status === 422 && error.response.data?.detail) {
                const backendErrors: Record<string, string> = {};
                let firstErrorStep = step;

                error.response.data.detail.forEach((err: any) => {
                    const loc = err.loc; // e.g. ["body", "person", "personal_email"]
                    if (loc && loc.length >= 3) {
                        const fieldName = loc[loc.length - 1];
                        backendErrors[fieldName] = err.msg;

                        // Determine which step the error belongs to for UI jumping
                        if (loc[1] === 'person') firstErrorStep = Math.min(firstErrorStep, 1);
                        else if (loc[1] === 'employment' && firstErrorStep > 2) firstErrorStep = 2;
                    }
                });

                setFormErrors(backendErrors);
                setStep(firstErrorStep);
                alert("Please correct the highlighted errors from the server.");
            } else {
                alert("Error creating employee. Please check your data.");
            }
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { id: 1, title: 'Personal', icon: User },
        { id: 2, title: 'Employment', icon: Briefcase },
        { id: 3, title: 'Financial', icon: CreditCard },
    ];

    /** Small helper: required asterisk */
    const req = <span className="text-red-500 ml-0.5">*</span>;

    /** Helper: field error message */
    const fieldError = (key: string) =>
        formErrors[key] ? (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {formErrors[key]}
            </p>
        ) : null;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">Onboard Employee</h1>
                    <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Add a new member to your organization.</p>
                </div>
                <button
                    onClick={() => navigate('/employees')}
                    className="text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-dark-950 dark:text-gray-50 font-medium flex items-center gap-1"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back to List
                </button>
            </div>

            {/* Progress Stepper */}
            <div className="flex items-center justify-between mb-8 sm:mb-12 bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20 overflow-x-auto scrollbar-none">
                {steps.map((s, i) => (
                    <React.Fragment key={s.id}>
                        <div className="flex flex-col items-center gap-1.5 sm:gap-2 relative z-10 shrink-0">
                            <div className={clsx(
                                "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300",
                                step >= s.id ? "bg-primary-600 text-white shadow-lg shadow-primary-200" : "bg-gray-100 text-gray-400 dark:text-gray-500"
                            )}>
                                <s.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <span className={clsx(
                                "text-[10px] sm:text-sm font-bold",
                                step >= s.id ? "text-dark-950 dark:text-gray-50" : "text-gray-400 dark:text-gray-500",
                                step !== s.id && "hidden sm:block"
                            )}>{s.title}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className="flex-1 min-w-[20px] sm:min-w-[40px] h-1 mx-2 sm:mx-4 bg-gray-100 dark:bg-gray-800 rounded-full relative overflow-hidden">
                                <div
                                    className="absolute inset-0 bg-primary-600 transition-all duration-500"
                                    style={{ width: step > s.id ? '100%' : '0%' }}
                                />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Form Content */}
            <div className="bg-white dark:bg-gray-900 rounded-[24px] sm:rounded-[32px] border border-gray-100 dark:border-gray-800 p-6 sm:p-10 shadow-xl shadow-gray-200/10 min-h-[400px] flex flex-col">
                <div className="flex-1">
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Identity Section */}
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Identity</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Full Name (as per NRIC/Passport){req}</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="text"
                                            className={clsx('input-field pl-12', formErrors.full_name && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                            placeholder="John Doe"
                                            value={formData.person.full_name}
                                            onChange={(e) => handleInputChange('person', 'full_name', e.target.value)}
                                        />
                                    </div>
                                    {fieldError('full_name')}
                                </div>
                                {/* NRIC / FIN */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">NRIC / FIN{req}</label>
                                    <input
                                        type="text"
                                        className={clsx('input-field', formErrors.nric_fin && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                        placeholder="S1234567A"
                                        value={formData.person.nric_fin}
                                        onChange={(e) => handleInputChange('person', 'nric_fin', e.target.value)}
                                    />
                                    {fieldError('nric_fin')}
                                </div>
                                {/* Date of Birth */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Date of Birth{req}</label>
                                    <DatePicker
                                        value={formData.person.date_of_birth}
                                        onChange={(v) => handleInputChange('person', 'date_of_birth', v)}
                                        placeholder="Select date of birth"
                                        error={formErrors.date_of_birth}
                                    />
                                    {fieldError('date_of_birth')}
                                </div>
                                {/* Gender */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Gender{req}</label>
                                    <select
                                        className={clsx('input-field', formErrors.gender && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                        value={formData.person.gender}
                                        onChange={(e) => handleInputChange('person', 'gender', e.target.value)}
                                    >
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                    {fieldError('gender')}
                                </div>
                                {/* Nationality */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Nationality{req}</label>
                                    <div className="relative">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <select
                                            className={clsx('input-field pl-12', formErrors.nationality && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                            value={formData.person.nationality}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                handleInputChange('person', 'nationality', val);
                                                // Auto-set citizenship_type based on nationality
                                                if (val === 'Singapore Citizen') {
                                                    handleInputChange('employment', 'citizenship_type', 'citizen');
                                                } else if (val === 'SPR') {
                                                    handleInputChange('employment', 'citizenship_type', 'pr');
                                                } else {
                                                    handleInputChange('employment', 'citizenship_type', 'foreigner');
                                                }
                                            }}
                                        >
                                            <option value="Singapore Citizen">Singapore Citizen</option>
                                            <option value="SPR">SPR (Permanent Resident)</option>
                                            <option value="Foreigner">Foreigner</option>
                                        </select>
                                    </div>
                                    {fieldError('nationality')}
                                </div>
                                {/* Race */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Race{req}</label>
                                    <select
                                        className={clsx('input-field', formErrors.race && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                        value={formData.person.race}
                                        onChange={(e) => handleInputChange('person', 'race', e.target.value)}
                                    >
                                        <option value="Chinese">Chinese</option>
                                        <option value="Malay">Malay</option>
                                        <option value="Indian">Indian</option>
                                        <option value="Eurasian">Eurasian</option>
                                        <option value="Others">Others</option>
                                    </select>
                                    {fieldError('race')}
                                </div>
                                {/* Language */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Language</label>
                                    <select
                                        className="input-field"
                                        value={formData.person.language}
                                        onChange={(e) => handleInputChange('person', 'language', e.target.value)}
                                    >
                                        <option value="English">English</option>
                                        <option value="Mandarin">Mandarin</option>
                                        <option value="Malay">Malay</option>
                                        <option value="Tamil">Tamil</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>
                                {/* Highest Education */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Highest Education Attained</label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <select
                                            className="input-field pl-12"
                                            value={formData.person.highest_education}
                                            onChange={(e) => handleInputChange('person', 'highest_education', e.target.value)}
                                        >
                                            <option value="">Select Education Level</option>
                                            <option value="Below Secondary">Below Secondary</option>
                                            <option value="Secondary">Secondary</option>
                                            <option value="Post Secondary (Non-Tertiary)">Post Secondary (Non-Tertiary)</option>
                                            <option value="Diploma">Diploma</option>
                                            <option value="Professional Qualification">Professional Qualification</option>
                                            <option value="Bachelor's Degree">Bachelor's Degree</option>
                                            <option value="Postgraduate Diploma">Postgraduate Diploma</option>
                                            <option value="Master's Degree">Master's Degree</option>
                                            <option value="Doctorate">Doctorate</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* SPR - PR Status Start Date */}
                            {formData.person.nationality === 'SPR' && (
                                <>
                                    <p className="text-xs font-bold text-amber-500 uppercase tracking-wider pt-2">PR Status Details</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">PR Status Start Date</label>
                                            <DatePicker
                                                value={formData.person.pr_start_date}
                                                onChange={(v) => handleInputChange('person', 'pr_start_date', v)}
                                                placeholder="Select PR start date"
                                                icon={Calendar}
                                                inputClassName="border-amber-200 focus:border-amber-400"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Foreigner - Work Pass Details */}
                            {formData.person.nationality === 'Foreigner' && (
                                <>
                                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wider pt-2">Work Pass Details</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Work Pass Type{req}</label>
                                            <div className="relative">
                                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
                                                <select
                                                    className={clsx('input-field pl-12 border-blue-200 focus:border-blue-400', formErrors.work_pass_type && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                                    value={formData.employment.work_pass_type}
                                                    onChange={(e) => handleInputChange('employment', 'work_pass_type', e.target.value)}
                                                >
                                                    <option value="">Select Work Pass Type</option>
                                                    <option value="Employment Pass">Employment Pass</option>
                                                    <option value="S Pass">S Pass</option>
                                                    <option value="Work Permit">Work Permit</option>
                                                    <option value="Dependent Pass (with LOC)">Dependent Pass (with LOC)</option>
                                                    <option value="Others">Others</option>
                                                </select>
                                            </div>
                                            {fieldError('work_pass_type')}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Work Pass No{req}</label>
                                            <div className="relative">
                                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
                                                <input
                                                    type="text"
                                                    className={clsx('input-field pl-12 border-blue-200 focus:border-blue-400', formErrors.work_pass_no && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                                    placeholder="Enter work pass number"
                                                    value={formData.employment.work_pass_no}
                                                    onChange={(e) => handleInputChange('employment', 'work_pass_no', e.target.value)}
                                                />
                                            </div>
                                            {fieldError('work_pass_no')}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Work Pass Start Date{req}</label>
                                            <DatePicker
                                                value={formData.person.work_pass_start}
                                                onChange={(v) => handleInputChange('person', 'work_pass_start', v)}
                                                placeholder="Select work pass start date"
                                                icon={Calendar}
                                                error={formErrors.work_pass_start}
                                                inputClassName="border-blue-200 focus:border-blue-400"
                                            />
                                            {fieldError('work_pass_start')}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Work Pass Expiry Date{req}</label>
                                            <DatePicker
                                                value={formData.employment.work_pass_expiry}
                                                onChange={(v) => handleInputChange('employment', 'work_pass_expiry', v)}
                                                placeholder="Select work pass expiry date"
                                                icon={Calendar}
                                                error={formErrors.work_pass_expiry}
                                                inputClassName="border-blue-200 focus:border-blue-400"
                                            />
                                            {fieldError('work_pass_expiry')}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Contact Section */}
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-2">Contact Information</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Mobile Number */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Mobile Number{req}</label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="text"
                                            className={clsx('input-field pl-12', formErrors.mobile_number && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                            placeholder="+65 9123 4567"
                                            value={formData.person.mobile_number}
                                            onChange={(e) => {
                                                handleInputChange('person', 'mobile_number', e.target.value);
                                                // If checkbox is checked, keep whatsapp in sync
                                                if (sameAsMobile) {
                                                    handleInputChange('person', 'whatsapp_number', e.target.value);
                                                }
                                            }}
                                        />
                                    </div>
                                    {fieldError('mobile_number')}
                                </div>
                                {/* Personal Email */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Personal Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="email"
                                            className="input-field pl-12"
                                            placeholder="john@example.com"
                                            value={formData.person.personal_email}
                                            onChange={(e) => handleInputChange('person', 'personal_email', e.target.value)}
                                        />
                                    </div>
                                </div>
                                {/* WhatsApp Number */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">WhatsApp Number</label>
                                    <div className="relative">
                                        <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="text"
                                            className={clsx('input-field pl-12', sameAsMobile && 'bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 cursor-not-allowed')}
                                            placeholder="+65 9123 4567"
                                            value={formData.person.whatsapp_number}
                                            disabled={sameAsMobile}
                                            onChange={(e) => handleInputChange('person', 'whatsapp_number', e.target.value)}
                                        />
                                    </div>
                                    {/* Same as Mobile checkbox */}
                                    <label className="flex items-center gap-2 cursor-pointer select-none group mt-1">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                            checked={sameAsMobile}
                                            onChange={(e) => handleSameAsMobile(e.target.checked)}
                                        />
                                        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                                            Same as Mobile Number
                                        </span>
                                    </label>
                                </div>
                                {/* Contact Number */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Contact Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="text"
                                            className="input-field pl-12"
                                            placeholder="+65 6789 1234"
                                            value={formData.person.contact_number}
                                            onChange={(e) => handleInputChange('person', 'contact_number', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Residential Address</label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                    <textarea
                                        className="input-field pl-12 min-h-[100px] pt-4"
                                        placeholder="Enter full address..."
                                        value={formData.person.address}
                                        onChange={(e) => handleInputChange('person', 'address', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Employee Code (SKU)</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="EMP-001"
                                        value={formData.employment.employee_code}
                                        onChange={(e) => handleInputChange('employment', 'employee_code', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Job Title</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="text"
                                            className="input-field pl-12"
                                            placeholder="Senior Software Engineer"
                                            value={formData.employment.job_title}
                                            onChange={(e) => handleInputChange('employment', 'job_title', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Employment Type</label>
                                    <select
                                        className="input-field"
                                        value={formData.employment.employment_type}
                                        onChange={(e) => handleInputChange('employment', 'employment_type', e.target.value)}
                                    >
                                        <option value="full_time">Full Time</option>
                                        <option value="part_time">Part Time</option>
                                        <option value="contract">Contract</option>
                                        <option value="director">Director</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Join Date</label>
                                    <DatePicker
                                        value={formData.employment.join_date}
                                        onChange={(v) => handleInputChange('employment', 'join_date', v)}
                                        placeholder="Select join date"
                                        icon={Calendar}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Cessation Date</label>
                                    <DatePicker
                                        value={formData.employment.cessation_date}
                                        onChange={(v) => handleInputChange('employment', 'cessation_date', v)}
                                        placeholder="Select cessation date"
                                        icon={Calendar}
                                    />
                                </div>
                            </div>

                            {/* Organization Section */}
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-2">Organization</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Department{req}</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <select
                                            className={clsx('input-field pl-12', formErrors.department_id && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                            value={formData.employment.department_id}
                                            onChange={(e) => handleInputChange('employment', 'department_id', e.target.value)}
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {fieldError('department_id')}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Designation{req}</label>
                                    <div className="relative">
                                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="text"
                                            className={clsx('input-field pl-12', formErrors.designation && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                            placeholder="e.g. Manager, Executive"
                                            value={formData.employment.designation}
                                            onChange={(e) => handleInputChange('employment', 'designation', e.target.value)}
                                        />
                                    </div>
                                    {fieldError('designation')}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Employment Group{req}</label>
                                    <div className="relative">
                                        <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <select
                                            className={clsx('input-field pl-12', formErrors.group_id && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                            value={formData.employment.group_id}
                                            onChange={(e) => handleInputChange('employment', 'group_id', e.target.value)}
                                        >
                                            <option value="">Select Group</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {fieldError('group_id')}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Employment Grade</label>
                                    <div className="relative">
                                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <select
                                            className="input-field pl-12"
                                            value={formData.employment.grade_id}
                                            onChange={(e) => handleInputChange('employment', 'grade_id', e.target.value)}
                                        >
                                            <option value="">Select Grade</option>
                                            {grades.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Work Schedule Section */}
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-2">Work Schedule</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Working Days Per Week{req}</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="1"
                                            max="7"
                                            className={clsx('input-field pl-12', formErrors.working_days_per_week && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                            placeholder="e.g. 5"
                                            value={formData.employment.working_days_per_week}
                                            onChange={(e) => handleInputChange('employment', 'working_days_per_week', e.target.value)}
                                        />
                                    </div>
                                    {fieldError('working_days_per_week')}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Rest Day</label>
                                    <select
                                        className="input-field"
                                        value={formData.employment.rest_day}
                                        onChange={(e) => handleInputChange('employment', 'rest_day', e.target.value)}
                                    >
                                        <option value="">Select Rest Day</option>
                                        <option value="Monday">Monday</option>
                                        <option value="Tuesday">Tuesday</option>
                                        <option value="Wednesday">Wednesday</option>
                                        <option value="Thursday">Thursday</option>
                                        <option value="Friday">Friday</option>
                                        <option value="Saturday">Saturday</option>
                                        <option value="Sunday">Sunday</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Work Hours Per Day</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="1"
                                            max="24"
                                            className="input-field pl-12"
                                            placeholder="e.g. 8"
                                            value={formData.employment.work_hours_per_day}
                                            onChange={(e) => handleInputChange('employment', 'work_hours_per_day', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Normal Work Hours Per Week{req}</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="1"
                                            max="168"
                                            className={clsx('input-field pl-12', formErrors.normal_work_hours_per_week && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                            placeholder="e.g. 44"
                                            value={formData.employment.normal_work_hours_per_week}
                                            onChange={(e) => handleInputChange('employment', 'normal_work_hours_per_week', e.target.value)}
                                        />
                                    </div>
                                    {fieldError('normal_work_hours_per_week')}
                                </div>
                            </div>

                            {/* OT Eligibility */}
                            <div className="flex items-center gap-3 pt-2">
                                <input
                                    type="checkbox"
                                    id="ot_eligible"
                                    className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                                    checked={formData.employment.is_ot_eligible}
                                    onChange={(e) => handleInputChange('employment', 'is_ot_eligible', e.target.checked)}
                                />
                                <label htmlFor="ot_eligible" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Eligible for Overtime (Part IV EA)</label>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-primary-50 p-6 rounded-2xl border border-primary-100 flex items-start gap-4">
                                <AlertCircle className="w-6 h-6 text-primary-600 mt-1" />
                                <div>
                                    <p className="font-bold text-primary-900">Statutory Notice</p>
                                    <p className="text-sm text-primary-700">The basic salary entered here will be used for CPF, SDL, and SHG calculations automatically based on Singapore statutory rates.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Monthly Basic Salary (SGD){req}</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                            <input
                                                type="number"
                                                className={clsx('input-field pl-12 text-xl font-bold', formErrors.basic_salary && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                                placeholder="5000"
                                                value={formData.employment.basic_salary}
                                                onChange={(e) => handleInputChange('employment', 'basic_salary', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        {fieldError('basic_salary')}
                                    </div>

                                    {/* MOM Salary Breakdown Card */}
                                    {formData.employment.basic_salary > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
                                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Salary Breakdown (MOM Standard)</p>

                                            {(() => {
                                                const salary = formData.employment.basic_salary;
                                                const daysPerWeek = parseFloat(formData.employment.working_days_per_week) || 0;
                                                const hoursPerWeek = parseFloat(formData.employment.normal_work_hours_per_week) || 0;

                                                const dailyRate = daysPerWeek > 0 ? (12 * salary) / (52 * daysPerWeek) : 0;
                                                const hourlyRate = hoursPerWeek > 0 ? (12 * salary) / (52 * hoursPerWeek) : 0;

                                                return (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Daily Basic Rate</p>
                                                            <p className="text-lg font-bold text-dark-950 dark:text-gray-50">${dailyRate.toFixed(2)}</p>
                                                        </div>
                                                        <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Hourly Basic Rate</p>
                                                            <p className="text-lg font-bold text-dark-950 dark:text-gray-50">${hourlyRate.toFixed(2)}</p>
                                                        </div>
                                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                            <p className="text-[10px] font-bold text-blue-400 uppercase">1.5x OT Rate</p>
                                                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">${(hourlyRate * 1.5).toFixed(2)}</p>
                                                        </div>
                                                        <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30 shadow-sm">
                                                            <p className="text-[10px] font-bold text-purple-400 uppercase">2.0x OT Rate</p>
                                                            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">${(hourlyRate * 2).toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {!formData.employment.working_days_per_week || !formData.employment.normal_work_hours_per_week ? (
                                                <p className="text-[10px] text-amber-500 italic mt-2">* Rates updated based on Work Schedule in Step 2</p>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-6 pt-2">
                                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Bank Details</p>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500">Bank Name{req}</label>
                                            <input
                                                type="text"
                                                className={clsx('input-field', formErrors.bank_name && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                                placeholder="DBS / OCBC / UOB"
                                                value={formData.bank_account.bank_name}
                                                onChange={(e) => handleInputChange('bank_account', 'bank_name', e.target.value)}
                                            />
                                            {fieldError('bank_name')}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500">Account Holder Name{req}</label>
                                            <input
                                                type="text"
                                                className={clsx('input-field', formErrors.account_name && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                                placeholder="JOHN DOE"
                                                value={formData.bank_account.account_name}
                                                onChange={(e) => handleInputChange('bank_account', 'account_name', e.target.value)}
                                            />
                                            {fieldError('account_name')}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500">Account Number{req}</label>
                                            <input
                                                type="text"
                                                className={clsx('input-field', formErrors.account_number && 'border-red-400 focus:border-red-400 focus:ring-red-500/20')}
                                                placeholder="123-45678-9"
                                                value={formData.bank_account.account_number}
                                                onChange={(e) => handleInputChange('bank_account', 'account_number', e.target.value)}
                                            />
                                            {fieldError('account_number')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 sm:pt-10 border-t border-gray-100 dark:border-gray-800 mt-8 sm:mt-10">
                    <button
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        disabled={step === 1 || loading}
                        className={clsx(
                            "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all w-full sm:w-auto",
                            step === 1 ? "opacity-0 invisible pointer-events-none" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Previous Step
                    </button>

                    {step < 3 ? (
                        <button
                            onClick={handleNext}
                            className="btn btn-primary flex items-center justify-center gap-2 py-3 px-8 shadow-lg shadow-primary-200 w-full sm:w-auto"
                        >
                            Next Step
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="btn btn-primary flex items-center justify-center gap-2 py-3 px-10 shadow-lg shadow-primary-200 w-full sm:w-auto"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Complete Onboarding
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div >
    );
};

export default AddEmployee;
