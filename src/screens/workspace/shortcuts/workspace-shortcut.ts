type ShortcutEvent = { code?: string; key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean };

export function workspaceShortcut(event: ShortcutEvent): "close" | "previous" | "next" | null {
  if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
  const code = event.code;
  if (code === "KeyW" || (!code && event.key.toLowerCase() === "w")) return "close";
  if (code === "BracketLeft" || (!code && event.key === "[")) return "previous";
  if (code === "BracketRight" || (!code && event.key === "]")) return "next";
  return null;
}

export function adjacentTab<T extends { tabId: string }>(tabs: T[], activeTabId: string, direction: "previous" | "next"): T | undefined {
  const index = tabs.findIndex(tab => tab.tabId === activeTabId);
  if (index < 0) return undefined;
  return tabs[index + (direction === "next" ? 1 : -1)];
}
