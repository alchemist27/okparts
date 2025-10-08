"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Supplier, Product } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 로그인 확인
    const token = localStorage.getItem("token");
    const supplierData = localStorage.getItem("supplier");

    if (!token || !supplierData) {
      router.push("/login");
      return;
    }

    setSupplier(JSON.parse(supplierData));
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/products?mine=1", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("supplier");
    router.push("/");
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-200 text-gray-800",
      pending: "bg-yellow-200 text-yellow-800",
      active: "bg-green-200 text-green-800",
      rejected: "bg-red-200 text-red-800",
    };

    const labels: Record<string, string> = {
      draft: "임시저장",
      pending: "승인대기",
      active: "판매중",
      rejected: "반려됨",
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  if (!supplier) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 md:py-6">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                OKPARTS ADMIN
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {supplier.companyName}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-2 sm:px-4 text-xs sm:text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* CTA Section */}
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 상품 조회 박스 */}
            <div
              onClick={() => router.push("/products")}
              className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex flex-col h-full">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  상품 조회
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 flex-1">
                  등록된 상품 목록을 확인하고 관리하세요
                </p>
                <div className="flex items-center text-blue-600 font-medium text-sm sm:text-base">
                  <span>조회하기</span>
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* 상품 등록 박스 */}
            <div
              onClick={() => router.push("/products/new")}
              className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex flex-col h-full">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                  상품 등록
                </h3>
                <p className="text-sm sm:text-base text-blue-100 mb-4 flex-1">
                  새로운 상품을 등록하고 판매를 시작하세요
                </p>
                <div className="flex items-center text-white font-medium text-sm sm:text-base">
                  <span>등록하기</span>
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              내 상품 목록
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              총 {products.length}개 상품
            </p>
          </div>

          {loading ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-sm text-gray-500">로딩 중...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <p className="text-sm sm:text-base text-gray-600 font-medium">
                등록된 상품이 없습니다
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                첫 상품을 등록해보세요!
              </p>
              <button
                onClick={() => router.push("/products/new")}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                상품 등록하기
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="p-4 sm:p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/products/${product.id}`)}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Product Image */}
                    {product.images.cover ? (
                      <img
                        src={product.images.cover}
                        alt={product.name}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                          {product.name}
                        </h3>
                        {getStatusBadge(product.status)}
                      </div>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                        {product.price?.toLocaleString() || product.sellingPrice?.toLocaleString() || 0}원
                      </p>
                      {(product.stockQty !== undefined && product.stockQty !== null) && (
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                          재고: {product.stockQty}개
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <svg
                      className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
