import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';
import {
    Receipt, Plus, Clock, CheckCircle2, XCircle,
    FileText, Camera, Loader2, DollarSign, Info, Search, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import ClaimFormModal from '../../components/claims/ClaimFormModal';

interface ClaimRequest {
    id: string;
    title: string;
    amount: number;
    claim_date: string;
    status: string;
    description: string;
    receipts: { id: string, receipt_url: string, filename: string }[];
    rejection_reason?: string;
    category?: { name: string };
}

const MyClaims: React.FC = () => {
    const { user } = useAuthStore();
    const [claims, setClaims] = useState<ClaimRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchClaims = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/v1/claims/my', {
                params: { entity_id: user?.selected_entity_id }
            });
            setClaims(res.data);
        } catch (error) {
            console.error('Failed to fetch claims', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.selected_entity_id) {
            fetchClaims();
        }
    }, [user?.selected_entity_id]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
            case 'rejected': return <XCircle className="w-4 h-4 text-rose-500" />;
            case 'paid': return <DollarSign className="w-4 h-4 text-primary-500" />;
            default: return <Clock className="w-4 h-4 text-amber-500" />;
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800';
            case 'rejected': return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border-rose-100 dark:border-rose-800';
            case 'paid': return 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 border-primary-100 dark:border-primary-800';
            default: return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-800';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-bold font-['Outfit'] text-dark-950 dark:text-gray-50 tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center">
                            <Receipt className="w-6 h-6" />
                        </div>
                        My Claims
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Track your expense reimbursements and professional claims.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 active:scale-[0.98] group"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    Submit New Claim
                </button>
            </div>

            <ClaimFormModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false);
                    fetchClaims();
                }}
                entityId={user?.selected_entity_id || ''}
            />

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Pending Approval', count: claims.filter(c => c.status === 'pending').length, color: 'amber', icon: Clock },
                    { label: 'Approved This Month', count: claims.filter(c => c.status === 'approved').length, color: 'emerald', icon: CheckCircle2 },
                    { label: 'Total Paid YTD', count: `S$${claims.filter(c => c.status === 'paid').reduce((acc, c) => acc + c.amount, 0).toLocaleString()}`, color: 'primary', icon: DollarSign },
                    { label: 'Rejected', count: claims.filter(c => c.status === 'rejected').length, color: 'rose', icon: XCircle }
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400 flex items-center justify-center`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{stat.label}</p>
                                <p className="text-xl font-bold text-dark-950 dark:text-gray-50">{stat.count}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Claims Table */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/5 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by title or category..."
                            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl text-sm focus:ring-2 ring-primary-500/20"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2.5 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Claim Details</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Category</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Receipt</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {loading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8 h-16 bg-gray-50/20 dark:bg-gray-800/10" />
                                    </tr>
                                ))
                            ) : claims.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                            <Receipt className="w-8 h-8" />
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium italic text-lg">No claims found yet.</p>
                                        <p className="text-sm text-gray-400">Submit your first claim to see it here.</p>
                                    </td>
                                </tr>
                            ) : (
                                claims.map((claim) => (
                                    <tr key={claim.id} className="group hover:bg-gray-50/50 dark:hover:bg-primary-900/5 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-dark-950 dark:text-gray-50 group-hover:text-primary-600 transition-colors">{claim.title}</span>
                                                <span className="text-xs text-gray-500 font-medium mt-0.5">{format(new Date(claim.claim_date), 'dd MMM yyyy')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                                {claim.category?.name || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="font-['Outfit'] font-bold text-dark-900 dark:text-gray-100 text-lg">
                                                S${claim.amount.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className={clsx(
                                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                                getStatusStyles(claim.status)
                                            )}>
                                                {getStatusIcon(claim.status)}
                                                {claim.status}
                                            </div>
                                            {claim.status === 'rejected' && claim.rejection_reason && (
                                                <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-500 font-bold max-w-xs">
                                                    <Info className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{claim.rejection_reason}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {claim.receipts && claim.receipts.length > 0 ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    {claim.receipts.map((r, idx) => (
                                                        <a 
                                                            key={r.id}
                                                            href={api.defaults.baseURL + r.receipt_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all inline-flex items-center gap-2 group/btn"
                                                        >
                                                            <Camera className="w-3.5 h-3.5" />
                                                            <span className="text-[10px] font-bold truncate max-w-[100px]">
                                                                {claim.receipts.length > 1 ? `Receipt ${idx + 1}` : 'View Receipt'}
                                                            </span>
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">No receipts</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MyClaims;
