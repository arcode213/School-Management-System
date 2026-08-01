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
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Animated background lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full filter blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full filter blur-3xl animate-pulse-glow delay-1000" />
      </div>

      <div className="relative w-full max-w-md z-10 animate-fade-in-up">
        {/* Card */}
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              <BookOpen className="text-white w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight uppercase">School Management</h1>
            <p className="text-slate-400 mt-1.5 text-xs font-semibold uppercase tracking-wider">Access the administration hub</p>
          </div>

          {/* Quick credentials hint */}
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-4 mb-6 text-xs text-blue-300 flex items-start gap-2.5">
            <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1" />
            <div>
              <span className="font-bold block uppercase tracking-wider mb-0.5">Demo Account</span>
              <span className="text-slate-400">admin@school.com</span>
              <span className="text-slate-500 mx-1.5">|</span>
              <span className="text-slate-400">admin123</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.com"
                required
                className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : null}
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-6">
          School Management System &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
