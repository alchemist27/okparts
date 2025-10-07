# Vercel 배포 가이드

## 1. GitHub 저장소 생성 및 푸시

```bash
# Git 커밋
git commit -m "Initial commit: Cafe24 supplier admin app"

# GitHub에 저장소 생성 후
git remote add origin https://github.com/alchemist27/okpartsadmin.git
git branch -M main
git push -u origin main
```

## 2. Vercel 프로젝트 설정

1. https://vercel.com 로그인
2. "Add New Project" 클릭
3. GitHub 저장소 연결 (`alchemist27/okpartsadmin`)
4. Framework: **Next.js** (자동 감지됨)
5. Build Command: `npm run build`
6. Output Directory: `.next`

## 3. 환경 변수 설정

Vercel 대시보드 → Settings → Environment Variables에 다음 추가:

### Cafe24 API
```
NEXT_PUBLIC_CAFE24_MALL_ID=your_mall_id
NEXT_PUBLIC_CAFE24_CLIENT_ID=your_client_id
CAFE24_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_CAFE24_REDIRECT_URI=https://your-domain.vercel.app/api/auth/callback
```

### Firebase
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### JWT
```
JWT_SECRET=your-random-secret-key-min-32-chars
```

### API Base URL
```
NEXT_PUBLIC_API_BASE_URL=https://your-domain.vercel.app
```

## 4. Firebase 설정

1. https://console.firebase.google.com 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. **Authentication** 활성화
4. **Firestore Database** 생성 (테스트 모드로 시작)
5. **Storage** 활성화
6. 웹 앱 추가 → Config 정보 복사 → Vercel 환경 변수에 입력

### Firestore 보안 규칙
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /suppliers/{supplierId} {
      allow read, write: if request.auth != null;
    }
    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        request.resource.data.supplierId == request.auth.uid;
    }
    match /installs/{installId} {
      allow read: if request.auth != null;
      allow write: if false; // 서버에서만 쓰기
    }
  }
}
```

### Storage 보안 규칙
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{productId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 5. 카페24 앱 등록

1. https://developers.cafe24.com 접속
2. 새 앱 등록
3. **앱 정보**:
   - 앱 이름: OKPARTS ADMIN
   - 앱 URL: `https://your-domain.vercel.app`
4. **OAuth 설정**:
   - Redirect URI: `https://your-domain.vercel.app/api/auth/callback`
5. **권한 (Scopes)**:
   - `mall.read_product`
   - `mall.write_product`
   - `mall.read_supplier`
   - `mall.write_supplier`
   - `mall.read_category`
6. Client ID/Secret 발급 → Vercel 환경 변수에 입력

## 6. JWT Secret 생성

터미널에서 랜덤 문자열 생성:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

출력된 문자열을 `JWT_SECRET` 환경 변수에 입력

## 7. 배포

1. Vercel 대시보드에서 "Deploy" 클릭
2. 빌드 완료 후 도메인 확인 (예: `okpartsadmin.vercel.app`)
3. **중요**: 카페24 개발자센터에서 Redirect URI를 실제 도메인으로 업데이트

## 8. 테스트 플로우

### 대표운영자 (최초 1회)
1. `https://your-domain.vercel.app/api/auth/install` 접속
2. 카페24 로그인 및 앱 설치 승인
3. 설치 완료 페이지 확인

### 공급사
1. `https://your-domain.vercel.app/signup` 접속
2. 회원가입
3. 대시보드에서 상품 등록

## 9. 로컬 node_modules 삭제

배포 완료 후 로컬에서:
```bash
rm -rf node_modules
```

용량 **454MB** 절약!

## 10. 나중에 로컬 개발 재개 시

```bash
npm install  # node_modules 재생성
npm run dev  # 로컬 서버 실행
```

## 문제 해결

### 빌드 실패 시
- Vercel 빌드 로그 확인
- 환경 변수가 모두 설정되었는지 확인
- `package.json`의 dependencies 확인

### 카페24 OAuth 실패 시
- Redirect URI가 정확히 일치하는지 확인 (끝에 `/` 없음)
- Client ID/Secret이 올바른지 확인
- 카페24 앱이 활성화 상태인지 확인

### Firebase 연결 실패 시
- Firebase Config가 올바른지 확인
- Firestore/Storage가 활성화되었는지 확인
- 보안 규칙이 적용되었는지 확인

## 유용한 명령어

```bash
# Vercel CLI 설치 (선택)
npm i -g vercel

# Vercel에서 로그 확인
vercel logs

# 환경 변수 확인
vercel env ls

# 재배포
git push origin main  # 자동 배포됨
```
