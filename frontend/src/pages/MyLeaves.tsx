import React, { useState, useEffect } from 'react';
import {
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Plus,
    History,
    ChevronRight,
    Loader2,
    ShieldCheck,
    Info,
    TrendingUp
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import SearchableSelect from '../components/Common/SearchableSelect';
import DatePicker from '../components/DatePicker';
import toast from 'react-hot-toast';

const MyLeaves = () => {
    const { user } = useAuthStore();
    const [balances, setBalances] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tenureMonths, setTenureMonths] = useState(0);

    // Form State
    const [formData, setFormData] = useState({
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
    }, [user?.selected_entity_id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [balRes, reqRes, typeRes] = await Promise.all([
                api.get('/api/v1/leave/me/balances'),
                api.get('/api/v1/leave/me/requests'),
                api.get(`/api/v1/leave/types?entity_id=${user?.selected_entity_id}`)
            ]);
            setBalances(balRes.data);
            setRequests(reqRes.data);
            setLeaveTypes(typeRes.data);

            if (balRes.data.length > 0) {
                setTenureMonths(balRes.data[0].tenure_months || 0);
            }
        } catch (err) {
            console.error("Failed to fetch leave data", err);
            toast.error("Failed to load leave data");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const payload: any = { ...formData };

            // Clean up empty strings
            if (!payload.reason) delete payload.reason;
            if (!payload.attachment_url) delete payload.attachment_url;
            if (!payload.child_birth_date) delete payload.child_birth_date;
            if (!payload.child_order) delete payload.child_order;

            const res = await api.post('/api/v1/leave/me/apply', payload);

            if (res.data.status === 'success') {
                setShowApplyModal(false);
                fetchData();
                toast.success("Leave applied successfully!");
                setFormData({
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
            const msg = err.response?.data?.detail || "Failed to apply for leave";
            setError(msg);
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="max-w-[1200px] mx-auto p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-dark-950 dark:text-gray-50 font-premium">
                            My Leaves
                        </h1>
                        {tenureMonths < 3 ? (
                            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black border border-amber-200 uppercase tracking-wider">
                                Probation: {tenureMonths}/3 Mo
                            </span>
                        ) : (
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-200 uppercase tracking-wider">
                                Fully Eligible
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                        View your leave balances and track applications
                    </p>
                </div>
                <button
                    onClick={() => setShowApplyModal(true)}
                    className="flex items-center justify-center gap-2 bg-dark-950 dark:bg-primary-600 text-white px-6 py-3 rounded-[16px] font-bold hover:bg-dark-900 dark:hover:bg-primary-500 transition-all shadow-xl shadow-dark-950/10 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Apply for Leave
                </button>
            </div>

            {/* Balances Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {balances.map((bal) => (
                    <div key={bal.leave_type_code} className="bg-white dark:bg-gray-900 p-8 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group hover:border-primary-100 transition-all duration-300">
                        <div className="absolute bottom-[-10%] right-[-10%] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500">
                            <Calendar className="w-32 h-32 text-primary-600" />
                        </div>
                        
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{bal.leave_type_name}</p>
                            {bal.is_statutory && (
                                <ShieldCheck className="w-4 h-4 text-primary-400" />
                            )}
                        </div>
                        
                        <div className="flex items-baseline gap-2 mb-6">
                            <p className="text-4xl font-black text-dark-950 dark:text-gray-50">{bal.available_days}</p>
                            <p className="text-sm font-bold text-gray-400">Available</p>
                        </div>

                        <div className="space-y-3">
                            <div className="w-full bg-gray-50 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                <div 
                                    className="bg-primary-500 h-full rounded-full transition-all duration-1000" 
                                    style={{ width: `${Math.min(100, (bal.used_days / (bal.total_days || 1)) * 100)}%` }} 
                                />
                            </div>
                            <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-emerald-600 dark:text-emerald-400 uppercase">Entitled: {bal.total_days}</span>
                                <span className="text-amber-600 dark:text-amber-400 uppercase">Used: {bal.used_days}</span>
                            </div>
                        </div>

                        {bal.pool_code && (
                            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                    Shared Pool: {bal.pool_code.replace('_', ' ')}
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* History Table */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex items-center gap-3">
                    <History className="w-6 h-6 text-primary-600" />
                    <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Recent Applications</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                            <tr>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Leave Type</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Period</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Days</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {requests.map((req) => (
                                <tr key={req.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors">
                                    <td className="px-8 py-5">
                                        <p className="font-bold text-dark-950 dark:text-gray-50">{req.leave_type_name}</p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">{new Date(req.created_at).toLocaleDateString()}</p>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                                            <span>{new Date(req.start_date).toLocaleDateString()}</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300" />
                                            <span>{new Date(req.end_date).toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="font-black text-dark-950 dark:text-gray-50">{req.days_count}</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            req.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                                            req.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' :
                                            'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                        }`}>
                                            {req.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                                            req.status === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> :
                                            <Clock className="w-3.5 h-3.5" />}
                                            {req.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-gray-400">
                                        No recent applications found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Apply Modal */}
            {showApplyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-dark-950/40 backdrop-blur-sm" onClick={() => !submitting && setShowApplyModal(false)} />
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] w-full max-w-[500px] relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-dark-950 dark:text-gray-50">
                        <form onSubmit={handleApply}>
                            <div className="p-8">
                                <h2 className="text-2xl font-black mb-6 font-premium">Apply for Leave</h2>

                                {error && (
                                    <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/50 rounded-2xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-sm animate-in shake duration-500">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <p className="font-bold">{error}</p>
                                    </div>
                                )}

                                <div className="space-y-6">
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

                                    {/* Statutory Logic Support */}
                                    {leaveTypes.find(t => t.id === formData.leave_type_id)?.code &&
                                        ['PATERNITY', 'MATERNITY', 'SHARED_PARENTAL'].includes(leaveTypes.find(t => t.id === formData.leave_type_id).code) && (
                                            <div className="animate-in slide-in-from-top-2 duration-300">
                                                <DatePicker
                                                    label="Child Birth Date"
                                                    required
                                                    value={formData.child_birth_date}
                                                    onChange={(val) => setFormData({ ...formData, child_birth_date: val })}
                                                />
                                            </div>
                                        )}

                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Reason (Optional)</label>
                                        <textarea
                                            value={formData.reason}
                                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                            className="w-full p-4 rounded-[20px] border border-gray-200 dark:border-gray-700 focus:border-primary-500 outline-none h-24 bg-white dark:bg-gray-800 resize-none transition-colors"
                                            placeholder="Why are you taking leave?"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => setShowApplyModal(false)}
                                    className="flex-1 h-[56px] rounded-[20px] font-bold text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-dark-950 dark:bg-primary-600 text-white h-[56px] rounded-[20px] font-bold hover:bg-dark-900 dark:hover:bg-primary-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-primary-500/20"
                                >
                                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Application'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyLeaves;
