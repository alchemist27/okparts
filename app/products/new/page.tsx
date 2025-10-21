"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const [isMobile, setIsMobile] = useState(false);

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
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // 로그인 확인
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
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

    loadCategories();

    return () => window.removeEventListener('resize', checkIsMobile);
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
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const file = files[0]; // 첫 번째 파일만 사용

    if (!allowedTypes.includes(file.type)) {
      alert('jpg, jpeg, png 파일만 업로드 가능합니다.');
      e.target.value = '';
      return;
    }

    // 파일 크기 검증 (3MB)
    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      alert('이미지는 3MB 이하여야 합니다.\n서버에서 자동으로 압축됩니다.');
    }

    // 대표 이미지 1장만 (기존 이미지 교체)
    setImages([file]);

    // 프리뷰 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews([reader.result as string]);
    };
    reader.readAsDataURL(file);

    // input 초기화
    e.target.value = '';
  };

  const removeImage = () => {
    setImages([]);
    setImagePreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    setLoadingStep("상품 정보 확인 중...");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // 필수 항목 검증
      if (images.length === 0) {
        setError("상품 이미지는 최소 1장 이상 필요합니다");
        setLoading(false);
        setLoadingStep("");
        return;
      }

      // 카테고리 선택: 가장 하위 선택된 카테고리 사용
      const selectedCategory = formData.detailCategory || formData.subCategory || formData.mainCategory;

      if (!selectedCategory) {
        setError("카테고리를 선택해주세요");
        setLoading(false);
        setLoadingStep("");
        return;
      }

      // 1. 상품 기본 정보 + 이미지 함께 등록
      setLoadingStep("상품 정보 및 이미지 등록 중...");

      const productFormData = new FormData();
      productFormData.append("productName", formData.productName);
      productFormData.append("sellingPrice", formData.sellingPrice);
      productFormData.append("supplyPrice", formData.supplyPrice);
      productFormData.append("categoryNo", selectedCategory);
      productFormData.append("display", formData.display);
      productFormData.append("selling", formData.selling);

      // 이미지들 추가
      images.forEach((image) => {
        productFormData.append("images", image);
      });

      const productResponse = await fetch("/api/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: productFormData,
      });

      if (!productResponse.ok) {
        const errorData = await productResponse.json();
        throw new Error(errorData.error || "상품 등록에 실패했습니다");
      }

      await productResponse.json();

      // 성공 메시지 표시
      setLoadingStep("등록 완료!");
      setSuccess(true);
      setLoading(false);
      setLoadingStep("");

      // 스크롤 맨 위로
      window.scrollTo(0, 0);

      // 알림 표시
      alert("상품이 성공적으로 등록되었습니다!\n새로운 상품을 등록하세요.");

      // 알림 확인 후 폼 초기화
      setFormData({
        productName: "",
        sellingPrice: "",
        supplyPrice: "",
        mainCategory: "",
        subCategory: "",
        detailCategory: "",
        display: "T" as "T" | "F",
        selling: "T" as "T" | "F",
      });
      setImages([]);
      setImagePreviews([]);
      setSubCategories([]);
      setDetailCategories([]);
      setSuccess(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      setLoadingStep("");

      // 에러 발생 시 스크롤을 에러 메시지로 이동
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <main id="main" className="min-h-screen hero flex items-center justify-center py-4">
      {/* 로딩 오버레이 */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          gap: '1.5rem'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '8px solid #f3f4f6',
            borderTop: '8px solid var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{
            color: 'white',
            fontSize: '1.5rem',
            fontWeight: '700',
            textAlign: 'center'
          }}>
            {loadingStep}
          </div>
          {success && (
            <div style={{
              color: '#10b981',
              fontSize: '3rem'
            }}>
              ✓
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

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
          {/* 제목 및 로그아웃 버튼 */}
          <div className="mb-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h1 className="hero-title" style={{ fontSize: '1.75rem', margin: 0 }}>새 상품 등록</h1>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("supplier");
                  router.push("/login");
                }}
                style={{
                  fontSize: '1rem',
                  padding: '0.5rem 1rem',
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
            <p className="text-center hero-subtitle" style={{ fontSize: '1.125rem' }}>상품 정보를 입력하세요</p>
          </div>

          {/* 에러/성공 메시지 */}
          {error && (
            <div className="alert alert-error mb-4" style={{ fontSize: '1.125rem' }}>
              {error}
            </div>
          )}

          {success && !loading && (
            <div className="alert alert-success mb-4" style={{ fontSize: '1.125rem', backgroundColor: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '12px', border: '2px solid #34d399' }}>
              ✅ 상품이 성공적으로 등록되었습니다! 페이지가 곧 초기화됩니다...
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
                placeholder="예: 150,000"
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
                placeholder="예: 120,000"
              />
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                공급사가 쇼핑몰에 공급하는 가격
              </p>
            </div>

            {/* 상품 이미지 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                대표 이미지 *
              </label>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                • 파일 형식: jpg, jpeg, png<br/>
                • 파일 크기: 3MB 이하 (자동 압축됨)<br/>
                • 대표 이미지 1장만 업로드됩니다<br/>
                • 추가 이미지 업로드 지원 예정입니다
              </p>

              {/* 이미지 프리뷰 */}
              {imagePreviews.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <img
                      src={imagePreviews[0]}
                      alt="대표 이미지"
                      style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '12px', border: '2px solid #3b82f6' }}
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="btn btn-outline"
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '700',
                        border: 'none',
                        minWidth: 'auto'
                      }}
                    >
                      🗑️
                    </button>
                    <div style={{
                      position: 'absolute',
                      bottom: '0.5rem',
                      left: '0.5rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.9)',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '700',
                      borderRadius: '6px'
                    }}>
                      대표 이미지
                    </div>
                  </div>
                </div>
              )}

              {/* 업로드 버튼 - 이미지가 없을 때만 표시 */}
              {images.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* 숨겨진 파일 입력 필드 */}
                  <input
                    id="albumInput"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                  <input
                    id="cameraInput"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    capture="environment"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />

                  {/* PC: 파일 선택 버튼 / 모바일: 앨범, 카메라 버튼 */}
                  {isMobile ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => document.getElementById('albumInput')?.click()}
                        className="btn btn-outline primary"
                        style={{ fontSize: '1.25rem', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '700' }}
                      >
                        <span style={{ fontSize: '2.5rem' }}>📁</span>
                        <span>앨범</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('cameraInput')?.click()}
                        className="btn btn-outline primary"
                        style={{ fontSize: '1.25rem', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '700' }}
                      >
                        <span style={{ fontSize: '2.5rem' }}>📷</span>
                        <span>카메라</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => document.getElementById('albumInput')?.click()}
                        className="btn btn-outline primary"
                        style={{ fontSize: '1.25rem', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '700', width: '100%' }}
                      >
                        <span style={{ fontSize: '2.5rem' }}>📁</span>
                        <span>사진 추가 ({images.length}/1)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="btn btn-primary btn-xl btn-block"
              style={{
                marginTop: '0.75rem',
                opacity: loading || success ? 0.6 : 1,
                cursor: loading || success ? 'not-allowed' : 'pointer'
              }}
            >
              {success ? "등록 완료!" : "상품 등록"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
