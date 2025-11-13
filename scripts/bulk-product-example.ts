/**
 * 대량 상품 등록 예시 스크립트
 *
 * 사용법:
 * 1. 이 파일을 참고하여 상품 데이터를 준비합니다
 * 2. fetch()를 사용하여 /api/products/bulk 엔드포인트를 호출합니다
 * 3. 결과를 확인합니다
 */

import type {
  BulkProductInput,
  BulkProductRegistrationRequest,
  BulkProductRegistrationResult,
} from "@/lib/bulk-product-types";

/**
 * 예시 1: Base64 이미지를 사용한 상품 등록
 */
async function exampleBase64Images() {
  // 이미지 파일을 Base64로 변환하는 헬퍼 함수
  const imageToBase64 = async (imagePath: string): Promise<string> => {
    // Node.js 환경
    const fs = require("fs");
    const buffer = fs.readFileSync(imagePath);
    return buffer.toString("base64");

    // 브라우저 환경 (File 객체)
    // const file = ... // File 객체
    // return new Promise((resolve, reject) => {
    //   const reader = new FileReader();
    //   reader.onload = () => {
    //     const base64 = (reader.result as string).split(',')[1];
    //     resolve(base64);
    //   };
    //   reader.onerror = reject;
    //   reader.readAsDataURL(file);
    // });
  };

  // 상품 데이터 준비
  const products: BulkProductInput[] = [
    {
      productName: "현대 아반떼 2023 앞범퍼",
      categoryNo: 305,
      images: [
        {
          data: await imageToBase64("/path/to/bumper1.jpg"),
          type: "base64",
          filename: "bumper1.jpg",
        },
        {
          data: await imageToBase64("/path/to/bumper2.jpg"),
          type: "base64",
          filename: "bumper2.jpg",
        },
      ],
      // sellingPrice(0원), summaryDescription(부품문의 : 010 - 7125 - 5474),
      // description(장안동 장한평역 중고부품 네바퀴), sellerPhone(010-7125-5474)은
      // 자동으로 고정 값이 적용됩니다
    },
    {
      productName: "기아 쏘렌토 2022 뒷범퍼",
      categoryNo: 305,
      images: [
        {
          data: await imageToBase64("/path/to/rear-bumper.jpg"),
          type: "base64",
          filename: "rear-bumper.jpg",
        },
      ],
    },
  ];

  // 요청 데이터 구성
  const requestData: BulkProductRegistrationRequest = {
    supplierCode: "S00000BQ", // 고정된 공급사 코드
    products,
  };

  // API 호출
  const token = "YOUR_JWT_TOKEN"; // 실제 토큰으로 교체

  const response = await fetch("http://localhost:3000/api/products/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestData),
  });

  const result: BulkProductRegistrationResult = await response.json();

  console.log("=== 대량 상품 등록 결과 ===");
  console.log(`전체: ${result.total}개`);
  console.log(`성공: ${result.success}개`);
  console.log(`실패: ${result.failed}개`);
  console.log("\n상세 결과:");
  result.results.forEach((item) => {
    if (item.success) {
      console.log(
        `✅ [${item.index}] ${item.productName} - 상품 ID: ${item.productId}, Cafe24 번호: ${item.cafe24ProductNo}`
      );
    } else {
      console.log(`❌ [${item.index}] ${item.productName} - 에러: ${item.error}`);
    }
  });
}

/**
 * 예시 2: 이미지 URL을 사용한 상품 등록
 */
async function exampleImageUrls() {
  const products: BulkProductInput[] = [
    {
      productName: "쌍용 티볼리 2021 헤드라이트",
      categoryNo: 308, // 전기장치 카테고리
      images: [
        {
          data: "https://example.com/images/headlight-1.jpg",
          type: "url",
        },
        {
          data: "https://example.com/images/headlight-2.jpg",
          type: "url",
        },
      ],
      // sellingPrice, summaryDescription, description, sellerPhone은
      // 자동으로 고정 값이 적용됩니다
    },
  ];

  const requestData: BulkProductRegistrationRequest = {
    supplierCode: "S00000BQ",
    products,
  };

  const token = "YOUR_JWT_TOKEN";

  const response = await fetch("http://localhost:3000/api/products/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestData),
  });

  const result: BulkProductRegistrationResult = await response.json();
  console.log("등록 결과:", result);
}

/**
 * 예시 3: CSV 파일에서 상품 데이터 읽어서 등록
 */
async function exampleFromCSV() {
  // CSV 파일 구조 예시:
  // productName,categoryNo,sellingPrice,image1,image2,image3,summaryDescription,description,sellerPhone
  // "현대 아반떼 2023 앞범퍼",305,150000,"/images/bumper1.jpg","/images/bumper2.jpg","","아반떼 AD 2023년식","사용감 적음","010-1234-5678"

  const fs = require("fs");
  const Papa = require("papaparse"); // CSV 파싱 라이브러리

  // CSV 파일 읽기
  const csvData = fs.readFileSync("/path/to/products.csv", "utf8");
  const parsed = Papa.parse(csvData, { header: true });

  const products: BulkProductInput[] = [];

  for (const row of parsed.data) {
    // 이미지 경로들 수집
    const imagePaths = [row.image1, row.image2, row.image3].filter(Boolean);

    // 이미지를 Base64로 변환
    const images = await Promise.all(
      imagePaths.map(async (path) => {
        const buffer = fs.readFileSync(path);
        return {
          data: buffer.toString("base64"),
          type: "base64" as const,
          filename: path.split("/").pop(),
        };
      })
    );

    products.push({
      productName: row.productName,
      categoryNo: parseInt(row.categoryNo),
      images,
      // sellingPrice, summaryDescription, description, sellerPhone은
      // 자동으로 고정 값이 적용됩니다
    });
  }

  const requestData: BulkProductRegistrationRequest = {
    supplierCode: "S00000BQ",
    products,
  };

  const token = "YOUR_JWT_TOKEN";

  const response = await fetch("http://localhost:3000/api/products/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestData),
  });

  const result: BulkProductRegistrationResult = await response.json();
  console.log("CSV 대량 등록 결과:", result);
}

/**
 * 예시 4: 간단한 테스트용 상품 등록
 */
export async function quickTest(token: string) {
  const products: BulkProductInput[] = [
    {
      productName: "테스트 상품 1",
      categoryNo: 305,
      images: [
        {
          // 1x1 투명 PNG (Base64)
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          type: "base64",
          filename: "test.png",
        },
      ],
      // sellingPrice(0원), summaryDescription(부품문의 : 010 - 7125 - 5474),
      // description(장안동 장한평역 중고부품 네바퀴), sellerPhone(010-7125-5474)은
      // 자동으로 고정 값이 적용됩니다
    },
  ];

  const requestData: BulkProductRegistrationRequest = {
    supplierCode: "S00000BQ",
    products,
  };

  const response = await fetch("http://localhost:3000/api/products/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestData),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("API 에러:", error);
    return;
  }

  const result: BulkProductRegistrationResult = await response.json();
  console.log("테스트 결과:", result);
  return result;
}

// 사용 예시:
// exampleBase64Images();
// exampleImageUrls();
// exampleFromCSV();
// quickTest("your-jwt-token-here");
