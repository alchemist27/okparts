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

    // FormData에서 이미지 추출
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // 이미지 버퍼로 변환
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Sharp로 이미지 처리
    const processedImage = await sharp(buffer)
      .rotate() // EXIF 기반 자동 회전
      .resize(1600, 1600, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer();

    // Firebase Storage에 업로드 (/uploads/ 경로 사용)
    const storageRef = ref(
      storage,
      `uploads/${productId}/${Date.now()}_${imageFile.name}`
    );

    await uploadBytes(storageRef, processedImage, {
      contentType: "image/jpeg",
    });

    // 다운로드 URL 가져오기
    const downloadURL = await getDownloadURL(storageRef);

    // Firestore에 이미지 URL 저장
    await updateDoc(doc(db, "products", productId), {
      "images.cover": downloadURL,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      imageUrl: downloadURL,
    });
  } catch (error: any) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image", details: error.message },
      { status: 500 }
    );
  }
}
