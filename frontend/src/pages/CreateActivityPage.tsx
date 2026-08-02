import { useState } from 'react';
import { ArrowLeft, Calendar, MapPin, Users, Trophy, Tag, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as communityService from '../services/community';
import { MobileDatePicker } from '../components/MobileDatePicker';

const activityTypes = [
  { id: 1, label: '捡垃圾', emoji: '🗑️' },
  { id: 2, label: '老人院', emoji: '👴' },
  { id: 3, label: '植树', emoji: '🌳' },
  { id: 4, label: '博弈游戏', emoji: '🎮' },
  { id: 5, label: '其他', emoji: '✨' },
];

export default function CreateActivityPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [type, setType] = useState(1);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [points, setPoints] = useState(80);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim()) {
      alert('请填写活动标题');
      return;
    }
    if (!eventTime) {
      alert('请选择活动时间');
      return;
    }
    try {
      setSubmitting(true);
      await communityService.createActivity({
        title: title.trim(),
        activity_type: type,
        description: description.trim(),
        location: location.trim(),
        event_time: new Date(eventTime).toISOString(),
        max_participants: maxParticipants,
        points,
      });
      alert('活动发布成功！');
      navigate(-1);
    } catch (e: any) {
      alert(e?.message || '发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 pt-4 pb-6 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-white/90 hover:text-white hover:bg-white/10 rounded-full"
            >
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-lg font-bold text-white">发起公益活动</h1>
            <button
              onClick={submit}
              disabled={submitting || !title.trim() || !eventTime}
              className="px-4 py-2 bg-white text-blue-600 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {submitting ? '发布中...' : '发布'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4 pb-8">
        <div className="bg-card rounded-2xl p-4 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary block mb-2 flex items-center gap-1">
              <Tag size={14} className="text-primary" /> 活动标题 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：周末公园捡垃圾"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary block mb-2 flex items-center gap-1">
              活动类型 *
            </label>
            <div className="flex flex-wrap gap-2">
              {activityTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                    type === t.id ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary block mb-2 flex items-center gap-1">
              <FileText size={14} className="text-primary" /> 活动描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述活动内容、注意事项..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary block mb-2 flex items-center gap-1">
              <MapPin size={14} className="text-primary" /> 活动地点
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="请输入活动地点"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary block mb-2 flex items-center gap-1">
              <Calendar size={14} className="text-primary" /> 活动时间 *
            </label>
            <MobileDatePicker
              mode="datetime"
              value={eventTime}
              onChange={setEventTime}
              placeholder="选择活动时间"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary text-left flex items-center justify-between"
            />
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2 flex items-center gap-1">
                <Users size={14} className="text-primary" /> 人数上限
              </label>
              <input
                type="number"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Math.max(1, parseInt(e.target.value) || 10))}
                min={1}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2 flex items-center gap-1">
                <Trophy size={14} className="text-primary" /> 积分奖励
              </label>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
          <p className="font-medium mb-1">💡 温馨提示</p>
          <ul className="text-xs text-blue-600 space-y-0.5 list-disc list-inside">
            <li>发布后其他家庭可以看到并报名参加</li>
            <li>活动当天完成活动后可标记完成获得积分</li>
            <li>确保活动信息准确，方便大家参与</li>
          </ul>
        </div>

        <button
          onClick={submit}
          disabled={submitting || !title.trim() || !eventTime}
          className="w-full py-3.5 bg-primary text-white rounded-2xl font-medium disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {submitting ? '发布中...' : '发布活动'}
        </button>
      </div>
    </div>
  );
}
