import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, query, where, getDocs } from "firebase/firestore";

// Firebase에서 공급사 계정 확인
export async function GET(request: NextRequest) {
  console.log("\n========== [Admin] 공급사 계정 확인 ==========");

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const supplierCode = searchParams.get("supplierCode");

    if (!userId && !supplierCode) {
      return NextResponse.json(
        { error: "userId or supplierCode parameter required" },
        { status: 400 }
      );
    }

    const suppliersRef = collection(db, "suppliers");
    let q;
    let searchKey = "";

    if (supplierCode) {
      console.log(`[Admin] supplierCode: ${supplierCode} 확인 중...`);
      q = query(suppliersRef, where("cafe24SupplierNo", "==", supplierCode));
      searchKey = supplierCode;
    } else {
      console.log(`[Admin] userId: ${userId} 확인 중...`);
      q = query(suppliersRef, where("userId", "==", userId));
      searchKey = userId!;
    }

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log(`[Admin] ❌ "${searchKey}" 계정을 찾을 수 없습니다.`);
      console.log("==============================================\n");
      return NextResponse.json(
        {
          found: false,
          message: `"${searchKey}" 계정을 찾을 수 없습니다.`
        },
        { status: 404 }
      );
    }

    const supplierDoc = querySnapshot.docs[0];
    const data = supplierDoc.data();
    const supplierData: any = { id: supplierDoc.id, ...data };

    console.log(`[Admin] ✅ "${searchKey}" 계정 발견!`);
    console.log("[Admin] 계정 정보:");
    console.log(`  - Firebase ID: ${supplierData.id}`);
    console.log(`  - userId: ${supplierData.userId}`);
    console.log(`  - companyName: ${supplierData.companyName || '없음'}`);
    console.log(`  - name: ${supplierData.name || '없음'}`);
    console.log(`  - phone: ${supplierData.phone || '없음'}`);
    console.log(`  - accountType: ${supplierData.accountType || '없음'}`);
    console.log(`  - businessNumber: ${supplierData.businessNumber || '없음'}`);
    console.log(`  - status: ${supplierData.status || '없음'}`);
    console.log(`  - cafe24SupplierNo: ${supplierData.cafe24SupplierNo || '없음'}`);
    console.log(`  - cafe24UserId: ${supplierData.cafe24UserId || '없음'}`);
    console.log(`  - cafe24UserStatus: ${supplierData.cafe24UserStatus || '없음'}`);
    console.log(`  - signupSource: ${supplierData.signupSource || '없음'}`);
    console.log(`  - createdAt: ${supplierData.createdAt || '없음'}`);
    console.log("==============================================\n");

    return NextResponse.json({
      found: true,
      supplier: supplierData
    });

  } catch (error: any) {
    console.error("\n[Admin] ❌ 에러 발생:", error.message);
    console.error(error);
    console.error("==============================================\n");

    return NextResponse.json(
      { error: "Failed to check supplier", details: error.message },
      { status: 500 }
    );
  }
}
