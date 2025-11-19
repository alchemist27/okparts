// 배치로 나누어 대량 상품 등록 스크립트
const fs = require('fs');

//const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdXBwbGllcklkIjoiWFBjNjkzQUo1RXRyS2s3eDJRUUUiLCJlbWFpbCI6ImprMTQzNyIsImlhdCI6MTc2MjkzNDM2MywiZXhwIjoxNzYzNTM5MTYzfQ.lnWUM7unft5Sc5elXnOAxwuQ5gEbpI5l6I0CKzZ89wU';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdXBwbGllcklkIjoiZEo3UjFObHRxcXFUQUhUM3dVOVkiLCJlbWFpbCI6Im9uZWNsaWNrY2FyIiwiaWF0IjoxNzYzNTU2NDgzLCJleHAiOjE3NjQxNjEyODN9.qs9UCltS84_JHvGFQr09jzBJgdrherYPyfOpe__Jjgk';
const BATCH_SIZE = 50; // 배치당 상품 수
const BATCH_DELAY = 2000; // 배치 간 대기 시간 (2초)

// JSON 파일 읽기
const jsonData = JSON.parse(fs.readFileSync('products_light_20251113_140210.json', 'utf8'));

console.log('=== 배치 대량 상품 등록 시작 ===');
console.log(`총 상품 수: ${jsonData.total_products}개`);
console.log(`배치 크기: ${BATCH_SIZE}개`);
console.log(`총 배치 수: ${Math.ceil(jsonData.total_products / BATCH_SIZE)}개`);
console.log(`크롤링 날짜: ${jsonData.crawled_at}`);

// 상품명에서 괄호 내용 제거 함수
function removeBrackets(title) {
  return title.replace(/\([^)]*\)/g, '').trim();
}

// 상품 데이터 변환 함수
function convertProduct(item) {
  const cleanTitle = removeBrackets(item.title);
  const allImages = item.images || [];

  const thumbnailImages = allImages.slice(0, 3).map(img => ({
    data: img.url,
    type: "url"
  }));

  const descriptionImages = allImages.slice(3).map(img => ({
    data: img.url,
    type: "url"
  }));

  const productData = {
    productName: cleanTitle,
    images: thumbnailImages
  };

  if (descriptionImages.length > 0) {
    productData.descriptionImages = descriptionImages;
  }

  return productData;
}

// 배치 등록 함수
async function registerBatch(products, batchNumber, totalBatches) {
  console.log(`\n[배치 ${batchNumber}/${totalBatches}] ${products.length}개 상품 등록 시작...`);

  const requestData = {
    supplierCode: "S00000BS",
    products: products
  };

  try {
    const response = await fetch('http://localhost:3000/api/products/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    console.log(`[배치 ${batchNumber}/${totalBatches}] ✅ 완료: 성공 ${result.success}개, 실패 ${result.failed}개`);

    return result;
  } catch (error) {
    console.error(`[배치 ${batchNumber}/${totalBatches}] ❌ 에러: ${error.message}`);
    return { error: error.message, total: products.length, success: 0, failed: products.length };
  }
}

// 메인 실행 함수
async function main() {
  const allProducts = jsonData.products.map(convertProduct);
  const totalBatches = Math.ceil(allProducts.length / BATCH_SIZE);

  const allResults = [];
  let totalSuccess = 0;
  let totalFailed = 0;

  const startTime = Date.now();

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, allProducts.length);
    const batch = allProducts.slice(start, end);

    const result = await registerBatch(batch, i + 1, totalBatches);
    allResults.push(result);

    totalSuccess += result.success || 0;
    totalFailed += result.failed || 0;

    // 마지막 배치가 아니면 대기
    if (i < totalBatches - 1) {
      console.log(`다음 배치까지 ${BATCH_DELAY / 1000}초 대기 중...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

  console.log('\n======================================');
  console.log('=== 전체 등록 완료 ===');
  console.log(`총 소요 시간: ${duration}분`);
  console.log(`전체 상품: ${allProducts.length}개`);
  console.log(`성공: ${totalSuccess}개`);
  console.log(`실패: ${totalFailed}개`);
  console.log('======================================');

  // 결과를 파일로 저장
  fs.writeFileSync(
    'bulk-register-batch-results.json',
    JSON.stringify({
      summary: {
        total: allProducts.length,
        success: totalSuccess,
        failed: totalFailed,
        duration_minutes: duration,
        batches: totalBatches
      },
      batch_results: allResults
    }, null, 2),
    'utf8'
  );

  console.log('\n결과가 bulk-register-batch-results.json 파일에 저장되었습니다.');
}

// 실행
main().catch(error => {
  console.error('치명적 에러:', error);
});
