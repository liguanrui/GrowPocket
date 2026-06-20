import type { User, Family, Task, Transaction, RedeemItem, Redeem, Message } from '../types';

export const currentFamily: Family = {
  id: 'family-001',
  name: '阳光小镇',
  createdAt: new Date('2024-01-15'),
};

// === 统一账号表（家长 + 孩子档案）===
// role=parent：家长账号，可登录
// role=child：孩子档案，后续可扩展为孩子登录
export const users: User[] = [
  {
    id: 'user-001',
    familyId: 'family-001',
    role: 'parent',
    nickname: '爸爸',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=dad',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'child-001',
    familyId: 'family-001',
    role: 'child',
    nickname: '小明',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ming',
    gender: 0,
    birthday: new Date('2016-05-20'),
    balance: 2850,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date(),
  },
  {
    id: 'child-002',
    familyId: 'family-001',
    role: 'child',
    nickname: '小红',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=hong',
    gender: 1,
    birthday: new Date('2018-08-15'),
    balance: 3200,
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date(),
  },
];

// 便捷导出：当前家长账号
export const currentUser: User = users.find((u) => u.role === 'parent') || users[0];

// 便捷导出：孩子列表
export const children: User[] = users.filter((u) => u.role === 'child');

// === 任务 ===
// 普通任务：从 in_progress 开始
// 奖惩类任务（手动加/减积分）：直接 created status = completed，可关联照片
export const tasks: Task[] = [
  {
    id: 'task-001',
    familyId: 'family-001',
    title: '整理房间',
    description: '把自己的房间收拾整齐，衣物叠好放回衣柜，书本放回书架',
    points: 50,
    status: 'in_progress',
    childId: 'child-001',
    childName: '小明',
    createdBy: 'user-001',
    deadline: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'task-002',
    familyId: 'family-001',
    title: '洗碗',
    description: '吃完饭后帮忙洗碗，清洁灶台',
    points: 30,
    status: 'in_progress',
    childId: 'child-001',
    childName: '小明',
    createdBy: 'user-001',
    deadline: new Date(Date.now() + 43200000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'task-003',
    familyId: 'family-001',
    title: '完成数学作业',
    description: '认真完成第5单元练习题',
    points: 80,
    status: 'submitted',
    childId: 'child-002',
    childName: '小红',
    createdBy: 'user-001',
    photo: 'https://picsum.photos/400/300?random=1',
    deadline: new Date(Date.now() + 172800000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'task-004',
    familyId: 'family-001',
    title: '浇花',
    description: '给阳台上的植物浇水',
    points: 25,
    status: 'completed',
    childId: 'child-001',
    childName: '小明',
    createdBy: 'user-001',
    photo: 'https://picsum.photos/400/300?random=2',
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(),
  },
  {
    id: 'task-005',
    familyId: 'family-001',
    title: '阅读30分钟',
    description: '阅读课外书30分钟，并做好读书笔记',
    points: 60,
    status: 'submitted',
    childId: 'child-001',
    childName: '小明',
    createdBy: 'user-001',
    photo: 'https://picsum.photos/400/300?random=3',
    deadline: new Date(Date.now() + 259200000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'task-006',
    familyId: 'family-001',
    title: '手工制作：小鸟屋',
    description: '和爸爸一起完成手工制作',
    points: 100,
    status: 'completed',
    childId: 'child-002',
    childName: '小红',
    createdBy: 'user-001',
    photo: 'https://picsum.photos/400/300?random=4',
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(),
  },
  {
    id: 'task-007',
    familyId: 'family-001',
    title: '倒垃圾',
    description: '每天晚上把家里的垃圾分类好，放到楼下',
    points: 15,
    status: 'rejected',
    childId: 'child-002',
    childName: '小红',
    createdBy: 'user-001',
    photo: 'https://picsum.photos/400/300?random=5',
    createdAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(),
  },
  // --- 奖惩类任务（手动加减积分）：status 直接 = completed ---
  {
    id: 'task-reward-001',
    familyId: 'family-001',
    title: '期中考试进步奖',
    description: '数学比上次考试进步了 15 分，继续保持！',
    points: 100,
    status: 'completed',
    childId: 'child-001',
    childName: '小明',
    createdBy: 'user-001',
    photo: 'https://picsum.photos/400/300?random=6', // 成绩单照片
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(),
  },
  {
    id: 'task-reward-002',
    familyId: 'family-001',
    title: '参加校运会 100 米获得第二名',
    description: '为班级争光，获得校级奖项！',
    points: 200,
    status: 'completed',
    childId: 'child-002',
    childName: '小红',
    createdBy: 'user-001',
    photo: 'https://picsum.photos/400/300?random=7',
    createdAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(),
  },
  {
    id: 'task-penalty-001',
    familyId: 'family-001',
    title: '忘记完成家庭作业（扣积分）',
    description: '今天没有完成家庭作业，按约定扣除积分。下次加油！',
    points: -30, // 负数表示扣除
    status: 'completed',
    childId: 'child-001',
    childName: '小明',
    createdBy: 'user-001',
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(),
  },
];

// === 积分变动记录 ===
export const transactions: Transaction[] = [
  { id: 'tx-001', childId: 'child-001', type: 'income', amount: 50, reason: '完成任务：整理房间', relatedId: 'task-001', relatedType: 'task', balanceAfter: 2850, createdAt: new Date(Date.now() - 3600000) },
  { id: 'tx-002', childId: 'child-001', type: 'income', amount: 25, reason: '完成任务：浇花', relatedId: 'task-004', relatedType: 'task', balanceAfter: 2800, createdAt: new Date(Date.now() - 43200000) },
  { id: 'tx-003', childId: 'child-001', type: 'expense', amount: 500, reason: '兑换：1小时游戏时间', relatedId: 'redeem-001', relatedType: 'redeem', balanceAfter: 2775, createdAt: new Date(Date.now() - 86400000) },
  { id: 'tx-004', childId: 'child-001', type: 'income', amount: 100, reason: '奖惩：期中考试进步奖', relatedId: 'task-reward-001', relatedType: 'task', balanceAfter: 2795, createdAt: new Date(Date.now() - 172800000) },
  { id: 'tx-005', childId: 'child-001', type: 'expense', amount: 30, reason: '奖惩：忘记完成家庭作业', relatedId: 'task-penalty-001', relatedType: 'task', balanceAfter: 2715, createdAt: new Date(Date.now() - 86400000) },
  { id: 'tx-006', childId: 'child-001', type: 'income', amount: 60, reason: '完成任务：阅读', relatedId: 'task-005', relatedType: 'task', balanceAfter: 2715, createdAt: new Date(Date.now() - 259200000) },
  { id: 'tx-007', childId: 'child-002', type: 'income', amount: 80, reason: '完成任务：数学作业', relatedId: 'task-003', relatedType: 'task', balanceAfter: 3200, createdAt: new Date(Date.now() - 7200000) },
  { id: 'tx-008', childId: 'child-002', type: 'income', amount: 100, reason: '完成任务：手工制作', relatedId: 'task-006', relatedType: 'task', balanceAfter: 3120, createdAt: new Date(Date.now() - 172800000) },
  { id: 'tx-009', childId: 'child-002', type: 'income', amount: 200, reason: '奖惩：校运会获奖', relatedId: 'task-reward-002', relatedType: 'task', balanceAfter: 3020, createdAt: new Date(Date.now() - 259200000) },
  { id: 'tx-010', childId: 'child-002', type: 'expense', amount: 300, reason: '兑换：选餐厅特权', relatedId: 'redeem-002', relatedType: 'redeem', balanceAfter: 3020, createdAt: new Date(Date.now() - 302400000) },
];

// === 兑换商品 ===
export const redeemItems: RedeemItem[] = [
  { id: 'item-001', familyId: 'family-001', name: '1小时游戏时间', description: '周末可以多玩1小时游戏', points: 500, image: 'https://picsum.photos/400/300?random=10', category: 'experience', stock: 10, createdAt: new Date() },
  { id: 'item-002', familyId: 'family-001', name: '选餐厅特权', description: '周末全家外出就餐时，可以由你选择餐厅', points: 300, image: 'https://picsum.photos/400/300?random=11', category: 'privilege', stock: 5, createdAt: new Date() },
  { id: 'item-003', familyId: 'family-001', name: '精美文具套装', description: '一套可爱的彩色笔和笔记本', points: 1000, image: 'https://picsum.photos/400/300?random=12', category: 'physical', stock: 8, createdAt: new Date() },
  { id: 'item-004', familyId: 'family-001', name: '公园野餐', description: '全家人一起去公园野餐', points: 1500, image: 'https://picsum.photos/400/300?random=13', category: 'experience', stock: 3, createdAt: new Date() },
  { id: 'item-005', familyId: 'family-001', name: '晚睡许可', description: '可以比平时晚睡1小时', points: 200, image: 'https://picsum.photos/400/300?random=14', category: 'privilege', stock: -1, createdAt: new Date() },
  { id: 'item-006', familyId: 'family-001', name: '迷你乐高玩具', description: '一个可爱的小动物乐高模型', points: 2000, image: 'https://picsum.photos/400/300?random=15', category: 'physical', stock: 5, createdAt: new Date() },
];

// === 兑换记录（去掉审核，点击即完成）===
export const redeems: Redeem[] = [
  { id: 'redeem-001', childId: 'child-001', childName: '小明', itemId: 'item-001', itemName: '1小时游戏时间', itemImage: 'https://picsum.photos/400/300?random=10', points: 500, createdAt: new Date(Date.now() - 86400000) },
  { id: 'redeem-002', childId: 'child-002', childName: '小红', itemId: 'item-002', itemName: '选餐厅特权', itemImage: 'https://picsum.photos/400/300?random=11', points: 300, createdAt: new Date(Date.now() - 302400000) },
];

// === 消息/通知（去掉兑换审核相关，只保留任务/系统通知）===
export const messages: Message[] = [
  { id: 'msg-001', type: 'task', title: '待验收提醒', content: '小明提交了任务「阅读30分钟」，请家长验收', status: 'unread', relatedId: 'task-005', createdAt: new Date(Date.now() - 3600000) },
  { id: 'msg-002', type: 'task', title: '待验收提醒', content: '小红提交了任务「完成数学作业」，请家长验收', status: 'unread', relatedId: 'task-003', createdAt: new Date(Date.now() - 7200000) },
  { id: 'msg-003', type: 'system', title: '欢迎使用童劳童得', content: '和孩子一起建立健康的成长激励系统', status: 'read', createdAt: new Date(Date.now() - 86400000) },
];

// === 便捷函数：获取当前默认选中孩子（首页展示用）===
// 注意：current_child 不存在数据库中，仅前端逻辑：默认展示第一个孩子
export function getDefaultChild(): User {
  return children[0];
}

export { getDefaultChild as getCurrentChild };

// === 积分趋势图数据 ===
export function getTrendData(childId: string, days: number = 7) {
  const childTxs = transactions.filter((t) => t.childId === childId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const result = [];
  let balance = 2500;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dailyChange = Math.floor(Math.random() * 200 - 50);
    balance += dailyChange;
    result.push({
      date: d.toISOString().slice(0, 10),
      balance: Math.max(0, balance),
    });
  }
  const child = users.find((u) => u.id === childId);
  if (child && child.balance !== undefined) result[result.length - 1].balance = child.balance;
  void childTxs; // 预留扩展
  return result;
}

// === 兼容旧页面的别名导出 ===
export const mockMembers = children;
export const mockTasks = tasks;
export const mockBadges = [
  { id: 'b1', name: '勤学好问', title: '勤学好问', icon: '📚', description: '认真完成学习任务', earnedAt: new Date() },
  { id: 'b2', name: '劳动小能手', title: '劳动小能手', icon: '🧹', description: '积极做家务', earnedAt: new Date() },
];
export const mockRewards = redeemItems;
export const mockPointsRecords = transactions;
