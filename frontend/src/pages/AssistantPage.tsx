import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send, PanelLeft, SquarePen, ChevronDown, Search, X, Plus, MessageCircle,
  Check, Star, CheckSquare, TrendingUp, Gift, UserPlus, Volume2, VolumeX,
  Mic, Keyboard, Volume1, Coins, BarChart3, ListTodo, FileText, ShoppingBag,
  Receipt, Clock, Image, Target, Sparkles, Trophy, Heart, Calendar, Flag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import type { Child } from '../stores/childStore';
import * as chatService from '../services/chat';
import type { ChatMessage, ChatSession } from '../services/chat';
// V3.1 思路 C：IP 不再按成长指数切形态，无需 getGrowthIndex import
import { IPPAvatar } from '../components/IPPAvatar';
import type { IPAnimationName } from '../components/IPPAvatar';
import { ActionConfirmCard } from '../components/ActionConfirmCard';
import type { ActionSuggestion } from '../components/ActionConfirmCard';
import { request } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { isEchoOfLastReply } from '../lib/utils';

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

type ToolIcon = typeof Coins;

interface ToolSuggestion {
  name: string;
  label: string;
  prompt: string;
  icon: ToolIcon;
}

interface ToolSuggestionGroup {
  title: string;
  subtitle: string;
  accent: string;
  items: ToolSuggestion[];
}

// 13 个只读工具提示
const READONLY_TOOL_SUGGESTIONS: ToolSuggestionGroup = {
  title: '查一查',
  subtitle: '查询成长数据',
  accent: '#F59E6B',
  items: [
    { name: 'query_child_balance', label: '积分余额', prompt: '我现在有多少积分？', icon: Coins },
    { name: 'query_child_scores', label: '能力得分', prompt: '帮我看看各项能力得分', icon: BarChart3 },
    { name: 'list_tasks', label: '今日任务', prompt: '今天有哪些待办任务？', icon: ListTodo },
    { name: 'get_task_detail', label: '任务详情', prompt: '帮我看看任务 #1 的详情', icon: FileText },
    { name: 'list_redeem_items', label: '积分商城', prompt: '积分商城有什么好东西？', icon: ShoppingBag },
    { name: 'list_redeem_records', label: '兑换记录', prompt: '最近的积分兑换记录', icon: Receipt },
    { name: 'get_growth_timeline', label: '成长时间线', prompt: '展示最近 30 天的成长时间线', icon: Clock },
    { name: 'get_growth_album', label: '成果相册', prompt: '看看我的成果相册', icon: Image },
    { name: 'get_current_cycle', label: '当前周期', prompt: '当前成长周期及阶段目标', icon: Target },
    { name: 'get_cycle_progress', label: '周期进度', prompt: '帮我查一下周期 #1 的进度', icon: TrendingUp },
    { name: 'list_growth_stories', label: '成长故事', prompt: '看看我的成长故事', icon: Sparkles },
    { name: 'list_master_challenges', label: '大师挑战', prompt: '大师挑战进行得怎么样了？', icon: Trophy },
    { name: 'list_activities', label: '公益活动', prompt: '有什么公益活动可以参加？', icon: Heart },
  ],
};

// 5 个写操作建议工具提示
const WRITE_TOOL_SUGGESTIONS: ToolSuggestionGroup = {
  title: '做一做',
  subtitle: '发起操作',
  accent: '#8B6CE3',
  items: [
    { name: 'submit_task', label: '提交任务', prompt: '我要提交任务 #1', icon: CheckSquare },
    { name: 'redeem_item', label: '兑换商品', prompt: '我想用积分兑换商品 #1', icon: ShoppingBag },
    { name: 'set_stage_goal', label: '设置阶段目标', prompt: '帮我为周期设置一个能力目标', icon: Target },
    { name: 'create_cycle', label: '创建成长周期', prompt: '创建一个新的成长周期', icon: Calendar },
    { name: 'adjust_score', label: '奖励积分', prompt: '给宝贝奖励 50 积分，标题：作业认真', icon: Flag },
  ],
};

// ============ 工具卡横滑行（自动轮播 + 悬停暂停；到首尾停住并反向，不循环）============
interface AutoScrollRowProps {
  group: ToolSuggestionGroup;
  onPick: (prompt: string) => void;
  compact?: boolean;
}
function AutoScrollRow({ group, onPick, compact = false }: AutoScrollRowProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const dirRef = useRef(1); // 1 向右，-1 向左
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    const el = scrollerRef.current;
    el.scrollLeft = 0;
    dirRef.current = 1;

    let lastTs = performance.now();
    const PX_PER_SEC = 28;

    const tick = (ts: number) => {
      if (!scrollerRef.current) return;
      const dt = Math.min(100, ts - lastTs);
      lastTs = ts;
      if (!pausedRef.current) {
        const elNow = scrollerRef.current;
        const maxScroll = Math.max(0, elNow.scrollWidth - elNow.clientWidth);
        if (maxScroll <= 1) {
          // 内容未超出可视区，无需滚动
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        let next = elNow.scrollLeft + (dirRef.current * PX_PER_SEC * dt) / 1000;
        if (next >= maxScroll) {
          next = maxScroll;
          dirRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          dirRef.current = 1;
        }
        elNow.scrollLeft = next;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [group.items.length]);

  return (
    <div>
      {!compact ? (
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13px] font-semibold text-[#2D2A26] flex items-center gap-1.5">
              <span
                className="w-1 h-3.5 rounded-sm"
                style={{ backgroundColor: group.accent }}
              />
              {group.title}
            </h3>
            <span className="text-[11px] text-[#7A7168]">{group.subtitle}</span>
          </div>
          <span className="text-[11px] text-[#B9B1A8]">{group.items.length} 项</span>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold text-[#2D2A26] flex items-center gap-1.5">
              <span
                className="w-1 h-3 rounded-sm"
                style={{ backgroundColor: group.accent }}
              />
              {group.title}
            </h3>
            <span className="text-[10px] text-[#7A7168]">{group.subtitle}</span>
          </div>
          <span className="text-[10px] text-[#B9B1A8]">{group.items.length}</span>
        </div>
      )}
      <div
        ref={scrollerRef}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 600); }}
        className={`flex overflow-x-auto scroll-auto -mx-4 px-4 ${compact ? 'gap-1.5' : 'gap-2'}`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'none',
          scrollBehavior: 'auto',
        }}
      >
        <style>{`.autoscroll-row-hidesb::-webkit-scrollbar{display:none}`}</style>
        {group.items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              onClick={() => onPick(item.prompt)}
              className={`autoscroll-row-hidesb flex-shrink-0 flex flex-col items-center rounded-2xl bg-white border border-[#F5E6D3] hover:border-[#F59E6B]/40 hover:shadow-sm active:scale-[0.98] transition-all ${
                compact
                  ? 'w-[72px] gap-1 py-1.5 px-1'
                  : 'w-[88px] gap-1.5 py-2.5 px-1.5'
              }`}
            >
              <div
                className={`rounded-lg flex items-center justify-center ${compact ? 'w-7 h-7' : 'w-8 h-8'}`}
                style={{
                  backgroundColor: `${group.accent}22`,
                  color: group.accent,
                }}
              >
                <Icon size={compact ? 16 : 18} />
              </div>
              <span
                className={`font-medium text-[#2D2A26] leading-tight text-center line-clamp-1 ${
                  compact ? 'text-[10px]' : 'text-[11px]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ IP 随机表情轮播 APNG ============
const ALL_IP_EXPRESSIONS: IPAnimationName[] = [
  'happy', 'encourage', 'think', 'surprise', 'comfort', 'proud', 'welcome', 'loading',
];

function RandomExpressionAvatar({ size = 96 }: { size?: number }) {
  const [expr, setExpr] = useState<IPAnimationName>(() => {
    // 首帧用 welcome 保持友好；之后随机轮播
    return 'welcome';
  });

  useEffect(() => {
    let cancelled = false;
    const pickNext = (cur: IPAnimationName): IPAnimationName => {
      // 排除当前项，避免重复
      const rest = ALL_IP_EXPRESSIONS.filter((e) => e !== cur);
      return rest[Math.floor(Math.random() * rest.length)];
    };
    const run = () => {
      if (cancelled) return;
      setExpr((prev) => pickNext(prev));
      // 每个表情播放 3.2s，大约跑完一遍 APNG 完整循环再切
      timerId = window.setTimeout(run, 3200);
    };
    let timerId = window.setTimeout(run, 3200);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, []);

  return <IPPAvatar animationName={expr} size={size} />;
}

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
// 动作确认卡片状态：pending 待确认 / executing 执行中 / success 成功 / failed 失败 / cancelled 已取消
type ActionCardStatus = 'pending' | 'executing' | 'success' | 'failed' | 'cancelled';
interface ActionCardState {
  status: ActionCardStatus;
  errorMessage?: string;
}

export function AssistantPage() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const childStore = useChildStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ===== 动作确认卡片状态 =====
  // key = `${msgId}-${actionIdx}`，value = 该卡片的状态机
  const [actionStates, setActionStates] = useState<Record<string, ActionCardState>>({});
  // 本地追加的 AI 消息用负 id，避免与后端返回的正 id 及 Date.now() 临时 id 冲突
  const localMsgIdRef = useRef<number>(0);

  // ===== 语音相关状态 =====
  const [voiceMode, setVoiceMode] = useState(false);          // 底部面板：文字 or 语音
  const [ttsEnabled, setTtsEnabled] = useState(true);         // AI 回复是否朗读
  const [toolsExpanded, setToolsExpanded] = useState(true);   // 查一查/做一做默认展开
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null); // 当前正在朗读哪条 AI 消息
  const sendAfterStopRef = useRef(false);                     // 停止录音后是否自动发送
  const lastAssistantReplyRef = useRef<string>('');           // 上一条 AI 回复全文（用于回声检测）
  const ttsSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stt = useSpeechRecognition({ lang: 'zh-CN', interimResults: true });
  // 儿童友好默认：稍高的 pitch（1.1）模仿小萌芽柔和女声；rate=1.05 不拖沓
  const tts = useSpeechSynthesis({ lang: 'zh-CN', preprocess: true, preferCloud: true });

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

    // 发送前做一次"回声检测"：如果刚刚 TTS 在朗读 AI 回复，而这条用户输入
    // 和那条回复高度相似（≥65%），判定为麦克风录到了扬声器自己的声音 → 丢弃。
    if (isEchoOfLastReply(content, lastAssistantReplyRef.current)) {
      setLoading(false);
      toast.info('刚才的声音像是回声，已过滤。你可以再跟我说一遍~');
      return;
    }

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
      const aiMsgId = Date.now() + 1;
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        session_id: res.session_id,
        role: 'assistant',
        content: res.reply,
        intent: res.intent,
        created_at: new Date().toISOString(),
        suggested_actions: res.suggested_actions,
      };
      setMessages((prev) => [...prev, aiMsg]);
      // 刷新会话列表（更新 last_message）
      loadSessions(selectedChildId);

      // 记录最近一次 AI 回复（用于回声检测）
      lastAssistantReplyRef.current = res.reply;

      // AI 回复朗读（TTS）
      if (ttsEnabled && tts.isSupported && res.reply) {
        // 先确保上一条停掉，避免叠加
        if (ttsSafetyTimerRef.current) {
          clearTimeout(ttsSafetyTimerRef.current);
          ttsSafetyTimerRef.current = null;
        }
        setSpeakingMsgId(aiMsgId);
        tts.speak(res.reply);
        // 兜底：最长 N 秒后自动解除"正在朗读"态（某些系统 onend 偶尔不触发）
        // 粗略按每秒读 4~5 字计算，加上 3 秒缓冲
        const estimatedSec = Math.min(60, Math.max(4, Math.ceil(res.reply.length / 4.5) + 3));
        ttsSafetyTimerRef.current = setTimeout(() => {
          setSpeakingMsgId(null);
        }, estimatedSec * 1000);
      }
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

  // TTS isSpeaking 状态与 speakingMsgId 同步（避免 onend 不触发）
  useEffect(() => {
    if (!tts.isSpeaking && speakingMsgId !== null) {
      if (ttsSafetyTimerRef.current) {
        clearTimeout(ttsSafetyTimerRef.current);
        ttsSafetyTimerRef.current = null;
      }
      setSpeakingMsgId(null);
    }
  }, [tts.isSpeaking, speakingMsgId]);

  /**
   * 点击 AI 气泡时的交互：
   *  - 如果正在朗读这条 → 立即停止
   *  - 没朗读 → 从头朗读这条回复
   */
  const handleAssistantBubbleClick = (msg: ChatMessage) => {
    if (msg.role !== 'assistant' || !tts.isSupported) return;
    if (tts.isSpeaking && speakingMsgId === msg.id) {
      if (ttsSafetyTimerRef.current) {
        clearTimeout(ttsSafetyTimerRef.current);
        ttsSafetyTimerRef.current = null;
      }
      tts.cancel();
      setSpeakingMsgId(null);
      return;
    }
    // 用户主动点气泡 → 临时允许朗读（即使 ttsEnabled 为 false）
    // 因为显式点击本身就是"想再听一遍"
    if (ttsSafetyTimerRef.current) {
      clearTimeout(ttsSafetyTimerRef.current);
      ttsSafetyTimerRef.current = null;
    }
    setSpeakingMsgId(msg.id);
    lastAssistantReplyRef.current = msg.content;
    tts.speak(msg.content);
    const estimatedSec = Math.min(60, Math.max(4, Math.ceil(msg.content.length / 4.5) + 3));
    ttsSafetyTimerRef.current = setTimeout(() => {
      setSpeakingMsgId(null);
    }, estimatedSec * 1000);
  };

  // ===== 语音模式下：点击大麦克风切换录音状态 =====
  const handleVoiceMicClick = () => {
    if (!stt.isSupported) {
      toast.error('当前浏览器不支持语音识别，建议使用 Chrome / Edge / Safari 14+');
      return;
    }
    if (stt.isListening) {
      // 停止 → 稍后自动发送
      sendAfterStopRef.current = true;
      stt.stop();
    } else {
      // ==============  防死循环关键  ==============
      // 开录音前，先强制停止 AI 正在的朗读，并等待"扬声器余音"消散
      // 否则会出现：AI 还在外放 → 麦克风刚好开 → 录到 AI 自己的声音
      //           → 识别成"用户说的话"→ 又触发 AI 回复 → 又朗读 → 死循环
      if (tts.isSpeaking) {
        if (ttsSafetyTimerRef.current) {
          clearTimeout(ttsSafetyTimerRef.current);
          ttsSafetyTimerRef.current = null;
        }
        tts.cancel();
        setSpeakingMsgId(null);
      }
      sendAfterStopRef.current = false;
      // 300ms 静音缓冲：等扬声器残余声波彻底消失再开麦
      setTimeout(() => {
        stt.start();
      }, 300);
    }
  };

  // 监听录音停止：如果是用户主动停止，则发送识别结果
  useEffect(() => {
    if (stt.isListening) return;
    if (!sendAfterStopRef.current) return;
    sendAfterStopRef.current = false;
    const text = (stt.transcript || '').trim();
    if (text) {
      handleSend(text);
      stt.reset();
    }
  }, [stt.isListening]); // eslint-disable-line react-hooks/exhaustive-deps

  // 识别出错时 toast 提示（仅用户操作相关错误）
  useEffect(() => {
    if (stt.error && stt.error !== '录音已取消' && stt.error !== '未检测到语音，请再试一次') {
      toast.error(stt.error);
    }
  }, [stt.error, toast]);

  // 退出语音模式时，确保停止录音
  useEffect(() => {
    if (!voiceMode && stt.isListening) {
      sendAfterStopRef.current = false;
      stt.stop();
      stt.reset();
    }
  }, [voiceMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 页面卸载时停止 TTS
  useEffect(() => {
    return () => {
      if (tts.isSpeaking) tts.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 新建会话
  const handleNewSession = async () => {
    if (!selectedChildId) return;
    try {
      await chatService.createSession(selectedChildId);
      setMessages([]);
      setSessionId(0);
      setActionStates({});
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
    setActionStates({});
  };

  // ===== 动作确认卡片：本地追加一条 AI 文本消息（不消耗 LLM） =====
  const appendLocalAiMessage = (content: string) => {
    localMsgIdRef.current -= 1;
    const aiMsg: ChatMessage = {
      id: localMsgIdRef.current,
      session_id: sessionId,
      role: 'assistant',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMsg]);
  };

  // 设置某张卡片的状态（按 msgId + actionIdx 定位）
  const setActionState = (key: string, patch: Partial<ActionCardState>) => {
    setActionStates((prev) => ({
      ...prev,
      [key]: { status: 'pending', ...prev[key], ...patch },
    }));
  };

  // 确认按钮：执行 suggestion 携带的 API → 成功后刷新数据 / 上报 / 追加 AI 消息
  const handleConfirmAction = async (
    msg: ChatMessage,
    suggestion: ActionSuggestion,
    idx: number,
  ) => {
    const key = `${msg.id}-${idx}`;
    setActionState(key, { status: 'executing', errorMessage: undefined });
    try {
      // 复用通用 request 封装（JWT 自动注入），按 suggestion 携带的方法/路径/体发起请求
      const apiResponse = await request<unknown>({
        method: suggestion.api_method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: suggestion.api_endpoint,
        data: suggestion.api_body,
      });
      setActionState(key, { status: 'success', errorMessage: undefined });
      // 刷新余额等 zustand 数据（fetchChildren 会拉取最新 balance）
      childStore.fetchChildren().catch(() => {});
      // 上报确认结果（审计用，失败不影响用户流程）
      chatService
        .confirmAction(msg.id, suggestion.action, suggestion.params, 'success', apiResponse)
        .catch(() => {});
      toast.success('已成功提交');
      appendLocalAiMessage('好的，已经帮你提交啦，等家长审核哦~');
    } catch (e) {
      const message = e instanceof Error ? e.message : '操作失败，请稍后再试';
      setActionState(key, { status: 'failed', errorMessage: message });
      toast.error(message);
    }
  };

  // 取消按钮：标记已取消并上报
  const handleCancelAction = (
    msg: ChatMessage,
    suggestion: ActionSuggestion,
    idx: number,
  ) => {
    const key = `${msg.id}-${idx}`;
    setActionState(key, { status: 'cancelled', errorMessage: undefined });
    chatService
      .confirmAction(msg.id, suggestion.action, suggestion.params, 'cancelled')
      .catch(() => {});
    appendLocalAiMessage('好的，已取消，有需要再告诉我~');
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
    <div
      className="relative flex flex-col overflow-hidden"
      style={{ background: C.bg, height: 'calc(100dvh - 5rem)' }}
    >
      {/* 固定页眉 */}
      <header
        className="flex-shrink-0 z-50 h-14 flex items-center justify-between px-4 border-b border-[#F5E6D3]"
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
            onClick={() => {
              const next = !ttsEnabled;
              setTtsEnabled(next);
              if (!next && tts.isSpeaking) {
                tts.cancel();
              }
              toast.success(next ? '已开启语音回复' : '已关闭语音回复');
            }}
            className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-95 transition-transform ${
              ttsEnabled
                ? 'bg-[#F59E6B]/10 text-[#F59E6B]'
                : 'bg-[#FFF1E6]/50 text-[#7A7168]'
            }`}
            aria-label={ttsEnabled ? '关闭语音回复' : '开启语音回复'}
            data-dom-id="voice-toggle"
          >
            {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
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

      {/* 查一查 / 做一做：固定在顶部，不随对话滚动 */}
      <section
        className="flex-shrink-0 px-4 pt-2 pb-2 border-b border-[#F5E6D3]"
        style={{ background: C.bg }}
      >
        <div className="max-w-[448px] mx-auto flex flex-col items-stretch gap-2">
          {isEmpty ? (
            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="w-24 h-24 rounded-2xl shadow-md flex items-center justify-center bg-[#FFF1E6]">
                <RandomExpressionAvatar size={84} />
              </div>
              <div className="text-center">
                <h1 className="text-lg font-bold text-[#2D2A26] leading-none">
                  {getGreeting()}，我是小萌芽
                </h1>
                <p className="text-xs text-[#7A7168] mt-1.5 leading-snug">
                  有什么我可以帮你的吗？点下面卡片就能用啦
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl shadow-sm flex items-center justify-center bg-[#FFF1E6] flex-shrink-0">
                <RandomExpressionAvatar size={40} />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[#2D2A26] leading-tight truncate">
                  {getGreeting()}，我是小萌芽
                </div>
                <p className="text-[11px] text-[#7A7168] leading-tight mt-0.5 truncate">
                  试试下面卡片，或直接对我说~
                </p>
              </div>
            </div>
          )}

          {toolsExpanded && (
            <div className="space-y-2">
              {[READONLY_TOOL_SUGGESTIONS, WRITE_TOOL_SUGGESTIONS].map((group) => (
                <AutoScrollRow
                  key={group.title}
                  group={group}
                  compact={!isEmpty}
                  onPick={(prompt) => handleSend(prompt)}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setToolsExpanded((v) => !v)}
            className="w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium text-[#7A7168] active:bg-[#FFF1E6] transition-colors"
            aria-expanded={toolsExpanded}
            aria-label={toolsExpanded ? '收起快捷工具' : '展开快捷工具'}
          >
            <span>{toolsExpanded ? '收起' : '展开'}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${toolsExpanded ? 'rotate-180' : ''}`}
            />
          </button>

        </div>
      </section>

      {/* 仅对话消息区可纵向滚动 */}
      <main className={`flex-1 min-h-0 overflow-y-auto px-4 pt-3 ${voiceMode ? 'pb-48' : 'pb-24'}`}>
        <div className="max-w-[448px] mx-auto">
          {!isEmpty ? (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[#F59E6B]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <IPPAvatar expression={intentToExpression(msg.intent)} size={32} />
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    <div className="flex flex-col gap-2 max-w-[75%]">
                      <button
                        type="button"
                        onClick={() => handleAssistantBubbleClick(msg)}
                        className={`group relative self-start max-w-full px-4 py-2.5 text-left text-sm whitespace-pre-wrap break-words transition-all bg-white text-[#2D2A26] border rounded-lg rounded-tl-sm shadow-sm active:scale-[0.995] ${
                          speakingMsgId === msg.id
                            ? 'border-[#F59E6B] ring-2 ring-[#F59E6B]/20'
                            : 'border-[#F5E6D3] hover:border-[#F59E6B]/25'
                        }`}
                        aria-label={speakingMsgId === msg.id ? '点击停止朗读' : '点击再听一遍'}
                      >
                        <span>{msg.content}</span>
                        {speakingMsgId === msg.id && (
                          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E6B] text-white shadow-md">
                            <span className="flex items-end gap-[2px] h-3">
                              <span className="w-[2px] bg-white rounded-full anim-voice-waveform" style={{ height: '50%', animationDelay: '0s' }} />
                              <span className="w-[2px] bg-white rounded-full anim-voice-waveform" style={{ height: '100%', animationDelay: '0.15s' }} />
                              <span className="w-[2px] bg-white rounded-full anim-voice-waveform" style={{ height: '70%', animationDelay: '0.3s' }} />
                            </span>
                          </span>
                        )}
                        {speakingMsgId !== msg.id && (
                          <span className="pointer-events-none absolute -right-2 -top-1 hidden items-center justify-center h-6 w-6 rounded-full bg-white border border-[#F5E6D3] text-[#F59E6B] group-hover:flex shadow-sm">
                            <Volume1 size={13} />
                          </span>
                        )}
                      </button>
                      {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                        msg.suggested_actions.map((suggestion, idx) => {
                          const key = `${msg.id}-${idx}`;
                          const cardState = actionStates[key];
                          return (
                            <ActionConfirmCard
                              key={key}
                              suggestion={suggestion}
                              status={cardState?.status ?? 'pending'}
                              errorMessage={cardState?.errorMessage}
                              onConfirm={() => handleConfirmAction(msg, suggestion, idx)}
                              onCancel={() => handleCancelAction(msg, suggestion, idx)}
                              onRetry={() => handleConfirmAction(msg, suggestion, idx)}
                            />
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[75%] px-4 py-2.5 text-sm whitespace-pre-wrap break-words bg-[#F59E6B] text-white rounded-lg rounded-tr-sm">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full bg-[#F59E6B]/10 flex items-center justify-center flex-shrink-0">
                    <IPPAvatar animationName="loading" size={32} />
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
          ) : (
            <div ref={messagesEndRef} />
          )}
        </div>
      </main>

      {/* 底部输入栏（固定在 BottomNav 之上） */}
      <div
        className="fixed bottom-20 left-0 right-0 z-40 border-t border-[#F5E6D3] px-2 py-2"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-[448px] mx-auto">
          {!voiceMode ? (
            // ====== 文字输入模式 ======
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!stt.isSupported) {
                    toast.error('当前浏览器不支持语音识别，建议使用 Chrome / Edge / Safari 14+');
                    return;
                  }
                  setVoiceMode(true);
                }}
                className="w-11 h-11 rounded-lg bg-[#FFF1E6] flex items-center justify-center text-[#F59E6B] active:scale-95 transition-transform flex-shrink-0"
                aria-label="切换到语音输入"
                data-dom-id="input-mode-voice"
              >
                <Mic size={18} />
              </button>
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
          ) : (
            // ====== 语音输入模式（参考 assistant-voice.html 设计）======
            <div className="flex flex-col items-center gap-3 py-2">
              {/* 识别文字预览 */}
              <div className="min-h-[40px] w-full flex items-center justify-center rounded-lg bg-[#FFF1E6] px-4 py-2 text-center">
                {stt.isListening ? (
                  <span className="text-sm text-[#2D2A26]">
                    {stt.interimTranscript || stt.transcript || '正在聆听...'}
                  </span>
                ) : stt.transcript ? (
                  <span className="text-sm text-[#2D2A26]">{stt.transcript}</span>
                ) : (
                  <span className="text-sm text-[#7A7168]">点击麦克风开始说话</span>
                )}
              </div>

              {/* 波形可视化 */}
              {stt.isListening && (
                <div className="flex h-10 items-center justify-center gap-1" aria-hidden="true">
                  {[12, 24, 16, 32, 20, 28, 12].map((h, i) => (
                    <span
                      key={i}
                      className="anim-voice-waveform w-1.5 rounded-full bg-[#F59E6B]"
                      style={{
                        height: `${h}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* 控制按钮 */}
              <div className="flex items-center justify-center gap-6">
                {/* 取消：退出语音 + 清空结果 */}
                <button
                  onClick={() => {
                    if (stt.isListening) {
                      sendAfterStopRef.current = false;
                      stt.stop();
                    }
                    stt.reset();
                    setVoiceMode(false);
                  }}
                  className="w-12 h-12 rounded-full bg-[#FFF1E6] text-[#7A7168] flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="取消语音"
                  data-dom-id="voice-cancel"
                >
                  <X size={22} />
                </button>

                {/* 大麦克风：开始/停止录音并发送 */}
                <button
                  onClick={handleVoiceMicClick}
                  className={`relative flex w-16 h-16 items-center justify-center rounded-full shadow-lg text-white transition-transform active:scale-95 flex-shrink-0 ${
                    stt.isListening
                      ? 'bg-[#E87461] anim-voice-mic-pulse'
                      : 'bg-[#F59E6B]'
                  }`}
                  aria-label={stt.isListening ? '停止并发送' : '开始录音'}
                  data-dom-id="voice-mic"
                >
                  <Mic size={28} />
                  {stt.isListening && (
                    <span className="anim-voice-ping-ring absolute inset-0 rounded-full border-2 border-[#F59E6B]/40" />
                  )}
                </button>

                {/* 切回键盘模式（保留已识别文字到输入框） */}
                <button
                  onClick={() => {
                    if (stt.isListening) {
                      sendAfterStopRef.current = false;
                      stt.stop();
                    }
                    const text = (stt.transcript || '').trim();
                    if (text) {
                      setInput(text);
                    }
                    setVoiceMode(false);
                  }}
                  className="w-12 h-12 rounded-full bg-[#FFF1E6] text-[#7A7168] flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="切换到键盘输入"
                  data-dom-id="input-mode-toggle"
                >
                  <Keyboard size={22} />
                </button>
              </div>
            </div>
          )}
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
