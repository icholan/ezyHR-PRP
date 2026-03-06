import React, { useEffect, useState } from 'react';
import {
    Users,
    UserPlus,
    Search,
    Filter,
    MoreHorizontal,
    Mail,
    Phone,
    Building,
    Calendar,
    ChevronRight,
    BadgeCheck,
    XCircle,
    LayoutGrid,
    List,
    ChevronDown,
    FilterX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { clsx } from 'clsx';
import SearchableSelect from '../components/Common/SearchableSelect';

const Employees = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showFilters, setShowFilters] = useState(false);
    const [filterDept, setFilterDept] = useState('');
    const [filterGroup, setFilterGroup] = useState('');
    const [filterGrade, setFilterGrade] = useState('');

    const user = useAuthStore((state) => state.user);
    const entityId = user?.selected_entity_id || '00000000-0000-0000-0000-000000000000';

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await api.get(`/api/v1/employees?entity_id=${entityId}`);
                setEmployees(response.data);
            } catch (error) {
                console.error("Failed to fetch employees", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEmployees();
    }, [entityId]);

    // Derived discrete filter options
    const departments = Array.from(new Set(employees.map(e => e.department_name).filter(Boolean))).sort();
    const groups = Array.from(new Set(employees.map(e => e.group_name).filter(Boolean))).sort();
    const grades = Array.from(new Set(employees.map(e => e.grade_name).filter(Boolean))).sort();

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = filterDept ? emp.department_name === filterDept : true;
        const matchesGroup = filterGroup ? emp.group_name === filterGroup : true;
        const matchesGrade = filterGrade ? emp.grade_name === filterGrade : true;

        return matchesSearch && matchesDept && matchesGroup && matchesGrade;
    });

    const activeFilterCount = [filterDept, filterGroup, filterGrade].filter(Boolean).length;

    const clearFilters = () => {
        setFilterDept('');
        setFilterGroup('');
        setFilterGrade('');
    };

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-dark-950 dark:text-gray-50 font-['Outfit']">Employees</h1>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Manage your workforce across all departments.</p>
                </div>
                <button
                    onClick={() => navigate('/employees/add')}
                    className="btn btn-primary flex items-center justify-center gap-2 py-3 px-6 shadow-lg shadow-primary-200 dark:shadow-primary-900/30 w-full sm:w-auto"
                >
                    <UserPlus className="w-5 h-5" />
                    Add New Employee
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: 'Total Employees', value: employees.length, icon: Users, color: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' },
                    { label: 'Active', value: employees.filter(e => e.is_active).length, icon: BadgeCheck, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
                    { label: 'On Leave', value: 0, icon: Calendar, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
                    { label: 'Inactive', value: employees.filter(e => !e.is_active).length, icon: XCircle, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
                        <div className={clsx("w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center", stat.color)}>
                            <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                            <p className="text-xl sm:text-2xl font-bold text-dark-950 dark:text-gray-50">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-2.5 sm:py-3 pl-10 sm:pl-12 pr-4 focus:ring-2 focus:ring-primary-500/20 transition-all outline-none text-sm text-dark-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                            "p-2 sm:p-2.5 rounded-lg transition-all",
                            viewMode === 'grid' ? "bg-white dark:bg-gray-900 shadow-sm text-primary-600" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                        )}
                    >
                        <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={clsx(
                            "p-2 sm:p-2.5 rounded-lg transition-all",
                            viewMode === 'list' ? "bg-white dark:bg-gray-900 shadow-sm text-primary-600" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                        )}
                    >
                        <List className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={clsx(
                        "flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl transition-all font-medium border text-sm",
                        showFilters || activeFilterCount > 0
                            ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-800"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-100 dark:border-gray-700"
                    )}
                >
                    <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                    Filters {activeFilterCount > 0 && <span className="bg-primary-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
                    <ChevronDown className={clsx("w-4 h-4 transition-transform", showFilters && "rotate-180")} />
                </button>
            </div>

            {/* Filter Panel */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    >
                        <div className="bg-white dark:bg-gray-900 p-5 rounded-[24px] border border-gray-100 dark:border-gray-800 shadow-sm grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Department</label>
                                <SearchableSelect
                                    options={[
                                        { id: '', label: 'All Departments' },
                                        ...departments.map(d => ({ id: d as string, label: d as string }))
                                    ]}
                                    value={filterDept}
                                    onChange={setFilterDept}
                                    placeholder="All Departments"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Group</label>
                                <SearchableSelect
                                    options={[
                                        { id: '', label: 'All Groups' },
                                        ...groups.map(g => ({ id: g as string, label: g as string }))
                                    ]}
                                    value={filterGroup}
                                    onChange={setFilterGroup}
                                    placeholder="All Groups"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Grade</label>
                                <SearchableSelect
                                    options={[
                                        { id: '', label: 'All Grades' },
                                        ...grades.map(g => ({ id: g as string, label: g as string }))
                                    ]}
                                    value={filterGrade}
                                    onChange={setFilterGrade}
                                    placeholder="All Grades"
                                />
                            </div>
                            <div className="flex items-end">
                                {activeFilterCount > 0 && (
                                    <button
                                        onClick={clearFilters}
                                        className="h-[46px] px-4 flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors text-sm font-semibold"
                                    >
                                        <FilterX className="w-4 h-4" />
                                        Clear All
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Employee View */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <AnimatePresence mode="popLayout">
                        {loading ? (
                            Array(8).fill(0).map((_, i) => (
                                <div key={`skeleton-${i}`} className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 p-6 shadow-sm animate-pulse h-64"></div>
                            ))
                        ) : filteredEmployees.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-gray-500 dark:text-gray-400 font-['Outfit'] bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800">
                                No employees found.
                            </div>
                        ) : filteredEmployees.map((emp) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={emp.id}
                                onClick={() => navigate(`/employees/${emp.id}`)}
                                className="group bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-2xl hover:shadow-primary-600/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer text-center"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className={clsx(
                                        "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                        emp.is_active ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                                    )}>
                                        {emp.is_active ? 'Active' : 'Terminated'}
                                    </span>
                                </div>

                                <div className="flex flex-col items-center">
                                    <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-primary-200 dark:shadow-primary-900/40 mb-4 group-hover:scale-105 transition-transform duration-300">
                                        {emp.full_name[0]}
                                    </div>
                                    <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50 group-hover:text-primary-600 transition-colors line-clamp-1">{emp.full_name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{emp.employee_code || 'No Code'}</p>
                                </div>

                                <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-800 flex flex-col items-center gap-2">
                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                        <Building className="w-4 h-4 text-primary-500" />
                                        <span className="text-sm font-medium">{emp.department_name || 'Unassigned'}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">{emp.job_title || 'No Title'}</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-900 rounded-[24px] sm:rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px] lg:min-w-0">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                    <th className="px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold text-gray-600 dark:text-gray-400">Employee</th>
                                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-sm font-semibold text-gray-600 dark:text-gray-400">Department</th>
                                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-sm font-semibold text-gray-600 dark:text-gray-400">Status</th>
                                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-sm font-semibold text-gray-600 dark:text-gray-400">Join Date</th>
                                    <th className="px-6 sm:px-8 py-4 sm:py-5 text-sm font-semibold text-gray-600 dark:text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {loading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-8 py-6 h-20 bg-gray-50/30 dark:bg-gray-800/30"></td>
                                        </tr>
                                    ))
                                ) : filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center text-gray-500 dark:text-gray-400 font-['Outfit']">
                                            No employees found.
                                        </td>
                                    </tr>
                                ) : filteredEmployees.map((emp) => (
                                    <tr key={emp.id} onClick={() => navigate(`/employees/${emp.id}`)} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all group cursor-pointer">
                                        <td className="px-6 sm:px-8 py-4 sm:py-5">
                                            <div className="flex items-center gap-3 sm:gap-4">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
                                                    {emp.full_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm sm:text-base text-dark-950 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">{emp.full_name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{emp.employee_code || 'No Code'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 sm:py-5">
                                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                <Building className="w-3.5 h-3.5" />
                                                <span className="font-medium text-xs sm:text-sm">{emp.department_name || 'Unassigned'}</span>
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{emp.job_title || 'No Title'}</p>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 sm:py-5">
                                            <span className={clsx(
                                                "inline-flex items-center px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                                                emp.is_active ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                                            )}>
                                                {emp.is_active ? 'Active' : 'Terminated'}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 sm:py-5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                                            {new Date(emp.join_date).toLocaleDateString('en-SG', {
                                                day: '2-digit', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 sm:px-8 py-4 sm:py-5 text-right">
                                            <button className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all">
                                                <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 dark:text-gray-500" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Employees;
