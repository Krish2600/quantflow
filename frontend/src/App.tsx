import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import './App.css';

function MainAppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>QuantFlow is booting up...</p>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthScreen />;
}

function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#0b0c10',
    color: '#f8f9fa',
    fontFamily: "'Outfit', sans-serif",
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '3px solid rgba(0, 176, 255, 0.1)',
    borderTop: '3px solid var(--color-brand, #00b0ff)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '20px',
    fontSize: '1rem',
    fontWeight: '500',
    color: '#9aa0a6',
    letterSpacing: '0.5px',
  },
};

// Inject keyframes for loading spinner dynamically if not loaded
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default App;
