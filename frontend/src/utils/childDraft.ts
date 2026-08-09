/** 添加孩子过程中的本地草稿：完整流程结束前不落库 */

export const CHILD_DRAFT_KEY = 'growpocket_child_draft';

export type ChildDraft = {
  nickname: string;
  birthday?: string;
  grade?: number;
  grade_overridden?: boolean;
  age?: number;
  hobbies?: string;
  level: string;
  mode: 'register' | 'add_child' | string;
};

export function saveChildDraft(draft: ChildDraft): void {
  sessionStorage.setItem(CHILD_DRAFT_KEY, JSON.stringify(draft));
}

export function loadChildDraft(): ChildDraft | null {
  try {
    const raw = sessionStorage.getItem(CHILD_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChildDraft;
    if (!parsed?.nickname) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearChildDraft(): void {
  sessionStorage.removeItem(CHILD_DRAFT_KEY);
}
