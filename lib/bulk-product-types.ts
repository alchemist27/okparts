/**
 * 대량 상품 등록을 위한 타입 정의
 */

export interface BulkProductInput {
  // 필수 필드
  productName: string;

  // 이미지 (최소 1개 필수)
  images: BulkProductImage[];

  // 선택 필드
  descriptionImages?: BulkProductImage[];
  display?: "T" | "F";
  selling?: "T" | "F";
  maximumQuantity?: number;
  minimumQuantity?: number;

  // 가격 (선택) - 제공하지 않으면 0원으로 설정됨
  sellingPrice?: number;
  supplyPrice?: number;

  // 고정 값 (API에서 자동 설정됨 - 제공하지 않아도 됨)
  // categoryNo: 192 또는 48 등
  // summaryDescription: 공급사별로 다름
  // description: 공급사별로 다름
  // sellerPhone: 공급사별로 다름
}

export interface BulkProductImage {
  // Base64 인코딩된 이미지 데이터 또는 URL
  data: string;
  // 이미지 타입 (base64 | url)
  type: "base64" | "url";
  // 원본 파일명 (선택)
  filename?: string;
}

export interface BulkProductRegistrationRequest {
  // 고정된 공급사 코드
  supplierCode: string;
  // 등록할 상품 목록
  products: BulkProductInput[];
}

export interface BulkProductRegistrationResult {
  // 전체 상품 수
  total: number;
  // 성공한 상품 수
  success: number;
  // 실패한 상품 수
  failed: number;
  // 각 상품별 결과
  results: ProductRegistrationResult[];
}

export interface ProductRegistrationResult {
  // 배열 인덱스
  index: number;
  // 상품명
  productName: string;
  // 성공 여부
  success: boolean;
  // Firestore 문서 ID (성공 시)
  productId?: string;
  // Cafe24 상품 번호 (성공 시)
  cafe24ProductNo?: string;
  // 에러 메시지 (실패 시)
  error?: string;
}

/**
 * 샘플 데이터 예시
 */
export const SAMPLE_BULK_PRODUCT_INPUT: BulkProductInput = {
  productName: "현대 아반떼 2023 앞범퍼",
  images: [
    {
      data: "/9j/4AAQSkZJRg...", // Base64 이미지 데이터
      type: "base64",
      filename: "bumper-front.jpg"
    }
  ],
  display: "T",
  selling: "T",
  maximumQuantity: 1,
  minimumQuantity: 1,
  // 참고: sellingPrice(0원), categoryNo(192), summaryDescription(부품문의 : 010 - 7125 - 5474),
  // description(장안동 장한평역 중고부품 네바퀴), sellerPhone(010-7125-5474)은
  // 자동으로 고정 값이 적용됩니다
};
