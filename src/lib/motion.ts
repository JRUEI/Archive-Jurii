/**
 * CSS 的 @media (prefers-reduced-motion) 管不到 JS 發動的捲動：
 * scrollIntoView / scrollTo 的 behavior:'smooth' 是參數，不是 CSS。
 * 這裡集中判斷，需要捲動的地方一律問這支。
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 減少動態時直接跳位，不要用滑的 */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
