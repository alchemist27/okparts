# OKPARTS ADMIN

오케이중고부품 공급사 상품 등록 시스템 (카페24 연동)

## 기능

- 🔐 공급사 회원가입/로그인
- 📦 상품 등록 (모바일 카메라 지원)
- 🖼️ 이미지 자동 리사이즈 및 최적화
- 🏪 카페24 쇼핑몰 자동 연동
- 📱 PWA 지원 (홈화면 추가, 오프라인 기능)

## 설치

```bash
npm install
```

## 환경 변수 설정

`.env.local` 파일을 생성하고 다음 정보를 입력하세요:

```env
# Cafe24 API
NEXT_PUBLIC_CAFE24_MALL_ID=your_mall_id
NEXT_PUBLIC_CAFE24_CLIENT_ID=your_client_id
CAFE24_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_CAFE24_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Firebase (Firebase 콘솔에서 발급)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# JWT Secret (임의의 랜덤 문자열)
JWT_SECRET=your-secret-key

# API Base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

## 로컬 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

## 배포 전 체크리스트

1. ✅ Firebase 프로젝트 생성 및 설정
   - Authentication 활성화
   - Firestore Database 생성
   - Storage 활성화

2. ✅ 카페24 개발자센터에서 앱 등록
   - Client ID, Secret 발급
   - Redirect URI 설정

3. ✅ Vercel 환경 변수 설정
   - 모든 환경 변수를 Vercel 대시보드에 입력

4. ✅ PWA 아이콘 생성
   - `public/icon-192.png`
   - `public/icon-512.png`

## 주요 플로우

### 1. 앱 설치 (대표운영자)
1. `/api/auth/install` 접속
2. 카페24 OAuth 승인
3. 토큰이 Firestore에 저장됨

### 2. 공급사 회원가입
1. `/signup` 페이지에서 가입
2. 자동으로 Firestore에 계정 생성
3. JWT 토큰 발급

### 3. 상품 등록
1. `/products/new` 페이지
2. 필수 정보 입력 + 이미지 촬영/업로드
3. 자동으로 카페24에 상품 등록

## 기술 스택

- **프론트엔드**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **백엔드**: Next.js API Routes
- **데이터베이스**: Firebase Firestore
- **파일 저장소**: Firebase Storage
- **이미지 처리**: Sharp
- **인증**: JWT + bcrypt
- **외부 API**: 카페24 Admin API (2025-09-01)

## 프로젝트 구조

```
├── app/
│   ├── api/
│   │   ├── auth/              # OAuth 및 인증
│   │   ├── supplier/          # 공급사 회원가입/로그인
│   │   ├── products/          # 상품 CRUD
│   │   └── categories/        # 카테고리 조회
│   ├── dashboard/             # 대시보드
│   ├── products/              # 상품 관리
│   ├── login/                 # 로그인
│   └── signup/                # 회원가입
├── lib/
│   ├── firebase.ts            # Firebase 설정
│   ├── cafe24.ts              # 카페24 API 클라이언트
│   └── auth.ts                # JWT 인증
├── types/
│   └── index.ts               # TypeScript 타입 정의
├── utils/
│   └── imageProcessor.ts      # 이미지 처리 유틸
└── public/
    ├── manifest.json          # PWA 매니페스트
    └── sw.js                  # Service Worker
```

## 라이선스

MIT
