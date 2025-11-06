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

// 기본 템플릿 - 신규 상품 알림 (90byte 이내 강제)
export function getNewProductTemplate(params: SmsTemplateParams): string {
  const keywordText = params.keywords.join(", ");
  const prefix = `[OK중고부품] ${keywordText}\n`;
  const suffix = `\n상품 등록`;

  // 90byte 제한 계산
  const maxProductNameBytes = 90 - new Blob([prefix + suffix]).size;

  // 상품명 자르기 (바이트 단위)
  let productName = params.productName;
  let productNameBytes = new Blob([productName]).size;

  if (productNameBytes > maxProductNameBytes) {
    // 바이트가 초과하면 글자 단위로 잘라내기
    while (new Blob([productName + "..."]).size > maxProductNameBytes && productName.length > 0) {
      productName = productName.slice(0, -1);
    }
    productName = productName + "...";
  }

  const message = `${prefix}${productName}${suffix}`;
  return message;
}

// 간단 템플릿 (키워드만)
export function getSimpleTemplate(params: SmsTemplateParams): string {
  const keywordText = params.keywords.join(", ");
  const productUrl = generateProductUrl(params);

  return `[OK중고부품] ${keywordText}
${params.productName}
${productUrl}`;
}

// 상세 템플릿 (사용 안 함 - 비용 절감)
export function getDetailedTemplate(params: SmsTemplateParams): string {
  // 기본 템플릿과 동일하게 처리 (비용 절감)
  return getNewProductTemplate(params);
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
  title?: string; // LMS일 때 제목
} {
  // 한글은 2byte, 영문/숫자는 1byte
  const byteLength = new Blob([message]).size;

  if (byteLength <= 90) {
    return { length: byteLength, type: "SMS", isValid: true };
  } else if (byteLength <= 2000) {
    return {
      length: byteLength,
      type: "LMS",
      isValid: true,
      title: "[OK중고부품] 신규상품" // 간결한 제목
    };
  } else {
    return {
      length: byteLength,
      type: "LMS",
      isValid: false,
      title: "[OK중고부품] 신규상품"
    };
  }
}
