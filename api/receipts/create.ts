import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, getCallerFromRequest } from '../_lib/auth';
import { sendEmail } from '../_lib/email';
import { logActivity } from '../_lib/activity';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const caller = await getCallerFromRequest(req);
    if (!caller || caller.profile.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can generate receipts' });
      return;
    }

    const { financialTransactionId, payerName, payerEmail, notes } = (req.body ?? {}) as {
      financialTransactionId?: string;
      payerName?: string;
      payerEmail?: string;
      notes?: string;
    };

    if (!financialTransactionId) {
      res.status(400).json({ error: 'financialTransactionId is required' });
      return;
    }
    if (!payerName?.trim()) {
      res.status(400).json({ error: 'payerName is required' });
      return;
    }
    const trimmedEmail = payerEmail?.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      res.status(400).json({ error: 'payerEmail is not a valid email address' });
      return;
    }

    const admin = getAdminClient();

    const { data: txn, error: txnError } = await admin
      .from('financial_transactions')
      .select('id, batch_id, category, transaction_type, amount, description, transaction_date')
      .eq('id', financialTransactionId)
      .maybeSingle();

    if (txnError || !txn) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    if (txn.transaction_type !== 'income') {
      res.status(400).json({ error: 'Receipts can only be issued for income transactions' });
      return;
    }

    const { data: settings } = await admin
      .from('app_settings')
      .select('currency_code')
      .eq('id', 'org')
      .maybeSingle();

    const { data: receipt, error: insertError } = await admin
      .from('receipts')
      .insert({
        financial_transaction_id: txn.id,
        batch_id: txn.batch_id,
        payer_name: payerName.trim(),
        payer_email: trimmedEmail || null,
        amount: txn.amount,
        currency_code: settings?.currency_code ?? 'USD',
        category: txn.category,
        description: txn.description,
        notes: notes?.trim() || null,
        issued_by: caller.id,
      })
      .select('*')
      .single();

    if (insertError || !receipt) {
      res.status(500).json({ error: insertError?.message ?? 'Could not create receipt' });
      return;
    }

    let emailSent = false;
    let emailWarning: string | undefined;

    if (receipt.payer_email) {
      const amountStr = `${receipt.currency_code} ${Number(receipt.amount).toFixed(2)}`;
      const mail = await sendEmail({
        to: receipt.payer_email,
        subject: `Receipt ${receipt.receipt_number} — Street Children Ministry`,
        text:
          `Dear ${receipt.payer_name},\n\n` +
          `This confirms receipt of ${amountStr} (${receipt.category ?? 'Payment'}) ` +
          `dated ${txn.transaction_date}.\n\n` +
          `Receipt number: ${receipt.receipt_number}\n` +
          (receipt.notes ? `Notes: ${receipt.notes}\n\n` : '\n') +
          `— Street Children Ministry`,
        html:
          `<p>Dear ${receipt.payer_name},</p>` +
          `<p>This confirms receipt of <strong>${amountStr}</strong> (${receipt.category ?? 'Payment'}) ` +
          `dated ${txn.transaction_date}.</p>` +
          `<p>Receipt number: <strong>${receipt.receipt_number}</strong></p>` +
          (receipt.notes ? `<p>Notes: ${receipt.notes}</p>` : '') +
          `<p>— Street Children Ministry</p>`,
      });
      emailSent = mail.sent;
      emailWarning = mail.warning;
      if (emailSent) {
        await admin
          .from('receipts')
          .update({ emailed_at: new Date().toISOString() })
          .eq('id', receipt.id);
        receipt.emailed_at = new Date().toISOString();
      }
    }

    await logActivity(admin, {
      actorId: caller.id,
      actorEmail: caller.profile.email,
      actorName: caller.profile.full_name,
      action: 'receipt_create',
      entityType: 'receipt',
      entityId: receipt.id,
      summary: `Issued receipt ${receipt.receipt_number} for ${receipt.payer_name} (${receipt.currency_code} ${Number(receipt.amount).toFixed(2)})`,
      metadata: { emailSent, financialTransactionId: txn.id },
    });

    res.status(200).json({ ok: true, receipt, emailSent, emailWarning });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Could not create receipt',
    });
  }
}
