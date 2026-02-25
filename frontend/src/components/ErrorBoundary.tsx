/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

/**
 * Error Boundary Component
 *
 * Catches React errors and displays fallback UI
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught by boundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
          padding: '2rem',
          fontFamily: 'inherit'
        }}>
          <div style={{
            textAlign: 'center',
            background: '#ffffff',
            padding: '3rem 2rem',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
            maxWidth: '500px',
            width: '100%'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: '24px'
            }}>
              ⚠️
            </div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: '#111827',
              margin: '0 0 0.75rem 0'
            }}>
              Something went wrong
            </h1>
            <p style={{
              color: '#6b7280',
              fontSize: '0.95rem',
              margin: '0 0 1.5rem 0',
              lineHeight: 1.6
            }}>
              {this.state.error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 150ms ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
              >
                Reload Page
              </button>
              <button
                onClick={() => window.history.back()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 150ms ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#d1d5db'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#e5e7eb'}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
