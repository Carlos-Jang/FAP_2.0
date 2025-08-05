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
