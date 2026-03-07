import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import DashboardLayout from './components/Layout/DashboardLayout';
import AdminLayout from './components/Layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Employees from './pages/Employees';
import AddEmployee from './pages/AddEmployee';
import EmployeeProfile from './pages/EmployeeProfile';
import Payroll from './pages/Payroll';
import PayrollDetail from './pages/PayrollDetail';
import Attendance from './pages/Attendance';
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

function App() {
    return (
        <Router>
            <Toaster position="top-right" reverseOrder={false} />
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />

                {/* Protected Tenant Routes */}
                <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="employees" element={<Employees />} />
                    <Route path="employees/add" element={<AddEmployee />} />
                    <Route path="employees/:id" element={<EmployeeProfile />} />
                    <Route path="payroll" element={<Payroll />} />
                    <Route path="payroll/:id" element={<PayrollDetail />} />
                    <Route path="ket" element={<KETDashboard />} />
                    <Route path="ket/:id" element={<KETEditor />} />
                    <Route path="leave" element={<Navigate to="/leave/my" replace />} />
                    <Route path="leave/my" element={<LeaveManagement />} />
                    <Route path="attendance/leave/team" element={<LeaveManagement />} />
                    <Route path="attendance/clock" element={<TimeClock />} />
                    <Route path="attendance/history" element={<PunchHistory />} />
                    <Route path="attendance/logs" element={<AttendanceLogs />} />
                    <Route path="attendance/roster" element={<RosterManagement />} />
                    <Route path="attendance/public-holidays" element={<PublicHolidays />} />
                    <Route path="audit" element={<div>AI Audit Panel</div>} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings/users" element={<UserSettings />} />
                    <Route path="settings/entities" element={<EntityManagement />} />
                    <Route path="settings/roles" element={<RoleManagement />} />
                    <Route path="settings/master" element={<MasterDataSettings />} />
                    <Route path="settings/shifts" element={<ShiftSettings />} />
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
                    <Route path="infra" element={<div>Infrastructure Monitoring</div>} />
                </Route>

                {/* Default Redirect */}
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
