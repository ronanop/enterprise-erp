import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { HomePage } from "./pages/HomePage";
import { AppPage } from "./pages/AppPage";
import { SupportPage } from "./pages/SupportPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { DataDeletionPage } from "./pages/DataDeletionPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="app" element={<AppPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="legal/privacy" element={<PrivacyPage />} />
        <Route path="legal/terms" element={<TermsPage />} />
        <Route path="legal/data-deletion" element={<DataDeletionPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
