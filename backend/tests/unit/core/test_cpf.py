import pytest
from decimal import Decimal
from app.core.engines.cpf import cpf_engine

def test_ow_cpf_below_ceiling():
    # Wage $3,000, rates 20% / 17%
    result = cpf_engine.calculate_ow_cpf(
        ow_amount=Decimal("3000.00"),
        employee_rate=Decimal("0.20"),
        employer_rate=Decimal("0.17")
    )
    assert result["cpf_ee_ow"] == Decimal("600")
    assert result["cpf_er_ow"] == Decimal("510")
    assert result["eligible_ow"] == Decimal("3000.00")

def test_ow_cpf_above_ceiling():
    # Wage $8,000, ceiling $6,800
    result = cpf_engine.calculate_ow_cpf(
        ow_amount=Decimal("8000.00"),
        employee_rate=Decimal("0.20"),
        employer_rate=Decimal("0.17")
    )
    assert result["cpf_ee_ow"] == Decimal("1360") # 6800 * 0.20
    assert result["cpf_er_ow"] == Decimal("1156") # 6800 * 0.17
    assert result["eligible_ow"] == Decimal("6800.00")

def test_aw_cpf_ceiling():
    # YTD OW = 80,000. Ceiling = 102,000 - 80,000 = 22,000
    # Bonus = 30,000. Eligible = 22,000
    result = cpf_engine.calculate_aw_cpf(
        aw_amount=Decimal("30000.00"),
        ytd_ow=Decimal("80000.00"),
        ytd_aw_calculated=Decimal("0.00"),
        employee_rate=Decimal("0.20"),
        employer_rate=Decimal("0.17")
    )
    assert result["eligible_aw"] == Decimal("22000.00")
    assert result["cpf_ee_aw"] == Decimal("4400") # 22000 * 0.20
    assert result["cpf_er_aw"] == Decimal("3740") # 22000 * 0.17
