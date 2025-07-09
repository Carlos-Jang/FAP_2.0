import Layout from './Layout'
import React, { useState, useEffect } from 'react'

interface Issue {
  id: number;
  subject: string;
  author?: { name: string };
  start_date?: string;
  due_date?: string;
}

export default function AEMakeReportPage() {
  const [activeTab, setActiveTab] = useState<'view' | 'make'>('make');
  const [issueNum, setIssueNum] = useState('');
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [projectDetail, setProjectDetail] = useState<any>(null);
  // 실제로는 localStorage에서 가져오지만, 테스트를 위해 하드코딩
  const userName = localStorage.getItem('fap_user_name') || '시스템 관리자';
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedIssueId) {
      const selected = issues.find(i => i.id === selectedIssueId);
      const projectId = (selected as any)?.project?.id;
      if (projectId) {
        fetch(`/api/projects/${projectId}/detail`)
          .then(res => res.json())
          .then(data => setProjectDetail(data))
          .catch(() => setProjectDetail(null));
      } else {
        setProjectDetail(null);
      }
    } else {
      setProjectDetail(null);
    }
  }, [selectedIssueId]);

  const handleFindReport = async () => {
    if (issueNum.trim() === '') return;
    try {
      const res = await fetch(`/api/projects/redmine-issue/${issueNum.trim()}`);
      const data = await res.json();
      if (data && data.issue) {
        setIssues([data.issue]);
      } else {
        setIssues([]);
      }
    } catch (e) {
      setIssues([]);
    }
  };

  if (isMobile) {
    return (
      <Layout>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: '#222', fontWeight: 600 }}>
          PC에서 접속하여 사용해주세요
        </div>
      </Layout>
    );
  }

  // 우측 상세 정보 임시 데이터
  const detail = {
    model: 'WIND',
    site: '천안 캠퍼스',
    operator: 'AE 하윤호',
    deviceId: 'AQS09',
    location: 'C1 4F',
    warranty: '유상',
    summary: 'VisionWorks2_2.07.105_Rev20250701 Update',
    problem: "IR Die Acc'y 계측 후 간헐적으로 일부 Chip Index EES Data 누락 발생",
    cause: 'Gauge Data 점검 시 해당 Index Theta 특이값 반영 시 문제 발생 확인',
    action: 'Theta 특이값 반영 시에도 EES 정상 출력되도록 수정',
    result: 'EES 정상 출력 확인',
    note: '',
  };

  return (
    <Layout>
      <div style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: 32 }}>
        {/* 좌측 패널 */}
        <div style={{ width: 420, minWidth: 340, background: '#f7f9fc', borderRadius: 8, boxShadow: 'var(--color-shadow)', padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 이슈 번호 입력 및 찾기 */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <input
              type="text"
              value={issueNum}
              onChange={e => setIssueNum(e.target.value)}
              placeholder="Issue Num."
              style={{ flex: 1, fontSize: '1.1rem', padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, marginRight: 8 }}
            />
            <button onClick={handleFindReport} style={{ fontWeight: 600, fontSize: '1rem', padding: '7px 18px', borderRadius: 6, background: '#28313b', color: '#fff', border: 'none', cursor: 'pointer' }}>Find Report</button>
          </div>
          {/* 탭 버튼 */}
          <div style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
            <button
              onClick={() => setActiveTab('view')}
              style={{
                flex: 1,
                fontWeight: 600,
                fontSize: '1rem',
                padding: '7px 18px',
                borderRadius: 6,
                background: '#28313b',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'none',
                outline: 'none',
                marginRight: 0
              }}
            >
              View Report
            </button>
            <button
              onClick={() => setActiveTab('make')}
              style={{
                flex: 1,
                fontWeight: 600,
                fontSize: '1rem',
                padding: '7px 18px',
                borderRadius: 6,
                background: '#28313b',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'none',
                outline: 'none',
                marginLeft: 0
              }}
            >
              Make Report
            </button>
          </div>
          {/* 이슈 리스트 */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 6, border: '1px solid #e0e3ea', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
              <thead>
                <tr style={{ background: '#e5e8ef' }}>
                  <th style={{ width: 60, padding: '12px 8px', fontWeight: 700, borderBottom: '1px solid #e0e3ea', color: '#222' }}>ID</th>
                  <th style={{ padding: '12px 8px', fontWeight: 700, borderBottom: '1px solid #e0e3ea', color: '#222' }}>Subject</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(issue => (
                  <tr key={issue.id}>
                    <td style={{ color: '#222', fontWeight: 500, fontSize: '0.98rem', padding: '12px 8px', borderBottom: '1px solid #f0f0f0' }}>{issue.id}</td>
                    <td style={{ color: '#222', fontWeight: 500, fontSize: '0.98rem', padding: '12px 8px', borderBottom: '1px solid #f0f0f0' }}>{issue.subject}</td>
                  </tr>
                ))}
                {issues.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: '#888', padding: 16 }}>
                      일치하는 이슈가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* 우측 상세 패널 */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 8, boxShadow: 'var(--color-shadow)', padding: 32, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
          {activeTab === 'view' ? (
            selectedIssueId
              ? (() => {
                  const selected = issues.find(i => i.id === selectedIssueId);
                  if (!selected) return <div>이슈 정보를 찾을 수 없습니다.</div>;
                  // Model 추출: custom_fields에서 name에 '설비군'이 포함된 value
                  let model = '-';
                  const customFields = (selected as any).custom_fields;
                  if (Array.isArray(customFields)) {
                    const found = customFields.find((f: any) => f.name && f.name.includes('설비군'));
                    if (found && found.value) model = found.value;
                  }
                  // Device ID 추출: #숫자 뒤 괄호 블럭 모두 무시, 그 다음 일반 단어를 Device ID로 사용
                  let deviceId = '-';
                  const project = (selected as any).project;
                  if (project?.name && typeof project.name === 'string') {
                    const afterHash = project.name.split(/#\d+/)[1];
                    if (afterHash) {
                      const blocks = afterHash.trim().split(/\s+/);
                      const realId = blocks.find((block: string) => !block.startsWith('('));
                      if (realId) deviceId = realId;
                    }
                  }
                  // Location, Site 추출: 백엔드에서 location, site 필드로 바로 반환
                  let location = projectDetail?.location || '-';
                  let site = projectDetail?.site || '-';
                  // Operator 추출: author.name
                  const operator = selected.author?.name || '-';
                  // Warranty 추출: custom_fields에서 name에 '비용' 포함된 value
                  let warranty = '-';
                  if (Array.isArray(customFields)) {
                    const found = customFields.find((f: any) => f.name && f.name.includes('비용'));
                    if (found && found.value) warranty = found.value;
                  }
                  // Description 마크다운 파싱
                  const description = (selected as any).description || '';
                  function extractSection(desc: string, start: string, end?: string) {
                    const startIdx = desc.indexOf(start);
                    if (startIdx === -1) return '';
                    const from = desc.slice(startIdx + start.length);
                    let section = from;
                    if (end) {
                      const endIdx = from.indexOf(end);
                      if (endIdx !== -1) section = from.slice(0, endIdx);
                    }
                    // ~~~ 마크다운 코드블럭 제거
                    return section.replace(/~~~/g, '').trim();
                  }
                  const problem = extractSection(description, '### 문제', '### 원인');
                  const cause = extractSection(description, '### 원인', '### 조치');
                  const action = extractSection(description, '### 조치', '### 결과');
                  const result = extractSection(description, '### 결과', '### 특이사항');
                  const note = extractSection(description, '### 특이사항', '### ATI 내부 공유');
                  return (
                    <>
                      {/* 2열(2컬럼) 레이아웃으로 상단 정보 배치 */}
                      <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                          <InfoRow label="Model" value={model} valueColor="#222" />
                          <InfoRow label="Site" value={site} valueColor="#222" />
                          <InfoRow label="Operator" value={operator} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                          <InfoRow label="Device ID" value={deviceId} valueColor="#222" />
                          <InfoRow label="Location" value={location} valueColor="#222" />
                          <InfoRow label="Warranty" value={warranty} />
                        </div>
                      </div>
                      <InfoBlock label="Summary" value={selected.subject || ''} />
                      <InfoBlock label="Problem" value={problem} />
                      <InfoBlock label="Cause" value={cause} />
                      <InfoBlock label="Action" value={action} />
                      <InfoBlock label="Result" value={result} />
                      <InfoBlock label="Note" value={note} />
                    </>
                  );
                })()
              : <div style={{ color: '#888', fontSize: '1.1rem' }}>좌측에서 이슈를 선택해주세요.</div>
          ) : (
            <>
              {/* 기존 detail 정보 출력 */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <InfoRow label="Model" value={detail.model} />
                  <InfoRow label="Site" value={detail.site} />
                  <InfoRow label="Operator" value={detail.operator} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <InfoRow label="Device ID" value={detail.deviceId} />
                  <InfoRow label="Location" value={detail.location} />
                  <InfoRow label="Warranty" value={detail.warranty} />
                </div>
              </div>
              <InfoBlock label="Summary" value={detail.summary} />
              <InfoBlock label="Problem" value={detail.problem} />
              <InfoBlock label="Cause" value={detail.cause} />
              <InfoBlock label="Action" value={detail.action} />
              <InfoBlock label="Result" value={detail.result} />
              <InfoBlock label="Note" value={detail.note} />
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

// 정보 행 컴포넌트
function InfoRow({ label, value, valueColor }: { label: string, value: string, valueColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ background: '#e5eede', color: '#222', fontWeight: 600, padding: '2px 12px', borderRadius: 4, minWidth: 80, textAlign: 'right' }}>{label}</div>
      <div style={{ fontWeight: 500, color: valueColor || '#222' }}>{value}</div>
    </div>
  )
}

// 정보 블록 컴포넌트
function InfoBlock({ label, value }: { label: string, value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
      <div style={{ background: '#e5eede', color: '#222', fontWeight: 600, padding: '4px 18px', borderRadius: 4, minWidth: 110, textAlign: 'right' }}>{label}</div>
      <div style={{ fontWeight: 500, whiteSpace: 'pre-line', color: '#222' }}>{value}</div>
    </div>
  )
} 