// src/App.tsx
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import MainPage      from './pages/MainPage'
import AESaveReportPage  from './pages/AEReportPage'
import AEMakeReportPage  from './pages/AEMakeReportPage'
import IssuesPage    from './pages/IssuesPage'
import LoginPage     from './pages/LoginPage'
import SettingPage   from './pages/SettingPage'
import SWSampleTestPage from './pages/SWSampleTestPage';

function isAuthenticated() {
  return localStorage.getItem('fap_logged_in') === '1';
}

export default function App() {
  const location = useLocation();

  if (!isAuthenticated() && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/main" element={<MainPage />} />
      <Route path="/ae-save-report" element={<AESaveReportPage />} />
      <Route path="/ae-make-report" element={<AEMakeReportPage />} />
      <Route path="/ae-issues" element={<IssuesPage />} />
      <Route path="/sw-sample-test" element={<SWSampleTestPage />} />
      <Route path="/setting" element={<SettingPage />} />
      <Route path="/" element={<Navigate to="/main" replace />} />
    </Routes>
  );
}
