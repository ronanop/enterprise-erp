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
      "I understand that after approval, app login and eligible app-associated data may be removed, while employment / payroll / statutory records may be retained by my employer where required by law or HR policy.",
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
        in the Employee App under Profile · Contact:{" "}
        <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a>
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
            Package: <code>com.cache.employeeportal</code> · Domain:{" "}
            <code>iconnectplus.in</code>
          </li>
        </ul>
      </div>

      <h2>What we remove after an approved request</h2>
      <ul>
        <li>Employee App login / session access for that account</li>
        <li>
          Eligible app-associated data we control (e.g. push tokens, device
          session material, app preferences tied to the login)
        </li>
      </ul>

      <h2>What employment records stay (HR / legal retention)</h2>
      <p>
        Your employer may keep the records below in HR, ERP, or payroll systems
        even after the mobile login is deleted. This is normal for employment
        law, payroll, tax, and audit:
      </p>
      <ul>
        <li>
          Employee master data (name, employee code, role, joining / exit dates,
          work contact details on the HR file)
        </li>
        <li>Attendance, leave, and timesheet history</li>
        <li>Payslips, tax, and other statutory / payroll registers</li>
        <li>
          KYC and employment documents the organization is required to retain
        </li>
        <li>Approval trails and security / audit logs under legal hold</li>
      </ul>
      <p>
        Retention length follows your <strong>employer&apos;s HR policy</strong>{" "}
        and applicable law. Uninstalling the app does not erase those employer
        records. See also the{" "}
        <a href="/legal/privacy">Privacy Policy — Retention</a> section.
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
