import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Printer,
    Download,
    Building,
    User,
    Wallet,
    Calendar,
    BadgeCheck,
    Briefcase
} from 'lucide-react';
import api from '../services/api';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';

const Payslip = () => {
    const { id, record_id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecord = async () => {
            try {
                const response = await api.get(`/api/v1/payroll/records/${record_id}`);
                setRecord(response.data);
            } catch (error) {
                console.error("Failed to fetch payslip", error);
                toast.error("Payslip not found");
            } finally {
                setLoading(false);
            }
        };
        fetchRecord();
    }, [record_id]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
    );

    if (!record) return (
        <div className="p-12 text-center">
            <p className="text-gray-500">Payslip not found.</p>
            <button onClick={() => navigate(`/payroll/${id}`)} className="mt-4 text-primary-600 font-bold underline">Return to batch</button>
        </div>
    );

    const handlePrint = () => {
        window.print();
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-SG', {
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-32">
            {/* Action Bar - Hidden in Print */}
            <div className="flex items-center justify-between mb-8 print:hidden">
                <button
                    onClick={() => {
                        if (location.pathname.startsWith('/me')) {
                            navigate('/me/payslips');
                        } else {
                            navigate(`/payroll/${id}`);
                        }
                    }}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to List
                </button>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2.5 bg-dark-950 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg"
                    >
                        <Printer className="w-4 h-4" />
                        Print Payslip
                    </button>
                </div>
            </div>

            {/* Payslip Document */}
            <div className="bg-white rounded-[32px] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden print:shadow-none print:border-none print:rounded-none">
                {/* Header */}
                <div className="bg-gray-50/50 p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-8">
                    <div className="space-y-4">
                        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-primary-200">
                            HR
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-dark-950 uppercase tracking-tight">{record.entity_name || 'EZYHR PTE LTD'}</h2>
                            <p className="text-sm text-gray-500 font-medium">UEN: {record.entity_uen || '199012345G'}</p>
                            <p className="text-xs text-gray-400 mt-1">123 Business Way, Singapore 123456</p>
                        </div>
                    </div>
                    <div className="text-right space-y-2">
                        <h1 className="text-3xl font-black text-dark-950 font-['Outfit'] tracking-tight">PAYSLIP</h1>
                        <div className="inline-flex items-center gap-2 bg-primary-50 px-4 py-2 rounded-xl border border-primary-100">
                            <Calendar className="w-4 h-4 text-primary-600" />
                            <span className="text-sm font-bold text-primary-700">{formatDate(record.period)}</span>
                        </div>
                    </div>
                </div>

                {/* Info Bar */}
                <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-8 bg-white border-b border-gray-50">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee Name</p>
                        <p className="text-sm font-bold text-dark-950">{record.employee_name.toUpperCase()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee ID</p>
                        <p className="text-sm font-bold text-dark-950">{record.employee_code || 'EMP-001'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date of Payment</p>
                        <p className="text-sm font-bold text-dark-950">{new Date(record.period).toLocaleDateString('en-SG')}</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">NRIC / FIN</p>
                        <p className="text-sm font-bold text-dark-950">••••••123A</p>
                    </div>
                </div>

                {/* Main Content: Earnings & Deductions */}
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Itemized Breakdown */}
                    <div className="p-8 space-y-8 border-r border-gray-50">
                        {/* Earnings */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b-2 border-primary-100">
                                <h3 className="text-xs font-black text-primary-600 uppercase tracking-widest">Items of Earnings</h3>
                                <span className="text-xs font-black text-primary-600 uppercase tracking-widest">Amount (SGD)</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm font-medium text-gray-600">Basic Salary</span>
                                    <span className="text-sm font-black text-dark-950">${Number(record.basic_salary).toFixed(2)}</span>
                                </div>
                                {record.overtime_pay > 0 && (
                                    <div className="space-y-2 py-3 bg-gray-50/50 rounded-xl px-3 border border-gray-100/50">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Overtime Breakdown</span>
                                            <span className="text-[10px] font-bold text-gray-400">Rate: ${Number(record.breakdown?.hourly_rate || 0).toFixed(2)}/hr</span>
                                        </div>

                                        {record.breakdown?.ot_1_5?.hours > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-600">OT 1.5x ({Number(record.breakdown.ot_1_5.hours).toFixed(1)} hrs)</span>
                                                <span className="text-sm font-black text-dark-950">${Number(record.breakdown.ot_1_5.amount).toFixed(2)}</span>
                                            </div>
                                        )}

                                        {record.breakdown?.ot_2_0?.hours > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-600">OT 2.0x ({Number(record.breakdown.ot_2_0.hours).toFixed(1)} hrs)</span>
                                                <span className="text-sm font-black text-dark-950">${Number(record.breakdown.ot_2_0.amount).toFixed(2)}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100">
                                            <span className="text-sm font-bold text-dark-950 px-2 bg-primary-100/50 rounded-lg text-primary-700">Total OT Pay</span>
                                            <span className="text-sm font-black text-dark-950">${Number(record.overtime_pay).toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                                {record.aws_amount > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">AWS (13th Month)</span>
                                        <span className="text-sm font-black text-dark-950">${Number(record.aws_amount).toFixed(2)}</span>
                                    </div>
                                )}
                                {record.breakdown?.allowances?.map((item: any, idx: number) => (
                                    <div key={`allowance-${idx}`} className="flex justify-between items-center group">
                                        <span className="text-sm font-medium text-gray-600">{item.name}</span>
                                        <span className="text-sm font-black text-dark-950">${Number(item.amount).toFixed(2)}</span>
                                    </div>
                                ))}
                                {!record.breakdown?.allowances && record.fixed_allowances > 0 && (
                                    <div className="flex justify-between items-center text-gray-600 italic">
                                        <span className="text-sm font-medium">Other Allowances</span>
                                        <span className="text-sm font-black">${Number(record.fixed_allowances).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Total Gross */}
                        <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center border border-gray-100">
                            <span className="text-sm font-black text-dark-950 uppercase">Total Gross Pay</span>
                            <span className="text-lg font-black text-dark-950">${Number(record.gross_salary).toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Deductions & Contributions */}
                    <div className="p-8 space-y-8 bg-gray-50/20">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b-2 border-rose-100">
                                <h3 className="text-xs font-black text-rose-600 uppercase tracking-widest">Deductions</h3>
                                <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Amount (SGD)</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-600">Employee CPF (20%)</span>
                                    <span className="text-sm font-black text-rose-600">-${Number(record.cpf_employee).toFixed(2)}</span>
                                </div>
                                {record.shg_deduction > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">SHG Contribution ({record.breakdown?.shg_type})</span>
                                        <span className="text-sm font-black text-rose-600">-${Number(record.shg_deduction).toFixed(2)}</span>
                                    </div>
                                )}
                                {record.breakdown?.deductions?.map((item: any, idx: number) => (
                                    <div key={`deduction-${idx}`} className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">{item.name}</span>
                                        <span className="text-sm font-black text-rose-600">-${Number(item.amount).toFixed(2)}</span>
                                    </div>
                                ))}
                                {record.unpaid_leave_deduction > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Unpaid Leave Deduction</span>
                                        <span className="text-sm font-black text-rose-600">-${Number(record.unpaid_leave_deduction).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Net Pay Final */}
                        <div className="bg-emerald-600 rounded-3xl p-6 text-white shadow-xl shadow-emerald-200">
                            <div className="flex flex-col gap-1">
                                <p className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.2em] mb-1">Net Amount Payable</p>
                                <div className="flex justify-between items-end">
                                    <p className="text-4xl font-black font-['Outfit'] tracking-tighter">${Number(record.net_salary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <div className="flex flex-col items-end opacity-80">
                                        <p className="text-[10px] font-bold">PAID VIA GIRO</p>
                                        <p className="text-[8px] font-medium">BANK: DBS/POSB</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Employer Contributions (Info only) */}
                        <div className="pt-6 border-t border-gray-100 space-y-4">
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Employer Contributions</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-white border border-gray-100 rounded-xl">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Employer CPF</p>
                                        <p className="text-xs font-black text-dark-950">${Number(record.cpf_employer).toFixed(2)}</p>
                                    </div>
                                    <div className="p-3 bg-white border border-gray-100 rounded-xl">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">SDL Contribution</p>
                                        <p className="text-xs font-black text-dark-950">${Number(record.sdl_contribution).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* CPF Allocation Breakup */}
                            {(record.cpf_oa > 0 || record.cpf_sa > 0 || record.cpf_ma > 0) && (
                                <div className="p-4 bg-indigo-50/50 rounded-[24px] border border-indigo-100/50">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-indigo-100/50">
                                        <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.1em]">Total CPF Contribution</h4>
                                        <span className="text-sm font-black text-indigo-600">${(Number(record.cpf_employee) + Number(record.cpf_employer)).toFixed(2)}</span>
                                    </div>

                                    <h4 className="text-[8px] font-bold text-indigo-400/60 uppercase tracking-[0.1em] mb-3">Account Allocation</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-center">
                                            <p className="text-[7px] font-bold text-indigo-300 uppercase">Ordinary (OA)</p>
                                            <p className="text-xs font-black text-indigo-600">${Number(record.cpf_oa).toFixed(2)}</p>
                                        </div>
                                        <div className="text-center border-x border-indigo-100">
                                            <p className="text-[7px] font-bold text-indigo-300 uppercase">Special (SA/RA)</p>
                                            <p className="text-xs font-black text-indigo-600">${Number(record.cpf_sa).toFixed(2)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[7px] font-bold text-indigo-300 uppercase">Medisave (MA)</p>
                                            <p className="text-xs font-black text-indigo-600">${Number(record.cpf_ma).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="p-8 flex items-center justify-between border-t border-gray-50 bg-gray-50/30">
                    <div className="flex items-center gap-2">
                        <BadgeCheck className="w-5 h-5 text-emerald-500" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Digitally Verified & Approved by EZYHR ENGINE</span>
                    </div>
                    <p className="text-[8px] text-gray-300 font-medium italic">This is a computer generated payslip and does not require a signature.</p>
                </div>
            </div>
        </div>
    );
};

export default Payslip;
