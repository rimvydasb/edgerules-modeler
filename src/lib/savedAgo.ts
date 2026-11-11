/** "saved 2 h ago" style text for an ISO time. */
export function savedAgo(savedAt: string, now: number = Date.now()): string {
    const seconds = Math.max(0, Math.round((now - Date.parse(savedAt)) / 1000));
    if (Number.isNaN(seconds)) return 'saved';
    if (seconds < 60) return 'saved just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `saved ${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `saved ${hours} h ago`;
    return `saved ${Math.floor(hours / 24)} d ago`;
}
