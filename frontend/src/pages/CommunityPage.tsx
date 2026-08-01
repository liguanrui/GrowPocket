import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Plus, X, Image as ImageIcon, MapPin, Users, Calendar, Gift, BookOpen, Trophy, Trash2, CheckCircle } from 'lucide-react';
import { useChildStore } from '../stores/childStore';
import * as communityService from '../services/community';
import type { CommunityShare, CommunityComment, CharityProject, CharityActivity, CharityDonation } from '../services/community';
import { parseAbilitySummary } from '../services/growthStory';

// 活动类型映射
const activityTypeLabels: Record<number, string> = {
  1: '捡垃圾',
  2: '老人院',
  3: '植树',
  4: '博弈游戏',
  5: '其他',
};

// ============ 社区主页 ============
export function CommunityPage() {
  const childStore = useChildStore();
  const [activeTab, setActiveTab] = useState<'feed' | 'projects' | 'activities'>('feed');
  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <div className="min-h-screen bg-bg pb-20">
      {/* 顶部渐变区域 */}
      <div className="bg-gradient-to-br from-success to-success-dark pt-8 pb-10 px-5">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-white">社区广场</h1>
          <p className="text-white/80 text-sm mt-1.5">与其他家庭一起成长</p>
        </div>
      </div>

      {/* Tab 切换栏 */}
      <div className="max-w-lg mx-auto px-4 -mt-3">
        <div className="bg-card rounded-2xl p-1 shadow-sm flex">
          {[
            { id: 'feed', label: '动态' },
            { id: 'projects', label: '公益项目' },
            { id: 'activities', label: '公益活动' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'feed' | 'projects' | 'activities')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="max-w-lg mx-auto px-4 mt-4 space-y-3">
        {activeTab === 'feed' && <ShareFeed onShowShareModal={() => setShowShareModal(true)} />}
        {activeTab === 'projects' && <CharityProjects />}
        {activeTab === 'activities' && <Activities />}
      </div>

      {/* 发布分享浮动按钮 */}
      {activeTab === 'feed' && (
        <button
          onClick={() => setShowShareModal(true)}
          className="fixed bottom-24 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95"
        >
          <Plus size={24} />
        </button>
      )}

      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}
    </div>
  );
}

// ============ 动态 Feed ============
function ShareFeed({ onShowShareModal }: { onShowShareModal: () => void }) {
  const [shares, setShares] = useState<CommunityShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadShares();
  }, []);

  async function loadShares() {
    try {
      setLoading(true);
      const result = await communityService.fetchShares({ page: 1, page_size: 20, sort: 'latest' });
      setShares(result.items);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center text-text-tertiary py-10">加载中...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-danger">{error}</p>
        <button onClick={loadShares} className="mt-3 text-primary text-sm">重试</button>
      </div>
    );
  }

  if (shares.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-10 text-center shadow-sm">
        <ImageIcon size={48} className="mx-auto text-text-tertiary mb-3" />
        <p className="text-text-primary font-medium">还没有分享</p>
        <p className="text-sm text-text-tertiary mt-1">成为第一个分享者吧</p>
        <button
          onClick={onShowShareModal}
          className="mt-4 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium"
        >
          发布分享
        </button>
      </div>
    );
  }

  return (
    <>
      {shares.map((share) => (
        <ShareCard key={share.id} share={share} onRefresh={loadShares} />
      ))}
    </>
  );
}

// ============ 分享卡片 ============
function PhotoGrid({ photos }: { photos: string[] }) {
  if (!photos || photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <div className="aspect-video bg-gray-100 overflow-hidden">
        <img src={photos[0]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  const displayCount = Math.min(photos.length, 9);
  const cols = displayCount === 2 || displayCount === 4 ? 2 : 3;

  return (
    <div className={`grid gap-0.5 p-0.5 bg-gray-100`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {photos.slice(0, displayCount).map((photo, idx) => (
        <div key={idx} className="aspect-square bg-gray-200 overflow-hidden relative">
          <img src={photo} alt="" className="w-full h-full object-cover" />
          {idx === 8 && photos.length > 9 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-xl font-bold">+{photos.length - 9}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ShareCard({ share, onRefresh }: { share: CommunityShare; onRefresh: () => void }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(share.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const child = useChildStore.getState().getCurrentChild();
  const familyId = child?.familyId || 0;

  const isMine = share.family_id === familyId;

  let photos: string[] = [];
  if (share.photo_list && share.photo_list.length > 0) {
    photos = share.photo_list;
  } else if (share.photos) {
    try {
      const parsed = JSON.parse(share.photos);
      if (Array.isArray(parsed)) {
        photos = parsed;
      }
    } catch (e) {
      // ignore parse error
    }
  }
  const displayContent = share.content;

  async function handleLike() {
    try {
      const result = await communityService.toggleLike(share.id);
      setLiked(result.liked);
      setLikeCount(result.like_count);
    } catch (e: any) {
      console.log('点赞失败:', e.message);
    }
  }

  async function toggleComments() {
    if (!showComments && comments.length === 0) {
      try {
        const result = await communityService.fetchComments(share.id);
        setComments(result.items);
      } catch (e: any) {
        console.log('加载评论失败:', e.message);
      }
    }
    setShowComments(!showComments);
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    try {
      const comment = await communityService.addComment(share.id, newComment.trim());
      setComments([comment, ...comments]);
      setNewComment('');
    } catch (e: any) {
      console.log('评论失败:', e.message);
    }
  }

  async function handleDelete() {
    try {
      await communityService.deleteShare(share.id);
      onRefresh();
    } catch (e: any) {
      console.log('删除失败:', e.message);
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  const getTypeLabel = () => {
    if (share.share_type === 'text_task') return '任务完成';
    if (share.share_type === 'text_image') return '图文分享';
    if (share.share_type === 'growth_story') return '成长故事';
    return null;
  };

  const typeLabel = getTypeLabel();

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{share.nickname?.charAt(0) || 'U'}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-text-primary text-sm font-medium">{share.nickname}</span>
            {typeLabel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{typeLabel}</span>
            )}
            {share.tag && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary">{share.tag}</span>
            )}
          </div>
          <span className="text-text-tertiary text-xs">{formatTime(share.created_at)}</span>
        </div>
        {isMine && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-text-tertiary hover:text-danger transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <PhotoGrid photos={photos} />

      <div className="p-3">
        {share.share_type === 'growth_story' ? (
          <div className="p-3 bg-purple-50 rounded-xl">
            <div className="text-xs text-purple-600 font-medium mb-1">成长故事</div>
            {share.ability_summary && (
              <div className="flex flex-wrap gap-1 mb-2">
                {parseAbilitySummary(share.ability_summary).map((item, idx) => (
                  <span key={idx} className="text-xs px-2 py-0.5 bg-white text-purple-700 rounded-full">
                    {item.dimension_name} +{item.delta}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-text-secondary line-clamp-3">{displayContent}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{displayContent}</p>
            {share.share_type === 'text_task' && share.task_points && share.task_points > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Trophy size={14} className="text-primary" />
                <span className="text-sm text-primary font-medium">获得 +{share.task_points} 积分</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-gray-100 p-3 flex items-center justify-between">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:bg-gray-50"
        >
          <Heart size={18} className={liked ? 'text-danger fill-danger' : 'text-text-tertiary'} />
          <span className={`text-sm ${liked ? 'text-danger' : 'text-text-tertiary'}`}>{likeCount}</span>
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:bg-gray-50"
        >
          <MessageCircle size={18} className="text-text-tertiary" />
          <span className="text-sm text-text-tertiary">{share.comment_count}</span>
        </button>
      </div>

      {showComments && (
        <div className="border-t border-gray-100 p-3 bg-gray-50/50">
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-4">暂无评论，来抢沙发</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs text-text-secondary">
                    {comment.nickname?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{comment.nickname}</span>
                      <span className="text-xs text-text-tertiary">{formatTime(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5">{comment.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="发表评论..."
              className="flex-1 px-3 py-2 bg-white rounded-xl text-sm outline-none border border-gray-200 focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && submitComment()}
            />
            <button
              onClick={submitComment}
              disabled={!newComment.trim()}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-text-primary text-center">确认删除</h3>
            <p className="text-text-tertiary text-sm text-center mt-2">删除后将无法恢复</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-text-secondary rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-danger text-white rounded-xl text-sm font-medium"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ 发布分享 Modal ============
function ShareModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tags = ['日常', '学习打卡', '家务', '亲子时光', '活动参与'];

  async function submit() {
    if (!content.trim()) return;
    try {
      setSubmitting(true);
      await communityService.createShare({
        share_type: 'text',
        content: content.trim(),
        tag,
      });
      onClose();
      window.location.reload();
    } catch (e: any) {
      console.log('发布失败:', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <button onClick={onClose} className="p-2 -ml-2 text-text-tertiary">
            <X size={20} />
          </button>
          <h2 className="text-lg font-bold text-text-primary">发布成长分享</h2>
          <button
            onClick={submit}
            disabled={!content.trim() || submitting}
            className="px-3 py-1.5 bg-primary text-white rounded-xl text-sm font-medium disabled:bg-gray-300"
          >
            {submitting ? '发布中...' : '发布'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary block mb-2">分享内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="分享你和孩子的成长故事...（图文、任务分享请前往成长模块发布）"
              maxLength={500}
              rows={5}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary block mb-2">选择标签</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(tag === t ? '' : t)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    tag === t ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 公益项目 ============

function getDonationStatus(status: number): { text: string; color: string; bg: string } {
  switch (status) {
    case 1:
      return { text: '待取件', color: 'text-yellow-700', bg: 'bg-yellow-100' };
    case 2:
      return { text: '已收件', color: 'text-blue-700', bg: 'bg-blue-100' };
    case 3:
      return { text: '已完成', color: 'text-green-700', bg: 'bg-green-100' };
    default:
      return { text: '未知', color: 'text-gray-700', bg: 'bg-gray-100' };
  }
}

function DonationModal({ project, onClose, onSuccess }: { project: CharityProject; onClose: () => void; onSuccess: () => void }) {
  const { children } = useChildStore();
  const [selectedChildId, setSelectedChildId] = useState<number>(children[0]?.id || 0);
  const [weight, setWeight] = useState<string>('');
  const [details, setDetails] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const weightNum = parseFloat(weight) || 0;
  const estimatedPoints = Math.floor(weightNum * (project.points_per_kg || 10));

  const handleSubmit = async () => {
    if (!selectedChildId) {
      alert('请选择捐赠人（孩子）');
      return;
    }
    if (weightNum <= 0) {
      alert('请输入捐赠重量');
      return;
    }
    if (!contactName.trim()) {
      alert('请填写联系人姓名');
      return;
    }
    if (!contactPhone.trim()) {
      alert('请填写联系电话');
      return;
    }
    if (!address.trim()) {
      alert('请填写上门回收地址');
      return;
    }
    setSubmitting(true);
    try {
      await communityService.createDonation(project.id, {
        child_id: selectedChildId,
        weight: weightNum,
        details: details.trim() || undefined,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        address: address.trim(),
      });
      alert('捐赠申请已提交，等待上门取件');
      onClose();
      onSuccess();
    } catch (e: any) {
      alert(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-text-primary text-lg">捐赠 - {project.title}</h3>
            <p className="text-xs text-text-tertiary mt-0.5">{project.points_per_kg || 10}积分/公斤</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-text-tertiary" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary block mb-2">捐赠人（孩子）*</label>
            <div className="flex gap-2 flex-wrap">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition ${
                    selectedChildId === child.id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-secondary border-gray-200'
                  }`}
                >
                  {child.nickname}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary block mb-2">捐赠重量（公斤）*</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="请输入预计捐赠重量"
              className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary"
            />
            {weightNum > 0 && (
              <p className="mt-1 text-sm text-primary font-medium">预计可获得 {estimatedPoints} 积分</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary block mb-2">捐赠说明（选填）</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="简单描述捐赠物品（如：衣物、书本等）"
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary resize-none"
            />
          </div>
          <div className="border-t border-gray-100 pt-4">
            <h4 className="font-medium text-text-primary mb-3">上门取件信息</h4>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-text-tertiary block mb-1">联系人*</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="请输入联系人姓名"
                  className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm text-text-tertiary block mb-1">联系电话*</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="请输入联系电话"
                  className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm text-text-tertiary block mb-1">回收地址*</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="请填写详细的上门回收地址"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none border border-gray-200 focus:border-primary resize-none"
                />
              </div>
            </div>
          </div>
          <div className="bg-primary/5 rounded-xl p-3 text-sm">
            <p className="font-medium text-primary mb-1">📋 捐赠流程</p>
            <ol className="text-xs text-text-secondary space-y-0.5 list-decimal list-inside">
              <li>提交申请后等待机构上门取件</li>
              <li>机构收到捐赠后确认收件</li>
              <li>积分将发放到选中孩子的账户</li>
            </ol>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 bg-card">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
          >
            {submitting ? '提交中...' : '提交捐赠申请'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CharityProjects() {
  const [projects, setProjects] = useState<CharityProject[]>([]);
  const [donations, setDonations] = useState<CharityDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<CharityProject | null>(null);
  const [showMyDonations, setShowMyDonations] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [projResult, donResult] = await Promise.all([
        communityService.fetchCharityProjects(),
        communityService.fetchMyDonations(),
      ]);
      setProjects(projResult.items);
      setDonations(donResult.items);
    } catch (e: any) {
      console.log('加载失败:', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center text-text-tertiary py-10">加载中...</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-text-primary">公益项目</h3>
        <button
          onClick={() => setShowMyDonations(!showMyDonations)}
          className="text-sm text-primary font-medium"
        >
          {showMyDonations ? '← 查看项目' : `我的捐赠 (${donations.length})`}
        </button>
      </div>

      {showMyDonations ? (
        donations.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-2">🎁</p>
            <p className="text-text-secondary font-medium">暂无捐赠记录</p>
            <p className="text-text-tertiary text-sm mt-1">参与公益项目，献出一份爱心</p>
          </div>
        ) : (
          <div className="space-y-3">
            {donations.map((don) => {
              const status = getDonationStatus(don.status);
              return (
                <div key={don.id} className="bg-card rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-text-primary">{don.project_title}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        捐赠人：{don.child_name} · {don.weight}kg
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                      {status.text}
                    </span>
                  </div>
                  {don.details && <p className="text-sm text-text-secondary mb-2">{don.details}</p>}
                  <div className="flex items-center justify-between text-xs text-text-tertiary">
                    <span>{new Date(don.created_at).toLocaleDateString()}</span>
                    {don.status === 3 && (
                      <span className="text-success font-bold">+{don.points}积分</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="bg-card rounded-2xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {project.icon === 'shirt' ? (
                    <Gift size={24} className="text-primary" />
                  ) : project.icon === 'gift' ? (
                    <Gift size={24} className="text-primary" />
                  ) : (
                    <BookOpen size={24} className="text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-text-primary font-bold text-lg">{project.title}</h3>
                  <p className="text-sm text-text-tertiary mt-1 line-clamp-2">{project.description}</p>
                  <p className="text-xs text-primary mt-1 font-medium">{project.points_per_kg || 10}积分/公斤</p>
                </div>
              </div>
              <button
                onClick={() => setActiveProject(project)}
                className="w-full mt-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium"
              >
                我要捐赠
              </button>
            </div>
          ))}
        </div>
      )}

      {activeProject && (
        <DonationModal
          project={activeProject}
          onClose={() => setActiveProject(null)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </>
  );
}

// ============ 公益活动 ============
function Activities() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const [activities, setActivities] = useState<CharityActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState<CharityActivity | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [activityDetails, setActivityDetails] = useState<any>(null);
  const [completeStep, setCompleteStep] = useState<1 | 2 | null>(null);

  const types = [
    { id: 0, label: '全部' },
    { id: 1, label: '捡垃圾' },
    { id: 2, label: '老人院' },
    { id: 3, label: '植树' },
    { id: 4, label: '博弈游戏' },
  ];

  useEffect(() => {
    loadActivities();
  }, [filterType]);

  async function loadActivities() {
    try {
      setLoading(true);
      const result = await communityService.fetchActivities({
        page: 1,
        page_size: 30,
        type: filterType,
      });
      setActivities(result.items);
    } catch (e: any) {
      console.log('加载失败:', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openActivity(activity: CharityActivity) {
    try {
      const result = await communityService.fetchActivity(activity.id);
      setSelectedActivity(activity);
      setParticipants(result.participants);
      setActivityDetails(result);
    } catch (e: any) {
      console.log('加载失败:', e.message);
    }
  }

  async function joinActivity(activityId: number) {
    const childId = childStore.currentChildId;
    if (!childId) {
      alert('请先选择一个孩子');
      return;
    }
    try {
      await communityService.joinActivity(activityId, childId);
      loadActivities();
      if (selectedActivity?.id === activityId) {
        openActivity(selectedActivity);
      }
    } catch (e: any) {
      console.log('报名失败:', e.message);
    }
  }

  async function completeActivity(activityId: number) {
    const childId = childStore.currentChildId;
    if (!childId) {
      alert('请先选择一个孩子');
      return;
    }
    try {
      await communityService.completeActivity(activityId, childId);
      setCompleteStep(2);
      loadActivities();
    } catch (e: any) {
      console.log('完成失败:', e.message);
    }
  }

  function getActivityIcon(type: number) {
    switch (type) {
      case 1: return <ImageIcon size={40} className="text-blue-500" />;
      case 2: return <Heart size={40} className="text-pink-500" />;
      case 3: return <TreePine size={40} className="text-green-500" />;
      case 4: return <Trophy size={40} className="text-purple-500" />;
      default: return <Calendar size={40} className="text-orange-500" />;
    }
  }

  if (loading) return <div className="text-center text-text-tertiary py-10">加载中...</div>;

  return (
    <>
      {/* 发起按钮 */}
      <button
        onClick={() => navigate('/community/activities/new')}
        className="w-full py-3 bg-blue-500 text-white rounded-2xl font-medium shadow-sm hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
      >
        <Plus size={18} />
        发起新活动
      </button>

      {/* 筛选栏 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filterType === t.id
                ? 'bg-primary text-white'
                : 'bg-card text-text-tertiary hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 活动列表 */}
      {activities.length === 0 ? (
        <div className="bg-card rounded-2xl p-10 text-center shadow-sm">
          <Calendar size={48} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-primary font-medium">暂无活动</p>
          <p className="text-sm text-text-tertiary mt-1">点击上方按钮发起第一个活动</p>
        </div>
      ) : (
        activities.map((activity) => (
          <div
            key={activity.id}
            onClick={() => openActivity(activity)}
            className="bg-card rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-all"
          >
            <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center relative">
              {getActivityIcon(activity.activity_type)}
              <span
                className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${
                  activity.status === 1
                    ? 'bg-success text-white'
                    : 'bg-gray-200 text-text-secondary'
                }`}
              >
                {activity.status === 1 ? '招募中' : '已结束'}
              </span>
            </div>
            <div className="p-4">
              <h3 className="text-text-primary font-bold">{activity.title}</h3>
              {activity.description && (
                <p className="text-sm text-text-tertiary mt-1 line-clamp-2">{activity.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-text-tertiary mt-3">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(activity.event_time).toLocaleDateString()}
                </span>
                {activity.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} />
                    {activity.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {activity.participants_count}/{activity.max_participants}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-primary font-bold">+{activity.points} 积分</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    joinActivity(activity.id);
                  }}
                  disabled={activity.participants_count >= activity.max_participants || activity.status !== 1}
                  className="px-4 py-1.5 bg-primary text-white text-sm rounded-xl disabled:bg-gray-300"
                >
                  {activity.participants_count >= activity.max_participants ? '已满员' : '立即报名'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {/* 活动详情 Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center overflow-y-auto">
          <div className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold text-text-primary">{selectedActivity.title}</h2>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="p-2 text-text-tertiary hover:text-text-primary"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-text-tertiary">类型：</span>
                  <span className="text-text-primary font-medium">{activityTypeLabels[selectedActivity.activity_type] || '其他'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-text-tertiary" />
                  <span className="text-text-primary">{new Date(selectedActivity.event_time).toLocaleString()}</span>
                </div>
                {selectedActivity.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-text-tertiary" />
                    <span className="text-text-primary">{selectedActivity.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-text-tertiary" />
                  <span className="text-text-primary">
                    {selectedActivity.participants_count}/{selectedActivity.max_participants} 人已报名
                  </span>
                </div>
                {selectedActivity.description && (
                  <div className="mt-3">
                    <span className="text-text-tertiary">活动描述：</span>
                    <p className="text-text-primary mt-1">{selectedActivity.description}</p>
                  </div>
                )}
              </div>

              {/* 参与者列表 */}
              {participants.length > 0 && (
                <div className="mt-5">
                  <h3 className="font-bold text-text-primary mb-2">参与者 ({participants.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-medium">
                          {p.nickname?.charAt(0) || 'U'}
                        </div>
                        <span className="text-xs text-text-secondary">{p.nickname}</span>
                        {p.completed && <CheckCircle size={12} className="text-success" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="flex-1 py-3 bg-gray-100 text-text-secondary rounded-xl font-medium"
                >
                  关闭
                </button>
                {selectedActivity.status === 1 && (
                  <>
                    <button
                      onClick={() => joinActivity(selectedActivity.id)}
                      disabled={selectedActivity.participants_count >= selectedActivity.max_participants}
                      className="flex-1 py-3 bg-primary text-white rounded-xl font-medium disabled:bg-gray-300"
                    >
                      立即报名
                    </button>
                    <button
                      onClick={() => {
                        setCompleteStep(1);
                      }}
                      className="flex-1 py-3 bg-success text-white rounded-xl font-medium"
                    >
                      标记完成
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 完成活动模态框 */}
            {completeStep === 1 && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-card rounded-2xl p-6 max-w-sm w-full">
                  <h3 className="text-lg font-bold text-text-primary text-center">确认完成</h3>
                  <p className="text-sm text-text-tertiary text-center mt-2">确认您已完成此活动？完成后将获得积分奖励。</p>
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => setCompleteStep(null)}
                      className="flex-1 py-2.5 bg-gray-100 text-text-secondary rounded-xl text-sm font-medium"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => completeActivity(selectedActivity.id)}
                      className="flex-1 py-2.5 bg-success text-white rounded-xl text-sm font-medium"
                    >
                      确认完成
                    </button>
                  </div>
                </div>
              </div>
            )}

            {completeStep === 2 && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-card rounded-2xl p-6 max-w-sm w-full">
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center">
                      <CheckCircle size={40} className="text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary text-center">恭喜完成！</h3>
                  <div className="text-center mt-3">
                    <span className="text-3xl font-bold text-primary">+{selectedActivity.points}</span>
                    <p className="text-sm text-text-tertiary mt-1">积分已加入你的账户</p>
                  </div>
                  <button
                    onClick={() => {
                      setCompleteStep(null);
                      setSelectedActivity(null);
                    }}
                    className="w-full mt-6 py-3 bg-primary text-white rounded-xl font-medium"
                  >
                    继续浏览
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// 缺失的 TreePine 组件，定义一个简单的替代
function TreePine(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m18 8 2 10h-5.5l1.3-4.3L17 10h-3.5l2-3H11L9 7.3 8 4h8l2 4Z" />
      <path d="M10 8H8l1.5 3H7l3 4h3" />
    </svg>
  );
}

export default CommunityPage;
