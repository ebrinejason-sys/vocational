import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminClient, getCallerFromRequest } from '../auth';
import { logActivity } from '../activity';

const BUCKET = 'trainee-documents';
const MAX_BYTES = 10 * 1024 * 1024;

const DOC_TYPES = new Set([
  'national_id',
  'recommendation_letter',
  'birth_certificate',
  'signed_rules',
  'photo',
]);

const UPLOAD_ROLES = new Set([
  'admin',
  'director',
  'project_coordinator',
  'trainer',
  'case_worker',
  'finance_officer',
]);

const VIEW_ROLES = new Set([...UPLOAD_ROLES, 'logistics_officer']);

const HARD_DELETE_ROLES = new Set(['admin', 'director', 'finance_officer']);

function safeExt(fileName: string): string {
  const raw = fileName.includes('.') ? fileName.split('.').pop()! : 'bin';
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  return cleaned || 'bin';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const caller = await getCallerFromRequest(req);
    if (!caller) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const admin = getAdminClient();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action =
      (typeof req.query.action === 'string' && req.query.action) ||
      (typeof body.action === 'string' && body.action) ||
      null;

    // ── List ────────────────────────────────────────────────────────
    if (req.method === 'GET' && (!action || action === 'list')) {
      if (!VIEW_ROLES.has(caller.profile.role)) {
        res.status(403).json({ error: 'You cannot view trainee documents' });
        return;
      }
      const traineeId = typeof req.query.traineeId === 'string' ? req.query.traineeId : null;
      if (!traineeId) {
        res.status(400).json({ error: 'traineeId is required' });
        return;
      }
      const { data, error } = await admin
        .from('trainee_documents')
        .select('*')
        .eq('trainee_id', traineeId)
        .order('uploaded_at', { ascending: false });
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.status(200).json({ documents: data ?? [] });
      return;
    }

    // ── Signed download URL ─────────────────────────────────────────
    if (req.method === 'GET' && action === 'signed-url') {
      if (!VIEW_ROLES.has(caller.profile.role)) {
        res.status(403).json({ error: 'You cannot view trainee documents' });
        return;
      }
      const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : null;
      if (!documentId) {
        res.status(400).json({ error: 'documentId is required' });
        return;
      }
      const { data: doc, error: docError } = await admin
        .from('trainee_documents')
        .select('id, storage_path')
        .eq('id', documentId)
        .maybeSingle();
      if (docError || !doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const { data: signed, error: signError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 3600);
      if (signError || !signed?.signedUrl) {
        res.status(500).json({ error: signError?.message ?? 'Could not create signed URL' });
        return;
      }
      res.status(200).json({ signedUrl: signed.signedUrl });
      return;
    }

    // ── Photo URL by trainee ────────────────────────────────────────
    if (req.method === 'GET' && action === 'photo-url') {
      if (!VIEW_ROLES.has(caller.profile.role)) {
        res.status(403).json({ error: 'You cannot view trainee documents' });
        return;
      }
      const traineeId = typeof req.query.traineeId === 'string' ? req.query.traineeId : null;
      if (!traineeId) {
        res.status(400).json({ error: 'traineeId is required' });
        return;
      }
      const { data: doc } = await admin
        .from('trainee_documents')
        .select('storage_path')
        .eq('trainee_id', traineeId)
        .eq('document_type', 'photo')
        .maybeSingle();
      if (!doc?.storage_path) {
        res.status(200).json({ signedUrl: null });
        return;
      }
      const { data: signed, error: signError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 3600);
      if (signError || !signed?.signedUrl) {
        res.status(500).json({ error: signError?.message ?? 'Could not create signed URL' });
        return;
      }
      res.status(200).json({ signedUrl: signed.signedUrl });
      return;
    }

    // ── Prepare signed upload ───────────────────────────────────────
    if (req.method === 'POST' && action === 'prepare') {
      if (!UPLOAD_ROLES.has(caller.profile.role)) {
        res.status(403).json({ error: 'You cannot upload trainee documents' });
        return;
      }

      const traineeId = typeof body.traineeId === 'string' ? body.traineeId.trim() : '';
      const documentType = typeof body.documentType === 'string' ? body.documentType.trim() : '';
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
      const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number(body.fileSize);

      if (!traineeId || !documentType || !fileName) {
        res.status(400).json({ error: 'traineeId, documentType, and fileName are required' });
        return;
      }
      if (!DOC_TYPES.has(documentType)) {
        res.status(400).json({ error: 'Invalid documentType' });
        return;
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0) {
        res.status(400).json({ error: 'fileSize is required' });
        return;
      }
      if (fileSize > MAX_BYTES) {
        res.status(400).json({ error: 'File exceeds the 10 MB limit' });
        return;
      }

      const { data: trainee, error: traineeError } = await admin
        .from('trainees')
        .select('id')
        .eq('id', traineeId)
        .maybeSingle();
      if (traineeError || !trainee) {
        res.status(404).json({ error: 'Trainee not found' });
        return;
      }

      const storagePath = `${traineeId}/${documentType}/${Date.now()}.${safeExt(fileName)}`;
      const { data: signed, error: signError } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);

      if (signError || !signed?.token || !signed.path) {
        res.status(500).json({
          error: signError?.message ?? 'Could not create upload URL. Ensure the trainee-documents bucket exists.',
        });
        return;
      }

      res.status(200).json({
        ok: true,
        storagePath: signed.path,
        token: signed.token,
        signedUrl: signed.signedUrl ?? null,
      });
      return;
    }

    // ── Complete upload (write DB row after client PUT) ─────────────
    if (req.method === 'POST' && action === 'complete') {
      if (!UPLOAD_ROLES.has(caller.profile.role)) {
        res.status(403).json({ error: 'You cannot upload trainee documents' });
        return;
      }

      const traineeId = typeof body.traineeId === 'string' ? body.traineeId.trim() : '';
      const documentType = typeof body.documentType === 'string' ? body.documentType.trim() : '';
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
      const mimeType =
        typeof body.mimeType === 'string' && body.mimeType.trim()
          ? body.mimeType.trim()
          : 'application/octet-stream';
      const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : '';
      const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number(body.fileSize);

      if (!traineeId || !documentType || !fileName || !storagePath) {
        res.status(400).json({
          error: 'traineeId, documentType, fileName, and storagePath are required',
        });
        return;
      }
      if (!DOC_TYPES.has(documentType)) {
        res.status(400).json({ error: 'Invalid documentType' });
        return;
      }
      if (!storagePath.startsWith(`${traineeId}/${documentType}/`)) {
        res.status(400).json({ error: 'storagePath does not match trainee/document type' });
        return;
      }

      const { data: existing } = await admin
        .from('trainee_documents')
        .select('id, storage_path')
        .eq('trainee_id', traineeId)
        .eq('document_type', documentType)
        .maybeSingle();

      let document;
      if (existing) {
        const oldPath = existing.storage_path;
        const { data: updated, error: updateError } = await admin
          .from('trainee_documents')
          .update({
            file_name: fileName,
            storage_path: storagePath,
            mime_type: mimeType,
            file_size: Number.isFinite(fileSize) ? fileSize : null,
            uploaded_by: caller.id,
            uploaded_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (updateError || !updated) {
          res.status(500).json({ error: updateError?.message ?? 'Could not update document row' });
          return;
        }
        document = updated;
        if (oldPath && oldPath !== storagePath) {
          await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {});
        }
      } else {
        const { data: inserted, error: insertError } = await admin
          .from('trainee_documents')
          .insert({
            trainee_id: traineeId,
            document_type: documentType,
            file_name: fileName,
            storage_path: storagePath,
            mime_type: mimeType,
            file_size: Number.isFinite(fileSize) ? fileSize : null,
            uploaded_by: caller.id,
          })
          .select('*')
          .single();
        if (insertError || !inserted) {
          res.status(500).json({ error: insertError?.message ?? 'Could not save document row' });
          return;
        }
        document = inserted;
      }

      await logActivity(admin, {
        actorId: caller.id,
        actorEmail: caller.profile.email,
        actorName: caller.profile.full_name,
        action: existing ? 'trainee_document_replace' : 'trainee_document_upload',
        entityType: 'trainee_document',
        entityId: document.id,
        summary: `${existing ? 'Replaced' : 'Uploaded'} ${documentType} for trainee ${traineeId}`,
        metadata: { traineeId, documentType, fileName, fileSize },
      });

      res.status(200).json({ ok: true, document });
      return;
    }

    // ── Hard delete ─────────────────────────────────────────────────
    if (req.method === 'DELETE' || (req.method === 'POST' && action === 'delete')) {
      if (!HARD_DELETE_ROLES.has(caller.profile.role)) {
        res.status(403).json({
          error:
            'Only admin, director, or finance can permanently delete documents. Others should submit a delete request.',
        });
        return;
      }

      const documentId =
        (typeof req.query.documentId === 'string' && req.query.documentId) ||
        (typeof body.documentId === 'string' && body.documentId) ||
        null;

      if (!documentId) {
        res.status(400).json({ error: 'documentId is required' });
        return;
      }

      const { data: doc, error: docError } = await admin
        .from('trainee_documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();
      if (docError || !doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      await admin.storage.from(BUCKET).remove([doc.storage_path]).catch(() => {});
      const { error: delError } = await admin.from('trainee_documents').delete().eq('id', documentId);
      if (delError) {
        res.status(500).json({ error: delError.message });
        return;
      }

      await logActivity(admin, {
        actorId: caller.id,
        actorEmail: caller.profile.email,
        actorName: caller.profile.full_name,
        action: 'trainee_document_delete',
        entityType: 'trainee_document',
        entityId: documentId,
        summary: `Deleted ${doc.document_type} for trainee ${doc.trainee_id}`,
        metadata: {
          traineeId: doc.trainee_id,
          documentType: doc.document_type,
          fileName: doc.file_name,
        },
      });

      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Trainee documents request failed',
    });
  }
}
