import Layout from './Layout'
import { useState, useEffect } from 'react'

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
  const noteMatchWithoutTilde = description.match(/### 특이사항\s*([\s\S]*?)(?=\s*### ATI 내부 공유|$)/);
  const note = noteMatchWithTilde ? noteMatchWithTilde[1].trim() : 
               noteMatchWithoutTilde ? noteMatchWithoutTilde[1].trim() : '';

  // ATI 내부 공유 추출 (~~~ 구분자가 있으면 그 안의 내용, 없으면 끝까지)
  const atiReportMatchWithTilde = description.match(/### ATI 내부 공유\s*~~~\s*([\s\S]*?)\s*~~~/);
  const atiReportMatchWithoutTilde = description.match(/### ATI 내부 공유\s*([\s\S]*?)$/);
  const atiReport = atiReportMatchWithTilde ? atiReportMatchWithTilde[1].trim() : 
                    atiReportMatchWithoutTilde ? atiReportMatchWithoutTilde[1].trim() : '';

  // 구조화된 내용이 있는지 확인 (문제, 원인, 조치, 결과 중 하나라도 내용이 있으면 구조화된 것으로 판단)
  const hasStructuredContent = problem !== '' || cause !== '' || action !== '' || result !== '';

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
  project_name?: string;
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
  const [workerIssues, setWorkerIssues] = useState<Issue[]>(() => {
    const cached = localStorage.getItem('ae_make_report_worker_issues');
    return cached ? JSON.parse(cached) : [];
  });
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const saved = localStorage.getItem('ae_make_report_current_page');
    return saved ? parseInt(saved) : 1;
  });
  const [searchRange, setSearchRange] = useState<string>(() => {
    return localStorage.getItem('ae_make_report_search_range') || '';
  });
  const [lastSearchedWorker, setLastSearchedWorker] = useState<string>(() => {
    return localStorage.getItem('ae_make_report_worker') || '';
  });

  // 호기별 일감 검색 상태
  const [machineNumber, setMachineNumber] = useState<string>('');
  const [loadingMachineIssues, setLoadingMachineIssues] = useState<boolean>(false);
  const [machineIssues, setMachineIssues] = useState<Issue[]>([]);
  
  // 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // 드래그 앤 드롭 관련 상태
  const [draggedIssue, setDraggedIssue] = useState<Issue | null>(null);

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
      
      // 캐시와 상태 초기화
      setCurrentPage(1);
      setWorkerIssues([]);
      setSearchRange('');
      setLastSearchedWorker('');
      
      // localStorage 캐시 삭제
      localStorage.removeItem('ae_make_report_current_page');
      localStorage.removeItem('ae_make_report_search_range');
      localStorage.removeItem('ae_make_report_worker');
      localStorage.removeItem('ae_make_report_cache_timestamp');
      
      // 페이지별 캐시들도 모두 삭제
      for (let i = 1; i <= 10; i++) { // 1~10페이지 캐시 삭제
        localStorage.removeItem(`ae_make_report_page_${i}`);
      }
      
      const response = await fetch('/fap/api/ae-make-report/get-issues-by-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          worker_name: searchWorkerName,
          page: 1 // 페이지 1번으로 조회
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWorkerIssues(data.data || []);
          setSearchRange(data.search_range || '');
          setLastSearchedWorker(searchWorkerName);
          
          // localStorage에 상태와 캐시 저장
          localStorage.setItem('ae_make_report_current_page', '1');
          localStorage.setItem('ae_make_report_search_range', data.search_range || '');
          localStorage.setItem('ae_make_report_worker', searchWorkerName);
          localStorage.setItem('ae_make_report_cache_timestamp', Date.now().toString());
          
          // 페이지별 캐시에도 저장 (페이지 1번)
          const cacheData = {
            issues: data.data || [],
            searchRange: data.search_range || '',
            worker: searchWorkerName,
            timestamp: Date.now()
          };
          localStorage.setItem('ae_make_report_page_1', JSON.stringify(cacheData));
          
          console.log('담당자별 일감 조회 성공:', data.data);
          console.log('탐색 범위:', data.search_range);
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

  // 호기별 일감 조회 핸들러 (UI만 구성)
  const handleFindIssuesByMachine = async () => {
    console.log('호기별 일감 검색:', machineNumber);
    // TODO: 백엔드 API 구현 후 실제 검색 로직 추가
  };

  // 드래그 앤 드롭 핸들러들
  const handleDragStart = (e: React.DragEvent, issue: Issue) => {
    setDraggedIssue(issue);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(issue));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const data = e.dataTransfer.getData('text/plain');
      const parsedData = JSON.parse(data);
      
      if (parsedData.type === 'calendar-issue') {
        // 달력에서 드래그된 일감을 삭제
        const issueToRemove = parsedData.issue;
        setCalendarIssues(prev => prev.filter(issue => issue.redmine_id !== issueToRemove.redmine_id));
        return;
      }
    } catch (error) {
      // JSON 파싱 실패 시 기존 로직 실행
    }
    
    if (!draggedIssue) return;
    
    // 같은 일감이 이미 달력에 있는지 확인
    const existingIssueInCalendar = calendarIssues.find(issue => 
      issue.redmine_id === draggedIssue.redmine_id
    );
    
    if (existingIssueInCalendar) {
      alert('이미 달력에 추가된 일감입니다.');
      return;
    }
    
    // 일감을 원래 created_at 날짜로 달력에 추가
    setCalendarIssues(prev => [...prev, draggedIssue]);
    
    // 일감의 날짜가 현재 달력 범위에 없으면 날짜 범위 확장
    const issueDate = new Date(draggedIssue.created_at);
    const currentStartDate = new Date(dateFrom);
    const currentEndDate = new Date(dateTo);
    
    if (issueDate < currentStartDate || issueDate > currentEndDate) {
      const newStartDate = issueDate < currentStartDate ? issueDate : currentStartDate;
      const newEndDate = issueDate > currentEndDate ? issueDate : currentEndDate;
      
      setDateFrom(newStartDate.toISOString().slice(0, 10));
      setDateTo(newEndDate.toISOString().slice(0, 10));
    }
    
    setDraggedIssue(null);
  };

  const handleDragEnd = () => {
    setDraggedIssue(null);
  };

  // 일괄 추가 핸들러
  const handleBulkAdd = () => {
    if (workerIssues.length === 0) {
      return;
    }

    // 이미 달력에 있는 일감들 필터링
    const newIssues = workerIssues.filter(issue => 
      !calendarIssues.some(calendarIssue => calendarIssue.redmine_id === issue.redmine_id)
    );

    if (newIssues.length === 0) {
      return;
    }

    // 새로운 일감들만 달력에 추가
    setCalendarIssues(prev => [...prev, ...newIssues]);
    
    // 일감들의 날짜가 현재 달력 범위에 없으면 날짜 범위 확장
    const currentStartDate = new Date(dateFrom);
    const currentEndDate = new Date(dateTo);
    let needUpdateRange = false;
    let newStartDate = currentStartDate;
    let newEndDate = currentEndDate;
    
    newIssues.forEach(issue => {
      const issueDate = new Date(issue.created_at);
      if (issueDate < newStartDate) {
        newStartDate = issueDate;
        needUpdateRange = true;
      }
      if (issueDate > newEndDate) {
        newEndDate = issueDate;
        needUpdateRange = true;
      }
    });
    
    if (needUpdateRange) {
      setDateFrom(newStartDate.toISOString().slice(0, 10));
      setDateTo(newEndDate.toISOString().slice(0, 10));
    }
  };

  // 모달 핸들러
  const handleModalOpen = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedIssue(null);
  };

  // 페이지네이션 핸들러
  const handlePageChange = async (direction: 'prev' | 'next') => {
    if (!lastSearchedWorker) {
      alert('먼저 담당자로 검색해주세요.');
      return;
    }

    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    
    if (newPage < 1) {
      alert('첫 페이지입니다.');
      return;
    }

    try {
      setLoadingWorkerIssues(true);
      
      // 캐시에서 먼저 확인
      const cacheKey = `ae_make_report_page_${newPage}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        // 캐시에서 데이터 로드
        const parsedData = JSON.parse(cachedData);
        setWorkerIssues(parsedData.issues || []);
        setSearchRange(parsedData.searchRange || '');
        setCurrentPage(newPage);
        setLastSearchedWorker(parsedData.worker || lastSearchedWorker);
        
        // localStorage 상태 업데이트
        localStorage.setItem('ae_make_report_current_page', newPage.toString());
        localStorage.setItem('ae_make_report_search_range', parsedData.searchRange || '');
        localStorage.setItem('ae_make_report_worker', parsedData.worker || lastSearchedWorker);
        
        console.log(`페이지 ${newPage} 캐시에서 로드됨`);
      } else {
        // 백엔드 API 호출
        const response = await fetch('/fap/api/ae-make-report/get-issues-by-worker', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            worker_name: lastSearchedWorker,
            page: newPage
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setWorkerIssues(data.data || []);
            setSearchRange(data.search_range || '');
            setCurrentPage(newPage);
            
            // 캐시에 저장
            const cacheData = {
              issues: data.data || [],
              searchRange: data.search_range || '',
              worker: lastSearchedWorker,
              timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            
            // localStorage 상태 업데이트
            localStorage.setItem('ae_make_report_current_page', newPage.toString());
            localStorage.setItem('ae_make_report_search_range', data.search_range || '');
            localStorage.setItem('ae_make_report_worker', lastSearchedWorker);
            
            console.log(`페이지 ${newPage} API에서 로드됨`);
          } else {
            console.error('페이지 조회 실패:', data.message);
            alert('페이지 조회 실패: ' + data.message);
          }
        } else {
          console.error('HTTP 오류:', response.status, response.statusText);
          alert('페이지 조회 중 오류가 발생했습니다.');
        }
      }
    } catch (error) {
      console.error('페이지 조회 오류:', error);
      alert('페이지 조회 중 오류가 발생했습니다.');
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
        {/* 좌측 영역 - 흰색 레이아웃 */}
        <div style={{
          width: 500,
          minWidth: 340,
          background: '#f7f9fc',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          height: '100%'
        }}>
          {/* 일감 번호 입력 영역 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom:0
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
                background: '#28313b',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
                minWidth: 80,
                opacity: loadingIssue ? 0.6 : 1,
                pointerEvents: loadingIssue ? 'none' : 'auto',
                transition: 'all 0.2s ease'
              }}
              onClick={handleFindIssue}
              disabled={loadingIssue}
              onMouseEnter={(e) => {
                if (!loadingIssue) {
                  e.currentTarget.style.background = '#1f2937';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#28313b';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loadingIssue ? 'Loading...' : 'Find'}
            </button>
          </div>

          {/* 담당자 일감 검색 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 0
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
                background: '#28313b',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
                minWidth: 80,
                transition: 'all 0.2s ease'
              }}
              onClick={handleFindIssuesByWorker}
              disabled={loadingWorkerIssues}
              onMouseEnter={(e) => {
                if (!loadingWorkerIssues) {
                  e.currentTarget.style.background = '#1f2937';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#28313b';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loadingWorkerIssues ? 'Loading...' : 'Find'}
            </button>
          </div>

          {/* 호기별 일감 검색 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 0
          }}>
            <span style={{
              fontWeight: 600,
              fontSize: '1.1rem',
              color: '#222',
              minWidth: 'fit-content'
            }}>
              호기별 일감 검색:
            </span>
            <input
              type="text"
              placeholder="호기를 입력하세요 (예: 1호기, 2호기)"
              style={{
                flex: 1,
                fontSize: '1rem',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: 6,
                minWidth: 200
              }}
              value={machineNumber}
              onChange={e => setMachineNumber(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleFindIssuesByMachine();
                }
              }}
            />
            <button
              style={{
                fontSize: '1rem',
                padding: '8px 16px',
                background: '#28313b',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
                minWidth: 80,
                transition: 'all 0.2s ease'
              }}
              onClick={handleFindIssuesByMachine}
              disabled={loadingMachineIssues}
              onMouseEnter={(e) => {
                if (!loadingMachineIssues) {
                  e.currentTarget.style.background = '#1f2937';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#28313b';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loadingMachineIssues ? 'Loading...' : 'Find'}
            </button>
          </div>

          {/* 담당자 일감 검색 결과 영역 */}
          <div style={{
            marginBottom: 8,
            minHeight: '100px',
            border: '1px solid #ddd',
            borderRadius: 6,
            background: '#f9f9f9',
            flex: 1
          }}>
            {/* 검색 결과 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid #ddd',
              background: '#f0f0f0'
            }}>
              <button
                style={{
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#333',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  minWidth: '32px',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => handlePageChange('prev')}
                disabled={loadingWorkerIssues || currentPage <= 1}
                onMouseEnter={(e) => {
                  if (!loadingWorkerIssues && currentPage > 1) {
                    e.currentTarget.style.background = '#e0e0e0';
                    e.currentTarget.style.borderColor = '#bbb';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#ddd';
                }}
              >
                &lt;
              </button>
              
              <div style={{
                fontWeight: 600,
                color: '#333',
                fontSize: '0.9rem',
                lineHeight: '1.2'
              }}>
                {lastSearchedWorker && searchRange 
                  ? (
                    <>
                      <div>{lastSearchedWorker}</div>
                      <div>{searchRange} (${workerIssues.length}개)</div>
                    </>
                  )
                  : searchRange 
                    ? `${searchRange} (${workerIssues.length}개)` 
                    : `검색 결과: ${workerIssues.length}개`
                }
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '40px'
              }}>
                                  <button
                    style={{
                      background: '#f5f5f5',
                      border: '1px solid #ddd',
                      fontSize: '18px',
                      cursor: 'pointer',
                      color: '#333',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      minWidth: '32px',
                      minHeight: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={() => handlePageChange('next')}
                    disabled={loadingWorkerIssues}
                    onMouseEnter={(e) => {
                      if (!loadingWorkerIssues) {
                        e.currentTarget.style.background = '#e0e0e0';
                        e.currentTarget.style.borderColor = '#bbb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f5f5f5';
                      e.currentTarget.style.borderColor = '#ddd';
                    }}
                  >
                    &gt;
                  </button>
                
                <button
                  style={{
                    background: '#28313b',
                    border: 'none',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 500,
                    minWidth: 80,
                    transition: 'all 0.2s ease'
                  }}
                  onClick={handleBulkAdd}
                  disabled={workerIssues.length === 0}
                  onMouseEnter={(e) => {
                    if (workerIssues.length > 0) {
                      e.currentTarget.style.background = '#1f2937';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#28313b';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  일괄<br />추가
                </button>
              </div>
            </div>
            
            {/* 검색 결과가 있을 때만 표시 */}
            {workerIssues.length > 0 && (
              <div style={{ padding: '10px' }}>
                
                {/* 일감 카드들 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  height: 'calc(100vh - 350px)',
                  minHeight: '200px',
                 
                  overflowY: 'auto'
                }}>
                  {workerIssues.map((issue, index) => (
                    <div 
                      key={index}
                      style={{
                        padding: '8px 10px',
                        background: draggedIssue?.redmine_id === issue.redmine_id ? '#e3f2fd' : '#f8f9fa',
                        borderRadius: '4px',
                        border: draggedIssue?.redmine_id === issue.redmine_id ? '2px solid var(--accent-color)' : '1px solid #e9ecef',
                        fontSize: '0.85rem',
                        color: '#333',
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: draggedIssue?.redmine_id === issue.redmine_id ? 'grabbing' : 'grab',
                        transition: 'all 0.2s ease',
                        userSelect: 'none',
                        opacity: draggedIssue?.redmine_id === issue.redmine_id ? 0.6 : 1
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, issue)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleModalOpen(issue)}
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
                          background: issue.is_closed === 1 ? 'var(--success-color)' : 'var(--danger-color)', 
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
                          e.currentTarget.style.transform = 'var(--hover-scale)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                        }}
                      >
                        #{issue.redmine_id}
                      </span>
                      <span style={{
                        flex: 1
                      }}>{issue.subject}</span>
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
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        >

          {/* 버튼 영역 */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            width: '100%'
          }}>
            <button
              style={{
                background: '#28313b',
                border: 'none',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 500,
                flex: 1,
                transition: 'all 0.2s ease'
              }}
              onClick={() => console.log('단일 일감 Report 클릭')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1f2937';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#28313b';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              단일 일감 Report
            </button>
            
            <button
              style={{
                background: '#28313b',
                border: 'none',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 500,
                flex: 1,
                transition: 'all 0.2s ease'
              }}
              onClick={() => console.log('다중 일감 Report 클릭')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1f2937';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#28313b';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              다중 일감 Report
            </button>
            
            <button
              style={{
                background: '#28313b',
                border: 'none',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 500,
                flex: 1,
                transition: 'all 0.2s ease'
              }}
              onClick={() => console.log('요약 Report 클릭')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1f2937';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#28313b';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              요약 Report
            </button>
            
            <button
              style={{
                background: '#28313b',
                border: 'none',
                fontSize: '0.9rem',
                cursor: 'pointer',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 500,
                flex: 1,
                transition: 'all 0.2s ease'
              }}
              onClick={() => console.log('Setup Report 클릭')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1f2937';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#28313b';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Setup Report
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
            
            {/* 기능 구현 중 안내 텍스트 */}
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              marginBottom: '20px',
              background: 'rgba(255, 193, 7, 0.1)',
              border: '2px solid #ffc107',
              borderRadius: '12px',
              borderStyle: 'dashed'
            }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: '#856404',
                marginBottom: '10px'
              }}>
                🚧
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#856404',
                lineHeight: '1.4'
              }}>
                아직 기능 구현 중입니다.
              </div>
              <div style={{
                fontSize: '1rem',
                color: '#856404',
                marginTop: '8px',
                opacity: 0.8
              }}>
                곧 완성될 예정입니다!
              </div>
            </div>
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
                            
                            const dateStr = date.toISOString().slice(0, 10);
                            
                            return (
                              <td key={dateIndex} 
                                style={{ 
                                  padding: '4px', 
                                  border: '1px solid #ddd',
                                  verticalAlign: 'top',
                                  minHeight: '80px',
                                  background: isWeekend ? '#fafafa' : '#fff',
                                  position: 'relative'
                                }}
                              >
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
                                          cursor: 'grab',
                                          transition: 'all 0.2s ease',
                                          position: 'relative',
                                          userSelect: 'none'
                                        }}
                                        draggable
                                        onDragStart={(e) => {
                                          e.dataTransfer.effectAllowed = 'move';
                                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'calendar-issue', issue }));
                                        }}
                                        onClick={() => handleModalOpen(issue)}
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

      {/* 일감 상세 모달 */}
      {isModalOpen && selectedIssue && (
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
            zIndex: 10000
          }}
          onClick={handleModalClose}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '60vw',
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
                onClick={handleModalClose}
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
                      <span>{selectedIssue.project_name || 'N/A'}</span>
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
  )
}

