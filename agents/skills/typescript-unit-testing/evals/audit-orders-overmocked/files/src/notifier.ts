/** Sends the order confirmation email through the email provider's HTTP API. */
export async function notifyOrderPlaced(email: string, orderId: string): Promise<void> {
  const res = await fetch('https://api.mail-provider.example/v3/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to: email, template: 'order-placed', data: { orderId } }),
  });
  if (!res.ok) throw new Error(`email provider responded ${res.status}`);
}
