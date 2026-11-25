export function PrivacyPage() {
  return (
    <article className="legal-wrap">
      <h1>Privacy Policy</h1>
      <p className="meta">
        Effective date: 24 November 2026 · Controller / brand: iConnect Plus
        (iconnectplus.in) · Contact:{" "}
        <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a>
      </p>

      <p>
        This Privacy Policy explains how the iConnect Plus websites and the
        Employee Self-Service (ESS) mobile application (Android / iOS package{" "}
        <code>com.iconnectplusin.employeeportal</code>) collect, use, share, and retain
        information. The app is intended for employees and managers of
        organizations that license iConnect Plus.
      </p>

      <h2>1. Who this applies to</h2>
      <ul>
        <li>Visitors to iconnectplus.in</li>
        <li>Users of the iConnect Plus Employee App (ESS)</li>
        <li>Administrators using related ERP portals operated for their employer</li>
      </ul>

      <h2>2. Information we process</h2>
      <p>Depending on how you use the product, we may process:</p>
      <ul>
        <li>
          <strong>Identity &amp; employment data</strong> — name, employee code,
          company code, email, phone, designation, department, manager, joining
          dates, and similar HR fields (often sourced from your employer&apos;s
          HRMS via the ERP).
        </li>
        <li>
          <strong>Attendance &amp; leave</strong> — punches, corrections, WFH /
          on-duty / comp-off requests, leave applications and balances.
        </li>
        <li>
          <strong>Location</strong> — precise GPS coordinates when you punch
          attendance (while-in-use / foreground). We do not require background
          location for core ESS features.
        </li>
        <li>
          <strong>Camera &amp; media</strong> — images you capture or select for
          face verification, attendance selfies, barcode scanning, or document
          uploads. Photo selection uses the system picker where possible.
        </li>
        <li>
          <strong>Device &amp; notifications</strong> — push tokens, device
          platform, app version, and diagnostic logs needed to deliver alerts
          and secure sessions.
        </li>
        <li>
          <strong>Support requests</strong> — messages you send to HR or to{" "}
          <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a>, including
          data-deletion requests.
        </li>
      </ul>

      <h2>3. How we use information</h2>
      <ul>
        <li>Provide ESS and ERP features your employer enables</li>
        <li>Authenticate sessions and protect accounts</li>
        <li>Verify workplace attendance and process leave / approvals</li>
        <li>Send work-related notifications you allow on your device</li>
        <li>Comply with legal, audit, and employment record obligations</li>
        <li>Improve reliability and security of the service</li>
      </ul>
      <p>We do not sell personal information for advertising.</p>

      <h2>4. Sharing</h2>
      <p>Data may be shared with:</p>
      <ul>
        <li>Your employer (the customer organization) and authorized admins</li>
        <li>
          HRMS or other systems your employer configures the ERP to connect to
        </li>
        <li>
          Infrastructure providers that host or deliver the service under
          contract
        </li>
        <li>Authorities when required by law</li>
      </ul>

      <h2>5. Retention</h2>
      <p>
        After an approved account / data-deletion request, we distinguish
        <strong> app access data</strong> (which can be removed) from
        <strong> employment records</strong> (which your employer and the law
        may require us to keep).
      </p>
      <h3>Removed or disabled after an approved deletion request</h3>
      <ul>
        <li>Employee App login / session credentials for the mobile product</li>
        <li>Device push-notification tokens registered for the app</li>
        <li>
          App-held preferences and unlock settings that we control for your
          device sessions
        </li>
      </ul>
      <h3>Employment records that typically stay</h3>
      <p>
        These remain in the employer&apos;s ERP / HRMS (or related systems) as
        needed for HR, payroll, audit, and legal compliance — even if you delete
        the mobile app or your app login:
      </p>
      <ul>
        <li>
          Identity &amp; employment master data (name, employee code, company,
          designation, department, manager, joining / exit dates)
        </li>
        <li>
          Attendance, leave, timesheet, WFH / on-duty / correction history
        </li>
        <li>
          Payroll, payslips, tax / statutory filings, and related compensation
          records
        </li>
        <li>
          Approvals, workflow history, and security / audit logs tied to your
          employment activity
        </li>
        <li>
          KYC or government identifiers your employer collected for employment
          (for example Aadhaar / PAN / UAN references), where required
        </li>
        <li>
          Support or deletion-request correspondence sent to{" "}
          <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a>
        </li>
      </ul>
      <p>
        Retention length follows your employer&apos;s policy and applicable
        employment, tax, and labour laws (often for a multi-year period after
        employment ends). Exact periods are set by the customer organization
        that licenses iConnect Plus — contact your HR team or{" "}
        <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a> for your
        organization&apos;s schedule.
      </p>

      <h2>6. Your choices</h2>
      <ul>
        <li>
          Device permissions (location, camera, photos, notifications) can be
          changed in system settings. Denying a permission disables only the
          features that need it.
        </li>
        <li>
          You may request deletion of your app account / associated personal
          data via the in-app flow or{" "}
          <a href="/legal/data-deletion">iconnectplus.in/legal/data-deletion</a>
          . Accounts are employer-provisioned; HR approval may be required.
        </li>
      </ul>

      <h2>7. Security</h2>
      <p>
        We use HTTPS for API traffic, access controls, and employer-managed
        authentication. No method of transmission or storage is 100% secure.
      </p>

      <h2>8. Children</h2>
      <p>
        The ESS app is not directed to children and is intended for workforce
        use only.
      </p>

      <h2>9. International processing</h2>
      <p>
        Depending on your employer&apos;s deployment, data may be processed on
        servers in regions they select (including private / on-prem deployments
        exposed only through a secured ESS edge).
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy. The effective date above will change when we
        do. Material changes will be reflected on this page.
      </p>

      <h2>11. Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a>
        <br />
        Website: <a href="https://iconnectplus.in">https://iconnectplus.in</a>
      </p>
    </article>
  );
}
