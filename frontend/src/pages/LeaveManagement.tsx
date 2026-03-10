import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Plus,
    FileText,
    History,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Loader2,
    ShieldCheck,
    Info,
    X,
    TrendingUp
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import SearchableSelect from '../components/Common/SearchableSelect';
import DatePicker from '../components/DatePicker';

const LeaveManagement = () => {
    const { user } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();

    // Determine if we are in "My Leave" or "Team Leave" path
    const isTeamPath = location.pathname.includes('/team');

    const [balances, setBalances] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPolicyModal, setShowPolicyModal] = useState(false);
    const [tenureMonths, setTenureMonths] = useState(0);
    const [viewMode, setViewMode] = useState<'personal' | 'management' | 'entitlements'>(isTeamPath ? 'management' : 'personal');
    const [showAddEntitlementModal, setShowAddEntitlementModal] = useState(false);
    const [newEntitlement, setNewEntitlement] = useState({
        employment_id: '',
        leave_type_id: '',
        year: new Date().getFullYear(),
        total_days: 0,
        carried_over_days: 0
    });
    const [allRequests, setAllRequests] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [allEntitlements, setAllEntitlements] = useState<any[]>([]);
    const [editingEntitlement, setEditingEntitlement] = useState<any | null>(null);
    const [entitlementYear, setEntitlementYear] = useState(new Date().getFullYear());
    const [entitlementSearch, setEntitlementSearch] = useState('');
    const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

    // Sync viewMode with path if it changes (e.g. sidebar navigation)
    useEffect(() => {
        if (isTeamPath && viewMode === 'personal') {
            setViewMode('management');
        } else if (!isTeamPath && viewMode !== 'personal') {
            setViewMode('personal');
        }
    }, [isTeamPath]);

    // Form State
    const [formData, setFormData] = useState({
        employment_id: '',
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        attachment_url: '',
        child_birth_date: '',
        child_order: ''
    });

    useEffect(() => {
        fetchData();
        if (viewMode === 'management') {
            fetchManagementData();
        } else if (viewMode === 'entitlements') {
            fetchEntitlementData();
        }
    }, [user?.selected_entity_id, viewMode, entitlementYear]);

    const fetchData = async () => {
        if (!user?.selected_entity_id) return;
        setLoading(true);
        // Placeholder Emp ID from seed
        const empId = user.employment_id || "c85569f9-dad1-4973-a3b1-cba216a78a9d";
        try {
            const [balRes, reqRes, typeRes] = await Promise.all([
                api.get(`/api/v1/leave/balances?employment_id=${empId}`),
                api.get(`/api/v1/leave/requests?employment_id=${empId}`),
                api.get(`/api/v1/leave/types?entity_id=${user.selected_entity_id}`)
            ]);
            setBalances(balRes.data);
            setRequests(reqRes.data);
            setLeaveTypes(typeRes.data);

            // Extract tenure from first balance if available
            if (balRes.data.length > 0) {
                setTenureMonths(balRes.data[0].tenure_months || 0);
            }
        } catch (err) {
            console.error("Failed to fetch leave data", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchManagementData = async () => {
        if (!user?.selected_entity_id) return;
        try {
            const [reqRes, empRes] = await Promise.all([
                api.get(`/api/v1/leave/requests?entity_id=${user.selected_entity_id}`),
                api.get(`/api/v1/employees?entity_id=${user.selected_entity_id}`)
            ]);
            setAllRequests(reqRes.data);
            setEmployees(empRes.data);
        } catch (err) {
            console.error("Failed to fetch management data", err);
        }
    };

    const fetchEntitlementData = async () => {
        if (!user?.selected_entity_id) return;
        try {
            const res = await api.get(`/api/v1/leave/entitlements`, {
                params: {
                    entity_id: user.selected_entity_id,
                    year: entitlementYear,
                    search: entitlementSearch
                }
            });
            setAllEntitlements(res.data);
        } catch (err) {
            console.error("Failed to fetch entitlements", err);
        }
    };

    const groupedEntitlements = useMemo(() => {
        const groups: Record<string, { employment_id: string, employee_name: string, employee_code: string, entitlements: any[] }> = {};
        allEntitlements.forEach(ent => {
            if (!groups[ent.employment_id]) {
                groups[ent.employment_id] = {
                    employment_id: ent.employment_id,
                    employee_name: ent.employee_name,
                    employee_code: ent.employee_code,
                    entitlements: []
                };
            }
            groups[ent.employment_id].entitlements.push(ent);
        });
        return Object.values(groups);
    }, [allEntitlements]);

    const toggleEmployee = (empId: string) => {
        setExpandedEmployees(prev => {
            const next = new Set(prev);
            if (next.has(empId)) next.delete(empId);
            else next.add(empId);
            return next;
        });
    };

    const toggleAllEmployees = (expand: boolean) => {
        if (expand) {
            setExpandedEmployees(new Set(groupedEntitlements.map(g => g.employment_id)));
        } else {
            setExpandedEmployees(new Set());
        }
    };

    const handleUpdateEntitlement = async () => {
        if (!editingEntitlement) return;
        setSubmitting(true);
        try {
            await api.patch(`/api/v1/leave/entitlements/${editingEntitlement.id}`, {
                total_days: editingEntitlement.total_days,
                carried_over_days: editingEntitlement.carried_over_days
            });
            setEditingEntitlement(null);
            setError(null);
            fetchEntitlementData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to update entitlement");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateEntitlement = async () => {
        if (!newEntitlement.employment_id || !newEntitlement.leave_type_id) {
            setError("Please select both employee and leave type");
            return;
        }
        setSubmitting(true);
        try {
            await api.post(`/api/v1/leave/entitlements`, newEntitlement);
            setShowAddEntitlementModal(false);
            setNewEntitlement({
                employment_id: '',
                leave_type_id: '',
                year: new Date().getFullYear(),
                total_days: 0,
                carried_over_days: 0
            });
            fetchEntitlementData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to create entitlement");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (requestId: string, status: string) => {
        setProcessingId(requestId);
        try {
            await api.put(`/api/v1/leave/requests/${requestId}`, { status });
            fetchManagementData();
            if (viewMode === 'personal' || status === 'approved') {
                fetchData();
            }
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to update status");
        } finally {
            setProcessingId(null);
        }
    };

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        const empId = formData.employment_id || user?.employment_id || "c85569f9-dad1-4973-a3b1-cba216a78a9d";
        try {
            const res = await api.post('/api/v1/leave/apply', {
                ...formData,
                employment_id: empId
            });

            if (res.data.status === 'success') {
                setShowApplyModal(false);
                fetchData();
                if (viewMode === 'management') fetchManagementData();
                setFormData({
                    employment_id: '',
                    leave_type_id: '',
                    start_date: '',
                    end_date: '',
                    reason: '',
                    attachment_url: '',
                    child_birth_date: '',
                    child_order: ''
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to apply for leave");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className={`max-w-[1200px] mx-auto p-8 ${!isTeamPath ? 'animate-in fade-in slide-in-from-bottom-4 duration-700' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-dark-950 dark:text-gray-50">
                            {isTeamPath ? "Team Leave & Entitlements" : "My Leaves"}
                        </h1>
                        {!isTeamPath && (
                            tenureMonths < 3 ? (
                                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">
                                    Probation: {tenureMonths}/3 Months
                                </span>
                            ) : (
                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                                    Fully Eligible
                                </span>
                            )
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-gray-500 dark:text-gray-400">
                            {isTeamPath ? "Review team requests and manage entitlements" : "View balances and track your applications"}
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowPolicyModal(true)}
                            className="text-purple-600 text-sm font-bold flex items-center gap-1 hover:underline"
                        >
                            <Info className="w-4 h-4" />
                            MOM Policy Guide
                        </button>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => setShowApplyModal(true)}
                        className="flex items-center gap-2 bg-dark-950 text-white px-6 py-3 rounded-[16px] font-semibold hover:bg-dark-900 transition-all shadow-lg shadow-dark-950/10 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Apply for Leave
                    </button>

                    {isTeamPath && user?.is_tenant_admin && (
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                            <button
                                onClick={() => setViewMode('management')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${viewMode === 'management' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                Team Management
                            </button>
                            <button
                                onClick={() => setViewMode('entitlements')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${viewMode === 'entitlements' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                Entitlements
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {viewMode === 'personal' ? (
                <>
                    {/* Balances Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {balances.map((bal) => (
                            <div key={bal.leave_type_code} className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20 relative overflow-hidden group hover:border-purple-100 transition-colors">
                                {bal.is_statutory && (
                                    <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-600 rounded-md text-[10px] font-bold border border-purple-100">
                                        <ShieldCheck className="w-3 h-3" />
                                        MOM STATUTORY
                                    </div>
                                )}
                                <div className="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Calendar className="w-16 h-16 text-purple-600" />
                                </div>
                                <p className="text-sm text-gray-400 dark:text-gray-500 font-medium mb-1">{bal.leave_type_name}</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-dark-950 dark:text-gray-50">{bal.available_days}</p>
                                    <p className="text-sm text-gray-400 dark:text-gray-500">days available</p>
                                </div>

                                <div className="mt-4 flex flex-col gap-2">
                                    <div className="flex gap-4 text-xs font-medium border-b border-gray-50 pb-2">
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Total: {bal.total_days}</span>
                                        <span className="text-amber-600 dark:text-amber-400 font-bold">Used: {bal.used_days}</span>
                                    </div>

                                    {bal.leave_type_code === 'SICK' && bal.tenure_months < 6 && (
                                        <p className="text-[10px] text-purple-500 flex items-center gap-1 font-bold italic">
                                            <TrendingUp className="w-3 h-3" />
                                            Next increase at {bal.tenure_months + 1} months tenure
                                        </p>
                                    )}

                                    {bal.pool_code && (
                                        <p className="text-[10px] text-amber-500 flex items-center gap-1 font-bold italic">
                                            <AlertCircle className="w-3 h-3" />
                                            Shared Pool: {bal.pool_code.replace('_', ' ')}
                                        </p>
                                    )}

                                    {bal.leave_type_code === 'CHILDCARE' && (
                                        <p className="text-[10px] text-dark-950 dark:text-gray-300 flex items-center gap-1 font-bold italic">
                                            <ShieldCheck className="w-3 h-3" />
                                            42-day lifetime cap applies
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* History Table */}
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-50 flex items-center gap-3">
                            <History className="w-6 h-6 text-purple-600" />
                            <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Recent Applications</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-800/50">
                                    <tr>
                                        <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Leave Type</th>
                                        <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Period</th>
                                        <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Days</th>
                                        <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {requests.map((req) => (
                                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800/50 transition-colors group">
                                            <td className="px-8 py-5">
                                                <p className="font-semibold text-dark-950 dark:text-gray-50">{req.leave_type?.name || 'Annual Leave'}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                                    <span>{new Date(req.start_date).toLocaleDateString()}</span>
                                                    <ChevronRight className="w-4 h-4" />
                                                    <span>{new Date(req.end_date).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-dark-950 dark:text-gray-50 font-medium">{req.days_count}</td>
                                            <td className="px-8 py-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${req.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                                                    req.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' :
                                                        'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                                    }`}>
                                                    {req.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> :
                                                        req.status === 'rejected' ? <XCircle className="w-3 h-3" /> :
                                                            <Clock className="w-3 h-3" />}
                                                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : viewMode === 'management' ? (
                /* Management Table */
                <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-6 h-6 text-purple-600" />
                            <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Team Leave Requests</h2>
                        </div>
                        <div className="flex gap-2 text-xs">
                            <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md font-bold">Pending: {allRequests.filter(r => r.status === 'pending').length}</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                                <tr>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Leave Type</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Period</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Days</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {allRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div>
                                                <p className="font-bold text-dark-950 dark:text-gray-50">{req.employee_name}</p>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest">{req.employee_code}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="font-semibold text-dark-950 dark:text-gray-50">{req.leave_type_name}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                                <span>{new Date(req.start_date).toLocaleDateString()}</span>
                                                <ChevronRight className="w-4 h-4" />
                                                <span>{new Date(req.end_date).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-dark-950 dark:text-gray-50 font-medium">{req.days_count}</td>
                                        <td className="px-8 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${req.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                                                req.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' :
                                                    'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                                }`}>
                                                {req.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> :
                                                    req.status === 'rejected' ? <XCircle className="w-3 h-3" /> :
                                                        <Clock className="w-3 h-3" />}
                                                {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            {req.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleUpdateStatus(req.id, 'approved')}
                                                        disabled={processingId === req.id}
                                                        className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                                        title="Approve"
                                                    >
                                                        {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(req.id, 'rejected')}
                                                        disabled={processingId === req.id}
                                                        className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50"
                                                        title="Reject"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Entitlements Admin View */
                <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-gray-950/20 overflow-hidden text-dark-950 dark:text-gray-50">
                    <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 font-display">
                            <ShieldCheck className="w-6 h-6 text-purple-600" />
                            <h2 className="text-xl font-bold">Entitlement Management</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    setError(null);
                                    setShowAddEntitlementModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-dark-950 text-white rounded-lg text-sm font-bold hover:bg-dark-900 transition-all shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> Add Entitlement
                            </button>
                            <input
                                type="text"
                                placeholder="Search employee..."
                                value={entitlementSearch}
                                onChange={(e) => setEntitlementSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchEntitlementData()}
                                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:border-purple-500 bg-white dark:bg-gray-800"
                            />
                            <select
                                value={entitlementYear}
                                onChange={(e) => setEntitlementYear(parseInt(e.target.value))}
                                className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800"
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <button
                                onClick={fetchEntitlementData}
                                className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                            >
                                <Clock className="w-4 h-4" />
                            </button>
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl ml-2">
                                <button
                                    onClick={() => toggleAllEmployees(true)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white dark:hover:bg-gray-700 transition-all text-gray-500 hover:text-purple-600"
                                >
                                    Expand All
                                </button>
                                <button
                                    onClick={() => toggleAllEmployees(false)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white dark:hover:bg-gray-700 transition-all text-gray-500 hover:text-purple-600"
                                >
                                    Collapse All
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                                <tr>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Leave Type</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Used/Pending</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Available</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Carried</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {groupedEntitlements.map((group) => {
                                    const isExpanded = expandedEmployees.has(group.employment_id);
                                    return (
                                        <React.Fragment key={group.employment_id}>
                                            <tr
                                                className="bg-gray-50/50 dark:bg-gray-800/20 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/40 transition-colors"
                                                onClick={() => toggleEmployee(group.employment_id)}
                                            >
                                                <td colSpan={6} className="px-8 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors">
                                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-purple-600" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold text-dark-950 dark:text-gray-50">{group.employee_name}</div>
                                                            <div className="text-[10px] text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-full uppercase tracking-widest">{group.employee_code}</div>
                                                        </div>
                                                        <div className="text-[10px] font-bold text-gray-400 ml-auto">
                                                            {group.entitlements.length} Entitlements
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && group.entitlements.map((ent) => (
                                                <tr key={ent.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors animate-in slide-in-from-top-1 duration-200">
                                                    <td className="px-8 py-4 pl-16">
                                                        {/* Indented indicator */}
                                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-200" />
                                                    </td>
                                                    <td className="px-8 py-4 text-sm font-semibold">{ent.leave_type_name}</td>
                                                    <td className="px-8 py-4 text-sm font-bold text-purple-600">{ent.total_days}</td>
                                                    <td className="px-8 py-4 text-xs font-medium text-gray-500">{ent.used_days} / {ent.pending_days}</td>
                                                    <td className="px-8 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">{ent.available_days}</td>
                                                    <td className="px-8 py-4 text-sm text-amber-600 font-bold">{ent.carried_over_days}</td>
                                                    <td className="px-8 py-4">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setError(null);
                                                                setEditingEntitlement({ ...ent });
                                                            }}
                                                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all text-xs font-bold flex items-center gap-1"
                                                        >
                                                            <TrendingUp className="w-4 h-4" /> Adjust
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>

                        </table>
                    </div>
                </div>
            )}

            {/* Apply Modal */}
            {showApplyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-dark-950/40 backdrop-blur-sm" onClick={() => !submitting && setShowApplyModal(false)} />
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] w-full max-w-[500px] relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-dark-950 dark:text-gray-50">
                        <form onSubmit={handleApply}>
                            <div className="p-8">
                                <h2 className="text-2xl font-bold mb-6 font-display">Apply for Leave</h2>

                                {error && (
                                    <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-sm">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {viewMode === 'management' && (
                                        <SearchableSelect
                                            label="Select Employee"
                                            required
                                            placeholder="Search employee by name or code..."
                                            options={employees.map(emp => ({
                                                id: emp.id,
                                                label: emp.full_name,
                                                sublabel: emp.employee_code
                                            }))}
                                            value={formData.employment_id}
                                            onChange={(val) => setFormData({ ...formData, employment_id: val })}
                                        />
                                    )}
                                    <SearchableSelect
                                        label="Leave Type"
                                        required
                                        placeholder="Search leave type..."
                                        options={leaveTypes.map(t => ({
                                            id: t.id,
                                            label: t.name,
                                            sublabel: t.code
                                        }))}
                                        value={formData.leave_type_id}
                                        onChange={(val) => setFormData({ ...formData, leave_type_id: val })}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <DatePicker
                                            label="Start Date"
                                            required
                                            value={formData.start_date}
                                            onChange={(val) => setFormData({ ...formData, start_date: val })}
                                        />
                                        <DatePicker
                                            label="End Date"
                                            required
                                            align="right"
                                            value={formData.end_date}
                                            onChange={(val) => setFormData({ ...formData, end_date: val })}
                                        />
                                    </div>

                                    {/* Phase 3: Conditional Birth Date */}
                                    {leaveTypes.find(t => t.id === formData.leave_type_id)?.code &&
                                        ['PATERNITY', 'MATERNITY', 'SHARED_PARENTAL'].includes(leaveTypes.find(t => t.id === formData.leave_type_id).code) && (
                                            <div className="animate-in slide-in-from-top-2 duration-300">
                                                <DatePicker
                                                    label="Child Birth Date"
                                                    required
                                                    value={formData.child_birth_date}
                                                    onChange={(val) => setFormData({ ...formData, child_birth_date: val })}
                                                />
                                                <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    Entitlement depends on birth date
                                                </p>
                                            </div>
                                        )}

                                    {/* Phase 4: Maternity Child Order */}
                                    {leaveTypes.find(t => t.id === formData.leave_type_id)?.code === 'MATERNITY' && (
                                        <div className="animate-in slide-in-from-top-2 duration-300">
                                            <label className="block text-sm font-bold mb-2">Child Order</label>
                                            <select
                                                className="w-full h-[52px] p-4 rounded-[16px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-purple-500 outline-none"
                                                required
                                                value={formData.child_order}
                                                onChange={(e) => setFormData({ ...formData, child_order: e.target.value })}
                                            >
                                                <option value="">Select Child Order</option>
                                                <option value="1">1st Child</option>
                                                <option value="2">2nd Child</option>
                                                <option value="3">3rd Child</option>
                                                <option value="4">4th Child</option>
                                                <option value="5">5th Child or Later</option>
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-bold mb-2">Reason (Optional)</label>
                                        <textarea
                                            value={formData.reason}
                                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                            className="w-full p-4 rounded-[16px] border border-gray-200 dark:border-gray-700 focus:border-purple-500 outline-none h-24 bg-white dark:bg-gray-800 resize-none"
                                            placeholder="Why are you taking leave?"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => setShowApplyModal(false)}
                                    className="flex-1 h-[52px] rounded-[16px] font-bold text-gray-500 hover:bg-gray-100 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-dark-950 text-white h-[52px] rounded-[16px] font-bold hover:bg-dark-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Application'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Policy Modal */}
            {showPolicyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-dark-950/40 backdrop-blur-md" onClick={() => setShowPolicyModal(false)} />
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] w-full max-w-[600px] relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-dark-950 dark:text-gray-50">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3 text-purple-600">
                                    <ShieldCheck className="w-8 h-8" />
                                    <h2 className="text-2xl font-bold font-display">MOM Policy Guide</h2>
                                </div>
                                <button onClick={() => setShowPolicyModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                                    <X className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>

                            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                                <section>
                                    <h3 className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                        Eligibility Barrier
                                    </h3>
                                    <p className="text-sm text-gray-500 leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                                        Continuous service for 3 months required for statutory leave.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Annual Leave
                                    </h3>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl space-y-2">
                                        <div className="flex justify-between text-xs font-medium"><span>1st Year</span><span>7 Days</span></div>
                                        <div className="flex justify-between text-xs font-medium"><span>2nd Year</span><span>8 Days</span></div>
                                        <div className="flex justify-between text-xs pt-1 border-t border-gray-200 mt-1"><span className="text-purple-600 font-bold">Max</span><span className="font-bold">14 Days</span></div>
                                    </div>
                                </section>
                            </div>
                        </div>
                        <div className="p-8 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                            <button onClick={() => setShowPolicyModal(false)} className="bg-dark-950 text-white px-8 h-[52px] rounded-[16px] font-bold">Understand</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Entitlement Modal */}
            {editingEntitlement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-dark-950/40 backdrop-blur-md" onClick={() => !submitting && setEditingEntitlement(null)} />
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] w-full max-w-[400px] relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-dark-950 dark:text-gray-50">
                        <div className="p-8">
                            <h2 className="text-xl font-bold mb-2">Adjust Entitlement</h2>
                            <p className="text-sm text-gray-500 mb-6">{editingEntitlement.employee_name} ({editingEntitlement.leave_type_name})</p>

                            {error && (
                                <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 rounded-2xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <p className="font-medium">{error}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">Total Days</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={editingEntitlement.total_days}
                                        onChange={(e) => setEditingEntitlement({ ...editingEntitlement, total_days: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:border-purple-500 bg-white dark:bg-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">Carried Over Days</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={editingEntitlement.carried_over_days}
                                        onChange={(e) => setEditingEntitlement({ ...editingEntitlement, carried_over_days: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 outline-none focus:border-purple-500 bg-white dark:bg-gray-800"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                            <button
                                disabled={submitting}
                                onClick={() => setEditingEntitlement(null)}
                                className="flex-1 py-3 rounded-2xl font-bold text-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={submitting}
                                onClick={handleUpdateEntitlement}
                                className="flex-1 bg-dark-950 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Entitlement Modal */}
            {showAddEntitlementModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-dark-950/40 backdrop-blur-sm" onClick={() => setShowAddEntitlementModal(false)} />
                    <div className="relative bg-white dark:bg-gray-900 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-dark-950 dark:text-gray-50">Add Entitlement</h3>
                                <p className="text-sm text-gray-500">Create a manual leave balance record</p>
                            </div>
                            <button onClick={() => setShowAddEntitlementModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        {error && (
                            <div className="m-8 mb-0 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 rounded-2xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p className="font-medium">{error}</p>
                            </div>
                        )}

                        <div className="p-8 space-y-6">
                            <SearchableSelect
                                label="Select Employee"
                                options={employees.map(emp => ({ id: emp.id, label: `${emp.full_name} (${emp.employee_code})` }))}
                                value={newEntitlement.employment_id}
                                onChange={(val) => setNewEntitlement({ ...newEntitlement, employment_id: val })}
                                placeholder="Search for employee..."
                            />

                            <SearchableSelect
                                label="Leave Type"
                                options={leaveTypes.map(lt => ({ id: lt.id, label: lt.name }))}
                                value={newEntitlement.leave_type_id}
                                onChange={(val) => setNewEntitlement({ ...newEntitlement, leave_type_id: val })}
                                placeholder="Select leave type..."
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-2">Year</label>
                                    <input
                                        type="number"
                                        value={newEntitlement.year}
                                        onChange={(e) => setNewEntitlement({ ...newEntitlement, year: parseInt(e.target.value) })}
                                        className="w-full h-[52px] p-4 rounded-[16px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2">Total Days</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={newEntitlement.total_days}
                                        onChange={(e) => setNewEntitlement({ ...newEntitlement, total_days: parseFloat(e.target.value) })}
                                        className="w-full h-[52px] p-4 rounded-[16px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-purple-500 outline-none font-bold text-purple-600"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-2">Carried Over Days</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={newEntitlement.carried_over_days}
                                    onChange={(e) => setNewEntitlement({ ...newEntitlement, carried_over_days: parseFloat(e.target.value) })}
                                    className="w-full h-[52px] p-4 rounded-[16px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-purple-500 outline-none text-amber-600"
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                            <button
                                onClick={() => setShowAddEntitlementModal(false)}
                                className="flex-1 h-[52px] rounded-[16px] font-bold text-gray-500 hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateEntitlement}
                                disabled={submitting}
                                className="flex-1 bg-dark-950 text-white h-[52px] rounded-[16px] font-bold hover:bg-dark-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Entitlement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveManagement;
