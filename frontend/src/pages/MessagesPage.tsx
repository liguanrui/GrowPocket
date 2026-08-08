import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, ClipboardList, Megaphone, PartyPopper, Users } from 'lucide-react';
import * as messagesService from '../services/messages';
import type { SystemMessage } from '../services/messages';
import { useToastStore } from '../stores/toastStore';

function typeMeta(type: string): { icon: typeof Bell; color: string; label: string } {
  switch (type) {
    case 'activity_join_success':
      return { icon: PartyPopper, color: 'bg-emerald-100 text-emerald-600', label: '报名成功' };
    case 'activity_new_signup':
      return { icon: Users, color: 'bg-amber-100 text-amber-600', label: '新报名' };
    case 'activity_full':
      return { icon: Megaphone, color: 'bg-rose-100 text-rose-600', label: '已满员' };
    case 'activity_completed':
    case 'activity_tip':
      return { icon: ClipboardList, color: 'bg-blue-100 text-blue-600', label: '活动动态' };
    case 'activity_published':
      return { icon: Megaphone, color: 'bg-primary/10 text-primary', label: '发布成功' };
    case 'donation_submitted':
      return { icon: Megaphone, color: 'bg-amber-100 text-amber-700', label: '捐赠申请' };
    case 'donation_received':
      return { icon: ClipboardList, color: 'bg-blue-100 text-blue-600', label: '已收件' };
    case 'donation_completed':
      return { icon: PartyPopper, color: 'bg-emerald-100 text-emerald-600', label: '积分到账' };
    default:
      return { icon: Bell, color: 'bg-gray-100 text-gray-600', label: '系统消息' };
  }
}

export function MessagesPage() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const [items, setItems] = useState<SystemMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await messagesService.fetchMessages({ unread_only: unreadOnly, page_size: 50 });
      setItems(res.items || []);
    } catch (e: any) {
      toast.error(e?.message || '加载消息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [unreadOnly]);

  const handleOpen = async (msg: SystemMessage) => {
    if (!msg.is_read) {
      try {
        await messagesService.markMessageRead(msg.id);
        setItems((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)));
      } catch {
        /* ignore */
      }
    }
    if (msg.related_type === 'activity' || msg.related_type === 'donation') {
      navigate('/community');
    }
  };

  const handleMarkAll = async () => {
    try {
      await messagesService.markAllMessagesRead();
      setItems((prev) => prev.map((m) => ({ ...m, is_read: true })));
      toast.success('已全部标为已读');
    } catch (e: any) {
      toast.error(e?.message || '操作失败');
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-amber-500 pt-4 pb-8 px-4 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white"
              aria-label="返回"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">系统消息</h1>
              <p className="text-white/80 text-sm">报名通知与活动动态</p>
            </div>
            <button
              onClick={() => void handleMarkAll()}
              className="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium flex items-center gap-1"
            >
              <CheckCheck size={14} />
              全部已读
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-3">
        <div className="flex gap-2">
          {[
            { key: false, label: '全部' },
            { key: true, label: '未读' },
          ].map((tab) => (
            <button
              key={String(tab.key)}
              onClick={() => setUnreadOnly(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                unreadOnly === tab.key ? 'bg-primary text-white' : 'bg-card text-text-tertiary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-text-tertiary py-12">加载中...</div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-2xl p-10 text-center shadow-sm">
            <Bell size={40} className="mx-auto text-text-tertiary mb-3" />
            <p className="text-text-primary font-medium">{unreadOnly ? '暂无未读消息' : '暂无系统消息'}</p>
            <p className="text-sm text-text-tertiary mt-1">活动报名、满员、完成等动态会出现在这里</p>
          </div>
        ) : (
          items.map((msg) => {
            const meta = typeMeta(msg.type);
            const Icon = meta.icon;
            return (
              <button
                key={msg.id}
                onClick={() => void handleOpen(msg)}
                className={`w-full text-left bg-card rounded-2xl p-4 shadow-sm transition-colors ${
                  msg.is_read ? 'opacity-80' : 'ring-1 ring-primary/20'
                }`}
              >
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-semibold truncate ${msg.is_read ? 'text-text-secondary' : 'text-text-primary'}`}>
                        {msg.title}
                      </h3>
                      {!msg.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      <span className="text-[10px] text-text-tertiary ml-auto shrink-0">{meta.label}</span>
                    </div>
                    <p className="text-sm text-text-tertiary mt-1 leading-5 line-clamp-3">{msg.content}</p>
                    <p className="text-xs text-text-tertiary mt-2">
                      {msg.created_at ? new Date(msg.created_at).toLocaleString('zh-CN') : ''}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MessagesPage;
