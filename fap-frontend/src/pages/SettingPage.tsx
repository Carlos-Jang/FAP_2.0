import Layout from './Layout';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { normalizeText } from '../utils/textUtils';
import axios from 'axios';

const ROLES = ['Manager', 'AE', 'SW', 'PM', 'Setup'];
const TEAMS = ['PM', 'SBU', 'HBU', 'PKG', 'Grobal', 'Sales', 'SW'];

const TEAM_PARTS: { [key: string]: string[] } = {
  SBU: ['Wafer 경기', 'Wafer 중부1', 'Wafer 중부2', 'Measure', 'Reticle'],
  PM: ['PM', 'Setup'],
  HBU: ['경기', '중부'],
};

export default function SettingPage() {
  const navigate = useNavigate();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [userName, setUserName] = useState('');
  const [projectLimit, setProjectLimit] = useState(1000);
  const [issueLimit, setIssueLimit] = useState(10000);

  // 진입 시 localStorage에서 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('fap_user_roles');
    if (saved) {
      setSelectedRoles(JSON.parse(saved));
    }
    const savedTeams = localStorage.getItem('fap_user_teams');
    if (savedTeams) {
      setSelectedTeam(savedTeams);
    }
    const savedParts = localStorage.getItem('fap_user_parts');
    if (savedParts) {
      // 저장된 파트 이름에서 대괄호 제거하여 표시
      const parts = JSON.parse(savedParts);
      const normalizedParts = parts.map((part: string) => normalizeText(part));
      setSelectedParts(normalizedParts);
    }
    const savedUserName = localStorage.getItem('fap_user_name') || '';
    setUserName(savedUserName);
  }, []);

  const handleRoleChange = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleTeamChange = (team: string) => {
    setSelectedTeam(team);
  };

  const handlePartChange = (part: string) => {
    setSelectedParts(prev =>
      prev.includes(part) ? prev.filter(p => p !== part) : [...prev, part]
    );
  };

  const handleSave = () => {
    // 파트 이름에서 대괄호 제거 후 저장
    const normalizedParts = selectedParts.map(part => normalizeText(part));
    localStorage.setItem('fap_user_roles', JSON.stringify(selectedRoles));
    localStorage.setItem('fap_user_teams', selectedTeam);
    localStorage.setItem('fap_user_parts', JSON.stringify(normalizedParts));
    localStorage.setItem('fap_user_name', userName);
    alert('설정이 저장되었습니다!');
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
              <span style={{ fontWeight: 600, fontSize: '1.15rem', marginRight: 16 }}>사용자 이름 :</span>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="예: 시스템 관리자"
                style={{ fontSize: '1.1rem', padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, minWidth: 220 }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontWeight: 600, fontSize: '1.15rem', marginRight: 16 }}>Role :</span>
              {ROLES.map(role => (
                <label key={role} style={{ marginRight: 18, fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => handleRoleChange(role)}
                    style={{ marginRight: 6 }}
                  />
                  {role}
                </label>
              ))}
            </div>
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontWeight: 600, fontSize: '1.15rem', marginRight: 16 }}>Team :</span>
              {TEAMS.map(team => (
                <label key={team} style={{ marginRight: 18, fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="team-group"
                    checked={selectedTeam === team}
                    onChange={() => handleTeamChange(team)}
                    style={{ marginRight: 6 }}
                  />
                  {team}
                </label>
              ))}
            </div>
            {TEAM_PARTS[selectedTeam] && (
              <div style={{ marginBottom: 18 }}>
                <span style={{ fontWeight: 600, fontSize: '1.15rem', marginRight: 16 }}>Part :</span>
                {TEAM_PARTS[selectedTeam].map(part => (
                  <label key={part} style={{ marginRight: 18, fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={selectedParts.includes(part)}
                      onChange={() => handlePartChange(part)}
                      style={{ marginRight: 6 }}
                    />
                    {part}
                  </label>
                ))}
              </div>
            )}
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
            <button style={btnStyle} onClick={handleSave}>save</button>
            <button style={btnStyle} onClick={handleExit}>exit</button>
          </div>
        </div>
      </div>
    </Layout>
  );
} 