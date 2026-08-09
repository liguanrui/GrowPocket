/**
 * 年级展示文案。
 * grade: 0=未上小学（含婴幼儿/幼儿园），1-6=小学年级
 * age: 可选周岁；<3 岁显示「未入学」，避免 1~2 岁误标为幼儿园
 */
export function gradeLabel(grade: number, age?: number | null): string {
  if (grade <= 0) {
    if (typeof age === 'number' && age < 3) return '未入学';
    if (typeof age === 'number') return '幼儿园';
    return '幼儿园/未入学';
  }
  const names = ['一', '二', '三', '四', '五', '六'];
  return `${names[grade - 1] || grade}年级`;
}
