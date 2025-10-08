"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Category } from "@/types";
import Image from "next/image";

interface CategoryData {
  category_no: number;
  category_name: string;
  parent_category_no: number;
  category_depth: number;
}

export default function NewProductPage() {
  const router = useRouter();
  const [allCategories, setAllCategories] = useState<CategoryData[]>([]);
  const [mainCategories, setMainCategories] = useState<CategoryData[]>([]);
  const [subCategories, setSubCategories] = useState<CategoryData[]>([]);
  const [detailCategories, setDetailCategories] = useState<CategoryData[]>([]);

  const [formData, setFormData] = useState({
    productName: "",
    sellingPrice: "",
    supplyPrice: "",
    mainCategory: "",
    subCategory: "",
    detailCategory: "",
    display: "T" as "T" | "F",
    selling: "T" as "T" | "F",
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // 로그인 확인
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        const categories = data.categories || [];

        setAllCategories(categories);

        // 대분류 (depth 1, parent가 1인 카테고리)
        const main = categories.filter((cat: CategoryData) =>
          cat.category_depth === 1 || cat.parent_category_no === 1
        );
        setMainCategories(main);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  // 대분류 선택 시
  const handleMainCategoryChange = (mainCategoryNo: string) => {
    setFormData({
      ...formData,
      mainCategory: mainCategoryNo,
      subCategory: "",
      detailCategory: "",
    });

    if (mainCategoryNo) {
      const subs = allCategories.filter(
        (cat) => cat.parent_category_no === parseInt(mainCategoryNo)
      );
      setSubCategories(subs);
      setDetailCategories([]);
    } else {
      setSubCategories([]);
      setDetailCategories([]);
    }
  };

  // 중분류 선택 시
  const handleSubCategoryChange = (subCategoryNo: string) => {
    setFormData({
      ...formData,
      subCategory: subCategoryNo,
      detailCategory: "",
    });

    if (subCategoryNo) {
      const details = allCategories.filter(
        (cat) => cat.parent_category_no === parseInt(subCategoryNo)
      );
      setDetailCategories(details);
    } else {
      setDetailCategories([]);
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
    setSuccess(false);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // 필수 항목 검증
      if (!coverImage) {
        setError("상품 이미지는 필수입니다");
        setLoading(false);
        return;
      }

      // 카테고리 선택: 가장 하위 선택된 카테고리 사용
      const selectedCategory = formData.detailCategory || formData.subCategory || formData.mainCategory;

      if (!selectedCategory) {
        setError("카테고리를 선택해주세요");
        setLoading(false);
        return;
      }

      // 1. 상품 기본 정보 등록 (Firestore draft + Cafe24 동시 생성)
      const productResponse = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: formData.productName,
          sellingPrice: parseInt(formData.sellingPrice),
          supplyPrice: parseInt(formData.supplyPrice),
          categoryNo: parseInt(selectedCategory),
          display: formData.display,
          selling: formData.selling,
        }),
      });

      if (!productResponse.ok) {
        const errorData = await productResponse.json();
        throw new Error(errorData.error || "상품 등록에 실패했습니다");
      }

      const { productId } = await productResponse.json();

      // 2. 이미지 업로드 (필수)
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
        throw new Error("이미지 업로드에 실패했습니다");
      }

      // 성공 메시지 표시
      setSuccess(true);

      // 1.5초 후 대시보드로 이동
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main" className="min-h-screen hero flex items-center justify-center py-4">
      <div className="container">
        {/* 로고 - 최상단 배치 */}
        <div className="text-center mb-6">
          <Image
            src="/logo.png"
            alt="OK중고부품"
            width={750}
            height={300}
            priority
            style={{ width: "100%", height: "auto", maxWidth: "280px" }}
          />
        </div>

        <div className="hero-card" style={{ padding: '2rem' }}>
          {/* 제목 */}
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="btn btn-outline primary mb-4"
              style={{ padding: '0.75rem 1.25rem', fontSize: '1.125rem' }}
            >
              ← 뒤로가기
            </button>
            <h1 className="text-center hero-title mb-2" style={{ fontSize: '1.75rem' }}>새 상품 등록</h1>
            <p className="text-center hero-subtitle" style={{ fontSize: '1.125rem' }}>상품 정보를 입력하세요</p>
          </div>

          {/* 에러/성공 메시지 */}
          {error && (
            <div className="alert alert-error mb-4" style={{ fontSize: '1.125rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success mb-4" style={{ fontSize: '1.125rem', backgroundColor: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '12px', border: '2px solid #34d399' }}>
              ✅ 상품이 성공적으로 등록되었습니다!
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 상품명 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                상품명 *
              </label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                style={{ fontSize: '1.25rem', padding: '1rem', borderRadius: '12px' }}
                required
                placeholder="예: 현대 아반떼 앞범퍼"
              />
            </div>

            {/* 판매가 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                판매가 *
              </label>
              <input
                type="number"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                style={{ fontSize: '1.25rem', padding: '1rem', borderRadius: '12px' }}
                required
                min="0"
                placeholder="예: 150000"
              />
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                고객에게 판매되는 가격
              </p>
            </div>

            {/* 공급가 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                공급가 *
              </label>
              <input
                type="number"
                value={formData.supplyPrice}
                onChange={(e) => setFormData({ ...formData, supplyPrice: e.target.value })}
                style={{ fontSize: '1.25rem', padding: '1rem', borderRadius: '12px' }}
                required
                min="0"
                placeholder="예: 120000"
              />
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                공급사가 쇼핑몰에 공급하는 가격
              </p>
            </div>

            {/* 카테고리 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                카테고리 *
              </label>

              {/* 대분류 */}
              <select
                value={formData.mainCategory}
                onChange={(e) => handleMainCategoryChange(e.target.value)}
                style={{ fontSize: '1.125rem', padding: '1rem', borderRadius: '12px', marginBottom: '0.75rem' }}
              >
                <option value="">대분류 선택</option>
                {mainCategories.map((cat) => (
                  <option key={cat.category_no} value={cat.category_no.toString()}>
                    {cat.category_name}
                  </option>
                ))}
              </select>

              {/* 중분류 */}
              {subCategories.length > 0 && (
                <select
                  value={formData.subCategory}
                  onChange={(e) => handleSubCategoryChange(e.target.value)}
                  style={{ fontSize: '1.125rem', padding: '1rem', borderRadius: '12px', marginBottom: '0.75rem' }}
                >
                  <option value="">중분류 선택</option>
                  {subCategories.map((cat) => (
                    <option key={cat.category_no} value={cat.category_no.toString()}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              )}

              {/* 소분류 */}
              {detailCategories.length > 0 && (
                <select
                  value={formData.detailCategory}
                  onChange={(e) => setFormData({ ...formData, detailCategory: e.target.value })}
                  style={{ fontSize: '1.125rem', padding: '1rem', borderRadius: '12px' }}
                >
                  <option value="">소분류 선택</option>
                  {detailCategories.map((cat) => (
                    <option key={cat.category_no} value={cat.category_no.toString()}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 상품 이미지 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                상품 이미지 *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                {coverImagePreview && (
                  <img
                    src={coverImagePreview}
                    alt="Preview"
                    style={{ width: '100%', maxWidth: '300px', height: 'auto', objectFit: 'cover', borderRadius: '12px', border: '2px solid #e5e7eb' }}
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageChange}
                  required
                  style={{ fontSize: '1.125rem', padding: '0.75rem', borderRadius: '12px', width: '100%', border: '2px solid #e5e7eb' }}
                />
                <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', margin: 0 }}>
                  모바일에서는 카메라로 직접 촬영 가능
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="btn btn-primary btn-xl btn-block"
              style={{ marginTop: '0.75rem' }}
            >
              {loading ? "등록 중..." : success ? "등록 완료!" : "상품 등록"}
            </button>
          </form>

          {/* 하단 링크 */}
          <div className="text-center" style={{ marginTop: '1.5rem', fontSize: '1.125rem' }}>
            <a href="/dashboard" style={{ color: '#6b7280', fontWeight: '600' }}>
              ← 대시보드로 돌아가기
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
