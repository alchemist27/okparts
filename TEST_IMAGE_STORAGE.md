# Cafe24 이미지 저장 방식 테스트

## 목적
Cafe24가 이미지를 자체 서버로 복사하는지, 아니면 Firebase URL을 링크로만 저장하는지 확인

## 테스트 절차

### 1단계: 테스트 상품 등록
1. 상품 1개를 등록 (이미지 1장)
2. Firebase Storage에서 이미지 URL 확인
   - 예: `https://firebasestorage.googleapis.com/v0/b/okparts-cf24.../o/uploads%2F...`

### 2단계: Cafe24에서 이미지 URL 확인
1. Cafe24 관리자 → 상품 관리 → 등록한 상품 클릭
2. 상품 상세 이미지 URL 확인
3. **두 가지 경우:**

   **Case A: Cafe24 URL로 변경됨 ✓**
   ```
   https://cafe24.poxo.com/...
   또는
   https://[your-mall].cafe24.com/...
   ```
   → Firebase 삭제 가능!

   **Case B: Firebase URL 그대로 ❌**
   ```
   https://firebasestorage.googleapis.com/...
   ```
   → Firebase 삭제 불가!

### 3단계: 실제 삭제 테스트 (신중하게!)
1. Firebase Console → Storage
2. 테스트 상품의 이미지 **하나만** 삭제
3. 쇼핑몰 상품 페이지 새로고침
4. 이미지가 여전히 보이는지 확인

### 결과
- **이미지 보임**: Cafe24가 복사했음 → 정기 삭제 가능
- **이미지 깨짐**: URL만 링크됨 → Firebase 유지 필요

---

## 예상: 대부분 Case A (복사)

일반적으로 쇼핑몰 플랫폼은:
- 외부 이미지를 자체 CDN으로 복사
- 이유:
  1. 외부 링크 끊김 방지
  2. 자체 CDN으로 빠른 로딩
  3. 이미지 최적화 적용
  4. 보안 및 제어

하지만 **반드시 테스트 필요**!
