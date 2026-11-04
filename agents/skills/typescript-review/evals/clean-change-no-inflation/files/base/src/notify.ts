export interface Notification {
  readonly userId: string;
  readonly message: string;
}

export function renderPlain(n: Notification): string {
  return `${n.userId}: ${n.message}`;
}
