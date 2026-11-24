import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page-hero">
      <div className="container">
        <h1>Page not found</h1>
        <p>That URL is not part of iconnectplus.in.</p>
        <div className="cta-row">
          <Link className="btn btn-primary" to="/">
            Back home
          </Link>
        </div>
      </div>
    </section>
  );
}
