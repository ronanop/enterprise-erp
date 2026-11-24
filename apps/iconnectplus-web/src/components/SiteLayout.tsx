import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/app", label: "Employee App" },
  { to: "/support", label: "Support" },
  { to: "/legal/privacy", label: "Privacy" },
];

export function SiteLayout() {
  return (
    <div className="shell">
      <header className="site-header">
        <div className="container nav">
          <NavLink to="/" className="brand" end>
            <span className="brand-mark" aria-hidden>
              iC
            </span>
            <span>iConnect Plus</span>
          </NavLink>
          <nav className="nav-links" aria-label="Primary">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/legal/data-deletion" className="btn btn-secondary">
              Data deletion
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <NavLink to="/" className="brand">
              <span className="brand-mark" aria-hidden>
                iC
              </span>
              <span>iConnect Plus</span>
            </NavLink>
            <p className="muted" style={{ marginTop: "0.85rem", maxWidth: "36ch" }}>
              Enterprise ERP and Employee Self-Service for organizations that
              need attendance, leave, payroll visibility, and workplace tools in
              one place.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <NavLink to="/app">Employee mobile app</NavLink>
            <NavLink to="/support">Support</NavLink>
            <a href="mailto:erp@iconnectplus.in">erp@iconnectplus.in</a>
          </div>
          <div>
            <h4>Legal</h4>
            <NavLink to="/legal/privacy">Privacy Policy</NavLink>
            <NavLink to="/legal/terms">Terms of Use</NavLink>
            <NavLink to="/legal/data-deletion">Request data deletion</NavLink>
          </div>
        </div>
        <div className="container footer-copy">
          © {new Date().getFullYear()} iConnect Plus · iconnectplus.in · Package
          com.cache.employeeportal
        </div>
      </footer>
    </div>
  );
}
