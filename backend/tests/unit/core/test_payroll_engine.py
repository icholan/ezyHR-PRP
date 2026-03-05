import pytest
from decimal import Decimal
from app.core.engines.payroll_engine import payroll_engine

def test_full_payroll_calculation_citizen():
    # Scenario: Chinese Citizen, $5,000 basic, $500 bonus, 10hrs OT (1.5x)
    # Basic: 5000
    # OT: 10 * (5000/209) * 1.5 = 10 * 23.9234 * 1.5 = 358.85
    # Gross OW: 5000 + 358.85 = 5358.85
    # AW: 500
    # CPF EE: (5358.85 * 0.20) + (500 * 0.20) = 1072 + 100 = 1172
    # SHG (CDAC): $5358.85 + 500 = $5858.85 -> $1.50
    # SDL: (5858.85 * 0.0025) = 14.64 -> Cap 11.25
    
    person_meta = {
        "citizenship_type": "citizen",
        "age": 30,
        "race": "Chinese",
        "cpf_ee_rate": Decimal("0.20"),
        "cpf_er_rate": Decimal("0.17")
    }
    ytd_meta = {"ytd_ow": Decimal("0"), "ytd_aw_calculated": Decimal("0")}
    
    result = payroll_engine.calculate_employee_payroll(
        basic_salary=Decimal("5000.00"),
        ot_hours_1_5x=Decimal("10.0"),
        bonus=Decimal("500.00"),
        person_meta=person_meta,
        ytd_meta=ytd_meta
    )
    
    assert result["summary"]["gross_pay"] == Decimal("5858.85")
    assert result["deductions"]["cpf_employee"] == Decimal("1172")
    assert result["deductions"]["shg"] == Decimal("1.50")
    assert result["contributions"]["sdl"] == Decimal("11.25")
    # Net Pay: 5858.85 - 1172 - 1.50 = 4685.35
    assert result["summary"]["net_pay"] == Decimal("4685.35")

def test_foreigner_payroll():
    # Scenario: Foreigner (EP), $8,000 basic, no CPF, no SHG
    person_meta = {"citizenship_type": "ep", "race": "Caucasian"}
    ytd_meta = {"ytd_ow": Decimal("0"), "ytd_aw_calculated": Decimal("0")}
    
    result = payroll_engine.calculate_employee_payroll(
        basic_salary=Decimal("8000.00"),
        person_meta=person_meta,
        ytd_meta=ytd_meta
    )
    
    assert result["deductions"]["cpf_employee"] == Decimal("0")
    assert result["deductions"]["shg"] == Decimal("0")
    assert result["summary"]["net_pay"] == result["summary"]["gross_pay"]
