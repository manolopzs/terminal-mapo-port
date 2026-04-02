export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

async function sendViaWebhook(webhookUrl: string, message: string, severity: AlertSeverity): Promise<void> {
  const emoji = severity === "CRITICAL" ? ":rotating_light:" : severity === "WARNING" ? ":warning:" : ":information_source:";
  const text = `${emoji} *[${severity}]* ${message}`;
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Webhook responded with status ${res.status}`);
  }
}

async function sendViaResend(apiKey: string, message: string, severity: AlertSeverity): Promise<void> {
  const toEmail = process.env.ALERT_EMAIL || "mapo@terminal.io";
  const subject = `[MAPO Alert - ${severity}] ${message.slice(0, 80)}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MAPO Terminal <alerts@mapo-terminal.io>",
      to: [toEmail],
      subject,
      text: `[${severity}]\n\n${message}\n\nTimestamp: ${new Date().toISOString()}`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

export async function sendAlert(message: string, severity: AlertSeverity): Promise<void> {
  try {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (webhookUrl) {
      await sendViaWebhook(webhookUrl, message, severity);
      return;
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await sendViaResend(resendKey, message, severity);
      return;
    }

    // Fallback: console output
    const prefix = severity === "CRITICAL" ? "[CRITICAL]" : severity === "WARNING" ? "[WARNING]" : "[INFO]";
    console.log(`${prefix} MAPO Alert: ${message}`);
  } catch (err) {
    // Never throw - alerts must not crash the pipeline
    console.error("[sendAlert] Failed to deliver alert:", err instanceof Error ? err.message : String(err));
    console.log(`[FALLBACK][${severity}] ${message}`);
  }
}
