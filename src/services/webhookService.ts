export async function sendScanWebhook(payload: any) {

  const response = await fetch(
    import.meta.env.VITE_WEBHOOK_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();
  return result;
}
