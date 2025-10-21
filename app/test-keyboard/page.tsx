"use client";

import { useState } from "react";

export default function TestKeyboardPage() {
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");
  const [value3, setValue3] = useState("");

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: '#f9fafb'
    }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem', fontWeight: 'bold' }}>
        iOS PWA 키보드 테스트
      </h1>

      {/* 테스트 1: 완전 기본 input */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>테스트 1: 기본 input</h2>
        <input
          type="text"
          value={value1}
          onChange={(e) => setValue1(e.target.value)}
          placeholder="기본 input - 스타일 없음"
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>

      {/* 테스트 2: iOS 최적화 속성 추가 */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>테스트 2: iOS 최적화 속성</h2>
        <input
          type="text"
          value={value2}
          onChange={(e) => setValue2(e.target.value)}
          onTouchStart={(e) => {
            e.preventDefault();
            e.currentTarget.focus();
          }}
          placeholder="onTouchStart + webkit 속성"
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            WebkitUserSelect: 'text',
            WebkitTouchCallout: 'default',
            WebkitTapHighlightColor: 'rgba(0, 0, 0, 0.1)'
          }}
        />
      </div>

      {/* 테스트 3: readOnly 해제 트릭 */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>테스트 3: readOnly 트릭</h2>
        <input
          type="text"
          value={value3}
          onChange={(e) => setValue3(e.target.value)}
          onFocus={(e) => {
            e.currentTarget.removeAttribute('readonly');
          }}
          readOnly
          placeholder="readOnly 해제 트릭"
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>

      {/* 현재 값 표시 */}
      <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>입력된 값:</h2>
        <p>테스트 1: {value1 || "(비어있음)"}</p>
        <p>테스트 2: {value2 || "(비어있음)"}</p>
        <p>테스트 3: {value3 || "(비어있음)"}</p>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
        <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>테스트 방법:</p>
        <ol style={{ paddingLeft: '1.5rem' }}>
          <li>홈화면 앱으로 이 페이지를 열기</li>
          <li>각 입력 필드를 클릭해보기</li>
          <li>어떤 테스트에서 키보드가 올라오는지 확인</li>
        </ol>
      </div>

      {/* 홈으로 돌아가기 */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a href="/" style={{
          display: 'inline-block',
          padding: '1rem 2rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          fontSize: '1.25rem',
          fontWeight: 'bold',
          borderRadius: '8px',
          textDecoration: 'none'
        }}>
          ← 홈으로 돌아가기
        </a>
      </div>
    </div>
  );
}
