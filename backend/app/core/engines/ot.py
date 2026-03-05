from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional
from enum import Enum

class DayType(Enum):
    NORMAL = "normal"
    REST_DAY = "rest_day"
    OFF_DAY = "off_day"
    PUBLIC_HOLIDAY = "public_holiday"

class OTCalculationEngine:
    """
    Singapore Overtime (OT) Calculation Engine.
    Based on Employment Act Part IV (Divisor 209).
    """

    DIVISOR = Decimal("209")
    OT_CAP_HOURS = Decimal("72.0")
    ELIGIBILITY_THRESHOLD = Decimal("2600.00")

    @staticmethod
    def calculate_hourly_rate(basic_salary: Decimal) -> Decimal:
        """
        Calculates the 1.0x hourly rate for OT purposes.
        Formula: (Monthly Basic * 12) / (52 * 44) = Basic / 225.33 (MOM uses 209 as a standard).
        Formula used by MOM: Basic Salary / 209.
        """
        return (basic_salary / OTCalculationEngine.DIVISOR).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    def is_eligible(self, basic_salary: Decimal, job_role: str) -> bool:
        """
        Checks eligibility for Part IV of the Employment Act.
        Criteria: Basic salary <= $2,600 (for non-workmen).
        Standard workmen are always eligible.
        """
        # Simplified: check salary threshold
        return basic_salary <= self.ELIGIBILITY_THRESHOLD

    def calculate_ot_pay(
        self, 
        basic_salary: Decimal, 
        hours: Decimal, 
        day_type: DayType,
        is_beyond_8hr: bool = False
    ) -> Dict[str, Decimal]:
        """
        Calculates OT pay based on hours and day type.
        - Normal Day (Beyond 8hr): 1.5x
        - Rest Day (Beyond 8hr): 2.0x
        - PH: 2.0x
        """
        hourly_rate = self.calculate_hourly_rate(basic_salary)
        multiplier = Decimal("1.5")

        if day_type == DayType.NORMAL:
            multiplier = Decimal("1.5")
        elif day_type == DayType.REST_DAY:
            multiplier = Decimal("2.0")
        elif day_type == DayType.PUBLIC_HOLIDAY:
            multiplier = Decimal("2.0")
        elif day_type == DayType.OFF_DAY:
            multiplier = Decimal("1.5")

        ot_pay = (hours * hourly_rate * multiplier).quantize(Decimal("0.00"), rounding=ROUND_HALF_UP)

        return {
            "hourly_rate": hourly_rate,
            "multiplier": multiplier,
            "ot_pay": ot_pay,
            "hours": hours
        }

# Singleton instance
ot_engine = OTCalculationEngine()
