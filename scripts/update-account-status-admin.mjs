// Firebase Admin SDK를 사용하여 계정 상태를 업데이트하는 스크립트
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// .env.local 로드
config({ path: '.env.local' });

async function updateAccountStatus(userId, newStatus) {
  console.log(`\n========== 계정 상태 업데이트 시작: ${userId} ==========`);

  try {
    // Firebase Admin 초기화
    if (getApps().length === 0) {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      if (!serviceAccountPath) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH 환경 변수가 설정되지 않았습니다');
      }

      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

      initializeApp({
        credential: cert(serviceAccount)
      });
    }

    const db = getFirestore();

    // 계정 찾기
    console.log(`[1] 계정 검색 중: ${userId}`);
    const suppliersRef = db.collection('suppliers');
    const snapshot = await suppliersRef.where('userId', '==', userId).get();

    if (snapshot.empty) {
      console.error(`❌ 계정을 찾을 수 없습니다: ${userId}`);
      return;
    }

    const supplierDoc = snapshot.docs[0];
    const supplierData = supplierDoc.data();

    console.log(`[2] 현재 계정 정보:`, {
      id: supplierDoc.id,
      userId: supplierData.userId,
      companyName: supplierData.companyName,
      currentStatus: supplierData.status,
    });

    // 상태 업데이트
    if (supplierData.status === newStatus) {
      console.log(`✅ 이미 ${newStatus} 상태입니다.`);
      return;
    }

    console.log(`[3] 상태를 ${newStatus}로 업데이트 중...`);
    await supplierDoc.ref.update({
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ 계정 상태가 ${supplierData.status} → ${newStatus}로 업데이트되었습니다!`);
    console.log(`========== 업데이트 완료 ==========\n`);

  } catch (error) {
    console.error('❌ 에러 발생:', error);
    throw error;
  }
}

// 실행
const userId = process.argv[2] || 'tnstls2626';
const status = process.argv[3] || 'active';

updateAccountStatus(userId, status)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('스크립트 실행 실패:', error);
    process.exit(1);
  });
