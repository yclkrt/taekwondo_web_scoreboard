import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[TKD Scoreboard Error]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#07090e',
          color: '#f1f5f9',
          padding: '32px',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          gap: '16px',
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2 style={{ color: '#f87171', margin: 0 }}>Uygulama Hatası</h2>
          <p style={{ color: '#64748b', maxWidth: '500px', lineHeight: 1.6 }}>
            Bir hata oluştu. Sayfayı yenileyip tekrar deneyin.
            Sorun devam ederse localStorage&apos;ı temizleyin.
          </p>
          <pre style={{
            background: '#0f131f',
            border: '1px solid #1e2638',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '12px',
            color: '#f87171',
            maxWidth: '600px',
            overflowX: 'auto',
            textAlign: 'left',
          }}>
            {this.state.error?.toString()}
            {this.state.info?.componentStack}
          </pre>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: '#0066ff',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              🔄 Sayfayı Yenile
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('tkd_match_state');
                window.location.reload();
              }}
              style={{
                padding: '10px 20px',
                background: '#1e2638',
                color: '#94a3b8',
                border: '1px solid #2a3550',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              🗑️ Sıfırla ve Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

