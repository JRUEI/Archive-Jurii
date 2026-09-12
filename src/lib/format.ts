/** 60 分以內只寫分，超過就進位成「N 小時 N 分」。0 或缺值回傳空字串。 */
export function formatDuration(minutes: number | undefined): string {
  if (!minutes || minutes < 1) return '';
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小時` : `${hours} 小時 ${rest} 分`;
}
