import Layout from './Layout';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function SettingPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [projectLimit, setProjectLimit] = useState(1000);
  const [issueLimit, setIssueLimit] = useState(10000);



  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:8000/api/settings/save-user-api-key', {
        api_key: apiKey
      });

      if (response.data.success) {
        const userData = response.data.data;
        alert(`API 키가 성공적으로 저장되었습니다!\n사용자: ${userData.user_name}\n이메일: ${userData.email}\n\n로그아웃됩니다.`);
        setApiKey(''); // 입력 필드 비우기
        
        // localStorage 클리어 (로그아웃)
        localStorage.clear();
        
        // 로그인 페이지로 이동
        navigate('/login');
      } else {
        alert('API 키 저장 실패: ' + response.data.message);
      }
    } catch (error) {
      console.error('API 키 저장 에러:', error);
      alert('API 키 저장 중 오류가 발생했습니다.');
    }
  };
  const handleExit = () => {
    navigate('/main');
  };

  const handleLoadProjects = async () => {
    try {
      const response = await axios.post('http://localhost:8000/api/issues/sync-projects', {}, {
        params: { limit: projectLimit }
      });
      
      if (response.data.success) {
        alert(`프로젝트 로드 완료!\n${response.data.message}\n총 ${response.data.data.count}개 프로젝트 처리됨`);
      } else {
        alert('프로젝트 로드 실패: ' + response.data.message);
      }
    } catch (error) {
      console.error('프로젝트 로드 에러:', error);
      alert('프로젝트 로드 중 오류가 발생했습니다.');
    }
  };

  const handleLoadIssues = async () => {
    try {
      const response = await axios.post('http://localhost:8000/api/issues/sync', {}, {
        params: { limit: issueLimit }
      });
      
      if (response.data.success) {
        alert(`이슈 로드 완료!\n${response.data.message}\n총 ${response.data.data.count}개 이슈 처리됨`);
      } else {
        alert('이슈 로드 실패: ' + response.data.message);
      }
    } catch (error) {
      console.error('이슈 로드 에러:', error);
      alert('이슈 로드 중 오류가 발생했습니다.');
    }
  };

  // PC/모바일 환경 감지 (900px 이하를 모바일로 간주)
  const isMobile = window.innerWidth <= 900;

  if (isMobile) {
    return (
      <Layout>
        <div style={{
          width: '100%',
          height: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.3rem',
          color: '#222',
          fontWeight: 'bold',
          background: '#fff',
          borderRadius: 24,
        }}>
          PC 환경에서 설정해주세요.
        </div>
      </Layout>
    );
  }

  const btnStyle = {
    background: '#28313b',
    color: '#fff',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: 7,
    padding: '0.4rem 1.2rem',
    fontSize: '1.1rem',
    marginLeft: 8,
    cursor: 'pointer',
    minWidth: 100,
    minHeight: 40,
    boxSizing: 'borderBox' as 'border-box',
  };

  return (
    <Layout>
      <div style={{
        background: '#fff',
        borderRadius: 24,
        minHeight: '80vh',
        height: 'calc(95vh - 120px)',
        padding: '2rem 2rem',
        boxSizing: 'border-box',
        margin: '1.5vh auto 0 auto',
        width: '98vw',
        maxWidth: 1600,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', width: '100%', gap: 16, marginBottom: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, alignItems: 'flex-start', display: 'flex', flexDirection: 'column', color: '#222', fontSize: '1.2rem', fontWeight: 500, marginTop: 0 }}>
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontWeight: 600, fontSize: '1.15rem', marginRight: 16 }}>API 키 입력 :</span>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="레드마인 API 키를 입력하세요"
                style={{ fontSize: '1.1rem', padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, minWidth: 220, marginRight: 8 }}
              />
              <button
                onClick={() => handleSaveApiKey()}
                style={{
                  fontSize: '1rem',
                  padding: '6px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                저장
              </button>
            </div>

          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-end', marginTop: 0 }}>
            {/* 시스템 관리자용 버튼들 */}
            {localStorage.getItem('fap_user_id') === 'admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {/* Load Project */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>프로젝트 최대:</span>
                    <input
                      type="number"
                      value={projectLimit}
                      onChange={(e) => setProjectLimit(parseInt(e.target.value) || 1000)}
                      style={{
                        width: 80,
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        fontSize: '0.9rem'
                      }}
                      min="1"
                      max="10000"
                    />
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>개</span>
                  </div>
                  <button 
                    style={{...btnStyle, background: '#dc3545'}} 
                    onClick={handleLoadProjects}
                  >
                    Load Project
                  </button>
                </div>
                
                {/* Load Issue */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>이슈 최대:</span>
                    <input
                      type="number"
                      value={issueLimit}
                      onChange={(e) => setIssueLimit(parseInt(e.target.value) || 1000)}
                      style={{
                        width: 80,
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        fontSize: '0.9rem'
                      }}
                      min="1"
                      max="10000"
                    />
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>개</span>
                  </div>
                  <button 
                    style={{...btnStyle, background: '#dc3545'}} 
                    onClick={handleLoadIssues}
                  >
                    Load Issue
                  </button>
                </div>
              </div>
            )}
            
            <button style={btnStyle} onClick={handleExit}>exit</button>
          </div>
        </div>
      </div>
    </Layout>
  );
} 