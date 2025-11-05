// SMS 메시지 템플릿

export interface SmsTemplateParams {
  keywords: string[]; // 매칭된 키워드
  productName: string; // 상품명
  productNo?: string; // 상품 번호
  mallId?: string; // 쇼핑몰 ID
  customUrl?: string; // 커스텀 URL
}

// 상품 링크 생성
function generateProductUrl(params: SmsTemplateParams): string {
  if (params.customUrl) {
    return params.customUrl;
  }

  if (params.productNo && params.mallId) {
    return `https://${params.mallId}.cafe24.com/product/detail.html?product_no=${params.productNo}`;
  }

  // 기본 쇼핑몰 메인 페이지
  if (params.mallId) {
    return `https://${params.mallId}.cafe24.com`;
  }

  return "https://okparts.com";
}

// 기본 템플릿 - 신규 상품 알림
export function getNewProductTemplate(params: SmsTemplateParams): string {
  const keywordText = params.keywords.join(", ");
  const productUrl = generateProductUrl(params);

  // SMS는 90byte 제한이 있으므로 간결하게
  const message = `[OK파츠] ${keywordText} 신규 상품 등록!
${params.productName}
상세보기: ${productUrl}`;

  return message;
}

// 간단 템플릿 (더 짧은 버전)
export function getSimpleTemplate(params: SmsTemplateParams): string {
  const keywordText = params.keywords.join(", ");
  const productUrl = generateProductUrl(params);

  return `[OK파츠] ${keywordText} 상품 등록
${params.productName}
${productUrl}`;
}

// 상세 템플릿 (LMS용 - 2000byte)
export function getDetailedTemplate(params: SmsTemplateParams): string {
  const keywordText = params.keywords.join(", ");
  const productUrl = generateProductUrl(params);

  const message = `━━━━━━━━━━━━━━━━━
🚗 [OK파츠] 신규 상품 알림

📌 매칭 키워드: ${keywordText}

🛒 상품명
${params.productName}

👉 상세보기
${productUrl}

※ 알림 해제는 쇼핑몰 마이페이지에서 가능합니다.
━━━━━━━━━━━━━━━━━`;

  return message;
}

// 템플릿 타입
export type SmsTemplateType = "basic" | "simple" | "detailed";

// 템플릿 선택 함수
export function getSmsTemplate(
  type: SmsTemplateType,
  params: SmsTemplateParams
): string {
  switch (type) {
    case "simple":
      return getSimpleTemplate(params);
    case "detailed":
      return getDetailedTemplate(params);
    case "basic":
    default:
      return getNewProductTemplate(params);
  }
}

// 메시지 길이 체크 (SMS: 90byte, LMS: 2000byte)
export function checkMessageLength(message: string): {
  length: number;
  type: "SMS" | "LMS";
  isValid: boolean;
} {
  // 한글은 2byte, 영문/숫자는 1byte
  const byteLength = new Blob([message]).size;

  if (byteLength <= 90) {
    return { length: byteLength, type: "SMS", isValid: true };
  } else if (byteLength <= 2000) {
    return { length: byteLength, type: "LMS", isValid: true };
  } else {
    return { length: byteLength, type: "LMS", isValid: false };
  }
}
