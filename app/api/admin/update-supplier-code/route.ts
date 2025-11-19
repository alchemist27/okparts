import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, updateDoc } from "firebase/firestore";

// 임시 API - 공급사 코드 업데이트
export async function POST(request: NextRequest) {
  try {
    const { supplierId, supplierCode } = await request.json();

    console.log(`공급사 ${supplierId}에 코드 ${supplierCode} 설정 중...`);

    await updateDoc(doc(db, "suppliers", supplierId), {
      cafe24SupplierNo: supplierCode,
      updatedAt: new Date().toISOString(),
    });

    console.log('✅ 공급사 코드 업데이트 성공!');

    return NextResponse.json({
      success: true,
      supplierId,
      cafe24SupplierNo: supplierCode,
    });
  } catch (error: any) {
    console.error('❌ 업데이트 실패:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
