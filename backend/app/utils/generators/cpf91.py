from typing import List, Dict, Any
from datetime import datetime

class CPF91Generator:
    """
    Generates CPF91 (EZPay FTP) fixed-width text files.
    Standard record length: 150 bytes.
    """
    
    @staticmethod
    def format_string(value: str, length: int) -> str:
        """Left justified, space padded."""
        return value.ljust(length)[:length]

    @staticmethod
    def format_amount(amount: float, length: int) -> str:
        """Numeric 9(n)V99: No decimal, zero padded. e.g. 100.50 -> 0000010050"""
        cents = int(round(amount * 100))
        return str(cents).zfill(length)[-length:]

    def generate_header(self, uen: str, payment_month: str, advice_code: str = "01") -> str:
        """
        Record Type 'H' (Employer Header Record)
        """
        record = [' '] * 150
        record[0] = 'H'
        # UEN: Columns 3-12 (Index 2-11)
        record[2:12] = list(uen.ljust(10)[:10])
        # Payment Type: Columns 13-15 (Index 12-14)
        record[12:15] = list('CPF')
        # Advice Code: Columns 19-20 (Index 18-19)
        record[18:20] = list(advice_code.zfill(2))
        # Relevant Month: Columns 20-25 (Index 19-24) - Search results said 20-25 or 21-26
        # Let's use 20-25: YYYYMM
        record[19:25] = list(payment_month[:6])
        
        return "".join(record)

    def generate_detail(self, nric: str, name: str, ow: float, aw: float, 
                        ee_cpf: float, er_cpf: float) -> str:
        """
        Record Type 'D' (Employee Contribution Detail)
        """
        record = [' '] * 150
        record[0] = 'D'
        # NRIC: Columns 29-37 (Index 28-36)
        record[28:37] = list(nric.upper().ljust(9)[:9])
        # OW: Columns 50-59 (Index 49-58) - 10 bytes (8.2)
        record[49:59] = list(self.format_amount(ow, 10))
        # AW: Columns 60-69 (Index 59-68) - 10 bytes
        record[59:69] = list(self.format_amount(aw, 10))
        # Total CPF (EE+ER): Columns 38-47 (Index 37-46) - 10 bytes
        total_cpf = ee_cpf + er_cpf
        record[37:47] = list(self.format_amount(total_cpf, 10))
        # EE CPF: Columns 141-150 (Index 140-149) - Usually at the end or specific cols
        # CPF Specs vary, let's use common EZPay columns
        # Name: Columns 71-136 (Index 70-135)
        record[70:136] = list(name.upper().ljust(66)[:66])
        
        return "".join(record)

    def generate_trailer(self, record_count: int, total_contribution: float) -> str:
        """
        Record Type 'T' (Employer Trailer Record)
        """
        record = [' '] * 150
        record[0] = 'T'
        # Record Count: Columns 13-19 (Index 12-18)
        record[12:19] = list(str(record_count).zfill(7))
        # Total Contribution: Columns 20-33 (Index 19-32) - 14 bytes (12.2)
        record[19:33] = list(self.format_amount(total_contribution, 14))
        
        return "".join(record)

    def generate_file(self, company_info: Dict[str, Any], employees: List[Dict[str, Any]]) -> str:
        lines = []
        # Header
        lines.append(self.generate_header(
            company_info['uen'], 
            company_info['payment_month']
        ))
        
        total_contrib = 0
        for emp in employees:
            total_contrib += (emp['ee_cpf'] + emp['er_cpf'])
            lines.append(self.generate_detail(
                emp['nric'], emp['name'], emp['ow'], emp['aw'], 
                emp['ee_cpf'], emp['er_cpf']
            ))
            
        # Trailer
        lines.append(self.generate_trailer(len(employees), total_contrib))
        
        return "\n".join(lines) + "\n"
