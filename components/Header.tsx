"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string>("");

  // 헤더를 표시하지 않을 페이지들
  const noHeaderPages = ["/login", "/register"];

  useEffect(() => {
    // 사용자 정보 가져오기
    const supplierData = localStorage.getItem("supplier");
    if (supplierData) {
      try {
        const supplier = JSON.parse(supplierData);
        setUserId(supplier.email || supplier.userId || "");
      } catch (error) {
        console.error("Failed to parse supplier data:", error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("supplier");
    router.push("/login");
  };

  // 로그인/회원가입 페이지에서는 헤더 숨김
  if (noHeaderPages.includes(pathname)) {
    return null;
  }

  return (
    <>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'white',
        borderBottom: '2px solid #e5e7eb',
        padding: '0.75rem 1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            {/* 왼쪽: 로고 + 쇼핑몰 바로가기 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 1, minWidth: 0 }}>
              <div onClick={() => router.push("/dashboard")} style={{ cursor: 'pointer', flexShrink: 1 }}>
                <Image
                  src="/logo.png"
                  alt="OK중고부품"
                  width={560}
                  height={224}
                  priority
                  className="header-logo"
                  style={{ width: "auto", height: "50px", maxWidth: "200px" }}
                />
              </div>
              <a
                href="https://okayparts.shop"
                target="_blank"
                rel="noopener noreferrer"
                className="shop-button"
                style={{
                  fontSize: '1.5rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  height: '50px',
                  flexShrink: 0
                }}
              >
                쇼핑몰 바로가기
              </a>
            </div>

            {/* 오른쪽: 사용자 정보 및 버튼들 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
              {/* 사용자 정보 */}
              {userId && (
                <div className="user-name" style={{
                  fontSize: '0.75rem',
                  color: '#374151',
                  fontWeight: '600'
                }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{userId}</span>님
                </div>
              )}

              {/* 버튼들 */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                <button
                  onClick={() => router.push("/products/new")}
                  className="btn btn-primary action-button"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.4rem 0.6rem',
                    fontWeight: '700',
                    whiteSpace: 'nowrap'
                  }}
                >
                  + 등록
                </button>
                <button
                  onClick={handleLogout}
                  className="action-button"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.4rem 0.6rem',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* 데스크톱 (768px 이상) */
        @media (min-width: 768px) {
          .header-logo {
            height: 70px !important;
            max-width: 280px !important;
          }

          .shop-button {
            font-size: 1.1rem !important;
            padding: 1rem 1.5rem !important;
            height: 70px !important;
          }

          .user-name {
            font-size: 0.95rem !important;
          }

          .action-button {
            font-size: 0.8rem !important;
            padding: 0.5rem 0.75rem !important;
          }
        }
      `}</style>
    </>
  );
}
