"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Category } from "@/types";

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    categoryIds: [] as string[],
    stockQty: "",
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      // 1. 상품 기본 정보 등록 (draft)
      const productResponse = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          price: parseInt(formData.price),
          description: formData.description,
          categoryIds: formData.categoryIds,
          stockQty: parseInt(formData.stockQty) || 0,
        }),
      });

      if (!productResponse.ok) {
        throw new Error("상품 등록에 실패했습니다");
      }

      const { productId } = await productResponse.json();

      // 2. 이미지가 있으면 업로드
      if (coverImage) {
        const imageFormData = new FormData();
        imageFormData.append("image", coverImage);

        const imageResponse = await fetch(`/api/products/${productId}/images`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: imageFormData,
        });

        if (!imageResponse.ok) {
          console.warn("Image upload failed, but product was created");
        }
      }

      // 3. 카페24 동기화 (publish)
      const publishResponse = await fetch(`/api/products/${productId}/publish`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!publishResponse.ok) {
        console.warn("Product publish failed");
      }

      // 완료 후 대시보드로 이동
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center">
          <button
            onClick={() => router.back()}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">새 상품 등록</h1>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 대표 이미지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                대표 이미지 *
              </label>
              <div className="flex items-center space-x-4">
                {coverImagePreview ? (
                  <img
                    src={coverImagePreview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded border"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 rounded border flex items-center justify-center">
                    <span className="text-gray-400 text-sm">No Image</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    className="w-full text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    모바일에서는 카메라로 직접 촬영할 수 있습니다
                  </p>
                </div>
              </div>
            </div>

            {/* 상품명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상품명 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* 판매가 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                판매가 *
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                min="0"
              />
            </div>

            {/* 재고 수량 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                재고 수량 *
              </label>
              <input
                type="number"
                value={formData.stockQty}
                onChange={(e) =>
                  setFormData({ ...formData, stockQty: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                min="0"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리
              </label>
              <select
                value={formData.categoryIds[0] || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    categoryIds: e.target.value ? [e.target.value] : [],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택안함</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 상품 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                간단 설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="상품에 대한 간단한 설명을 입력하세요"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? "등록 중..." : "상품 등록"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
