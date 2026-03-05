from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional

class StatutoryFundsEngine:
    """
    Engine for calculating SHG (Social Help Groups) and SDL (Skills Development Levy).
    SHG rates are based on race and gross salary.
    SDL is 0.25% of gross salary, capped between $2 and $11.25.
    """

    # SDL Configuration
    SDL_RATE = Decimal("0.0025")
    SDL_MIN = Decimal("2.00")
    SDL_MAX = Decimal("11.25")

    # SHG Rates (Simplified snapshots for 2024)
    SHG_RATES = {
        "CDAC": [ # Chinese
            (Decimal("2000.00"), Decimal("0.50")),
            (Decimal("3500.00"), Decimal("1.00")),
            (Decimal("5000.00"), Decimal("1.50")),
            (Decimal("7500.00"), Decimal("2.00")),
            (Decimal("Infinity"), Decimal("3.00"))
        ],
        "SINDA": [ # Indian
            (Decimal("1000.00"), Decimal("1.00")),
            (Decimal("1500.00"), Decimal("3.00")),
            (Decimal("2500.00"), Decimal("5.00")),
            (Decimal("4500.00"), Decimal("7.00")),
            (Decimal("7500.00"), Decimal("9.00")),
            (Decimal("10000.00"), Decimal("12.00")),
            (Decimal("15000.00"), Decimal("18.00")),
            (Decimal("Infinity"), Decimal("30.00"))
        ],
        "MBMF": [ # Malay/Muslim
            (Decimal("1000.00"), Decimal("3.00")),
            (Decimal("2000.00"), Decimal("4.50")),
            (Decimal("3000.00"), Decimal("6.50")),
            (Decimal("4000.00"), Decimal("11.00")),
            (Decimal("6000.00"), Decimal("13.50")),
            (Decimal("8000.00"), Decimal("19.50")),
            (Decimal("10000.00"), Decimal("22.00")),
            (Decimal("Infinity"), Decimal("26.00"))
        ],
        "ECF": [ # Eurasian
            (Decimal("1000.00"), Decimal("2.00")),
            (Decimal("1500.00"), Decimal("4.00")),
            (Decimal("2500.00"), Decimal("6.00")),
            (Decimal("4000.00"), Decimal("9.00")),
            (Decimal("7000.00"), Decimal("12.00")),
            (Decimal("10000.00"), Decimal("16.00")),
            (Decimal("Infinity"), Decimal("20.00"))
        ]
    }

    def calculate_sdl(self, gross_salary: Decimal) -> Decimal:
        """Calculates SDL: 0.25% of gross, min $2, max $11.25."""
        if gross_salary <= 0:
            return Decimal("0.00")
        
        sdl = gross_salary * self.SDL_RATE
        # SDL is truncated, but usually we just calculate to 2 decimal places carefully
        sdl = max(self.SDL_MIN, min(self.SDL_MAX, sdl))
        return sdl.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def calculate_shg(self, race: str, religion: str, gross_salary: Decimal) -> Decimal:
        """
        Determines the SHG type based on race/religion and calculates deduction.
        Defaults to 0 if not matching or foreigner (logic handled outside).
        """
        shg_type = None
        # Simplified mapping logic
        race = race.upper() if race else ""
        if "CHINESE" in race:
            shg_type = "CDAC"
        elif "INDIAN" in race:
            shg_type = "SINDA"
        elif "MALAY" in race or "MUSLIM" in (religion.upper() if religion else ""):
            shg_type = "MBMF"
        elif "EURASIAN" in race:
            shg_type = "ECF"
        
        if not shg_type or gross_salary <= 0:
            return Decimal("0.00")
            
        rates = self.SHG_RATES.get(shg_type, [])
        for limit, amount in rates:
            if gross_salary <= limit:
                return amount
        
        return Decimal("0.00")

# Singleton instance
statutory_funds_engine = StatutoryFundsEngine()
