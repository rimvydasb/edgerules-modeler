/** The short mark of a project name: the first letters of its first two words ("Client outreach" is "CO"). */
export function projectInitials(name: string): string {
    const words = name
        .replace(/\(.*\)/, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const letters = words.map((word) => Array.from(word)[0]).join('');
    return Array.from(letters).slice(0, 2).join('').toUpperCase() || '?';
}
