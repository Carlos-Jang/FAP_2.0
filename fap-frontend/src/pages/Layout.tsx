/**
 * FAP 2.0 - 공통 레이아웃 컴포넌트 (프론트엔드)
 * 
 * 핵심 역할:
 * - FAP 2.0의 모든 페이지에 공통으로 적용되는 레이아웃 구조
 * - 사용자 인증 상태 관리 및 세션 정보 표시
 * - 권한 기반 네비게이션 메뉴 제공
 * - 전역 UI 요소 (헤더, 네비게이션, 로그아웃) 관리
 * 
 * 주요 기능:
 * - 공통 헤더: 사용자 정보 표시, 로그아웃, PMS 링크, 설정 버튼
 * - 권한 기반 네비게이션: 사용자 역할에 따른 메뉴 표시 제어
 * - 세션 관리: localStorage 기반 사용자 정보 관리
 * - 페이지 컨텐츠 래핑: 모든 페이지 컨텐츠를 일관된 레이아웃으로 감싸기
 * 
 * 네비게이션 구조:
 * - Main: 메인 대시보드
 * - AE Save Report: AE 보고서 저장
 * - AE Make Report: AE 보고서 생성
 * - AE Issues: AE 이슈 관리
 * - SW Sample TEST: SW 샘플 테스트
 * 
 * 권한 관리:
 * - admin 사용자: 모든 탭 접근 가능
 * - AE 사용자: Main, AE Make Report, AE Issues 탭만 접근
 * - 기타 사용자: 기본적으로 접근 제한
 * 
 * UI 구성:
 * - 상단 헤더: FAP 2.0 로고, 사용자 정보, 기능 버튼들
 * - 네비게이션 바: 권한별 메뉴 탭 (설정 페이지에서는 숨김)
 * - 컨텐츠 영역: 페이지별 컨텐츠 표시
 * 
 * 사용자 정보 표시:
 * - User ID: 로그인한 사용자 ID
 * - User Name: 사용자 이름 (API 키 등록 시 저장됨)
 * - 실시간 세션 정보 업데이트
 * 
 * 기능 버튼:
 * - Log out: 로그아웃 및 로그인 페이지 이동
 * - PMS: PMS 시스템 새 창으로 열기
 * - Setting: 설정 페이지로 이동
 * 
 * 반응형 특징:
 * - 설정 페이지에서는 네비게이션 바 숨김
 * - 일관된 스타일링 및 레이아웃 유지
 * - 사용자 친화적인 인터페이스
 */

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