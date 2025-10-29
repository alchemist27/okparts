"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import imageCompression from "browser-image-compression";

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
    summaryDescription: "",
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validFiles: File[] = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        alert('jpg, jpeg, png 파일만 업로드 가능합니다.');
        continue;
      }

      validFiles.push(file);
    }

    // 최대 3장까지 (기존 이미지 + 새 이미지)
    const remainingSlots = 3 - images.length;
    const filesToAdd = validFiles.slice(0, remainingSlots);

    if (validFiles.length > remainingSlots) {
      alert(`최대 3장까지 업로드 가능합니다. ${remainingSlots}장만 추가됩니다.`);
    }

    if (filesToAdd.length === 0) return;

    // 로딩 시작
    setIsUploadingImages(true);
    setImageUploadProgress(0);

    // 이미지 압축 (업로드 전에 클라이언트에서 압축)
    const compressedFiles: File[] = [];
    const totalFiles = filesToAdd.length;

    for (let i = 0; i < filesToAdd.length; i++) {
      const file = filesToAdd[i];
      try {
        console.log(`[압축] 원본: ${file.name}, ${(file.size / 1024 / 1024).toFixed(2)}MB`);

        const options = {
          maxSizeMB: 1, // 최대 1MB
          maxWidthOrHeight: 1920, // 최대 해상도
          useWebWorker: true,
          onProgress: (progress: number) => {
            // 각 이미지의 진행률을 전체 진행률로 변환
            const overallProgress = ((i / totalFiles) + (progress / 100 / totalFiles)) * 100;
            setImageUploadProgress(Math.round(overallProgress));
          },
        };

        const compressedFile = await imageCompression(file, options);
        console.log(`[압축] 완료: ${compressedFile.name}, ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

        compressedFiles.push(compressedFile);

        // 각 파일 완료 후 진행률 업데이트
        const completedProgress = ((i + 1) / totalFiles) * 100;
        setImageUploadProgress(Math.round(completedProgress));
      } catch (error) {
        console.error('[압축] 실패:', error);
        // 압축 실패 시 원본 사용
        compressedFiles.push(file);
      }
    }

    const newImages = [...images, ...compressedFiles];
    setImages(newImages);

    // 프리뷰 생성
    const newPreviews = [...imagePreviews];
    let loadedCount = 0;

    compressedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        loadedCount++;

        if (loadedCount === compressedFiles.length) {
          setImagePreviews(newPreviews);
          // 로딩 완료
          setTimeout(() => {
            setIsUploadingImages(false);
            setImageUploadProgress(0);
          }, 300);
        }
      };
      reader.readAsDataURL(file);
    });

    // input 초기화
    e.target.value = '';
  };

  const removeImage = (indexToRemove: number) => {
    const newImages = images.filter((_, index) => index !== indexToRemove);
    const newPreviews = imagePreviews.filter((_, index) => index !== indexToRemove);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    setUploadProgress(0);
    setLoadingStep("상품 정보 확인 중...");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      setUploadProgress(10);

      // 필수 항목 검증
      if (images.length === 0) {
        setError("상품 이미지는 최소 1장 이상 필요합니다");
        setLoading(false);
        setLoadingStep("");
        setUploadProgress(0);
        return;
      }

      setUploadProgress(20);

      // 가격 유효성 검증
      console.log("[프론트] 가격 검증 시작");
      console.log("[프론트] formData.sellingPrice:", formData.sellingPrice);
      console.log("[프론트] typeof:", typeof formData.sellingPrice);

      const cleanPrice = (formData.sellingPrice || "").replace(/,/g, "").trim();
      console.log("[프론트] cleanPrice:", cleanPrice);
      console.log("[프론트] isNaN(Number(cleanPrice)):", isNaN(Number(cleanPrice)));
      console.log("[프론트] Number(cleanPrice):", Number(cleanPrice));

      if (!cleanPrice || isNaN(Number(cleanPrice)) || Number(cleanPrice) <= 0) {
        console.error("[프론트] 가격 검증 실패!");
        setError("올바른 판매가를 입력해주세요");
        setLoading(false);
        setLoadingStep("");
        setUploadProgress(0);
        return;
      }

      console.log("[프론트] 가격 검증 통과:", cleanPrice);

      setUploadProgress(30);

      // 카테고리 선택: 가장 하위 선택된 카테고리 사용
      const selectedCategory = formData.detailCategory || formData.subCategory || formData.mainCategory;

      if (!selectedCategory) {
        setError("카테고리를 선택해주세요");
        setLoading(false);
        setLoadingStep("");
        setUploadProgress(0);
        return;
      }

      // 1. 상품 기본 정보 + 이미지 함께 등록
      setUploadProgress(40);
      setLoadingStep("상품 등록중... 잠시만 기다려주세요... 등록 중 화면을 벗어나면 등록이 취소됩니다.");

      console.log("========== [프론트] 상품 등록 데이터 ==========");
      console.log("상품명:", formData.productName);
      console.log("상세 설명:", formData.summaryDescription);
      console.log("판매가 (원본):", formData.sellingPrice);
      console.log("판매가 (정제):", cleanPrice);
      console.log("카테고리:", selectedCategory);
      console.log("이미지 개수:", images.length);
      console.log("===============================================");

      const productFormData = new FormData();
      productFormData.append("productName", formData.productName);
      productFormData.append("summaryDescription", formData.summaryDescription);
      productFormData.append("sellingPrice", cleanPrice); // 검증된 가격
      productFormData.append("supplyPrice", cleanPrice); // 검증된 가격
      productFormData.append("categoryNo", selectedCategory);
      productFormData.append("display", formData.display);
      productFormData.append("selling", formData.selling);
      productFormData.append("maximum_quantity", "1");
      productFormData.append("minimum_quantity", "1");

      // 이미지들 추가
      console.log(`[프론트] 전송할 이미지 개수: ${images.length}`);
      images.forEach((image, idx) => {
        console.log(`[프론트] 이미지 ${idx + 1}:`, {
          name: image.name,
          type: image.type,
          size: `${(image.size / 1024 / 1024).toFixed(2)}MB`
        });
        productFormData.append("images", image);
      });

      console.log("[프론트] FormData 생성 완료, API 호출 시작...");
      setUploadProgress(50);

      const productResponse = await fetch("/api/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: productFormData,
      });

      setUploadProgress(80);

      if (!productResponse.ok) {
        console.error("상품 등록 실패 - Status:", productResponse.status);

        // 413 에러 (Content Too Large) 체크
        if (productResponse.status === 413) {
          throw new Error("업로드 용량이 너무 큽니다. 이미지 크기를 줄여주세요.");
        }

        let errorMessage = "상품 등록에 실패했습니다";
        try {
          const errorData = await productResponse.json();
          console.error("상품 등록 실패 데이터:", errorData);
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (jsonError) {
          // JSON 파싱 실패 시 텍스트로 시도
          const errorText = await productResponse.text();
          console.error("상품 등록 실패 (텍스트):", errorText);
          errorMessage = `서버 오류 (${productResponse.status})`;
        }

        throw new Error(errorMessage);
      }

      await productResponse.json();

      setUploadProgress(90);

      // 성공 메시지 표시
      setLoadingStep("등록 완료!");
      setUploadProgress(100);
      setSuccess(true);

      // 잠시 후 성공 페이지로 리다이렉트
      setTimeout(() => {
        router.push("/products/success");
      }, 1000);
    } catch (err: any) {
      console.error("========== 상품 등록 에러 발생 ==========");
      console.error("에러 메시지:", err.message);
      console.error("에러 스택:", err.stack);
      console.error("에러 전체:", err);
      console.error("=========================================");

      setError(err.message || "상품 등록에 실패했습니다");
      setLoading(false);
      setLoadingStep("");
      setUploadProgress(0);

      // 에러 발생 시 스크롤을 에러 메시지로 이동
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <main id="main" className="min-h-screen hero flex items-center justify-center py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
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
          gap: '1.5rem',
          WebkitOverflowScrolling: 'touch'
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
            textAlign: 'center',
            padding: '0 1rem'
          }}>
            {loadingStep}
          </div>
          <div style={{
            color: 'white',
            fontSize: '2.5rem',
            fontWeight: '700'
          }}>
            {uploadProgress}%
          </div>
          <div style={{
            width: '80%',
            maxWidth: '400px',
            height: '12px',
            backgroundColor: '#374151',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: 'var(--primary)',
              width: `${uploadProgress}%`,
              transition: 'width 0.3s ease'
            }} />
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

          {/* 중요 안내 */}
          <div style={{
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#92400e', margin: 0 }}>등록 전 참고사항</h3>
            </div>
            <p style={{ fontSize: '1.125rem', color: '#92400e', margin: 0, lineHeight: '1.6' }}>
              여러 개의 부품을 판매하시려면 각각 별도로 상품 등록을 해주세요.
            </p>
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
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                  (알림 발송을 위해 핵심 키워드를 포함해주세요)
                </span>
              </label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                onTouchStart={(e) => e.currentTarget.focus()}
                style={{ fontSize: '1.25rem', padding: '1rem', borderRadius: '12px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                required
                placeholder="현대 아반떼 2023 앞범퍼"
                inputMode="text"
                autoComplete="off"
              />
            </div>

            {/* 상품 상세정보 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                상품 상세정보
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                  (차량명, 연식, 부품번호, 차대번호, 판매자 위치 등 상세 정보 입력)
                </span>
              </label>
              <textarea
                value={formData.summaryDescription}
                onChange={(e) => setFormData({ ...formData, summaryDescription: e.target.value })}
                onTouchStart={(e) => e.currentTarget.focus()}
                style={{
                  fontSize: '1.25rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  WebkitUserSelect: 'text',
                  WebkitTouchCallout: 'default',
                  minHeight: '100px',
                  resize: 'vertical'
                }}
                maxLength={255}
                placeholder="아반떼 AD 2020년식, 부품번호: 86511-2H000, 판매자 위치: 서울 강남구"
                inputMode="text"
                autoComplete="off"
              />
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                {formData.summaryDescription.length}/255자
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
                onTouchStart={(e) => e.currentTarget.focus()}
                style={{ fontSize: '1.125rem', padding: '1rem', borderRadius: '12px', marginBottom: '0.75rem', WebkitUserSelect: 'text' }}
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
                  onTouchStart={(e) => e.currentTarget.focus()}
                  style={{ fontSize: '1.125rem', padding: '1rem', borderRadius: '12px', marginBottom: '0.75rem', WebkitUserSelect: 'text' }}
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
                  onTouchStart={(e) => e.currentTarget.focus()}
                  style={{ fontSize: '1.125rem', padding: '1rem', borderRadius: '12px', WebkitUserSelect: 'text' }}
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
                상품 판매가 *
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                  (거래 수수료 10% + 부가세 포함 금액)
                </span>
              </label>
              <input
                type="text"
                value={formData.sellingPrice}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,]/g, ''); // 숫자와 컴마만 허용
                  setFormData({ ...formData, sellingPrice: value, supplyPrice: value });
                }}
                onTouchStart={(e) => e.currentTarget.focus()}
                style={{ fontSize: '1.25rem', padding: '1rem', borderRadius: '12px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                required
                placeholder="150000"
                inputMode="decimal"
                autoComplete="off"
              />
            </div>

            {/* 상품 이미지 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                상품 이미지 *
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                  (jpg/png, 3MB 이하, 최대 3장, 첫 번째가 대표 이미지)
                </span>
              </label>

              {/* 이미지 프리뷰 */}
              {imagePreviews.length > 0 && (
                <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                  {imagePreviews.map((preview, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <img
                        src={preview}
                        alt={`이미지 ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '250px',
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: index === 0 ? '3px solid #3b82f6' : '2px solid #d1d5db'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
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
                      {index === 0 && (
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
                      )}
                      <div style={{
                        position: 'absolute',
                        bottom: '0.5rem',
                        right: '0.5rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        borderRadius: '6px'
                      }}>
                        {index + 1}/3
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 업로드 버튼 - 3장 미만일 때만 표시 */}
              {images.length < 3 && (
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* 숨겨진 파일 입력 필드 */}
                  <input
                    id="albumInput"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    multiple
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                    disabled={isUploadingImages}
                  />
                  <input
                    id="cameraInput"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif"
                    capture="environment"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                    disabled={isUploadingImages}
                  />

                  {/* PC: 파일 선택 버튼 / 모바일: 앨범, 카메라 버튼 */}
                  {isMobile ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => document.getElementById('albumInput')?.click()}
                        className="btn btn-outline primary"
                        style={{ fontSize: '1.25rem', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '700' }}
                        disabled={isUploadingImages}
                      >
                        <span style={{ fontSize: '2.5rem' }}>📁</span>
                        <span>앨범</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('cameraInput')?.click()}
                        className="btn btn-outline primary"
                        style={{ fontSize: '1.25rem', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '700' }}
                        disabled={isUploadingImages}
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
                        disabled={isUploadingImages}
                      >
                        <span style={{ fontSize: '2.5rem' }}>📁</span>
                        <span>사진 추가 ({images.length}/3)</span>
                      </button>
                    </div>
                  )}

                  {/* 이미지 압축 중 로딩 오버레이 */}
                  {isUploadingImages && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '12px',
                      gap: '1rem',
                      zIndex: 10
                    }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        border: '5px solid #e5e7eb',
                        borderTop: '5px solid var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <div style={{
                        color: '#1f2937',
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        이미지 압축 중...
                      </div>
                      <div style={{
                        color: 'var(--primary)',
                        fontSize: '2rem',
                        fontWeight: '700'
                      }}>
                        {imageUploadProgress}%
                      </div>
                      <div style={{
                        width: '80%',
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          backgroundColor: 'var(--primary)',
                          width: `${imageUploadProgress}%`,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
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
