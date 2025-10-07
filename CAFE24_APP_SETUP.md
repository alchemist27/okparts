# 카페24 앱 등록 가이드

# 카페24 admin api 공식 문서
https://developers.cafe24.com/docs/ko/api/admin/#api-index
최신 버전 2025-09-01 사용


## 배포된 애플리케이션 정보

- **프로덕션 URL**: https://okparts.vercel.app
- **GitHub 저장소**: https://github.com/alchemist27/okpartsadmin.git

## 카페24 개발자 센터 앱 등록

### 1. 앱 기본 정보
- **앱 이름**: OKPARTS ADMIN
- **앱 설명**: 오케이중고부품 간편 등록 시스템
- **앱 URL**: https://okparts.vercel.app/api/auth/callback

### 2. OAuth 설정
- **Redirect URI**: https://okparts.vercel.app/api/auth/callback

### 3. 필요한 권한
- 상품 목록 조회
- 상품 정보 수정 (가격, 표시 여부, 판매 여부)
- 상품 등록 조회 수정 삭제
- 공급사 등록 수정 삭제

## 발급받을 정보

카페24 개발자 센터에서 앱 등록 후 다음 정보를 발급받으세요:

1. **Client ID**: 앱의 고유 식별자
2. **Client Secret**: 앱의 비밀키

## 환경 변수 설정

발급받은 정보를 Vercel 대시보드에서 환경 변수로 설정하세요:

1. [Vercel 대시보드](https://vercel.com/neuron-architecture/okpartsadmin) 접속
2. Settings → Environment Variables
3. 다음 변수들을 추가:

```
NEXT_PUBLIC_CAFE24_CLIENT_ID=발급받은_클라이언트_ID
NEXT_PUBLIC_CAFE24_CLIENT_SECRET=발급받은_클라이언트_시크릿
NEXT_PUBLIC_CAFE24_REDIRECT_URI=https://okparts.vercel.app/api/auth/callback

```
## 주의사항

- Client Secret은 절대 공개되지 않도록 주의하세요
- Redirect URI는 정확히 일치해야 합니다
- 프로덕션 환경에서는 HTTPS가 필수입니다 