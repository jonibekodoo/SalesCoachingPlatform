import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, auth } from './api';
import { Layout } from './components/Layout';
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

export default function App() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.get()) {
      setUser(null);
      return;
    }
    api
      .me()
      .then((m) => setUser(m.username))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      navigate('/login');
    };
    window.addEventListener('scp-logout', onLogout);
    return () => window.removeEventListener('scp-logout', onLogout);
  }, [navigate]);

  if (user === undefined) return <Spinner />;

  const logout = () => {
    auth.clear();
    setUser(null);
    navigate('/login');
  };

  return (
    <Routes>
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
