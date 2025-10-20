import { NextRequest, NextResponse } from "next/server";
import { db, storage } from "@/lib/firebase-admin";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { verifyToken } from "@/lib/auth";
import sharp from "sharp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;

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

    // 상품 소유권 확인
    const productDoc = await getDoc(doc(db, "products", productId));

    if (!productDoc.exists()) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const productData = productDoc.data();

    if (productData.supplierId !== payload.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // FormData에서 이미지들 추출
    const formData = await request.formData();
    const imageFiles = formData.getAll("images") as File[];

    if (imageFiles.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // 최대 3장 제한
    if (imageFiles.length > 3) {
      return NextResponse.json({ error: "Maximum 3 images allowed" }, { status: 400 });
    }

    // 여러 이미지 처리 및 업로드
    const uploadedUrls: string[] = [];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];

      // 파일 타입 검증
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error(`Invalid file type: ${imageFile.type}. Only jpg, png, gif allowed.`);
      }

      // 이미지 버퍼로 변환
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 이미지 메타데이터 확인
      const metadata = await sharp(buffer).metadata();
      const isGif = metadata.format === 'gif';

      let processedImage: Buffer;

      if (isGif) {
        // GIF는 애니메이션 유지하며 리사이즈만
        processedImage = await sharp(buffer, { animated: true })
          .rotate() // EXIF 기반 자동 회전
          .resize(1600, 1600, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .toBuffer();
      } else {
        // JPG/PNG는 JPEG로 변환하며 압축
        let quality = 90;
        processedImage = await sharp(buffer)
          .rotate() // EXIF 기반 자동 회전
          .resize(1600, 1600, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality })
          .toBuffer();

        // 5MB 이하가 될 때까지 quality 낮추기
        while (processedImage.length > MAX_FILE_SIZE && quality > 20) {
          quality -= 10;
          processedImage = await sharp(buffer)
            .rotate()
            .resize(1600, 1600, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality })
            .toBuffer();
        }

        // 그래도 5MB 초과하면 더 작은 크기로 리사이즈
        if (processedImage.length > MAX_FILE_SIZE) {
          quality = 80;
          processedImage = await sharp(buffer)
            .rotate()
            .resize(1200, 1200, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality })
            .toBuffer();
        }

        console.log(`[Image ${i}] Original: ${buffer.length} bytes, Compressed: ${processedImage.length} bytes, Quality: ${quality}`);
      }

      // Firebase Storage에 업로드 (/uploads/ 경로 사용)
      const storageRef = ref(
        storage,
        `uploads/${productId}/${Date.now()}_${i}_${imageFile.name.replace(/\.[^/.]+$/, '.jpg')}`
      );

      await uploadBytes(storageRef, processedImage, {
        contentType: isGif ? "image/gif" : "image/jpeg",
      });

      // 다운로드 URL 가져오기
      const downloadURL = await getDownloadURL(storageRef);
      uploadedUrls.push(downloadURL);
    }

    // Firestore에 이미지 URL들 저장
    await updateDoc(doc(db, "products", productId), {
      "images.cover": uploadedUrls[0], // 첫 번째 이미지를 대표 이미지로
      "images.gallery": uploadedUrls, // 모든 이미지를 갤러리로
      updatedAt: new Date().toISOString(),
    });

    // Cafe24에 이미지 업데이트
    const cafe24ProductNo = productData.cafe24ProductNo;
    if (cafe24ProductNo) {
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

        // Cafe24에 이미지 업데이트 (여러 이미지)
        await cafe24Client.updateProductImages(cafe24ProductNo, uploadedUrls);
        console.log("[Image Upload] Cafe24 images updated for product:", cafe24ProductNo);
      } catch (cafe24Error: any) {
        console.error("[Image Upload] Cafe24 image update failed:", cafe24Error.message);
        // Cafe24 실패해도 Firebase에는 저장됨
      }
    }

    return NextResponse.json({
      success: true,
      imageUrls: uploadedUrls,
    });
  } catch (error: any) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image", details: error.message },
      { status: 500 }
    );
  }
}
