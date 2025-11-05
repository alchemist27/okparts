// SMS 알림 시스템 타입 정의

export interface UserNotification {
  phone: string; // 전화번호 (Primary Key)
  name: string; // 사용자 이름
  keywords: string[]; // 관심 키워드 배열
  consent_sms: boolean; // SMS 수신 동의
  last_notified: {
    [productNo: string]: string; // productNo -> timestamp
  };
  createdAt: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}

export interface NotificationLog {
  webhook_event_id?: string; // Webhook 이벤트 ID
  product_no: string; // 카페24 상품 번호
  product_name: string; // 상품명
  matched_keywords: string[]; // 매칭된 키워드
  sent_to: string[]; // 발송된 전화번호 목록
  processed_at: string; // ISO 8601
  success: boolean; // 발송 성공 여부
  error_message?: string; // 실패 시 에러 메시지
}

// API Request/Response 타입
export interface RegisterNotificationRequest {
  phone: string;
  name: string;
  keywords: string[];
  consent_sms: boolean;
}

export interface RegisterNotificationResponse {
  success: boolean;
  message: string;
  data?: UserNotification;
}

export interface ListNotificationResponse {
  success: boolean;
  data?: UserNotification;
}

export interface UnregisterNotificationRequest {
  phone: string;
}

export interface UnregisterNotificationResponse {
  success: boolean;
  message: string;
}
