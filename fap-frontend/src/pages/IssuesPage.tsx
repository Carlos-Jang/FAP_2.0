import Layout from './Layout';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const VIEW_TABS = [
  { key: 'summary', label: 'summary' },
  { key: 'progress', label: '일감 요약' },
  { key: 'work', label: '업무 분석' },
  { key: 'member', label: '인원 분석' },
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
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedSiteIndex, setSelectedSiteIndex] = useState<number>(-1);
  const [subProjects, setSubProjects] = useState<CustomerProject[]>([]);
  const [selectedSubSite, setSelectedSubSite] = useState<string>('');
  const [productList, setProductList] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
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

  // SITE 버튼 클릭 핸들러
  const handleSiteClick = async (siteName: string, siteIndex: number) => {
    setSelectedSite(siteName);
    setSelectedSiteIndex(siteIndex);
    setSelectedSubSite('');
    setProductList([]);
    setSelectedProduct('');
    setIssueData(null);
    
    try {
      const response = await fetch(`/api/issues/sub-site?site_index=${siteIndex}`);
      if (response.ok) {
        const data = await response.json();
        setSubProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Sub Site 조회 오류:', error);
      setSubProjects([]);
    }
  };

  // Sub Site 버튼 클릭 핸들러
  const handleSubSiteClick = async (subSiteName: string) => {
    setSelectedSubSite(subSiteName);
    setProductList([]);
    setSelectedProduct('');
    setIssueData(null);
    
    if (subSiteName === 'ALL') {
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
      return;
    }
    
    try {
      const response = await fetch(`/api/issues/product-list?sub_project_name=${subSiteName}`);
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
  };

  // Product List 선택 핸들러
  const handleProductClick = async (productName: string) => {
    setSelectedProduct(productName);
    setIssueData(null); // 새 데이터 로드 전에 초기화
    
    // 현재 활성 탭에 따라 데이터 로드
    if (activeView === 'progress') {
      await loadIssueStatusData(productName);
    } else if (activeView === 'summary') {
      await loadSummaryReportData(productName);
    }
    // 다른 탭들도 나중에 추가
  };

  // 이슈 현황 데이터 로드
  const loadIssueStatusData = async (productName: string) => {
    try {
      const response = await fetch('/api/issues/get-issue-status-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: dateTo,
          site_index: selectedSiteIndex,
          sub_site_name: selectedSubSite,
          product_name: productName
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIssueData(data.data);
        }
      }
    } catch (error) {
      console.error('이슈 현황 데이터 로드 오류:', error);
    }
  };

  // 주간 업무보고 데이터 로드
  const loadSummaryReportData = async (productName: string) => {
    try {
      const response = await fetch('/api/issues/get-summary-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: dateTo,
          site_index: selectedSiteIndex,
          sub_site_name: selectedSubSite,
          product_name: productName
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
                        onClick={() => handleSiteClick(customer.project_name, index)}
                        style={{
                          width: '100%',
                          height: '48px',
                          fontWeight: 700,
                          fontSize: '1.08rem',
                          padding: '0 16px',
                          borderRadius: 6,
                          background: selectedSite === customer.project_name ? '#28313b' : '#e5e8ef',
                          color: selectedSite === customer.project_name ? '#fff' : '#222',
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
                          onClick={() => handleSubSiteClick(subProject.project_name)}
                          style={{
                            width: '100%',
                            height: '48px',
                            fontWeight: 700,
                            fontSize: '1.08rem',
                            padding: '0 16px',
                            borderRadius: 6,
                            background: selectedSubSite === subProject.project_name ? '#28313b' : '#e5e8ef',
                            color: selectedSubSite === subProject.project_name ? '#fff' : '#222',
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
                          onClick={() => handleProductClick(product.name)}
                          style={{
                            width: '100%',
                            height: '48px',
                            fontWeight: 700,
                            fontSize: '1.08rem',
                            padding: '0 16px',
                            borderRadius: 6,
                            background: selectedProduct === product.name ? '#28313b' : '#e5e8ef',
                            color: selectedProduct === product.name ? '#fff' : '#222',
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
                  if (selectedProduct && tab.key === 'progress') {
                    setIssueData(null); // 데이터 초기화
                    await loadIssueStatusData(selectedProduct);
                  } else if (selectedProduct && tab.key === 'summary') {
                    setIssueData(null); // 데이터 초기화
                    await loadSummaryReportData(selectedProduct);
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '1.1rem' }}>
            {activeView === 'progress' && (
              selectedProduct ? (
                issueData ? (
                  <div style={{ width: '100%', height: '100%' }}>
                    <h3>이슈 현황 - Tracker별 분포</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={Object.entries(issueData.tracker_counts).map(([name, count]) => ({ name, count }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          interval={0}
                        />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#28313b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : '데이터 로딩 중...'
              ) : '검색 조건을 설정해주세요'
            )}
            {activeView === 'summary' && (
              selectedProduct ? (
                issueData ? (
                  <div style={{ width: '100%', height: '100%' }}>
                    <h3>주간 업무보고 요약</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      {/* 전체 이슈 개수 */}
                      <div style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#222' }}>전체 이슈 현황</h4>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#28313b' }}>
                          {issueData.total_issues}건
                        </div>
                      </div>
                      
                      {/* 상태별 요약 */}
                      <div style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#222' }}>상태별 분포</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Object.entries(issueData.status_summary).map(([status, count]) => (
                            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#555' }}>{status}</span>
                              <span style={{ fontWeight: 600, color: '#28313b' }}>{count as number}건</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 우선순위별 요약 */}
                      <div style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#222' }}>우선순위별 분포</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Object.entries(issueData.priority_summary).map(([priority, count]) => (
                            <div key={priority} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#555' }}>{priority}</span>
                              <span style={{ fontWeight: 600, color: '#28313b' }}>{count as number}건</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 담당자별 요약 */}
                      <div style={{ background: '#f7f9fc', padding: 20, borderRadius: 8 }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#222' }}>담당자별 분포</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Object.entries(issueData.assignee_summary).map(([assignee, count]) => (
                            <div key={assignee} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#555' }}>{assignee}</span>
                              <span style={{ fontWeight: 600, color: '#28313b' }}>{count as number}건</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : '데이터 로딩 중...'
              ) : '검색 조건을 설정해주세요'
            )}
            {activeView === 'work' && (
              selectedProduct ? '업무 분석 내용이 여기에 표시됩니다.' : '검색 조건을 설정해주세요'
            )}
            {activeView === 'member' && (
              selectedProduct ? '인원 분석 내용이 여기에 표시됩니다.' : '검색 조건을 설정해주세요'
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
