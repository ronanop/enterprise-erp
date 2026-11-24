import { Link } from "react-router-dom";

export function SupportPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>Support</h1>
          <p>
            For login issues, device access, or ESS features, start with your
            organization&apos;s HR / IT team. iConnect Plus support can help with
            product and privacy requests.
          </p>
        </div>
      </section>

      <section className="section alt">
        <div className="container grid-3">
          <article className="feature">
            <h3>Email</h3>
            <p>
              <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a>
              <br />
              Typical topics: access, leave balances, payslip questions, app
              permissions.
            </p>
          </article>
          <article className="feature">
            <h3>Privacy &amp; deletion</h3>
            <p>
              Read the <Link to="/legal/privacy">Privacy Policy</Link> or{" "}
              <Link to="/legal/data-deletion">request account / data deletion</Link>
              .
            </p>
          </article>
          <article className="feature">
            <h3>Employee app</h3>
            <p>
              Install from your organization&apos;s Play Store / App Store listing
              when published. Demo builds may show sample data only.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
