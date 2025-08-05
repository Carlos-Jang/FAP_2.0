// 수정 불가
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import './MainPage.css';

const ALL_NAVS = [
  { label: 'Main', path: '/main' },
  { label: 'AE Save Report', path: '/ae-save-report' },
  { label: 'AE Make Report', path: '/ae-make-report' },
  { label: 'AE Issues', path: '/ae-issues' },
  { label: 'SW Sample TEST', path: '/sw-sample-test' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('fap_user_id') || '';
    setUserId(id);
    const name = localStorage.getItem('fap_user_name') || '';
    setUserName(name);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fap_logged_in');
    localStorage.removeItem('fap_user_id');
    // localStorage.removeItem('fap_user_name'); // ← 삭제 또는 주석 처리
    navigate('/login');
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
          <button onClick={handleLogout} className="fap-main-btn" style={{ minWidth: 120, padding: '0.5rem 2.2rem', fontSize: '1.08rem' }}>Log out</button>
          <button onClick={() => window.open('https://pms.ati2000.co.kr', '_blank')} className="fap-main-btn">PMS</button>
          <button onClick={() => navigate('/setting')} className="fap-main-btn">Setting</button>
        </div>
      </div>
      {/* 네비게이션 버튼 (설정 페이지에서는 숨김) */}
      {location.pathname !== '/setting' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginLeft: '2.5vw', marginTop: 24, marginBottom: 8 }}>
          {ALL_NAVS.filter(nav => {
            // admin인 경우 모든 탭 표시
            if (userId === 'admin') {
              return true;
            }
            // User Name에 "AE"가 포함된 경우 AE 관련 탭들만 표시
            if (userName.includes('AE')) {
              return nav.label === 'Main' || nav.label === 'AE Make Report' || nav.label === 'AE Issues';
            }
            // 기존 로직 유지 (다른 Role들의 경우)
            return false; // userRoles가 제거되었으므로 항상 false 반환
          }).map(nav => (
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