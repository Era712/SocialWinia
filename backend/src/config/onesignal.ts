export async function sendOneSignalNotification(title: string, message: string) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.warn('OneSignal is not configured. Skipping notification.');
    return;
  }

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: appId,
      included_segments: ['Subscribed Users'],
      headings: { en: title, de: title },
      contents: { en: message, de: message },
    }),
  });

  if (!response.ok) {
    throw new Error(`OneSignal error: ${response.status}`);
  }
}
