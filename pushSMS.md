📌 기술 설계 문서

카페24 신규 상품 등록 → 키워드 기반 고객 알림 SMS 시스템

✅ System Overview
🎯 목적

고객이 등록한 관심 키워드에 맞는 새 상품이 등록될 때
실시간 문자(SMS) 로 자동 알림을 전송하는 시스템 구축

🧩 핵심 기능 흐름
[고객] 키워드 등록 + 문자 수신 동의
          ↓
[카페24] 신규 상품 등록 발생 (Event 90001)
          ↓ Webhook
[서버] 상품명 키워드 매칭
          ↓
[카페24 SMS API] 대상 사용자에게 문자 발송

✅ Architecture
         ┌──────────────────────────────┐
         │         Cafe24 Store         │
         │  • Admin API                 │
         │  • Webhook(Event 90001)      │
         └─────────────┬────────────────┘
                       │
        Webhook Trigger│
                       ▼
              ┌────────────────┐
              │  Backend API   │  (Next.js/Node)
              │  • Keyword Match
              │  • SMS Trigger
              │  • Retry & Log
              └──────┬─────────┘
                     │
              Keyword DB/Logs
                     ▼
     ┌──────────────────────────┐
     │      Firestore (or DB)   │
     │  • user_keywords         │
     │  • phone numbers         │
     │  • processed logs        │
     └──────────────────────────┘
                     │
       SMS API       ▼
      ┌──────────────────────────┐
      │ Cafe24 SMS Admin API     │
      │ (mall.write_notification)│
      └──────────────────────────┘
                     │
                     ▼
                고객 휴대폰 📩

✅ 데이터 구조 설계
1) 사용자 키워드 저장 구조

(Firestore 예시)

{
  "users": {
    "{member_id}": {
      "keywords": ["쏘렌토", "카니발"],
      "phone": "01012345678",
      "consent_sms": true,
      "last_notified": {
        "product_1234": true
      }
    }
  }
}

2) 처리 로그
{
  "event_id": "webhook_log_id",
  "product_no": "1234",
  "matched_keywords": ["쏘렌토"],
  "sent_to": ["01012345678"],
  "processed_at": "timestamp"
}

✅ API 요구사항
구분	엔드포인트	목적	비고
Webhook	Event 90001	신규 상품 등록 감지	권한 mall.read_product
SMS 발송	POST /api/v2/admin/sms	문자 전송	권한 mall.write_notification
Webhook 로그 조회	GET …/webhook-log	누락 이벤트 재처리	장애 대비
✅ Webhook 처리 로직
Workflow Pseudo-code
onWebhook(event) {
  if (event.type !== '90001') return;

  const { product_name, product_no } = event.data.product;
  const users = await getAllUsers();

  for (const user of users) {
    for (const keyword of user.keywords) {
      if (product_name.includes(keyword) && user.consent_sms) {

        if (!alreadySent(user, product_no)) {
          await sendSMS(user.phone, keyword, product_no);
          logSent(user, product_no);
        }
      }
    }
  }
}

✅ Webhook 신뢰성 대응
위험 요소	해결 방안
Webhook 누락 가능성	✅ Webhook 로그 조회(Fallback)
Webhook 실패 누적 시 자동차단	✅ 응답 즉시 200 OK 반환
재처리 시 중복 발송 위험	✅ 처리 이력 관리 (last_notified & product_no)
운영 전략
Task	주기
Webhook 로그 보정	1–4시간
SMS 잔액 체크	하루 1회
실패율 모니터링	지속
✅ SMS 발송 정책

광고성 여부에 따라 수신동의 필수 → 고객 UI 동의 체크 저장

동일 상품에 대한 중복 발송 방지

시간대 정책 적용 가능 (예: 21:00~09:00 발송 지연 큐 처리)

긴급성 높지 않으므로 발송 큐 처리 가능 (비동기)

✅ 확장 기능 로드맵 (선택)
기능	구현 난이도	비고
알림톡으로 전환	중	템플릿 승인 필요
키워드 다중 가중치	중	맞춤 추천 강화
Admin 대시보드	중	운영자 관리 편의
AI 기반 분류	상	상품명 자동 매핑
✅ 운영 비용
항목	설명
SMS 비용	카페24 SMS 충전 방식
서버 비용	Firebase Hosting + Cloud Functions Free Tier 내 가능
API 비용	카페24 무료

👉 초기 1–2천 사용자까지 거의 무료 운영 가능

✅ 결론
질문	답변
카페24에서 신규 상품 이벤트 바로 받을 수 있는가?	✅ Event 90001 Webhook
키워드 매칭 & 자동 SMS 발송 가능한가?	✅ Admin API 사용
Webhook 누락 문제 대응 가능한가?	✅ 로그 조회 + 중복방지로 해결
카페24 기능 변경 필요?	❌ 전혀 없음

✅ 안정적이고 비용 효율적이며, 개발 난이도도 적절한 솔루션 확정



---------------------------------------------------
⏺ 문서와 UI를 확인했습니다. 현재 상태를 분석하고 구현 계획을 세워보겠습니다.

  📋 현재 상태 분석

  완료된 부분:
  - ✅ UI 디자인 완성 (floating.html:33-108)
  - ✅ 프론트엔드 기본 로직 (키워드 추가/삭제, 폼 검증)
  - ✅ 기술 설계 문서 작성

  미완성 부분:
  - ❌ 백엔드 API 없음 (floating.html:198에 TODO 주석)
  - ❌ 데이터베이스 연동 없음
  - ❌ 카페24 Webhook 설정 및 처리 로직 없음
  - ❌ SMS 발송 기능 없음

  🎯 구현 계획

  구현을 위해 다음과 같은 단계로 진행하겠습니다:

  Phase 1: 기본 인프라 구축

  1. 데이터베이스 선택 및 스키마 설계
    - Firestore vs 다른 DB 선택
    - users 컬렉션, logs 컬렉션 구조 확정
  2. 백엔드 API 프레임워크 선택
    - Next.js API Routes vs Express vs Cloud Functions
    - 프로젝트 구조 결정

  Phase 2: 키워드 등록 API 구현

  3. POST /api/notifications/register - 키워드 등록
    - 전화번호, 이름, 키워드 저장
    - 중복 체크 및 검증
  4. GET /api/notifications/user - 사용자 키워드 조회
  5. DELETE /api/notifications/unregister - 키워드 삭제

  Phase 3: 카페24 연동

  6. 카페24 Webhook 설정
    - Event 90001 (신규 상품 등록) 등록
    - Webhook URL 설정
  7. POST /api/webhook/product - Webhook 수신 처리
    - 상품명 파싱
    - 키워드 매칭 로직
    - 중복 발송 방지 (last_notified)
  8. 카페24 SMS API 연동
    - mall.write_notification 권한 설정
    - SMS 발송 함수 구현

  Phase 4: 안정성 강화

  9. 에러 처리 및 재시도 로직
    - Webhook 실패 대응
    - SMS 발송 실패 재시도
  10. 로깅 및 모니터링
    - 처리 이력 저장
    - 발송 성공/실패 추적

  Phase 5: 프론트엔드 연동

  11. floating.html API 연동
    - fetch로 등록 API 호출
    - 에러 처리 및 사용자 피드백

  ❓ 구현 전 확인 필요 사항

  구체적인 구현을 시작하기 전에 몇 가지 확인이 필요합니다:

  1. 백엔드 환경: 어떤 환경을 사용하시나요?
    - Next.js 프로젝트가 이미 있나요? (문서에서 Next.js 언급)
    - Firebase/Firestore를 사용할 예정인가요?
    - 서버 호스팅은 어디서 하나요?
  2. 카페24 API 자격증명:
    - 카페24 API App이 이미 등록되어 있나요?
    - Access Token 발급 방법은 준비되어 있나요?
  3. 우선순위:
    - 전체 시스템을 구축할까요?
    - 아니면 특정 부분부터 시작할까요? (예: 키워드 등록 API만 먼저)

  어떤 부분부터 구현을 시작하시겠어요?

> 1. 상품등록을 위한 next.js, firebase, vercel 기반 환경이 있어. 여기에 추가로 구축이 가능한걸까? 2. 카페24 api 앱은 이미 준비되어 있어.권한만 추가하면 돼. 3. 우선순위는 너와 더 협의후 결정하고 싶어 

⏺ 좋습니다! 기존 환경을 활용할 수 있다면 더 효율적으로 구축할 수 있겠네요. 먼저 기존 프로젝트 구조를 파악해보겠습니다.

⏺ Bash(ls -la)
  ⎿  total 128                                             
     drwxr-xr-x@  19 alchemist  staff   608 Nov  5 17:43 .
     drwx------@ 160 alchemist  staff  5120 Nov  5 17:43 ..
     … +17 lines (ctrl+o to expand)

⏺ Search(pattern: "**/{package.json,firebase.json,vercel.json,next.config.*}")
  ⎿  Found 0 files 

⏺ 아, 현재 디렉토리는 카페24 스킨 파일들만 있네요. Next.js 프로젝트는 별도 위치에 있는 것 같습니다.

  floating.html에서 https://okparts.vercel.app로 연결되는 상품등록 시스템이 있는데, 이 Next.js 프로젝트를 확인해보겠습니다.

  🤔 구조 파악을 위한 질문

  1. Next.js 프로젝트 위치
  - 이 Next.js 프로젝트는 어디에 있나요? (로컬 경로)
  - 같이 작업할 수 있도록 경로를 알려주시겠어요?

  2. 기존 프로젝트 구조 확인
  - Firebase는 어떻게 사용 중인가요?
    - Authentication (사용자 로그인)?
    - Firestore (데이터베이스)?
    - Cloud Functions?
    - Firebase Admin SDK?

  3. 환경 변수 관리
  - 카페24 API 자격증명은 어떻게 관리 중인가요?
  - .env 파일에 이미 저장되어 있나요?

  💡 통합 방안 제안

  기존 환경을 활용하면 이렇게 구축할 수 있습니다:

  방안 A: 기존 Next.js 프로젝트에 통합 (추천)

  okparts-nextjs/
  ├── pages/api/
  │   ├── products/         # 기존 상품등록 API
  │   ├── notifications/    # 🆕 알림등록 API
  │   │   ├── register.ts   # POST - 키워드 등록
  │   │   ├── list.ts       # GET - 사용자 키워드 조회
  │   │   └── unregister.ts # DELETE - 등록 취소
  │   └── webhook/
  │       └── cafe24.ts     # 🆕 Webhook 수신
  장점:
  - 기존 Firebase 설정 재사용
  - 동일한 도메인 사용 (CORS 문제 없음)
  - Vercel 배포 환경 그대로 사용
  - 관리 포인트 단일화

  방안 B: 별도 마이크로서비스 구축

  okparts-notification/     # 🆕 새 프로젝트
  ├── pages/api/
  │   ├── notifications/
  │   └── webhook/
  장점:
  - 독립적인 배포 및 관리
  - 알림 시스템 장애 시 상품등록에 영향 없음

  단점:
  - Firebase 프로젝트 별도 설정 필요
  - 도메인/환경변수 이중 관리

  📊 우선순위 제안

  다음 순서로 구현하는 것을 추천드립니다:

  Phase 1: 데이터 저장 (1-2일)

  1. Firestore 스키마 설계 및 구축
  2. API: POST /api/notifications/register
  3. 프론트엔드 연동 (floating.html 수정)
  4. 테스트: UI에서 키워드 등록 → Firestore 확인
  Why? 가장 기본적이고 독립적인 기능. Webhook 없이도 동작 확인 가능

  Phase 2: Webhook 수신 및 매칭 로직 (2-3일)

  5. API: POST /api/webhook/cafe24
  6. 키워드 매칭 알고리즘 구현
  7. 중복 발송 방지 로직
  8. 카페24 Webhook 등록 (Event 90001)
  9. 테스트: 상품 등록 → 콘솔 로그 확인
  Why? SMS 연동 전에 매칭 로직이 제대로 작동하는지 검증

  Phase 3: SMS 발송 (1-2일)

  10. 카페24 SMS API 연동
  11. mall.write_notification 권한 추가
  12. SMS 발송 함수 구현
  13. 전체 플로우 테스트
  Why? 실제 비용이 발생하므로 모든 로직 검증 후 마지막에 연동

  Phase 4: 안정성 강화 (1-2일)

  14. 에러 처리 및 재시도 로직
  15. Webhook 로그 조회 Fallback
  16. 모니터링 및 알림



