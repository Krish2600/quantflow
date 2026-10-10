import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div className="glass-panel" style={styles.card}>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>⚡</div>
          <h1 style={styles.title}>QuantFlow</h1>
          <p style={styles.subtitle}>Real-Time Paper Trading Platform</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <h2 style={styles.formTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          
          {error && <div style={styles.errorAlert}>{error}</div>}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-primary" style={styles.submitBtn} disabled={isLoading}>
            {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              style={styles.toggleBtn}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    background: 'radial-gradient(circle at center, #111422 0%, #06070a 100%)',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px 30px',
    textAlign: 'center',
  },
  logoContainer: {
    marginBottom: '30px',
  },
  logoIcon: {
    fontSize: '2.5rem',
    textShadow: '0 0 10px rgba(0, 176, 255, 0.4)',
    marginBottom: '8px',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: '800',
    letterSpacing: '-1px',
    background: 'linear-gradient(135deg, #fff 0%, #00b0ff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    marginTop: '4px',
  },
  form: {
    textAlign: 'left',
  },
  formTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '20px',
    color: 'var(--text-primary)',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  submitBtn: {
    width: '100%',
    marginTop: '10px',
  },
  errorAlert: {
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger)',
    color: 'var(--color-danger)',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    marginBottom: '16px',
    fontWeight: '500',
  },
  footer: {
    marginTop: '25px',
  },
  footerText: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-brand)',
    fontWeight: '600',
    marginLeft: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontFamily: 'var(--font-sans)',
  },
};
