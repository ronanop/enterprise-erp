import { downloadEssPayslipPdf } from "@/lib/hrms-payslip-pdf";
import { essService } from "@/services/ess-service";
import type { EssPayslip } from "@/types/api";

/** Download the HRMS-format salary-slip PDF for an ESS payslip. */
export async function downloadEssPayslip(slip: EssPayslip): Promise<void> {
  const detail =
    slip.earnings || slip.deductions || slip.payslip_json
      ? slip
      : ((await essService.payslip(slip.id)).data ?? slip);

  const [meRes, bankRes, kycRes] = await Promise.all([
    essService.me().catch(() => null),
    essService.bank().catch(() => null),
    essService.kyc().catch(() => null),
  ]);

  const pj = (detail.payslip_json ?? {}) as Record<string, unknown>;
  const companyName =
    (typeof pj.company_name === "string" && pj.company_name) ||
    (typeof pj.legal_name === "string" && pj.legal_name) ||
    null;
  const companyAddress = [
    typeof pj.company_address === "string" ? pj.company_address : "",
    typeof pj.address_line1 === "string" ? pj.address_line1 : "",
    typeof pj.address_line2 === "string" ? pj.address_line2 : "",
  ].filter(Boolean);

  await downloadEssPayslipPdf(
    detail,
    {
      me: meRes?.data ?? null,
      bank: bankRes?.data ?? null,
      kyc: kycRes?.data ?? null,
      companyName,
      companyAddress,
      companyPan:
        (typeof pj.company_pan === "string" && pj.company_pan) ||
        (typeof pj.pan === "string" && pj.pan) ||
        null,
      companyTan:
        (typeof pj.company_tan === "string" && pj.company_tan) ||
        (typeof pj.tan === "string" && pj.tan) ||
        null,
    },
    `${detail.document_number || "salary-slip"}.pdf`,
  );
}
