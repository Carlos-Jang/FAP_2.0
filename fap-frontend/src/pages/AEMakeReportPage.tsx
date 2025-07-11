import Layout from './Layout'
import React, { useState, useEffect } from 'react'

interface Issue {
  id: number;
  subject: string;
  author?: { name: string };
  start_date?: string;
  due_date?: string;
}

function extractModel(issue: any) {
  if (!issue) return '-';
  const field = issue.custom_fields?.find((f: any) =>
    f.name.toLowerCase().includes('설비군') || f.name.toLowerCase().includes('product')
  );
  return field?.value || '-';
}

function extractDeviceId(issue: any) {
  if (!issue) return '-';
  const name = issue.project?.name || '';
  const match = name.match(/#\d+\s*(?:\([^)]*\)\s*)?(\w+)/);
  return match ? match[1] : '-';
}

function extractWarranty(issue: any) {
  if (!issue) return '-';
  // custom_fields에서 '비용'이 포함된 필드 찾기
  const field = issue.custom_fields?.find((f: any) =>
    f.name.includes('비용')
  );
  return field?.value || '-';
}

// description에서 마크다운 헤더별로 내용을 추출하는 함수
function extractSectionFromDescription(description: string, section: string): string {
  if (!description) return '-';
  // section: '문제', '원인', '조치', '결과', '특이사항', 'ATI 내부 공유' 등
  const regex = new RegExp(`### ${section}([\s\S]*?)(?=###|$)`, 'i');
  const match = description.match(regex);
  if (!match) return '-';
  let content = match[1].trim();
  // ~~~ 마크다운 코드블록 제거
  content = content.replace(/~~~[\s\S]*?~~~/g, '').trim();
  // 앞뒤 공백 및 불필요한 개행 제거
  content = content.replace(/^\s+|\s+$/g, '');
  return content || '-';
}

// '### 문제'와 '### 원인' 사이의 내용을 추출하는 함수
function extractProblemFromDescription(description: string): string {
  if (!description) return '-';
  const regex = /### 문제([\s\S]*?)(?=### 원인|$)/i;
  const match = description.match(regex);
  if (!match) return '-';
  let content = match[1].trim();
  // ~~~ 마크다운 구분자만 삭제 (내용은 남김)
  content = content.replace(/~~~/g, '').trim();
  // 앞뒤 공백 및 불필요한 개행 제거
  content = content.replace(/^\s+|\s+$/g, '');
  return content || '-';
}

// '### 원인' ~ '### 조치'
function extractCauseFromDescription(description: string): string {
  if (!description) return '-';
  const regex = /### 원인([\s\S]*?)(?=### 조치|$)/i;
  const match = description.match(regex);
  if (!match) return '-';
  let content = match[1].trim();
  content = content.replace(/~~~/g, '').trim();
  content = content.replace(/^\s+|\s+$/g, '');
  return content || '-';
}
// '### 조치' ~ '### 결과'
function extractActionFromDescription(description: string): string {
  if (!description) return '-';
  const regex = /### 조치([\s\S]*?)(?=### 결과|$)/i;
  const match = description.match(regex);
  if (!match) return '-';
  let content = match[1].trim();
  content = content.replace(/~~~/g, '').trim();
  content = content.replace(/^\s+|\s+$/g, '');
  return content || '-';
}
// '### 결과' ~ '### 특이사항'
function extractResultFromDescription(description: string): string {
  if (!description) return '-';
  const regex = /### 결과([\s\S]*?)(?=### 특이사항|$)/i;
  const match = description.match(regex);
  if (!match) return '-';
  let content = match[1].trim();
  content = content.replace(/~~~/g, '').trim();
  content = content.replace(/^\s+|\s+$/g, '');
  return content || '-';
}
// '### 특이사항' ~ 다음 헤더 또는 끝
function extractNoteFromDescription(description: string): string {
  if (!description) return '-';
  const regex = /### 특이사항([\s\S]*?)(?=### ATI 내부 공유|$)/i;
  const match = description.match(regex);
  if (!match) return '-';
  let content = match[1].trim();
  content = content.replace(/~~~/g, '').trim();
  content = content.replace(/^\s+|\s+$/g, '');
  return content || '-';
}

export default function AEMakeReportPage() {
  const [activeTab, setActiveTab] = useState<'view' | 'make'>('make');
  const [issueNum, setIssueNum] = useState('');
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [issueDetail, setIssueDetail] = useState<any>(null);
  const userName = localStorage.getItem('fap_user_name') || '시스템 관리자';
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState('-');
  const [location, setLocation] = useState('-');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <Layout>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: '#222', fontWeight: 600 }}>
          PC에서 접속하여 사용해주세요
        </div>
      </Layout>
    );
  }

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

  // Find Report 버튼 클릭 시 전체 이슈 정보 받아오기
  const handleFindReport = async () => {
    setLoading(true);
    if (issueNum.trim()) {
      // 이슈 번호가 있으면 find-report 호출
      const payload = { issue_id: Number(issueNum.trim()) };
      try {
        const res = await fetch('/api/projects/find-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data && data.issues) {
          setIssues(data.issues);
          setSelectedIssueId(null);
          setIssueDetail(null);
        } else {
          setIssues([]);
          setSelectedIssueId(null);
          setIssueDetail(null);
        }
      } catch {
        setIssues([]);
        setSelectedIssueId(null);
        setIssueDetail(null);
      }
    } else {
      // 이슈 번호가 없으면 find-five-report 호출
      const payload = { author_name: userName };
      try {
        const res = await fetch('/api/projects/find-five-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data && data.issues) {
          setIssues(data.issues);
          setSelectedIssueId(null);
          setIssueDetail(null);
        } else {
          setIssues([]);
          setSelectedIssueId(null);
          setIssueDetail(null);
        }
      } catch {
        setIssues([]);
        setSelectedIssueId(null);
        setIssueDetail(null);
      }
    }
    setLoading(false);
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
            <button
              onClick={handleFindReport}
              disabled={loading}
              style={{ fontWeight: 600, fontSize: '1rem', padding: '7px 18px', borderRadius: 6, background: '#28313b', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
            >{loading ? '로딩중...' : 'Find Report'}</button>
          </div>
          {/* 탭 버튼 */}
          <div style={{ display: 'flex', marginBottom: 8, gap: 8 }}>
            <button
              onClick={async () => {
                setActiveTab('view');
                const selected = issues.find(i => i.id === selectedIssueId);
                if (selected) {
                  setIssueDetail(selected);
                  // Site, Location 정보 비동기 요청
                  if (selected.project && selected.project.id) {
                    setSite('-');
                    setLocation('-');
                    try {
                      const res = await fetch('/api/projects/get-site', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ project_id: selected.project.id })
                      });
                      const data = await res.json();
                      setSite(data.site || '-');
                      setLocation(data.location || '-');
                    } catch {
                      setSite('-');
                      setLocation('-');
                    }
                  } else {
                    setSite('-');
                    setLocation('-');
                  }
                } else {
                  setIssueDetail(null);
                  setSite('-');
                  setLocation('-');
                }
              }}
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
                  <tr
                    key={issue.id}
                    onClick={() => setSelectedIssueId(issue.id)}
                    style={{
                      background: selectedIssueId === issue.id ? '#e3e6f0' : undefined,
                      cursor: 'pointer'
                    }}
                  >
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
        <div
          style={{
            flex: 1,
            background: '#fff',
            borderRadius: 8,
            boxShadow: 'var(--color-shadow)',
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            height: '100%',
            overflowX: 'auto' // 또는 'hidden'
          }}
        >
          {activeTab === 'view' ? (
            selectedIssueId
              ? (
                  <>
                    {/* 2열(2컬럼) 레이아웃으로 상단 정보 배치 */}
                    <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <InfoRow label="Model" value={extractModel(issueDetail)} valueColor="#222" />
                        <InfoRow label="Site" value={site} valueColor="#222" />
                        <InfoRow label="Operator" value={issueDetail?.author?.name || '-'} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <InfoRow label="Device ID" value={extractDeviceId(issueDetail)} valueColor="#222" />
                        <InfoRow label="Location" value={location} valueColor="#222" />
                        <InfoRow label="Warranty" value={extractWarranty(issueDetail)} />
                      </div>
                    </div>
                    <InfoBlock label="Summary" value={issueDetail?.subject || '-'} />
                    <InfoBlock label="Problem" value={extractProblemFromDescription(issueDetail?.description)} />
                    <InfoBlock label="Cause" value={extractCauseFromDescription(issueDetail?.description)} />
                    <InfoBlock label="Action" value={extractActionFromDescription(issueDetail?.description)} />
                    <InfoBlock label="Result" value={extractResultFromDescription(issueDetail?.description)} />
                    <InfoBlock label="Note" value={extractNoteFromDescription(issueDetail?.description)} />
                  </>
              ) : <div style={{ color: '#888', fontSize: '1.1rem' }}>좌측에서 이슈를 선택해주세요.</div>
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