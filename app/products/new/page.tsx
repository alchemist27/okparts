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
    <main className="min-h-screen hero">
      {/* Header */}
      <div className="container py-6">
        <div className="hero-card">
          <div className="flex items-center mb-6">
            <button
              onClick={() => router.back()}
              className="btn btn-outline primary mr-4"
              style={{ padding: '0.75rem 1rem', fontSize: '1.125rem' }}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ display: 'inline-block' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              뒤로가기
            </button>
            <h1 className="hero-title" style={{ fontSize: '1.875rem', margin: 0 }}>새 상품 등록</h1>
          </div>

          {error && (
            <div className="alert alert-error mb-6" style={{ fontSize: '1.25rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* 대표 이미지 */}
            <div>
              <label style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '0.75rem', display: 'block' }}>
                대표 이미지 *
              </label>
              <div className="flex items-center gap-4">
                {coverImagePreview ? (
                  <img
                    src={coverImagePreview}
                    alt="Preview"
                    className="image-preview"
                    style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '12px', border: '2px solid #e5e7eb' }}
                  />
                ) : (
                  <div className="image-placeholder" style={{ width: '150px', height: '150px', borderRadius: '12px', border: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
                    <span style={{ color: '#6b7280', fontSize: '1rem' }}>이미지 없음</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    style={{ fontSize: '1.25rem', padding: '1rem', borderRadius: '12px', width: '100%' }}
                  />
                  <p style={{ fontSize: '1.125rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    모바일에서는 카메라로 직접 촬영할 수 있습니다
                  </p>
                </div>
              </div>
            </div>

            {/* 상품명 */}
            <div>
              <label style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '0.75rem', display: 'block' }}>
                상품명 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ fontSize: '1.375rem', padding: '1.25rem', borderRadius: '12px', width: '100%' }}
                required
              />
            </div>

            {/* 판매가 */}
            <div>
              <label style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '0.75rem', display: 'block' }}>
                판매가 *
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                style={{ fontSize: '1.375rem', padding: '1.25rem', borderRadius: '12px', width: '100%' }}
                required
                min="0"
                placeholder="원"
              />
            </div>

            {/* 재고 수량 */}
            <div>
              <label style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '0.75rem', display: 'block' }}>
                재고 수량 *
              </label>
              <input
                type="number"
                value={formData.stockQty}
                onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                style={{ fontSize: '1.375rem', padding: '1.25rem', borderRadius: '12px', width: '100%' }}
                required
                min="0"
                placeholder="개"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '0.75rem', display: 'block' }}>
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
                style={{ fontSize: '1.375rem', padding: '1.25rem', borderRadius: '12px', width: '100%' }}
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
              <label style={{ fontSize: '1.375rem', fontWeight: '700', marginBottom: '0.75rem', display: 'block' }}>
                간단 설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                style={{ fontSize: '1.375rem', padding: '1.25rem', borderRadius: '12px', width: '100%', resize: 'vertical' }}
                placeholder="상품에 대한 간단한 설명을 입력하세요"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-xl btn-block"
              style={{ marginTop: '1.5rem' }}
            >
              {loading ? "등록 중..." : "상품 등록"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
