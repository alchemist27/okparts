# 남은 API 작업 목록

## 완료된 작업 ✅

### 1. 회원가입 API
- **경로**: `/api/supplier/signup`
- **기능**:
  - 개인/사업자 회원 구분
  - 카페24 공급사 생성
  - 카페24 공급사 사용자 생성
  - Firestore에 계정 저장
  - JWT 토큰 발급
- **상태**: ✅ 완료

### 2. 로그인 API
- **경로**: `/api/supplier/login`
- **기능**:
  - userId 기반 로그인
  - 계정 상태 확인 (pending/active/blocked)
  - 비밀번호 검증
  - JWT 토큰 발급
- **상태**: ✅ 완료

### 3. UI 개선
- 메인 페이지, 로그인, 회원가입 페이지 리디자인
- 로고 원본 비율 유지
- 그라데이션 배경 및 모던한 디자인
- 반응형 레이아웃
- **상태**: ✅ 완료

---

## 남은 작업 목록 📋

### 1. 카테고리 조회 API
- **경로**: `/api/categories`
- **메소드**: `GET`
- **기능**:
  - 카페24에서 카테고리 목록 조회
  - 계층 구조 처리 (대분류 > 중분류 > 소분류)
  - 캐싱 처리 (Firestore 또는 메모리)
- **카페24 API**: `GET /api/v2/admin/categories`
- **필요 작업**:
  ```typescript
  // lib/cafe24.ts에 메소드 추가
  async getCategories(): Promise<any> {
    return this.request("GET", "/admin/categories");
  }

  // app/api/categories/route.ts 생성
  export async function GET(request: NextRequest) {
    // 1. JWT 토큰 검증
    // 2. 카페24 API 호출
    // 3. 카테고리 목록 반환
  }
  ```
- **우선순위**: 🔴 높음 (상품 등록에 필수)

---

### 2. 상품 등록 API
- **경로**: `/api/products`
- **메소드**: `POST`
- **기능**:
  - 상품 정보 입력 (이름, 가격, 재고, 카테고리, 설명)
  - 이미지 업로드 처리
  - 카페24 상품 생성
  - Firestore에 상품 저장 (draft/pending/active)
- **카페24 API**: `POST /api/v2/admin/products`
- **필요 작업**:
  ```typescript
  // 상품 등록 요청 데이터
  {
    name: string;
    price: number;
    stockQty: number;
    categoryIds: string[];
    description?: string;
    images: {
      cover: File;
      gallery: File[];
    };
    brand?: string;
    model?: string;
  }

  // lib/cafe24.ts에 메소드 추가
  async createProduct(productData: any): Promise<any> {
    return this.request("POST", "/admin/products", {
      request: {
        shop_no: 1,
        ...productData,
      },
    });
  }
  ```
- **추가 고려사항**:
  - 이미지 리사이징 (Sharp 라이브러리)
  - Firebase Storage 업로드
  - 카페24 이미지 URL 등록
- **우선순위**: 🔴 높음

---

### 3. 상품 수정 API
- **경로**: `/api/products/[id]`
- **메소드**: `PUT`
- **기능**:
  - 기존 상품 정보 수정
  - 이미지 추가/삭제
  - 카페24 상품 업데이트
  - Firestore 상품 업데이트
- **카페24 API**: `PUT /api/v2/admin/products/{product_no}`
- **필요 작업**:
  ```typescript
  // lib/cafe24.ts에 메소드 추가
  async updateProduct(productNo: string, productData: any): Promise<any> {
    return this.request("PUT", `/admin/products/${productNo}`, {
      request: {
        shop_no: 1,
        ...productData,
      },
    });
  }

  // app/api/products/[id]/route.ts 생성
  export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
    // 1. JWT 토큰 검증
    // 2. 권한 확인 (본인 상품인지)
    // 3. 카페24 API 호출
    // 4. Firestore 업데이트
  }
  ```
- **우선순위**: 🟡 중간

---

### 4. 상품 조회 API
- **경로**: `/api/products` (목록), `/api/products/[id]` (상세)
- **메소드**: `GET`
- **기능**:
  - 공급사별 상품 목록 조회
  - 페이지네이션
  - 필터링 (상태별, 카테고리별)
  - 상품 상세 정보 조회
- **필요 작업**:
  ```typescript
  // GET /api/products?page=1&limit=20&status=active
  export async function GET(request: NextRequest) {
    // 1. JWT 토큰 검증
    // 2. 쿼리 파라미터 파싱
    // 3. Firestore에서 공급사 상품 조회
    // 4. 페이지네이션 적용
  }

  // GET /api/products/[id]
  export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    // 1. JWT 토큰 검증
    // 2. Firestore에서 상품 조회
    // 3. 권한 확인
  }
  ```
- **우선순위**: 🟡 중간

---

### 5. 이미지 업로드 처리
- **경로**: `/api/upload`
- **메소드**: `POST`
- **기능**:
  - 이미지 파일 업로드
  - 리사이징 (상품 대표 이미지: 800x800, 썸네일: 200x200)
  - Firebase Storage 저장
  - 카페24에 이미지 URL 전달
- **필요 라이브러리**: `sharp`, `multer` 또는 Next.js FormData
- **필요 작업**:
  ```typescript
  // app/api/upload/route.ts
  export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // 1. 파일 검증 (타입, 크기)
    // 2. Sharp로 리사이징
    // 3. Firebase Storage 업로드
    // 4. URL 반환
  }
  ```
- **추가 고려사항**:
  - 파일 크기 제한 (10MB)
  - 이미지 타입 제한 (JPEG, PNG, WebP)
  - 중복 파일명 처리
- **우선순위**: 🔴 높음 (상품 등록과 함께)

---

### 6. 대시보드 API
- **경로**: `/api/dashboard`
- **메소드**: `GET`
- **기능**:
  - 상품 통계 (전체/승인대기/활성/거부)
  - 최근 등록 상품
  - 공급사 정보
- **필요 작업**:
  ```typescript
  export async function GET(request: NextRequest) {
    // 1. JWT 토큰 검증
    // 2. Firestore에서 통계 조회
    // 3. 대시보드 데이터 반환
  }
  ```
- **우선순위**: 🟢 낮음

---

### 7. 상품 삭제 API
- **경로**: `/api/products/[id]`
- **메소드**: `DELETE`
- **기능**:
  - 상품 소프트 삭제 (status를 'deleted'로 변경)
  - 카페24에서도 삭제 또는 판매 중지
- **우선순위**: 🟢 낮음

---

## 권장 개발 순서

1. **1단계**: 카테고리 조회 API + 이미지 업로드 API
   - 상품 등록의 선행 작업

2. **2단계**: 상품 등록 API
   - 핵심 기능

3. **3단계**: 상품 조회 API
   - 등록된 상품 확인

4. **4단계**: 상품 수정 API
   - 상품 관리

5. **5단계**: 대시보드 + 삭제 API
   - 부가 기능

---

## 공통 작업 사항

### JWT 인증 미들웨어 생성
```typescript
// lib/auth-middleware.ts
import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export function withAuth(
  handler: (req: NextRequest, supplierId: string) => Promise<Response>
) {
  return async (req: NextRequest) => {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return Response.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const payload = verifyToken(token);

    if (!payload) {
      return Response.json({ error: "유효하지 않은 토큰입니다" }, { status: 401 });
    }

    return handler(req, payload.supplierId);
  };
}
```

### 에러 처리 유틸
```typescript
// lib/api-error.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function handleApiError(error: any) {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  console.error("Unexpected error:", error);
  return Response.json(
    { error: "서버 오류가 발생했습니다" },
    { status: 500 }
  );
}
```

---

## 참고 자료

- [카페24 Admin API 문서](https://developers.cafe24.com/docs/api/admin)
- [Next.js 15 API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Firebase Storage](https://firebase.google.com/docs/storage)
- [Sharp 이미지 처리](https://sharp.pixelplumbing.com/)

---

**작성일**: 2025-10-07
**마지막 업데이트**: 2025-10-07
