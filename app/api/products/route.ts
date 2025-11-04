import { NextRequest, NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase-admin";
import { collection, addDoc, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { verifyToken } from "@/lib/auth";
import sharp from "sharp";

// 내 상품 목록 조회
export async function GET(request: NextRequest) {
  console.log("\n========== [API] 상품 목록 조회 시작 ==========");

  try {
    // 토큰 검증
    const authHeader = request.headers.get("Authorization");
    console.log("[API] Authorization 헤더 존재:", !!authHeader);

    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[API] Authorization 헤더 형식 오류");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    console.log("[API] 토큰 검증 결과:", payload ? "성공" : "실패");

    if (!payload) {
      console.log("[API] 유효하지 않은 토큰");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.log("[API] JWT Payload:", {
      supplierId: payload.supplierId,
      email: payload.email
    });

    // 내 상품만 조회
    const productsRef = collection(db, "products");
    const q = query(
      productsRef,
      where("supplierId", "==", payload.supplierId)
      // orderBy는 Firestore 복합 인덱스가 필요하므로 클라이언트에서 정렬
    );

    console.log("[API] Firestore 쿼리 조건:", {
      collection: "products",
      where: `supplierId == ${payload.supplierId}`
    });

    const productsSnapshot = await getDocs(q);
    console.log("[API] Firestore 쿼리 결과: 총", productsSnapshot.docs.length, "개 문서");

    const products = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 각 상품 정보 로그
    if (products.length > 0) {
      console.log("[API] 조회된 상품 목록:");
      products.forEach((product: any, index: number) => {
        console.log(`  ${index + 1}. [${product.id}] ${product.name} - supplierId: ${product.supplierId}`);
      });
    } else {
      console.log("[API] 조회된 상품 없음");
    }

    // 클라이언트에서 정렬 (최신순)
    products.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // 내림차순 (최신순)
    });

    console.log("[API] 응답 전송: 총", products.length, "개 상품");
    console.log("========== [API] 상품 목록 조회 완료 ==========\n");

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error("\n========== [API] 상품 목록 조회 에러 ==========");
    console.error("[API] 에러 메시지:", error.message);
    console.error("[API] 에러 스택:", error.stack);
    console.error("===============================================\n");

    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// 상품 등록 (Firestore + Cafe24 + 이미지 동시 처리)
export async function POST(request: NextRequest) {
  console.log("\n========== [Product Create] 상품 등록 시작 ==========");

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

    // FormData 파싱
    const formData = await request.formData();
    const productName = formData.get("productName") as string;
    const summaryDescription = formData.get("summaryDescription") as string;
    const description = formData.get("description") as string;
    const sellingPrice = formData.get("sellingPrice") as string;
    const supplyPrice = formData.get("supplyPrice") as string;
    const categoryNo = formData.get("categoryNo") as string;
    const display = formData.get("display") as string;
    const selling = formData.get("selling") as string;
    const maximumQuantity = formData.get("maximum_quantity") as string;
    const minimumQuantity = formData.get("minimum_quantity") as string;
    const sellerPhone = formData.get("sellerPhone") as string;
    const imageFiles = formData.getAll("images") as File[];

    console.log("[Product Create] 요청 데이터:", {
      productName,
      summaryDescription,
      description,
      sellingPrice,
      supplyPrice,
      categoryNo,
      maximumQuantity,
      minimumQuantity,
      sellerPhone,
      imageCount: imageFiles.length
    });

    // 유효성 검사
    if (!productName || !sellingPrice || !supplyPrice || !categoryNo) {
      console.error("[Product Create] 필수 필드 누락:", {
        productName: !!productName,
        sellingPrice: !!sellingPrice,
        supplyPrice: !!supplyPrice,
        categoryNo: !!categoryNo
      });
      return NextResponse.json(
        { error: "Required fields: productName, sellingPrice, supplyPrice, categoryNo" },
        { status: 400 }
      );
    }

    // 가격 유효성 검증
    const sellingPriceNum = parseInt(sellingPrice);
    const supplyPriceNum = parseInt(supplyPrice);
    if (isNaN(sellingPriceNum) || isNaN(supplyPriceNum) || sellingPriceNum <= 0 || supplyPriceNum <= 0) {
      console.error("[Product Create] 유효하지 않은 가격:", {
        sellingPrice,
        supplyPrice,
        sellingPriceNum,
        supplyPriceNum
      });
      return NextResponse.json(
        { error: "올바른 가격을 입력해주세요" },
        { status: 400 }
      );
    }

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: "대표 이미지가 필요합니다" },
        { status: 400 }
      );
    }

    // 최대 3장까지만 처리
    const imagesToProcess = imageFiles.slice(0, 3);
    console.log(`[Product Create] 처리할 이미지 수: ${imagesToProcess.length}장`);

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

    // Firestore에 상품 저장 (임시)
    console.log("[Product Create] Step 1: Firestore에 임시 상품 생성");
    const productsRef = collection(db, "products");
    const productDoc = await addDoc(productsRef, {
      supplierId: payload.supplierId,
      name: productName,
      summaryDescription: summaryDescription || "",
      description: description || "",
      supplyPrice: supplyPriceNum,
      sellingPrice: sellingPriceNum,
      display,
      selling,
      categoryNo: parseInt(categoryNo),
      status: "draft",
      cafe24ProductNo: null,
      images: {
        cover: "",
        gallery: [],
      },
      createdAt: new Date().toISOString(),
    });

    console.log("[Product Create] Firestore 상품 ID:", productDoc.id);

    // 이미지 처리 및 카페24 CDN 업로드
    let cafe24ImageUrls: string[] = [];
    let firebaseUrls: string[] = [];
    let base64Images: string[] = []; // try 블록 밖으로 이동

    try {
      console.log("[Product Create] Step 2: 이미지 처리 및 업로드 시작");

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

      // 모든 이미지 압축 및 Base64 변환
      const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

      for (let i = 0; i < imagesToProcess.length; i++) {
        const imageFile = imagesToProcess[i];
        console.log(`[Product Create] 이미지 ${i + 1}/${imagesToProcess.length} 처리 중...`);
        console.log(`[Product Create] - 파일명: ${imageFile.name}`);
        console.log(`[Product Create] - 파일 타입: ${imageFile.type}`);
        console.log(`[Product Create] - 파일 크기: ${(imageFile.size / 1024 / 1024).toFixed(2)}MB`);

        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 이미지 압축
        const metadata = await sharp(buffer).metadata();
        const isGif = metadata.format === 'gif';

        let processedImage: Buffer;
        let quality = 85;
        let maxWidth = 1600;

        if (isGif) {
          processedImage = await sharp(buffer, { animated: true })
            .rotate()
            .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
            .toBuffer();
        } else {
          processedImage = await sharp(buffer)
            .rotate()
            .resize(maxWidth, maxWidth, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality })
            .toBuffer();

          while (processedImage.length > MAX_FILE_SIZE && quality > 30) {
            quality -= 5;
            processedImage = await sharp(buffer)
              .rotate()
              .resize(maxWidth, maxWidth, { fit: "inside", withoutEnlargement: true })
              .jpeg({ quality })
              .toBuffer();
          }
        }

        console.log(`[Product Create] 이미지 ${i + 1} 압축 완료: ${(processedImage.length / 1024 / 1024).toFixed(2)}MB`);

        // Base64 변환
        const base64 = processedImage.toString('base64');
        base64Images.push(base64);

        // Firebase Storage에도 백업 저장
        const fileName = `${Date.now()}_${i}_${imageFile.name.replace(/\.[^/.]+$/, isGif ? '.gif' : '.jpg')}`;
        const storageRef = ref(storage, `uploads/${productDoc.id}/${fileName}`);

        await uploadBytes(storageRef, processedImage, {
          contentType: isGif ? "image/gif" : "image/jpeg",
        });

        const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'okparts-cf24.firebasestorage.app';
        const encodedPath = encodeURIComponent(`uploads/${productDoc.id}/${fileName}`);
        const publicURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
        firebaseUrls.push(publicURL);

        console.log(`[Product Create] 이미지 ${i + 1} Firebase 저장 완료`);
      }

      // 카페24 CDN에 모든 이미지 업로드
      console.log("[Product Create] Step 3: 카페24 CDN 업로드 시작");
      console.log(`[Product Create] 업로드할 이미지 수: ${base64Images.length}장`);

      const uploadedImages = await cafe24Client.uploadProductImages(base64Images);
      cafe24ImageUrls = uploadedImages.map(img => img.path);

      console.log("[Product Create] 카페24 CDN 업로드 성공!");
      console.log(`[Product Create] 업로드된 이미지: ${cafe24ImageUrls.length}장`);
      cafe24ImageUrls.forEach((url, idx) => {
        console.log(`[Product Create] 이미지 ${idx + 1}: ${url}`);
      });

    } catch (imageError: any) {
      console.error("[Product Create] 이미지 처리 실패!");
      console.error("[Product Create] 에러 상세:", imageError.message);
      console.error("[Product Create] 에러 스택:", imageError.stack);

      // 이미지 실패 시 Firebase URL 사용
      if (firebaseUrls.length > 0) {
        cafe24ImageUrls = firebaseUrls;
        console.log("[Product Create] Firebase URL로 대체:", firebaseUrls);
      } else {
        console.error("[Product Create] Firebase URL도 없음! 상품 등록 실패");
        throw new Error("이미지 처리에 실패했습니다");
      }
    }

    // 카페24 CDN URL을 상대 경로로 변환 (image_upload_type: "A"일 때 필요)
    const convertToRelativePath = (url: string): string => {
      const match = url.match(/\/web\/upload\/.+$/);
      if (!match) {
        console.warn(`[Product Create] 경고: 상대 경로 변환 실패 - ${url}`);
        return url;
      }
      return match[0];
    };

    const relativeImagePaths = cafe24ImageUrls.map(convertToRelativePath);

    console.log("[Product Create] 카페24 이미지 경로 변환:");
    console.log("[Product Create] 절대 경로 -> 상대 경로");
    cafe24ImageUrls.forEach((url, idx) => {
      console.log(`[Product Create] 이미지 ${idx + 1}: ${url} -> ${relativeImagePaths[idx]}`);
    });

    // 상대 경로 검증
    const invalidPaths = relativeImagePaths.filter(path => !path || !path.startsWith('/web/upload/'));
    if (invalidPaths.length > 0) {
      console.error("[Product Create] 유효하지 않은 이미지 경로 발견:", invalidPaths);
      throw new Error("이미지 경로 변환에 실패했습니다");
    }

    // 카페24 상품 생성 (이미지 없이)
    try {
      console.log("[Product Create] Step 4: 카페24 상품 생성 시작");

      const { Cafe24ApiClient } = await import("@/lib/cafe24");

      const mallId = process.env.NEXT_PUBLIC_CAFE24_MALL_ID!;
      const installDocRef = doc(db, "installs", mallId);
      const installDoc = await getDoc(installDocRef);
      const installData = installDoc.data()!;

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

      // 카페24 상품 데이터 (이미지 포함)
      const cafe24ProductData: any = {
        product_name: productName,
        summary_description: summaryDescription || "",
        description: description || "",
        price: sellingPriceNum,
        supply_price: supplyPriceNum,
        display: display || "T",
        selling: selling || "T",
        product_condition: "U", // 중고
        supplier_code: supplierCode,
        add_category_no: [{
          category_no: parseInt(categoryNo),
          recommend: "F",
          new: "F"
        }],
        image_upload_type: "A", // 카페24 CDN 이미지 사용
        detail_image: relativeImagePaths[0], // 대표 이미지 (상대 경로)
        maximum_quantity: maximumQuantity ? parseInt(maximumQuantity) : 1, // 최대 주문수량
        minimum_quantity: minimumQuantity ? parseInt(minimumQuantity) : 1, // 최소 주문수량
      };

      // 판매자 전화번호가 있으면 추가 정보에 포함
      if (sellerPhone) {
        cafe24ProductData.additional_information = [
          {
            key: "custom_option7",
            name: "판매자 전화번호",
            value: sellerPhone
          }
        ];
        console.log("[Product Create] 판매자 전화번호 추가:", sellerPhone);
      }

      // 첫 번째 이미지만 detail_image로 설정 (나머지는 additionalimages API로 등록)
      console.log(`[Product Create] 첫 번째 이미지를 detail_image로 설정`);
      console.log(`[Product Create] detail_image 경로: ${relativeImagePaths[0]}`);

      console.log("[Product Create] 카페24 상품 데이터:", {
        product_name: cafe24ProductData.product_name,
        price: cafe24ProductData.price,
        detail_image: cafe24ProductData.detail_image,
        maximum_quantity: cafe24ProductData.maximum_quantity,
        minimum_quantity: cafe24ProductData.minimum_quantity
      });
      console.log("[Product Create] detail_image (대표 - 상대 경로):", cafe24ProductData.detail_image);

      console.log("\n========== [Product Create] 카페24 API 요청 전체 데이터 ==========");
      console.log(JSON.stringify(cafe24ProductData, null, 2));
      console.log("=================================================================\n");

      console.log("[Product Create] 카페24 API 호출 중...");

      let cafe24Response;
      try {
        cafe24Response = await cafe24Client.createProduct(cafe24ProductData);
        console.log("[Product Create] 카페24 API 응답 받음");
        console.log("[Product Create] 카페24 응답 데이터:", JSON.stringify(cafe24Response, null, 2));
      } catch (cafe24ApiError: any) {
        console.error("\n========== [Product Create] 카페24 API 호출 실패 ==========");
        console.error("[Product Create] 에러 메시지:", cafe24ApiError.message);
        console.error("[Product Create] 에러 상세:", JSON.stringify(cafe24ApiError, null, 2));
        console.error("[Product Create] 요청했던 데이터:");
        console.error(JSON.stringify(cafe24ProductData, null, 2));
        console.error("==========================================================\n");
        throw cafe24ApiError;
      }

      const cafe24ProductNo =
        cafe24Response.product?.product_no ||
        cafe24Response.products?.[0]?.product_no;

      if (cafe24ProductNo) {
        console.log("\n========== [Product Create] 카페24 응답 분석 ==========");
        console.log("[Product Create] 상품 번호:", cafe24ProductNo);
        console.log("[Product Create] detail_image (응답):", cafe24Response.product?.detail_image);
        console.log("=======================================================\n");

        // Step 5: 2,3번째 이미지를 additionalimages API로 추가 등록
        const additionalBase64Images = base64Images.slice(1); // 2,3번째 이미지만
        if (additionalBase64Images.length > 0) {
          console.log("[Product Create] Step 5: 추가 이미지를 additionalimages API로 등록");
          console.log(`[Product Create] 등록할 이미지 수: ${additionalBase64Images.length}장 (2,3번째)`);

          try {
            const uploadedAdditionalImages = await cafe24Client.addProductImages(
              cafe24ProductNo.toString(),
              additionalBase64Images // 2,3번째 이미지만
            );
            console.log("[Product Create] 추가 이미지 등록 성공:", {
              count: uploadedAdditionalImages.length
            });

            // 카페24 이미지 URL 재구성: detail_image(첫번째) + additional_images(2,3번째)
            const additionalImageUrls = uploadedAdditionalImages.map(img => img.detail_image);
            cafe24ImageUrls = [
              cafe24ImageUrls[0], // 첫 번째 이미지 (uploadProductImages에서 얻은 것)
              ...additionalImageUrls // 2,3번째 (additionalimages API에서 얻은 것)
            ];
            console.log("[Product Create] 최종 카페24 이미지 URL:", cafe24ImageUrls);
          } catch (imageUploadError: any) {
            console.error("[Product Create] 추가 이미지 등록 실패:", imageUploadError.message);
            // 실패해도 첫 번째 이미지는 있으므로 계속 진행
          }
        } else {
          console.log("[Product Create] 추가 이미지 없음 (이미지 1장만 등록)");
        }

        // Step 6: 메인 진열 영역에 상품 추가
        // display_group: 2 = "Main Recommendations" (product_listmain_1)
        try {
          console.log("[Product Create] Step 6: 메인 진열 영역(product_listmain_1)에 추가");
          await cafe24Client.addProductToMain(2, [parseInt(cafe24ProductNo)]);
          console.log("[Product Create] 메인 진열 영역(product_listmain_1) 추가 성공!");
        } catch (mainError: any) {
          console.error("[Product Create] 메인 진열 영역 추가 실패:", mainError.message);
          // 실패해도 상품은 등록되었으므로 계속 진행
        }

        // 카페24 CDN URL (절대 경로)로 Firestore 업데이트
        await updateDoc(doc(db, "products", productDoc.id), {
          cafe24ProductNo: cafe24ProductNo.toString(),
          status: "active",
          "images.cover": cafe24ImageUrls[0], // 카페24 CDN 절대 경로
          "images.gallery": cafe24ImageUrls, // 카페24 CDN 절대 경로
          updatedAt: new Date().toISOString(),
        });

        console.log("[Product Create] Firestore 저장 이미지:");
        console.log(`[Product Create] - cover: ${cafe24ImageUrls[0]}`);
        console.log(`[Product Create] - gallery (${cafe24ImageUrls.length}장):`, cafe24ImageUrls);
        console.log("[Product Create] 상품 등록 완료!");
      }

    } catch (cafe24Error: any) {
      console.error("[Product Create] 카페24 상품 생성 실패:", cafe24Error.message);

      // 카페24 실패해도 Firestore에는 이미지 저장
      await updateDoc(doc(db, "products", productDoc.id), {
        status: "draft",
        "images.cover": cafe24ImageUrls[0] || firebaseUrls[0],
        "images.gallery": cafe24ImageUrls.length > 0 ? cafe24ImageUrls : firebaseUrls,
        updatedAt: new Date().toISOString(),
      });

      console.log("[Product Create] Firebase에만 저장됨 (draft)");
    }

    console.log("========== [Product Create] 상품 등록 종료 ==========\n");

    return NextResponse.json(
      {
        success: true,
        productId: productDoc.id,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("\n========== [Product Create] 치명적 오류 ==========");
    console.error("[Product Create] 에러 메시지:", error.message);
    console.error("[Product Create] 에러 스택:", error.stack);
    console.error("[Product Create] 에러 전체:", JSON.stringify(error, null, 2));
    console.error("==============================================\n");

    return NextResponse.json(
      { error: "상품 등록에 실패했습니다", details: error.message },
      { status: 500 }
    );
  }
}
