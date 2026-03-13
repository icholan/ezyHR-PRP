import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Save, Calendar, CheckCircle2, Factory, LogOut } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const OnboardingWizard = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const completeSetup = useAuthStore((state) => state.completeSetup);
    const logout = useAuthStore((state) => state.logout);
    
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // Step 1: Company Legal Identity
    const [companyDetails, setCompanyDetails] = useState({
        uen: '',
        industry_code: '',
        registered_address: ''
    });

    // Step 2: Payroll Defaults
    const [payrollDetails, setPayrollDetails] = useState({
        payroll_cutoff_day: 25,
        payment_day: 28,
        cpf_account_no: ''
    });

    const handleNext = () => setStep(step + 1);

    const handleFinalSubmit = async () => {
        const targetEntityId = user?.selected_entity_id || (user as any)?.entity_access?.[0]?.entity_id;
        
        if (!targetEntityId) {
            toast.error('No entity found to configure. Please contact support.');
            console.error('No entity found to configure. Please contact support.');
            return;
        }
        
        setLoading(true);
        try {
            // Update Entity details
            await api.patch(`/api/v1/entities/${targetEntityId}`, {
                uen: companyDetails.uen,
                industry_code: companyDetails.industry_code,
                registered_address: companyDetails.registered_address,
                payroll_cutoff_day: payrollDetails.payroll_cutoff_day,
                payment_day: payrollDetails.payment_day,
                cpf_account_no: payrollDetails.cpf_account_no
            });
            
            // Mark Tenant setup_complete = true in database
            await api.post(`/api/v1/auth/complete-onboarding`);
            
            // Un-trap the local browser state immediately and securely navigate
            completeSetup();
            navigate('/dashboard', { replace: true });
        } catch (error: any) {
            console.error('Onboarding failed:', error);
            toast.error(error.response?.data?.detail || 'Onboarding failed. Please try again.');
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(83,113,255,0.05),transparent)] relative">
            
            {/* Top Bar for Logout */}
            <div className="absolute top-6 right-6 z-20">
                <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-sm border border-gray-200"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-semibold">Log Out</span>
                </button>
            </div>

            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                {/* Header Progress */}
                <div className="bg-primary-600 p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold font-['Outfit'] mb-2">Welcome to Singapore HRMS</h2>
                        <p className="text-primary-100 mb-6">Let's set up your foundational compliance configurations.</p>
                        
                        <div className="flex items-center justify-between relative">
                            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-primary-400 -z-10 -translate-y-1/2"></div>
                            {[1, 2, 3].map((num) => (
                                <div key={num} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                                    step >= num ? 'bg-white text-primary-600 shadow-md' : 'bg-primary-800 text-primary-300'
                                }`}>
                                    {step > num ? <CheckCircle2 className="w-6 h-6" /> : num}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-semibold text-primary-200">
                            <span>Legal Profile</span>
                            <span>Payroll Setup</span>
                            <span>Finalization</span>
                        </div>
                    </div>
                </div>

                {/* Form Sections */}
                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Building2 className="w-6 h-6 text-primary-500" />
                                    Legal Identity
                                </h3>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Singapore UEN</label>
                                    <input 
                                        type="text" 
                                        className="input-field" 
                                        placeholder="123456789A"
                                        value={companyDetails.uen}
                                        onChange={(e) => setCompanyDetails({...companyDetails, uen: e.target.value})}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Industry / SSIC Code</label>
                                    <input 
                                        type="text" 
                                        className="input-field" 
                                        placeholder="E.g., 62011 (Software Development)"
                                        value={companyDetails.industry_code}
                                        onChange={(e) => setCompanyDetails({...companyDetails, industry_code: e.target.value})}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Registered Address</label>
                                    <textarea 
                                        className="input-field py-3" 
                                        rows={3} 
                                        placeholder="Full corporate address..."
                                        value={companyDetails.registered_address}
                                        onChange={(e) => setCompanyDetails({...companyDetails, registered_address: e.target.value})}
                                    ></textarea>
                                </div>
                                
                                <button className="btn btn-primary w-full py-3 mt-4" onClick={handleNext}>
                                    Next Step
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-5"
                            >
                                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Calendar className="w-6 h-6 text-primary-500" />
                                    Payroll & CPF Basics
                                </h3>
                                
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-4">
                                    <p className="text-sm text-amber-800 font-medium">Standard CPF rules will be automatically mapped to these cycles.</p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">CPF Submission Number (CSN)</label>
                                    <input 
                                        type="text" 
                                        className="input-field" 
                                        placeholder="Standard format: UEN + CPF suffix"
                                        value={payrollDetails.cpf_account_no}
                                        onChange={(e) => setPayrollDetails({...payrollDetails, cpf_account_no: e.target.value})}
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Cutoff Day</label>
                                        <input 
                                            type="number" 
                                            className="input-field" 
                                            min="1" max="31"
                                            value={payrollDetails.payroll_cutoff_day}
                                            onChange={(e) => setPayrollDetails({...payrollDetails, payroll_cutoff_day: parseInt(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Day</label>
                                        <input 
                                            type="number" 
                                            className="input-field" 
                                            min="1" max="31"
                                            value={payrollDetails.payment_day}
                                            onChange={(e) => setPayrollDetails({...payrollDetails, payment_day: parseInt(e.target.value)})}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-6">
                                    <button className="btn btn-ghost flex-1 py-3" onClick={() => setStep(1)}>Back</button>
                                    <button className="btn btn-primary flex-1 py-3" onClick={handleNext}>Next Step</button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex flex-col items-center justify-center text-center space-y-6 py-8"
                            >
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                                    <Factory className="w-10 h-10 text-green-600" />
                                </div>
                                
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">All Set!</h3>
                                    <p className="text-gray-500 max-w-sm mx-auto">
                                        Your backend environment has been fully seeded with Singapore MOM Statutory Leave Rules and Security Roles.
                                    </p>
                                </div>
                                
                                <button 
                                    className="btn btn-primary w-full max-w-sm py-4 text-lg shadow-xl shadow-primary-500/20 mt-4"
                                    onClick={handleFinalSubmit}
                                    disabled={loading}
                                >
                                    {loading ? 'Finalizing...' : 'Launch Dashboard'}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;
