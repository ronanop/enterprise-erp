import { Link } from "react-router-dom";

const features = [
  {
    title: "Employee Self-Service",
    body: "Attendance punch with precise GPS, leave, payslips, documents, and profile — on mobile and web.",
  },
  {
    title: "Manager approvals",
    body: "Team leave, corrections, and workplace requests in one approval inbox.",
  },
  {
    title: "Enterprise ERP core",
    body: "Organization, HR, and operations modules that sync with your HRMS source of truth.",
  },
  {
    title: "Secure by design",
    body: "Employer-provisioned logins, HTTPS APIs, and privacy controls aligned with App Store & Play requirements.",
  },
  {
    title: "Notifications that matter",
    body: "Leave, attendance, and approval alerts with sound — configurable on the device.",
  },
  {
    title: "Demo today, live tomorrow",
    body: "Ship the employee app with demo data, then cut over to your private ESS API without changing the package name.",
  },
];

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Enterprise ERP · Employee ESS</div>
            <h1>Workplace systems that stay with your people.</h1>
            <p className="hero-lead">
              iConnect Plus connects your organization portal and Employee
              Self-Service app — attendance, leave, payslips, and approvals —
              under one brand on iconnectplus.in.
            </p>
            <div className="cta-row">
              <Link className="btn btn-primary" to="/app">
                Employee app
              </Link>
              <Link className="btn btn-secondary" to="/support">
                Get support
              </Link>
            </div>
          </div>

          <div className="phone-frame" aria-hidden>
            <div className="phone-screen">
              <div className="phone-status">
                <span>9:41</span>
                <span>iConnect</span>
              </div>
              <div className="phone-card">
                <strong>Good afternoon, Riya</strong>
                <span className="muted">Checked in · Working hours tracking</span>
              </div>
              <div className="phone-card">
                <strong>Quick actions</strong>
                <span className="muted">Leave · Payslip · Rooms · Policies</span>
              </div>
              <div className="phone-card">
                <strong>Team approvals</strong>
                <span className="muted">2 pending requests</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Built for employers and employees</h2>
            <p className="muted">
              One product family: admin ERP for your teams, ESS for every
              employee on their phone.
            </p>
          </div>
          <div className="grid-3">
            {features.map((f) => (
              <article className="feature" key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="container">
          <div className="section-head">
            <h2>Trust &amp; store readiness</h2>
            <p className="muted">
              Privacy, terms, and account-data deletion are published on this
              domain so the mobile app and store listings can link here.
            </p>
          </div>
          <div className="cta-row">
            <Link className="btn btn-primary" to="/legal/privacy">
              Privacy Policy
            </Link>
            <Link className="btn btn-secondary" to="/legal/terms" style={{ color: "white", borderColor: "rgba(255,255,255,0.35)" }}>
              Terms of Use
            </Link>
            <Link className="btn btn-secondary" to="/legal/data-deletion" style={{ color: "white", borderColor: "rgba(255,255,255,0.35)" }}>
              Request data deletion
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
