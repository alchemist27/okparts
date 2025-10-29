import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { verifyToken } from "@/lib/auth";
import sharp from "sharp";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  console.log("\n========== [Additional Images] 추가 이미지 업로드 시작 ==========");

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

    const params = await context.params;
    const productId = params.id;

    // 상품 존재 확인 및 권한 체크
    const productDocRef = doc(db, "products", productId);
    const productDoc = await getDoc(productDocRef);

    if (!productDoc.exists()) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const productData = productDoc.data();

    // 권한 확인
    if (productData.supplierId !== payload.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 카페24 상품 번호 확인
    const cafe24ProductNo = productData.cafe24ProductNo;
    if (!cafe24ProductNo) {
      return NextResponse.json(
        { error: "Product not registered in Cafe24" },
        { status: 400 }
      );
    }

    // FormData 파싱
    const formData = await request.formData();
    const imagesToProcess: File[] = [];

    formData.forEach((value, key) => {
      if (key === "images" && value instanceof File) {
        imagesToProcess.push(value);
      }
    });

    if (imagesToProcess.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    console.log(`[Additional Images] 처리할 이미지 수: ${imagesToProcess.length}장`);

    // 이미지 압축 및 Base64 변환
    const base64Images: string[] = [];
    const ADDITIONAL_IMAGE_MAX_SIZE = 1 * 1024 * 1024; // 1MB

    for (let i = 0; i < imagesToProcess.length; i++) {
      const imageFile = imagesToProcess[i];
      console.log(`[Additional Images] 이미지 ${i + 1}/${imagesToProcess.length} 처리 중...`);

      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

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

        // 1MB 이하로 압축
        while (processedImage.length > ADDITIONAL_IMAGE_MAX_SIZE && quality > 30) {
          quality -= 5;
          processedImage = await sharp(buffer)
            .rotate()
            .resize(maxWidth, maxWidth, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality })
            .toBuffer();
        }

        if (processedImage.length > ADDITIONAL_IMAGE_MAX_SIZE) {
          maxWidth = 1200;
          quality = 75;
          processedImage = await sharp(buffer)
            .rotate()
            .resize(maxWidth, maxWidth, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality })
            .toBuffer();
        }
      }

      const finalSize = processedImage.length / 1024 / 1024;
      console.log(`[Additional Images] 이미지 ${i + 1} 압축 완료: ${finalSize.toFixed(2)}MB`);

      const base64 = processedImage.toString('base64');
      base64Images.push(base64);
    }

    // 카페24에 추가 이미지 업로드
    console.log("[Additional Images] 카페24 업로드 시작");

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

    const additionalImages = await cafe24Client.addProductImages(
      cafe24ProductNo.toString(),
      base64Images
    );

    console.log("[Additional Images] 카페24 업로드 성공:", {
      count: additionalImages.length
    });

    // Firestore 업데이트 (기존 gallery에 추가)
    const currentGallery = productData.images?.gallery || [];
    const newImageUrls = additionalImages.map(img => img.detail_image);

    await updateDoc(productDocRef, {
      "images.gallery": [...currentGallery, ...newImageUrls],
      updatedAt: new Date().toISOString(),
    });

    console.log("[Additional Images] 추가 이미지 업로드 완료!");
    console.log("==========================================================\n");

    return NextResponse.json({
      success: true,
      count: additionalImages.length,
      images: additionalImages,
    });

  } catch (error: any) {
    console.error("========== [Additional Images] 에러 발생 ==========");
    console.error("[Additional Images] 에러 메시지:", error.message);
    console.error("[Additional Images] 에러 스택:", error.stack);
    console.error("===================================================\n");

    return NextResponse.json(
      { error: "Failed to upload additional images", details: error.message },
      { status: 500 }
    );
  }
}
