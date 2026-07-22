import { getAccessToken } from './session';
import { supabase } from './supabase';
import type { TraineeDocumentType } from '../types';

const BUCKET = 'trainee-documents';

export interface TraineeDocumentRow {
  id: string;
  trainee_id: string;
  document_type: TraineeDocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = getAccessToken();
  return {
    Authorization: `Bearer ${token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function listTraineeDocuments(traineeId: string): Promise<TraineeDocumentRow[]> {
  const res = await fetch(
    `/api/trainees/documents?action=list&traineeId=${encodeURIComponent(traineeId)}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error(await readError(res, 'Could not load documents.'));
  const data = (await res.json()) as { documents?: TraineeDocumentRow[] };
  return data.documents ?? [];
}

export async function getTraineeDocumentSignedUrl(documentId: string): Promise<string> {
  const res = await fetch(
    `/api/trainees/documents?action=signed-url&documentId=${encodeURIComponent(documentId)}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error(await readError(res, 'Could not open document.'));
  const data = (await res.json()) as { signedUrl?: string };
  if (!data.signedUrl) throw new Error('Could not open document.');
  return data.signedUrl;
}

export async function getTraineePhotoSignedUrl(traineeId: string): Promise<string | null> {
  const res = await fetch(
    `/api/trainees/documents?action=photo-url&traineeId=${encodeURIComponent(traineeId)}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error(await readError(res, 'Could not load photo.'));
  const data = (await res.json()) as { signedUrl?: string | null };
  return data.signedUrl ?? null;
}

export async function uploadTraineeDocument(input: {
  traineeId: string;
  documentType: TraineeDocumentType;
  file: File;
}): Promise<TraineeDocumentRow> {
  const { traineeId, documentType, file } = input;
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File exceeds the 10 MB limit.');
  }

  const prepareRes = await fetch('/api/trainees/documents', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      action: 'prepare',
      traineeId,
      documentType,
      fileName: file.name,
      fileSize: file.size,
    }),
  });
  if (!prepareRes.ok) {
    throw new Error(await readError(prepareRes, 'Could not start upload.'));
  }
  const prepared = (await prepareRes.json()) as {
    storagePath: string;
    token: string;
  };

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(prepared.storagePath, prepared.token, file, {
      contentType: file.type || 'application/octet-stream',
    });
  if (uploadError) throw uploadError;

  const completeRes = await fetch('/api/trainees/documents', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      action: 'complete',
      traineeId,
      documentType,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      storagePath: prepared.storagePath,
      fileSize: file.size,
    }),
  });
  if (!completeRes.ok) {
    throw new Error(await readError(completeRes, 'Upload saved to storage but failed to record.'));
  }
  const completed = (await completeRes.json()) as { document: TraineeDocumentRow };
  return completed.document;
}

export async function deleteTraineeDocument(documentId: string): Promise<void> {
  const res = await fetch('/api/trainees/documents', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'delete', documentId }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Could not delete document.'));
}
