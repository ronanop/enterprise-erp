const MAILTO =
  "mailto:erp@iconnectplus.in" +
  "?subject=" +
  encodeURIComponent("ESS account / data deletion request") +
  "&body=" +
  encodeURIComponent(
    [
      "Hello HR / iConnect Plus support,",
      "",
      "I request deletion of my Employee App login and eligible associated personal data.",
      "",
      "Full name:",
      "Work email:",
      "Employee code:",
      "Company / organization:",
      "App platform (Android / iOS / both):",
      "Reason (optional):",
      "",
      "I understand that after deletion of my app login, employment records (attendance, leave, payroll, tax/statutory, KYC references, approvals, and audit logs) may still be retained by my employer as required by law and company policy.",
      "",
      "Thank you.",
    ].join("\n"),
  );

export function DataDeletionPage() {
  return (
    <article className="legal-wrap">
      <h1>Request account / data deletion</h1>
      <p className="meta">
        Required web path for Google Play &amp; Apple App Store · Also available
        in the Employee App under Profile.
      </p>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p style={{ marginTop: 0 }}>
          We do <strong>not</strong> collect deletion requests through a web
          form right now. To request deletion, send an email to{" "}
          <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a> using the
          button below. Your mail app opens with a ready-made template — fill in
          your details and send.
        </p>
        <ul>
          <li>
            Employee App accounts are created by your employer (HR / IT), not by
            public self-registration.
          </li>
          <li>
            Deleting the mobile login and eligible personal app data may require
            employer approval.
          </li>
          <li>
            Package: <code>com.iconnectplusin.employeeportal</code> · Domain:{" "}
            <code>iconnectplus.in</code>
          </li>
        </ul>
      </div>

      <h2>What stays after deletion (retention)</h2>
      <p>
        An approved request removes or disables <strong>Employee App login
        access</strong>, device push tokens, and related app session data. It
        does <strong>not</strong> erase your employer&apos;s statutory or HR
        records. The following typically remain in the ERP / HRMS under your
        employer&apos;s retention schedule and applicable law:
      </p>
      <ul>
        <li>Employment master data (identity, role, joining / exit)</li>
        <li>Attendance, leave, and timesheet history</li>
        <li>Payroll, payslips, and tax / statutory filings</li>
        <li>Approvals, workflow history, and audit / security logs</li>
        <li>Employment KYC / government ID references where required</li>
        <li>Emails about this deletion request</li>
      </ul>
      <p>
        Full detail:{" "}
        <a href="/legal/privacy">Privacy Policy §5 Retention</a>. For your
        organization&apos;s exact retention period, ask HR or email{" "}
        <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a>.
      </p>

      <div className="cta-row">
        <a className="btn btn-primary" href={MAILTO}>
          Email deletion request
        </a>
        <a className="btn btn-secondary" href="mailto:erp@iconnectplus.in">
          Or email erp@iconnectplus.in
        </a>
      </div>

      <p className="muted" style={{ marginTop: "1.5rem" }}>
        If the button does not open your mail app, copy this address:{" "}
        <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a> and include
        your employee code, company name, and work email.
      </p>
    </article>
  );
}
