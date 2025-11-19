// 원클릭카 상품 대량 등록 스크립트
const fs = require('fs');

const token = process.argv[2] || 'YOUR_TOKEN_HERE';
const batchSize = parseInt(process.argv[3]) || 50;

if (token === 'YOUR_TOKEN_HERE') {
  console.log('사용법: node oneclickcar-bulk-register.js [TOKEN] [BATCH_SIZE]');
  console.log('예시: node oneclickcar-bulk-register.js eyJhbGc... 50');
  console.log('\nTOKEN을 get-token.js로 먼저 가져오세요.');
  process.exit(1);
}

// JSON 파일 읽기
const jsonData = JSON.parse(fs.readFileSync('products_oneclickcar_hyundai_20251119_211223.json', 'utf8'));

console.log('=== 원클릭카 상품 대량 등록 ===');
console.log(`총 상품 수: ${jsonData.total_products}개`);
console.log(`카테고리: ${jsonData.category}`);
console.log(`크롤링 날짜: ${jsonData.crawled_at}`);

// 가격 문자열을 숫자로 변환 (쉼표 제거)
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/,/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? 0 : num;
}

// 상품 데이터 변환
const products = jsonData.products.map(item => {
  const allImages = item.images || [];

  // 첫 3장은 썸네일 이미지로
  const thumbnailImages = allImages.slice(0, 3).map(img => ({
    data: img.url,
    type: "url"
  }));

  // 나머지는 상세설명 이미지로
  const descriptionImages = allImages.slice(3).map(img => ({
    data: img.url,
    type: "url"
  }));

  // 가격 파싱
  const price = parsePrice(item.price);

  const productData = {
    productName: item.title,
    images: thumbnailImages,
    sellingPrice: price,
    supplyPrice: price
  };

  // 상세설명 이미지가 있으면 추가
  if (descriptionImages.length > 0) {
    productData.descriptionImages = descriptionImages;
  }

  return productData;
});

console.log('\n=== 변환 예시 (처음 3개) ===');
products.slice(0, 3).forEach((product, idx) => {
  console.log(`${idx + 1}. ${product.productName}`);
  console.log(`   - 가격: ${product.sellingPrice.toLocaleString()}원`);
  console.log(`   - 썸네일: ${product.images.length}장`);
  console.log(`   - 상세이미지: ${product.descriptionImages?.length || 0}장`);
});

// 배치로 나누기
const batches = [];
for (let i = 0; i < products.length; i += batchSize) {
  batches.push(products.slice(i, i + batchSize));
}

console.log(`\n${batches.length}개 배치로 나눔 (각 ${batchSize}개씩)\n`);

const allResults = [];
let totalSuccess = 0;
let totalFailed = 0;

async function registerBatch(batchIndex, products) {
  console.log(`\n=== 배치 ${batchIndex + 1}/${batches.length} 등록 시작 (${products.length}개) ===`);

  // route_2 API 사용 (가격 지원)
  const requestData = {
    supplierCode: "S00000D1", // 원클릭카 공급사 코드
    products: products
  };

  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:3000/api/products/bulk-2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestData)
    });

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`배치 ${batchIndex + 1} 완료: ${duration}초`);
    console.log(`성공: ${result.success}개 / 실패: ${result.failed}개`);

    totalSuccess += result.success;
    totalFailed += result.failed;
    allResults.push(...result.results);

    // 각 배치 결과 간단히 출력
    result.results.forEach((item) => {
      if (item.success) {
        console.log(`  ✅ ${item.productName.substring(0, 50)}... (${item.cafe24ProductNo})`);
      } else {
        console.log(`  ❌ ${item.productName.substring(0, 50)}... - ${item.error}`);
      }
    });

    return result;
  } catch (error) {
    console.error(`배치 ${batchIndex + 1} 에러:`, error.message);
    throw error;
  }
}

async function registerAll() {
  const overallStart = Date.now();

  for (let i = 0; i < batches.length; i++) {
    await registerBatch(i, batches[i]);

    // 배치 사이에 2초 대기
    if (i < batches.length - 1) {
      console.log('\n다음 배치 전 2초 대기...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log('\n\n=== 전체 등록 완료 ===');
  console.log(`총 소요 시간: ${overallDuration}초 (${(overallDuration / 60).toFixed(1)}분)`);
  console.log(`전체: ${products.length}개`);
  console.log(`성공: ${totalSuccess}개`);
  console.log(`실패: ${totalFailed}개`);
  console.log(`성공률: ${((totalSuccess / products.length) * 100).toFixed(1)}%`);

  const finalResult = {
    total: products.length,
    success: totalSuccess,
    failed: totalFailed,
    batches: batches.length,
    results: allResults
  };

  fs.writeFileSync('oneclickcar-result.json', JSON.stringify(finalResult, null, 2), 'utf8');
  console.log('\n결과 저장: oneclickcar-result.json');
}

registerAll().catch(error => {
  console.error('치명적 에러:', error);
});
