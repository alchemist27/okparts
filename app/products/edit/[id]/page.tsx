"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

interface CategoryData {
  category_no: number;
  category_name: string;
  parent_category_no: number;
  category_depth: number;
}

interface Product {
  id: string;
  name: string;
  summaryDescription: string;
  sellingPrice: number;
  supplyPrice: number;
  categoryNo: number;
  images: {
    cover: string;
    gallery: string[];
  };
  status: string;
  cafe24ProductNo: string | null;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [allCategories, setAllCategories] = useState<CategoryData[]>([]);
  const [mainCategories, setMainCategories] = useState<CategoryData[]>([]);
  const [subCategories, setSubCategories] = useState<CategoryData[]>([]);
  const [detailCategories, setDetailCategories] = useState<CategoryData[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [product, setProduct] = useState<Product | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [formData, setFormData] = useState({
    productName: "",
    summaryDescription: "",
    sellingPrice: "",
    supplyPrice: "",
    mainCategory: "",
    subCategory: "",
    detailCategory: "",
  });

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

    // 인증 확인 완료
    setCheckingAuth(false);

    loadCategories();
    loadProduct();
  }, [productId]);

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

  const loadProduct = async () => {
    try {
      setPageLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/products/${productId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("상품 정보를 불러오는데 실패했습니다");
      }

      const data = await response.json();
      const productData = data.product;
      setProduct(productData);

      // 폼 데이터 설정
      setFormData({
        productName: productData.name,
        summaryDescription: productData.summaryDescription || "",
        sellingPrice: productData.sellingPrice.toString(),
        supplyPrice: productData.supplyPrice.toString(),
        mainCategory: "",
        subCategory: "",
        detailCategory: productData.categoryNo.toString(),
      });

      // 카테고리 역추적
      setTimeout(() => {
        reverseTraceCategory(productData.categoryNo);
      }, 500);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setPageLoading(false);
    }
  };

  // 카테고리 역추적 (선택된 카테고리에서 부모 카테고리들을 찾기)
  const reverseTraceCategory = (categoryNo: number) => {
    if (allCategories.length === 0) return;

    const selectedCat = allCategories.find(cat => cat.category_no === categoryNo);
    if (!selectedCat) return;

    if (selectedCat.category_depth === 3) {
      // 소분류 선택됨
      setFormData(prev => ({ ...prev, detailCategory: categoryNo.toString() }));

      const parentCat = allCategories.find(cat => cat.category_no === selectedCat.parent_category_no);
      if (parentCat) {
        setFormData(prev => ({ ...prev, subCategory: parentCat.category_no.toString() }));
        setSubCategories(allCategories.filter(cat => cat.parent_category_no === parentCat.parent_category_no));
        setDetailCategories(allCategories.filter(cat => cat.parent_category_no === parentCat.category_no));

        const grandParentCat = allCategories.find(cat => cat.category_no === parentCat.parent_category_no);
        if (grandParentCat) {
          setFormData(prev => ({ ...prev, mainCategory: grandParentCat.category_no.toString() }));
        }
      }
    } else if (selectedCat.category_depth === 2) {
      // 중분류 선택됨
      setFormData(prev => ({ ...prev, subCategory: categoryNo.toString() }));
      setDetailCategories(allCategories.filter(cat => cat.parent_category_no === categoryNo));

      const parentCat = allCategories.find(cat => cat.category_no === selectedCat.parent_category_no);
      if (parentCat) {
        setFormData(prev => ({ ...prev, mainCategory: parentCat.category_no.toString() }));
        setSubCategories(allCategories.filter(cat => cat.parent_category_no === parentCat.category_no));
      }
    } else {
      // 대분류 선택됨
      setFormData(prev => ({ ...prev, mainCategory: categoryNo.toString() }));
      setSubCategories(allCategories.filter(cat => cat.parent_category_no === categoryNo));
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

      // 가격 유효성 검증
      const cleanPrice = (formData.sellingPrice || "").replace(/,/g, "").trim();

      if (!cleanPrice || isNaN(Number(cleanPrice)) || Number(cleanPrice) <= 0) {
        setError("올바른 판매가를 입력해주세요");
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

      // FormData 생성
      const updateFormData = new FormData();
      updateFormData.append("productName", formData.productName);
      updateFormData.append("summaryDescription", formData.summaryDescription);
      updateFormData.append("sellingPrice", cleanPrice);
      updateFormData.append("supplyPrice", cleanPrice);
      updateFormData.append("categoryNo", selectedCategory);

      const response = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: updateFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "상품 수정에 실패했습니다");
      }

      setSuccess(true);
      alert("상품이 수정되었습니다");

      // 대시보드로 이동
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);

    } catch (err: any) {
      setError(err.message || "상품 수정에 실패했습니다");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
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
              style={{ width: "100%", height: "auto", maxWidth: "280px" }}
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

  // 상품 정보 불러오는 중 로딩 화면
  if (pageLoading) {
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
              style={{ width: "100%", height: "auto", maxWidth: "280px" }}
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
              상품 정보 불러오는 중...
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
            style={{ width: "100%", height: "auto", maxWidth: "280px" }}
          />
        </div>

        <div className="hero-card" style={{ padding: '2rem' }}>
          {/* 제목 및 사용자 정보 */}
          <div className="mb-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h1 className="hero-title" style={{ fontSize: '1.75rem', margin: 0 }}>상품 수정</h1>
              <button
                onClick={() => router.push("/dashboard")}
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
                목록으로
              </button>
            </div>

            {userId && (
              <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>
                <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{userId}</span>님
              </p>
            )}
          </div>

          {/* 상품 이미지 미리보기 */}
          {product?.images?.gallery && product.images.gallery.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                등록된 이미지
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                {product.images.gallery.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img
                      src={img}
                      alt={`상품 이미지 ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: idx === 0 ? '3px solid var(--primary)' : '2px solid #e5e7eb'
                      }}
                    />
                    {idx === 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '0.5rem',
                        left: '0.5rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.9)',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        borderRadius: '4px'
                      }}>
                        대표
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '8px',
                padding: '0.75rem',
                marginTop: '0.75rem'
              }}>
                <p style={{ fontSize: '1rem', color: '#92400e', margin: 0, lineHeight: '1.5' }}>
                  ⚠️ 이미지 수정은 불가하므로 변경이 필요하시면 상품 삭제 후 새로 상품을 등록해주세요.
                </p>
              </div>
            </div>
          )}

          {/* 에러/성공 메시지 */}
          {error && (
            <div className="alert alert-error mb-4" style={{ fontSize: '1.125rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success mb-4" style={{ fontSize: '1.125rem', backgroundColor: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '12px', border: '2px solid #34d399' }}>
              ✅ 상품이 수정되었습니다!
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
              />
            </div>

            {/* 상품 상세정보 */}
            <div>
              <label style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                상품 상세정보
              </label>
              <textarea
                value={formData.summaryDescription}
                onChange={(e) => setFormData({ ...formData, summaryDescription: e.target.value })}
                style={{
                  fontSize: '1.25rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  minHeight: '100px',
                  resize: 'vertical'
                }}
                maxLength={255}
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
                상품 판매가 *
              </label>
              <input
                type="text"
                value={formData.sellingPrice}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,]/g, '');
                  setFormData({ ...formData, sellingPrice: value, supplyPrice: value });
                }}
                style={{ fontSize: '1.25rem', padding: '1rem', borderRadius: '12px' }}
                required
                inputMode="decimal"
              />
            </div>

            {/* 버튼들 */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={loading || success}
                className="btn btn-primary btn-xl"
                style={{
                  flex: 1,
                  opacity: loading || success ? 0.6 : 1,
                  cursor: loading || success ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? "수정 중..." : success ? "수정 완료!" : "수정하기"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="btn btn-outline"
                style={{ fontSize: '1.125rem', padding: '1rem 1.5rem' }}
              >
                취소
              </button>
            </div>
          </form>
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
