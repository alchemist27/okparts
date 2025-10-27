"use client";

export default function Footer() {
  return (
    <footer style={{
      marginTop: 'auto',
      padding: '2rem 1rem',
      textAlign: 'center',
      borderTop: '1px solid #e5e7eb'
    }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <a
          href="https://okayparts.shop"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline primary"
          style={{
            fontSize: '1.125rem',
            padding: '0.875rem 2rem',
            display: 'inline-block'
          }}
        >
          🛒 쇼핑몰 바로가기
        </a>
        <p style={{
          marginTop: '1rem',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          © OK중고부품 공급사 상품 등록 시스템
        </p>
      </div>
    </footer>
  );
}
