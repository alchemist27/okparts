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
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">OKPARTS ADMIN</h1>
            <p className="text-sm text-gray-600">{supplier.companyName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* CTA Section */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/products/new")}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + 새 상품 등록
          </button>
        </div>

        {/* Products List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">내 상품 목록</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              등록된 상품이 없습니다.
              <br />
              첫 상품을 등록해보세요!
            </div>
          ) : (
            <div className="divide-y">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/products/${product.id}`)}
                >
                  <div className="flex items-start space-x-4">
                    {/* Product Image */}
                    {product.images.cover ? (
                      <img
                        src={product.images.cover}
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No Image</span>
                      </div>
                    )}

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {product.name}
                        </h3>
                        {getStatusBadge(product.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {product.price.toLocaleString()}원
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        재고: {product.stockQty}개
                      </p>
                    </div>

                    {/* Arrow */}
                    <svg
                      className="w-5 h-5 text-gray-400"
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
