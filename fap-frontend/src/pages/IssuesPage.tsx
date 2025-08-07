/**
 * FAP 2.0 - AE Issue Page (프론트엔드)
 * 
 * 역할:
 * - AE Issue Page의 UI 및 상호작용 담당
 * - 6개 탭 (summary, progress, type, member, hw, sw)으로 데이터 표시
 * - 각 탭에서 백엔드 API 데이터를 활용하여 UI 구현
 * - 백엔드 API (issue_database.py) 호출하여 데이터 통신
 * 
 * 주요 기능:
 * - 계층적 데이터 구조: SITE → Sub Site → Product 순서로 선택
 * - 다중 선택 지원: Ctrl+클릭으로 여러 항목 동시 선택
 * - 실시간 상태 변경: 드래그 앤 드롭으로 이슈 상태 변경
 * - 반응형 UI: 선택에 따라 동적으로 데이터 로드
 * - 차트 시각화: recharts 라이브러리 사용
 * - 사용자 경험: 직관적인 인터페이스와 부드러운 애니메이션
 * 
 * 데이터 흐름:
 * 1. 사용자가 SITE → Sub Site → Product 선택
 * 2. 선택된 조건으로 백엔드 API 호출
 * 3. 받은 데이터를 각 탭에 맞는 UI로 렌더링
 * 4. 드래그 앤 드롭으로 이슈 상태 변경 시 실시간 업데이트
 */

import Layout from './Layout';
import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const VIEW_TABS = [
  { key: 'summary', label: 'summary' },
  { key: 'progress', label: 'progress' },
  // { key: 'type', label: 'type' },
  { key: 'member', label: 'member' },
  { key: 'hw', label: 'HW' },
  { key: 'sw', label: 'SW' },
];

// 고객사 프로젝트 타입 정의
interface CustomerProject {
  project_name: string;
}

// Product List 타입 정의
interface ProductItem {
  name: string;
}

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

export default function IssuesPage() {
  const [dateFrom, setDateFrom] = useState(getWeekAgo());
  const [dateTo, setDateTo] = useState(getToday());
  const [activeView, setActiveView] = useState('summary');
  const [customerProjects, setCustomerProjects] = useState<CustomerProject[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [selectedSiteIndexes, setSelectedSiteIndexes] = useState<number[]>([]);
  const [subProjects, setSubProjects] = useState<CustomerProject[]>([]);
  const [selectedSubSites, setSelectedSubSites] = useState<string[]>([]);
  const [productList, setProductList] = useState<ProductItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [issueData, setIssueData] = useState<any>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [memberSortBy, setMemberSortBy] = useState<'total' | 'completion'>('total');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedProgressType, setSelectedProgressType] = useState<string | null>(null);
  const [selectedProductForMembers, setSelectedProductForMembers] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // 드래그 앤 드롭 관련 상태
  const [draggedIssue, setDraggedIssue] = useState<any>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 모달 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  // 고객사 프로젝트 목록 가져오기 (SITE 버튼용)
  const fetchCustomerProjects = async () => {
    try {
      const response = await fetch('/api/issues/site');
      if (response.ok) {
        const data = await response.json();
        setCustomerProjects(data.projects || []);
      }
    } catch (error) {
      console.error('고객사 프로젝트 조회 오류:', error);
    }
  };

  // SITE 버튼 클릭 핸들러 (다중 선택 지원)
  const handleSiteClick = async (siteName: string, siteIndex: number, event: React.MouseEvent) => { // 수정 불가
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
    setIssueData(null);
    
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
        const response = await fetch(`/api/issues/sub-site?site_index=${currentSelectedSiteIndexes[0]}`);
        if (response.ok) {
          const data = await response.json();
          if (data.projects) {
            setSubProjects(data.projects);
          }
        }
      } catch (error) {
        console.error(`Sub Site 조회 오류 (site_index: ${currentSelectedSiteIndexes[0]}):`, error);
      }
    } else {
      // 다중 선택인 경우 새로운 API 사용
      try {
        const response = await fetch('/api/issues/sub-sites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            site_indexes: currentSelectedSiteIndexes
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.projects) {
            setSubProjects(data.projects);
          }
        }
      } catch (error) {
        console.error('다중 SITE Sub Site 조회 오류:', error);
      }
    }
  };

  // Sub Site 버튼 클릭 핸들러 (다중 선택 지원)
  const handleSubSiteClick = async (subSiteName: string, event: React.MouseEvent) => { // 수정 불가
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
    setIssueData(null);
    
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
          const response = await fetch('/api/issues/get-all-product-list', {
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
          const response = await fetch(`/api/issues/product-list?sub_project_name=${currentSelectedSubSites[0]}`);
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
    } else {
      // 다중 선택인 경우
      if (currentSelectedSubSites.includes('ALL')) {
        // ALL이 포함된 다중 선택: 기존처럼 모든 Sub Site의 Product List 출력
        try {
          const subSiteNames = subProjects.map(project => project.project_name).filter(name => name !== 'ALL');
          const response = await fetch('/api/issues/get-all-product-list', {
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
        // ALL이 포함되지 않은 다중 선택: 선택된 Sub Site들의 Product List 합치기
        try {
          const response = await fetch('/api/issues/product-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              sub_site_names: currentSelectedSubSites 
            })
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setProductList(data.product_list || []);
            }
          }
        } catch (error) {
          console.error('다중 Sub Site Product List 조회 오류:', error);
          setProductList([]);
        }
      }
    }
  };

  // Product List 선택 핸들러 (다중 선택 지원)
  const handleProductClick = async (productName: string, event: React.MouseEvent) => { // 수정 불가가
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
    
    setIssueData(null); // 새 데이터 로드 전에 초기화
    
    // 현재 선택된 Product들 확인
    let currentSelectedProducts: string[] = [];
    
    if (isCtrlPressed) {
      // Ctrl 키가 눌린 경우: 현재 상태에서 변경된 상태 계산
      const wasSelected = selectedProducts.includes(productName);
      if (wasSelected) {
        currentSelectedProducts = selectedProducts.filter(name => name !== productName);
      } else {
        currentSelectedProducts = [...selectedProducts, productName];
      }
    } else {
      // Ctrl 키가 안 눌린 경우: 단일 선택
      currentSelectedProducts = [productName];
    }
    
    // Product가 선택되어 있으면 현재 활성 탭에 따라 데이터 로드
    if (currentSelectedProducts.length > 0) {
      if (activeView === 'progress') {
        await loadProgressData(currentSelectedProducts);
      } else if (activeView === 'summary') {
        await loadSummaryReportData(currentSelectedProducts);
      } else if (activeView === 'member') {
        await loadMemberData(currentSelectedProducts);
      } else if (activeView === 'type') {
        await loadTypeData(currentSelectedProducts);
      } else if (activeView === 'hw') {
        await loadHWData(currentSelectedProducts);
      } else if (activeView === 'sw') {
        await loadSWData(currentSelectedProducts);
      }
    }
  };

  // 주간 업무보고 데이터 로드
  const loadSummaryReportData = async (productNames: string[]) => {
    try {
      const response = await fetch('/api/issues/get-summary-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: adjustEndDate(dateTo),
          site_indexes: selectedSiteIndexes,
          sub_site_names: selectedSubSites,
          product_names: productNames
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssueData(data.data);
        }
      }
    } catch (error) {
      console.error('주간 업무보고 데이터 로드 오류:', error);
    }
  };

  // 진행율 데이터 로드
  const loadProgressData = async (productNames: string[]) => {
    try {
      const response = await fetch('/api/issues/get-progress-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: adjustEndDate(dateTo),
          site_indexes: selectedSiteIndexes,
          sub_site_names: selectedSubSites,
          product_names: productNames
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssueData(data.data);
        }
      }
    } catch (error) {
      console.error('진행율 데이터 로드 오류:', error);
    }
  };

  // 유형 데이터 로드
  const loadTypeData = async (productNames: string[]) => {
    try {
      const response = await fetch('/api/issues/get-type-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: adjustEndDate(dateTo),
          site_indexes: selectedSiteIndexes,
          sub_site_names: selectedSubSites,
          product_names: productNames
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssueData(data.data);
        }
      }
    } catch (error) {
      console.error('유형 데이터 로드 오류:', error);
    }
  };

  // 인원 데이터 로드
  const loadMemberData = async (productNames: string[]) => {
    try {
      const response = await fetch('/api/issues/get-member-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: adjustEndDate(dateTo),
          site_indexes: selectedSiteIndexes,
          sub_site_names: selectedSubSites,
          product_names: productNames
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssueData(data.data);
        }
      }
    } catch (error) {
      console.error('인원 데이터 로드 오류:', error);
    }
  };

  // HW 데이터 로드
  const loadHWData = async (productNames: string[]) => {
    try {
      const response = await fetch('/api/issues/get-hw-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: adjustEndDate(dateTo),
          site_indexes: selectedSiteIndexes,
          sub_site_names: selectedSubSites,
          product_names: productNames
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssueData(data.data);
        }
      }
    } catch (error) {
      console.error('HW 데이터 로드 오류:', error);
    }
  };

  // SW 데이터 로드
  const loadSWData = async (productNames: string[]) => {
    try {
      const response = await fetch('/api/issues/get-sw-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: adjustEndDate(dateTo),
          site_indexes: selectedSiteIndexes,
          sub_site_names: selectedSubSites,
          product_names: productNames
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssueData(data.data);
        }
      }
    } catch (error) {
      console.error('SW 데이터 로드 오류:', error);
    }
  };

  // 멤버 데이터 정렬 함수
  const sortMemberData = (data: any[], sortBy: 'total' | 'completion') => {
    const sortedData = [...data];
    if (sortBy === 'total') {
      sortedData.sort((a, b) => b.total_tasks - a.total_tasks);
    } else {
      sortedData.sort((a, b) => b.completion_rate - a.completion_rate);
    }
    return sortedData;
  };

  // 페이지 로드 시 고객사 목록 가져오기
  useEffect(() => {
    fetchCustomerProjects();
  }, []);

  // 드래그 시작 핸들러
  const handleDragStart = (e: React.DragEvent, issue: any, currentStatus: string) => {
    setDraggedIssue({ ...issue, currentStatus });
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 드래그 오버 핸들러
  const handleDragOver = (e: React.DragEvent, statusName: string) => {
    e.preventDefault();
    setDragOverStatus(statusName);
  };

  // 드래그 리브 핸들러
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStatus(null);
  };

  // 드롭 핸들러
  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverStatus(null);
    setIsDragging(false);
    
    if (draggedIssue && draggedIssue.currentStatus !== targetStatus) {
      console.log(`이슈 #${draggedIssue.redmine_id}를 ${draggedIssue.currentStatus}에서 ${targetStatus}로 이동`);
      
      try {
        // 사용자 ID 가져오기
        const userId = localStorage.getItem('fap_user_id');
        if (!userId) {
          alert('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
          return;
        }

        // API 호출해서 실제 상태 변경
        const response = await fetch('/api/issues/update-progress-status', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            redmine_id: draggedIssue.redmine_id,
            old_status_name: draggedIssue.currentStatus,
            new_status_name: targetStatus,
            user_id: userId
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('상태 변경 성공:', result.message);
          
          // 성공 시 데이터 새로고침
          if (selectedProducts.length > 0) {
            await loadProgressData(selectedProducts);
          }
        } else {
          const errorData = await response.json();
          console.error('상태 변경 실패:', errorData.detail);
          alert(`상태 변경 실패: ${errorData.detail}`);
        }
      } catch (error) {
        console.error('API 호출 오류:', error);
        alert('상태 변경 중 오류가 발생했습니다.');
      }
    }
    
    setDraggedIssue(null);
  };

  // 드래그 엔드 핸들러
  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverStatus(null);
    setDraggedIssue(null);
  };

  // 모달 열기 핸들러
  const handleModalOpen = (issue: any) => {
    setSelectedIssue(issue);
    setIsModalOpen(true);
  };

  // 모달 닫기 핸들러
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedIssue(null);
  };

  return (
    <Layout>
      <div style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: 32 }}>
        {/* 좌측 대시보드 메뉴/필터 */}
        <div style={{ width: 500, minWidth: 340, background: '#f7f9fc', borderRadius: 8, boxShadow: 'var(--color-shadow)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
          {/* 기간 선택 */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#222' }}>Search Date</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: '1rem', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 6, width: 120 }} max={dateTo} />
              <span style={{ color: '#222', fontWeight: 600, fontSize: '1.1rem' }}>~</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: '1rem', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 6, width: 120 }} min={dateFrom} />
            </div>
          </div>

                    {/* SITE & Sub Site & Product List 버튼 영역 */}
          <div style={{ display: 'flex', gap: 0, flex: 1 }}>
            {/* SITE 버튼 영역 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 'calc((100% ) / 3)'  }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#222' }}>SITE</div>
              <div style={{ background: '#f7f9fc', borderRadius: 6, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 100px - 130px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', overflowX: 'hidden', flex: 1, width: '100%' }}>
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 'calc((100%) / 3)' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#222' }}>Sub Site</div>
              <div style={{ background: '#f7f9fc', borderRadius: 6, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 100px - 130px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', overflowX: 'hidden', flex: 1, width: '100%' }}>
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
                    <div style={{ color: '#888', fontSize: '0.9rem', padding: '8px 16px' }}>
                      SITE를 선택해주세요
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Product List 버튼 영역 - 항상 고정 위치 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 'calc((100%) / 3)'  }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#222' }}>Product List</div>
              <div style={{ background: '#f7f9fc', borderRadius: 6, padding: 12, flex: 1, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 100px - 130px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', overflowX: 'hidden', flex: 1, width: '100%' }}>
                  {productList.length > 0 ? (
                    productList.map((product: ProductItem) => {
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
                    <div style={{ color: '#888', fontSize: '0.9rem', padding: '8px 16px' }}>
                      Sub Site를 선택해주세요
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 우측 통계/차트 영역 */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 8, boxShadow: 'var(--color-shadow)', padding: 32, display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
          {/* 상단 뷰 선택 버튼 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {VIEW_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={async () => {
                  setActiveView(tab.key);
                  // 탭 변경 시 Product가 선택되어 있으면 데이터 로드
                  if (selectedProducts.length > 0) {
                    setIssueData(null); // 데이터 초기화
                    switch (tab.key) {
                      case 'progress':
                        await loadProgressData(selectedProducts);
                        break;
                      case 'summary':
                        await loadSummaryReportData(selectedProducts);
                        break;
                      case 'type':
                        await loadTypeData(selectedProducts);
                        break;
                      case 'member':
                        await loadMemberData(selectedProducts);
                        break;
                      case 'hw':
                        await loadHWData(selectedProducts);
                        break;
                      case 'sw':
                        await loadSWData(selectedProducts);
                        break;
                    }
                  }
                }}
                style={{
                  fontWeight: 700,
                  fontSize: '1.08rem',
                  padding: '12px 24px',
                  borderRadius: 6,
                  background: activeView === tab.key ? '#28313b' : '#e5e8ef',
                  color: activeView === tab.key ? '#fff' : '#222',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 선택된 뷰에 따른 내용 표시 */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', color: '#888', fontSize: '1.1rem', overflowY: 'auto' }}>
            {activeView === 'progress' && (
              selectedProducts.length > 0 ? (
                issueData ? (
                  <div style={{ width: '100%', minHeight: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
                      {issueData.blocks && issueData.blocks.map((block: any, index: number) => {
                        switch (block.type) {
                          case 'progress_summary':
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#222', fontSize: '1.2rem' }}>진행률 요약</h4>
                                
                                {/* 전체 통계와 버튼을 하나의 흰색 칸에 묶기 */}
                                {block.data.progress_data && block.data.progress_data.length > 0 && (
                                  <div style={{ 
                                    background: '#fff',
                                    borderRadius: '8px',
                                    border: '1px solid #e9ecef',
                                    marginBottom: '16px',
                                    padding: '16px'
                                  }}>
                                    {/* 전체 통계 */}
                                    <div style={{ 
                                      display: 'flex', 
                                      justifyContent: 'center', 
                                      gap: 24, 
                                      marginBottom: '16px'
                                    }}>
                                      {(() => {
                                        const totalStats = block.data.progress_data.reduce((acc: any, tracker: any) => {
                                          acc.total += tracker.total_count;
                                          acc.completed += tracker.completed_count;
                                          acc.inProgress += tracker.in_progress_count;
                                          return acc;
                                        }, { total: 0, completed: 0, inProgress: 0 });
                                        
                                        const overallCompletionRate = totalStats.total > 0 ? 
                                          Math.round((totalStats.completed / totalStats.total) * 100 * 10) / 10 : 0;
                                        
                                        return (
                                          <>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>전체</div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#28313b' }}>{totalStats.total}건</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>진행 중</div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#FF6B6B' }}>{totalStats.inProgress}건</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>완료</div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4CAF50' }}>{totalStats.completed}건</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>완료율</div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2196F3' }}>{overallCompletionRate}%</div>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                    
                                    {/* 업무 유형별 버튼 */}
                                    <div style={{ 
                                      display: 'flex', 
                                      flexWrap: 'wrap', 
                                      gap: 8, 
                                      justifyContent: 'center'
                                    }}>
                                      {block.data.progress_data && block.data.progress_data.map((tracker: any, trackerIndex: number) => (
                                        <button
                                          key={trackerIndex}
                                          style={{
                                            padding: '6px 12px',
                                            background: selectedProgressType === tracker.tracker_name ? '#1565C0' : ['#28313b', '#b30000', '#a07000', '#008000', '#6a0dad'][trackerIndex % 5],
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            color: '#fff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                          }}
                                          onMouseEnter={(e) => {
                                            if (selectedProgressType !== tracker.tracker_name) {
                                              e.currentTarget.style.opacity = '0.8';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.opacity = '1';
                                          }}
                                          onClick={() => setSelectedProgressType(selectedProgressType === tracker.tracker_name ? null : tracker.tracker_name)}
                                        >
                                          {tracker.tracker_name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                
                                
                                {/* 리스트 - 선택된 유형만 표시 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {block.data.progress_data && block.data.progress_data
                                    .filter((tracker: any) => !selectedProgressType || tracker.tracker_name === selectedProgressType)
                                    .map((tracker: any, trackerIndex: number) => (
                                      <div key={trackerIndex} style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        background: '#fff',
                                        borderRadius: '6px',
                                        border: '1px solid #e0e0e0'
                                      }}>
                                        <span style={{ fontWeight: 600, color: '#222', fontSize: '1rem' }}>
                                          {tracker.tracker_name}
                                        </span>
                                        <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem', color: '#555' }}>
                                          <span>진행 중: <strong style={{ color: '#FF6B6B' }}>{tracker.in_progress_count}건</strong></span>
                                          <span>완료: <strong style={{ color: '#4CAF50' }}>{tracker.completed_count}건</strong></span>
                                          <span>완료율: <strong style={{ color: '#2196F3' }}>{tracker.completion_rate}%</strong></span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            );
                          case 'progress_detail':
                            return selectedProgressType ? (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#222', fontSize: '1.2rem' }}>진행률 상세 - {selectedProgressType}</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                  {block.data.progress_detail && block.data.progress_detail
                                    .filter((tracker: any) => tracker.tracker_name === selectedProgressType)
                                    .map((tracker: any, trackerIndex: number) => (
                                    <div key={trackerIndex} style={{ 
                                      background: '#fff',
                                      borderRadius: '8px',
                                      border: '1px solid #e9ecef',
                                      padding: '16px'
                                    }}>

                                      <div style={{ display: 'flex', gap: 12 }}>
                                        {tracker.status_details && tracker.status_details.map((status: any, statusIndex: number) => (
                                          <div 
                                            key={statusIndex} 
                                            onDragOver={(e) => handleDragOver(e, status.status_name)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, status.status_name)}
                                            style={{ 
                                              background: dragOverStatus === status.status_name ? '#e3f2fd' : '#f8f9fa',
                                              borderRadius: '6px',
                                              border: dragOverStatus === status.status_name ? '2px dashed #2196F3' : '1px solid #e9ecef',
                                              padding: '12px',
                                              flex: 1,
                                              minWidth: '200px',
                                              transition: 'all 0.2s ease',
                                              position: 'relative'
                                            }}
                                          >
                                            <h6 style={{ 
                                              margin: '0 0 8px 0', 
                                              color: '#495057', 
                                              fontSize: '0.85rem',
                                              fontWeight: 600,
                                              textAlign: 'center'
                                            }}>
                                              <div style={{ marginBottom: '4px' }}>
                                                {status.status_name}
                                              </div>
                                              <div style={{ 
                                                fontSize: '0.9rem',
                                                fontWeight: 700,
                                                color: '#2196F3'
                                              }}>
                                                ({status.issues.length}건)
                                              </div>
                                            </h6>
                                            
                                            {/* 드롭 영역 표시 */}
                                            {dragOverStatus === status.status_name && (
                                              <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'rgba(33, 150, 243, 0.1)',
                                                border: '2px dashed #2196F3',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                pointerEvents: 'none',
                                                zIndex: 10
                                              }}>
                                                <div style={{
                                                  background: '#2196F3',
                                                  color: '#fff',
                                                  padding: '8px 16px',
                                                  borderRadius: '4px',
                                                  fontSize: '0.8rem',
                                                  fontWeight: 600
                                                }}>
                                                  여기에 드롭하세요
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* 이슈 카드들 */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                              {status.issues.map((issue: any, issueIndex: number) => (
                                                <div 
                                                  key={issueIndex} 
                                                  draggable
                                                  onDragStart={(e) => handleDragStart(e, issue, status.status_name)}
                                                  onDragEnd={handleDragEnd}
                                                  onClick={() => handleModalOpen(issue)}
                                                  style={{ 
                                                    background: '#fff',
                                                    borderRadius: '4px',
                                                    border: '1px solid #e0e0e0',
                                                    padding: '8px',
                                                    fontSize: '0.75rem',
                                                    cursor: isDragging && draggedIssue?.redmine_id === issue.redmine_id ? 'grabbing' : 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    opacity: isDragging && draggedIssue?.redmine_id === issue.redmine_id ? 0.5 : 1,
                                                    transform: isDragging && draggedIssue?.redmine_id === issue.redmine_id ? 'scale(0.95)' : 'scale(1)',
                                                    boxShadow: isDragging && draggedIssue?.redmine_id === issue.redmine_id ? '0 4px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.1)'
                                                  }}
                                                >
                                                  <div style={{ marginBottom: '4px', fontWeight: 600, color: '#2196F3' }}>
                                                    #{issue.redmine_id}
                                                  </div>
                                                  <div style={{ marginBottom: '4px', fontSize: '0.7rem', color: '#666', fontStyle: 'italic' }}>
                                                    작성자: {issue.author_name || '미지정'}
                                                  </div>
                                                  <div style={{ color: '#333' }}>
                                                    {issue.subject}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          default:
                            return null;
                        }
                      })}
                    </div>
                  </div>
                ) : '데이터 로딩 중...'
              ) : '검색 조건을 설정해주세요'
            )}
            {activeView === 'summary' && (
              selectedProducts.length > 0 ? (
                issueData ? (
                  <div style={{ width: '100%', minHeight: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
                      {issueData.blocks && issueData.blocks.map((block: any, index: number) => {
                        switch (block.type) {
                          case 'progress_summary':
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#222', fontSize: '1.2rem' }}>진행률 요약</h4>
                                
                                {/* 전체 통계와 버튼을 하나의 흰색 칸에 묶기 */}
                                {block.data.progress_data && block.data.progress_data.length > 0 && (
                                  <div style={{ 
                                    background: '#fff',
                                    borderRadius: '8px',
                                    border: '1px solid #e9ecef',
                                    marginBottom: '16px',
                                    padding: '16px'
                                  }}>
                                    {/* 전체 통계 */}
                                    <div style={{ 
                                      display: 'flex', 
                                      justifyContent: 'center', 
                                      gap: 24, 
                                      marginBottom: '16px'
                                    }}>
                                      {(() => {
                                        const totalStats = block.data.progress_data.reduce((acc: any, tracker: any) => {
                                          acc.total += tracker.total_count;
                                          acc.completed += tracker.completed_count;
                                          acc.inProgress += tracker.in_progress_count;
                                          return acc;
                                        }, { total: 0, completed: 0, inProgress: 0 });
                                        
                                        const overallCompletionRate = totalStats.total > 0 ? 
                                          Math.round((totalStats.completed / totalStats.total) * 100 * 10) / 10 : 0;
                                        
                                        return (
                                          <>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>전체</div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#28313b' }}>{totalStats.total}건</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>진행 중</div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#FF6B6B' }}>{totalStats.inProgress}건</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>완료</div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4CAF50' }}>{totalStats.completed}건</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>완료율</div>
                                              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2196F3' }}>{overallCompletionRate}%</div>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                    
                                    {/* 업무 유형별 버튼 */}
                                    <div style={{ 
                                      display: 'flex', 
                                      flexWrap: 'wrap', 
                                      gap: 8, 
                                      justifyContent: 'center'
                                    }}>
                                      {block.data.progress_data && block.data.progress_data.map((tracker: any, trackerIndex: number) => (
                                        <button
                                          key={trackerIndex}
                                          style={{
                                            padding: '6px 12px',
                                            background: selectedProgressType === tracker.tracker_name ? '#1565C0' : ['#28313b', '#b30000', '#a07000', '#008000', '#6a0dad'][trackerIndex % 5],
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            color: '#fff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                          }}
                                          onMouseEnter={(e) => {
                                            if (selectedProgressType !== tracker.tracker_name) {
                                              e.currentTarget.style.opacity = '0.8';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.opacity = '1';
                                          }}
                                          onClick={() => setSelectedProgressType(selectedProgressType === tracker.tracker_name ? null : tracker.tracker_name)}
                                        >
                                          {tracker.tracker_name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                
                                {/* 리스트 - 선택된 유형만 표시 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {block.data.progress_data && block.data.progress_data
                                    .filter((tracker: any) => !selectedProgressType || tracker.tracker_name === selectedProgressType)
                                    .map((tracker: any, trackerIndex: number) => (
                                      <div key={trackerIndex} style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        background: '#fff',
                                        borderRadius: '6px',
                                        border: '1px solid #e0e0e0'
                                      }}>
                                        <span style={{ fontWeight: 600, color: '#222', fontSize: '1rem' }}>
                                          {tracker.tracker_name}
                                        </span>
                                        <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem', color: '#555' }}>
                                          <span>진행 중: <strong style={{ color: '#FF6B6B' }}>{tracker.in_progress_count}건</strong></span>
                                          <span>완료: <strong style={{ color: '#4CAF50' }}>{tracker.completed_count}건</strong></span>
                                          <span>완료율: <strong style={{ color: '#2196F3' }}>{tracker.completion_rate}%</strong></span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            );
                          case 'type_data_list':
                            // selectedProgressType이 없으면 블록을 숨김
                            if (!selectedProgressType) {
                              return null;
                            }
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#222', fontSize: '1.2rem' }}>
                                  유형별 상세 현황 - {selectedProgressType}
                                </h4>
                                <div style={{ display: 'flex', gap: 20 }}>
                                  {/* 왼쪽: 설비군별 현황 */}
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {block.data.type_list && block.data.type_list.length > 0 ? (
                                      (() => {
                                        // selectedProgressType이 있으면 해당 유형만 필터링, 없으면 전체 표시
                                        const filteredTypeList = selectedProgressType 
                                          ? block.data.type_list.filter((typeItem: any) => typeItem.tracker_name === selectedProgressType)
                                          : block.data.type_list;
                                        
                                        if (filteredTypeList.length === 0) {
                                          return (
                                            <div style={{ 
                                              textAlign: 'center', 
                                              padding: '40px 20px', 
                                              color: '#666',
                                              background: '#fff',
                                              borderRadius: 8,
                                              border: '1px solid #e0e0e0'
                                            }}>
                                              {selectedProgressType ? `${selectedProgressType}의 상세 데이터가 없습니다.` : '상세 데이터가 없습니다.'}
                                            </div>
                                          );
                                        }
                                        
                                        return filteredTypeList.map((typeItem: any, typeIndex: number) => (
                                          <div key={typeIndex} style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'flex-start',
                                            padding: '16px 20px',
                                            background: '#fff',
                                            borderRadius: 8,
                                            border: '1px solid #e0e0e0',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                            gap: '20px',
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            overflow: 'hidden'
                                          }}>
                                            {/* 유형 이름 */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                                              <span style={{ fontWeight: 700, color: '#28313b', fontSize: '1.1rem' }}>
                                                {typeItem.tracker_name}
                                              </span>
                                              
                                              {/* 통계 정보 */}
                                              <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem', color: '#555', alignItems: 'center', marginBottom: '16px' }}>
                                                <span>전체: <strong style={{ color: '#28313b' }}>{typeItem.total_count}건</strong></span>
                                                <span>진행 중: <strong style={{ color: '#FF6B6B' }}>{typeItem.in_progress_count}건</strong></span>
                                                <span>완료: <strong style={{ color: '#4CAF50' }}>{typeItem.completed_count}건</strong></span>
                                                <span>완료율: <strong style={{ color: '#2196F3' }}>{typeItem.completion_rate}%</strong></span>
                                              </div>
                                              
                                              {/* Product 상세 정보 */}
                                              {typeItem.product_details && typeItem.product_details.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                  <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>설비군별 현황:</span>
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {typeItem.product_details.map((product: any, productIndex: number) => (
                                                      <div 
                                                        key={productIndex} 
                                                        style={{ 
                                                          padding: '12px 16px',
                                                          background: selectedProductForMembers === product.product_name ? '#e3f2fd' : '#f8f9fa',
                                                          borderRadius: 8,
                                                          border: selectedProductForMembers === product.product_name ? '2px solid #2196F3' : '1px solid #e9ecef',
                                                          width: '100%',
                                                          boxSizing: 'border-box',
                                                          wordBreak: 'break-word',
                                                          cursor: 'pointer',
                                                          transition: 'all 0.2s ease'
                                                        }}
                                                        onClick={() => setSelectedProductForMembers(selectedProductForMembers === product.product_name ? null : product.product_name)}
                                                      >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                          <span style={{ 
                                                            fontSize: '0.85rem', 
                                                            color: '#495057',
                                                            fontWeight: 600
                                                          }}>
                                                            {product.product_name}
                                                          </span>
                                                          <span style={{ 
                                                            fontSize: '0.75rem', 
                                                            color: product.completion_rate < 50 ? '#dc3545' : 
                                                                   product.completion_rate < 80 ? '#ffc107' : '#28a745',
                                                            fontWeight: 600
                                                          }}>
                                                            {product.completion_rate}%
                                                          </span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: '#666' }}>
                                                          <span>전체: <strong>{product.total_count}건</strong></span>
                                                          <span>진행 중: <strong style={{ color: '#FF6B6B' }}>{product.in_progress_count}건</strong></span>
                                                          <span>완료: <strong style={{ color: '#4CAF50' }}>{product.completed_count}건</strong></span>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ));
                                      })()
                                    ) : (
                                      <div style={{ 
                                        textAlign: 'center', 
                                        padding: '40px 20px', 
                                        color: '#666',
                                        background: '#fff',
                                        borderRadius: 8,
                                        border: '1px solid #e0e0e0'
                                      }}>
                                        데이터가 없습니다.
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* 우측: 선택된 설비의 인원별 현황 */}
                                   {selectedProductForMembers && (
                                     <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <h5 style={{ margin: '0 0 0px 0', color: '#222', fontSize: '1rem' }}>
                                         {selectedProductForMembers} 작업 인원
                                       </h5>
                                       {(() => {
                                         // 선택된 설비의 인원 정보 찾기
                                         const selectedProductData = block.data.type_list
                                           .filter((typeItem: any) => typeItem.tracker_name === selectedProgressType)
                                           .flatMap((typeItem: any) => typeItem.product_details)
                                           .find((product: any) => product.product_name === selectedProductForMembers);
                                         
                                         if (!selectedProductData || !selectedProductData.member_details) {
                                           return (
                                             <div style={{ 
                                               textAlign: 'center', 
                                               padding: '40px 20px', 
                                               color: '#666',
                                               background: '#fff',
                                               borderRadius: 8,
                                               border: '1px solid #e0e0e0'
                                             }}>
                                               인원 정보가 없습니다.
                                             </div>
                                           );
                                         }
                                         
                                         return (
                                           <div style={{ 
                                             display: 'flex', 
                                             flexWrap: 'wrap', 
                                             gap: 20,
                                             padding: '20px',
                                             background: '#fff',
                                             borderRadius: 8,
                                             border: '1px solid #e0e0e0',
                                             boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                           }}>
                                             {selectedProductData.member_details.map((member: any, memberIndex: number) => (
                                               <div 
                                                 key={memberIndex} 
                                                 style={{ 
                                                   display: 'flex',
                                                   alignItems: 'center',
                                                   padding: '12px 16px',
                                                   background: selectedMembers.includes(member.member_name) ? '#e3f2fd' : '#f8f9fa',
                                                   borderRadius: 6,
                                                   border: selectedMembers.includes(member.member_name) ? '2px solid #2196F3' : '1px solid #e9ecef',
                                                   minWidth: 'fit-content',
                                                   cursor: 'pointer',
                                                   transition: 'all 0.2s ease',
                                                   position: 'relative'
                                                 }}
                                                 onClick={(e) => {
                                                   const isCtrlPressed = e.ctrlKey || e.metaKey;
                                                   if (isCtrlPressed) {
                                                     // Ctrl 키가 눌린 경우: 다중 선택
                                                     setSelectedMembers(prev => {
                                                       if (prev.includes(member.member_name)) {
                                                         return prev.filter(name => name !== member.member_name);
                                                       } else {
                                                         return [...prev, member.member_name];
                                                       }
                                                     });
                                                   } else {
                                                     // Ctrl 키가 안 눌린 경우: 토글 선택 (이미 선택된 경우 해제)
                                                     setSelectedMembers(prev => {
                                                       if (prev.includes(member.member_name)) {
                                                         return prev.filter(name => name !== member.member_name);
                                                       } else {
                                                         return [member.member_name];
                                                       }
                                                     });
                                                   }
                                                 }}
                                                 onMouseEnter={(e) => {
                                                   // 호버 툴팁 표시
                                                   const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                                                   if (tooltip) {
                                                     tooltip.style.display = 'block';
                                                   }
                                                 }}
                                                 onMouseLeave={(e) => {
                                                   // 호버 툴팁 숨김
                                                   const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                                                   if (tooltip) {
                                                     tooltip.style.display = 'none';
                                                   }
                                                 }}
                                               >
                                                 {/* 완료율 표시 점 */}
                                                 <div style={{
                                                   width: '8px',
                                                   height: '8px',
                                                   borderRadius: '50%',
                                                   backgroundColor: member.completion_rate >= 80 ? '#28a745' : 
                                                                  member.completion_rate >= 50 ? '#ffc107' : '#dc3545',
                                                   marginRight: '8px',
                                                   flexShrink: 0
                                                 }} />
                                                 <span style={{ 
                                                   fontSize: '0.9rem', 
                                                   fontWeight: 600, 
                                                   color: '#28313b',
                                                   whiteSpace: 'nowrap'
                                                 }}>
                                                   {member.member_name}
                                                 </span>
                                                 
                                                 {/* 호버 툴팁 */}
                                                 <div 
                                                   className="tooltip"
                                                   style={{
                                                     position: 'absolute',
                                                     top: '100%',
                                                     left: '0',
                                                     background: '#333',
                                                     color: '#fff',
                                                     padding: '8px 12px',
                                                     borderRadius: '4px',
                                                     fontSize: '0.8rem',
                                                     whiteSpace: 'nowrap',
                                                     zIndex: 1000,
                                                     display: 'none',
                                                     boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                                   }}
                                                 >
                                                   <div style={{ marginBottom: '4px' }}>
                                                     완료율: <strong style={{ color: member.completion_rate < 50 ? '#ff6b6b' : 
                                                                           member.completion_rate < 80 ? '#ffd93d' : '#6bcf7f' }}>
                                                       {member.completion_rate}%
                                                     </strong>
                                                   </div>
                                                   <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
                                                     <span>전체: <strong>{member.total_count}건</strong></span>
                                                     <span>진행 중: <strong style={{ color: '#ff6b6b' }}>{member.in_progress_count}건</strong></span>
                                                     <span>완료: <strong style={{ color: '#6bcf7f' }}>{member.completed_count}건</strong></span>
                                                   </div>
                                                 </div>
                                               </div>
                                             ))}
                                           </div>
                                         );
                                       })()}
                                       <h5 style={{ margin: '30px 0 0px 0', color: '#222', fontSize: '1rem' }}>
                                         {selectedProductForMembers} 작업 목록 
                                       </h5>
                                       
                                       {/* 일감 목록 */}
                                       {(() => {
                                         // 선택된 설비의 일감 정보 찾기
                                         const selectedProductDataForIssues = block.data.type_list
                                           .filter((typeItem: any) => typeItem.tracker_name === selectedProgressType)
                                           .flatMap((typeItem: any) => typeItem.product_details)
                                           .find((product: any) => product.product_name === selectedProductForMembers);
                                         
                                         if (selectedProductDataForIssues && selectedProductDataForIssues.issue_titles) {
                                           // 선택된 인원들의 일감만 필터링
                                           let filteredIssues: any[] = [];
                                           
                                           if (selectedMembers.length > 0) {
                                             // 선택된 인원들의 일감 수집
                                             selectedMembers.forEach(memberName => {
                                               const memberData = selectedProductDataForIssues.member_details.find(
                                                 (member: any) => member.member_name === memberName
                                               );
                                               if (memberData && memberData.issues) {
                                                 filteredIssues = [...filteredIssues, ...memberData.issues];
                                               }
                                             });
                                           } else {
                                             // 선택된 인원이 없으면 전체 일감 표시
                                             filteredIssues = selectedProductDataForIssues.issue_titles.map((title: string, index: number) => ({
                                               subject: title,
                                               redmine_id: selectedProductDataForIssues.issue_numbers[index],
                                               is_closed: selectedProductDataForIssues.issue_closed_status[index]
                                             }));
                                           }
                                           
                                           return (
                                             <div style={{ 
                                               marginTop: '4px',
                                               padding: '16px',
                                               background: '#fff',
                                               borderRadius: '8px',
                                               border: '1px solid #e0e0e0'
                                             }}>
                                               <div style={{ 
                                                 display: 'flex', 
                                                 flexDirection: 'column', 
                                                 gap: '6px'
                                               }}>
                                                 {filteredIssues.map((issue: any, index: number) => (
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
                                                       gap: '8px'
                                                     }}
                                                   >
                                                     <button 
                                                       onClick={() => window.open(`https://pms.ati2000.co.kr/issues/${issue.redmine_id}`, '_blank')}
                                                       style={{
                                                         padding: '2px 6px',
                                                         background: issue.is_closed === 1 ? '#28a745' : '#dc3545',
                                                         border: '1px solid #dee2e6',
                                                         borderRadius: '3px',
                                                         fontSize: '0.7rem',
                                                         color: '#fff',
                                                         cursor: 'pointer',
                                                         flexShrink: 0,
                                                         minWidth: '40px'
                                                       }}
                                                     >
                                                       #{issue.redmine_id}
                                                     </button>
                                                     {issue.subject}
                                                   </div>
                                                 ))}
                                               </div>
                                             </div>
                                           );
                                         }
                                         return null;
                                       })()}
                                     </div>
                                   )}
                                </div>
                              </div>
                            );
                          default:
                            return null;
                        }
                      })}
                    </div>
                  </div>
                ) : '데이터 로딩 중...'
              ) : '검색 조건을 설정해주세요'
            )}
            {false && activeView === 'type' && (
              selectedProducts.length > 0 ? (
                issueData ? (
                  <div style={{ width: '100%', minHeight: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
                      {issueData.blocks && issueData.blocks.map((block: any, index: number) => {
                        switch (block.type) {
                          case 'type_data':
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 16, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 12px 0', color: '#222', fontSize: '1.2rem' }}>유형별 통계</h4>
                                <div style={{ 
                                  padding: '12px 20px',
                                  background: '#fff',
                                  borderRadius: 8,
                                  border: '1px solid #e0e0e0'
                                }}>
                                  {block.data.tracker_counts && Object.keys(block.data.tracker_counts).length > 0 ? (
                                    (() => {
                                      const trackerEntries = Object.entries(block.data.tracker_counts);
                                      const totalCount = trackerEntries.reduce((sum, [_, count]) => sum + (count as number), 0);
                                      
                                      // 전체 통계 계산 (type_data_list에서 가져오기)
                                      let overallStats = { total: 0, inProgress: 0, completed: 0, completionRate: 0 };
                                      if (issueData && issueData.blocks) {
                                        const typeDataListBlock = issueData.blocks.find((b: any) => b.type === 'type_data_list');
                                        if (typeDataListBlock && typeDataListBlock.data && typeDataListBlock.data.type_list) {
                                          overallStats = typeDataListBlock.data.type_list.reduce((acc: any, typeItem: any) => {
                                            acc.total += typeItem.total_count || 0;
                                            acc.inProgress += typeItem.in_progress_count || 0;
                                            acc.completed += typeItem.completed_count || 0;
                                            return acc;
                                          }, { total: 0, inProgress: 0, completed: 0 });
                                          overallStats.completionRate = overallStats.total > 0 ? Math.round((overallStats.completed / overallStats.total) * 100) : 0;
                                        }
                                      }
                                      
                                      // 파이 차트용 데이터 생성
                                      const pieData = trackerEntries.map(([trackerName, count]) => ({
                                        name: trackerName,
                                        value: count as number,
                                        percentage: Math.round(((count as number) / totalCount) * 100)
                                      }));
                                      
                                      // 차트 색상 배열 (4개 그룹으로 구성)
                                      const COLORS = [
                                        // 첫 번째 그룹: 블루 계열 색상 (6개)
                                        '#28313b', '#8B0000', '#B8860B', '#006400', '#4B0082', '#000000',
                                        // 두 번째 그룹: 빨강 계열 색상 (6개)
                                        '#8B0000', '#A52A2A', '#B22222', '#CD5C5C', '#DC143C', '#FF0000',
                                        // 세 번째 그룹: 초록 계열 색상 (6개)
                                        '#006400', '#228B22', '#32CD32', '#90EE90', '#98FB98', '#00FF00',
                                        // 네 번째 그룹: 노랑 계열 색상 (6개)
                                        '#B8860B', '#DAA520', '#FFD700', '#FFFF00', '#F0E68C', '#F5DEB3'
                                      ];
                                      
                                      return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                          {/* 전체 통계 */}
                                          <div style={{ 
                                            textAlign: 'center',
                                            fontSize: '1.1rem',
                                            color: '#666',
                                            marginBottom: '8px'
                                          }}>
                                            전체: <strong style={{ color: '#28313b' }}>{overallStats.total}건</strong> | 
                                            진행 중: <strong style={{ color: '#FF6B6B' }}>{overallStats.inProgress}건</strong> | 
                                            완료: <strong style={{ color: '#4CAF50' }}>{overallStats.completed}건</strong> | 
                                            완료율: <strong style={{ color: '#2196F3' }}>{overallStats.completionRate}%</strong>
                                          </div>
                                          
                                          {/* 파이 차트와 상세 리스트 */}
                                        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
                                          {/* 파이 차트 */}
                                          <div style={{ flex: 1, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <ResponsiveContainer width="100%" height={300}>
                                              <PieChart>
                                                <Pie
                                                  data={pieData}
                                                  cx="50%"
                                                  cy="50%"
                                                  labelLine={false}
                                                  label={({ percentage }) => `${percentage}%`}
                                                  outerRadius={120}
                                                  fill="#8884d8"
                                                  dataKey="value"
                                                >
                                                  {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                  ))}
                                                </Pie>
                                                <Tooltip formatter={(value, name) => [`${value}건`, name]} />
                                              </PieChart>
                                            </ResponsiveContainer>
                                          </div>
                                          
                                          {/* 상세 리스트 */}
                                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                              {trackerEntries.map(([trackerName, count], index) => (
                                                <div 
                                                  key={trackerName}
                                                  style={{
                                                    background: selectedType === trackerName ? '#1565C0' : COLORS[index % COLORS.length],
                                                    color: '#fff',
                                                    padding: '12px 16px',
                                                    borderRadius: 6,
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s ease',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                  }}
                                                  onClick={() => setSelectedType(selectedType === trackerName ? null : trackerName)}
                                                >
                                                  <span>{trackerName}</span>
                                                  <span>{count as number}건</span>
                                                </div>
                                              ))}
                                            </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div style={{ textAlign: 'center', color: '#666' }}>
                                      해당 기간에는 작업 이력이 없습니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          case 'type_data_list':
                            // 선택된 유형이 없으면 List를 숨김
                            if (!selectedType) {
                              return null;
                            }
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#222', fontSize: '1.2rem' }}>
                                  유형별 상세 현황 - {selectedType}
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {block.data.type_list && block.data.type_list.length > 0 ? (
                                    (() => {
                                      const filteredTypeList = block.data.type_list.filter((typeItem: any) => typeItem.tracker_name === selectedType);
                                      
                                      if (filteredTypeList.length === 0) {
                                        return (
                                          <div style={{ 
                                            textAlign: 'center', 
                                            padding: '40px 20px', 
                                            color: '#666',
                                            background: '#fff',
                                            borderRadius: 8,
                                            border: '1px solid #e0e0e0'
                                          }}>
                                            {selectedType}의 상세 데이터가 없습니다.
                                          </div>
                                        );
                                      }
                                      
                                                                             return filteredTypeList.map((typeItem: any, typeIndex: number) => (
                                         <div key={typeIndex} style={{ 
                                           display: 'flex', 
                                           justifyContent: 'space-between', 
                                           alignItems: 'flex-start',
                                           padding: '16px 20px',
                                           background: '#fff',
                                           borderRadius: 8,
                                           border: '1px solid #e0e0e0',
                                           boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                           gap: '20px'
                                         }}>
                                           {/* 좌측: 설비군별 현황 */}
                                           <div style={{ flex: 1 }}>
                                           {/* 유형 이름 */}
                                           <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                                             <span style={{ fontWeight: 700, color: '#28313b', fontSize: '1.1rem' }}>
                                               {typeItem.tracker_name}
                                             </span>
                                             
                                             {/* 통계 정보 */}
                                             <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem', color: '#555', alignItems: 'center', marginBottom: '16px' }}>
                                               <span>전체: <strong style={{ color: '#28313b' }}>{typeItem.total_count}건</strong></span>
                                               <span>진행 중: <strong style={{ color: '#FF6B6B' }}>{typeItem.in_progress_count}건</strong></span>
                                               <span>완료: <strong style={{ color: '#4CAF50' }}>{typeItem.completed_count}건</strong></span>
                                               <span>완료율: <strong style={{ color: '#2196F3' }}>{typeItem.completion_rate}%</strong></span>
                                             </div>
                                             
                                             {/* Product 상세 정보 */}
                                             {typeItem.product_details && typeItem.product_details.length > 0 && (
                                               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                 <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>설비군별 현황:</span>
                                                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                 {typeItem.product_details.map((product: any, productIndex: number) => (
                                                   <div 
                                                     key={productIndex} 
                                                     style={{ 
                                                       padding: '12px 16px',
                                                       background: selectedProduct === product.product_name ? '#e3f2fd' : '#f8f9fa',
                                                       borderRadius: 8,
                                                       border: selectedProduct === product.product_name ? '2px solid #2196F3' : '1px solid #e9ecef',
                                                       cursor: 'pointer',
                                                       position: 'relative',
                                                       transition: 'all 0.2s ease',
                                                       width: 'calc(100% - 4px)',
                                                       minWidth: '250px',
                                                       ...(selectedProduct === product.product_name && {
                                                         boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                                                       })
                                                     }}
                                                     onClick={() => setSelectedProduct(selectedProduct === product.product_name ? null : product.product_name)}
                                                   >
                                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                       <span style={{ 
                                                         fontSize: '0.85rem', 
                                                         color: '#495057',
                                                         fontWeight: 600
                                                       }}>
                                                         {product.product_name}
                                                       </span>
                                                       <span style={{ 
                                                         fontSize: '0.75rem', 
                                                         color: product.completion_rate < 50 ? '#dc3545' : 
                                                                product.completion_rate < 80 ? '#ffc107' : '#28a745',
                                                         fontWeight: 600
                                                       }}>
                                                         완료율: {product.completion_rate}%
                                                       </span>
                                                     </div>
                                                     <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#6c757d' }}>
                                                       <span>전체: {product.total_count}건</span>
                                                       <span>진행중: {product.in_progress_count}건</span>
                                                       <span>완료: {product.completed_count}건</span>
                                                     </div>
                                                   </div>
                                                 ))}
                                                 </div>
                                               </div>
                                             )}
                                           </div>
                                           </div>
                                           
                                           {/* 우측: 선택된 설비군의 일감 리스트 */}
                                           {selectedProduct && (
                                             <div style={{ 
                                               flex: 1, 
                                               padding: '16px',
                                               background: '#f8f9fa',
                                               borderRadius: '8px',
                                               border: '1px solid #e9ecef',
                                               alignSelf: 'flex-start',
                                               marginTop: '100px'
                                             }}>
                                               <h5 style={{ 
                                                 margin: '0 0 12px 0', 
                                                 color: '#333', 
                                                 fontSize: '1rem',
                                                 fontWeight: 600
                                               }}>
                                                 {selectedProduct} 일감 목록
                                               </h5>
                                               {(() => {
                                                 const selectedProductData = typeItem.product_details.find((p: any) => p.product_name === selectedProduct);
                                                 if (selectedProductData && selectedProductData.issue_titles) {
                                                   return (
                                                     <div style={{ 
                                                       display: 'flex', 
                                                       flexDirection: 'column', 
                                                       gap: '6px'
                                                     }}>
                                                       {selectedProductData.issue_titles.map((title: string, titleIndex: number) => (
                                                         <div 
                                                           key={titleIndex}
                                                           style={{
                                                             padding: '8px 10px',
                                                             background: '#fff',
                                                             borderRadius: '4px',
                                                             border: '1px solid #e0e0e0',
                                                             fontSize: '0.85rem',
                                                             color: '#333',
                                                             lineHeight: '1.4',
                                                             display: 'flex',
                                                             alignItems: 'center',
                                                             gap: '8px'
                                                           }}
                                                         >
                                                           <button 
                                                             onClick={() => window.open(`https://pms.ati2000.co.kr/issues/${selectedProductData.issue_numbers[titleIndex]}`, '_blank')}
                                                             style={{
                                                               padding: '2px 6px',
                                                               background: selectedProductData.issue_closed_status[titleIndex] === 1 ? '#28a745' : '#dc3545',
                                                               border: '1px solid #dee2e6',
                                                               borderRadius: '3px',
                                                               fontSize: '0.7rem',
                                                               color: '#fff',
                                                               cursor: 'pointer',
                                                               flexShrink: 0,
                                                               minWidth: '40px'
                                                             }}
                                                           >
                                                             #{selectedProductData.issue_numbers[titleIndex]}
                                                           </button>
                                                           {title}
                                           </div>
                                                       ))}
                                                     </div>
                                                   );
                                                 }
                                                 return (
                                                   <div style={{ 
                                                     textAlign: 'center', 
                                                     color: '#666', 
                                                     padding: '20px' 
                                                   }}>
                                                     일감 데이터가 없습니다.
                                                   </div>
                                                 );
                                               })()}
                                             </div>
                                           )}
                                         </div>
                                       ));
                                     })()
                                  ) : (
                                    <div style={{ 
                                      textAlign: 'center', 
                                      padding: '40px 20px', 
                                      color: '#666',
                                      background: '#fff',
                                      borderRadius: 8,
                                      border: '1px solid #e0e0e0'
                                    }}>
                                      해당 기간에 유형별 상세 데이터가 없습니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          default:
                            return null;
                        }
                      })}
                    </div>
                  </div>
                ) : '데이터 로딩 중...'
              ) : '검색 조건을 설정해주세요'
            )}
            {activeView === 'member' && (
              selectedProducts.length > 0 ? (
                issueData ? (
                  <div style={{ width: '100%', minHeight: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
                      {issueData.blocks && issueData.blocks.map((block: any, index: number) => {
                        switch (block.type) {
                          case 'best_member_summary':
                            return (
                                                      <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                          <h4 style={{ margin: '0 0 16px 0', color: '#222', fontSize: '1.2rem' }}>BEST 작업자</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {block.data && block.data.length > 0 ? (
                                    <div style={{ 
                                      display: 'flex', 
                                      flexWrap: 'wrap', 
                                      gap: 12,
                                      padding: '16px 20px',
                                      background: '#fff',
                                      borderRadius: 8,
                                      border: '1px solid #e0e0e0'
                                    }}>
                                      {block.data.map((summary: any, summaryIndex: number) => (
                                        <div 
                                          key={summaryIndex} 
                                          style={{
                                            background: selectedAuthor === summary.author ? '#1565C0' : '#28313b',
                                            color: '#fff',
                                            padding: '8px 16px',
                                            borderRadius: 6,
                                            fontWeight: 600,
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s ease'
                                          }}
                                          onClick={() => setSelectedAuthor(selectedAuthor === summary.author ? null : summary.author)}
                                        >
                                          {summary.author} {summary.count}건
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ 
                                      textAlign: 'center', 
                                      padding: '40px 20px', 
                                      color: '#666',
                                      background: '#fff',
                                      borderRadius: 8,
                                      border: '1px solid #e0e0e0'
                                    }}>
                                      해당 기간에 [AE]BEST 작업이 없습니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          case 'best_member_data':
                            // BEST 작업자가 선택되지 않았으면 List를 숨김
                            if (!selectedAuthor) {
                              return null;
                            }
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#222', fontSize: '1.2rem' }}>
                                  BEST 작업 List - {selectedAuthor}
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {(() => {
                                    const filteredData = block.data.filter((member: any) => member.author === selectedAuthor);
                                    
                                    if (filteredData && filteredData.length > 0) {
                                      return filteredData.map((member: any, memberIndex: number) => (
                                        <div key={memberIndex} style={{ 
                                          display: 'flex', 
                                          justifyContent: 'space-between', 
                                          alignItems: 'center',
                                          padding: '16px 20px',
                                          background: '#fff',
                                          borderRadius: 8,
                                          border: '1px solid #e0e0e0',
                                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                                          <span style={{ fontWeight: 700, color: '#28313b', fontSize: '1.1rem' }}>
                                              {member.author}
                                            </span>
                                              <span style={{ color: '#666', fontSize: '0.9rem' }}>
                                                {member.product}
                                              </span>
                                            </div>
                                            <div style={{ color: '#333', fontSize: '0.95rem', marginTop: 4 }}>
                                              {member.subject}
                                            </div>
                                          </div>
                                          <div 
                                            style={{ 
                                              background: '#28313b', 
                                              color: '#fff', 
                                              padding: '8px 12px', 
                                              borderRadius: 6,
                                              fontWeight: 600,
                                              fontSize: '0.9rem',
                                              cursor: 'pointer',
                                              transition: 'background-color 0.2s ease'
                                            }}
                                            onClick={() => {
                                              // Redmine URL 구성
                                              const redmineUrl = `https://pms.ati2000.co.kr/issues/${member.issue_id}`;
                                              window.open(redmineUrl, '_blank');
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = '#1565C0';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = '#28313b';
                                            }}
                                          >
                                            #{member.issue_id}
                                          </div>
                                        </div>
                                      ));
                                    } else {
                                      return (
                                        <div style={{ 
                                          textAlign: 'center', 
                                          padding: '40px 20px', 
                                          color: '#666',
                                          background: '#fff',
                                          borderRadius: 8,
                                          border: '1px solid #e0e0e0'
                                        }}>
                                          {selectedAuthor}의 BEST 작업이 없습니다.
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            );
                          case 'member_issue_type':
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                  <h4 style={{ margin: 0, color: '#222', fontSize: '1.2rem' }}>작업자별 이슈 유형</h4>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      onClick={() => setMemberSortBy('total')}
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        borderRadius: 6,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: memberSortBy === 'total' ? '#28313b' : '#e5e8ef',
                                        color: memberSortBy === 'total' ? '#fff' : '#222',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      작업 개수
                                    </button>
                                    <button
                                      onClick={() => setMemberSortBy('completion')}
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        borderRadius: 6,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: memberSortBy === 'completion' ? '#28313b' : '#e5e8ef',
                                        color: memberSortBy === 'completion' ? '#fff' : '#222',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      완료율
                                    </button>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {block.data && block.data.length > 0 ? (
                                    sortMemberData(block.data, memberSortBy).map((member: any, memberIndex: number) => (
                                      <div key={memberIndex} style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        padding: '16px 20px',
                                        background: '#fff',
                                        borderRadius: 8,
                                        border: '1px solid #e0e0e0',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                        position: 'relative'
                                      }}>
                                        {/* 작업자 이름 */}
                                        <span style={{ fontWeight: 700, color: '#28313b', fontSize: '1.1rem' }}>
                                          {member.worker}
                                        </span>
                                        
                                        {/* 통계 정보 */}
                                        <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem', color: '#555' }}>
                                          <span>전체: <strong style={{ color: '#28313b' }}>{member.total_tasks}건</strong></span>
                                          
                                          {/* 진행 중 - 호버 툴팁 */}
                                          <span 
                                            style={{ 
                                              cursor: 'pointer',
                                              position: 'relative'
                                            }}
                                            onMouseEnter={(e) => {
                                              const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                                              if (tooltip) tooltip.style.display = 'block';
                                            }}
                                            onMouseLeave={(e) => {
                                              const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                                              if (tooltip) tooltip.style.display = 'none';
                                            }}
                                          >
                                            진행 중: <strong style={{ color: '#FF6B6B' }}>{member.in_progress_tasks}건</strong>
                                            <div className="tooltip" style={{
                                              position: 'absolute',
                                              top: '100%',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              background: '#fff',
                                              color: '#333',
                                              padding: '12px 16px',
                                              borderRadius: '8px',
                                              fontSize: '0.85rem',
                                              whiteSpace: 'nowrap',
                                              zIndex: 1000,
                                              display: 'none',
                                              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                              border: '1px solid #000',
                                              marginTop: '8px'
                                            }}>
                                              <div style={{ fontWeight: 600, marginBottom: '8px', color: '#FF6B6B' }}>진행 중 작업 유형:</div>
                                              <div dangerouslySetInnerHTML={{ __html: member.in_progress_types }} />
                                              <div style={{
                                                position: 'absolute',
                                                bottom: '100%',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: 0,
                                                height: 0,
                                                borderLeft: '8px solid transparent',
                                                borderRight: '8px solid transparent',
                                                borderBottom: '8px solid #000'
                                              }}></div>
                                            </div>
                                          </span>
                                          
                                          {/* 완료 - 호버 툴팁 */}
                                          <span 
                                            style={{ 
                                              cursor: 'pointer',
                                              position: 'relative'
                                            }}
                                            onMouseEnter={(e) => {
                                              const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                                              if (tooltip) tooltip.style.display = 'block';
                                            }}
                                            onMouseLeave={(e) => {
                                              const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                                              if (tooltip) tooltip.style.display = 'none';
                                            }}
                                          >
                                            완료: <strong style={{ color: '#4CAF50' }}>{member.completed_tasks}건</strong>
                                            <div className="tooltip" style={{
                                              position: 'absolute',
                                              top: '100%',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              background: '#fff',
                                              color: '#333',
                                              padding: '12px 16px',
                                              borderRadius: '8px',
                                              fontSize: '0.85rem',
                                              whiteSpace: 'nowrap',
                                              zIndex: 1000,
                                              display: 'none',
                                              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                              border: '1px solid #000',
                                              marginTop: '8px'
                                            }}>
                                              <div style={{ fontWeight: 600, marginBottom: '8px', color: '#4CAF50' }}>완료 작업 유형:</div>
                                              <div dangerouslySetInnerHTML={{ __html: member.completed_types }} />
                                              <div style={{
                                                position: 'absolute',
                                                bottom: '100%',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: 0,
                                                height: 0,
                                                borderLeft: '8px solid transparent',
                                                borderRight: '8px solid transparent',
                                                borderBottom: '8px solid #000'
                                              }}></div>
                                            </div>
                                          </span>
                                          
                                          <span>완료율: <strong style={{ color: '#2196F3' }}>{member.completion_rate}%</strong></span>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={{ 
                                      textAlign: 'center', 
                                      padding: '40px 20px', 
                                      color: '#666',
                                      background: '#fff',
                                      borderRadius: 8,
                                      border: '1px solid #e0e0e0'
                                    }}>
                                      해당 기간에 작업자별 이슈 유형 데이터가 없습니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          default:
                            return null;
                        }
                      })}
                    </div>
                  </div>
                ) : '데이터 로딩 중...'
              ) : '검색 조건을 설정해주세요'
            )}
            {activeView === 'hw' && (
              selectedProducts.length > 0 ? 'HW 분석 내용이 여기에 표시됩니다.' : '검색 조건을 설정해주세요'
            )}
            {activeView === 'sw' && (
              selectedProducts.length > 0 ? 'SW 분석 내용이 여기에 표시됩니다.' : '검색 조건을 설정해주세요'
            )}
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
              padding: '24px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
