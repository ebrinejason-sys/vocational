import { useCallback, useEffect, useState } from 'react';
import { FileUp, FileText, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import { friendlyError, cn } from '../lib/utils';
import {
  TRAINEE_DOCUMENT_LABELS,
  type TraineeDocument,
  type TraineeDocumentType,
} from '../types';

const DOCUMENT_TYPES: TraineeDocumentType[] = [
  'national_id',
  'recommendation_letter',
  'birth_certificate',
  'signed_rules',
  'photo',
];

const BUCKET = 'trainee-documents';

interface TraineeDocumentsProps {
  traineeId: string;
  traineeName: string;
}

interface DocRow {
  id: string;
  trainee_id: string;
  document_type: TraineeDocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
}

function rowToDoc(row: DocRow): TraineeDocument {
  return {
    id: row.id,
    traineeId: row.trainee_id,
    documentType: row.document_type,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at,
  };
}

export default function TraineeDocuments({ traineeId, traineeName }: TraineeDocumentsProps) {
  const { profile } = useAuth();
  const mayEdit = profile ? canEdit(profile.role, 'trainees') : false;
  const [documents, setDocuments] = useState<TraineeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<TraineeDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('trainee_documents')
      .select('*')
      .eq('trainee_id', traineeId)
      .order('uploaded_at', { ascending: false });
    if (loadError) {
      setError(friendlyError(loadError, 'Could not load documents.'));
      setDocuments([]);
    } else {
      setDocuments((data as DocRow[]).map(rowToDoc));
      setError(null);
    }
    setLoading(false);
  }, [traineeId]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  async function handleUpload(type: TraineeDocumentType, file: File) {
    if (!mayEdit) return;
    setUploading(type);
    setError(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const storagePath = `${traineeId}/${type}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: auth } = await supabase.auth.getUser();
      const existing = documents.find((d) => d.documentType === type);
      if (existing) {
        await supabase.storage.from(BUCKET).remove([existing.storagePath]).catch(() => {});
        const { error: updateError } = await supabase
          .from('trainee_documents')
          .update({
            file_name: file.name,
            storage_path: storagePath,
            mime_type: file.type,
            file_size: file.size,
            uploaded_by: auth.user?.id ?? null,
            uploaded_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('trainee_documents').insert({
          trainee_id: traineeId,
          document_type: type,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          file_size: file.size,
          uploaded_by: auth.user?.id ?? null,
        });
        if (insertError) throw insertError;
      }
      await loadDocuments();
    } catch (err) {
      setError(friendlyError(err, 'Upload failed. Ensure the trainee-documents bucket exists in Supabase.'));
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(doc: TraineeDocument) {
    if (!mayEdit) return;
    if (!window.confirm(`Remove ${TRAINEE_DOCUMENT_LABELS[doc.documentType]} for ${traineeName}?`)) return;
    setError(null);
    try {
      await supabase.storage.from(BUCKET).remove([doc.storagePath]).catch(() => {});
      const { error: delError } = await supabase.from('trainee_documents').delete().eq('id', doc.id);
      if (delError) throw delError;
      await loadDocuments();
    } catch (err) {
      setError(friendlyError(err, 'Could not delete document.'));
    }
  }

  async function openDocument(doc: TraineeDocument) {
    const { data, error: urlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storagePath, 3600);
    if (urlError || !data?.signedUrl) {
      setError(friendlyError(urlError, 'Could not open document.'));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  const docByType = Object.fromEntries(documents.map((d) => [d.documentType, d])) as Partial<
    Record<TraineeDocumentType, TraineeDocument>
  >;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
        <FileText className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-bold text-gray-800">Trainee Documents</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Upload and identify documents for <span className="font-semibold">{traineeName}</span>.
        Each document type is stored once per trainee.
      </p>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading documents…
        </div>
      ) : (
        <ul className="space-y-3">
          {DOCUMENT_TYPES.map((type) => {
            const doc = docByType[type];
            const busy = uploading === type;
            return (
              <li
                key={type}
                className={cn(
                  'flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border',
                  doc ? 'border-green-100 bg-green-50/50' : 'border-gray-100 bg-gray-50/50',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{TRAINEE_DOCUMENT_LABELS[type]}</p>
                  {doc ? (
                    <p className="text-xs text-gray-500 truncate">{doc.fileName}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Not uploaded</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc && (
                    <>
                      <button
                        type="button"
                        onClick={() => openDocument(doc)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50 rounded-lg"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View
                      </button>
                      {mayEdit && (
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          aria-label={`Delete ${TRAINEE_DOCUMENT_LABELS[type]}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                  {mayEdit && (
                    <label className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer',
                      busy ? 'bg-gray-200 text-gray-500' : 'bg-primary-600 text-white hover:bg-primary-700',
                    )}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                      {doc ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        className="hidden"
                        accept={type === 'photo' ? 'image/*' : '.pdf,.jpg,.jpeg,.png,.doc,.docx'}
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleUpload(type, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
