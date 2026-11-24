"use client";

import { useState } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const POLICY_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: "8+ characters", test: (v) => v.length >= 8 },
  { label: "Upper & lower case", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "A number", test: (v) => /\d/.test(v) },
  { label: "A symbol", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** Mirrors the API password policy (security/password.py). */
export function passwordMeetsPolicy(value: string): boolean {
  return POLICY_RULES.every((rule) => rule.test(value));
}

function PasswordRevealInput({
  id,
  autoComplete,
  value,
  disabled,
  onChange,
  describedBy,
  invalid,
}: {
  id: string;
  autoComplete: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pr-11 transition-colors duration-200"
        aria-describedby={describedBy}
        aria-invalid={invalid}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function NewPasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  disabled,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  disabled?: boolean;
}) {
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <>
      <div>
        <Label htmlFor="new-password">New password</Label>
        <PasswordRevealInput
          id="new-password"
          autoComplete="new-password"
          value={password}
          disabled={disabled}
          onChange={onPasswordChange}
          describedBy="new-password-rules"
        />
        <ul id="new-password-rules" className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {POLICY_RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-1.5 ${ok ? "text-emerald-700" : "text-muted-foreground"}`}
              >
                {ok ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <Circle className="size-2" aria-hidden />
                )}
                {rule.label}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <PasswordRevealInput
          id="confirm-password"
          autoComplete="new-password"
          value={confirm}
          disabled={disabled}
          onChange={onConfirmChange}
          invalid={mismatch}
        />
        {mismatch ? (
          <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>
        ) : null}
      </div>
    </>
  );
}
