import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Signup from './pages/Signup';
import OnboardingWizard from './pages/OnboardingWizard';
import DashboardLayout from './components/Layout/DashboardLayout';
import AdminLayout from './components/Layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Employees from './pages/Employees';
import AddEmployee from './pages/AddEmployee';
import EmployeeProfile from './pages/EmployeeProfile';
import Payroll from './pages/Payroll';
import PayrollNew from './pages/PayrollNew';
import PayrollDetail from './pages/PayrollDetail';
import Payslip from './pages/Payslip';
import Attendance from './pages/Attendance';
import MultiEntityManagement from './pages/MultiEntityManagement';
import AuditTrail from './pages/AuditTrail';
import LeaveManagement from './pages/LeaveManagement';
import KETDashboard from './pages/KETDashboard';
import KETEditor from './pages/KETEditor';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import PlatformDashboard from './pages/platform/PlatformDashboard';
import TenantManagement from './pages/platform/TenantManagement';
import SubscriptionManagement from './pages/platform/SubscriptionManagement';
import StatutoryRules from './pages/platform/StatutoryRules';
import CPFRates from './pages/platform/CPFRates';
import SHGRates from './pages/platform/SHGRates';
import SDLRates from './pages/platform/SDLRates';
import CPFAllocations from './pages/platform/CPFAllocations';
import UserSettings from './pages/settings/UserSettings';
import EntityManagement from './pages/settings/EntityManagement';
import RoleManagement from './pages/settings/RoleManagement';
import MasterDataSettings from './pages/settings/MasterDataSettings';
import ShiftSettings from './pages/settings/ShiftSettings';
import RosterManagement from './pages/attendance/RosterManagement';
import PublicHolidays from './pages/attendance/PublicHolidays';
import TimeClock from './pages/attendance/TimeClock';
import AttendanceLogs from './pages/attendance/AttendanceLogs';
import PunchHistory from './pages/attendance/PunchHistory';
import ImportTimesheet from './pages/attendance/ImportTimesheet';
import ESSDashboard from './pages/ESSDashboard';
import MyProfile from './pages/MyProfile';
import MyLeaves from './pages/MyLeaves';
import MyPayslips from './pages/MyPayslips';
import MyClaims from './pages/Claims/MyClaims';
import TeamClaims from './pages/Claims/TeamClaims';
import ClaimsAdmin from './pages/Claims/ClaimsAdmin';
import NotificationCentre from './pages/Notifications/NotificationCentre';
import { useAuthStore } from './store/useAuthStore';

const TenantIndexRedirect = () => {
    const { user } = useAuthStore();
    const hasAdminAccess = user?.is_tenant_admin || (user?.entity_access && user.entity_access.some(a => a.role_name !== 'Employee'));
    return <Navigate to={hasAdminAccess ? "/dashboard" : "/me"} replace />;
};

function App() {
    return (
        <Router>
            <Toaster position="top-right" reverseOrder={false} />
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Protected Setup Route */}
                <Route path="/onboarding" element={<ProtectedRoute requireSetup={false}><OnboardingWizard /></ProtectedRoute>} />

                {/* Protected Tenant Routes */}
                <Route path="/" element={<ProtectedRoute requireSetup={true}><DashboardLayout /></ProtectedRoute>}>
                    <Route index element={<TenantIndexRedirect />} />
                    <Route path="me" element={<ESSDashboard />} />
                    <Route path="profile" element={<MyProfile />} />
                    <Route path="me/payslips" element={<MyPayslips />} />
                    <Route path="me/payslips/:record_id" element={<Payslip />} />
                    <Route path="leave" element={<Navigate to="/leave/my" replace />} />
                    <Route path="leave/my" element={<MyLeaves />} />
                    <Route path="claims/my" element={<MyClaims />} />
                    <Route path="attendance/clock" element={<TimeClock />} />
                    <Route path="attendance/history" element={<PunchHistory />} />
                    <Route path="notifications" element={<NotificationCentre />} />

                    {/* Admin Only Routes */}
                    <Route element={<ProtectedRoute requireAdmin={true}><Outlet /></ProtectedRoute>}>
                        <Route path="dashboard" element={<Dashboard />} />
                        <Route path="employees" element={<Employees />} />
                        <Route path="employees/multi-management" element={<MultiEntityManagement />} />
                        <Route path="employees/add" element={<AddEmployee />} />
                        <Route path="employees/:id" element={<EmployeeProfile />} />
                        <Route path="payroll" element={<Payroll />} />
                        <Route path="payroll/new" element={<PayrollNew />} />
                        <Route path="payroll/:id" element={<PayrollDetail />} />
                        <Route path="payroll/:id/payslip/:record_id" element={<Payslip />} />
                        <Route path="ket" element={<KETDashboard />} />
                        <Route path="ket/:id" element={<KETEditor />} />
                        <Route path="attendance/leave/team" element={<LeaveManagement />} />
                        <Route path="attendance/logs" element={<AttendanceLogs />} />
                        <Route path="attendance/roster" element={<RosterManagement />} />
                        <Route path="attendance/import" element={<ImportTimesheet />} />
                        <Route path="attendance/public-holidays" element={<PublicHolidays />} />
                        <Route path="audit" element={<AuditTrail />} />
                        <Route path="claims/admin" element={<ClaimsAdmin />} />
                        <Route path="claims/team" element={<TeamClaims />} />
                        <Route path="reports" element={<Reports />} />
                        <Route path="settings/users" element={<UserSettings />} />
                        <Route path="settings/entities" element={<EntityManagement />} />
                        <Route path="settings/roles" element={<RoleManagement />} />
                        <Route path="settings/master" element={<MasterDataSettings />} />
                        <Route path="settings/shifts" element={<ShiftSettings />} />
                    </Route>
                </Route>

                {/* Protected Platform Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute requirePlatformAdmin><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/admin/stats" replace />} />
                    <Route path="stats" element={<PlatformDashboard />} />
                    <Route path="tenants" element={<TenantManagement />} />
                    <Route path="billing" element={<SubscriptionManagement />} />
                    <Route path="statutory-rules" element={<StatutoryRules />} />
                    <Route path="cpf-rates" element={<CPFRates />} />
                    <Route path="shg-rates" element={<SHGRates />} />
                    <Route path="sdl-rates" element={<SDLRates />} />
                    <Route path="cpf-allocations" element={<CPFAllocations />} />
                    <Route path="infra" element={<div>Infrastructure Monitoring</div>} />
                </Route>

                {/* Default Redirect */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
