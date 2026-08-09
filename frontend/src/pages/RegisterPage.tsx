import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function RegisterPage() {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [showShareCode, setShowShareCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) {
      setError('请填写昵称和密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (password !== password2) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await register(nickname.trim(), password, shareCode.trim() || undefined);
      // 加入已有家庭且已有孩子 → 首页；否则走新手引导
      if (result.hasChildren) {
        navigate('/home', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg via-white to-bg-secondary p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-primary/15 rounded-2xl flex items-center justify-center mb-4 text-3xl">
            🌟
          </div>
          <h1 className="text-2xl font-bold text-gray-900">创建家长账号</h1>
          <p className="text-sm text-gray-500 mt-2">让每个孩子在劳动中成长</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">昵称</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              placeholder="请输入昵称（如：爸爸）"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              placeholder="至少 6 位"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">确认密码</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              placeholder="请再次输入密码"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowShareCode((v) => !v)}
              className="text-sm text-primary font-medium"
            >
              {showShareCode ? '收起家庭分享码' : '已有家庭？填写分享码加入 →'}
            </button>
            {showShareCode && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">家庭分享码（可选）</label>
                <input
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition font-mono tracking-widest uppercase"
                  placeholder="8 位分享码"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  向家庭中已注册的家长索取分享码，填写后即可加入同一家庭
                </p>
              </div>
            )}
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-primary to-warm-light hover:from-primary-dark hover:to-warm-dark text-white font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
          >
            {loading ? '注册中...' : shareCode.trim() ? '加入家庭并注册' : '注册并登录'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          已有账号？
          <Link to="/login" className="text-primary font-medium hover:text-primary-dark ml-1">
            去登录
          </Link>
        </div>
      </div>
    </div>
  );
}
