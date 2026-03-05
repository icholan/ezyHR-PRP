import pytest
from decimal import Decimal
from app.core.engines.ot import ot_engine, DayType

def test_hourly_rate_calculation():
    # $2,600 / 209 = 12.44019...
    basic = Decimal("2600.00")
    rate = ot_engine.calculate_hourly_rate(basic)
    assert rate == Decimal("12.4402")

def test_ot_pay_normal_day_1_5x():
    basic = Decimal("2090.00") # $10/hr
    result = ot_engine.calculate_ot_pay(
        basic_salary=basic,
        hours=Decimal("2.0"),
        day_type=DayType.NORMAL
    )
    assert result["hourly_rate"] == Decimal("10.0000")
    assert result["ot_pay"] == Decimal("30.00") # 2 * 10 * 1.5

def test_ot_pay_rest_day_2x():
    basic = Decimal("2090.00") # $10/hr
    result = ot_engine.calculate_ot_pay(
        basic_salary=basic,
        hours=Decimal("4.0"),
        day_type=DayType.REST_DAY
    )
    assert result["ot_pay"] == Decimal("80.00") # 4 * 10 * 2.0

def test_eligibility():
    assert ot_engine.is_eligible(Decimal("2500.00"), "staff") is True
    assert ot_engine.is_eligible(Decimal("3000.00"), "staff") is False
