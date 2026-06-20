import { useState, useEffect } from 'react';
import { Camera, Calendar, Trophy, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import * as growthService from '../services/growth';
import type { AlbumPhoto, TimelineEvent, TimelineDay } from '../services/growth';

export function GrowthPage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        await childStore.fetchChildren();
        const child = useChildStore.getState().getCurrentChild();
        if (!child) {
          if (mounted) setLoading(false);
          return;
        }
        const [albumResult, timelineResult] = await Promise.all([
          growthService.getAlbum(child.id, 1, 12),
          growthService.getTimeline(child.id),
        ]);
        if (mounted) {
          setAlbum(albumResult.items);
          setTimeline(timelineResult);
        }
      } catch (e: any) {
        if (mounted) setError(e.message || '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const currentChild = useChildStore.getState().getCurrentChild();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-danger font-medium">{error}</div>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl">重试</button>
        </div>
      </div>
    );
  }

  if (!currentChild) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-text-primary font-medium">暂无孩子档案</div>
          <button onClick={() => navigate('/family')} className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl">添加孩子</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 pt-6 pb-10 px-4 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">成长记录</h1>
              <p className="text-white/80 text-sm mt-0.5">记录每一个成长瞬间</p>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/80 text-xs">孩子</div>
                <div className="text-white font-semibold text-lg mt-0.5">{currentChild.nickname}</div>
              </div>
              <div className="text-right">
                <div className="text-white/80 text-xs">累计积分</div>
                <div className="text-white text-2xl font-bold mt-0.5">{currentChild.balance}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera size={20} className="text-emerald-500" />
              <h2 className="font-semibold text-text-primary">成果相册</h2>
            </div>
          </div>
          {album.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {album.map((photo, idx) => (
                <div key={idx} className="aspect-square rounded-xl bg-gray-100 overflow-hidden">
                  <img src={photo.photo} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary text-sm">暂无照片</div>
          )}
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-orange-500" />
              <h2 className="font-semibold text-text-primary">成长时间线</h2>
            </div>
          </div>
          {timeline.length > 0 ? (
            <div className="space-y-4">
              {timeline.slice(0, 10).map((day, idx) => (
                <div key={idx}>
                  <div className="text-xs text-text-tertiary font-medium mb-2">{day.date}</div>
                  <div className="space-y-2">
                    {day.events.map((event, eIdx) => (
                      <div key={eIdx} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                          {event.type === 'task' ? <Star size={14} /> : event.type === 'redeem' ? <Camera size={14} /> : <Trophy size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary">{event.title}</div>
                          <div className="text-xs text-primary mt-1">+{event.points} 积分</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary text-sm">暂无时间线记录</div>
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

export default GrowthPage;
