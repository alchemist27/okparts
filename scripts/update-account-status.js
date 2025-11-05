// Firestore 계정 상태를 active로 업데이트하는 스크립트
const { initializeApp, getApps } = require("firebase/app");
const { getFirestore, collection, query, where, getDocs, updateDoc, doc } = require("firebase/firestore");

async function updateAccountStatus(userId) {
  console.log(`\n========== 계정 상태 업데이트 시작: ${userId} ==========`);

  // Firebase 초기화
  let firestore;
  if (getApps().length === 0) {
    const app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
    firestore = getFirestore(app);
  } else {
    firestore = getFirestore(getApps()[0]);
  }

  // 계정 찾기
  console.log(`[1] 계정 검색 중...`);
  const suppliersRef = collection(firestore, "suppliers");
  const q = query(suppliersRef, where("userId", "==", userId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.error(`❌ 계정을 찾을 수 없습니다: ${userId}`);
    return;
  }

  const supplierDoc = snapshot.docs[0];
  const supplierData = supplierDoc.data();

  console.log(`[2] 계정 정보:`, {
    id: supplierDoc.id,
    userId: supplierData.userId,
    companyName: supplierData.companyName,
    status: supplierData.status,
  });

  // 상태 업데이트
  if (supplierData.status === "active") {
    console.log(`✅ 이미 active 상태입니다.`);
    return;
  }

  console.log(`[3] 상태를 active로 업데이트 중...`);
  await updateDoc(doc(firestore, "suppliers", supplierDoc.id), {
    status: "active",
    updatedAt: new Date().toISOString(),
  });

  console.log(`✅ 계정 상태가 active로 업데이트되었습니다!`);
  console.log(`========== 업데이트 완료 ==========\n`);
}

// 실행
const userId = process.argv[2] || "tnstls2626";
updateAccountStatus(userId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 에러 발생:", error);
    process.exit(1);
  });
