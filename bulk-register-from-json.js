// JSON 파일에서 대량 상품 등록 스크립트
const fs = require('fs');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdXBwbGllcklkIjoiWFBjNjkzQUo1RXRyS2s3eDJRUUUiLCJlbWFpbCI6ImprMTQzNyIsImlhdCI6MTc2MjkzNDM2MywiZXhwIjoxNzYzNTM5MTYzfQ.lnWUM7unft5Sc5elXnOAxwuQ5gEbpI5l6I0CKzZ89wU';

// JSON 파일 읽기
const jsonData = JSON.parse(fs.readFileSync('products_all_20251112_light.json', 'utf8'));

console.log('=== 대량 상품 등록 시작 ===');
console.log(`총 상품 수: ${jsonData.total_products}개`);
console.log(`크롤링 날짜: ${jsonData.crawled_at}`);

// 상품명에서 괄호 내용 제거 함수
function removeBrackets(title) {
  return title.replace(/\([^)]*\)/g, '').trim();
}

// 상품 데이터 변환 (순서대로 50개만)
const products = jsonData.products.slice(0, 50).map(item => {
  const cleanTitle = removeBrackets(item.title_raw);

  return {
    productName: cleanTitle,
    images: [
      {
        data: item.image_url,
        type: "url"
      }
    ]
  };
});

console.log('\n변환 예시:');
console.log('원본:', jsonData.products[0].title_raw);
console.log('변환:', products[0].productName);
console.log('이미지:', products[0].images[0].data);

const requestData = {
  supplierCode: "S00000BS",
  products: products
};

console.log(`\n총 ${products.length}개 상품을 등록합니다...`);
console.log('API 호출 중... (예상 소요 시간: 약 ' + Math.ceil(products.length * 1.5 / 60) + '분)\n');

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
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

    console.log('\n=== 대량 상품 등록 완료 ===');
    console.log(`소요 시간: ${duration}분`);

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

    // 실패한 상품만 출력
    const failedProducts = result.results.filter(r => !r.success);
    if (failedProducts.length > 0) {
      console.log('\n❌ 실패한 상품:');
      failedProducts.forEach((item) => {
        console.log(`[${item.index + 1}] ${item.productName}`);
        console.log(`   에러: ${item.error}`);
      });
    }

    // 성공한 상품 통계
    console.log('\n✅ 성공한 상품 통계:');
    const successProducts = result.results.filter(r => r.success);
    if (successProducts.length > 0) {
      console.log(`첫 번째 상품: ${successProducts[0].productName} (Cafe24 번호: ${successProducts[0].cafe24ProductNo})`);
      console.log(`마지막 상품: ${successProducts[successProducts.length - 1].productName} (Cafe24 번호: ${successProducts[successProducts.length - 1].cafe24ProductNo})`);
    }

    // 결과를 파일로 저장
    fs.writeFileSync(
      'bulk-register-result.json',
      JSON.stringify(result, null, 2),
      'utf8'
    );
    console.log('\n결과가 bulk-register-result.json 파일에 저장되었습니다.');
  })
  .catch(error => {
    console.error('에러 발생:', error);
  });
