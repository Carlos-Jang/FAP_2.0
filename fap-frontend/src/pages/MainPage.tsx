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
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 마크다운 설명을 파싱하여 모든 섹션을 추출하는 헬퍼 함수
function parseDescription(description: string): { problem: string; cause: string; action: string; result: string; note: string; atiReport: string } {
  if (!description) {
    return { problem: '', cause: '', action: '', result: '', note: '', atiReport: '' };
  }

  // 문제 추출
  const problemMatch = description.match(/### 문제\s*~~~\s*([\s\S]*?)\s*~~~/);
  const problem = problemMatch ? problemMatch[1].trim() : '';

  // 원인 추출
  const causeMatch = description.match(/### 원인\s*~~~\s*([\s\S]*?)\s*~~~/);
  const cause = causeMatch ? causeMatch[1].trim() : '';

  // 조치 추출
  const actionMatch = description.match(/### 조치\s*~~~\s*([\s\S]*?)\s*~~~/);
  const action = actionMatch ? actionMatch[1].trim() : '';

  // 결과 추출
  const resultMatch = description.match(/### 결과\s*~~~\s*([\s\S]*?)\s*~~~/);
  const result = resultMatch ? resultMatch[1].trim() : '';

  // 특이사항 추출
  const noteMatch = description.match(/### 특이사항\s*~~~\s*([\s\S]*?)\s*~~~/);
  const note = noteMatch ? noteMatch[1].trim() : '';

  // ATI 내부 공유 추출
  const atiReportMatch = description.match(/### ATI 내부 공유\s*~~~\s*([\s\S]*?)\s*~~~/);
  const atiReport = atiReportMatch ? atiReportMatch[1].trim() : '';

  return { problem, cause, action, result, note, atiReport };
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
  created_on: string;
  updated_on: string;
  wiki_page_title: string;
  wiki_page_url: string;
  connected_issue_ids: string;
  connected_issues_detail: any[];
  connected_issues_analysis: any;
  created_at: string;
  updated_at: string;
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

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:8000/api/main/roadmap-dashboard');
        
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
      const response = await axios.get(`http://localhost:8000/api/main/wiki-content?wiki_url=${encodeURIComponent(wikiUrl)}`);
      
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
            const imageResponse = await axios.get(`http://localhost:8000/api/main/attachment-image/${attachment.id}`);
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
                           onClick={() => console.log(`선택된 프로젝트: ${projectName}`)}
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
                                {roadmap.created_on ? new Date(roadmap.created_on).toLocaleDateString() : '-'} ~
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
                   <span>시작일: {selectedRoadmap.created_on ? new Date(selectedRoadmap.created_on).toLocaleDateString() : '-'}</span>
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
              padding: '24px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                color: '#666',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ×
            </button>

            {/* 모달 헤더 */}
            <div style={{ marginBottom: '20px', paddingRight: '40px' }}>
              <a
                href={`https://pms.ati2000.co.kr/issues/${selectedIssue.redmine_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 600, 
                  color: '#2196F3',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1976D2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#2196F3';
                }}
              >
                #{selectedIssue.redmine_id}
              </a>
            </div>

            {/* 일감 정보 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 제목 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>제목</div>
                <div style={{ fontSize: '1.1rem', color: '#222', lineHeight: '1.4' }}>
                  {selectedIssue.subject}
                </div>
              </div>

              {/* 상태 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>상태</div>
                <div style={{ 
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: 'white',
                  background: selectedIssue.is_closed === 1 ? '#28a745' : '#dc3545'
                }}>
                  {selectedIssue.is_closed === 1 ? '완료' : '진행중'}
                </div>
              </div>

              {/* 담당자 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>담당자</div>
                <div style={{ fontSize: '1rem', color: '#222' }}>
                  {selectedIssue.assigned_to_name || '지정되지 않음'}
                </div>
              </div>

              {/* 설명 */}
              {selectedIssue.description && (
                <div>
                  <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>설명</div>
                  <div style={{ 
                    color: '#222', 
                    lineHeight: '1.6',
                    wordBreak: 'break-word',
                    background: '#f8f9fa',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e9ecef',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {selectedIssue.description}
                  </div>
                </div>
              )}

              {/* 생성일 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>생성일</div>
                <div style={{ fontSize: '1rem', color: '#222' }}>
                  {selectedIssue.created_on ? new Date(selectedIssue.created_on).toLocaleDateString('ko-KR') : '정보 없음'}
                </div>
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
              padding: '24px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                color: '#666',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              ×
            </button>

            {/* 모달 헤더 */}
            <div style={{ marginBottom: '20px', paddingRight: '40px' }}>
              <a
                href={`https://pms.ati2000.co.kr/issues/${selectedIssue.redmine_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 600, 
                  color: '#2196F3',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1976D2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#2196F3';
                }}
              >
                #{selectedIssue.redmine_id}
              </a>
            </div>

            {/* 일감 정보 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 제목 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>제목</div>
                <div style={{ fontSize: '1.1rem', color: '#222', lineHeight: '1.4' }}>
                  {selectedIssue.subject}
                </div>
              </div>

              {/* 문제 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>문제</div>
                <div style={{ 
                  color: '#222', 
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  background: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  {parseDescription(selectedIssue.description).problem}
                </div>
              </div>

              {/* 원인 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>원인</div>
                <div style={{ 
                  color: '#222', 
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  background: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  {parseDescription(selectedIssue.description).cause}
                </div>
              </div>

              {/* 조치 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>조치</div>
                <div style={{ 
                  color: '#222', 
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  background: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  {parseDescription(selectedIssue.description).action}
                </div>
              </div>

              {/* 결과 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>결과</div>
                <div style={{ 
                  color: '#222', 
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  background: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  {parseDescription(selectedIssue.description).result}
                </div>
              </div>

              {/* 특이사항 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>특이사항</div>
                <div style={{ 
                  color: '#222', 
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  background: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  {parseDescription(selectedIssue.description).note}
                </div>
              </div>

              {/* ATI 내부 보고 */}
              <div>
                <div style={{ fontWeight: 600, color: '#555', marginBottom: '8px' }}>ATI 내부 보고</div>
                <div style={{ 
                  color: '#222', 
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  background: '#f8f9fa',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  {parseDescription(selectedIssue.description).atiReport}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
