import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ChevronLeft,
    Printer,
    FileCheck,
    Edit3,
    Eye,
    Save,
    Download,
    Building,
    User,
    Calendar,
    Briefcase,
    DollarSign,
    HeartPulse,
    ShieldCheck,
    Send,
    FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { Permission } from '../types/permissions';
import toast from 'react-hot-toast';

import { clsx } from 'clsx';

interface KETData {
    id: string;
    employment_id: string;
    status: string;
    terms_json: any;
    version: number;
}

const KETEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ket, setKet] = useState<KETData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'employer' | 'employee' | 'employment' | 'salary' | 'benefits'>('employment');
    const [isSaving, setIsSaving] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);
    const { hasPermission } = usePermissions();

    if (!hasPermission(Permission.MANAGE_KET)) {
        return (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/10 h-[calc(100vh-200px)] flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">Access Denied</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto">You do not have permission to edit Key Employment Terms (KET).</p>
                <button
                    onClick={() => navigate('/ket')}
                    className="mt-8 px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }


    useEffect(() => {
        const loadData = async () => {
            try {
                // Try fetching as KET first
                try {
                    const response = await api.get(`/api/v1/ket/${id}`);
                    setKet(response.data);
                } catch (e) {
                    // If 404, might be an employment_id for generation
                    const genResponse = await api.post('/api/v1/ket/generate', { employment_id: id });
                    setKet(genResponse.data);
                    // Update URL without refresh to show ket_id
                    window.history.replaceState(null, '', `/ket/${genResponse.data.id}`);
                }
            } catch (error) {
                console.error("Failed to load KET data", error);
                toast.error("Error loading KET details");
                navigate('/ket');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id, navigate]);

    const handleIssue = async () => {
        if (!ket) return;
        setIsSaving(true);
        try {
            await api.patch(`/api/v1/ket/${ket.id}`, { status: 'issued' });
            toast.success("KET Issued Successfully");
            navigate('/ket');
        } catch (error) {
            toast.error("Failed to issue KET");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen animate-pulse">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl mx-auto flex items-center justify-center">
                        <FileCheck className="w-8 h-8 text-primary-600 animate-bounce" />
                    </div>
                    <p className="text-gray-500 font-bold font-['Outfit']">Preparing Snapshot...</p>
                </div>
            </div>
        );
    }

    if (!ket) return null;

    const terms = ket.terms_json;

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col gap-6 animate-fade-in print:p-0 print:m-0 print:h-auto overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white dark:bg-gray-950 p-4 rounded-[28px] border border-gray-100 dark:border-gray-800 shadow-sm print:hidden">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/ket')}
                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-dark-950 dark:text-gray-100 font-['Outfit']">
                            KET Preview <span className="text-primary-600">v{ket.version}</span>
                        </h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {terms.employee.name} • {ket.status}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="btn bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 border-none px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Print / PDF
                    </button>
                    {ket.status === 'draft' && (
                        <button
                            onClick={handleIssue}
                            disabled={isSaving}
                            className="btn btn-primary px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary-500/20"
                        >
                            <Send className="w-4 h-4" />
                            Issue KET
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden print:block print:overflow-visible">
                {/* Information Tabs (Sidebar for Editor) */}
                <div className="w-72 flex flex-col gap-2 print:hidden overflow-y-auto pr-2 nice-scrollbar">
                    {[
                        { id: 'employment', label: 'Employment', icon: Briefcase },
                        { id: 'salary', label: 'Salary & OT', icon: DollarSign },
                        { id: 'benefits', label: 'Medical Benefits', icon: HeartPulse },
                        { id: 'employer', label: 'Employer Info', icon: Building },
                        { id: 'employee', label: 'Employee Info', icon: User },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "flex items-center gap-3 px-5 py-4 rounded-2xl font-bold text-sm transition-all text-left",
                                activeTab === tab.id
                                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                                    : "bg-white dark:bg-gray-950 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 border border-gray-100 dark:border-gray-800"
                            )}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}

                    <div className="mt-auto p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-[28px] text-emerald-700 dark:text-emerald-400">
                        <ShieldCheck className="w-10 h-10 mb-3 opacity-50" />
                        <p className="text-xs font-black uppercase tracking-widest mb-1">MOM Compliant</p>
                        <p className="text-xs leading-relaxed opacity-80">This snapshot contains all mandatory terms required by the Employment Act.</p>
                    </div>
                </div>

                {/* Main A4 Preview */}
                <div className="flex-1 bg-gray-50 dark:bg-gray-900/30 rounded-[32px] border border-gray-100 dark:border-gray-800 p-8 overflow-y-auto nice-scrollbar print:p-0 print:m-0 print:border-none print:bg-white print:rounded-none shadow-inner">
                    <div
                        ref={printRef}
                        className="bg-white dark:bg-white mx-auto p-12 shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] font-serif text-gray-900 print:p-0 print:m-0 animate-in zoom-in-95 duration-500"
                    >
                        {/* KET HEADER */}
                        <div className="border-b-2 border-gray-900 pb-6 mb-8 text-center">
                            <h1 className="text-2xl font-bold uppercase tracking-widest mb-2">Key Employment Terms (KETs)</h1>
                            <p className="text-sm italic">Issued in accordance with the Singapore Employment Act</p>
                        </div>

                        {/* SECTION 1: PARTICULARS */}
                        <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-10">
                            <div>
                                <h3 className="text-xs font-bold uppercase border-b border-gray-400 mb-3 pb-1">Employer Particulars</h3>
                                <div className="space-y-2 text-sm">
                                    <p><span className="font-bold w-32 inline-block">Full Name:</span> {terms.employer.name}</p>
                                    <p><span className="font-bold w-32 inline-block">UEN:</span> {terms.employer.uen || '-'}</p>
                                    <p><span className="font-bold w-32 inline-block">Address:</span> {terms.employer.address || '-'}</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold uppercase border-b border-gray-400 mb-3 pb-1">Employee Particulars</h3>
                                <div className="space-y-2 text-sm">
                                    <p><span className="font-bold w-32 inline-block">Full Name:</span> {terms.employee.name}</p>
                                    <p><span className="font-bold w-32 inline-block">NRIC/FIN:</span> {terms.employee.nric_fin}</p>
                                    <p><span className="font-bold w-32 inline-block">Address:</span> {terms.employee.address || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: JOB DETAILS */}
                        <div className="mb-10">
                            <h3 className="text-xs font-bold uppercase border-b border-gray-400 mb-3 pb-1">Employment Terms</h3>
                            <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
                                <p><span className="font-bold w-48 inline-block">Job Title:</span> {terms.employment.job_title}</p>
                                <p><span className="font-bold w-48 inline-block">Principal Responsibilities:</span> {terms.employment.job_responsibilities || 'As per job description'}</p>
                                <p><span className="font-bold w-48 inline-block">Start Date:</span> {terms.employment.join_date}</p>
                                <p><span className="font-bold w-48 inline-block">Type of Employment:</span> <span className="capitalize">{terms.employment.employment_type?.replace('_', ' ')}</span></p>
                                <p><span className="font-bold w-48 inline-block">Probation Period:</span> {terms.employment.probation_period || 'None'}</p>
                                <p><span className="font-bold w-48 inline-block">Notice Period:</span> {terms.employment.notice_period || '-'}</p>
                                <p><span className="font-bold w-48 inline-block text-emerald-700">Work Location:</span> {terms.employment.work_location}</p>
                            </div>
                        </div>

                        {/* SECTION 3: WORKING HOURS */}
                        <div className="mb-10">
                            <h3 className="text-xs font-bold uppercase border-b border-gray-400 mb-3 pb-1">Working Arrangement</h3>
                            <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
                                <p><span className="font-bold w-48 inline-block">Working Days / Week:</span> {terms.working_hours.days_per_week}</p>
                                <p><span className="font-bold w-48 inline-block">Daily Working Hours:</span> {terms.working_hours.hours_per_day} hours</p>
                                <p><span className="font-bold w-48 inline-block">Weekly Working Hours:</span> {terms.working_hours.hours_per_week} hours</p>
                                <p><span className="font-bold w-48 inline-block">Rest Day:</span> <span className="capitalize">{terms.working_hours.rest_day || 'Sunday'}</span></p>
                            </div>
                        </div>

                        {/* SECTION 4: SALARY & OT */}
                        <div className="mb-10">
                            <h3 className="text-xs font-bold uppercase border-b border-gray-400 mb-3 pb-1">Salary & Remuneration</h3>
                            <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm mb-4">
                                <p><span className="font-bold w-48 inline-block text-primary-700">Basic Monthly Salary:</span> S$ {terms.salary.basic_salary.toFixed(2)}</p>
                                <p><span className="font-bold w-48 inline-block">Salary Period:</span> <span className="capitalize">{terms.salary.salary_period}</span></p>
                                <p><span className="font-bold w-48 inline-block">Payment Mode:</span> <span className="capitalize">{terms.salary.payment_mode?.replace('_', ' ')}</span></p>
                                <p><span className="font-bold w-48 inline-block">Overtime Eligibility:</span> {terms.salary.is_ot_eligible ? 'Yes' : 'No'}</p>
                                {terms.salary.is_ot_eligible && (
                                    <>
                                        <p><span className="font-bold w-48 inline-block">Overtime Rate:</span> {terms.salary.ot_rate}x</p>
                                        <p><span className="font-bold w-48 inline-block">OT Payment Period:</span> <span className="capitalize">{terms.salary.ot_payment_period}</span></p>
                                    </>
                                )}
                            </div>

                            {terms.salary.fixed_components?.length > 0 && (
                                <div className="mt-4">
                                    <p className="font-bold text-xs mb-2">Fixed Allowances & Deductions:</p>
                                    <div className="border border-gray-300 rounded overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50 border-b border-gray-300">
                                                <tr>
                                                    <th className="px-4 py-2 text-left">Component</th>
                                                    <th className="px-4 py-2 text-left">Category</th>
                                                    <th className="px-4 py-2 text-right">Amount (S$)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {terms.salary.fixed_components.map((comp: any, i: number) => (
                                                    <tr key={i}>
                                                        <td className="px-4 py-2">{comp.component}</td>
                                                        <td className="px-4 py-2 capitalize">{comp.category}</td>
                                                        <td className="px-4 py-2 text-right">{comp.amount.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SECTION 5: BENEFITS */}
                        <div className="mb-16">
                            <h3 className="text-xs font-bold uppercase border-b border-gray-400 mb-3 pb-1">Medical & Other Benefits</h3>
                            <div className="space-y-3 text-sm">
                                <p><span className="font-bold w-48 inline-block">Medical Benefits:</span> {terms.benefits.medical || 'As per statutory minimum'}</p>
                                <p><span className="font-bold w-48 inline-block">Dental Benefits:</span> {terms.benefits.dental || '-'}</p>
                                <p><span className="font-bold w-48 inline-block">Insurance:</span> {terms.benefits.insurance || '-'}</p>
                                <p><span className="font-bold w-48 inline-block font-emerald-700">Other Benefits:</span> {terms.benefits.other || '-'}</p>
                            </div>
                        </div>

                        {/* SIGNATURES */}
                        <div className="mt-20 flex justify-between gap-12">
                            <div className="flex-1">
                                <div className="border-t border-gray-900 pt-2 text-center">
                                    <p className="text-xs font-bold">Employer Signature & Stamp</p>
                                    <p className="text-[10px] mt-1 italic">For and on behalf of {terms.employer.name}</p>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="border-t border-gray-900 pt-2 text-center">
                                    <p className="text-xs font-bold">Employee Signature</p>
                                    <p className="text-[10px] mt-1 italic">I accept the terms and conditions stated herein</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 text-[8px] text-gray-400 text-center">
                            Document Generated on {new Date().toLocaleDateString('en-SG')} • v{ket.version}
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 210mm;
                        padding: 0;
                        margin: 0;
                    }
                    @page {
                        size: A4;
                        margin: 0;
                    }
                }
                .print-area {
                    visibility: visible !important;
                }
            `}} />
        </div>
    );
};

export default KETEditor;
