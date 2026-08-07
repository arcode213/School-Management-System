import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Animated background lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full filter blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand/10 rounded-full filter blur-3xl animate-pulse-glow delay-1000" />
      </div>

      <div className="relative w-full max-w-md z-10 animate-fade-in-up">
        {/* Card */}
        <div className="card card-lg p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 brand-tile">
              <BookOpen className="w-7 h-7" style={{ color: "#fff" }} />
            </div>
            <h1 className="text-2xl font-extrabold t-body tracking-tight uppercase">School Management</h1>
            <p className="t-muted mt-1.5 text-xs font-semibold uppercase tracking-wider">Access the administration hub</p>
          </div>

          {/* Quick credentials hint */}
          <div className="bg-brand-soft border border-brand-border rounded-2xl p-4 mb-6 text-xs t-brand flex items-start gap-2.5">
            <div className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1" />
            <div>
              <span className="font-bold block uppercase tracking-wider mb-0.5">Demo Account</span>
              <span className="t-muted">admin@school.com</span>
              <span className="t-faint mx-1.5">|</span>
              <span className="t-muted">admin123</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Email Address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.com"
                required
                className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition pr-12 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 t-muted hover:t-body transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3.5 duration-200 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : null}
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center t-muted text-[10px] font-bold uppercase tracking-widest mt-6">
          School Management System &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
