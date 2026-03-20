import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';
import { 
    ClipboardCheck, CheckCircle2, XCircle, Clock, 
    Search, Filter, ExternalLink, Camera, Loader2,
    Check, X, AlertCircle, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import { Permission } from '../../types/permissions';
import { ShieldAlert } from 'lucide-react';

interface ClaimRequest {
    id: string;
    title: string;
    amount: number;
    claim_date: string;
    status: string;
    description: string;
    receipts: { id: string, receipt_url: string, filename: string }[];
    employment_id: string;
    category?: { name: string };
    // Employee details might be joined or fetched separately
}

const ClaimsAdmin: React.FC = () => {
    const { user } = useAuthStore();
    const { hasPermission } = usePermissions();
    const [claims, setClaims] = useState<ClaimRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);
    
    if (!hasPermission(Permission.APPROVE_CLAIM)) {
        return (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/10">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">Access Denied</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                    You do not have the required permission (`approve_claim`) to access the claims approval dashboard.
                </p>
            </div>
        );
    }
    
    // New Modal States
    const [showActionModal, setShowActionModal] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
    const [modalAction, setModalAction] = useState<'approved' | 'rejected' | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchClaims = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/v1/claims/approvals', {
                params: { 
                    status: statusFilter,
                    entity_id: user?.selected_entity_id 
                }
            });
            setClaims(res.data);
        } catch (error) {
            console.error('Failed to fetch claims', error);
            toast.error('Could not load claims for approval');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.selected_entity_id) {
            fetchClaims();
        }
    }, [statusFilter, user?.selected_entity_id]);

    const handleAction = (claim: ClaimRequest, action: 'approved' | 'rejected') => {
        setSelectedClaim(claim);
        setModalAction(action);
        setRejectionReason('');
        setShowActionModal(true);
    };

    const confirmAction = async () => {
        if (!selectedClaim || !modalAction) return;
        
        if (modalAction === 'rejected' && !rejectionReason.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }

        try {
            setProcessingId(selectedClaim.id);
            setShowActionModal(false);
            await api.patch(`/api/v1/claims/${selectedClaim.id}/status`, {
                status: modalAction,
                rejection_reason: rejectionReason
            });
            toast.success(`Claim ${modalAction === 'approved' ? 'approved' : 'rejected'} successfully`);
            fetchClaims();
        } catch (error) {
            console.error('Action failed', error);
            toast.error('Failed to update claim status');
        } finally {
            setProcessingId(null);
            setSelectedClaim(null);
            setModalAction(null);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-bold font-['Outfit'] text-dark-950 dark:text-gray-50 tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        Claims Approval
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Review and process employee expense claims for payroll reimbursement.</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-2xl w-fit">
                {['pending', 'approved', 'rejected', 'paid'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={clsx(
                            "px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                            statusFilter === status 
                                ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Claims Table */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Claim / Date</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Employee / Dept</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Category</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Actions</th>
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
                                            <AlertCircle className="w-8 h-8" />
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium italic text-lg">No {statusFilter} claims to show.</p>
                                    </td>
                                </tr>
                            ) : (
                                claims.map((claim) => (
                                    <tr key={claim.id} className="group hover:bg-gray-50/50 dark:hover:bg-primary-900/5 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-dark-950 dark:text-gray-50">{claim.title}</span>
                                                <span className="text-xs text-gray-500 font-medium mt-0.5">{format(new Date(claim.claim_date), 'dd MMM yyyy')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Employee ID: {claim.employment_id.slice(0, 8)}...</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Department Alpha</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                                                {claim.category?.name || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 font-['Outfit'] font-bold text-dark-900 dark:text-gray-100 text-lg">
                                            S${claim.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-5 text-right text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {claim.receipts && claim.receipts.length > 0 && (
                                                    <div className="flex flex-wrap justify-end gap-1 max-w-[150px]">
                                                        {claim.receipts.map((r, idx) => (
                                                            <a 
                                                                key={r.id}
                                                                href={api.defaults.baseURL + r.receipt_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all" 
                                                                title={r.filename}
                                                            >
                                                                <Camera className="w-4 h-4" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {claim.status === 'pending' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleAction(claim, 'rejected')}
                                                            disabled={processingId === claim.id}
                                                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                                                            title="Reject Claim"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAction(claim, 'approved')}
                                                            disabled={processingId === claim.id}
                                                            className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-200 dark:shadow-emerald-900/20"
                                                            title="Approve Claim"
                                                        >
                                                            <Check className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                                
                                                {claim.status !== 'pending' && (
                                                    <div className="px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                        Processed
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Action Modal */}
            <AnimatePresence>
                {showActionModal && selectedClaim && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowActionModal(false)}
                            className="absolute inset-0 bg-dark-950/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/20 dark:border-gray-800"
                        >
                            <div className="p-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={clsx(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg",
                                        modalAction === 'approved' 
                                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-emerald-200/50" 
                                            : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 shadow-rose-200/50"
                                    )}>
                                        {modalAction === 'approved' ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit'] tracking-tight">
                                            {modalAction === 'approved' ? 'Approve Claim' : 'Reject Claim'}
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">
                                            {selectedClaim.title} • S${selectedClaim.amount.toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {modalAction === 'approved' ? (
                                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-6 border border-emerald-100/50 dark:border-emerald-800/30 mb-8">
                                        <p className="text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed font-medium">
                                            Are you sure you want to approve this claim? This action will mark the claim as ready for payroll reimbursement.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 mb-8">
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                                            Reason for Rejection <span className="text-rose-500 font-black">*</span>
                                        </label>
                                        <textarea
                                            placeholder="e.g., Missing receipt details, incorrect amount, not business related..."
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            className="w-full h-32 px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium placeholder:text-gray-400 resize-none"
                                        />
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowActionModal(false)}
                                        className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmAction}
                                        className={clsx(
                                            "flex-2 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all shadow-xl active:scale-95",
                                            modalAction === 'approved'
                                                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-emerald-900/20"
                                                : "bg-rose-600 hover:bg-rose-700 shadow-rose-200 dark:shadow-rose-900/20"
                                        )}
                                    >
                                        {modalAction === 'approved' ? 'Confirm Approval' : 'Reject Claim'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClaimsAdmin;
