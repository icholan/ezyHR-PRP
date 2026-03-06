from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List
from datetime import date
from app.core.engines.cpf import cpf_engine
from app.core.engines.ot import ot_engine, DayType
from app.core.engines.statutory_funds import statutory_funds_engine

class PayrollEngine:
    """
    Main Payroll Orchestrator.
    Integrates all engine logic to compute net pay, CPF, contributions and SHG.
    """

    def calculate_employee_payroll(
        self,
        basic_salary: Decimal,
        ot_hours_1_5x: Decimal = Decimal("0"),
        ot_hours_2x: Decimal = Decimal("0"),
        allowances: Decimal = Decimal("0"),
        deductions: Decimal = Decimal("0"),
        bonus: Decimal = Decimal("0"),
        unpaid_leave_days: Decimal = Decimal("0"),
        working_days_in_month: int = 22,
        person_meta: Dict[str, Any] = None, # race, religion, citizenship, age
        ytd_meta: Dict[str, Any] = None     # ytd_ow, ytd_aw_calculated
    ) -> Dict[str, Any]:
        """
        Calculates a single employment's payroll record.
        """
        # 1. Calculate Gross Components
        # Unpaid Leave Deduction (Basic / working_days * days)
        upl_deduction = (basic_salary / Decimal(str(working_days_in_month)) * unpaid_leave_days).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        # OT Pay
        ot_pay_1_5 = ot_engine.calculate_ot_pay(basic_salary, ot_hours_1_5x, DayType.NORMAL)["ot_pay"]
        ot_pay_2_0 = ot_engine.calculate_ot_pay(basic_salary, ot_hours_2x, DayType.REST_DAY)["ot_pay"]
        total_ot_pay = ot_pay_1_5 + ot_pay_2_0
        
        # Gross Pay (Before deductions)
        gross_pay = (basic_salary - upl_deduction) + total_ot_pay + allowances + bonus
        
        # 2. Identify Ordinary Wage (OW) and Additional Wage (AW) for CPF
        # OW: Basic (less UPL), Allowances, OT
        # AW: Bonus
        ow_amount = (basic_salary - upl_deduction) + total_ot_pay + allowances
        aw_amount = bonus
        
        # 3. Calculate CPF (if eligible)
        cpf_ee = Decimal("0")
        cpf_er = Decimal("0")
        
        citizenship = person_meta.get("citizenship_type", "foreigner")
        if citizenship in ["citizen", "pr"]:
            age = person_meta.get("age", 30)
            # Simplified: assuming rates are passed or fetched inside a higher-level service
            # For this engine, we expect the rates to be provided in person_meta for purity
            ee_rate = person_meta.get("cpf_ee_rate", Decimal("0.20"))
            er_rate = person_meta.get("cpf_er_rate", Decimal("0.17"))
            
            ow_result = cpf_engine.calculate_ow_cpf(ow_amount, ee_rate, er_rate)
            aw_result = cpf_engine.calculate_aw_cpf(
                aw_amount, 
                ytd_meta.get("ytd_ow", Decimal("0")), 
                ytd_meta.get("ytd_aw_calculated", Decimal("0")), 
                ee_rate, 
                er_rate
            )
            
            cpf_ee = ow_result["cpf_ee_ow"] + aw_result["cpf_ee_aw"]
            cpf_er = ow_result["cpf_er_ow"] + aw_result["cpf_er_aw"]

        # 4. Calculate SHG and SDL
        shg_deduction = statutory_funds_engine.calculate_shg(
            person_meta.get("race"), 
            person_meta.get("religion"), 
            gross_pay
        )
        sdl_contribution = statutory_funds_engine.calculate_sdl(gross_pay)
        
        # 5. Calculate Net Pay
        net_pay = gross_pay - cpf_ee - shg_deduction - deductions
        
        return {
            "basic_salary": basic_salary,
            "deductions": {
                "unpaid_leave": upl_deduction,
                "cpf_employee": cpf_ee,
                "shg": shg_deduction
            },
            "earnings": {
                "ot_pay": total_ot_pay,
                "allowances": allowances,
                "bonus": bonus
            },
            "contributions": {
                "cpf_employer": cpf_er,
                "sdl": sdl_contribution
            },
            "summary": {
                "gross_pay": gross_pay,
                "net_pay": net_pay,
                "ow_total": ow_amount,
                "aw_total": aw_amount
            }
        }

# Singleton instance
payroll_engine = PayrollEngine()
