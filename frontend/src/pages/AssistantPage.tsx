import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send, PanelLeft, SquarePen, ChevronDown, Search, X, Plus, MessageCircle,
  Check, Star, CheckSquare, TrendingUp, Gift, UserPlus, Volume2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import type { Child } from '../stores/childStore';
import * as chatService from '../services/chat';
import type { ChatMessage, ChatSession } from '../services/chat';
import { getGrowthIndex } from '../services/ability';
import { IPPAvatar } from '../components/IPPAvatar';
import { useToastStore } from '../stores/toastStore';

type ExpressionType = 'happy' | 'encourage' | 'think' | 'surprised' | 'comfort' | 'proud';

function intentToExpression(intent?: string): ExpressionType {
  switch (intent) {
    case 'query_task': return 'happy';
    case 'submit_task': return 'proud';
    case 'query_points': return 'think';
    case 'query_ability': return 'encourage';
    case 'query_reward': return 'surprised';
    case 'parent_review': return 'proud';
    case 'chat':
    default: return 'happy';
  }
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '上午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

// 会话分组
function groupSessions(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const sevenDaysAgo = today - 7 * 86400000;

  const groups: Record<string, ChatSession[]> = { 今天: [], 昨天: [], '7天内': [], 更早: [] };
  for (const s of sessions) {
    const t = s.last_message_at ? new Date(s.last_message_at).getTime() : new Date(s.created_at).getTime();
    if (t >= today) groups['今天'].push(s);
    else if (t >= yesterday) groups['昨天'].push(s);
    else if (t >= sevenDaysAgo) groups['7天内'].push(s);
    else groups['更早'].push(s);
  }
  return ['今天', '昨天', '7天内', '更早']
    .map((label) => ({ label, items: groups[label] }))
    .filter((g) => g.items.length > 0);
}

function formatSessionTime(s: ChatSession): string {
  const t = s.last_message_at ? new Date(s.last_message_at) : new Date(s.created_at);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tTime = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const diff = today - tTime;
  if (diff === 0) return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  if (diff === 86400000) return '昨天';
  if (diff < 7 * 86400000) return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][t.getDay()];
  return `${t.getMonth() + 1}/${t.getDate()}`;
}

// 暖橙色彩常量
const C = {
  bg: '#FFFAF4', primary: '#F59E6B', primaryFg: '#FFFFFF',
  card: '#FFFFFF', muted: '#FFF1E6', mutedFg: '#7A7168', border: '#F5E6D3',
};

const QUICK_PHRASES = [
  { icon: Star, text: '我的积分是多少？' },
  { icon: CheckSquare, text: '今日任务是什么？' },
  { icon: TrendingUp, text: '帮我看看成长报告' },
  { icon: Gift, text: '最近有什么奖励？' },
];

// ============ 历史抽屉 ============
function HistoryDrawer({
  sessions, currentSessionId, onClose, onSelect, onCreate, onSearch,
}: {
  sessions: ChatSession[];
  currentSessionId: number;
  onClose: () => void;
  onSelect: (s: ChatSession) => void;
  onCreate: () => void;
  onSearch: (q: string) => void;
}) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupSessions(sessions), [sessions]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[4px]"
        onClick={onClose}
        data-dom-id="drawer-scrim"
      />
      <div
        className="fixed top-0 bottom-0 left-0 z-50 flex flex-col w-[85%] max-w-[340px] bg-white shadow-2xl"
        data-region="drawer-panel"
      >
        {/* 头部 */}
        <div className="border-b border-[#F5E6D3] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[#2D2A26]">历史会话</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#FFF1E6] flex items-center justify-center text-[#7A7168]"
              aria-label="关闭抽屉"
            >
              <X size={18} />
            </button>
          </div>
          <div className="h-10 bg-[#FFF1E6] rounded-lg px-3 flex items-center gap-2 mb-3">
            <Search size={16} className="text-[#7A7168]" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); }}
              placeholder="搜索会话..."
              className="bg-transparent text-sm flex-1 outline-none text-[#2D2A26] placeholder:text-[#7A7168]"
            />
          </div>
          <button
            onClick={onCreate}
            className="w-full h-10 rounded-lg bg-[#F59E6B]/10 text-sm font-medium text-[#F59E6B] flex items-center justify-center gap-2"
            data-dom-id="drawer-new-session"
          >
            <Plus size={16} />
            新会话
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {groups.length === 0 ? (
            <p className="text-sm text-[#7A7168] text-center py-8">暂无历史会话</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-2">
                <div className="sticky top-0 z-10 bg-white px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[#7A7168]">
                  {g.label}
                </div>
                {g.items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s)}
                    className={`flex items-start gap-3 rounded-lg px-3 py-3 w-full text-left transition-colors ${
                      s.id === currentSessionId ? 'bg-[#F59E6B]/5' : 'hover:bg-[#FFF1E6]/50'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#F59E6B]/10 flex items-center justify-center flex-shrink-0">
                      <MessageCircle size={14} className="text-[#F59E6B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium text-[#2D2A26]">
                        {s.title || '新会话'}
                      </div>
                      <div className="truncate text-xs text-[#7A7168] mt-0.5">
                        {s.last_message || '暂无消息'}
                      </div>
                    </div>
                    <span className="text-xs text-[#7A7168] flex-shrink-0">
                      {formatSessionTime(s)}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ============ 儿童切换 Popover ============
function ChildSwitchPopover({
  children, currentChildId, onSelect, onClose, onAddChild,
}: {
  children: Child[];
  currentChildId: number | null;
  onSelect: (child: Child) => void;
  onClose: () => void;
  onAddChild: () => void;
}) {
  return (
    <>
      <div
        className="fixed top-14 bottom-0 left-0 right-0 z-40 bg-black/30"
        onClick={onClose}
        data-dom-id="switch-scrim"
      />
      <div
        className="fixed top-16 right-4 z-50 w-60 bg-white rounded-lg border border-[#F5E6D3] shadow-xl"
        data-dom-id="child-switch-popover"
        role="listbox"
        aria-label="选择儿童"
      >
        {/* 箭头 */}
        <div
          className="absolute -top-1.5 right-[22px] w-3 h-3 bg-white border-t border-l border-[#F5E6D3] rotate-45"
        />
        <div className="px-4 py-2.5 border-b border-[#F5E6D3] bg-[#FFF1E6]/50">
          <span className="text-xs font-semibold text-[#7A7168]">选择儿童</span>
        </div>
        <div className="py-1">
          {children.map((child) => {
            const isSelected = child.id === currentChildId;
            return (
              <button
                key={child.id}
                onClick={() => onSelect(child)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors ${
                  isSelected ? 'bg-[#F59E6B]/5 border-l-2 border-[#F59E6B]' : 'hover:bg-[#FFF1E6]/50 border-l-2 border-transparent'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  isSelected ? 'bg-[#F59E6B]/15 text-[#F59E6B]' : 'bg-[#FFF1E6] text-[#7A7168]'
                }`}>
                  {child.nickname.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#2D2A26] truncate">{child.nickname}</div>
                  <div className="text-xs text-[#7A7168]">{child.balance || 0} 积分</div>
                </div>
                {isSelected && <Check size={18} className="text-[#F59E6B]" />}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-[#F5E6D3] my-0.5" />
        <button
          onClick={onAddChild}
          className="flex items-center gap-3 px-3 py-2.5 w-full hover:bg-[#FFF1E6]/50 transition-colors"
          data-dom-id="add-child"
        >
          <div className="w-9 h-9 rounded-full border-2 border-dashed border-[#F5E6D3] flex items-center justify-center text-[#7A7168]">
            <UserPlus size={16} />
          </div>
          <span className="text-sm text-[#7A7168]">添加孩子</span>
        </button>
      </div>
    </>
  );
}

// ============ 主页面 ============
export function AssistantPage() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const childStore = useChildStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [growthIndex, setGrowthIndex] = useState(0);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const children = childStore.children;
  const selectedChildId = childStore.currentChildId || children[0]?.id || null;
  const selectedChild = children.find((c) => c.id === selectedChildId) || null;

  useEffect(() => {
    if (children.length === 0) {
      childStore.fetchChildren();
    }
  }, [children.length, childStore]);

  // 加载会话列表
  const loadSessions = (childId: number) => {
    chatService.getSessions(childId).then(setSessions).catch(() => {});
  };

  // 加载最近会话消息
  const loadRecentMessages = (childId: number) => {
    chatService.getChatHistory(childId).then((res) => {
      setMessages(res.messages);
      setSessionId(res.session_id);
    }).catch(() => {});
  };

  useEffect(() => {
    if (selectedChildId) {
      loadRecentMessages(selectedChildId);
      loadSessions(selectedChildId);
      getGrowthIndex(selectedChildId).then(setGrowthIndex).catch(() => {});
    } else {
      setMessages([]);
      setSessions([]);
    }
  }, [selectedChildId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !selectedChildId || loading) return;
    setInput('');
    setLoading(true);

    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await chatService.sendMessage(content, selectedChildId, sessionId || undefined);
      setSessionId(res.session_id);
      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        session_id: res.session_id,
        role: 'assistant',
        content: res.reply,
        intent: res.intent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      // 刷新会话列表（更新 last_message）
      loadSessions(selectedChildId);
    } catch {
      const errMsg: ChatMessage = {
        id: Date.now() + 1,
        session_id: sessionId,
        role: 'assistant',
        content: '小萌芽暂时无法回复，请稍后再试。',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  // 新建会话
  const handleNewSession = async () => {
    if (!selectedChildId) return;
    try {
      await chatService.createSession(selectedChildId);
      setMessages([]);
      setSessionId(0);
      setShowDrawer(false);
      loadSessions(selectedChildId);
      toast.success('已开启新对话');
    } catch {
      toast.error('新建会话失败');
    }
  };

  // 选择历史会话
  const handleSelectSession = async (s: ChatSession) => {
    try {
      const msgs = await chatService.getSessionMessages(s.id);
      setMessages(msgs);
      setSessionId(s.id);
      setShowDrawer(false);
    } catch {
      toast.error('加载会话失败');
    }
  };

  // 搜索会话
  const handleSearch = (q: string) => {
    if (!selectedChildId) return;
    if (!q.trim()) {
      loadSessions(selectedChildId);
      return;
    }
    chatService.searchSessions(selectedChildId, q).then(setSessions).catch(() => {});
  };

  // 切换儿童
  const handleSelectChild = (child: Child) => {
    childStore.setCurrentChildId(child.id);
    setShowSwitch(false);
    setMessages([]);
    setSessionId(0);
  };

  if (!selectedChildId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
        <p className="text-[#7A7168]">请先添加孩子档案</p>
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: C.bg }}>
      {/* 固定页眉 */}
      <header
        className="sticky top-0 z-50 h-14 flex items-center justify-between px-4 border-b border-[#F5E6D3]"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
      >
        {/* 左侧按钮组 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowDrawer(true); setShowSwitch(false); }}
            className="w-10 h-10 rounded-lg bg-[#FFF1E6]/50 flex items-center justify-center text-[#7A7168] active:scale-95 transition-transform"
            aria-label="打开侧边栏"
            data-dom-id="drawer-toggle"
          >
            <PanelLeft size={20} />
          </button>
          {!isEmpty && (
            <button
              onClick={handleNewSession}
              className="w-10 h-10 rounded-lg bg-[#FFF1E6]/50 flex items-center justify-center text-[#7A7168] active:scale-95 transition-transform"
              aria-label="新建对话"
              data-dom-id="new-session"
            >
              <SquarePen size={20} />
            </button>
          )}
        </div>

        {/* 右侧按钮组 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info('语音功能开发中')}
            className="w-10 h-10 rounded-lg bg-[#FFF1E6]/50 flex items-center justify-center text-[#7A7168] active:scale-95 transition-transform"
            aria-label="语音"
            data-dom-id="voice-toggle"
          >
            <Volume2 size={20} />
          </button>
          <button
            onClick={() => { setShowSwitch(!showSwitch); setShowDrawer(false); }}
            className="relative active:scale-95 transition-transform"
            aria-label="切换孩子"
            data-dom-id="child-switch"
          >
            <div className="w-9 h-9 rounded-full bg-[#F59E6B]/15 flex items-center justify-center font-bold text-sm text-[#F59E6B]">
              {selectedChild?.nickname.charAt(0) || '?'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white border border-[#F5E6D3] flex items-center justify-center">
              <ChevronDown size={10} className="text-[#7A7168]" />
            </div>
          </button>
        </div>
      </header>

      {/* 消息区 / 空状态 */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">
        <div className="max-w-[448px] mx-auto">
          {isEmpty ? (
            /* 空状态 */
            <div className="flex flex-col items-center pt-8">
              <div className="w-32 h-32 rounded-2xl shadow-md mb-6 flex items-center justify-center bg-[#FFF1E6]">
                <IPPAvatar growthIndex={growthIndex} expression="happy" size={96} animated />
              </div>
              <h1 className="text-2xl font-bold text-[#2D2A26] mb-1">
                {getGreeting()}，我是小萌芽
              </h1>
              <p className="text-sm text-[#7A7168] mb-8">有什么我可以帮你的吗？</p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                {QUICK_PHRASES.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(p.text)}
                      className="flex items-center gap-3 px-4 py-3 bg-white border border-[#F5E6D3] rounded-lg text-left hover:bg-[#FFF1E6]/50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#F59E6B]/10 flex items-center justify-center text-[#F59E6B] flex-shrink-0">
                        <Icon size={18} />
                      </div>
                      <span className="text-sm font-medium text-[#2D2A26]">{p.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 消息列表 */
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[#F59E6B]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <IPPAvatar growthIndex={growthIndex} expression={intentToExpression(msg.intent)} size={32} />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'bg-[#F59E6B] text-white rounded-lg rounded-tr-sm'
                        : 'bg-white text-[#2D2A26] border border-[#F5E6D3] rounded-lg rounded-tl-sm shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full bg-[#F59E6B]/10 flex items-center justify-center flex-shrink-0">
                    <IPPAvatar growthIndex={growthIndex} expression="think" size={32} />
                  </div>
                  <div className="bg-white border border-[#F5E6D3] rounded-lg rounded-tl-sm shadow-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-[#7A7168]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-[#7A7168]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-[#7A7168]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* 底部输入栏（固定在 BottomNav 之上） */}
      <div
        className="fixed bottom-20 left-0 right-0 z-40 border-t border-[#F5E6D3] px-2 py-2"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-[448px] mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="对小萌芽说点什么..."
            className="flex-1 px-4 py-2.5 bg-[#FFF1E6] rounded-lg border border-[#F5E6D3] focus:border-[#F59E6B] focus:ring-1 focus:ring-[#F59E6B] outline-none text-[#2D2A26] text-sm placeholder:text-[#7A7168]"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-[#F59E6B] text-white rounded-lg flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* 历史抽屉 */}
      {showDrawer && (
        <HistoryDrawer
          sessions={sessions}
          currentSessionId={sessionId}
          onClose={() => setShowDrawer(false)}
          onSelect={handleSelectSession}
          onCreate={handleNewSession}
          onSearch={handleSearch}
        />
      )}

      {/* 儿童切换 Popover */}
      {showSwitch && (
        <ChildSwitchPopover
          children={children}
          currentChildId={selectedChildId}
          onSelect={handleSelectChild}
          onClose={() => setShowSwitch(false)}
          onAddChild={() => { setShowSwitch(false); navigate('/settings/family'); }}
        />
      )}
    </div>
  );
}

export default AssistantPage;
