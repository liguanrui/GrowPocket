import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChildStore } from './childStore';

// 使用 vi.hoisted 在同一作用域定义 mock 函数，避免 hoist 引用问题
const { getChildrenMock, addChildMock, updateChildMock, deleteChildMock } = vi.hoisted(() => ({
  getChildrenMock: vi.fn<any>(),
  addChildMock: vi.fn<any>(),
  updateChildMock: vi.fn<any>(),
  deleteChildMock: vi.fn<any>(),
}));

vi.mock('../services/children', () => ({
  getChildren: getChildrenMock,
  addChild: addChildMock,
  updateChild: updateChildMock,
  deleteChild: deleteChildMock,
}));

describe('stores/childStore.ts — 状态管理', () => {
  const mockChildren = [
    { id: 1, family_id: 1, familyId: 1, role: 'child' as const, nickname: 'Ming', balance: 100 },
    { id: 2, family_id: 1, familyId: 1, role: 'child' as const, nickname: 'Hong', balance: 50 },
    { id: 3, family_id: 1, familyId: 1, role: 'child' as const, nickname: 'Hua', balance: 200 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    getChildrenMock.mockReset();
    addChildMock.mockReset();
    updateChildMock.mockReset();
    deleteChildMock.mockReset();
    useChildStore.setState({ children: [], currentChildId: null, loading: false });
  });

  describe('初始状态', () => {
    it('children=[], currentChildId=null, loading=false', () => {
      const state = useChildStore.getState();
      expect(state.children).toEqual([]);
      expect(state.currentChildId).toBeNull();
      expect(state.loading).toBe(false);
    });
  });

  describe('fetchChildren', () => {
    it('fetchChildren 成功后 children 被填充，loading=false', async () => {
      getChildrenMock.mockResolvedValueOnce(mockChildren);

      await useChildStore.getState().fetchChildren();

      expect(useChildStore.getState().children).toEqual(mockChildren);
      expect(useChildStore.getState().loading).toBe(false);
    });

    it('fetchChildren 失败时 loading=false 并抛出错误', async () => {
      getChildrenMock.mockRejectedValueOnce(new Error('network error'));

      await expect(useChildStore.getState().fetchChildren()).rejects.toThrow('network error');
      expect(useChildStore.getState().loading).toBe(false);
    });

    it('fetchChildren 后自动选中第一个孩子（当前 currentChildId 无效时）', async () => {
      getChildrenMock.mockResolvedValueOnce(mockChildren);
      useChildStore.setState({ currentChildId: 99 });

      await useChildStore.getState().fetchChildren();

      expect(useChildStore.getState().currentChildId).toBe(1);
    });

    it('fetchChildren 后保留当前选中（当前 currentChildId 有效时）', async () => {
      getChildrenMock.mockResolvedValueOnce(mockChildren);
      useChildStore.setState({ currentChildId: 2 });

      await useChildStore.getState().fetchChildren();

      expect(useChildStore.getState().currentChildId).toBe(2);
    });
  });

  describe('addChild', () => {
    it('addChild 追加到 children 列表末尾', async () => {
      const newChild = { id: 4, family_id: 1, familyId: 1, role: 'child' as const, nickname: 'Liang', balance: 0 };
      addChildMock.mockResolvedValueOnce(newChild);
      useChildStore.setState({ children: [mockChildren[0]] });

      await useChildStore.getState().addChild({ nickname: 'Liang' });

      expect(useChildStore.getState().children).toHaveLength(2);
      expect(useChildStore.getState().children[1].nickname).toBe('Liang');
    });

    it('addChild 后 currentChildId 为 null 时，自动切换到新孩子', async () => {
      const newChild = { id: 5, family_id: 1, familyId: 1, role: 'child' as const, nickname: 'Xing', balance: 0 };
      addChildMock.mockResolvedValueOnce(newChild);
      useChildStore.setState({ children: [], currentChildId: null });

      await useChildStore.getState().addChild({ nickname: 'Xing' });

      expect(useChildStore.getState().currentChildId).toBe(5);
    });
  });

  describe('updateChild', () => {
    it('updateChild 仅更新对应 id 的孩子记录', async () => {
      updateChildMock.mockResolvedValueOnce(undefined);
      useChildStore.setState({ children: [...mockChildren] });

      await useChildStore.getState().updateChild(2, { nickname: 'Hong-renamed' });

      expect(useChildStore.getState().children[1].nickname).toBe('Hong-renamed');
      expect(useChildStore.getState().children[0].nickname).toBe('Ming');
    });
  });

  describe('removeChild', () => {
    it('removeChild 从列表中移除对应 id', async () => {
      deleteChildMock.mockResolvedValueOnce(undefined);
      useChildStore.setState({ children: [...mockChildren] });

      await useChildStore.getState().removeChild(2);

      expect(useChildStore.getState().children).toHaveLength(2);
      expect(useChildStore.getState().children.find((c) => c.id === 2)).toBeUndefined();
    });

    it('removeChild 移除当前选中孩子时，切换到剩余第一个', async () => {
      deleteChildMock.mockResolvedValueOnce(undefined);
      useChildStore.setState({ children: [...mockChildren], currentChildId: 2 });

      await useChildStore.getState().removeChild(2);

      expect(useChildStore.getState().currentChildId).toBe(1);
    });

    it('removeChild 移除最后孩子后 currentChildId 置 null', async () => {
      const loneList = [{ id: 10, family_id: 1, familyId: 1, role: 'child' as const, nickname: 'Only', balance: 0 }];
      deleteChildMock.mockResolvedValueOnce(undefined);
      useChildStore.setState({ children: [...loneList], currentChildId: 10 });

      await useChildStore.getState().removeChild(10);

      expect(useChildStore.getState().currentChildId).toBeNull();
    });
  });

  describe('setCurrentChildId', () => {
    it('setCurrentChildId 写入 localStorage', () => {
      useChildStore.getState().setCurrentChildId(5);
      expect(localStorage.getItem('currentChildId')).toBe('5');
    });

    it('setCurrentChildId(null) 清除 localStorage', () => {
      localStorage.setItem('currentChildId', '3');
      useChildStore.getState().setCurrentChildId(null);
      expect(localStorage.getItem('currentChildId')).toBeNull();
    });
  });

  describe('getCurrentChild', () => {
    it('返回 currentChildId 对应的孩子', () => {
      useChildStore.setState({ children: mockChildren, currentChildId: 2 });
      expect(useChildStore.getState().getCurrentChild()?.nickname).toBe('Hong');
    });

    it('currentChildId 无效时返回列表第一个孩子', () => {
      useChildStore.setState({ children: mockChildren, currentChildId: 99 });
      expect(useChildStore.getState().getCurrentChild()?.nickname).toBe('Ming');
    });

    it('children 为空时返回 null', () => {
      useChildStore.setState({ children: [], currentChildId: null });
      expect(useChildStore.getState().getCurrentChild()).toBeNull();
    });
  });

  describe('updateBalance', () => {
    it('仅更新指定 childId 的 balance，不影响其他孩子', () => {
      useChildStore.setState({ children: [...mockChildren] });

      useChildStore.getState().updateBalance(2, 999);

      expect(useChildStore.getState().children[1].balance).toBe(999);
      expect(useChildStore.getState().children[0].balance).toBe(100);
      expect(useChildStore.getState().children[2].balance).toBe(200);
    });
  });
});
