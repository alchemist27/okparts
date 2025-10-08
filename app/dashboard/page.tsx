"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Supplier } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    // 로그인 확인
    const token = localStorage.getItem("token");
    const supplierData = localStorage.getItem("supplier");

    if (!token || !supplierData) {
      router.push("/login");
      return;
    }

    setSupplier(JSON.parse(supplierData));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("supplier");
    router.push("/");
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
        <div className="max-w-2xl mx-auto">
          {/* 상품 등록 박스 */}
          <div
            onClick={() => router.push("/products/new")}
            className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-8 sm:p-10 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transition-all cursor-pointer group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 bg-white/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 text-white"
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
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                상품 등록
              </h3>
              <p className="text-base sm:text-lg text-blue-100 mb-6 max-w-md">
                새로운 상품을 등록하고 판매를 시작하세요
              </p>
              <div className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-bold text-base sm:text-lg rounded-lg group-hover:bg-blue-50 transition-colors">
                <span>지금 등록하기</span>
                <svg
                  className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
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

          {/* 안내 메시지 */}
          <div className="mt-8 text-center">
            <p className="text-sm sm:text-base text-gray-600">
              상품 등록 후 관리자 승인을 거쳐 판매가 시작됩니다
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
