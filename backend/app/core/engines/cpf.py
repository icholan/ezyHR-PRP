from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, Any
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.statutory import CPFRateConfig, CPFAllocationConfig
from app.models.employment import Employment

class CPFCalculationEngine:
    """
    Singapore CPF Calculation Engine (2024-2026 Rules).
    Handles OW/AW ceilings and age-based rates.
    """
    
    OW_CEILING = Decimal("6800.00")
    AW_CEILING_TOTAL = Decimal("102000.00")

    @staticmethod
    def round_down_dollar(amount: Decimal) -> Decimal:
        """CPF rules: Employee contribution is always rounded down to nearest dollar."""
        return amount.quantize(Decimal("1"), rounding="ROUND_FLOOR")

    @staticmethod
    def round_nearest_dollar(amount: Decimal) -> Decimal:
        """CPF rules: Total contribution is rounded to nearest dollar."""
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
                (CPFRateConfig.end_date == None) | (CPFRateConfig.end_date >= effective_date),
                CPFRateConfig.is_expired == False
            ).order_by(CPFRateConfig.effective_date.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    async def get_allocations(
        self,
        db: AsyncSession,
        age: int,
        effective_date: date
    ) -> Optional[CPFAllocationConfig]:
        """Looks up the OA/SA/MA allocation ratios."""
        result = await db.execute(
            select(CPFAllocationConfig).where(
                CPFAllocationConfig.age_from <= age,
                CPFAllocationConfig.age_to >= age,
                CPFAllocationConfig.effective_date <= effective_date,
                (CPFAllocationConfig.end_date == None) | (CPFAllocationConfig.end_date >= effective_date),
                CPFAllocationConfig.is_expired == False
            ).order_by(CPFAllocationConfig.effective_date.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    def allocate_contribution(
        self,
        total_contribution: Decimal,
        sa_ratio: Decimal,
        ma_ratio: Decimal
    ) -> Dict[str, Decimal]:
        """
        Allocates total contribution to MA, SA/RA, and OA accounts sequentially.
        Rule: 
        1. Compute MediSave (MA) first (fraction of a cent dropped)
        2. Followed by Special/Retirement (SA/RA) (fraction of a cent dropped)
        3. Remainder is allocated to Ordinary Account (OA)
        """
        # 1. MediSave Account (MA) - Round down to nearest cent
        ma_amt = (total_contribution * ma_ratio).quantize(Decimal("0.01"), rounding="ROUND_DOWN")
        
        # 2. Special/Retirement Account (SA/RA) - Round down to nearest cent
        sa_amt = (total_contribution * sa_ratio).quantize(Decimal("0.01"), rounding="ROUND_DOWN")
        
        # 3. Ordinary Account (OA) - Remainder
        oa_amt = total_contribution - ma_amt - sa_amt
        
        return {
            "oa": oa_amt,
            "sa": sa_amt,
            "ma": ma_amt
        }

    def calculate_monthly_cpf(
        self,
        ow_amount: Decimal,
        aw_amount: Decimal,
        ytd_ow: Decimal,
        ytd_aw_calculated: Decimal,
        employee_rate: Decimal,
        employer_rate: Decimal,
        ow_ceiling: Decimal = Decimal("6800.00"),
        aw_ceiling_total: Decimal = Decimal("102000.00"),
        allocation_ratios: Optional[Dict[str, Decimal]] = None
    ) -> Dict[str, Any]:
        """
        Calculates combined monthly CPF for both OW and AW.
        Rule 4: Compute and sum up the CPF contributions for OW and AW, 
        then apply rounding rules to the total.
        """
        # 1. Eligible OW and AW
        eligible_ow = min(ow_amount, ow_ceiling)
        remaining_aw_ceiling = max(Decimal("0"), aw_ceiling_total - ytd_ow)
        eligible_aw = min(aw_amount, max(Decimal("0"), remaining_aw_ceiling - ytd_aw_calculated))

        # 2. Sum unrounded contributions
        # Step 4: Sum up the CPF contributions that are payable for OW and AW
        total_unrounded = (eligible_ow + eligible_aw) * (employee_rate + employer_rate)
        ee_unrounded = (eligible_ow + eligible_aw) * employee_rate

        # 3. Apply rounding rules on the combined totals
        # Step 1: Compute the total CPF contribution (rounded to the nearest dollar)
        total_cpf = self.round_nearest_dollar(total_unrounded)
        
        # Step 2: Compute the employee’s share (rounded down to the nearest dollar)
        cpf_ee = self.round_down_dollar(ee_unrounded)
        
        # Step 3: Employer’s share = Total contribution - Employee’s share
        cpf_er = total_cpf - cpf_ee

        result = {
            "total_cpf": total_cpf,
            "cpf_ee": cpf_ee,
            "cpf_er": cpf_er,
            "eligible_ow": eligible_ow,
            "eligible_aw": eligible_aw
        }

        # 4. Allocate to accounts
        if allocation_ratios:
            split = self.allocate_contribution(
                total_cpf,
                allocation_ratios["sa"],
                allocation_ratios["ma"]
            )
            result["allocation"] = split

        return result

    def calculate_ow_cpf(
        self, 
        ow_amount: Decimal, 
        employee_rate: Decimal, 
        employer_rate: Decimal,
        ow_ceiling: Decimal = Decimal("6800.00"),
        allocation_ratios: Optional[Dict[str, Decimal]] = None
    ) -> Dict[str, Decimal]:
        """
        Legacy helper: Calculates CPF for Ordinary Wages only.
        """
        return self.calculate_monthly_cpf(
            ow_amount=ow_amount,
            aw_amount=Decimal("0"),
            ytd_ow=Decimal("0"),
            ytd_aw_calculated=Decimal("0"),
            employee_rate=employee_rate,
            employer_rate=employer_rate,
            ow_ceiling=ow_ceiling,
            allocation_ratios=allocation_ratios
        )

    def calculate_aw_cpf(
        self, 
        aw_amount: Decimal, 
        ytd_ow: Decimal, 
        ytd_aw_calculated: Decimal, 
        employee_rate: Decimal, 
        employer_rate: Decimal,
        aw_ceiling_total: Decimal = Decimal("102000.00"),
        allocation_ratios: Optional[Dict[str, Decimal]] = None
    ) -> Dict[str, Decimal]:
        """
        Legacy helper: Calculates CPF for Additional Wages only.
        """
        return self.calculate_monthly_cpf(
            ow_amount=Decimal("0"),
            aw_amount=aw_amount,
            ytd_ow=ytd_ow,
            ytd_aw_calculated=ytd_aw_calculated,
            employee_rate=employee_rate,
            employer_rate=employer_rate,
            aw_ceiling_total=aw_ceiling_total,
            allocation_ratios=allocation_ratios
        )

# Singleton instance
cpf_engine = CPFCalculationEngine()
