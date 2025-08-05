// 수정 불가 
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password })
      });
      if (res.ok) {
        // 기존 localStorage 클리어
        localStorage.clear();
        
        // 새로운 로그인 정보 저장
        localStorage.setItem('fap_logged_in', '1');
        localStorage.setItem('fap_user_id', id);
        
        // API 키 존재 여부 확인
        try {
          const apiResponse = await axios.get(`http://localhost:8000/api/settings/check-user-api-key/${id}`);
          
          if (apiResponse.data.success) {
            // API 키가 있으면 사용자 정보를 localStorage에 저장
            const userData = apiResponse.data.data;
            localStorage.setItem('fap_user_name', userData.user_name);
            localStorage.setItem('fap_user_email', userData.email);
          }
          // API 키가 없으면 MainPage에서 알림 표시할 예정
        } catch (error) {
          // API 키 확인 중 오류가 발생해도 로그인은 성공으로 처리
          console.error('API 키 확인 중 오류:', error);
        }
        
        navigate('/main');
      } else {
        const data = await res.json();
        alert(data.detail || '로그인에 실패했습니다.');
      }
    } catch (err) {
      alert('서버와 통신에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <form onSubmit={handleLogin} className="login-form">
        <h2 className="login-title">FAP 로그인</h2>
        <div>
          <label className="login-label">아이디</label>
          <input type="text" value={id} onChange={e => setId(e.target.value)} required className="login-input" />
        </div>
        <div>
          <label className="login-label">비밀번호</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="login-input" />
        </div>
        <button type="submit" disabled={loading} className="login-btn">
          {loading ? '로그인 중...' : '로그인'}
        </button>
        <div className="login-info">
          PMS 시스템과 동일한 계정을 사용합니다<br/>
          로그인시 실패하는경우<br/>
          <a href="https://pms.ati2000.co.kr/" target="_blank" rel="noopener noreferrer">https://pms.ati2000.co.kr</a><br/>
          에서 비밀번호 확인 후 다시 로그인 해주세요
        </div>
      </form>
    </div>
  );
} 