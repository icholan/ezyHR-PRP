from enum import Enum

class Permission(str, Enum):
    # Employee Management
    VIEW_EMPLOYEES = "view_employees"
    EDIT_EMPLOYEES = "edit_employees"
    DELETE_EMPLOYEES = "delete_employees"
    MANAGE_KET = "manage_ket"
    
    # Payroll

    VIEW_PAYROLL = "view_payroll"
    RUN_PAYROLL = "run_payroll"
    APPROVE_PAYROLL = "approve_payroll"
    
    # Time & Attendance
    VIEW_ATTENDANCE = "view_attendance"
    EDIT_ATTENDANCE = "edit_attendance"
    MANAGE_SHIFTS = "manage_shifts"
    
    # Leave Management
    VIEW_LEAVE = "view_leave"
    APPROVE_LEAVE = "approve_leave"
    MANAGE_LEAVE_TYPES = "manage_leave_types"
    MANAGE_TEAM_LEAVE = "manage_team_leave"

    
    # System & Settings
    VIEW_REPORTS = "view_reports"
    MANAGE_ROLES = "manage_roles"
    MANAGE_MULTI_ENTITY = "manage_multi_entity"
    MANAGE_MASTER_DATA = "manage_master_data"


# Useful helper to group permissions logically for the frontend UI
PERMISSION_GROUPS = {
    "Employee Management": [
        Permission.VIEW_EMPLOYEES,
        Permission.EDIT_EMPLOYEES,
        Permission.DELETE_EMPLOYEES,
        Permission.MANAGE_KET
    ],

    "Payroll": [
        Permission.VIEW_PAYROLL,
        Permission.RUN_PAYROLL,
        Permission.APPROVE_PAYROLL
    ],
    "Time & Attendance": [
        Permission.VIEW_ATTENDANCE,
        Permission.EDIT_ATTENDANCE,
        Permission.MANAGE_SHIFTS
    ],
    "Leave Management": [
        Permission.VIEW_LEAVE,
        Permission.APPROVE_LEAVE,
        Permission.MANAGE_LEAVE_TYPES,
        Permission.MANAGE_TEAM_LEAVE
    ],

    "Settings & Reports": [
        Permission.VIEW_REPORTS,
        Permission.MANAGE_ROLES,
        Permission.MANAGE_MULTI_ENTITY,
        Permission.MANAGE_MASTER_DATA
    ]

}

