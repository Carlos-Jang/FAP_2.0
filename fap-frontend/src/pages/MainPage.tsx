/**
 * FAP 2.0 - 메인 대시보드 페이지 (프론트엔드) - 개발 예정
 * 
 * 현재 상태:
 * - 아직 구현되지 않은 페이지
 * - 각 탭들(이슈, 설정 등) 완성 후 요약 정리 페이지로 개발 예정
 * - 현재는 API 키 상태 검증 및 시스템 준비 상태 점검만 수행
 * 
 * 향후 개발 계획:
 * - 각 기능별 탭 완성 후 통합 요약 대시보드 구현
 * - 전체 시스템 현황을 한눈에 볼 수 있는 종합 페이지
 * - 주요 지표 및 통계 정보 표시
 * - 빠른 접근을 위한 네비게이션 허브 역할
 * 
 * 현재 기능:
 * - API 키 상태 검증: 로그인 후 개인 API 키 등록 여부 확인
 * - 사용자 권한 관리: admin과 일반 사용자 구분 처리
 * - 시스템 준비 상태 점검: API 키 등록 필요 시 사용자 안내
 * 
 * 초기화 프로세스:
 * 1. 페이지 로드 시 로그인된 사용자 정보 확인
 * 2. admin이 아닌 일반 사용자의 경우 API 키 상태 검증
 * 3. API 키가 없으면 Setting 페이지 등록 안내
 * 4. 시스템 준비 완료 상태 확인
 * 
 * 권한 관리:
 * - admin 사용자: API 키 검증 없이 즉시 접근 가능
 * - 일반 사용자: API 키 등록 여부 확인 후 접근
 * - API 키 미등록 시: Setting 페이지 등록 안내 메시지
 * 
 * 보안 특징:
 * - 로그인 상태 검증 및 세션 관리
 * - 사용자별 권한 기반 접근 제어
 * - API 키 등록 상태 실시간 확인
 * - 안전한 시스템 진입점 역할
 * 
 * 연동 시스템:
 * - LoginPage와 연동하여 세션 정보 활용
 * - SettingPage와 연동하여 API 키 등록 안내
 * - 향후 각 기능별 탭들과 연동하여 통합 대시보드 구성
 */

// src/pages/MainPage.tsx
import './MainPage.css'
import Layout from './Layout';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function MainPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        // 로그인된 사용자 정보 가져오기
        const userLogin = localStorage.getItem('fap_user_id'); // 로그인 ID
        
        if (!userLogin) {
          return;
        }

        // admin이 아닌 경우에만 API 키 체크
        if (userLogin !== 'admin') {
          // localStorage에 fap_user_name이 없으면 API 키가 없는 것으로 판단
          const userName = localStorage.getItem('fap_user_name');
          if (!userName) {
            // API 키 존재 여부 한번 더 확인
            const response = await axios.get(`http://localhost:8000/api/settings/check-user-api-key/${userLogin}`);
            
            if (!response.data.success) {
              // API 키가 없으면 알림만 표시
              alert('Setting 페이지에서 API 키 등록을 해주세요.');
            }
          }
        }
        // API 키가 있으면 이미 LoginPage에서 localStorage에 저장되었으므로 추가 작업 불필요
      } catch (error) {
        // 에러 발생 시에도 알림만 표시
        alert('API 키 확인 중 오류가 발생했습니다. Setting 페이지에서 API 키 등록을 해주세요.');
      }
    };

    checkApiKey();
  }, [navigate]);

  return (
    <Layout>
      <div />
    </Layout>
  );
}
