const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? process.env.FINANCIAL_NOTIFY_FROM ?? 'VTMS <onboarding@resend.dev>';

export interface SendEmailResult {
  sent: boolean;
  warning?: string;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    return { sent: false, warning: 'RESEND_API_KEY not configured' };
  }

  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  if (!to.length) {
    return { sent: false, warning: 'No recipients' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, warning: `Email send failed: ${errText.slice(0, 200)}` };
    }

    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      warning: err instanceof Error ? err.message : 'Email send failed',
    };
  }
}
