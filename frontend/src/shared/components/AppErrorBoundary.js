import React, { Component } from 'react';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppErrorBoundary Caught Fatal Exception]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = typeof this.state.error === 'object' 
        ? (this.state.error?.message || JSON.stringify(this.state.error)) 
        : String(this.state.error || 'An unexpected rendering error occurred');

      return (
        <div style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
          backgroundColor: '#f8fafc',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <i className="fas fa-exclamation-circle" style={{ fontSize: '3rem', color: '#8b1538', marginBottom: '1rem' }}></i>
            <h2 style={{ color: '#0f172a', marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 800 }}>Something Went Wrong</h2>
            <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              An unexpected error occurred while loading this page.
            </p>
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              textAlign: 'left',
              marginBottom: '1.5rem',
              wordBreak: 'break-word',
              fontFamily: 'monospace'
            }}>
              {errorMessage}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#8b1538',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
