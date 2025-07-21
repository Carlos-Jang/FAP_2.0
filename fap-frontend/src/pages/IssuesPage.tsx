import Layout from './Layout';
import { useState, useEffect } from 'react';

const VIEW_TABS = [
  { key: 'issue', label: '이슈 현황' },
  { key: 'progress', label: '진행 상황' },
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
  const [activeView, setActiveView] = useState('issue');
  const [customerProjects, setCustomerProjects] = useState<CustomerProject[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [subProjects, setSubProjects] = useState<CustomerProject[]>([]);
  const [selectedSubSite, setSelectedSubSite] = useState<string>('');
  const [productList, setProductList] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  // 고객사 프로젝트 목록 가져오기 (SITE 버튼용)
  const fetchCustomerProjects = async () => {
    try {
      const response = await fetch('/api/issues/site');
      if (response.ok) {
        const data = await response.json();
        setCustomerProjects(data.projects || []);
        // 첫 번째 고객사 자동 선택
        if (data.projects && data.projects.length > 0) {
          const firstCustomer = data.projects[0];
          setSelectedSite(firstCustomer.project_name);
        }
      }
    } catch (error) {
      console.error('고객사 프로젝트 조회 오류:', error);
    }
  };

  // SITE 버튼 클릭 핸들러
  const handleSiteClick = async (siteName: string, siteIndex: number) => {
    setSelectedSite(siteName);
    setSelectedSubSite('');
    setProductList([]);
    setSelectedProduct('');
    
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
                          onClick={() => setSelectedProduct(product.name)}
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
                onClick={() => setActiveView(tab.key)}
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
            {activeView === 'issue' && '이슈 현황 내용이 여기에 표시됩니다.'}
            {activeView === 'progress' && '진행 상황 내용이 여기에 표시됩니다.'}
            {activeView === 'work' && '업무 분석 내용이 여기에 표시됩니다.'}
            {activeView === 'member' && '인원 분석 내용이 여기에 표시됩니다.'}
          </div>
        </div>
      </div>
    </Layout>
  );
}
