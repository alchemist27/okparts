// 공급사 코드 설정
const supplierId = 'dJ7R1NltqqqTAHT3wU9Y';
const supplierCode = 'S00000CC';

console.log(`공급사 ${supplierId}에 코드 ${supplierCode} 설정 중...\n`);

fetch('http://localhost:3000/api/admin/update-supplier-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    supplierId,
    supplierCode
  })
})
  .then(response => response.json())
  .then(data => {
    console.log('✅ 성공!');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error('❌ 실패:', error);
  });
