import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileText,
    Calendar,
    Download,
    Eye,
    Loader2,
    CheckCircle2,
    DollarSign,
    TrendingUp,
    ChevronRight,
    Search
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const MyPayslips = () => {
    const navigate = useNavigate();
    const [slips, setSlips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSlips();
    }, []);

    const fetchSlips = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/v1/payroll/slips/me');
            setSlips(res.data);
        } catch (err) {
            console.error("Failed to fetch payslips", err);
            toast.error("Failed to load payslips");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-SG', {
            month: 'long',
            year: 'numeric'
        });
    };

    const filteredSlips = slips.filter(slip => 
        formatDate(slip.period).toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <h1 className="text-3xl font-black text-dark-950 dark:text-gray-50 font-premium mb-2">
                        My Payslips
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        View and download your monthly salary statements
                    </p>
                </div>
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by month..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-11 pr-6 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[16px] outline-none focus:border-primary-500 transition-all font-medium text-sm w-full sm:w-[280px] shadow-sm"
                    />
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-emerald-600 rounded-[32px] p-8 text-white shadow-xl shadow-emerald-200/50 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-xs font-black text-emerald-100 uppercase tracking-widest mb-1">Last Net Pay</p>
                        <h2 className="text-4xl font-black font-['Outfit'] mb-2">
                            ${slips.length > 0 ? Number(slips[0].net_salary).toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}
                        </h2>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-100 bg-white/10 px-2 py-1 rounded-full w-fit">
                            <TrendingUp className="w-3 h-3" />
                            {slips.length > 0 ? formatDate(slips[0].period) : 'N/A'}
                        </div>
                    </div>
                    <DollarSign className="absolute bottom-[-10%] right-[-10%] w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-500" />
                </div>
                
                <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-center">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Slips</p>
                    <h2 className="text-3xl font-black text-dark-950 dark:text-gray-50">{slips.length}</h2>
                    <p className="text-[10px] font-bold text-gray-400 mt-2">Statements available in portal</p>
                </div>

                <div className="bg-primary-50 rounded-[32px] p-8 border border-primary-100 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                    <p className="text-xs font-black text-primary-600 uppercase tracking-widest mb-1">Status</p>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-primary-600" />
                        <h2 className="text-xl font-bold text-primary-900">Digitally Verified</h2>
                    </div>
                    <FileText className="absolute bottom-[-10%] right-[-10%] w-24 h-24 text-primary-200/30 group-hover:rotate-12 transition-transform duration-500" />
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/10 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex items-center gap-3">
                    <FileText className="w-6 h-6 text-primary-600" />
                    <h2 className="text-xl font-bold text-dark-950 dark:text-gray-50">Payslip History</h2>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {filteredSlips.map((slip) => (
                        <div 
                            key={slip.id} 
                            className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all group"
                        >
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                                    <Calendar className="w-7 h-7 text-gray-400 group-hover:text-primary-600 transition-colors" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-dark-950 dark:text-gray-50">{formatDate(slip.period)}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{slip.entity_name}</span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                                        <span className="text-[10px] font-bold text-gray-500">UEN: {slip.entity_uen}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-row items-center gap-4 sm:gap-8 justify-between sm:justify-end">
                                <div className="text-right">
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Net Salary</p>
                                    <p className="text-2xl font-black text-dark-950 dark:text-gray-50 font-['Outfit'] tracking-tight">
                                        ${Number(slip.net_salary).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => navigate(`/me/payslips/${slip.id}`)}
                                        className="p-4 bg-dark-950 dark:bg-gray-800 text-white rounded-2xl hover:bg-primary-600 dark:hover:bg-primary-600 transition-all shadow-lg active:scale-95 flex items-center justify-center"
                                        title="View Payslip"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                    <button
                                        className="p-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-all active:scale-95 flex items-center justify-center"
                                        title="Download PDF"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredSlips.length === 0 && (
                        <div className="p-20 text-center">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FileText className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-dark-950 dark:text-gray-50 mb-2">No payslips found</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                                We couldn't find any payslips matching your search criteria.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyPayslips;
