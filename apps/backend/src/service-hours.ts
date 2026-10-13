const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function computeServiceStatus(date = new Date()): { open: true } | { open: false; msUntilOpen: number } {
  const [hour, minute, second] = clock.format(date).split(':').map(Number);
  const minutes = hour * 60 + minute;
  if (minutes >= 390 || minutes < 60) return { open: true };
  return { open: false, msUntilOpen: (390 * 60 - minutes * 60 - second) * 1000 };
}
