import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        localStorage.setItem('fap_logged_in', '1');
        localStorage.setItem('fap_user_id', id);
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