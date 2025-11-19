import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { verifyToken } from "@/lib/auth";
import type {
  BulkProductInput,
  BulkProductRegistrationRequest,
  BulkProductRegistrationResult,
  ProductRegistrationResult,
} from "@/lib/bulk-product-types";

// 고정 값 설정
const FIXED_VALUES = {
  sellingPrice: 0,
  categoryNo: 48,
  summaryDescription: "원클릭카",
  sellerPhone: "031-351-5314",
  description: `본 상품은 자동차 중고부품 입니다.

라이트, 후미등, 실내 또는 실외의 부품은 생활기스가 있을 수 있습니다.
본넷, 휀다, 도어, 범퍼 등의 외장부품은 판금과 도색이 필요할 수도 있습니다.
택배가능하며 현장에오시면 방문수령도 가능합니다.
(방문수령 원하시는 분은 담당자와 통화 후 수령가능합니다)

변심에 의한 환불은 불가 하오니 신중히 생각 후 구매 바랍니다.

감사합니다. `,
} as const;


export async function POST(request: NextRequest) {
  console.log("\n========== [Bulk Product Create] 대량 상품 등록 시작 ==========");

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

    // 공급사 정보 조회
    const supplierDoc = await getDoc(doc(db, "suppliers", payload.supplierId));

    if (!supplierDoc.exists()) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const supplierData = supplierDoc.data();
    const supplierCode = supplierData.cafe24SupplierNo;

    if (!supplierCode) {
      return NextResponse.json(
        { error: "Supplier code not found. Please contact admin." },
        { status: 400 }
      );
    }

    // 요청 데이터 파싱
    const requestData: BulkProductRegistrationRequest = await request.json();

    console.log(`[Bulk Product Create] 공급사 코드: ${requestData.supplierCode}`);
    console.log(`[Bulk Product Create] 등록할 상품 수: ${requestData.products.length}`);

    // 공급사 코드 검증
    if (requestData.supplierCode !== supplierCode) {
      return NextResponse.json(
        { error: "Supplier code mismatch" },
        { status: 400 }
      );
    }

    // 결과 저장
    const results: ProductRegistrationResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    // Cafe24 클라이언트 초기화
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

    const onTokenRefresh = async (
      newAccessToken: string,
      newRefreshToken: string,
      expiresAt: string
    ) => {
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

    // 각 상품 처리
    for (let i = 0; i < requestData.products.length; i++) {
      const product = requestData.products[i];

      console.log(
        `\n[Bulk Product Create] [${i + 1}/${requestData.products.length}] 상품 처리 시작: ${product.productName}`
      );

      try {
        // 상품 등록 로직 실행
        const result = await registerSingleProduct(
          product,
          payload.supplierId,
          supplierCode,
          cafe24Client,
          i
        );

        results.push(result);

        if (result.success) {
          successCount++;
          console.log(
            `[Bulk Product Create] [${i + 1}/${requestData.products.length}] ✅ 성공: ${product.productName}`
          );
        } else {
          failedCount++;
          console.log(
            `[Bulk Product Create] [${i + 1}/${requestData.products.length}] ❌ 실패: ${product.productName} - ${result.error}`
          );
        }
      } catch (error: any) {
        failedCount++;
        const errorResult: ProductRegistrationResult = {
          index: i,
          productName: product.productName,
          success: false,
          error: error.message || "Unknown error",
        };
        results.push(errorResult);

        console.error(
          `[Bulk Product Create] [${i + 1}/${requestData.products.length}] ❌ 에러: ${product.productName}`,
          error.message
        );
      }

      // 각 상품 처리 후 잠시 대기 (API 레이트 리밋 방지)
      if (i < requestData.products.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기
      }
    }

    const responseData: BulkProductRegistrationResult = {
      total: requestData.products.length,
      success: successCount,
      failed: failedCount,
      results,
    };

    console.log("\n========== [Bulk Product Create] 대량 상품 등록 완료 ==========");
    console.log(`[Bulk Product Create] 전체: ${responseData.total}개`);
    console.log(`[Bulk Product Create] 성공: ${responseData.success}개`);
    console.log(`[Bulk Product Create] 실패: ${responseData.failed}개`);
    console.log("=================================================================\n");

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    console.error("\n========== [Bulk Product Create] 치명적 오류 ==========");
    console.error("[Bulk Product Create] 에러 메시지:", error.message);
    console.error("[Bulk Product Create] 에러 스택:", error.stack);
    console.error("======================================================\n");

    return NextResponse.json(
      { error: "대량 상품 등록에 실패했습니다", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 단일 상품 등록 함수
 */
async function registerSingleProduct(
  product: BulkProductInput,
  supplierId: string,
  supplierCode: string,
  cafe24Client: any,
  index: number
): Promise<ProductRegistrationResult> {
  try {
    // 가격 처리: 상품에 가격이 있으면 사용, 없으면 고정 값 사용
    const finalSellingPrice = product.sellingPrice ?? FIXED_VALUES.sellingPrice;
    const finalSupplyPrice = product.supplyPrice ?? finalSellingPrice;
    const finalCategoryNo = FIXED_VALUES.categoryNo;
    const finalSummaryDescription = FIXED_VALUES.summaryDescription;
    const finalDescription = FIXED_VALUES.description;
    const finalSellerPhone = FIXED_VALUES.sellerPhone;

    console.log(`[Bulk Product Create] [${index}] 가격 적용: 판매가=${finalSellingPrice}원, 공급가=${finalSupplyPrice}원, 카테고리=${finalCategoryNo}`);

    // 1. Firestore에 임시 상품 생성
    const productsRef = collection(db, "products");
    const productDoc = await addDoc(productsRef, {
      supplierId: supplierId,
      name: product.productName,
      summaryDescription: finalSummaryDescription, // 고정 값 사용
      description: finalDescription, // 고정 값 사용
      supplyPrice: finalSupplyPrice, // 상품 가격 또는 고정 값
      sellingPrice: finalSellingPrice, // 상품 가격 또는 고정 값
      display: product.display || "T",
      selling: product.selling || "T",
      categoryNo: finalCategoryNo, // 고정 값 사용
      status: "draft",
      cafe24ProductNo: null,
      images: {
        cover: "",
        gallery: [],
      },
      createdAt: new Date().toISOString(),
    });

    console.log(`[Bulk Product Create] [${index}] Firestore 상품 ID: ${productDoc.id}`);

    // 2. 이미지 처리 (Base64 변환만 수행, 압축 및 Firebase Storage 제외)
    const cafe24ImageUrls: string[] = [];

    console.log(`[Bulk Product Create] [${index}] 이미지 처리 시작: ${Math.min(product.images.length, 3)}장`);

    // 3. Cafe24 CDN에 이미지 업로드 (압축 없이 Base64 변환만)
    console.log(`[Bulk Product Create] [${index}] Cafe24 CDN 업로드 시작`);

    const base64Images: string[] = [];
    for (let i = 0; i < Math.min(product.images.length, 3); i++) {
      const image = product.images[i];

      if (image.type === "base64") {
        base64Images.push(image.data);
      } else if (image.type === "url") {
        // URL에서 이미지 다운로드 후 Base64 변환 (압축 없음)
        console.log(`[Bulk Product Create] [${index}] 이미지 ${i + 1} URL 다운로드: ${image.data}`);
        const response = await fetch(image.data);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        base64Images.push(base64);
        console.log(`[Bulk Product Create] [${index}] 이미지 ${i + 1} Base64 변환 완료: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    const uploadedImages = await cafe24Client.uploadProductImages(base64Images);
    const uploadedImageUrls = uploadedImages.map((img: any) => img.path);

    console.log(`[Bulk Product Create] [${index}] Cafe24 CDN 업로드 성공: ${uploadedImageUrls.length}장`);

    // 상대 경로 변환
    const convertToRelativePath = (url: string): string => {
      const match = url.match(/\/web\/upload\/.+$/);
      if (!match) {
        console.warn(`[Bulk Product Create] [${index}] 경고: 상대 경로 변환 실패 - ${url}`);
        return url;
      }
      return match[0];
    };

    const relativeImagePaths = uploadedImageUrls.map(convertToRelativePath);

    // 4. 상세설명 이미지 처리 (있는 경우, 압축 없음)
    let descriptionCafe24ImageUrls: string[] = [];

    if (product.descriptionImages && product.descriptionImages.length > 0) {
      console.log(
        `[Bulk Product Create] [${index}] 상세설명 이미지 처리 시작: ${product.descriptionImages.length}장`
      );

      const descBase64Images: string[] = [];

      for (const image of product.descriptionImages) {
        if (image.type === "base64") {
          descBase64Images.push(image.data);
        } else if (image.type === "url") {
          // URL에서 이미지 다운로드 후 Base64 변환 (압축 없음)
          const response = await fetch(image.data);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          descBase64Images.push(base64);
        }
      }

      const uploadedDescImages = await cafe24Client.uploadProductImages(descBase64Images);
      descriptionCafe24ImageUrls = uploadedDescImages.map((img: any) => img.path);

      console.log(
        `[Bulk Product Create] [${index}] 상세설명 이미지 Cafe24 CDN 업로드 성공: ${descriptionCafe24ImageUrls.length}장`
      );
    }

    // 5. 상세설명 HTML 생성 (고정 값 사용)
    let fullDescription = "";

    // 고정된 description 텍스트를 HTML로 변환
    let textHtml = "";
    if (finalDescription) {
      textHtml = finalDescription
        .split("\n")
        .map((line) => (line.trim() ? `<p>${line}</p>` : "<br>"))
        .join("\n");
    }

    let imagesHtml = "";
    if (descriptionCafe24ImageUrls.length > 0) {
      imagesHtml = descriptionCafe24ImageUrls
        .map(
          (url) =>
            `<p style="text-align:center;"><img src="${url}" alt="상품 상세 이미지" style="max-width:100%; height:auto; display:inline-block; margin:10px auto;" /></p>`
        )
        .join("\n");
    }

    fullDescription = [textHtml, imagesHtml].filter(Boolean).join("\n");

    // 6. Cafe24 상품 생성
    const cafe24ProductData: any = {
      product_name: product.productName,
      summary_description: finalSummaryDescription, // 고정 값 사용
      description: fullDescription,
      price: finalSellingPrice, // 상품 가격 또는 고정 값
      supply_price: finalSupplyPrice, // 상품 가격 또는 고정 값
      display: product.display || "T",
      selling: product.selling || "T",
      product_condition: "U", // 중고
      supplier_code: supplierCode,
      add_category_no: [
        {
          category_no: finalCategoryNo, // 고정 값 사용
          recommend: "F",
          new: "F",
        },
      ],
      image_upload_type: "A", // Cafe24 CDN 이미지 사용
      detail_image: relativeImagePaths[0], // 대표 이미지
      maximum_quantity: product.maximumQuantity || 1,
      minimum_quantity: product.minimumQuantity || 1,
    };

    // 판매자 전화번호 추가 (고정 값 사용)
    cafe24ProductData.additional_information = [
      {
        key: "custom_option7",
        name: "판매자 전화번호",
        value: finalSellerPhone, // 고정 값 사용
      },
    ];

    console.log(`[Bulk Product Create] [${index}] Cafe24 상품 생성 중...`);

    const cafe24Response = await cafe24Client.createProduct(cafe24ProductData);

    const cafe24ProductNo =
      cafe24Response.product?.product_no || cafe24Response.products?.[0]?.product_no;

    if (!cafe24ProductNo) {
      throw new Error("Cafe24 상품 번호를 받지 못했습니다");
    }

    console.log(`[Bulk Product Create] [${index}] Cafe24 상품 번호: ${cafe24ProductNo}`);

    // 7. 추가 이미지 업로드 (2,3번째 이미지)
    if (base64Images.length > 1) {
      console.log(
        `[Bulk Product Create] [${index}] 추가 이미지 업로드: ${base64Images.length - 1}장`
      );

      try {
        const additionalBase64Images = base64Images.slice(1);
        const uploadedAdditionalImages = await cafe24Client.addProductImages(
          cafe24ProductNo.toString(),
          additionalBase64Images
        );

        const additionalImageUrls = uploadedAdditionalImages.map((img: any) => img.detail_image);
        cafe24ImageUrls.push(uploadedImageUrls[0], ...additionalImageUrls);

        console.log(`[Bulk Product Create] [${index}] 추가 이미지 업로드 성공`);
      } catch (imageUploadError: any) {
        console.error(
          `[Bulk Product Create] [${index}] 추가 이미지 업로드 실패:`,
          imageUploadError.message
        );
        // 실패해도 첫 번째 이미지는 있으므로 계속 진행
        cafe24ImageUrls.push(...uploadedImageUrls);
      }
    } else {
      cafe24ImageUrls.push(...uploadedImageUrls);
    }

    // 8. 메인 진열 영역에 추가 (displayGroup이 지정된 경우에만)
    if (product.displayGroup !== null && product.displayGroup !== undefined) {
      try {
        const displayGroupName = product.displayGroup === 5 ? 'product_listmain_4' : `display_group_${product.displayGroup}`;
        console.log(`[Bulk Product Create] [${index}] 메인 진열 영역(${displayGroupName})에 추가`);
        await cafe24Client.addProductToMain(product.displayGroup, [parseInt(cafe24ProductNo)]);
        console.log(`[Bulk Product Create] [${index}] 메인 진열 영역 추가 성공`);
      } catch (mainError: any) {
        console.error(
          `[Bulk Product Create] [${index}] 메인 진열 영역 추가 실패:`,
          mainError.message
        );
        // 실패해도 상품은 등록되었으므로 계속 진행
      }
    } else {
      console.log(`[Bulk Product Create] [${index}] 메인 진열 건너뛰기 (displayGroup: null)`);
    }

    // 9. Firestore 업데이트
    await updateDoc(doc(db, "products", productDoc.id), {
      cafe24ProductNo: cafe24ProductNo.toString(),
      status: "active",
      "images.cover": cafe24ImageUrls[0],
      "images.gallery": cafe24ImageUrls,
      "images.descriptionImages":
        descriptionCafe24ImageUrls.length > 0 ? descriptionCafe24ImageUrls : [],
      updatedAt: new Date().toISOString(),
    });

    console.log(`[Bulk Product Create] [${index}] Firestore 업데이트 완료`);

    return {
      index,
      productName: product.productName,
      success: true,
      productId: productDoc.id,
      cafe24ProductNo: cafe24ProductNo.toString(),
    };
  } catch (error: any) {
    console.error(`[Bulk Product Create] [${index}] 에러:`, error.message);

    return {
      index,
      productName: product.productName,
      success: false,
      error: error.message || "Unknown error",
    };
  }
}
