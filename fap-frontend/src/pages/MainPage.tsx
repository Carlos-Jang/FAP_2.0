/**
 * FAP 2.0 - 메인 대시보드 페이지 (프론트엔드)
 * 
 * 주요 기능:
 * - 로드맵 대시보드: 프로젝트별 로드맵 데이터 표시
 * - 위키 페이지 내용: Redmine 위키 페이지 내용 및 첨부파일 표시
 * - 이슈 분석: 연결된 이슈들의 통계 및 상세 정보
 * - 모달 인터페이스: 상세 정보 표시 및 필터링 기능
 * 
 * 기술 스택:
 * - React/TypeScript
 * - Axios (API 통신)
 * - CSS-in-JS (스타일링)
 * - Markdown 파싱
 */

// src/pages/MainPage.tsx
import './MainPage.css'
import Layout from './Layout';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 마크다운 설명을 파싱하여 모든 섹션을 추출하는 헬퍼 함수
function parseDescription(description: string): { 
  hasStructuredContent: boolean;
  problem: string; 
  cause: string; 
  action: string; 
  result: string; 
  note: string; 
  atiReport: string; 
  fullContent: string;
} {
  if (!description) {
    return { 
      hasStructuredContent: false,
      problem: '', 
      cause: '', 
      action: '', 
      result: '', 
      note: '', 
      atiReport: '',
      fullContent: ''
    };
  }

  // 문제 추출 (~~~ 구분자가 있으면 그 안의 내용, 없으면 다음 섹션까지)
  const problemMatchWithTilde = description.match(/### 문제\s*~~~\s*([\s\S]*?)\s*~~~/);
  const problemMatchWithoutTilde = description.match(/### 문제\s*([\s\S]*?)(?=\s*### 원인|$)/);
  const problem = problemMatchWithTilde ? problemMatchWithTilde[1].trim() : 
                  problemMatchWithoutTilde ? problemMatchWithoutTilde[1].trim() : '';

  // 원인 추출 (~~~ 구분자가 있으면 그 안의 내용, 없으면 다음 섹션까지)
  const causeMatchWithTilde = description.match(/### 원인\s*~~~\s*([\s\S]*?)\s*~~~/);
  const causeMatchWithoutTilde = description.match(/### 원인\s*([\s\S]*?)(?=\s*### 조치|$)/);
  const cause = causeMatchWithTilde ? causeMatchWithTilde[1].trim() : 
                causeMatchWithoutTilde ? causeMatchWithoutTilde[1].trim() : '';

  // 조치 추출 (~~~ 구분자가 있으면 그 안의 내용, 없으면 다음 섹션까지)
  const actionMatchWithTilde = description.match(/### 조치\s*~~~\s*([\s\S]*?)\s*~~~/);
  const actionMatchWithoutTilde = description.match(/### 조치\s*([\s\S]*?)(?=\s*### 결과|$)/);
  const action = actionMatchWithTilde ? actionMatchWithTilde[1].trim() : 
                 actionMatchWithoutTilde ? actionMatchWithoutTilde[1].trim() : '';

  // 결과 추출 (~~~ 구분자가 있으면 그 안의 내용, 없으면 다음 섹션까지)
  const resultMatchWithTilde = description.match(/### 결과\s*~~~\s*([\s\S]*?)\s*~~~/);
  const resultMatchWithoutTilde = description.match(/### 결과\s*([\s\S]*?)(?=\s*### 특이사항|$)/);
  const result = resultMatchWithTilde ? resultMatchWithTilde[1].trim() : 
                 resultMatchWithoutTilde ? resultMatchWithoutTilde[1].trim() : '';

  // 특이사항 추출 (~~~ 구분자가 있으면 그 안의 내용, 없으면 다음 섹션까지)
  const noteMatchWithTilde = description.match(/### 특이사항\s*~~~\s*([\s\S]*?)\s*~~~/);
  const noteMatchWithoutTilde = description.match(/### 특이사항\s*([\s\S]*?)(?=\s*### ATI 내부 보고|$)/);
  const note = noteMatchWithTilde ? noteMatchWithTilde[1].trim() : 
               noteMatchWithoutTilde ? noteMatchWithoutTilde[1].trim() : '';

  // ATI 내부 보고 추출 (~~~ 구분자가 있으면 그 안의 내용, 없으면 끝까지)
  const atiReportMatchWithTilde = description.match(/### ATI 내부 보고\s*~~~\s*([\s\S]*?)\s*~~~/);
  const atiReportMatchWithoutTilde = description.match(/### ATI 내부 보고\s*([\s\S]*?)$/);
  const atiReport = atiReportMatchWithTilde ? atiReportMatchWithTilde[1].trim() : 
                    atiReportMatchWithoutTilde ? atiReportMatchWithoutTilde[1].trim() : '';

  // 구조화된 내용이 있는지 확인 (문제, 원인, 조치, 결과 중 하나라도 내용이 있으면 구조화된 것으로 판단)
  const hasStructuredContent = !!(problem || cause || action || result || note || atiReport);

  return { 
    hasStructuredContent,
    problem, 
    cause, 
    action, 
    result, 
    note, 
    atiReport,
    fullContent: description
  };
}

// 간단한 마크다운을 HTML로 변환하는 함수
function parseMarkdown(text: string): string {
  if (!text) return '';
  
  return text
    // 제목 (# 제목)
    .replace(/^# (.*$)/gim, '<h1 style="font-size: 18px; font-weight: bold; margin: 16px 0 8px 0; color: #1F2937;">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size: 16px; font-weight: bold; margin: 14px 0 6px 0; color: #374151;">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 style="font-size: 14px; font-weight: bold; margin: 12px 0 4px 0; color: #4B5563;">$1</h3>')
    
    // 굵은 글씨 (**텍스트**)
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>')
    
    // 기울임 글씨 (*텍스트*)
    .replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>')
    
    // 줄바꿈
    .replace(/\n/g, '<br>');
}

interface RoadmapData {
  id: number;
  redmine_version_id: number;
  project_id: number;
  project_name: string;
  version_name: string;
  status: string;
  description: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  wiki_page_title: string;
  wiki_page_url: string;
  connected_issue_ids: string;
  connected_issues_detail: any[];
  connected_issues_analysis: any;
}

interface DashboardData {
  open_roadmap: { [projectName: string]: RoadmapData[] };
}

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  roadmap: RoadmapData | null;
}

export default function MainPage() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadmapData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wikiContent, setWikiContent] = useState<string>('');
  const [loadingWiki, setLoadingWiki] = useState(false);
  const [selectedTrackerFilter, setSelectedTrackerFilter] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [wikiAttachments, setWikiAttachments] = useState<any[]>([]);
  const [imageDataUrls, setImageDataUrls] = useState<{[key: number]: string}>({});
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

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
            const response = await axios.get(`/fap/api/settings/check-user-api-key/${userLogin}`);
            
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

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/fap/api/main/roadmap-dashboard');
        
        if (response.data.success) {
          setDashboardData(response.data.data);
        } else {
          setError(response.data.message);
        }
      } catch (error) {
        setError('대시보드 데이터 로드 중 오류가 발생했습니다.');
        console.error('Dashboard data fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkApiKey();
    fetchDashboardData();
  }, [navigate]);

  // 위키 내용 가져오기 함수
  const fetchWikiContent = async (wikiUrl: string) => {
    if (!wikiUrl) return;
    
    try {
      setLoadingWiki(true);
      const response = await axios.get(`/fap/api/main/wiki-content?wiki_url=${encodeURIComponent(wikiUrl)}`);
      
      if (response.data.success) {
        setWikiContent(response.data.data.content);
        // 첨부파일 정보 저장
        setWikiAttachments(response.data.data.attachments || []);
        
        // 이미지 첨부파일들 Base64로 로드
        const attachments = response.data.data.attachments || [];
        const imageAttachments = attachments.filter((att: any) => 
          att.content_type && att.content_type.startsWith('image/')
        );
        
        for (const attachment of imageAttachments) {
          try {
            const imageResponse = await axios.get(`/fap/api/main/attachment-image/${attachment.id}`);
            if (imageResponse.data.success) {
              setImageDataUrls(prev => ({
                ...prev,
                [attachment.id]: imageResponse.data.data.data_url
              }));
            }
          } catch (error) {
            console.error(`이미지 로드 실패 (ID: ${attachment.id}):`, error);
          }
        }
      } else {
        setWikiContent('위키 내용을 불러올 수 없습니다.');
        setWikiAttachments([]);
      }
    } catch (error) {
      console.error('Wiki content fetch error:', error);
      setWikiContent('위키 내용을 불러오는 중 오류가 발생했습니다.');
      setWikiAttachments([]);
    } finally {
      setLoadingWiki(false);
    }
  };

  // 모달 열기 함수
  const handleOpenModal = (roadmap: RoadmapData) => {
    // Setup이 포함된 경우 셋업 모달 열기 (대소문자 구분 없이)
    const versionName = roadmap.version_name.toLowerCase();
    if (versionName.includes('setup') || versionName.includes('set up')) {
      setSelectedRoadmap(roadmap);
      setIsSetupModalOpen(true);
      return;
    }
    
    // 일반 로드맵 모달 열기
    setSelectedRoadmap(roadmap);
    setIsModalOpen(true);
    setWikiContent(''); // 위키 내용 초기화
    
    // 위키 URL이 있으면 내용 가져오기
    if (roadmap.wiki_page_url) {
      fetchWikiContent(roadmap.wiki_page_url);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>로드맵 대시보드 로딩 중...</h2>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>오류 발생</h2>
          <p style={{ color: 'red' }}>{error}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
                 <div style={{
             padding: '30px',
             background: 'linear-gradient(135deg, #000000 0%, #e2e8f0 100%)',
             minHeight: '100vh',
             borderRadius: '16px',
             boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
             margin: '0 auto'
           }}>

          
          {dashboardData && (
            <>
              {/* 프로젝트 버튼 */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '20px', 
                marginBottom: '30px'
              }}>
                {Object.entries(dashboardData.open_roadmap).map(([projectName, roadmaps], index) => {
                  const color = '#4A5568'; // 차분한 회색으로 변경
                  
                  return (
                    <div key={projectName} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '200px 1fr',
                      gap: '20px',
                      alignItems: 'start'
                    }}>
                      {/* 프로젝트 카드 */}
                                               <div
                           style={{
                             padding: '20px',
                             background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                             color: 'white',
                             border: 'none',
                             borderRadius: '16px',
                             fontSize: '14px',
                             fontWeight: 'bold',
                             textAlign: 'center',
                             minHeight: '80px',
                             display: 'flex',
                             flexDirection: 'column',
                             justifyContent: 'center',
                             cursor: 'pointer',
                             boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                             transition: 'all 0.3s ease',
                             transform: 'translateY(0)',
                             position: 'relative',
                             overflow: 'hidden'
                           }}
                           onMouseEnter={(e) => {
                             e.currentTarget.style.transform = 'translateY(-5px)';
                             e.currentTarget.style.boxShadow = '0 12px 35px rgba(0,0,0,0.2)';
                           }}
                           onMouseLeave={(e) => {
                             e.currentTarget.style.transform = 'translateY(0)';
                             e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                           }}
                           onClick={() => {}}
                         >
                           {/* 배경 장식 요소들 - 직선적 디자인 */}
                           <div style={{
                             position: 'absolute',
                             top: '0',
                             right: '0',
                             width: '0',
                             height: '0',
                             borderStyle: 'solid',
                             borderWidth: '0 40px 40px 0',
                             borderColor: `transparent rgba(255,255,255,0.15) transparent transparent`,
                             zIndex: 1
                           }}></div>

                           <div style={{
                             position: 'absolute',
                             top: '15px',
                             right: '15px',
                             width: '25px',
                             height: '2px',
                             background: 'rgba(255,255,255,0.2)',
                             zIndex: 1
                           }}></div>
                           <div style={{
                             position: 'absolute',
                             top: '20px',
                             right: '15px',
                             width: '15px',
                             height: '2px',
                             background: 'rgba(255,255,255,0.15)',
                             zIndex: 1
                           }}></div>

                           
                           <div style={{ fontSize: '18px', fontWeight: 'bold', position: 'relative', zIndex: 2 }}>
                             {projectName}
                           </div>
                         </div>

                                              {/* 해당 프로젝트의 로드맵 버전 카드들 */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '15px'
                        }}>
                          {roadmaps.map((roadmap) => (
                            <div
                              key={roadmap.id}
                              style={{
                                padding: '20px',
                                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                                color: '#334155',
                                border: 'none',
                                borderRadius: '16px',
                                fontSize: '12px',
                                fontWeight: '500',
                                textAlign: 'center',
                                minHeight: '80px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                                position: 'relative',
                                transform: 'translateY(0)',
                                overflow: 'hidden'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                                e.currentTarget.style.transform = 'translateY(-8px)';
                                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';

                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';

                              }}
                              onClick={() => handleOpenModal(roadmap)}
                            >
                              {/* 배경 장식 요소들 - 프로젝트 카드와 통일된 디자인 */}
                              <div style={{
                                position: 'absolute',
                                top: '0',
                                right: '0',
                                width: '0',
                                height: '0',
                                borderStyle: 'solid',
                                borderWidth: '0 30px 30px 0',
                                borderColor: `transparent rgba(59, 130, 246, 0.15) transparent transparent`,
                                zIndex: 1
                              }}></div>
                              <div style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                width: '20px',
                                height: '2px',
                                background: 'rgba(59, 130, 246, 0.2)',
                                zIndex: 1
                              }}></div>
                              <div style={{
                                position: 'absolute',
                                top: '16px',
                                right: '12px',
                                width: '12px',
                                height: '2px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                zIndex: 1
                              }}></div>
                              
                              <div style={{ 
                                position: 'absolute',
                                top: '12px',
                                left: '16px',
                                fontSize: '11px', 
                                color: '#64748B',
                                fontWeight: '500',
                                zIndex: 2
                              }}>
                                {roadmap.created_at ? new Date(roadmap.created_at).toLocaleDateString() : '-'} ~
                              </div>
                              <div style={{ 
                                fontSize: '16px', 
                                color: '#334155', 
                                fontWeight: 'bold', 
                                marginTop: '8px',
                                position: 'relative',
                                zIndex: 2
                              }}>
                                {roadmap.version_name}
                              </div>
                            </div>
                          ))}
                        </div>
                    </div>
                  );
                })}
              </div>

              
                         </>
           )}
       </div>
       
       {/* 로드맵 모달 */}
       {isModalOpen && selectedRoadmap && (
         <div 
           style={{
             position: 'fixed',
             top: 0,
             left: 0,
             right: 0,
             bottom: 0,
             backgroundColor: 'rgba(0, 0, 0, 0.5)',
             display: 'flex',
             justifyContent: 'center',
             alignItems: 'center',
             zIndex: 1000
           }}
           onClick={() => setIsModalOpen(false)}
         >
                        <div 
               style={{
                 backgroundColor: 'white',
                 borderRadius: '16px',
                 padding: '32px',
                 width: '95vw',
                 height: '90vh',
                 overflow: 'hidden',
                 boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                 border: '1px solid #E2E8F0'
               }}
               onClick={(e) => e.stopPropagation()}
             >
             <div style={{
               display: 'flex',
               justifyContent: 'space-between',
               alignItems: 'flex-start',
               marginBottom: '24px',
               borderBottom: '2px solid #F1F5F9',
               paddingBottom: '16px'
             }}>
               <div>
                 <h2 style={{ 
                   margin: 0, 
                   color: '#1E293B', 
                   fontSize: '24px',
                   fontWeight: 'bold',
                   marginBottom: '4px'
                 }}>
                   {selectedRoadmap.version_name}
                 </h2>
                 <div style={{ 
                   fontSize: '14px', 
                   color: '#64748B',
                   fontWeight: '500',
                   display: 'flex',
                   alignItems: 'center',
                   gap: '12px'
                 }}>
                   <span>{selectedRoadmap.project_name}</span>
                   <span style={{ color: '#94A3B8' }}>•</span>
                   <span>시작일: {selectedRoadmap.created_at ? new Date(selectedRoadmap.created_at).toLocaleDateString() : '-'}</span>
                 </div>
               </div>
               <button
                 onClick={() => setIsModalOpen(false)}
                 style={{
                   background: 'none',
                   border: 'none',
                   fontSize: '28px',
                   cursor: 'pointer',
                   color: '#94A3B8',
                   padding: '8px',
                   borderRadius: '50%',
                   width: '40px',
                   height: '40px',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   transition: 'all 0.2s ease'
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.backgroundColor = '#F1F5F9';
                   e.currentTarget.style.color = '#64748B';
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.backgroundColor = 'transparent';
                   e.currentTarget.style.color = '#94A3B8';
                 }}
               >
                 ×
               </button>
             </div>
             
             <div style={{ color: '#64748B' }}>
               {/* 4개 구획으로 나누어진 레이아웃 */}
               <div style={{ 
                 display: 'grid', 
                 gridTemplateColumns: '2fr 1fr', 
                 gridTemplateRows: 'auto 1fr',
                 gap: '24px',
                 height: 'calc(90vh - 120px)'
               }}>

                 {/* 1번: 왼쪽 열 - 위키 페이지 내용 */}
                 <div style={{ 
                   background: '#F8FAFC',
                   borderRadius: '12px',
                   padding: '20px',
                   border: '1px solid #E2E8F0',
                   display: 'flex',
                   flexDirection: 'column',
                   gridRow: '1 / 3'
                 }}>
                   <button
                     onClick={() => {
                       if (selectedRoadmap?.wiki_page_url) {
                         window.open(selectedRoadmap.wiki_page_url, '_blank');
                       }
                     }}
                     style={{
                       color: '#2D3748',
                       fontSize: '16px',
                       fontWeight: '600',
                       marginBottom: '16px',
                       background: 'none',
                       border: 'none',
                       cursor: 'pointer',
                       padding: '0',
                       textAlign: 'left',
                       display: 'flex',
                       alignItems: 'center',
                       gap: '8px',
                       transition: 'color 0.2s ease'
                     }}
                     onMouseEnter={(e) => {
                       e.currentTarget.style.color = '#1E40AF';
                     }}
                     onMouseLeave={(e) => {
                       e.currentTarget.style.color = '#2D3748';
                     }}
                   >
                     상세 설명
                     {loadingWiki && (
                       <span style={{ 
                         fontSize: '12px', 
                         color: '#64748B', 
                         fontWeight: 'normal'
                       }}>
                         로딩 중...
                       </span>
                     )}
                   </button>
                   <div style={{ 
                     flex: 1,
                     overflow: 'auto',
                     background: 'white',
                     borderRadius: '8px',
                     padding: '16px',
                     border: '1px solid #E2E8F0'
                   }}>
                     {loadingWiki ? (
                       <div style={{ 
                         display: 'flex', 
                         justifyContent: 'center', 
                         alignItems: 'center',
                         height: '100px',
                         color: '#64748B'
                       }}>
                         위키 내용을 불러오는 중...
                       </div>
                     ) : wikiContent ? (
                       <div>
                         <div 
                           style={{ 
                             fontSize: '13px', 
                             lineHeight: '0.5',
                             color: '#334155',
                             whiteSpace: 'pre-wrap',
                             marginBottom: '20px'
                           }}
                           dangerouslySetInnerHTML={{ 
                             __html: parseMarkdown(wikiContent).replace(
                               /!\[([^\]]*)\]\(([^)]+)\)/g, 
                               (match, alt, filename) => {
                                 // 첨부파일에서 해당 파일명을 찾기
                                 const attachment = wikiAttachments.find(att => att.filename === filename);
                                 if (attachment && attachment.content_type && attachment.content_type.startsWith('image/')) {
                                   const imageUrl = imageDataUrls[attachment.id];
                                   if (imageUrl) {
                                     return `<img src="${imageUrl}" alt="${alt || filename}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />`;
                                   }
                                 }
                                 return match; // 이미지를 찾지 못하면 원본 텍스트 유지
                               }
                             )
                           }}
                         />
                         
                                                  {/* 첨부파일 텍스트 표시 */}
                         {wikiAttachments.length > 0 && (
                           <div style={{ 
                             marginTop: '16px',
                             padding: '12px',
                             background: '#F9FAFB',
                             borderRadius: '6px',
                             border: '1px solid #E5E7EB'
                           }}>
                             <div style={{ 
                               fontSize: '12px', 
                               color: '#6B7280',
                               marginBottom: '8px',
                               fontWeight: '500'
                             }}>
                               첨부파일 ({wikiAttachments.length}개)
                             </div>
                             <div style={{ 
                               fontSize: '11px',
                               color: '#374151',
                               lineHeight: '1.4'
                             }}>
                               {wikiAttachments.map((attachment, index) => (
                                 <div 
                                   key={index} 
                                   style={{ 
                                     marginBottom: '4px',
                                     cursor: 'pointer',
                                     padding: '2px 4px',
                                     borderRadius: '3px',
                                     transition: 'background-color 0.2s ease'
                                   }}
                                   onMouseEnter={(e) => {
                                     e.currentTarget.style.backgroundColor = '#E5E7EB';
                                   }}
                                   onMouseLeave={(e) => {
                                     e.currentTarget.style.backgroundColor = 'transparent';
                                   }}
                                   onClick={() => {
                                     // 새 탭에서 다운로드 URL 열기
                                     window.open(attachment.download_url, '_blank');
                                   }}
                                 >
                                   {attachment.filename}
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}
                       </div>
                     ) : (
                       <div style={{ 
                         color: '#64748B',
                         textAlign: 'center',
                         padding: '20px'
                       }}>
                         위키 내용을 불러올 수 없습니다.
                       </div>
                     )}
                   </div>
                 </div>

                 {/* 2번: 오른쪽 상단 - 이슈 유형별 분석 */}
                 <div style={{ 
                   background: '#F8FAFC',
                   borderRadius: '12px',
                   padding: '20px',
                   border: '1px solid #E2E8F0',
                   display: 'flex',
                   flexDirection: 'column'
                                    }}>
                   <h3 style={{ color: '#2D3748', marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
                     {(() => {
                       const totalIssues = selectedRoadmap.connected_issues_detail ? selectedRoadmap.connected_issues_detail.length : 0;
                       const completedIssues = selectedRoadmap.connected_issues_detail ? selectedRoadmap.connected_issues_detail.filter((issue: any) => issue.is_closed === 1).length : 0;
                       const inProgressIssues = selectedRoadmap.connected_issues_detail ? selectedRoadmap.connected_issues_detail.filter((issue: any) => issue.is_closed === 0).length : 0;
                       const completionRate = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
                       
                                               const getCompletionColor = (rate: number) => {
                          if (rate >= 80) return '#10B981'; // 초록색
                          if (rate >= 50) return '#F59E0B'; // 노란색
                          return '#EF4444'; // 빨간색
                        };
                        
                        return (
                          <>
                            <span style={{ color: '#1E293B' }}>총 {totalIssues}개</span>
                            <span dangerouslySetInnerHTML={{ __html: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' }} />
                            <span style={{ color: '#EF4444' }}>진행중 {inProgressIssues}개</span>
                            <span dangerouslySetInnerHTML={{ __html: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' }} />
                            <span style={{ color: '#10B981' }}>완료 {completedIssues}개</span>
                            <span dangerouslySetInnerHTML={{ __html: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' }} />
                            <span style={{ color: getCompletionColor(completionRate) }}>완료율 {completionRate}%</span>
                          </>
                        );
                     })()}
                   </h3>
                   <div style={{ 
                     flex: 1,
                     overflow: 'auto',
                     background: 'white',
                     borderRadius: '8px',
                     padding: '16px',
                     border: '1px solid #E2E8F0'
                   }}>
                     {selectedRoadmap.connected_issues_analysis && Object.keys(selectedRoadmap.connected_issues_analysis).length > 0 ? (
                       <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>

                         <div style={{ 
                           display: 'flex', 
                           gap: '8px'
                         }}>
                           {selectedRoadmap.connected_issues_analysis.type_list && selectedRoadmap.connected_issues_analysis.type_list.map((typeData: any, index: number) => {
                             const completionRate = typeData.total_count > 0 ? Math.round((typeData.completed_count / typeData.total_count) * 100) : 0;
                             const getCardBackgroundColor = (rate: number) => {
                               if (rate >= 80) return '#F0FDF4'; // 연한 초록색
                               if (rate >= 50) return '#FFFBEB'; // 연한 노란색
                               return '#FEF2F2'; // 연한 빨간색
                             };
                             
                             return (
                               <div 
                                 key={index} 
                                 style={{ 
                                   flex: '1',
                                   minWidth: '120px',
                                   padding: '12px',
                                   background: getCardBackgroundColor(completionRate),
                                   borderRadius: '8px',
                                   border: '1px solid #E2E8F0',
                                   textAlign: 'center',
                                   cursor: 'pointer',
                                   transition: 'all 0.2s ease',
                                   transform: selectedTrackerFilter === typeData.tracker_name ? 'scale(1.02)' : 'scale(1)',
                                   boxShadow: selectedTrackerFilter === typeData.tracker_name ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                                 }}
                                 onClick={() => setSelectedTrackerFilter(selectedTrackerFilter === typeData.tracker_name ? null : typeData.tracker_name)}
                               >
                                                               <div style={{ 
                                  fontWeight: '600', 
                                  color: '#1E293B',
                                  marginBottom: '8px',
                                  fontSize: '14px'
                                }}>
                                  {typeData.tracker_name.replace(/^\[AE\]\[이슈\]\s*/, '').replace(/^\[AE\]\s*/, '')}
                                </div>
                               <div style={{ 
                                 display: 'flex', 
                                 flexDirection: 'column',
                                 gap: '4px',
                                 fontSize: '12px'
                               }}>
                                 <span style={{ color: '#10B981' }}>완료 {typeData.completed_count}</span>
                                 <span style={{ color: '#EF4444' }}>진행중 {typeData.in_progress_count}</span>
                               </div>
                             </div>
                           );
                         })}
                         </div>
                       </div>
                     ) : (
                       <div style={{ 
                         color: '#64748B',
                         textAlign: 'center',
                         padding: '20px'
                       }}>
                         연결된 일감: {selectedRoadmap.connected_issues_detail ? selectedRoadmap.connected_issues_detail.length : 0}개
                       </div>
                     )}
                   </div>
                 </div>

                 {/* 3번: 오른쪽 하단 - 연결된 이슈 리스트 */}
                 <div style={{ 
                   background: '#F8FAFC',
                   borderRadius: '12px',
                   padding: '20px',
                   border: '1px solid #E2E8F0',
                   display: 'flex',
                   flexDirection: 'column'
                 }}>

                   <div style={{ 
                     height: 'calc(100vh - 500px)',
                     overflow: 'auto',
                     background: 'white',
                     borderRadius: '8px',
                     padding: '16px',
                     border: '1px solid #E2E8F0',
                     scrollbarWidth: 'thin',
                     scrollbarColor: '#CBD5E0 #F7FAFC'
                   }}>
                                          {selectedRoadmap.connected_issues_detail && selectedRoadmap.connected_issues_detail.length > 0 ? (
                       <div style={{
                         display: 'flex',
                         flexDirection: 'column',
                         gap: '6px'
                       }}>
                         {selectedRoadmap.connected_issues_detail
                           .filter((issue: any) => !selectedTrackerFilter || issue.tracker_name === selectedTrackerFilter)
                           .map((issue: any, index: number) => (
                             <div 
                               key={index}
                               style={{
                                 padding: '8px 10px',
                                 background: '#f8f9fa',
                                 borderRadius: '4px',
                                 border: '1px solid #e9ecef',
                                 fontSize: '0.85rem',
                                 color: '#333',
                                 lineHeight: '1.4',
                                 display: 'flex',
                                 alignItems: 'center',
                                 gap: '8px',
                                 cursor: 'pointer',
                                 transition: 'all 0.2s ease'
                               }}
                               onMouseEnter={(e) => {
                                 e.currentTarget.style.background = '#e9ecef';
                                 e.currentTarget.style.transform = 'translateY(-1px)';
                                 e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                               }}
                               onMouseLeave={(e) => {
                                 e.currentTarget.style.background = '#f8f9fa';
                                 e.currentTarget.style.transform = 'translateY(0)';
                                 e.currentTarget.style.boxShadow = 'none';
                               }}
                             >
                               <span 
                                 style={{ 
                                   fontSize: '0.85rem', 
                                   color: '#ffffff', 
                                   fontWeight: 700,
                                   background: issue.is_closed === 1 ? '#28a745' : '#dc3545', 
                                   padding: '6px 10px',
                                   borderRadius: 6,
                                   minWidth: 'fit-content',
                                   cursor: 'pointer',
                                   transition: 'all 0.2s ease',
                                   boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                 }}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   window.open(`https://pms.ati2000.co.kr/issues/${issue.redmine_id}`, '_blank');
                                 }}
                                 onMouseEnter={(e) => {
                                   e.currentTarget.style.transform = 'scale(1.05)';
                                   e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                                 }}
                                 onMouseLeave={(e) => {
                                   e.currentTarget.style.transform = 'scale(1)';
                                   e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                                 }}
                               >
                                 #{issue.redmine_id}
                               </span>
                               <span 
                                 style={{
                                   flex: 1,
                                   cursor: 'pointer'
                                 }}
                                 onClick={() => {
                                   setSelectedIssue(issue);
                                   setIsIssueModalOpen(true);
                                 }}
                               >
                                 {issue.subject}
                               </span>
                             </div>
                           ))}
                       </div>
                     ) : (
                       <div style={{ 
                         color: '#64748B',
                         textAlign: 'center',
                         padding: '20px'
                       }}>
                         연결된 이슈가 없습니다.
                       </div>
                     )}
                   </div>
                 </div>



               </div>
             </div>
           </div>
         </div>
               )}

      {/* 셋업 모달 */}
      {isSetupModalOpen && selectedRoadmap && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setIsSetupModalOpen(false)}
        >
                     <div 
             style={{
               backgroundColor: 'white',
               borderRadius: '16px',
               width: '90vw',
               height: '85vh',
               overflow: 'hidden',
               boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
               border: '1px solid #E2E8F0',
               display: 'flex',
               flexDirection: 'column'
             }}
             onClick={(e) => e.stopPropagation()}
           >
                           {/* 헤더 레이어 */}
              <div style={{
                padding: '20px 32px 16px 32px',
                borderBottom: '2px solid #F1F5F9',
                background: 'white'
              }}>
               <div style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 alignItems: 'flex-start'
               }}>
                 <div>
                   <div style={{
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center',
                     marginBottom: '8px'
                   }}>
                     <h2 style={{ 
                       margin: 0, 
                       color: '#1E293B', 
                       fontSize: '28px',
                       fontWeight: 'bold'
                     }}>
                       {selectedRoadmap.version_name}
                     </h2>
                                           <div style={{
                        fontSize: '16px',
                        color: '#64748B',
                        fontWeight: '500',
                        display: 'flex',
                        gap: '8px',
                        marginLeft: '50px',
                        marginTop: '25px'
                      }}>
                       <span>{selectedRoadmap.project_name}</span>
                       <span style={{ color: '#94A3B8' }}>•</span>
                       <span>시작일: {selectedRoadmap.created_at ? new Date(selectedRoadmap.created_at).toLocaleDateString() : '-'}</span>
                     </div>
                   </div>
                 </div>
                 <button
                   onClick={() => setIsSetupModalOpen(false)}
                   style={{
                     background: 'none',
                     border: 'none',
                     fontSize: '28px',
                     cursor: 'pointer',
                     color: '#94A3B8',
                     padding: '8px',
                     borderRadius: '50%',
                     width: '40px',
                     height: '40px',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     transition: 'all 0.2s ease'
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.backgroundColor = '#F1F5F9';
                     e.currentTarget.style.color = '#64748B';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.backgroundColor = 'transparent';
                     e.currentTarget.style.color = '#94A3B8';
                   }}
                 >
                   ×
                 </button>
               </div>
             </div>

                           {/* 바디 레이어 */}
              <div style={{
                flex: 1,
                padding: '24px 32px 32px 32px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                background: '#28313b',
                scrollbarWidth: 'thin',
                scrollbarColor: '#64748B #28313b'
              }}>
               {/* 간트차트 영역 */}
               <div style={{ 
                 padding: '20px',
                 background: '#F8FAFC',
                 borderRadius: '12px',
                 border: '1px solid #E2E8F0'
               }}>
                 {(() => {
                   // Setup 관련 일감들 수집
                   const setupIssues: any[] = [];
                   selectedRoadmap.connected_issues_analysis?.type_list?.forEach((typeItem: any) => {
                     if (typeItem.tracker_name.toLowerCase().includes('setup')) {
                       typeItem.setup_status_details?.forEach((statusItem: any) => {
                         statusItem.issue_details?.forEach((issue: any) => {
                           setupIssues.push({
                             ...issue,
                             status_name: statusItem.status_name
                           });
                         });
                       });
                     }
                   });

                   if (setupIssues.length === 0) {
                     return (
                       <div style={{
                         textAlign: 'center',
                         padding: '40px 20px',
                         color: '#64748B',
                         background: 'white',
                         borderRadius: '8px',
                         border: '1px solid #E2E8F0'
                       }}>
                         <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
                         <div>간트차트를 표시할 일감이 없습니다</div>
                       </div>
                     );
                   }

                   // 등록된 일감들의 날짜 범위 계산
                   const dates = setupIssues
                     .map(issue => new Date(issue.created_at))
                     .filter(date => !isNaN(date.getTime()));
                   
                   if (dates.length === 0) {
                     return (
                       <div style={{
                         textAlign: 'center',
                         padding: '40px 20px',
                         color: '#64748B',
                         background: 'white',
                         borderRadius: '8px',
                         border: '1px solid #E2E8F0'
                       }}>
                         <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
                         <div>간트차트를 표시할 일감이 없습니다</div>
                       </div>
                     );
                   }
                   
                   const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                   const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                   
                   // 최소 날짜부터 1달 후까지 (단, 일감이 작성된 최대 날짜가 1달을 넘으면 그 날짜까지)
                   const startDate = new Date(minDate);
                   const oneMonthLater = new Date(minDate);
                   oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
                   
                   const endDate = maxDate > oneMonthLater ? maxDate : oneMonthLater;
                   
                   const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                   const days = totalDays;

                   // 5개 Setup 단계
                   const setupStages = [
                     '[AE][Setup] 반입&레벨링',
                     '[AE][Setup] 기초 Setup',
                     '[AE][Setup] TTTM',
                     '[AE][Setup] 자동화',
                     '[AE][Setup] Setup 완료'
                   ];

                   return (
                     <div style={{
                       background: 'white',
                       borderRadius: '8px',
                       border: '1px solid #E2E8F0',
                       overflow: 'auto',
                       maxHeight: '400px'
                     }}>
                       {/* 간트차트 헤더 - 동적 날짜 표시 */}
                       <div style={{
                         display: 'grid',
                         gridTemplateColumns: `150px repeat(${days}, 1fr)`,
                         borderBottom: '2px solid #E2E8F0',
                         background: '#F8FAFC'
                       }}>
                         <div style={{
                           padding: '12px',
                           fontWeight: '600',
                           color: '#1E293B',
                           borderRight: '1px solid #E2E8F0'
                         }}>
                           
                         </div>
                         
                         {/* 동적 날짜 헤더 */}
                         {Array.from({ length: days }, (_, dayIndex) => {
                           const currentDate = new Date(startDate);
                           currentDate.setDate(currentDate.getDate() + dayIndex);
                           return (
                             <div key={`day-${dayIndex}`} style={{
                               padding: '4px 2px',
                               textAlign: 'center',
                               fontSize: '11px',
                               color: '#64748B',
                               borderRight: '1px solid #E2E8F0',
                               minWidth: '20px'
                             }}>
                               {currentDate.getDate()}
                             </div>
                           );
                         })}
                       </div>

                       {/* 간트차트 바디 */}
                       {setupStages.map((stage, stageIndex) => {
                         const stageIssues = setupIssues.filter(issue => issue.status_name === stage);
                         
                         return (
                           <div key={stage} style={{
                             display: 'grid',
                             gridTemplateColumns: `150px repeat(${days}, 1fr)`,
                             borderBottom: '1px solid #E2E8F0',
                             minHeight: '30px'
                           }}>
                             {/* 단계명 */}
                             <div style={{
                               padding: '6px',
                               fontWeight: '500',
                               color: '#1E293B',
                               borderRight: '1px solid #E2E8F0',
                               background: '#F8FAFC',
                               display: 'flex',
                               alignItems: 'center',
                               fontSize: '14px'
                             }}>
                               {stage.replace('[AE][Setup] ', '')}
                             </div>
                             
                             {/* 일감 바 차트 - 동적 날짜 */}
                             {Array.from({ length: days }, (_, dayIndex) => {
                               const currentDate = new Date(startDate);
                               currentDate.setDate(currentDate.getDate() + dayIndex);
                               const dayIssues = stageIssues.filter(issue => {
                                 const issueDate = new Date(issue.created_at);
                                 return issueDate.getDate() === currentDate.getDate() && 
                                        issueDate.getMonth() === currentDate.getMonth() &&
                                        issueDate.getFullYear() === currentDate.getFullYear();
                               });

                               return (
                                 <div key={`day-${dayIndex}`} style={{
                                   padding: '4px 2px',
                                   borderRight: '1px solid #E2E8F0',
                                   position: 'relative',
                                   display: 'flex',
                                   alignItems: 'center',
                                   justifyContent: 'center',
                                   minWidth: '20px',
                                   backgroundColor: dayIssues.length > 0 ? '#10B981' : 'transparent'
                                 }}>
                                 </div>
                               );
                             })}
                           </div>
                         );
                       })}
                     </div>
                   );
                 })()}
               </div>

                               {/* Status별 일감 카드 출력 */}
                <div style={{ 
                  padding: '20px',
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  flex: 1,
                  overflow: 'auto',
                  minHeight: '600px'
                }}>
                 {selectedRoadmap.connected_issues_analysis?.type_list?.map((typeItem: any) => {
                   // Setup 관련 타입만 필터링
                   if (typeItem.tracker_name.toLowerCase().includes('setup')) {
                     // 고정된 5가지 status 순서
                     const statusOrder = [
                       '[AE][Setup] 반입&레벨링',
                       '[AE][Setup] 기초 Setup',
                       '[AE][Setup] TTTM',
                       '[AE][Setup] 자동화',
                       '[AE][Setup] Setup 완료'
                     ];
                     
                     return (
                       <div key={typeItem.tracker_name}>
                         {/* Status별 카드 그리드 - 고정된 순서로 표시 */}
                         <div style={{
                           display: 'grid',
                           gridTemplateColumns: 'repeat(5, 1fr)',
                           gap: '16px',
                           height: 'fit-content'
                         }}>
                           {statusOrder.map((statusName) => {
                             // 해당 status의 데이터 찾기
                             const statusItem = typeItem.setup_status_details?.find((item: any) => item.status_name === statusName);
                             const issueDetails = statusItem?.issue_details || [];
                             const totalCount = statusItem?.total_count || 0;
                             
                             return (
                               <div key={statusName} style={{
                                 background: 'white',
                                 borderRadius: '12px',
                                 padding: '20px',
                                 border: '1px solid #E2E8F0',
                                 boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                 transition: 'all 0.2s ease',
                                 height: '520px',
                                 display: 'flex',
                                 flexDirection: 'column'
                               }}>
                                 {/* Status 헤더 */}
                                 <div style={{
                                   display: 'flex',
                                   justifyContent: 'space-between',
                                   alignItems: 'center',
                                   marginBottom: '16px',
                                   paddingBottom: '12px',
                                   borderBottom: '2px solid #F1F5F9'
                                 }}>
                                   <h4 style={{
                                     fontSize: '16px',
                                     fontWeight: '600',
                                     color: '#1E293B',
                                     margin: 0
                                   }}>
                                     {statusName}
                                   </h4>
                                   <span style={{
                                     background: totalCount > 0 ? '#3B82F6' : '#94A3B8',
                                     color: 'white',
                                     padding: '4px 12px',
                                     borderRadius: '20px',
                                     fontSize: '14px',
                                     fontWeight: '500'
                                   }}>
                                     {totalCount}건
                                   </span>
                                 </div>
                                 
                                 {/* 일감 카드 리스트 */}
                                 <div style={{ 
                                   flex: 1,
                                   overflow: 'auto',
                                   marginTop: '16px'
                                 }}>
                                   {issueDetails.length > 0 ? (
                                     issueDetails.map((issue: any, index: number) => (
                                       <div key={index} style={{
                                         background: '#F8FAFC',
                                         borderRadius: '8px',
                                         padding: '16px',
                                         marginBottom: '12px',
                                         border: '1px solid #E2E8F0',
                                         transition: 'all 0.2s ease',
                                         cursor: 'pointer'
                                       }}
                                       onMouseEnter={(e) => {
                                         e.currentTarget.style.transform = 'translateY(-2px)';
                                         e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.1)';
                                       }}
                                       onMouseLeave={(e) => {
                                         e.currentTarget.style.transform = 'translateY(0)';
                                         e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                                       }}
                                       onClick={() => {
                                         setSelectedIssue(issue);
                                         setIsIssueModalOpen(true);
                                       }}>
                                         {/* 일감 정보 */}
                                         <div style={{
                                           display: 'flex',
                                           justifyContent: 'space-between',
                                           alignItems: 'center',
                                           fontSize: '13px',
                                           color: '#64748B',
                                           marginBottom: '8px'
                                         }}>
                                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                             <span style={{
                                               color: '#3B82F6',
                                               fontWeight: 'bold',
                                               fontSize: '14px'
                                             }}>#{issue.redmine_id}</span>
                                           </div>
                                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                             <span>👤 {issue.author_name}</span>
                                             <span>📅 {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : '-'}</span>
                                           </div>
                                         </div>
                                         
                                         {/* 일감 제목 */}
                                         <div style={{
                                           fontSize: '15px',
                                           fontWeight: '600',
                                           color: '#1E293B',
                                           lineHeight: '1.4'
                                         }}>
                                           {issue.subject}
                                         </div>
                                       </div>
                                     ))
                                   ) : (
                                     <div style={{
                                       textAlign: 'center',
                                       padding: '40px 20px',
                                       color: '#94A3B8',
                                       fontSize: '14px'
                                     }}>
                                       <div style={{ fontSize: '24px', marginBottom: '8px' }}>📝</div>
                                       <div>일감이 없습니다</div>
                                     </div>
                                   )}
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     );
                   }
                   return null;
                 })}
                 
                 {/* Setup 데이터가 없는 경우 */}
                 {(!selectedRoadmap.connected_issues_analysis?.type_list?.some((typeItem: any) => 
                   typeItem.tracker_name.toLowerCase().includes('setup')
                 )) && (
                   <div style={{
                     textAlign: 'center',
                     padding: '40px 20px',
                     color: '#64748B'
                   }}>
                     <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                     <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                       Setup 데이터가 없습니다
                     </div>
                     <div style={{ fontSize: '14px' }}>
                       이 프로젝트에는 Setup 관련 일감이 없습니다.
                     </div>
                   </div>
                 )}
               </div>
             </div>
           </div>
        </div>
      )}

      {/* 이슈 상세 모달 */}
      {isIssueModalOpen && selectedIssue && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}
          onClick={() => {
            setIsIssueModalOpen(false);
            setSelectedIssue(null);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '80vw',
              maxHeight: '80vh',
              position: 'relative',
              boxShadow: 'var(--shadow-dark)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상부 레이어 - 헤더 */}
            <div style={{
              background: 'var(--color-surface)',
              borderRadius: '12px 12px 0 0',
              padding: '20px 24px',
              color: 'var(--color-text)',
              position: 'relative',
              borderBottom: '1px solid var(--color-border)'
            }}>
              {/* 닫기 버튼 */}
              <button
                onClick={() => {
                  setIsIssueModalOpen(false);
                  setSelectedIssue(null);
                }}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--color-text)',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                ×
              </button>

              {/* 헤더 내용 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px', 
                flexWrap: 'wrap',
                paddingRight: '40px'
              }}>
                {/* 일감 번호와 메타 정보 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px', 
                  flexWrap: 'wrap'
                }}>
                  <a
                    href={`https://pms.ati2000.co.kr/issues/${selectedIssue.redmine_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ 
                      fontSize: '1.4rem', 
                      fontWeight: 700, 
                      color: '#007bff',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#007bff';
                    }}
                  >
                    #{selectedIssue.redmine_id}
                  </a>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    flexWrap: 'wrap',
                    fontSize: '1.1rem',
                    color: 'var(--color-text)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-accent)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)'
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>📅</span>
                      <span>{selectedIssue.created_at && new Date(selectedIssue.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-accent)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)'
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>🏢</span>
                      <span>{selectedIssue.project_name}</span>
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-accent)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)'
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>👤</span>
                      <span>{selectedIssue.author_name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 하부 레이어 */}
            <div style={{
              background: '#28313b',
              borderRadius: '0 0 12px 12px',
              padding: '24px',
              overflowY: 'auto',
              flex: 1
            }}>
              {/* 하부 레이어 - 내용 */}
              <div style={{
                background: '#ffffff',
                borderRadius: '8px',
                padding: '20px',
                height: '100%'
              }}>
                {/* 일감 정보 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 제목 */}
                  <div style={{ 
                    fontSize: '1.3rem', 
                    fontWeight: 700, 
                    color: '#000000', 
                    lineHeight: '1.4',
                    padding: '16px 0'
                  }}>
                    {selectedIssue.subject}
                  </div>

                  {(() => {
                    const parsedDescription = parseDescription(selectedIssue.description);
                    
                    if (parsedDescription.hasStructuredContent) {
                      // 구조화된 내용이 있는 경우 - 표 형태로 표시
                      return (
                        <div style={{ 
                          border: '1px solid #333333', 
                          borderRadius: '8px', 
                          overflow: 'hidden',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              {/* 문제 */}
                              <tr style={{ borderBottom: '1px solid #333333' }}>
                                <td style={{ 
                                  width: '120px', 
                                  padding: '16px', 
                                  backgroundColor: '#E6F3FF', 
                                  fontWeight: 700, 
                                  fontSize: '1.1rem',
                                  color: '#000000',
                                  borderRight: '1px solid #333333',
                                  verticalAlign: 'top',
                                  textAlign: 'center'
                                }}>
                                  문제
                                </td>
                                <td style={{ 
                                  padding: '16px', 
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  color: '#000000'
                                }}>
                                  {parsedDescription.problem}
                                </td>
                              </tr>

                              {/* 원인 */}
                              <tr style={{ borderBottom: '1px solid #333333' }}>
                                <td style={{ 
                                  width: '120px', 
                                  padding: '16px', 
                                  backgroundColor: '#E6F3FF', 
                                  fontWeight: 700, 
                                  fontSize: '1.1rem',
                                  color: '#000000',
                                  borderRight: '1px solid #333333',
                                  verticalAlign: 'top',
                                  textAlign: 'center'
                                }}>
                                  원인
                                </td>
                                <td style={{ 
                                  padding: '16px', 
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  color: '#000000'
                                }}>
                                  {parsedDescription.cause}
                                </td>
                              </tr>

                              {/* 조치 */}
                              <tr style={{ borderBottom: '1px solid #333333' }}>
                                <td style={{ 
                                  width: '120px', 
                                  padding: '16px', 
                                  backgroundColor: '#E6F3FF', 
                                  fontWeight: 700, 
                                  fontSize: '1.1rem',
                                  color: '#000000',
                                  borderRight: '1px solid #333333',
                                  verticalAlign: 'top',
                                  textAlign: 'center'
                                }}>
                                  조치
                                </td>
                                <td style={{ 
                                  padding: '16px', 
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  color: '#000000'
                                }}>
                                  {parsedDescription.action}
                                </td>
                              </tr>

                              {/* 결과 */}
                              <tr style={{ borderBottom: '1px solid #333333' }}>
                                <td style={{ 
                                  width: '120px', 
                                  padding: '16px', 
                                  backgroundColor: '#E6F3FF', 
                                  fontWeight: 700, 
                                  fontSize: '1.1rem',
                                  color: '#000000',
                                  borderRight: '1px solid #333333',
                                  verticalAlign: 'top',
                                  textAlign: 'center'
                                }}>
                                  결과
                                </td>
                                <td style={{ 
                                  padding: '16px', 
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  color: '#000000'
                                }}>
                                  {parsedDescription.result}
                                </td>
                              </tr>

                              {/* 특이사항 */}
                              <tr style={{ borderBottom: '1px solid #333333' }}>
                                <td style={{ 
                                  width: '120px', 
                                  padding: '16px', 
                                  backgroundColor: '#E6F3FF', 
                                  fontWeight: 700, 
                                  fontSize: '1.1rem',
                                  color: '#000000',
                                  borderRight: '1px solid #333333',
                                  verticalAlign: 'top',
                                  textAlign: 'center'
                                }}>
                                  특이사항
                                </td>
                                <td style={{ 
                                  padding: '16px', 
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  color: '#000000'
                                }}>
                                  {parsedDescription.note}
                                </td>
                              </tr>

                              {/* ATI 내부 보고 */}
                              <tr>
                                <td style={{ 
                                  width: '120px', 
                                  padding: '16px', 
                                  backgroundColor: '#E6F3FF', 
                                  fontWeight: 700, 
                                  fontSize: '1.1rem',
                                  color: '#000000',
                                  borderRight: '1px solid #333333',
                                  verticalAlign: 'top',
                                  textAlign: 'center'
                                }}>
                                  ATI 내부 보고
                                </td>
                                <td style={{ 
                                  padding: '16px', 
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  color: '#000000'
                                }}>
                                  {parsedDescription.atiReport}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    } else {
                      // 구조화된 내용이 없는 경우 - 전체 내용을 하나의 섹션으로 표시
                      return (
                        <div style={{ 
                          border: '1px solid #333333', 
                          borderRadius: '8px', 
                          overflow: 'hidden',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr>
                                <td style={{ 
                                  width: '120px', 
                                  padding: '16px', 
                                  backgroundColor: '#E6F3FF', 
                                  fontWeight: 700, 
                                  fontSize: '1.1rem',
                                  color: '#000000',
                                  borderRight: '1px solid #333333',
                                  verticalAlign: 'top',
                                  textAlign: 'center'
                                }}>
                                  작업 내용
                                </td>
                                <td style={{ 
                                  padding: '16px', 
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  color: '#000000'
                                }}>
                                  {parsedDescription.fullContent}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
