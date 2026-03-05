import xml.etree.ElementTree as ET
from typing import List, Dict, Any
from datetime import datetime

class IR8AGenerator:
    """
    Generates IR8A XML files for IRAS AIS (Auto-Inclusion Scheme).
    """

    def generate_xml(self, entity_info: Dict[str, Any], records: List[Dict[str, Any]]) -> str:
        root = ET.Element("AisBundle")
        header = ET.SubElement(root, "Header")
        ET.SubElement(header, "Source").text = "ezyHR-V2"
        ET.SubElement(header, "DateGenerated").text = datetime.now().strftime("%Y-%m-%d")

        details = ET.SubElement(root, "Details")
        
        for rec in records:
            emp_record = ET.SubElement(details, "IR8A")
            
            # Identity
            identity = ET.SubElement(emp_record, "Identity")
            ET.SubElement(identity, "IDType").text = "NRIC"
            ET.SubElement(identity, "IDNo").text = rec['nric']
            ET.SubElement(identity, "Name").text = rec['name']
            
            # Income
            income = ET.SubElement(emp_record, "Income")
            ET.SubElement(income, "GrossSalary").text = f"{rec['gross_salary']:.2f}"
            ET.SubElement(income, "Bonus").text = f"{rec['bonus']:.2f}"
            ET.SubElement(income, "DirectorFees").text = f"{rec['director_fees']:.2f}"
            
            # Deductions
            deduct = ET.SubElement(emp_record, "Deductions")
            ET.SubElement(deduct, "CPF").text = f"{rec['total_ee_cpf']:.2f}"
            ET.SubElement(deduct, "Donation").text = f"{rec['total_shg']:.2f}"

        # Convert to string with proper XML header
        rough_string = ET.tostring(root, 'utf-8')
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + rough_string.decode('utf-8')
