import csv
import io
from typing import List, Dict, Any

class GIROGenerator:
    """
    Generates a standard CSV GIRO file for bulk payroll payments.
    Compatible with most Singapore corporate banking portals (DBS, UOB, OCBC).
    """

    def generate_csv(self, records: List[Dict[str, Any]]) -> str:
        """
        Expects records with: name, bank_code, branch_code, account_no, amount, description
        """
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header Row (Some banks require header, some don't. We'll include a generic one)
        writer.writerow(["Beneficiary Name", "Bank Code", "Branch Code", "Account Number", "Amount", "Payment Description"])
        
        for rec in records:
            writer.writerow([
                rec.get("name", "").upper(),
                rec.get("bank_code", ""),
                rec.get("branch_code", ""),
                rec.get("account_no", ""),
                f"{rec.get('amount', 0):.2f}",
                rec.get("description", "SALARY PAYMENT")
            ])
            
        return output.getvalue()

    def generate_fixed_width_dbs(self, records: List[Dict[str, Any]]) -> str:
        """
        Placeholder for DBS IDEAL fixed-width format (120 bytes) if needed.
        """
        pass
