import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, User, Mail, Lock, ChevronRight, CheckCircle2, Shield, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { Link, useNavigate } from 'react-router-dom';

const Signup = () => {
    const navigate = useNavigate();
    const loginToStore = useAuthStore((state) => state.login);
    
    const [formData, setFormData] = useState({
        company_name: '',
        admin_full_name: '',
        admin_email: '',
        admin_password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            // 1. Create Tenant
            await api.post('/api/v1/auth/signup', formData);
            
            // 2. Auto-login
            const loginRes = await api.post('/api/v1/auth/login', {
                email: formData.admin_email.trim(),
                password: formData.admin_password
            });
            
            loginToStore(loginRes.data.user, loginRes.data.access_token);
            
            // 3. User setup_complete will be false, ProtectedRoute will catch it and route to /onboarding
            navigate('/dashboard');
            
        } catch (err: any) {
            console.error('Signup error:', err.response?.data);
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-primary-50/30 dark:bg-gray-950 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,rgba(83,113,255,0.05),transparent)] transition-colors duration-200">
            <div className="w-full max-w-[1000px] flex bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl dark:shadow-gray-950/50 overflow-hidden border border-white dark:border-gray-800 p-2">

                {/* Left Side: Illustration / Branding */}
                <div className="hidden lg:flex w-1/2 bg-primary-600 rounded-[28px] p-12 flex-col justify-between items-start text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-8 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                            <Building2 className="w-5 h-5" />
                            <span className="font-semibold tracking-tight">Singapore HRMS</span>
                        </div>

                        <h1 className="text-5xl font-['Outfit'] font-bold leading-tight mb-6">
                            Start Your <br />
                            <span className="text-primary-100 italic font-medium font-['Inter']">HR Journey</span>
                        </h1>
                        <p className="text-primary-100/80 text-lg leading-relaxed max-w-sm">
                            Provision an entire compliance-ready corporate environment in seconds.
                        </p>
                    </div>

                    <div className="mt-auto relative z-10 w-full">
                        <div className="p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield className="w-6 h-6 text-primary-200" />
                                <span className="font-semibold text-lg">Instant Compliance</span>
                            </div>
                            <div className="space-y-2 text-primary-50/70 text-sm">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    <span>MOM Leave Rules Auto-Seeded</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    <span>Roles & Permissions Pre-configured</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary-500 rounded-full blur-[100px] opacity-50" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400 rounded-full blur-[100px] opacity-30" />
                </div>

                {/* Right Side: Signup Form */}
                <div className="flex-1 p-12 lg:p-16 flex flex-col justify-center">
                    <div className="mb-8 text-center lg:text-left">
                        <h2 className="text-3xl font-bold mb-3 text-dark-950 dark:text-gray-50">Create an Account</h2>
                        <p className="text-gray-500 dark:text-gray-400">Join the ultimate Singapore HR and Payroll platform</p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-5">
                        <div className="grid grid-cols-1 gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Company Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                    <input
                                        type="text"
                                        name="company_name"
                                        required
                                        value={formData.company_name}
                                        onChange={handleChange}
                                        className="input-field pl-12"
                                        placeholder="Acme Innovations Pte Ltd"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Your Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                    <input
                                        type="text"
                                        name="admin_full_name"
                                        required
                                        value={formData.admin_full_name}
                                        onChange={handleChange}
                                        className="input-field pl-12"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Work Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                    <input
                                        type="email"
                                        name="admin_email"
                                        required
                                        value={formData.admin_email}
                                        onChange={handleChange}
                                        className="input-field pl-12"
                                        placeholder="john@acme.com.sg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                    <input
                                        type="password"
                                        name="admin_password"
                                        required
                                        minLength={8}
                                        value={formData.admin_password}
                                        onChange={handleChange}
                                        className="input-field pl-12"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm animate-shake">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full py-4 mt-2 flex items-center justify-center gap-2 text-lg shadow-xl shadow-primary-500/20 dark:shadow-primary-900/30"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Create Free Account
                                    <ChevronRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700">
                            Log in here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;
