import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';
import {
    Receipt, Plus, Clock, CheckCircle2, XCircle,
    FileText, Camera, Loader2, DollarSign, Info, Search, Users, User, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import ClaimFormModal from '../../components/claims/ClaimFormModal';
import { usePermissions } from '../../hooks/usePermissions';
import { Permission } from '../../types/permissions';
import { ShieldAlert } from 'lucide-react';

interface Employee {
    id: string; // employment_id
    full_name: string;
    employee_code: string;
    department_name: string;
}

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

const TeamClaims: React.FC = () => {
    const { user } = useAuthStore();
    const { hasPermission } = usePermissions();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [claims, setClaims] = useState<ClaimRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [employeesLoading, setEmployeesLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const entityId = user?.selected_entity_id || '';

    if (!hasPermission(Permission.SUBMIT_TEAM_CLAIM)) {
        return (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/10">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">Access Denied</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                    You do not have the required permission (`submit_team_claim`) to submit claims on behalf of other employees.
                </p>
            </div>
        );
    }

    const fetchEmployees = async () => {
        try {
            setEmployeesLoading(true);
            const res = await api.get('/api/v1/employees', { params: { entity_id: entityId } });
            setEmployees(res.data);
        } catch (error) {
            console.error('Failed to fetch employees', error);
        } finally {
            setEmployeesLoading(false);
        }
    };

    const fetchClaims = async (employmentId: string) => {
        try {
            setLoading(true);
            const res = await api.get('/api/v1/claims/approvals', {
                params: { 
                    entity_id: entityId,
                    employment_id: employmentId
                }
            });
            setClaims(res.data);
        } catch (error) {
            console.error('Failed to fetch claims', error);
            setClaims([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (entityId) {
            fetchEmployees();
        }
    }, [entityId]);

    useEffect(() => {
        if (selectedEmployee) {
            fetchClaims(selectedEmployee.id);
        } else {
            setClaims([]);
        }
    }, [selectedEmployee]);

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

    const filteredEmployees = employees.filter(emp => 
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-bold font-['Outfit'] text-dark-950 dark:text-gray-50 tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center">
                            <Users className="w-6 h-6" />
                        </div>
                        Team Claims
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Submit and manage claims on behalf of your team members.</p>
                </div>
                {selectedEmployee && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 dark:shadow-primary-900/30 active:scale-[0.98] group"
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        Submit for {selectedEmployee.full_name}
                    </button>
                )}
            </div>

            {/* Employee Selector */}
            <div className="max-w-md relative">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 block">Select Employee</label>
                <div 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:border-primary-500 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                            <User className="w-4 h-4" />
                        </div>
                        <span className={clsx("font-bold", selectedEmployee ? "text-dark-950 dark:text-gray-50" : "text-gray-400")}>
                            {selectedEmployee ? selectedEmployee.full_name : "Choose an employee..."}
                        </span>
                    </div>
                    <ChevronDown className={clsx("w-5 h-5 text-gray-400 transition-transform", isDropdownOpen && "rotate-180")} />
                </div>

                <AnimatePresence>
                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-2xl z-50 overflow-hidden"
                            >
                                <div className="p-4 border-b border-gray-50 dark:border-gray-800">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search employee..."
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>
                                <div className="max-h-60 overflow-y-auto p-2">
                                    {employeesLoading ? (
                                        <div className="p-4 text-center text-gray-400 italic">Loading employees...</div>
                                    ) : filteredEmployees.length === 0 ? (
                                        <div className="p-4 text-center text-gray-400 italic">No employees found.</div>
                                    ) : (
                                        filteredEmployees.map(emp => (
                                            <div
                                                key={emp.id}
                                                onClick={() => {
                                                    setSelectedEmployee(emp);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="flex items-center gap-3 p-3 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-2xl cursor-pointer transition-colors group"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-primary-600 transition-colors uppercase font-bold text-xs">
                                                    {emp.full_name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-dark-900 dark:text-gray-100">{emp.full_name}</span>
                                                    <span className="text-[10px] text-gray-500 font-medium">{emp.employee_code} • {emp.department_name}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {isModalOpen && selectedEmployee && (
                <ClaimFormModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        fetchClaims(selectedEmployee.id);
                    }}
                    entityId={entityId}
                    onBehalfOf={selectedEmployee.id}
                    employeeName={selectedEmployee.full_name}
                />
            )}

            {/* Claims Table Area */}
            {selectedEmployee ? (
                <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/5 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 font-bold text-dark-700 dark:text-gray-300">
                        Claims History for {selectedEmployee.full_name}
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
                                            <p className="text-gray-500 dark:text-gray-400 font-medium italic text-lg">No claims found for this employee.</p>
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
                                                                    View Receipt
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
            ) : (
                <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 p-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                        <Search className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold font-['Outfit'] text-dark-900 dark:text-gray-50 mb-2">Select an Employee</h2>
                    <p className="text-gray-500 dark:text-gray-400">Please choose a team member from the dropdown above to manage their claims.</p>
                </div>
            )}
        </div>
    );
};

export default TeamClaims;
