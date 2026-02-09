import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Contacts } from './pages/Contacts';
import { Orders } from './pages/Orders';
import { WhatsApp } from './pages/WhatsApp';
import { Activities } from './pages/Activities';
import { ImportExport } from './pages/ImportExport';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="activities" element={<Activities />} />
          <Route path="orders" element={<Orders />} />
          <Route path="deals" element={<PlaceholderPage title="Deals" />} />
          <Route path="whatsapp" element={<WhatsApp />} />
          <Route path="import-export" element={<ImportExport />} />
          <Route path="help" element={<PlaceholderPage title="Help" />} />
        </Route>
      </Routes>
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
