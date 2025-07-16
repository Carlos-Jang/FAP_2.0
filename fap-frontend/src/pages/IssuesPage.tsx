import Layout from './Layout';
import { useState, useEffect } from 'react';

const VIEW_TABS = [
  { key: 'issue', label: '이슈 현황' },
  { key: 'progress', label: '진행 상황' },
  { key: 'work', label: '업무 분석' },
  { key: 'member', label: '인원 분석' },
];

// SITE 버튼 정보 선언
const SITE_BUTTONS = [
  { name: 'Samsung', identifier: 'samsung' },
  { name: 'Hynix', identifier: 'hynix' },
];

// 하위 프로젝트 이름에서 괄호와 괄호 안의 내용을 제거하는 함수
const getDisplayName = (name: string) => name.replace(/\s*\(.*?\)/g, '').trim();

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
  const [selectedSite, setSelectedSite] = useState<string>('samsung');
  const [subProjects, setSubProjects] = useState<any[]>([]);
  const [selectedSubProject, setSelectedSubProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [productGroups, setProductGroups] = useState<string[]>([]);
  const [selectedProductGroup, setSelectedProductGroup] = useState<string>('all');

  // SITE 버튼 클릭 핸들러
  const handleSiteClick = async (siteIdentifier: string) => {
    setSelectedSite(siteIdentifier);
    setSelectedSubProject('all');
    setLoading(true);
    
    try {
      // 하위 프로젝트 리스트 가져오기 (백엔드 캐시 사용)
      const response = await fetch(`/api/projects/sub-projects/${siteIdentifier}`);
      if (response.ok) {
        const data = await response.json();
        setSubProjects(data.projects || []);
      } else {
        setSubProjects([]);
        console.error('하위 프로젝트 조회 실패');
      }
    } catch (error) {
      setSubProjects([]);
      console.error('API 호출 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 페이지 로드 시 Samsung의 하위 프로젝트 자동 로드
  useEffect(() => {
    handleSiteClick('samsung');
    setSelectedSubProject('all');
  }, []);

  // 세부 위치(하위 프로젝트) 선택 시 설비군 리스트 받아오기 (백엔드 캐시 사용)
  useEffect(() => {
    if (selectedSubProject && selectedSubProject !== 'all') {
      // 백엔드에서 캐시된 Product 리스트 요청
        fetch(`/api/projects/product-list/${selectedSubProject}`)
          .then(res => res.json())
          .then(data => {
            setProductGroups(data.products || []);
          setSelectedProductGroup('all');
        })
        .catch(error => {
          console.error('Product 리스트 조회 오류:', error);
          setProductGroups([]);
          setSelectedProductGroup('all');
        });
    } else if (selectedSubProject === 'all') {
      // ALL 선택 시 현재 SITE의 모든 하위 프로젝트의 Product를 합쳐서 중복 없이 보여줌
      if (subProjects.length > 0) {
        const fetchAllProducts = async () => {
          try {
            const allProductPromises = subProjects.map(project => 
              fetch(`/api/projects/product-list/${project.id}`)
                .then(res => res.json())
                .then(data => data.products || [])
                .catch(() => [])
            );
            
            const allProductResults = await Promise.all(allProductPromises);
            const allProducts = [...new Set(allProductResults.flat())];
            setProductGroups(allProducts);
            setSelectedProductGroup('all');
          } catch (error) {
            console.error('전체 Product 리스트 조회 오류:', error);
            setProductGroups([]);
            setSelectedProductGroup('all');
          }
        };
        
        fetchAllProducts();
      } else {
        setProductGroups([]);
        setSelectedProductGroup('all');
      }
    } else {
      setProductGroups([]);
      setSelectedProductGroup('all');
    }
  }, [selectedSubProject, subProjects]);

  return (
    <Layout>
      <div style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: 32 }}>
        {/* 좌측 대시보드 메뉴/필터 */}
        <div style={{ width: 500, minWidth: 400, background: '#f7f9fc', borderRadius: 8, boxShadow: 'var(--color-shadow)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
          {/* 기간 선택 */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#222' }}>Search Date</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: '1rem', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 6, width: 120 }} max={dateTo} />
              <span style={{ color: '#222', fontWeight: 600, fontSize: '1.1rem' }}>~</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ fontSize: '1rem', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 6, width: 120 }} min={dateFrom} />
            </div>
          </div>

          {/* Site & 세부 위치(하위 프로젝트) & 설비군 버튼 가로 배치 */}
          {/* 라벨(헤더) 영역 */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 16, marginBottom: 4 }}>
            <div style={{ minWidth: 140, fontWeight: 700, fontSize: '1.08rem', color: '#222', marginLeft: 2 }}>SITE</div>
            <div style={{ minWidth: 140 }}></div>
            <div style={{ minWidth: 140, fontWeight: 700, fontSize: '1.08rem', color: '#222', marginLeft: 25 }}>Product</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: 16, minHeight: 0 }}>
            {/* Site 컬럼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 140 }}>
              {SITE_BUTTONS.map(site => (
                <button
                  key={site.identifier}
                  onClick={() => handleSiteClick(site.identifier)}
                  style={{
                    width: '140px',
                    height: '48px',
                    fontWeight: 700,
                    fontSize: '1.08rem',
                    padding: '0 16px',
                    borderRadius: 6,
                    background: selectedSite === site.identifier ? '#28313b' : '#e5e8ef',
                    color: selectedSite === site.identifier ? '#fff' : '#222',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'none',
                    outline: 'none',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start'
                  }}
                >
                  {site.name}
                </button>
              ))}
            </div>
            {/* 세부 위치(하위 프로젝트) 컬럼 스크롤 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 140, flex: 1, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
              {/* ALL 버튼 */}
              <button
                key="all"
                onClick={() => setSelectedSubProject('all')}
                style={{
                  width: '140px',
                  height: '48px',
                  fontWeight: 700,
                  fontSize: '1.08rem',
                  padding: '0 16px',
                  borderRadius: 6,
                  background: selectedSubProject === 'all' ? '#28313b' : '#e5e8ef',
                  color: selectedSubProject === 'all' ? '#fff' : '#222',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: 'none',
                  outline: 'none',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start'
                }}
              >
                ALL
              </button>
              {subProjects.map(project => (
                <button
                  key={project.id}
                  onClick={() => setSelectedSubProject(project.id.toString())}
                  style={{
                    width: '140px',
                    height: '48px',
                    fontWeight: 700,
                    fontSize: '1.08rem',
                    padding: '0 16px',
                    borderRadius: 6,
                    background: selectedSubProject === project.id.toString() ? '#28313b' : '#e5e8ef',
                    color: selectedSubProject === project.id.toString() ? '#fff' : '#222',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'none',
                    outline: 'none',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start'
                  }}
                >
                  {getDisplayName(project.name)}
                </button>
              ))}
            </div>
            {/* 설비군(Equipment Group) 컬럼 스크롤 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' ,gap: 12, minWidth: 140, flex: 1, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', marginLeft: 0 }}>
              {productGroups.length > 0 && (
                <>
                  <button
                    key="product-all"
                    onClick={() => setSelectedProductGroup('all')}
                    style={{
                      width: '140px',
                      height: '48px',
                      fontWeight: 700,
                      fontSize: '1.08rem',
                      padding: '0 16px',
                      borderRadius: 6,
                      background: selectedProductGroup === 'all' ? '#28313b' : '#e5e8ef',
                      color: selectedProductGroup === 'all' ? '#fff' : '#222',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: 'none',
                      outline: 'none',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start'
                    }}
                  >
                    ALL
                  </button>
                  {productGroups.map(pg => (
                    <button
                      key={pg}
                      onClick={() => setSelectedProductGroup(pg)}
                      style={{
                        width: '140px',
                        height: '48px',
                        fontWeight: 700,
                        fontSize: '1.08rem',
                        padding: '0 16px',
                        borderRadius: 6,
                        background: selectedProductGroup === pg ? '#28313b' : '#e5e8ef',
                        color: selectedProductGroup === pg ? '#fff' : '#222',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: 'none',
                        outline: 'none',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start'
                      }}
                    >
                      {pg}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* 로딩 표시 */}
          {loading && (
            <div style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
              하위 프로젝트 로딩 중...
            </div>
          )}
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
                  padding: '10px 24px',
                  borderRadius: 6,
                  background: activeView === tab.key ? '#28313b' : '#e5e8ef',
                  color: activeView === tab.key ? '#fff' : '#222',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: 'none',
                  outline: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
