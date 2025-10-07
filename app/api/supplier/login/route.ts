import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { collection, query, where, getDocs } from "firebase/firestore";
import { comparePassword, generateToken } from "@/lib/auth";
import { LoginRequest, AuthResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // 유효성 검사
    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요" },
        { status: 400 }
      );
    }

    // 공급사 조회
    const suppliersRef = collection(db, "suppliers");
    const q = query(suppliersRef, where("email", "==", email));
    const supplierSnapshot = await getDocs(q);

    if (supplierSnapshot.empty) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 잘못되었습니다" },
        { status: 401 }
      );
    }

    const supplierDoc = supplierSnapshot.docs[0];
    const supplierData = supplierDoc.data();

    // 비밀번호 확인
    const isPasswordValid = await comparePassword(
      password,
      supplierData.password
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 잘못되었습니다" },
        { status: 401 }
      );
    }

    // 차단된 계정 확인
    if (supplierData.status === "blocked") {
      return NextResponse.json(
        { error: "차단된 계정입니다. 관리자에게 문의하세요" },
        { status: 403 }
      );
    }

    // JWT 토큰 생성
    const token = generateToken({
      supplierId: supplierDoc.id,
      email: supplierData.email,
    });

    const response: AuthResponse = {
      token,
      supplier: {
        id: supplierDoc.id,
        email: supplierData.email,
        companyName: supplierData.companyName,
        phone: supplierData.phone,
        status: supplierData.status,
        cafe24SupplierNo: supplierData.cafe24SupplierNo,
        createdAt: supplierData.createdAt,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
