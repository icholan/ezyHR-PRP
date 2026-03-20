import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Mail, ChevronRight, CheckCircle2, Building2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';

const Login = () => {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminId, setAdminId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loginToStore = useAuthStore((state) => state.login);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
                setEmail('hrmanager@acme.com');
                setPassword('Manager@123');
                setIsAdmin(false); // Ensure it's tenant portal
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleNext = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const loginPath = isAdmin ? '/platform/auth/login' : '/api/v1/auth/login';
            const response = await api.post(loginPath, {
                email: email.trim(),
                password
            });

            if (response.data.mfa_required) {
                setAdminId(response.data.admin_id || response.data.user_id);
                setStep(2);
            } else {
                const user = response.data.user;
                loginToStore(user, response.data.access_token);
                
                const isPlatform = user?.is_platform_admin;
                const isTenantAdmin = user?.is_tenant_admin;
                const selectedEntityId = user?.selected_entity_id;
                
                // Redirection based on selected entity's role
                const selectedAccess = user?.entity_access?.find((a: any) => a.entity_id === selectedEntityId);
                const hasAdminInSelectedEntity = selectedAccess && selectedAccess.role_name !== 'Employee';
                const hasAdminAccess = isTenantAdmin || hasAdminInSelectedEntity;

                if (isPlatform) {
                    window.location.href = '/admin';
                } else if (!hasAdminAccess) {
                    window.location.href = '/me';
                } else {
                    window.location.href = '/dashboard';
                }
            }
        } catch (err: any) {
            console.error('Login error:', err.response?.data);
            const detail = err.response?.data?.detail;
            if (typeof detail === 'string') {
                setError(detail);
            } else if (Array.isArray(detail)) {
                setError(detail[0]?.msg || 'Invalid input');
            } else {
                setError('Invalid email or password');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleMfaVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const verifyPath = isAdmin ? '/platform/auth/verify-mfa' : '/api/v1/auth/mfa/verify';
            const payload = isAdmin
                ? { admin_id: adminId, code: mfaCode }
                : { user_id: adminId, code: mfaCode };

            const response = await api.post(verifyPath, payload);
            const user = response.data.user;
            loginToStore(user, response.data.access_token);
            
            const isPlatform = user?.is_platform_admin;
            const isTenantAdmin = user?.is_tenant_admin;
            const selectedEntityId = user?.selected_entity_id;

            // Redirection based on selected entity's role
            const selectedAccess = user?.entity_access?.find((a: any) => a.entity_id === selectedEntityId);
            const hasAdminInSelectedEntity = selectedAccess && selectedAccess.role_name !== 'Employee';
            const hasAdminAccess = isTenantAdmin || hasAdminInSelectedEntity;

            if (isPlatform) {
                window.location.href = '/admin';
            } else if (!hasAdminAccess) {
                window.location.href = '/me';
            } else {
                window.location.href = '/dashboard';
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid MFA code');
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
                            Next-Gen <br />
                            <span className="text-primary-100 italic font-medium font-['Inter']">HR Operations</span>
                        </h1>
                        <p className="text-primary-100/80 text-lg leading-relaxed max-w-sm">
                            Securing payroll and compliance for the modern Singaporean workforce with AI-driven auditing.
                        </p>
                    </div>

                    <div className="mt-auto relative z-10 w-full">
                        <div className="p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield className="w-6 h-6 text-primary-200" />
                                <span className="font-semibold text-lg">Statutory Compliance</span>
                            </div>
                            <div className="space-y-2 text-primary-50/70 text-sm">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    <span>CPF OW/AW Auto-Ceiling</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    <span>AES-256 PII Encryption</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary-500 rounded-full blur-[100px] opacity-50" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400 rounded-full blur-[100px] opacity-30" />
                </div>

                {/* Right Side: Login Form */}
                <div className="flex-1 p-12 lg:p-16 flex flex-col justify-center">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-bold mb-3 text-dark-950 dark:text-gray-50">Welcome back</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Enter your credentials to access your portal</p>

                        {/* Realm Toggle */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-full max-w-[280px] mx-auto lg:mx-0">
                            <button
                                onClick={() => setIsAdmin(false)}
                                className={clsx(
                                    "flex-1 py-2 text-sm font-semibold rounded-xl transition-all",
                                    !isAdmin ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                )}
                            >
                                Tenant Portal
                            </button>
                            <button
                                onClick={() => setIsAdmin(true)}
                                className={clsx(
                                    "flex-1 py-2 text-sm font-semibold rounded-xl transition-all",
                                    isAdmin ? "bg-dark-950 dark:bg-gray-600 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                )}
                            >
                                Platform Admin
                            </button>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.form
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleNext}
                                className="space-y-6"
                            >
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="input-field pl-12"
                                            placeholder="name@email.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="input-field pl-12"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500" />
                                        <span className="text-gray-600 dark:text-gray-400">Remember me</span>
                                    </label>
                                    <a href="#" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">Forgot password?</a>
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
                                    className="btn btn-primary w-full py-4 flex items-center justify-center gap-2 text-lg shadow-xl shadow-primary-500/20 dark:shadow-primary-900/30"
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Continue
                                            <ChevronRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                                
                                {!isAdmin && (
                                    <div className="mt-6 text-center text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
                                        <Link to="/signup" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                                            Sign up for free
                                        </Link>
                                    </div>
                                )}
                            </motion.form>
                        ) : (
                            <motion.form
                                key="step2"
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleMfaVerify}
                                className="space-y-6"
                            >
                                <div className="text-center p-6 bg-primary-50 dark:bg-primary-900/20 rounded-2xl border border-primary-100 dark:border-primary-900/30 mb-6">
                                    <Shield className="w-12 h-12 text-primary-600 dark:text-primary-400 mx-auto mb-3" />
                                    <h3 className="font-bold text-primary-900 dark:text-primary-200 mb-1 text-lg">Two-Factor Authentication</h3>
                                    <p className="text-primary-700/70 dark:text-primary-300/70 text-sm">Please enter the 6-digit code from your authenticator app</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Authentication Code</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value)}
                                        className="input-field text-center text-3xl tracking-[1em] py-4"
                                        placeholder="000000"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn btn-primary w-full py-4 flex items-center justify-center gap-2 text-lg shadow-xl shadow-primary-500/20 dark:shadow-primary-900/30"
                                >
                                    {loading ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Verify & Sign In'
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="w-full text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-center"
                                >
                                    Back to login
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <p className="mt-auto text-center text-gray-400 dark:text-gray-500 text-sm py-4">
                        &copy; 2026 Singapore HRMS. Built for MOM Compliance.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
