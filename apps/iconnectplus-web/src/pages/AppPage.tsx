import { Link } from "react-router-dom";

export function AppPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow">Employee Self-Service</div>
          <h1>iConnect Plus Employee App</h1>
          <p>
            Mobile ESS for attendance, leave, payslips, documents, approvals,
            and workplace tools. Package id{" "}
            <strong>com.iconnectplusin.employeeportal</strong>.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" to="/support">
              Need access? Contact HR
            </Link>
            <Link className="btn btn-secondary" to="/legal/privacy">
              Privacy Policy
            </Link>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container grid-3">
          <article className="feature">
            <h3>What employees can do</h3>
            <p>
              Punch with precise GPS, apply leave, view payslips, upload
              documents, book rooms, and manage profile &amp; security settings.
            </p>
          </article>
          <article className="feature">
            <h3>Permissions we ask</h3>
            <p>
              Location (while punching), camera (selfie / barcode), photos via
              the system picker, and notifications for workplace alerts. Each
              permission is optional at the OS level for unrelated features.
            </p>
          </article>
          <article className="feature">
            <h3>Accounts</h3>
            <p>
              Logins are provisioned by your employer (company code + employee
              code or email). There is no public self-signup. Request deletion
              from the app or{" "}
              <Link to="/legal/data-deletion">this website</Link>.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Store listing links</h2>
            <p className="muted">
              Use these URLs in App Store Connect and Google Play Console.
            </p>
          </div>
          <div className="card">
            <ul>
              <li>
                Marketing: <code>https://iconnectplus.in</code> or{" "}
                <code>https://iconnectplus.in/app</code>
              </li>
              <li>
                Support: <code>https://iconnectplus.in/support</code>
              </li>
              <li>
                Privacy: <code>https://iconnectplus.in/legal/privacy</code>
              </li>
              <li>
                Terms: <code>https://iconnectplus.in/legal/terms</code>
              </li>
              <li>
                Data deletion:{" "}
                <code>https://iconnectplus.in/legal/data-deletion</code>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
