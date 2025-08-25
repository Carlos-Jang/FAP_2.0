/**
 * FAP 2.0 - 시스템 설정 페이지 (프론트엔드)
 * 
 * 핵심 역할:
 * - FAP 2.0의 시스템 관리 및 설정을 담당하는 관리자 페이지
 * - 사용자 인증 및 보안 관리의 핵심 인터페이스
 * - 레드마인 데이터 동기화 관리 및 제어
 * - 시스템 전반의 설정 및 구성 관리 UI
 * 
 * 주요 기능:
 * - 개인 API 키 관리: 레드마인 API 키 입력/저장 (암호화)
 * - 데이터 동기화 제어: 일감, 프로젝트, 이슈 상태 목록 동기화
 * - 권한 기반 접근: 관리자만 시스템 동기화 기능 접근 가능
 * - 보안 관리: API 키 저장 후 자동 로그아웃 처리
 * - 반응형 UI: PC 환경에서만 접근 가능 (모바일 차단)
 * 
 * API 연동:
 * - /api/settings/save-user-api-key: 개인 API 키 저장
 * - /api/settings/sync-projects: 프로젝트 데이터 동기화
 * - /api/settings/sync-issues: 일감 데이터 동기화
 * - /api/settings/sync-statuses: 이슈 상태 목록 동기화
 * 
 * 사용자 흐름:
 * 1. 사용자가 개인 API 키 입력 및 저장
 * 2. 저장 성공 시 자동 로그아웃 및 로그인 페이지 이동
 * 3. 관리자 권한 시: 데이터 동기화 기능 접근 가능
 * 4. 동기화 실행 시 백엔드 API 호출하여 데이터 업데이트
 * 
 * 보안 특징:
 * - API 키 암호화 저장 및 안전한 관리
 * - 관리자 권한 검증 (localStorage 기반)
 * - 저장 후 즉시 세션 클리어로 보안 강화
 * - 모바일 환경 차단으로 관리자 전용 접근
 * 
 * UI 특징:
 * - 깔끔하고 직관적인 관리자 인터페이스
 * - 동기화 진행 상황 실시간 피드백
 * - 반응형 디자인 (PC 전용)
 * - 사용자 친화적인 알림 메시지
 */

import Layout from './Layout';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

// Product 타입 정의
interface Product {
  name: string;
}

export default function SettingPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [projectLimit, setProjectLimit] = useState(1000);
  const [issueLimit, setIssueLimit] = useState(10000);
  
  // Product List 관련 상태
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // 초기 로드 - Product List 가져오기
  useEffect(() => {
    fetchAllProducts();
  }, []);

  // Product 목록 로드 후 사용자 설정 불러오기
  useEffect(() => {
    if (allProducts.length > 0) {
      loadUserProductSettings();
    }
  }, [allProducts]);

  // 모든 Product 목록 가져오기
  const fetchAllProducts = async () => {
    try {
      setLoadingProducts(true);
      
      // 1. 모든 SITE 가져오기
      const siteResponse = await fetch('/fap/api/issues/site');
      if (!siteResponse.ok) {
        throw new Error('SITE 목록 조회 실패');
      }
      
      const siteData = await siteResponse.json();
      const allProductsSet = new Set<string>(); // 중복 제거를 위한 Set
      
      // 2. 각 SITE별로 Sub Site와 Product 수집
      for (let siteIndex = 0; siteIndex < siteData.projects.length; siteIndex++) {
        try {
          // Sub Site 목록 가져오기
          const subSiteResponse = await fetch(`/fap/api/issues/sub-site?site_index=${siteIndex}`);
          if (subSiteResponse.ok) {
            const subSiteData = await subSiteResponse.json();
            
            // 각 Sub Site별로 Product 목록 가져오기
            for (const subSite of subSiteData.projects) {
              if (subSite.project_name === 'ALL') continue; // ALL은 건너뛰기
              
              try {
                const productResponse = await fetch(`/fap/api/issues/product-list?sub_project_name=${subSite.project_name}`);
                if (productResponse.ok) {
                  const productData = await productResponse.json();
                  if (productData.success && productData.product_list) {
                    // Product 이름들을 Set에 추가 (중복 자동 제거)
                    productData.product_list.forEach((product: Product) => {
                      if (product.name !== 'ALL') { // ALL 제외
                        allProductsSet.add(product.name);
                      }
                    });
                  }
                }
              } catch (error) {
                console.warn(`Sub Site ${subSite.project_name}의 Product 목록 조회 실패:`, error);
              }
            }
          }
        } catch (error) {
          console.warn(`SITE ${siteIndex}의 Sub Site 목록 조회 실패:`, error);
        }
      }
      
      // 3. Set을 배열로 변환하여 상태 업데이트
      const uniqueProducts = Array.from(allProductsSet).map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
      setAllProducts(uniqueProducts);
      
    } catch (error) {
      console.error('Product List 조회 오류:', error);
      // 에러 발생 시 기본 Product 목록 설정
      setAllProducts([
        { name: 'SUN' },
        { name: 'Camellia1' },
        { name: 'Camellia2' },
        { name: 'HERMES' },
        { name: 'OAK' },
        { name: 'WIND' },
        { name: 'AOP 검사부' },
        { name: 'AOP 포장부' },
        { name: 'Triton' },
        { name: 'VEGA_D' },
        { name: 'WIND2-B-CS' },
        { name: 'Cypress' }
      ]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // 사용자의 Product 설정 불러오기
  const loadUserProductSettings = async () => {
    try {
      const userId = localStorage.getItem('fap_user_id');
      if (!userId) return;

      const response = await fetch(`/fap/api/settings/get-user-products?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.selected_products) {
          setSelectedProducts(data.data.selected_products);
          console.log('저장된 Product 설정 로드:', data.data.selected_products);
        }
      }
    } catch (error) {
      console.error('사용자 Product 설정 로드 오류:', error);
    }
  };

  // Product 선택/해제 핸들러
  const handleProductToggle = (productName: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productName)) {
        return prev.filter(name => name !== productName);
      } else {
        return [...prev, productName];
      }
    });
  };

  // Product 설정 저장
  const handleSaveProductSettings = async () => {
    try {
      const userId = localStorage.getItem('fap_user_id');
      if (!userId) {
        alert('사용자 정보를 찾을 수 없습니다.');
        return;
      }

      const response = await fetch('/fap/api/settings/save-user-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          selected_products: selectedProducts
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Product 설정이 저장되었습니다!');
        } else {
          alert('Product 설정 저장 실패: ' + data.message);
        }
      } else {
        alert('Product 설정 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Product 설정 저장 오류:', error);
      alert('Product 설정 저장 중 오류가 발생했습니다.');
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }

    try {
      const response = await axios.post('/fap/api/settings/save-user-api-key', {
        api_key: apiKey
      });

      if (response.data.success) {
        const userData = response.data.data;
        alert(`API 키가 성공적으로 저장되었습니다!\n사용자: ${userData.user_name}\n이메일: ${userData.email}\n\n로그아웃됩니다.`);
        setApiKey(''); // 입력 필드 비우기
        
        // localStorage 클리어 (로그아웃)
        localStorage.clear();
        
        // 로그인 페이지로 이동
        navigate('/login');
      } else {
        alert('API 키 저장 실패: ' + response.data.message);
      }
    } catch (error) {
      console.error('API 키 저장 에러:', error);
      alert('API 키 저장 중 오류가 발생했습니다.');
    }
  };
  const handleExit = () => {
    navigate('/main');
  };

  const handleLoadProjects = async () => {
    try {
      const response = await axios.post('/fap/api/settings/sync-projects', {}, {
        params: { limit: projectLimit }
      });
      
      if (response.data.success) {
        alert(`프로젝트 로드 완료!\n${response.data.message}\n총 ${response.data.data.count}개 프로젝트 처리됨`);
      } else {
        alert('프로젝트 로드 실패: ' + response.data.message);
      }
    } catch (error) {
      console.error('프로젝트 로드 에러:', error);
      alert('프로젝트 로드 중 오류가 발생했습니다.');
    }
  };

  const handleLoadIssues = async () => {
    try {
      const response = await axios.post('/fap/api/settings/sync-issues', {}, {
        params: { limit: issueLimit }
      });
      
      if (response.data.success) {
        alert(`이슈 로드 완료!\n${response.data.message}\n총 ${response.data.data.count}개 이슈 처리됨`);
      } else {
        alert('이슈 로드 실패: ' + response.data.message);
      }
    } catch (error) {
      console.error('이슈 로드 에러:', error);
      alert('이슈 로드 중 오류가 발생했습니다.');
    }
  };

  const handleLoadIssueStatuses = async () => {
    try {
      const response = await axios.post('/fap/api/settings/sync-statuses');
      
      if (response.data.success) {
        alert(`이슈 상태 로드 완료!\n${response.data.message}\n총 ${response.data.data.count}개 상태 처리됨`);
      } else {
        alert('이슈 상태 로드 실패: ' + response.data.message);
      }
    } catch (error) {
      console.error('이슈 상태 로드 에러:', error);
      alert('이슈 상태 로드 중 오류가 발생했습니다.');
    }
  };

  const handleLoadRoadmapData = async () => {
    try {
      const response = await axios.post('/fap/api/settings/sync-roadmap-data');
      
      if (response.data.success) {
        alert(`로드맵 데이터 로드 완료!\n${response.data.message}\n총 ${response.data.data.count}개 로드맵 처리됨`);
      } else {
        alert('로드맵 데이터 로드 실패: ' + response.data.message);
      }
    } catch (error) {
      console.error('로드맵 데이터 로드 에러:', error);
      alert('로드맵 데이터 로드 중 오류가 발생했습니다.');
    }
  };

  // PC/모바일 환경 감지 (900px 이하를 모바일로 간주)
  const isMobile = window.innerWidth <= 900;

  if (isMobile) {
    return (
      <Layout>
        <div style={{
          width: '100%',
          height: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.3rem',
          color: '#222',
          fontWeight: 'bold',
          background: '#fff',
          borderRadius: 24,
        }}>
          PC 환경에서 설정해주세요.
        </div>
      </Layout>
    );
  }

  const btnStyle = {
    background: '#28313b',
    color: '#fff',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: 7,
    padding: '0.4rem 1.2rem',
    fontSize: '1.1rem',
    marginLeft: 8,
    cursor: 'pointer',
    minWidth: 100,
    minHeight: 40,
    boxSizing: 'borderBox' as 'border-box',
  };

  return (
    <Layout>
      <div style={{
        background: '#fff',
        borderRadius: 24,
        minHeight: '80vh',
        height: 'calc(95vh - 120px)',
        padding: '2rem 2rem',
        boxSizing: 'border-box',
        margin: '1.5vh auto 0 auto',
        width: '98vw',
        maxWidth: 1600,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', width: '100%', gap: 16, marginBottom: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, alignItems: 'flex-start', display: 'flex', flexDirection: 'column', color: '#222', fontSize: '1.2rem', fontWeight: 500, marginTop: 0 }}>
            {/* API 키 입력 */}
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontWeight: 600, fontSize: '1.15rem', marginRight: 16 }}>API 키 입력 :</span>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="레드마인 API 키를 입력하세요"
                style={{ fontSize: '1.1rem', padding: '6px 12px', border: '1px solid #ccc', borderRadius: 6, minWidth: 220, marginRight: 8 }}
              />
              <button
                onClick={() => handleSaveApiKey()}
                style={{
                  fontSize: '1rem',
                  padding: '6px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                저장
              </button>
            </div>

            {/* Product List 선택 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '1.15rem', marginRight: 16 }}>Product List 선택 :</span>
                  <span style={{ fontSize: '0.9rem', color: '#666' }}>
                    (AE Make Report에서 자주 사용하는 Product들을 선택하세요)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={handleSaveProductSettings}
                    style={{
                      fontSize: '1rem',
                      padding: '6px 16px',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Product 설정 저장
                  </button>
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>
                    선택된 Product: {selectedProducts.length}개
                  </span>
                </div>
              </div>
              
              {loadingProducts ? (
                <div style={{ color: '#666', fontSize: '0.9rem' }}>Product 목록을 불러오는 중...</div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 12, 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  backgroundColor: '#f9f9f9'
                }}>
                  {allProducts.map((product, index) => (
                    <label key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: 4,
                      backgroundColor: selectedProducts.includes(product.name) ? '#e3f2fd' : 'transparent',
                      border: selectedProducts.includes(product.name) ? '1px solid #2196f3' : '1px solid transparent'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.name)}
                        onChange={() => handleProductToggle(product.name)}
                        style={{ transform: 'scale(1.1)' }}
                      />
                      <span style={{ fontSize: '0.9rem' }}>{product.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-end', marginTop: 0 }}>
            {/* 시스템 관리자용 버튼들 */}
            {localStorage.getItem('fap_user_id') === 'admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {/* Load Project */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>프로젝트 최대:</span>
                    <input
                      type="number"
                      value={projectLimit}
                      onChange={(e) => setProjectLimit(parseInt(e.target.value) || 1000)}
                      style={{
                        width: 80,
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        fontSize: '0.9rem'
                      }}
                      min="1"
                      max="10000"
                    />
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>개</span>
                  </div>
                  <button 
                    style={{...btnStyle, background: '#dc3545'}} 
                    onClick={handleLoadProjects}
                  >
                    Load Project
                  </button>
                </div>
                
                {/* Load Issue */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>이슈 최대:</span>
                    <input
                      type="number"
                      value={issueLimit}
                      onChange={(e) => setIssueLimit(parseInt(e.target.value) || 1000)}
                      style={{
                        width: 80,
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        fontSize: '0.9rem'
                      }}
                      min="1"
                      max="10000"
                    />
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>개</span>
                  </div>
                  <button 
                    style={{...btnStyle, background: '#dc3545'}} 
                    onClick={handleLoadIssues}
                  >
                    Load Issue
                  </button>
                </div>
                
                {/* Load Issue Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    style={{...btnStyle, background: '#dc3545'}} 
                    onClick={handleLoadIssueStatuses}
                  >
                    Load Issue Status
                  </button>
                </div>
                
                {/* Load Roadmap Data */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button 
                    style={{...btnStyle, background: '#dc3545'}} 
                    onClick={handleLoadRoadmapData}
                  >
                    Load Roadmap Data
                  </button>
                </div>
              </div>
            )}
            
            <button style={btnStyle} onClick={handleExit}>exit</button>
          </div>
        </div>
      </div>
    </Layout>
  );
} 