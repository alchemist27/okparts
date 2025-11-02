"use client";

export default function Footer() {
  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '0.75rem 1rem',
      textAlign: 'center',
      borderTop: '1px solid #e5e7eb',
      backgroundColor: 'white',
      zIndex: 100
    }}>
      <div className="container" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <p style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          margin: 0
        }}>
          © OK중고부품
        </p>
        <a
          href="https://okayparts.shop"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.875rem',
            color: 'var(--primary)',
            fontWeight: '600',
            textDecoration: 'none'
          }}
        >
          🛒 쇼핑몰 바로가기
        </a>
      </div>
    </footer>
  );
}
