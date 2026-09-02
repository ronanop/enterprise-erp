"use client";

import {
  KYC_PRODUCT_OTHER_VALUE,
  isKycProductPreset,
  kycProductSelectValue,
  type KycHardwareProductOption,
} from "@/lib/crm/kyc-form-data";
import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";

type KycTableProductFieldProps = {
  options: readonly KycHardwareProductOption[];
  value: string;
  onChange: (value: string) => void;
};

export function KycTableProductField({ options, value, onChange }: KycTableProductFieldProps) {
  const selectValue = kycProductSelectValue(value, options);
  const showOtherInput = selectValue === KYC_PRODUCT_OTHER_VALUE;
  const otherValue =
    showOtherInput && value !== KYC_PRODUCT_OTHER_VALUE ? value : "";

  return (
    <div className="min-w-[180px] space-y-1.5">
      <FinanceSelect
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === KYC_PRODUCT_OTHER_VALUE) {
            onChange(
              value && !isKycProductPreset(value, options)
                ? value
                : KYC_PRODUCT_OTHER_VALUE,
            );
            return;
          }
          onChange(next);
        }}
      >
        {options.map((option) => (
          <option key={option.value || "none"} value={option.value}>
            {option.label}
          </option>
        ))}
      </FinanceSelect>
      {showOtherInput ? (
        <Input
          value={otherValue}
          placeholder="Specify product"
          onChange={(event) => {
            const next = event.target.value;
            onChange(next.trim() ? next : KYC_PRODUCT_OTHER_VALUE);
          }}
        />
      ) : null}
    </div>
  );
}
