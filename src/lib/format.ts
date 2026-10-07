/** 時間碼（MM:SS 或 HH:MM:SS）轉秒數；空字串或格式不對回傳 0 */
export function timeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return 0;
}

/** 60 分以內只寫分，超過就進位成「N 小時 N 分」。0 或缺值回傳空字串。 */
export function formatDuration(minutes: number | undefined): string {
  if (!minutes || minutes < 1) return '';
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小時` : `${hours} 小時 ${rest} 分`;
}
