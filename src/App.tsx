import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Auth } from './pages/Auth';
import { ResetPassword } from './pages/ResetPassword';
import { EnvStatusBanner } from './components/EnvStatusBanner';
import { OfflineBanner } from './components/OfflineBanner';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { PwaInstallProvider } from './contexts/PwaInstallContext';
import { Dashboard } from './pages/Dashboard';
import { Contacts } from './pages/Contacts';
import { Orders } from './pages/Orders';
import { WhatsApp } from './pages/WhatsApp';
import { Activities } from './pages/Activities';
import { ImportExport } from './pages/ImportExport';
import { Deals } from './pages/Deals';
import { TeamDashboard } from './pages/TeamDashboard';
import { Duplicates } from './pages/Duplicates';
import { Inventory } from './pages/Inventory';
import { MomentumRun } from './pages/MomentumRun';
import { SponsorIdReview } from './pages/SponsorIdReview';
import { MonthlyActivityPush } from './pages/MonthlyActivityPush';
import { MarketingLayout } from './marketing/MarketingLayout';
import { Home as MarketingHome } from './marketing/pages/Home';
import { Features as MarketingFeatures } from './marketing/pages/Features';
import { HowItWorks as MarketingHowItWorks } from './marketing/pages/HowItWorks';
import { Investors as MarketingInvestors } from './marketing/pages/Investors';
import { Flagship as MarketingFlagship } from './marketing/pages/Flagship';

function App() {
  return (
    <PwaInstallProvider>
      <BrowserRouter>
        <AuthProvider>
          <OfflineBanner />
          <EnvStatusBanner />
          <PwaInstallBanner />
          <Routes>
            {/* Public marketing site */}
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<MarketingHome />} />
              <Route path="/features" element={<MarketingFeatures />} />
              <Route path="/how-it-works" element={<MarketingHowItWorks />} />
              <Route path="/investors" element={<MarketingInvestors />} />
              <Route path="/flagship" element={<MarketingFlagship />} />
            </Route>

            <Route path="/signin" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="activities" element={<Activities />} />
              <Route path="orders" element={<Orders />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="deals" element={<Deals />} />
              <Route path="whatsapp" element={<WhatsApp />} />
              <Route path="import-export" element={<ImportExport />} />
              <Route path="duplicates" element={<Duplicates />} />
              <Route path="team" element={<TeamDashboard />} />
              <Route path="momentum" element={<MomentumRun />} />
              <Route path="sponsor-review" element={<SponsorIdReview />} />
              <Route path="monthly-activity-push" element={<MonthlyActivityPush />} />
              <Route path="help" element={<PlaceholderPage title="Help" />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </PwaInstallProvider>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="text-slate-400 mt-2">This page will be implemented next.</p>
      </div>
    </div>
  );
}

export default App;
