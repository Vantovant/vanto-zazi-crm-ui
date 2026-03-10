import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Auth } from './pages/Auth';
import { ResetPassword } from './pages/ResetPassword';
import { EnvStatusBanner } from './components/EnvStatusBanner';
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EnvStatusBanner />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
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
            <Route path="help" element={<PlaceholderPage title="Help" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
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
