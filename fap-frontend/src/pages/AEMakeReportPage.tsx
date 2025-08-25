import Layout from './Layout'
import { useState, useEffect } from 'react'

// 날짜 관련 헬퍼 함수들 (IssuesPage와 동일)
function getToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getWeekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// 날짜 +1일 헬퍼 함수 (종료일을 다음날로 조정하여 오늘 수정한 일감도 포함되도록 함)
function adjustEndDate(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

// CSS 변수 정의 (기존 IssuesPage와 동일)
const darkThemeVars = {
  '--dark-bg': '#ffffff',
  '--dark-card-bg': '#f8f9fa',
  '--accent-color': '#007bff',
  '--accent-glow': 'rgba(0, 123, 255, 0.3)',
  '--accent-bg': 'rgba(0, 123, 255, 0.1)',
  '--accent-border': 'rgba(0, 123, 255, 0.3)',
  '--accent-border-light': 'rgba(0, 123, 255, 0.2)',
  '--border-dark': '#dee2e6',
  '--border-darker': '#ced4da',
  '--border-hover': '#adb5bd',
  '--text-white': '#000000',
  '--shadow-dark': '0 8px 32px rgba(0,0,0,0.1)',
  '--shadow-card': '0 2px 8px rgba(0,0,0,0.1)',
  '--shadow-hover': '0 4px 16px rgba(0,0,0,0.15)',
  '--shadow-glow': '0 0 20px rgba(0, 123, 255, 0.3)',
  '--transition-smooth': 'all 0.3s ease',
  '--border-radius-panel': '12px',
  '--border-radius-card': '8px',
  '--padding-panel': '24px',
  '--padding-card': '12px 16px',
  
  // 호버 효과 변수들
  '--hover-transform': 'translateY(-2px)',
  '--hover-scale': 'scale(1.05)',
  '--hover-scale-large': 'scale(1.1)',
  
  // 텍스트 효과
  '--text-shadow': '0 1px 2px rgba(0,0,0,0.3)',
  '--text-shadow-large': '0 2px 4px rgba(0,0,0,0.3)',
  
  // 선택 상태 효과
  '--selected-bg': 'rgba(0, 123, 255, 0.15)',
  '--selected-border': '2px solid var(--accent-color)',
  '--selected-shadow': 'var(--shadow-glow)',
  
  // 버튼 효과
  '--button-hover-bg': 'var(--border-hover)',
  '--button-hover-border': 'var(--border-hover)',
  '--button-hover-shadow': 'var(--shadow-hover)',
  
  // 카드 효과
  '--card-hover-transform': 'translateY(-2px)',
  '--card-hover-shadow': 'var(--shadow-hover)',
  '--success-color': '#28a745',
  '--danger-color': '#dc3545',
  
  // 완료율 기준 색상
  '--completion-0': '#ffebee', /* 0% - 연한 빨간색 */
  '--completion-low': '#fff3e0', /* 1-30% - 연한 주황색 */
  '--completion-medium': '#fff8e1', /* 31-60% - 연한 노란색 */
  '--completion-high': '#e8f5e8', /* 61-99% - 연한 초록색 */
  '--completion-100': '#c8e6c9' /* 100% - 진한 초록색 */
};

// 고객사 프로젝트 타입 정의
interface CustomerProject {
  project_name: string;
}

// Product List 타입 정의
interface ProductItem {
  name: string;
}

// Issue 타입 정의
interface Issue {
  redmine_id: number;
  subject: string;
  author_name: string;
  status_name: string;
  created_at: string;
  updated_at: string;
  description: string;
  is_closed: number;
  tracker_name: string;
  product: string;
}

export default function AEMakeReportPage() {
  // 상태 관리 (기존 IssuesPage와 동일)
  const [customerProjects, setCustomerProjects] = useState<CustomerProject[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [selectedSiteIndexes, setSelectedSiteIndexes] = useState<number[]>([]);
  const [subProjects, setSubProjects] = useState<CustomerProject[]>([]);
  const [selectedSubSites, setSelectedSubSites] = useState<string[]>([]);
  const [productList, setProductList] = useState<ProductItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>(getWeekAgo());
  const [dateTo, setDateTo] = useState<string>(getToday());
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // 사용자 Product 설정 관련 상태
  const [userProductSettings, setUserProductSettings] = useState<string[]>([]);
  const [filteredProductList, setFilteredProductList] = useState<ProductItem[]>([]);

  // 일감 조회 관련 상태
  const [issueNumber, setIssueNumber] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [loadingIssue, setLoadingIssue] = useState<boolean>(false);
  const [calendarIssues, setCalendarIssues] = useState<Issue[]>([]);
  
  // 담당자 일감 검색 상태
  const [workerName, setWorkerName] = useState<string>('');
  const [loadingWorkerIssues, setLoadingWorkerIssues] = useState<boolean>(false);
  const [workerIssues, setWorkerIssues] = useState<Issue[]>([]);

  // 초기 로드 - 고객사 프로젝트 목록 가져오기 및 사용자 설정 로드
  useEffect(() => {
    fetchCustomerProjects();
    loadUserProductSettings();
  }, []);

  // Product List 또는 사용자 설정이 변경될 때 필터링 적용
  useEffect(() => {
    filterProductList(productList);
  }, [productList, userProductSettings]);

  // 고객사 프로젝트 목록 조회
  const fetchCustomerProjects = async () => {
    try {
      const response = await fetch('/fap/api/issues/site');
      if (response.ok) {
        const data = await response.json();
        setCustomerProjects(data.projects || []);
      }
    } catch (error) {
      console.error('고객사 프로젝트 조회 오류:', error);
    }
  };

  // 사용자 Product 설정 불러오기
  const loadUserProductSettings = async () => {
    try {
      const userId = localStorage.getItem('fap_user_id');
      if (!userId) return;

      const response = await fetch(`/fap/api/settings/get-user-products?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.selected_products) {
          setUserProductSettings(data.data.selected_products);
          console.log('사용자 Product 설정 로드:', data.data.selected_products);
        }
      }
    } catch (error) {
      console.error('사용자 Product 설정 로드 오류:', error);
    }
  };

  // Product List 필터링 함수
  const filterProductList = (originalProductList: ProductItem[]) => {
    if (userProductSettings.length === 0) {
      // 설정된 Product가 없으면 전체 표시
      setFilteredProductList(originalProductList);
    } else {
      // 설정된 Product가 있으면 ALL + 선택된 Product만 표시
      const filtered = originalProductList.filter(product => 
        product.name === 'ALL' || userProductSettings.includes(product.name)
      );
      setFilteredProductList(filtered);
    }
  };

  // 일감 번호로 일감 조회 핸들러
  const handleFindIssue = async () => {
    if (!issueNumber.trim()) {
      alert('일감 번호를 입력해주세요.');
      return;
    }

    try {
      setLoadingIssue(true);
      
      const response = await fetch('/fap/api/ae-make-report/get-issue-by-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issue_id: issueNumber.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('API 응답:', data);  // 디버깅용
        if (data.success) {
          setSelectedIssue(data.data);
          addIssueToCalendar(data.data);
          console.log('일감 조회 성공:', data.data);
        } else {
          console.error('백엔드 오류:', data.message);  // 디버깅용
          alert('일감 조회 실패: ' + data.message);
        }
      } else {
        console.error('HTTP 오류:', response.status, response.statusText);  // 디버깅용
        const errorText = await response.text();
        console.error('오류 상세:', errorText);  // 디버깅용
        alert('일감 조회 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('일감 조회 오류:', error);
      alert('일감 조회 중 오류가 발생했습니다.');
    } finally {
      setLoadingIssue(false);
    }
  };

  // 담당자별 일감 조회 핸들러
  const handleFindIssuesByWorker = async () => {
    // 담당자 이름이 비어있으면 User Name 사용
    const currentUserName = localStorage.getItem('fap_user_name') || '';
    const searchWorkerName = workerName.trim() || currentUserName;
    
    if (!searchWorkerName) {
      alert('담당자 이름을 입력해주세요.');
      return;
    }

    try {
      setLoadingWorkerIssues(true);
      
      const response = await fetch('/fap/api/ae-make-report/get-issues-by-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          worker_name: searchWorkerName
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWorkerIssues(data.data || []);
          console.log('담당자별 일감 조회 성공:', data.data);
        } else {
          console.error('담당자별 일감 조회 실패:', data.message);
          alert('담당자별 일감 조회 실패: ' + data.message);
        }
      } else {
        console.error('HTTP 오류:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('오류 상세:', errorText);
        alert('담당자별 일감 조회 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('담당자별 일감 조회 오류:', error);
      alert('담당자별 일감 조회 중 오류가 발생했습니다.');
    } finally {
      setLoadingWorkerIssues(false);
    }
  };

  // 일감을 달력에 추가하는 함수
  const addIssueToCalendar = (issue: Issue) => {
    console.log('addIssueToCalendar 호출됨:', issue); // 디버깅 로그
    console.log('일감 생성일:', issue.created_at); // 디버깅 로그
    
    // 이미 같은 일감이 있는지 확인
    const existingIssue = calendarIssues.find(existing => existing.redmine_id === issue.redmine_id);
    if (existingIssue) {
      alert('이미 달력에 추가된 일감입니다.');
      return;
    }
    
    // 새로운 일감을 포함한 모든 일감들의 날짜 범위 계산
    const allIssues = [...calendarIssues, issue];
    const allDates = allIssues.map(issue => new Date(issue.created_at));
    
    // 가장 이른 날짜와 가장 늦은 날짜 찾기
    const earliestDate = new Date(Math.min(...allDates.map(date => date.getTime())));
    const latestDate = new Date(Math.max(...allDates.map(date => date.getTime())));
    
    // 가장 이른 날짜의 월요일 계산
    const earliestDayOfWeek = earliestDate.getDay();
    const mondayOffset = earliestDayOfWeek === 0 ? 6 : earliestDayOfWeek - 1;
    const startMonday = new Date(earliestDate);
    startMonday.setDate(earliestDate.getDate() - mondayOffset);
    
    // 가장 늦은 날짜의 일요일 계산
    const latestDayOfWeek = latestDate.getDay();
    const sundayOffset = latestDayOfWeek === 0 ? 0 : 7 - latestDayOfWeek;
    const endSunday = new Date(latestDate);
    endSunday.setDate(latestDate.getDate() + sundayOffset);
    
    // 달력 날짜 범위 업데이트 (최소 7일, 최대 4주)
    const totalDays = Math.ceil((endSunday.getTime() - startMonday.getTime()) / (1000 * 60 * 60 * 24));
    const weeksToShow = Math.max(1, Math.min(4, Math.ceil(totalDays / 7)));
    
    const newDateFrom = startMonday.toISOString().split('T')[0];
    const newDateTo = new Date(startMonday.getTime() + (weeksToShow * 7 - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log('달력 범위 확장:', {
      earliestDate: earliestDate.toISOString(),
      latestDate: latestDate.toISOString(),
      newDateFrom,
      newDateTo,
      totalDays,
      weeksToShow
    });
    
    // 달력 날짜 범위 업데이트
    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
    
    setCalendarIssues(prev => {
      const newIssues = [...prev, issue];
      console.log('calendarIssues 업데이트:', newIssues); // 디버깅 로그
      return newIssues;
    });
    setIssueNumber(''); // 입력창 비우기
  };

  // 달력에서 일감 제거하는 함수
  const removeIssueFromCalendar = (issueId: number) => {
    setCalendarIssues(prev => prev.filter(issue => issue.redmine_id !== issueId));
  };

  // SITE 버튼 클릭 핸들러 (다중 선택 지원)
  const handleSiteClick = async (siteName: string, siteIndex: number, event: React.MouseEvent) => {
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    
    if (isCtrlPressed) {
      // Ctrl 키가 눌린 경우: 다중 선택
      setSelectedSites(prev => {
        if (prev.includes(siteName)) {
          return prev.filter(name => name !== siteName);
        } else {
          return [...prev, siteName];
        }
      });
      setSelectedSiteIndexes(prev => {
        if (prev.includes(siteIndex)) {
          return prev.filter(index => index !== siteIndex);
        } else {
          return [...prev, siteIndex];
        }
      });
        } else {
      // Ctrl 키가 안 눌린 경우: 단일 선택
      setSelectedSites([siteName]);
      setSelectedSiteIndexes([siteIndex]);
    }
    
    setSelectedSubSites([]);
    setProductList([]);
    setSelectedProducts([]);
          setIssues([]);
    
    // 현재 선택된 Site들 확인
    let currentSelectedSites: string[] = [];
    let currentSelectedSiteIndexes: number[] = [];
    
    if (isCtrlPressed) {
      // Ctrl 키가 눌린 경우: 현재 상태에서 변경된 상태 계산
      const wasSelected = selectedSites.includes(siteName);
      if (wasSelected) {
        currentSelectedSites = selectedSites.filter(name => name !== siteName);
        currentSelectedSiteIndexes = selectedSiteIndexes.filter(index => index !== siteIndex);
      } else {
        currentSelectedSites = [...selectedSites, siteName];
        currentSelectedSiteIndexes = [...selectedSiteIndexes, siteIndex];
      }
    } else {
      // Ctrl 키가 안 눌린 경우: 단일 선택
      currentSelectedSites = [siteName];
      currentSelectedSiteIndexes = [siteIndex];
    }
    
    // 선택된 Site가 없으면 Sub Site 초기화
    if (currentSelectedSites.length === 0) {
      setSubProjects([]);
    } else if (currentSelectedSiteIndexes.length === 1) {
      // 단일 선택인 경우 기존 API 사용
      try {
        const response = await fetch(`/fap/api/issues/sub-site?site_index=${currentSelectedSiteIndexes[0]}`);
        if (response.ok) {
          const data = await response.json();
          if (data.projects) {
            setSubProjects(data.projects);
          }
        }
      } catch (error) {
        console.error(`Sub Site 조회 오류 (site_index: ${currentSelectedSiteIndexes[0]}):`, error);
      }
    }
  };

  // Sub Site 버튼 클릭 핸들러 (다중 선택 지원)
  const handleSubSiteClick = async (subSiteName: string, event: React.MouseEvent) => {
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    
    if (isCtrlPressed) {
      // Ctrl 키가 눌린 경우: 다중 선택
      setSelectedSubSites(prev => {
        if (prev.includes(subSiteName)) {
          return prev.filter(name => name !== subSiteName);
        } else {
          return [...prev, subSiteName];
        }
      });
    } else {
      // Ctrl 키가 안 눌린 경우: 단일 선택
      setSelectedSubSites([subSiteName]);
    }
    
    setProductList([]);
    setSelectedProducts([]);
        setIssues([]);
    
    // 현재 선택된 Sub Site들 확인
    let currentSelectedSubSites: string[] = [];
    
    if (isCtrlPressed) {
      // Ctrl 키가 눌린 경우: 현재 상태에서 변경된 상태 계산
      const wasSelected = selectedSubSites.includes(subSiteName);
      if (wasSelected) {
        currentSelectedSubSites = selectedSubSites.filter(name => name !== subSiteName);
      } else {
        currentSelectedSubSites = [...selectedSubSites, subSiteName];
      }
    } else {
      // Ctrl 키가 안 눌린 경우: 단일 선택
      currentSelectedSubSites = [subSiteName];
    }
    
    // 선택된 Sub Site가 없으면 Product List 초기화
    if (currentSelectedSubSites.length === 0) {
      setProductList([]);
    } else if (currentSelectedSubSites.length === 1) {
      // 단일 선택인 경우 기존 로직 사용
      if (currentSelectedSubSites[0] === 'ALL') {
        // ALL 선택 시 모든 Sub Site List를 백엔드로 전송
        try {
          const subSiteNames = subProjects.map(project => project.project_name).filter(name => name !== 'ALL');
          const response = await fetch('/fap/api/issues/get-all-product-list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sub_site_list: subSiteNames })
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setProductList(data.product_list || []);
            }
          }
        } catch (error) {
          console.error('전체 Product List 조회 오류:', error);
          setProductList([]);
        }
        } else {
        // 특정 Sub Site 선택
        try {
          const response = await fetch(`/fap/api/issues/product-list?sub_project_name=${currentSelectedSubSites[0]}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setProductList(data.product_list || []);
            }
          }
        } catch (error) {
          console.error('Product List 조회 오류:', error);
          setProductList([]);
        }
      }
    }
  };

  // Product 버튼 클릭 핸들러 (다중 선택 지원)
  const handleProductClick = async (productName: string, event: React.MouseEvent) => {
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    
    if (isCtrlPressed) {
      // Ctrl 키가 눌린 경우: 다중 선택
      setSelectedProducts(prev => {
        if (prev.includes(productName)) {
          return prev.filter(name => name !== productName);
        } else {
          return [...prev, productName];
        }
      });
    } else {
      // Ctrl 키가 안 눌린 경우: 단일 선택
      setSelectedProducts([productName]);
    }
    
    setIssues([]);
  };

  return (
    <Layout>
      <div style={{
        display: 'flex',
        height: 'calc(100vh - 100px)',
        gap: 32
      }}>
        {/* 좌측 대시보드 메뉴/필터 (기존 IssuesPage와 동일) */}
        <div style={{
          width: 500,
          minWidth: 340,
          background: '#f7f9fc',
          borderRadius: 8,
          boxShadow: 'var(--color-shadow)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          height: '100%'
        }}>
          {/* 기간 선택 */}
          <div>
            <div style={{
              fontWeight: 700,
              marginBottom: 8,
              color: '#222'
            }}>Search Date</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{
                fontSize: '1rem',
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 6,
                width: 120
              }} max={dateTo} />
              <span style={{
                color: '#222',
                fontWeight: 600,
                fontSize: '1.1rem'
              }}>~</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{
                fontSize: '1rem',
                padding: '4px 8px',
                border: '1px solid #ccc',
                borderRadius: 6,
                width: 120
              }} min={dateFrom} />
            </div>
          </div>

          {/* SITE & Sub Site & Product List 버튼 영역 */}
          <div style={{
            display: 'flex',
            gap: 0,
            flex: 1
          }}>
            {/* SITE 버튼 영역 */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 'calc((100% ) / 3)'
            }}>
              <div style={{
                fontWeight: 700,
                marginBottom: 8,
                color: 'var(--text-white)'
              }}>SITE</div>
              <div style={{
                background: 'var(--dark-bg)',
                borderRadius: 'var(--border-radius-card)',
                padding: 'var(--padding-card)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 100px - 130px)'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: 1,
                  width: '100%'
                }}>
                  {customerProjects.map((customer: CustomerProject, index: number) => {
                    return (
            <button
                        key={customer.project_name}
                        onClick={(e) => handleSiteClick(customer.project_name, index, e)}
              style={{
                          width: '100%',
                          height: '48px',
                          fontWeight: 700,
                          fontSize: '1.08rem',
                          padding: '0 16px',
                borderRadius: 6,
                          background: selectedSites.includes(customer.project_name) ? '#28313b' : '#e5e8ef',
                          color: selectedSites.includes(customer.project_name) ? '#fff' : '#222',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'none',
                outline: 'none',
                          transition: 'all 0.15s',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        {customer.project_name}
            </button>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Sub Site 버튼 영역 - 항상 고정 위치 */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 'calc((100%) / 3)'
            }}>
              <div style={{
                fontWeight: 700,
                marginBottom: 8,
                color: 'var(--text-white)'
              }}>Sub Site</div>
              <div style={{
                background: 'var(--dark-bg)',
                borderRadius: 'var(--border-radius-card)',
                padding: 'var(--padding-card)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 100px - 130px)'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: 1,
                  width: '100%'
                }}>
                  {subProjects.length > 0 ? (
                    subProjects.map((subProject: CustomerProject) => {
                      return (
            <button
                          key={subProject.project_name}
                          onClick={(e) => handleSubSiteClick(subProject.project_name, e)}
              style={{
                            width: '100%',
                            height: '48px',
                            fontWeight: 700,
                            fontSize: '1.08rem',
                            padding: '0 16px',
                borderRadius: 6,
                            background: selectedSubSites.includes(subProject.project_name) ? '#28313b' : '#e5e8ef',
                            color: selectedSubSites.includes(subProject.project_name) ? '#fff' : '#222',
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'none',
                outline: 'none',
                            transition: 'all 0.15s',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          {subProject.project_name}
            </button>
                      );
                    })
                  ) : (
                    <div style={{
                      color: '#888',
                      fontSize: '0.9rem',
                      padding: '8px 16px'
                    }}>
                      SITE를 선택해주세요
                    </div>
                  )}
                </div>
              </div>
          </div>
            
            {/* Product List 버튼 영역 - 항상 고정 위치 */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 'calc((100%) / 3)'
            }}>
              <div style={{
                fontWeight: 700,
                marginBottom: 8,
                color: 'var(--text-white)'
              }}>Product List</div>
              <div style={{
                background: 'var(--dark-bg)',
                borderRadius: 'var(--border-radius-card)',
                padding: 'var(--padding-card)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 100px - 130px)'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: 1,
                  width: '100%'
                }}>
                  {filteredProductList.length > 0 ? (
                    filteredProductList.map((product: ProductItem) => {
                      return (
                        <button
                          key={product.name}
                          onClick={(e) => handleProductClick(product.name, e)}
                    style={{
                            width: '100%',
                            height: '48px',
                            fontWeight: 700,
                            fontSize: '1.08rem',
                            padding: '0 16px',
                            borderRadius: 6,
                            background: selectedProducts.includes(product.name) ? '#28313b' : '#e5e8ef',
                            color: selectedProducts.includes(product.name) ? '#fff' : '#222',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: 'none',
                            outline: 'none',
                            transition: 'all 0.15s',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          {product.name}
                        </button>
                      );
                    })
                  ) : (
                    <div style={{
                      color: '#888',
                      fontSize: '0.9rem',
                      padding: '8px 16px'
                    }}>
                      Sub Site를 선택해주세요
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 우측 영역 - 선택된 일감 달력 */}
        <div style={{
            flex: 1,
          background: '#f7f9fc',
            borderRadius: 8,
            boxShadow: 'var(--color-shadow)',
          padding: 24,
            display: 'flex',
            flexDirection: 'column',
          gap: 16,
          height: '100%',
          overflow: 'hidden'
        }}>
          {/* 담당자 일감 검색 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8
          }}>
            <span style={{
              fontWeight: 600,
              fontSize: '1.1rem',
              color: '#222',
              minWidth: 'fit-content'
            }}>
              담당자 일감 검색:
            </span>
            <input
              type="text"
              placeholder="담당자 이름을 입력하세요"
              style={{
                flex: 1,
                fontSize: '1rem',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: 6,
                minWidth: 200
              }}
              value={workerName}
              onChange={e => setWorkerName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleFindIssuesByWorker();
                }
              }}
            />
            <button
              style={{
                fontSize: '1rem',
                padding: '8px 16px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
                minWidth: 80
              }}
              onClick={handleFindIssuesByWorker}
              disabled={loadingWorkerIssues}
            >
              {loadingWorkerIssues ? 'Loading...' : 'Find'}
            </button>
          </div>
          
          {/* 담당자 일감 검색 결과 영역 */}
          <div style={{
            marginBottom: 8,
            minHeight: '100px',
            border: '1px solid #ddd',
            borderRadius: 6,
            background: '#f9f9f9'
          }}>
            {/* 검색 결과가 있을 때만 표시 */}
            {workerIssues.length > 0 && (
              <div style={{ padding: '10px' }}>
                <div style={{ 
                  marginBottom: '10px',
                  fontWeight: 600,
                  color: '#333',
                  fontSize: '0.9rem'
                }}>
                  검색 결과: {workerIssues.length}개
                </div>
                
                {/* 일감 카드들 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {workerIssues.map((issue, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'white',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #e0e0e0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      {/* 일감 번호 */}
                      <div style={{
                        background: issue.is_closed === 1 ? '#4CAF50' : '#FF6B6B',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        minWidth: 'fit-content'
                      }}>
                        #{issue.redmine_id}
                      </div>
                      
                      {/* 일감 제목 */}
                      <div style={{
                        flex: 1,
                        fontSize: '0.9rem',
                        color: '#333',
                        fontWeight: 500
                      }}>
                        {issue.subject}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 검색 결과가 없을 때 */}
            {workerIssues.length === 0 && !loadingWorkerIssues && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontSize: '0.9rem'
              }}>
                검색 결과가 없습니다.
              </div>
            )}
            
            {/* 로딩 중 */}
            {loadingWorkerIssues && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontSize: '0.9rem'
              }}>
                검색 중...
              </div>
            )}
          </div>

          {/* 일감 번호 입력 영역 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8
          }}>
            <span style={{
              fontWeight: 600,
              fontSize: '1.1rem',
              color: '#222',
              minWidth: 'fit-content'
            }}>
              일감 번호:
            </span>
            <input
              type="text"
              placeholder="일감 번호를 입력하세요 (예: 12345)"
              style={{
                flex: 1,
                fontSize: '1rem',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: 6,
                minWidth: 200
              }}
              value={issueNumber}
              onChange={e => setIssueNumber(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleFindIssue();
                }
              }}
            />
            <button
              style={{
                fontSize: '1rem',
                padding: '8px 16px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
                minWidth: 80,
                opacity: loadingIssue ? 0.6 : 1,
                pointerEvents: loadingIssue ? 'none' : 'auto'
              }}
              onClick={handleFindIssue}
              disabled={loadingIssue}
            >
              {loadingIssue ? 'Loading...' : 'Find'}
            </button>
          </div>

          {/* 달력 테이블 */}
          <div style={{ 
            flex: 1, 
            background: 'var(--dark-bg)', 
            borderRadius: 'var(--border-radius-panel)', 
            padding: 'var(--padding-panel)',
            border: `1px solid var(--border-dark)`,
            boxShadow: 'var(--shadow-dark)',
            overflow: 'auto'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr>
                    <th style={{ 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      background: '#f5f5f5',
                      width: '120px'
                    }}>
                      일감 정보
                    </th>
                    {(() => {
                      const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
                      const weekendIndices = [5, 6]; // 토요일(5), 일요일(6)
                      
                      return dayNames.map((dayName, index) => {
                        const isWeekend = weekendIndices.includes(index);
                        
                        return (
                          <th key={index} style={{ 
                            padding: '8px', 
                            border: '1px solid #ddd', 
                            background: isWeekend ? '#fff3e0' : '#f5f5f5',
                            width: '120px',
                            textAlign: 'center',
                            fontSize: '0.8rem',
                            color: isWeekend ? '#f57c00' : '#333'
                          }}>
                            {dayName}
                          </th>
                        );
                      });
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {/* 주차별 행들 */}
                  {(() => {
                    const weeks = [];
                    const startDate = new Date(dateFrom);
                    const endDate = new Date(dateTo);
                    
                    // 첫 번째 주의 월요일 찾기
                    let currentDate = new Date(startDate);
                    const dayOfWeek = currentDate.getDay();
                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    currentDate.setDate(currentDate.getDate() - daysToMonday);
                    
                    while (currentDate <= endDate) {
                      const weekStart = new Date(currentDate);
                      const weekEnd = new Date(currentDate);
                      weekEnd.setDate(weekEnd.getDate() + 6);
                      
                      weeks.push({
                        start: new Date(weekStart),
                        end: new Date(weekEnd)
                      });
                      
                      currentDate.setDate(currentDate.getDate() + 7);
                    }
                    
                    return weeks.map((week, weekIndex) => (
                      <tr key={`week-${weekIndex}`}>
                        <th style={{ 
                          padding: '8px', 
                          border: '1px solid #ddd', 
                          background: '#f5f5f5',
                          width: '120px',
                          textAlign: 'center',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#333',
                          verticalAlign: 'top'
                        }}>
                          {week.start.getMonth() + 1}월 {Math.ceil((week.start.getDate() + week.start.getDay()) / 7)}주차
                        </th>
                        {(() => {
                          const weekDates = [];
                          for (let i = 0; i < 7; i++) {
                            const date = new Date(week.start);
                            date.setDate(week.start.getDate() + i);
                            weekDates.push(date);
                          }
                          
                          return weekDates.map((date, dateIndex) => {
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            
                            // 해당 날짜와 일치하는 일감들 필터링
                            const dayIssues = calendarIssues.filter(issue => {
                              const issueDate = new Date(issue.created_at);
                              const issueYear = issueDate.getFullYear();
                              const issueMonth = issueDate.getMonth();
                              const issueDay = issueDate.getDate();
                              
                              const currentYear = date.getFullYear();
                              const currentMonth = date.getMonth();
                              const currentDay = date.getDate();
                              
                              return issueYear === currentYear && issueMonth === currentMonth && issueDay === currentDay;
                            });
                            
                            return (
                              <td key={dateIndex} style={{ 
                                padding: '4px', 
                                border: '1px solid #ddd',
                                verticalAlign: 'top',
                                minHeight: '80px',
                                background: isWeekend ? '#fafafa' : '#fff',
                                position: 'relative'
                              }}>
                                {/* 날짜 표시 */}
                                <div style={{
                                  position: 'absolute',
                                  top: '2px',
                                  left: '4px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: isWeekend ? '#ff0000' : '#333',
                                  zIndex: 1
                                }}>
                                  {date.getDate()}
                                </div>
                                
                                {/* 일감들 표시 */}
                                <div style={{ marginTop: '20px' }}>
                                  {dayIssues.map((issue, issueIndex) => {
                                    // tracker_name에 따른 색상 결정
                                    let cardColor = '#e3f2fd'; // 기본 파란색
                                    let borderColor = '#bbdefb';
                                    
                                    if (issue.tracker_name.includes('HW')) {
                                      cardColor = '#ffebee'; // 연한 빨간색
                                      borderColor = '#ffcdd2';
                                    } else if (issue.tracker_name.includes('SW')) {
                                      cardColor = '#e8f5e8'; // 연한 초록색
                                      borderColor = '#c8e6c9';
                                    } else if (issue.tracker_name.includes('Setup')) {
                                      cardColor = '#f3e5f5'; // 연한 보라색
                                      borderColor = '#e1bee7';
                                    } else if (issue.tracker_name.includes('확산')) {
                                      cardColor = '#f5f5f5'; // 연한 회색
                                      borderColor = '#e0e0e0';
                                    }
                                    
                                    return (
                                      <div 
                                        key={issueIndex} 
                                        style={{
                                          background: cardColor,
                                          padding: '4px 6px',
                                          margin: '1px 0',
                                          borderRadius: '4px',
                                          fontSize: '0.7rem',
                                          border: `1px solid ${borderColor}`,
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                          position: 'relative'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'translateY(0)';
                                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                                        }}
                                      >
                                        <div style={{ 
                                          background: issue.is_closed === 1 ? '#4CAF50' : '#FF6B6B',
                                          color: 'white',
                                          padding: '1px 4px',
                                          borderRadius: '3px',
                                          fontWeight: 600,
                                          fontSize: '0.6rem',
                                          minWidth: 'fit-content'
                                        }}>
                                          #{issue.redmine_id}
                      </div>
                                        <div style={{ 
                                          flex: 1,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          fontSize: '0.7rem'
                                        }}>
                                          {issue.subject}
                      </div>
                                        {/* 삭제 버튼 */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeIssueFromCalendar(issue.redmine_id);
                                          }}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#666',
                                            cursor: 'pointer',
                                            fontSize: '0.5rem',
                                            padding: '0px 2px',
                                            borderRadius: '2px',
                                            marginLeft: '2px'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#ffebee';
                                            e.currentTarget.style.color = '#d32f2f';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'none';
                                            e.currentTarget.style.color = '#666';
                                          }}
                                        >
                                          ×
                                        </button>
                    </div>
                                    );
                                  })}
                </div>
                              </td>
                            );
                          });
                        })()}
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
                </div>
              </div>
        </div>
      </div>
    </Layout>
  )
}

