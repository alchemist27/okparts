// 업데이트된 JSON 구조로 대량 상품 등록 스크립트
const fs = require('fs');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdXBwbGllcklkIjoiWFBjNjkzQUo1RXRyS2s3eDJRUUUiLCJlbWFpbCI6ImprMTQzNyIsImlhdCI6MTc2MjkzNDM2MywiZXhwIjoxNzYzNTM5MTYzfQ.lnWUM7unft5Sc5elXnOAxwuQ5gEbpI5l6I0CKzZ89wU';

// JSON 파일 읽기
const jsonData = JSON.parse(fs.readFileSync('products_light_20251113_140210.json', 'utf8'));

console.log('=== 대량 상품 등록 시작 ===');
console.log(`총 상품 수: ${jsonData.total_products}개`);
console.log(`크롤링 날짜: ${jsonData.crawled_at}`);
console.log(`카테고리: ${jsonData.category}`);

// 상품명에서 괄호 내용 제거 함수
function removeBrackets(title) {
  return title.replace(/\([^)]*\)/g, '').trim();
}

// 상품 데이터 변환 (전체)
const products = jsonData.products.map(item => {
  const cleanTitle = removeBrackets(item.title);

  // 이미지 배열 처리
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

  const productData = {
    productName: cleanTitle,
    images: thumbnailImages
  };

  // 상세설명 이미지가 있으면 추가
  if (descriptionImages.length > 0) {
    productData.descriptionImages = descriptionImages;
  }

  return productData;
});

console.log('\n=== 변환 예시 ===');
console.log('상품 1:');
console.log('  원본:', jsonData.products[0].title);
console.log('  변환:', products[0].productName);
console.log('  전체 이미지 수:', jsonData.products[0].image_count);
console.log('  썸네일 이미지:', products[0].images.length + '장');
console.log('  상세설명 이미지:', (products[0].descriptionImages?.length || 0) + '장');

console.log('\n상품 2:');
console.log('  원본:', jsonData.products[1].title);
console.log('  변환:', products[1].productName);
console.log('  전체 이미지 수:', jsonData.products[1].image_count);
console.log('  썸네일 이미지:', products[1].images.length + '장');
console.log('  상세설명 이미지:', (products[1].descriptionImages?.length || 0) + '장');

const requestData = {
  supplierCode: "S00000BS",
  products: products
};

console.log(`\n총 ${products.length}개 상품을 등록합니다...`);
console.log('API 호출 중...\n');

const startTime = Date.now();

fetch('http://localhost:3000/api/products/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(requestData)
})
  .then(response => {
    console.log(`응답 상태 코드: ${response.status}`);
    return response.json();
  })
  .then(result => {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n=== 대량 상품 등록 완료 ===');
    console.log(`소요 시간: ${duration}초`);

    if (result.error) {
      console.error(`\n❌ 에러 발생: ${result.error}`);
      if (result.details) {
        console.error(`상세: ${result.details}`);
      }
      return;
    }

    console.log(`\n전체: ${result.total}개`);
    console.log(`성공: ${result.success}개`);
    console.log(`실패: ${result.failed}개`);

    // 상세 결과
    console.log('\n=== 상세 결과 ===');
    result.results.forEach((item, idx) => {
      const originalProduct = jsonData.products[idx];
      if (item.success) {
        console.log(`✅ [${item.index + 1}] ${item.productName}`);
        console.log(`   - Cafe24 번호: ${item.cafe24ProductNo}`);
        console.log(`   - 원본 이미지 수: ${originalProduct.image_count}장`);
      } else {
        console.log(`❌ [${item.index + 1}] ${item.productName}`);
        console.log(`   - 에러: ${item.error}`);
      }
    });

    // 결과를 파일로 저장
    fs.writeFileSync(
      'bulk-register-result-updated.json',
      JSON.stringify(result, null, 2),
      'utf8'
    );
    console.log('\n결과가 bulk-register-result-updated.json 파일에 저장되었습니다.');
  })
  .catch(error => {
    console.error('에러 발생:', error);
  });
