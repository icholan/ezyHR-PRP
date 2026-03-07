from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.statutory import CPFRateConfig
from app.models.employment import Employment

class CPFCalculationEngine:
    """
    Singapore CPF Calculation Engine (2024-2026 Rules).
    Handles OW/AW ceilings and age-based rates.
    """
    
    OW_CEILING = Decimal("6800.00")
    AW_CEILING_TOTAL = Decimal("102000.00")

    @staticmethod
    def round_cpf(amount: Decimal) -> Decimal:
        """CPF rules: Round to nearest dollar for contributions."""
        return amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)

    async def get_rates(
        self, 
        db: AsyncSession, 
        citizenship_type: str, 
        age: int, 
        effective_date: date
    ) -> Optional[CPFRateConfig]:
        """Looks up the statutory rates from the database config."""
        result = await db.execute(
            select(CPFRateConfig).where(
                CPFRateConfig.citizenship_type == citizenship_type,
                CPFRateConfig.age_from <= age,
                CPFRateConfig.age_to >= age,
                CPFRateConfig.effective_date <= effective_date,
                (CPFRateConfig.end_date == None) | (CPFRateConfig.end_date >= effective_date)
            )
        )
        return result.scalar_one_or_none()

    def calculate_ow_cpf(
        self, 
        ow_amount: Decimal, 
        employee_rate: Decimal, 
        employer_rate: Decimal,
        ow_ceiling: Decimal = Decimal("6800.00")
    ) -> Dict[str, Decimal]:
        """
        Calculates CPF for Ordinary Wages.
        Applies the configured monthly ceiling (e.g., $6,800 for 2024, $7,400 for 2025).
        """
        eligible_ow = min(ow_amount, ow_ceiling)
        
        cpf_ee = self.round_cpf(eligible_ow * employee_rate)
        cpf_er = self.round_cpf(eligible_ow * employer_rate)
        
        return {
            "cpf_ee_ow": cpf_ee,
            "cpf_er_ow": cpf_er,
            "eligible_ow": eligible_ow
        }

    def calculate_aw_cpf(
        self, 
        aw_amount: Decimal, 
        ytd_ow: Decimal, 
        ytd_aw_calculated: Decimal, 
        employee_rate: Decimal, 
        employer_rate: Decimal,
        aw_ceiling_total: Decimal = Decimal("102000.00")
    ) -> Dict[str, Decimal]:
        """
        Calculates CPF for Additional Wages.
        Applies the Annual AW Ceiling: aw_ceiling_total - Total OW for the year.
        """
        remaining_aw_ceiling = max(Decimal("0"), aw_ceiling_total - ytd_ow)
        eligible_aw = min(aw_amount, max(Decimal("0"), remaining_aw_ceiling - ytd_aw_calculated))
        
        cpf_ee = self.round_cpf(eligible_aw * employee_rate)
        cpf_er = self.round_cpf(eligible_aw * employer_rate)
        
        return {
            "cpf_ee_aw": cpf_ee,
            "cpf_er_aw": cpf_er,
            "eligible_aw": eligible_aw
        }

# Singleton instance
cpf_engine = CPFCalculationEngine()
