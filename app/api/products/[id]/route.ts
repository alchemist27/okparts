import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, getDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { verifyToken } from "@/lib/auth";

// 상품 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 토큰 검증
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 상품 조회
    const productDoc = await getDoc(doc(db, "products", id));

    if (!productDoc.exists()) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const productData = productDoc.data();

    // 본인의 상품인지 확인
    if (productData.supplierId !== payload.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      product: {
        id: productDoc.id,
        ...productData,
      },
    });
  } catch (error: any) {
    console.error("Product fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

// 상품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 토큰 검증
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 상품 조회
    const productDoc = await getDoc(doc(db, "products", id));

    if (!productDoc.exists()) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const productData = productDoc.data();

    // 본인의 상품인지 확인
    if (productData.supplierId !== payload.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // FormData 파싱
    const formData = await request.formData();
    const productName = formData.get("productName") as string;
    const summaryDescription = formData.get("summaryDescription") as string;
    const sellingPrice = formData.get("sellingPrice") as string;
    const supplyPrice = formData.get("supplyPrice") as string;
    const categoryNo = formData.get("categoryNo") as string;

    // 유효성 검사
    if (!productName || !sellingPrice || !supplyPrice || !categoryNo) {
      return NextResponse.json(
        { error: "Required fields: productName, sellingPrice, supplyPrice, categoryNo" },
        { status: 400 }
      );
    }

    // 가격 유효성 검증
    const sellingPriceNum = parseInt(sellingPrice);
    const supplyPriceNum = parseInt(supplyPrice);
    if (isNaN(sellingPriceNum) || isNaN(supplyPriceNum) || sellingPriceNum <= 0 || supplyPriceNum <= 0) {
      return NextResponse.json(
        { error: "올바른 가격을 입력해주세요" },
        { status: 400 }
      );
    }

    const cafe24ProductNo = productData.cafe24ProductNo;

    // Firestore 업데이트 (항상 수행)
    await updateDoc(doc(db, "products", id), {
      name: productName,
      summaryDescription: summaryDescription || "",
      sellingPrice: sellingPriceNum,
      supplyPrice: supplyPriceNum,
      categoryNo: parseInt(categoryNo),
      updatedAt: new Date().toISOString(),
    });

    // 카페24 상품이 있으면 카페24도 업데이트
    if (cafe24ProductNo) {
      try {
        console.log("[Product Update] 카페24 상품 업데이트 시작");

        const { Cafe24ApiClient } = await import("@/lib/cafe24");

        const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
        if (!mallId) {
          throw new Error("Mall ID not configured");
        }

        const installDocRef = doc(db, "installs", mallId);
        const installDoc = await getDoc(installDocRef);

        if (!installDoc.exists()) {
          throw new Error("Cafe24 app not installed");
        }

        const installData = installDoc.data();

        const onTokenRefresh = async (newAccessToken: string, newRefreshToken: string, expiresAt: string) => {
          await updateDoc(installDocRef, {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: expiresAt,
            updatedAt: new Date().toISOString(),
          });
        };

        const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
          refreshToken: installData.refreshToken,
          clientId: process.env.CAFE24_CLIENT_ID,
          clientSecret: process.env.CAFE24_CLIENT_SECRET,
          onTokenRefresh,
        });

        // 카페24 상품 업데이트 데이터
        const cafe24UpdateData = {
          product_name: productName,
          summary_description: summaryDescription || "",
          price: sellingPriceNum,
          supply_price: supplyPriceNum,
          add_category_no: [{
            category_no: parseInt(categoryNo),
            recommend: "F",
            new: "F"
          }],
        };

        console.log("[Product Update] 카페24 업데이트 데이터:", cafe24UpdateData);

        await cafe24Client.updateProduct(cafe24ProductNo, cafe24UpdateData);

        console.log("[Product Update] 카페24 상품 업데이트 완료");

      } catch (cafe24Error: any) {
        console.error("[Product Update] 카페24 업데이트 실패:", cafe24Error.message);
        // 카페24 실패해도 Firestore는 이미 업데이트됨
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Product update error:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

// 상품 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 토큰 검증
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 상품 조회
    const productDoc = await getDoc(doc(db, "products", id));

    if (!productDoc.exists()) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const productData = productDoc.data();

    // 본인의 상품인지 확인
    if (productData.supplierId !== payload.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cafe24ProductNo = productData.cafe24ProductNo;

    // 카페24에서도 삭제
    if (cafe24ProductNo) {
      try {
        console.log("[Product Delete] 카페24 상품 삭제 시작");

        const { Cafe24ApiClient } = await import("@/lib/cafe24");

        const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID;
        if (!mallId) {
          throw new Error("Mall ID not configured");
        }

        const installDocRef = doc(db, "installs", mallId);
        const installDoc = await getDoc(installDocRef);

        if (!installDoc.exists()) {
          throw new Error("Cafe24 app not installed");
        }

        const installData = installDoc.data();

        const onTokenRefresh = async (newAccessToken: string, newRefreshToken: string, expiresAt: string) => {
          await updateDoc(installDocRef, {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: expiresAt,
            updatedAt: new Date().toISOString(),
          });
        };

        const cafe24Client = new Cafe24ApiClient(mallId, installData.accessToken, {
          refreshToken: installData.refreshToken,
          clientId: process.env.CAFE24_CLIENT_ID,
          clientSecret: process.env.CAFE24_CLIENT_SECRET,
          onTokenRefresh,
        });

        // 카페24 상품 삭제 API 호출
        await cafe24Client.deleteProduct(cafe24ProductNo);

        console.log("[Product Delete] 카페24 상품 삭제 완료");

      } catch (cafe24Error: any) {
        console.error("[Product Delete] 카페24 삭제 실패:", cafe24Error.message);
        // 카페24 실패해도 Firestore는 삭제
      }
    }

    // Firestore에서 삭제
    await deleteDoc(doc(db, "products", id));

    console.log("[Product Delete] Firestore 상품 삭제 완료");

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Product delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
