import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { hashPassword, generateToken } from "@/lib/auth";
import { SignupRequest, AuthResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body: SignupRequest = await request.json();
    const { email, password, companyName, phone } = body;

    // 유효성 검사
    if (!email || !password || !companyName || !phone) {
      return NextResponse.json(
        { error: "모든 필드를 입력해주세요" },
        { status: 400 }
      );
    }

    // 이메일 중복 체크
    const suppliersRef = collection(db, "suppliers");
    const q = query(suppliersRef, where("email", "==", email));
    const existingSuppliers = await getDocs(q);

    if (!existingSuppliers.empty) {
      return NextResponse.json(
        { error: "이미 등록된 이메일입니다" },
        { status: 400 }
      );
    }

    // 비밀번호 해시
    const hashedPassword = await hashPassword(password);

    // Firestore에 공급사 정보 저장
    const supplierDoc = await addDoc(suppliersRef, {
      email,
      password: hashedPassword,
      companyName,
      phone,
      status: "active", // 또는 "pending" (승인 필요 시)
      createdAt: new Date().toISOString(),
    });

    // JWT 토큰 생성
    const token = generateToken({
      supplierId: supplierDoc.id,
      email,
    });

    const response: AuthResponse = {
      token,
      supplier: {
        id: supplierDoc.id,
        email,
        companyName,
        phone,
        status: "active",
        createdAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "회원가입 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
