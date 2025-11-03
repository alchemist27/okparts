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
  const [userId, setUserId] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // 로그인 확인
    const token = localStorage.getItem("token");
    const supplierData = localStorage.getItem("supplier");

    if (!token || !supplierData) {
      router.push("/login");
      return;
    }

    // 사용자 정보 가져오기
    try {
      const supplier = JSON.parse(supplierData);
      setUserId(supplier.email || supplier.userId || "");
    } catch (error) {
      console.error("Failed to parse supplier data:", error);
    }

    // 인증 확인 완료
    setCheckingAuth(false);

    loadProducts();
  }, [router]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/products", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("상품 목록을 불러오는데 실패했습니다");
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err: any) {
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("supplier");
    router.push("/login");
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
    <main id="main" className="min-h-screen hero flex items-center justify-center py-4">
      <div className="container">
        {/* 로고 */}
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

        <div className="hero-card" style={{ padding: '2rem' }}>
          {/* 헤더 - 사용자 정보 및 버튼들 */}
          <div className="mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="hero-title" style={{ fontSize: '1.75rem', margin: 0, marginBottom: '0.5rem' }}>상품 관리</h1>
              {userId && (
                <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{userId}</span>님의 상품
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push("/products/new")}
                className="btn btn-primary"
                style={{ fontSize: '1.125rem', padding: '0.75rem 1.5rem', fontWeight: '700' }}
              >
                + 새 상품등록
              </button>
              <button
                onClick={handleLogout}
                style={{
                  fontSize: '1.125rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
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
                    gap: '1.5rem',
                    padding: '1.5rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb'
                  }}
                >
                  {/* 왼쪽: 정사각형 이미지 */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      width: '150px',
                      height: '150px',
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
                          fontSize: '3rem'
                        }}>
                          📦
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 오른쪽: 상품 정보 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* 상품명 */}
                    <h3 style={{
                      fontSize: '1.375rem',
                      fontWeight: '700',
                      color: '#1f2937',
                      margin: 0,
                      lineHeight: '1.4'
                    }}>
                      {product.name}
                    </h3>

                    {/* 상세정보 */}
                    {product.summaryDescription && (
                      <p style={{
                        fontSize: '1.125rem',
                        color: '#6b7280',
                        margin: 0,
                        lineHeight: '1.5'
                      }}>
                        {product.summaryDescription}
                      </p>
                    )}

                    {/* 가격 */}
                    <p style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: 'var(--primary)',
                      margin: 0
                    }}>
                      {product.sellingPrice.toLocaleString()}원
                    </p>

                    {/* 상태 배지 */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: product.status === 'active' ? '#d1fae5' : '#fef3c7',
                        color: product.status === 'active' ? '#065f46' : '#92400e'
                      }}>
                        {product.status === 'active' ? '등록완료' : '임시저장'}
                      </span>
                      {product.cafe24ProductNo && (
                        <span style={{
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          상품번호: {product.cafe24ProductNo}
                        </span>
                      )}
                    </div>

                    {/* 버튼들 */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                      <button
                        onClick={() => router.push(`/products/edit/${product.id}`)}
                        className="btn btn-outline primary"
                        style={{ fontSize: '1rem', padding: '0.625rem 1.25rem', fontWeight: '600' }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deleteLoading === product.id}
                        style={{
                          fontSize: '1rem',
                          padding: '0.625rem 1.25rem',
                          backgroundColor: deleteLoading === product.id ? '#d1d5db' : '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: deleteLoading === product.id ? 'not-allowed' : 'pointer',
                          fontWeight: '600'
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
