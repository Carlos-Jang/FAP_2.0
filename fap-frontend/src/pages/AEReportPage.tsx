// src/pages/AESaveReportPage.tsx
import { Link } from 'react-router-dom'
import Layout from './Layout'
import React, { useEffect, useState } from 'react'
import { isPartMatch } from '../utils/textUtils'

// 프로젝트 타입 정의
interface Project {
  id: number;
  name: string;
  parent?: { id: number };
}

export default function AESaveReportPage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [reportContent, setReportContent] = useState('');
  const [saving, setSaving] = useState(false);

  // measureProjects, setMeasureProjects, loading, error, setLoading, setError 등 measure 관련 상태 및 useEffect, fetch('/api/projects/measure') 호출 부분 전체 삭제

  const handleSaveToRedmine = async () => {
    if (!selectedProject || !reportContent.trim()) {
      alert('설비를 선택하고 레포트 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/issues/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: selectedProject.id,
          subject: `[${selectedProject.name}] AE Report`,
          description: reportContent,
          tracker_id: 1, // 기본 tracker
          priority_id: 2, // 기본 priority
        }),
      });

      if (!response.ok) {
        throw new Error('Redmine에 저장하지 못했습니다.');
      }

      const result = await response.json();
      alert(`레포트가 성공적으로 저장되었습니다! (Issue #${result.id})`);
      setReportContent('');
      setSelectedProject(null);
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div style={{ fontSize: '1.3rem', color: '#222', margin: 32 }}>
        <div style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 16 }}>AE Save Report</div>
        
        {/* measureProjects.length > 0 ? ( */}
          <div style={{ display: 'flex', gap: 32 }}>
            {/* 설비 선택 영역 */}
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: 16 }}>설비 선택</h3>
              <div style={{ 
                background: '#fff', 
                borderRadius: 8, 
                boxShadow: 'var(--color-shadow)', 
                padding: 16,
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {/* measureProjects.map(project => ( */}
                  <div
                    key={1} // Placeholder for project data
                    onClick={() => setSelectedProject({ id: 1, name: 'Measure 설비 1' })}
                    style={{
                      padding: '12px 16px',
                      marginBottom: 8,
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: selectedProject?.id === 1 ? '#e3e6f0' : '#f8f9fa',
                      border: selectedProject?.id === 1 ? '2px solid #132257' : '1px solid #e0e3ea',
                      transition: 'all 0.2s'
                    }}
                  >
                    Measure 설비 1
                  </div>
                {/* ))} */}
              </div>
            </div>

            {/* 레포트 작성 영역 */}
            <div style={{ flex: 2 }}>
              <h3 style={{ marginBottom: 16 }}>레포트 작성</h3>
              {selectedProject ? (
                <div>
                  <div style={{ 
                    background: '#fff', 
                    borderRadius: 8, 
                    boxShadow: 'var(--color-shadow)', 
                    padding: 16,
                    marginBottom: 16
                  }}>
                    <strong>선택된 설비:</strong> {selectedProject.name}
                  </div>
                  
                  <textarea
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    placeholder="레포트 내용을 입력하세요..."
                    style={{
                      width: '100%',
                      minHeight: '300px',
                      padding: 16,
                      border: '1px solid #e0e3ea',
                      borderRadius: 8,
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                  
                  <button
                    onClick={handleSaveToRedmine}
                    disabled={saving || !reportContent.trim()}
                    style={{
                      background: '#132257',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '12px 24px',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving || !reportContent.trim() ? 0.6 : 1,
                      marginTop: 16
                    }}
                  >
                    {saving ? '저장 중...' : 'Redmine에 저장'}
                  </button>
                </div>
              ) : (
                <div style={{ 
                  background: '#fff', 
                  borderRadius: 8, 
                  boxShadow: 'var(--color-shadow)', 
                  padding: 24,
                  textAlign: 'center',
                  color: '#888'
                }}>
                  왼쪽에서 설비를 선택해주세요.
                </div>
              )}
            </div>
          </div>
        {/* ) : !loading && !error ? ( */}
          <div style={{ color: '#888', fontSize: '1.1rem' }}>
            SBU/Measure로 설정된 경우에만 Measure 설비 리스트가 출력됩니다.
          </div>
        {/* ) : null} */}
      </div>
    </Layout>
  )
}
