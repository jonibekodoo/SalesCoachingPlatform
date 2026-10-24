import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, auth, portal, portalAuth } from './api';
import { Layout, PORTAL_NAV } from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CompanyDetailPage from './pages/CompanyDetail';
import Analyses from './pages/Analyses';
import AnalysisDetail from './pages/AnalysisDetail';
import Plans from './pages/Plans';
import Payments from './pages/Payments';
import SettingsPage from './pages/Settings';
import Docs from './pages/Docs';
import PortalLogin from './pages/portal/PortalLogin';
import PortalHome from './pages/portal/PortalHome';
import PortalAnalyze from './pages/portal/PortalAnalyze';
import PortalAnalyses from './pages/portal/PortalAnalyses';
import PortalPayments from './pages/portal/PortalPayments';
import PortalScript from './pages/portal/PortalScript';
import PortalSettings from './pages/portal/PortalSettings';
import type { Company } from './types';

export default function App() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.get()) setUser(null);
    else
      api
        .me()
        .then((m) => setUser(m.username))
        .catch(() => setUser(null));
    if (!portalAuth.get()) setCompany(null);
    else
      portal
        .me()
        .then((m) => setCompany(m.company))
        .catch(() => setCompany(null));
  }, []);

  useEffect(() => {
    // A stale session of one area must not kick the user out of the other one
    const onLogout = () => {
      setUser(null);
      if (!window.location.pathname.startsWith('/portal')) navigate('/login');
    };
    const onPortalLogout = () => {
      setCompany(null);
      if (window.location.pathname.startsWith('/portal')) navigate('/portal/login');
    };
    window.addEventListener('scp-logout', onLogout);
    window.addEventListener('scp-portal-logout', onPortalLogout);
    return () => {
      window.removeEventListener('scp-logout', onLogout);
      window.removeEventListener('scp-portal-logout', onPortalLogout);
    };
  }, [navigate]);

  if (user === undefined || company === undefined) return <Spinner />;

  const logout = () => {
    auth.clear();
    setUser(null);
    navigate('/login');
  };
  const portalLogout = () => {
    portalAuth.clear();
    setCompany(null);
    navigate('/portal/login');
  };

  return (
    <Routes>
      {/* Company portal */}
      <Route path="/portal/login" element={company ? <Navigate to="/portal" replace /> : <PortalLogin onLogin={setCompany} />} />
      <Route
        path="/portal"
        element={
          company ? (
            <Layout username={company.name} subtitle="Kompaniya portali" roleLabel={company.portalEmail || 'Kompaniya'} nav={PORTAL_NAV} onLogout={portalLogout} />
          ) : (
            <Navigate to="/portal/login" replace />
          )
        }
      >
        <Route index element={<PortalHome company={company!} />} />
        <Route path="analyze" element={<PortalAnalyze company={company!} />} />
        <Route path="analyses" element={<PortalAnalyses />} />
        <Route path="analyses/:id" element={<AnalysisDetail portal />} />
        <Route path="payments" element={<PortalPayments />} />
        <Route path="script" element={<PortalScript />} />
        <Route path="settings" element={<PortalSettings company={company!} onCompany={setCompany} />} />
        <Route path="docs" element={<Docs portal />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Route>

      {/* Admin panel */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={(u) => setUser(u)} />} />
      <Route element={user ? <Layout username={user} onLogout={logout} /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="analyses" element={<Analyses />} />
        <Route path="analyses/:id" element={<AnalysisDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="plans" element={<Plans />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="docs" element={<Docs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
