from modules.payroll.domain.bank_export_builder import build_bank_export_csv


def test_bank_export_csv_header_and_row():
    csv_text = build_bank_export_csv(
        [
            {
                "employee_code": "E001",
                "employee_name": "Riya Sharma",
                "account_number": "1234 5678 9012",
                "ifsc": "sbin0001234",
                "bank_name": "SBI",
                "account_holder": "Riya Sharma",
                "net_pay": "26300.00",
                "payroll_run_line_id": "line-1",
            }
        ]
    )
    lines = csv_text.strip().split("\n")
    assert lines[0].startswith("employee_code,")
    assert "E001" in lines[1]
    assert "123456789012" in lines[1]
    assert "SBIN0001234" in lines[1]
    assert "26300.00" in lines[1]


def test_bank_export_csv_formula_injection_sanitized():
    csv_text = build_bank_export_csv(
        [
            {
                "employee_code": "=cmd|'/c calc'!A0",
                "employee_name": "+SUM(1+1)",
                "account_number": "123",
                "ifsc": "sbin0001234",
                "bank_name": "SBI",
                "account_holder": "Test",
                "net_pay": "100.00",
                "payroll_run_line_id": "line-1",
            }
        ]
    )
    lines = csv_text.strip().split("\n")
    assert lines[1].startswith("'=cmd")
    assert "'+SUM(1+1)" in lines[1]
