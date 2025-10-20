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

    // FormData에서 이미지 추출 (단일 또는 다중)
    const formData = await request.formData();
    const singleImage = formData.get("image") as File | null;
    const multipleImages = formData.getAll("images") as File[];

    const imageFiles = singleImage ? [singleImage] : multipleImages;

    if (imageFiles.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // 최대 3장 제한
    if (imageFiles.length > 3) {
      return NextResponse.json({ error: "Maximum 3 images allowed" }, { status: 400 });
    }

    // 여러 이미지 처리 및 업로드
    const uploadedUrls: string[] = [];
    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB (안전한 마진)

    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];

      // 파일 타입 검증
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error(`Invalid file type: ${imageFile.type}. Only jpg, png, gif allowed.`);
      }

      // 파일 크기 검증 (10MB 절대 제한 - 압축 전)
      const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
      if (imageFile.size > MAX_UPLOAD_SIZE) {
        throw new Error(`File ${imageFile.name} is too large. Maximum size is 10MB before compression.`);
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
        let quality = 85;
        let maxWidth = 1600;

        processedImage = await sharp(buffer)
          .rotate() // EXIF 기반 자동 회전
          .resize(maxWidth, maxWidth, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality })
          .toBuffer();

        // 3MB 이하가 될 때까지 quality 낮추기
        while (processedImage.length > MAX_FILE_SIZE && quality > 30) {
          quality -= 5;
          processedImage = await sharp(buffer)
            .rotate()
            .resize(maxWidth, maxWidth, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality })
            .toBuffer();
        }

        // 그래도 3MB 초과하면 크기를 줄이며 재압축
        while (processedImage.length > MAX_FILE_SIZE && maxWidth > 800) {
          maxWidth -= 200;
          quality = 75;
          processedImage = await sharp(buffer)
            .rotate()
            .resize(maxWidth, maxWidth, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality })
            .toBuffer();
        }

        // 최종 크기 확인
        if (processedImage.length > MAX_FILE_SIZE) {
          throw new Error(`Unable to compress image to under 3MB. Final size: ${(processedImage.length / 1024 / 1024).toFixed(2)}MB`);
        }

        console.log(`[Image ${i}] Original: ${(buffer.length / 1024 / 1024).toFixed(2)}MB → Compressed: ${(processedImage.length / 1024 / 1024).toFixed(2)}MB (Quality: ${quality}, Size: ${maxWidth}px)`);
      }

      // Firebase Storage에 업로드 (/uploads/ 경로 사용)
      const fileName = `${Date.now()}_${i}_${imageFile.name.replace(/\.[^/.]+$/, isGif ? '.gif' : '.jpg')}`;
      const storageRef = ref(
        storage,
        `uploads/${productId}/${fileName}`
      );

      await uploadBytes(storageRef, processedImage, {
        contentType: isGif ? "image/gif" : "image/jpeg",
        customMetadata: {
          originalName: fileName,
        },
      });

      // 카페24 호환 URL 생성
      // Firebase getDownloadURL()은 토큰이 포함된 URL을 반환: ?alt=media&token=xxx
      // 카페24는 확장자를 인식해야 하므로 토큰 제거하고 공개 URL 사용
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'okparts-cf24.firebasestorage.app';
      const encodedPath = encodeURIComponent(`uploads/${productId}/${fileName}`);
      const publicURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;

      console.log(`[Image ${i}] Cafe24-compatible URL (no token):`, publicURL);
      uploadedUrls.push(publicURL);
    }

    // Firestore에 이미지 URL들 저장 (기존 이미지에 추가)
    const currentGallery = productData.images?.gallery || [];
    const newGallery = [...currentGallery, ...uploadedUrls];

    await updateDoc(doc(db, "products", productId), {
      "images.cover": newGallery[0], // 첫 번째 이미지를 대표 이미지로
      "images.gallery": newGallery, // 모든 이미지를 갤러리로
      updatedAt: new Date().toISOString(),
    });

    // Cafe24에 이미지 업로드 및 업데이트
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

        // 1단계: Firebase Storage에서 이미지 다운로드 후 Base64 변환
        console.log("[Cafe24] Step 1: Converting images to Base64...");
        const base64Images: string[] = [];

        for (const imageUrl of uploadedUrls) {
          try {
            const imageResponse = await fetch(imageUrl);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            base64Images.push(base64);
          } catch (downloadError: any) {
            console.error("[Cafe24] Failed to download image:", imageUrl, downloadError.message);
          }
        }

        if (base64Images.length === 0) {
          throw new Error("Failed to convert images to Base64");
        }

        // 2단계: 카페24 CDN에 이미지 업로드
        console.log("[Cafe24] Step 2: Uploading images to Cafe24 CDN...");
        const uploadedImages = await cafe24Client.uploadProductImages(base64Images);
        const cafe24ImageUrls = uploadedImages.map(img => img.path);

        console.log("[Cafe24] Step 3: Uploaded to Cafe24 CDN:", cafe24ImageUrls);

        // 3단계: 상품에 카페24 CDN URL 연결
        await cafe24Client.updateProductImages(cafe24ProductNo, cafe24ImageUrls);
        console.log("[Image Upload] Cafe24 images updated for product:", cafe24ProductNo);

      } catch (cafe24Error: any) {
        console.error("[Image Upload] Cafe24 image update failed:", cafe24Error.message);
        // Cafe24 실패해도 Firebase에는 저장됨
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: uploadedUrls[0], // 첫 번째 업로드된 이미지 URL
      imageUrls: uploadedUrls, // 모든 업로드된 이미지 URL
    });
  } catch (error: any) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image", details: error.message },
      { status: 500 }
    );
  }
}
