"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Product {
  id: string;
  name: string;
  summaryDescription: string;
  sellingPrice: number;
  categoryNo: number;
  images: {
    cover: string;
    gallery: string[];
  };
  status: string;
  cafe24ProductNo: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 로그인 확인
    const token = localStorage.getItem("token");
    const supplierData = localStorage.getItem("supplier");

    if (!token || !supplierData) {
      router.push("/login");
      return;
    }

    // 사용자 정보 가져오기
    if (supplierData) {
      try {
        const supplier = JSON.parse(supplierData);
        setUserId(supplier.email || supplier.userId || "");
      } catch (error) {
        console.error("Failed to parse supplier data:", error);
      }
    }

    // 모바일 감지
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileDevice || (isTouchDevice && window.innerWidth < 768));
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    // 인증 확인 완료
    setCheckingAuth(false);

    loadProducts();

    return () => window.removeEventListener('resize', checkIsMobile);
  }, [router]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const supplierData = localStorage.getItem("supplier");

      console.log("========== [Dashboard] 상품 목록 조회 시작 ==========");
      console.log("[Dashboard] 토큰 존재:", !!token);
      console.log("[Dashboard] 공급사 데이터:", supplierData);

      if (!token) {
        router.push("/login");
        return;
      }

      // JWT 토큰 디코딩하여 supplierId 확인
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log("[Dashboard] JWT 페이로드:", payload);
          console.log("[Dashboard] supplierId:", payload.supplierId);
        }
      } catch (e) {
        console.error("[Dashboard] JWT 디코딩 실패:", e);
      }

      const response = await fetch("/api/products", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("[Dashboard] API 응답 상태:", response.status);

      if (!response.ok) {
        throw new Error("상품 목록을 불러오는데 실패했습니다");
      }

      const data = await response.json();
      console.log("[Dashboard] 받은 상품 수:", data.products?.length || 0);

      // 각 상품의 supplierId 로그
      if (data.products && data.products.length > 0) {
        console.log("[Dashboard] 상품별 supplierId:");
        data.products.forEach((product: Product, index: number) => {
          console.log(`  ${index + 1}. ${product.name} - supplierId: ${(product as any).supplierId}`);
        });
      }

      console.log("========== [Dashboard] 상품 목록 조회 완료 ==========\n");

      setProducts(data.products || []);
    } catch (err: any) {
      console.error("[Dashboard] 에러 발생:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("정말 이 상품을 삭제하시겠습니까?")) {
      return;
    }

    try {
      setDeleteLoading(productId);
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("상품 삭제에 실패했습니다");
      }

      // 목록 새로고침
      await loadProducts();
      alert("상품이 삭제되었습니다");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleteLoading(null);
    }
  };


  // 인증 확인 중 로딩 화면
  if (checkingAuth) {
    return (
      <main id="main" className="min-h-screen hero flex items-center justify-center py-4">
        <div className="container">
          <div className="text-center mb-6">
            <Image
              src="/logo.png"
              alt="OK중고부품"
              width={750}
              height={300}
              priority
              onClick={() => router.push("/dashboard")}
              style={{ width: "100%", height: "auto", maxWidth: "280px", cursor: "pointer" }}
            />
          </div>
          <div className="hero-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '6px solid #f3f4f6',
              borderTop: '6px solid var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }} />
            <p style={{ fontSize: '1.25rem', marginTop: '1.5rem', color: '#6b7280' }}>
              인증 확인 중...
            </p>
          </div>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main id="main" className="min-h-screen hero" style={{ paddingTop: '0' }}>

      {/* 메인 컨텐츠 */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '2rem 1rem',
        minHeight: 'calc(100vh - 80px)'
      }}>
        <div className="hero-card" style={{
          padding: '2rem',
          width: '100%',
          maxWidth: '600px'
        }}>
          {/* 제목, 사용자 정보 및 로그아웃 버튼 */}
          <div className="mb-6">
            <h1 className="hero-title" style={{ fontSize: '1.75rem', margin: 0, marginBottom: '1rem' }}>상품 관리</h1>

            {/* 사용자 정보 및 로그아웃 버튼 - 모바일 반응형 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '0.75rem' : '0'
            }}>
              {/* 사용자 정보 */}
              {userId && (
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: '700',
                  color: '#1f2937',
                  textAlign: isMobile ? 'center' : 'left',
                  width: isMobile ? '100%' : 'auto'
                }}>
                  <span style={{ color: 'var(--primary)' }}>{userId}</span>님 반갑습니다
                </div>
              )}

              {/* 로그아웃 버튼 */}
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("supplier");
                  router.push("/login");
                }}
                style={{
                  fontSize: '1rem',
                  padding: '0.625rem 1.25rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  width: isMobile ? '100%' : 'auto',
                  whiteSpace: 'nowrap'
                }}
              >
                로그아웃
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="alert alert-error mb-4" style={{ fontSize: '1.125rem' }}>
              {error}
            </div>
          )}

          {/* 로딩 상태 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                border: '6px solid #f3f4f6',
                borderTop: '6px solid var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }} />
              <p style={{ fontSize: '1.25rem', marginTop: '1.5rem', color: '#6b7280' }}>
                상품 목록 불러오는 중...
              </p>
            </div>
          ) : products.length === 0 ? (
            // 상품이 없을 때
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📦</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>
                등록된 상품이 없습니다
              </h3>
              <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '2rem' }}>
                첫 상품을 등록해보세요!
              </p>
              <button
                onClick={() => router.push("/products/new")}
                className="btn btn-primary btn-xl"
              >
                상품 등록하기
              </button>
            </div>
          ) : (
            // 상품 목록
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb'
                  }}
                >
                  {/* 왼쪽: 정사각형 이미지 */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      width: '120px',
                      height: '120px',
                      position: 'relative',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#e5e7eb'
                    }}>
                      {product.images?.cover ? (
                        <img
                          src={product.images.cover}
                          alt={product.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2.5rem'
                        }}>
                          📦
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 오른쪽: 상품 정보 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                    {/* 상품명 */}
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '700',
                      color: '#1f2937',
                      margin: 0,
                      lineHeight: '1.3',
                      wordBreak: 'break-word'
                    }}>
                      {product.name}
                    </h3>

                    {/* 상세정보 */}
                    {product.summaryDescription && (
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        margin: 0,
                        lineHeight: '1.4',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {product.summaryDescription}
                      </p>
                    )}

                    {/* 가격 */}
                    <p style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: 'var(--primary)',
                      margin: 0
                    }}>
                      {product.sellingPrice.toLocaleString()}원
                    </p>

                    {/* 상태 배지 및 상품번호 - 한 줄로 */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        backgroundColor: product.status === 'active' ? '#d1fae5' : '#fef3c7',
                        color: product.status === 'active' ? '#065f46' : '#92400e',
                        whiteSpace: 'nowrap'
                      }}>
                        {product.status === 'active' ? '등록완료' : '임시저장'}
                      </span>
                      {product.cafe24ProductNo && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          whiteSpace: 'nowrap'
                        }}>
                          상품번호: {product.cafe24ProductNo}
                        </span>
                      )}
                    </div>

                    {/* 버튼들 - 가로로 배치 */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button
                        onClick={() => router.push(`/products/edit/${product.id}`)}
                        className="btn btn-outline primary"
                        style={{
                          fontSize: '0.875rem',
                          padding: '0.5rem 1rem',
                          fontWeight: '600',
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deleteLoading === product.id}
                        style={{
                          fontSize: '0.875rem',
                          padding: '0.5rem 1rem',
                          backgroundColor: deleteLoading === product.id ? '#d1d5db' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: deleteLoading === product.id ? 'not-allowed' : 'pointer',
                          fontWeight: '600',
                          flex: 1,
                          minWidth: 0
                        }}
                      >
                        {deleteLoading === product.id ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
