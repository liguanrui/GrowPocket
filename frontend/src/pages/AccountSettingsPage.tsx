import { useState } from 'react';
import { BackHeader } from '../components/Header';
import { useAuthStore } from '../stores/authStore';
import { User, Shield, Home, Check, X, Eye, EyeOff } from 'lucide-react';

export function AccountSettingsPage() {
  const authStore = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [form, setForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = () => {
    if (!form.oldPassword || !form.newPassword || !form.confirmPassword) return;
    if (form.newPassword !== form.confirmPassword) {
      alert('两次输入的新密码不一致');
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setShowPasswordForm(false);
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <BackHeader title="登录信息" />

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">账号信息</h3>
            </div>
          </div>
          <div className="space-y-3 pl-13">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-text-secondary">账号名称</span>
              <span className="text-text-primary font-medium">{authStore.user?.nickname || '未登录'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-text-secondary">角色</span>
              <span className="text-text-primary font-medium">
                {authStore.user?.role === 'parent' ? '家长' : '孩子'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-secondary">所属家庭</span>
              <span className="text-text-primary font-medium">{authStore.family?.name || '未加入家庭'}</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Shield size={20} className="text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">密码管理</h3>
              <p className="text-xs text-text-tertiary">定期修改密码保障账户安全</p>
            </div>
          </div>

          {!showPasswordForm ? (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="w-full py-3 bg-primary/5 text-primary rounded-xl font-medium hover:bg-primary/10 transition-colors"
            >
              修改密码
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">当前密码 *</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={form.oldPassword}
                    onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
                    placeholder="输入当前密码"
                  />
                  <button
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  >
                    {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">新密码 *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
                    placeholder="输入新密码"
                  />
                  <button
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">确认新密码 *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
                    placeholder="再次输入新密码"
                  />
                  <button
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 py-3 bg-gray-100 text-text-secondary rounded-xl font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.oldPassword || !form.newPassword || !form.confirmPassword || success}
                  className="flex-1 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {success ? (
                    <>
                      <Check size={18} />
                      修改成功
                    </>
                  ) : (
                    '确认修改'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

export default AccountSettingsPage;
