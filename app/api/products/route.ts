import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, addDoc, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";
import { verifyToken } from "@/lib/auth";

// 내 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
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

    // 내 상품만 조회
    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("supplierId", "==", payload.supplierId),
      orderBy("createdAt", "desc")
    );

    const productsSnapshot = await getDocs(q);
    const products = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// 상품 등록 (Firestore + Cafe24 동시 생성)
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const {
      productName,
      supplyPrice,
      sellingPrice,
      display,
      selling,
      categoryNo,
    } = body;

    // 유효성 검사 (필수: product_name, price, supply_price, category)
    if (!productName || !sellingPrice || !supplyPrice || !categoryNo) {
      return NextResponse.json(
        { error: "Required fields: productName, sellingPrice, supplyPrice, categoryNo" },
        { status: 400 }
      );
    }

    // 공급사 정보 조회 (supplier_code 가져오기)
    const supplierDoc = await getDoc(doc(db, "suppliers", payload.supplierId));

    if (!supplierDoc.exists()) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    const supplierData = supplierDoc.data();
    const supplierCode = supplierData.cafe24SupplierNo;

    if (!supplierCode) {
      return NextResponse.json(
        { error: "Supplier code not found. Please contact admin." },
        { status: 400 }
      );
    }

    // Firestore에 상품 저장 (draft 상태)
    const productsRef = collection(db, "products");
    const productDoc = await addDoc(productsRef, {
      supplierId: payload.supplierId,
      name: productName,
      supplyPrice,
      sellingPrice,
      display,
      selling,
      categoryNo,
      status: "draft",
      cafe24ProductNo: null,
      images: {
        cover: "",
        gallery: [],
      },
      createdAt: new Date().toISOString(),
    });

    // 카페24 상품 생성
    try {
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

      // 토큰 갱신 콜백
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

      // 카페24 상품 데이터 (product_code는 카페24가 자동 생성)
      const cafe24ProductData: any = {
        product_name: productName,
        price: parseInt(sellingPrice), // 필수: 판매가
        supply_price: parseInt(supplyPrice), // 공급가
        display: display || "T",
        selling: selling || "T",
        product_condition: "U", // 중고
        supplier_code: supplierCode,
        category: [{ category_no: categoryNo }],
      };

      const cafe24Response = await cafe24Client.createProduct(cafe24ProductData);

      const cafe24ProductNo =
        cafe24Response.product?.product_no ||
        cafe24Response.products?.[0]?.product_no;

      if (cafe24ProductNo) {
        // Firestore에 카페24 상품 번호 업데이트
        await updateDoc(doc(db, "products", productDoc.id), {
          cafe24ProductNo: cafe24ProductNo.toString(),
          status: "active",
          updatedAt: new Date().toISOString(),
        });
      }

      console.log("[Product Create] Cafe24 product created:", cafe24ProductNo);
    } catch (cafe24Error: any) {
      console.error("[Product Create] Cafe24 error:", cafe24Error.message);
      // 카페24 실패해도 Firestore에는 저장됨 (draft 상태)
    }

    return NextResponse.json(
      {
        success: true,
        productId: productDoc.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      { error: "Failed to create product", details: error.message },
      { status: 500 }
    );
  }
}
