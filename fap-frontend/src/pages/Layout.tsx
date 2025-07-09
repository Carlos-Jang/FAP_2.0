import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import './MainPage.css';

const ALL_NAVS = [
  { label: 'Main', path: '/main', roles: ['Manager', 'AE', 'SW', 'PM', 'Setup'] },
  { label: 'AE Save Report', path: '/ae-save-report', roles: ['AE'] },
  { label: 'AE Make Report', path: '/ae-make-report', roles: ['AE'] },
  { label: 'AE Issues', path: '/ae-issues', roles: ['Manager', 'AE'] },
  { label: 'SW Sample TEST', path: '/sw-sample-test', roles: ['SW'] },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    const id = localStorage.getItem('fap_user_id') || '';
    setUserId(id);
    const name = localStorage.getItem('fap_user_name') || '';
    setUserName(name);
    const roles = localStorage.getItem('fap_user_roles');
    if (roles) {
      setUserRoles(JSON.parse(roles));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fap_logged_in');
    localStorage.removeItem('fap_user_id');
    localStorage.removeItem('fap_user_name');
    navigate('/login');
  };

  const handleRefresh = async () => {
    try {
      const res = await fetch('/api/projects/refresh', { method: 'POST' });
      if (!res.ok) throw new Error('새로고침 실패');
      const data = await res.json();
      alert(`프로젝트 캐시가 새로고침되었습니다. (총 ${data.count}개)`);
    } catch (e) {
      alert('프로젝트 캐시 새로고침에 실패했습니다.');
    }
  };

  return (
    <div className="fap-main-root">
      {/* 상단 바 */}
      <div className="fap-main-header" style={{ display: 'flex', alignItems: 'center', padding: '0 2vw' }}>
        <div style={{ flex: 1.8, display: 'flex', alignItems: 'center', gap: 32 }}>
          <span className="fap-main-title">FAP 2.0</span>
          <span className="fap-main-user" style={{ fontSize: '1.08rem', color: '#222', fontWeight: 500 }}>
            User ID : {userId} &nbsp; User Name : {userName}
          </span>
        </div>
        <div className="fap-main-header-btns" style={{ flex: 1.2, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {userId === 'admin' && (
            <button onClick={handleRefresh} className="fap-main-btn">Refresh</button>
          )}
          <button onClick={handleLogout} className="fap-main-btn" style={{ minWidth: 120, padding: '0.5rem 2.2rem', fontSize: '1.08rem' }}>Log out</button>
          <button onClick={() => window.open('https://pms.ati2000.co.kr', '_blank')} className="fap-main-btn">PMS</button>
          <button onClick={() => navigate('/setting')} className="fap-main-btn">Setting</button>
        </div>
      </div>
      {/* 네비게이션 버튼 (설정 페이지에서는 숨김) */}
      {location.pathname !== '/setting' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginLeft: '2.5vw', marginTop: 24, marginBottom: 8 }}>
          {ALL_NAVS.filter(nav => nav.roles.some(role => userRoles.includes(role))).map(nav => (
            <button
              key={nav.path}
              onClick={() => navigate(nav.path)}
              className={`fap-nav-btn${location.pathname === nav.path ? ' active' : ''}`}
            >
              {nav.label}
            </button>
          ))}
        </div>
      )}
      {/* 페이지 컨텐츠 */}
      {location.pathname === '/setting' ? (
        children
      ) : (
        <div className="fap-content-box" style={{ margin: '0 2.5vw 2.5vw 2.5vw', minHeight: '60vh', height: 'calc(80vh - 120px)', marginTop: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
} 