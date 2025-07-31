import Layout from './Layout';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const VIEW_TABS = [
  { key: 'summary', label: 'summary' },
  { key: 'progress', label: 'progress' },
  { key: 'type', label: 'type' },
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

  // 고객사 프로젝트 목록 가져오기 (SITE 버튼용)
  const fetchCustomerProjects = async () => {
    try {
      const response = await fetch('/api/issues/site');
      if (response.ok) {
        const data = await response.json();
        setCustomerProjects(data.projects || []);
        // 첫 번째 고객사 자동 선택 해제
        // if (data.projects && data.projects.length > 0) {
        //   const firstCustomer = data.projects[0];
        //   setSelectedSite(firstCustomer.project_name);
        // }
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
          end_date: dateTo,
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
          end_date: dateTo,
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
          end_date: dateTo,
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
          end_date: dateTo,
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
          end_date: dateTo,
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
          end_date: dateTo,
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

  // 페이지 로드 시 고객사 목록 가져오기
  useEffect(() => {
    fetchCustomerProjects();
  }, []);

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
              selectedProducts.length > 0 ? '진행율 분석 내용이 여기에 표시됩니다.' : '검색 조건을 설정해주세요'
            )}
            {activeView === 'summary' && (
              selectedProducts.length > 0 ? (
                issueData ? (
                  <div style={{ width: '100%', minHeight: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
                      {/* 블럭들을 순서대로 렌더링 */}
                      {issueData.blocks && issueData.blocks.map((block: any, index: number) => {
                        switch(block.type) {
                          case 'overall_status':
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 12px 0', color: '#222' }}>전체 이슈 현황</h4>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#28313b', marginBottom: 12 }}>
                                  {block.data.total_issues}건
                                </div>
                                <div style={{ display: 'flex', gap: 24, fontSize: '1rem', color: '#555', marginBottom: 12 }}>
                                  <span><strong>진행 중 일감:</strong> <strong style={{ color: '#FF6B6B' }}>{block.data.in_progress_count}건</strong></span>
                                  <span><strong>완료된 일감:</strong> <strong style={{ color: '#4CAF50' }}>{block.data.completed_count}건</strong></span>
                                  <span><strong>완료율:</strong> <strong style={{ color: '#2196F3' }}>{block.data.completion_rate}%</strong></span>
                                </div>
                                {block.data.tracker_text && (
                                  <div style={{ fontSize: '1rem', color: '#555' }}>
                                    <div style={{ fontWeight: 600, marginBottom: 8 }}>유형별 일감</div>
                                    <div dangerouslySetInnerHTML={{ __html: block.data.tracker_text }} />
                                  </div>
                                )}
                              </div>
                            );
                          case 'problematic_products':
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 12px 0', color: '#222' }}>가장 문제가 많이 발생한 설비군 Top 3</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {block.data.map((product: any, productIndex: number) => (
                                    <div key={productIndex} style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center',
                                      padding: '12px 16px',
                                      background: '#fff',
                                      borderRadius: 6,
                                      border: '1px solid #e0e0e0'
                                    }}>
                                      <span style={{ fontWeight: 600, color: '#222' }}>
                                        {product.product}
                                      </span>
                                      <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem', color: '#555' }}>
                                        <span>진행 중: <strong style={{ color: '#FF6B6B' }}>{product.in_progress}건</strong></span>
                                        <span>완료: <strong style={{ color: '#4CAF50' }}>{product.completed}건</strong></span>
                                        <span>완료율: <strong style={{ color: '#2196F3' }}>{product.completion_rate}%</strong></span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          case 'problematic_sites':
                            return (
                              <div key={index} style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                                <h4 style={{ margin: '0 0 12px 0', color: '#222' }}>Site 별 작업 현황</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {block.data.map((site: any, siteIndex: number) => (
                                    <div key={siteIndex} style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center',
                                      padding: '12px 16px',
                                      background: '#fff',
                                      borderRadius: 6,
                                      border: '1px solid #e0e0e0',
                                      cursor: 'pointer',
                                      position: 'relative'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (site.tooltip) {
                                        const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                                        if (tooltip) tooltip.style.display = 'block';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      const tooltip = e.currentTarget.querySelector('.tooltip') as HTMLElement;
                                      if (tooltip) tooltip.style.display = 'none';
                                    }}
                                    >
                                      <span style={{ fontWeight: 600, color: '#222' }}>
                                        {site.site}
                                      </span>
                                      <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem', color: '#555' }}>
                                        <span>진행 중: <strong style={{ color: '#FF6B6B' }}>{site.in_progress}건</strong></span>
                                        <span>완료: <strong style={{ color: '#4CAF50' }}>{site.completed}건</strong></span>
                                        <span>완료율: <strong style={{ color: '#2196F3' }}>{site.completion_rate}%</strong></span>
                                      </div>
                                      
                                      {/* 툴팁 */}
                                      {site.tooltip && (
                                        <div className="tooltip" style={{
                                          position: 'fixed',
                                          top: '150px',
                                          right: 'calc(30vw)',
                                          background: '#333',
                                          color: '#fff',
                                          padding: '16px 20px',
                                          borderRadius: '8px',
                                          fontSize: '0.9rem',
                                          maxWidth: '1200px',
                                          minWidth: '800px',
                                          zIndex: 1000,
                                          display: 'none',
                                          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                          border: '1px solid #555'
                                        }}>
                                          <div dangerouslySetInnerHTML={{ __html: site.tooltip }} />
                                          <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            width: 0,
                                            height: 0,
                                            borderLeft: '8px solid transparent',
                                            borderRight: '8px solid transparent',
                                            borderTop: '8px solid #333'
                                          }}></div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
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
            {activeView === 'type' && (
              selectedProducts.length > 0 ? '유형 분석 내용이 여기에 표시됩니다.' : '검색 조건을 설정해주세요'
            )}
            {activeView === 'member' && (
              selectedProducts.length > 0 ? '인원 분석 내용이 여기에 표시됩니다.' : '검색 조건을 설정해주세요'
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
    </Layout>
  );
}
