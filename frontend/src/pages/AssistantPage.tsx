import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useChildStore } from '../stores/childStore';
import * as chatService from '../services/chat';
import { getGrowthIndex } from '../services/ability';
import type { ChatMessage } from '../services/chat';
import { IPPAvatar } from '../components/IPPAvatar';

type ExpressionType = 'happy' | 'encourage' | 'think' | 'surprised' | 'comfort' | 'proud';

// 根据消息 intent 切换 IP 表情
function intentToExpression(intent?: string): ExpressionType {
  switch (intent) {
    case 'query_task':
      return 'happy';
    case 'submit_task':
      return 'proud';
    case 'query_points':
      return 'think';
    case 'query_ability':
      return 'encourage';
    case 'parent_review':
      return 'proud';
    case 'chat':
    default:
      return 'happy';
  }
}

export function AssistantPage() {
  const childStore = useChildStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [growthIndex, setGrowthIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const children = childStore.children;
  const selectedChildId = childStore.currentChildId || children[0]?.id;

  // 获取 IP 阶段
  const ipStage = growthIndex < 20 ? '种子' : growthIndex < 40 ? '萌芽' : growthIndex < 60 ? '小苗' : growthIndex < 80 ? '小树' : '大树';

  useEffect(() => {
    if (children.length === 0) {
      childStore.fetchChildren();
    }
  }, [children.length, childStore]);

  useEffect(() => {
    if (selectedChildId) {
      // 加载历史
      chatService.getChatHistory(selectedChildId).then(res => {
        setMessages(res.messages);
        setSessionId(res.session_id);
      }).catch(() => {});
      // 加载成长指数（用于 IP 展示）
      getGrowthIndex(selectedChildId).then(idx => setGrowthIndex(idx)).catch(() => {});
    }
  }, [selectedChildId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedChildId || loading) return;
    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // 先显示用户消息
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      session_id: sessionId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await chatService.sendMessage(userMessage, selectedChildId, sessionId || undefined);
      setSessionId(res.session_id);
      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        session_id: res.session_id,
        role: 'assistant',
        content: res.reply,
        intent: res.intent,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: Date.now() + 1,
        session_id: sessionId,
        role: 'assistant',
        content: '抱歉，我暂时无法回复，请稍后再试。',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedChildId) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-text-secondary">请先添加孩子档案</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24 flex flex-col">
      {/* 顶部 IP 形象 */}
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 pt-8 pb-6 px-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <IPPAvatar growthIndex={growthIndex} expression="happy" size={64} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">小芽</h1>
              <p className="text-white/80 text-sm">AI 成长助理 · {ipStage}阶段</p>
            </div>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="flex justify-center mb-3">
              <IPPAvatar growthIndex={growthIndex} expression="happy" size={64} animated />
            </div>
            <p className="text-text-secondary">你好呀！我是小芽，可以问我任务、积分或能力成长的事情~</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2 flex-shrink-0">
                <IPPAvatar growthIndex={growthIndex} expression={intentToExpression(msg.intent)} size={32} />
              </div>
            )}
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-primary text-white rounded-br-md'
                : 'bg-card text-text-primary rounded-bl-md shadow-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-2">
              <IPPAvatar growthIndex={growthIndex} expression="think" size={32} />
            </div>
            <div className="bg-card px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="fixed bottom-20 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="对小芽说点什么..."
            className="flex-1 px-4 py-2.5 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-sm"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-11 h-11 bg-primary text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssistantPage;
