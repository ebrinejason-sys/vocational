import { useCallback, useEffect, useState } from 'react';
import { FileUp, FileText, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canEdit } from '../lib/permissions';
import { friendlyError, cn } from '../lib/utils';
import { confirmAdminDelete, promptDeleteReason, submitDeleteRequest } from '../lib/deleteRequests';
import {
  deleteTraineeDocument,
  getTraineeDocumentSignedUrl,
  listTraineeDocuments,
  uploadTraineeDocument,
  type TraineeDocumentRow,
} from '../lib/traineeDocuments';
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

interface TraineeDocumentsProps {
  traineeId: string;
  traineeName: string;
  onDocumentsChanged?: () => void;
}

function rowToDoc(row: TraineeDocumentRow): TraineeDocument {
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

export default function TraineeDocuments({ traineeId, traineeName, onDocumentsChanged }: TraineeDocumentsProps) {
  const { profile } = useAuth();
  const mayEdit = profile ? canEdit(profile.role, 'trainees') : false;
  const [documents, setDocuments] = useState<TraineeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<TraineeDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listTraineeDocuments(traineeId);
      setDocuments(rows.map(rowToDoc));
      setError(null);
    } catch (err) {
      setError(friendlyError(err, 'Could not load documents.'));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  async function handleUpload(type: TraineeDocumentType, file: File) {
    if (!mayEdit) return;
    setUploading(type);
    setError(null);
    try {
      await uploadTraineeDocument({ traineeId, documentType: type, file });
      await loadDocuments();
      onDocumentsChanged?.();
    } catch (err) {
      setError(friendlyError(err, 'Upload failed.'));
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(doc: TraineeDocument) {
    if (!mayEdit) return;
    const label = `${TRAINEE_DOCUMENT_LABELS[doc.documentType]} — ${traineeName}`;
    if (profile?.role !== 'admin' && profile?.role !== 'director' && profile?.role !== 'finance_officer') {
      const reason = promptDeleteReason(label);
      if (!reason) return;
      setError(null);
      try {
        await submitDeleteRequest({
          entityType: 'trainee_document',
          entityId: doc.id,
          entityLabel: label,
          reason,
        });
        window.alert('Delete request sent to admin for approval.');
      } catch (err) {
        setError(friendlyError(err, 'Could not submit delete request.'));
      }
      return;
    }
    if (!confirmAdminDelete(label)) return;
    setError(null);
    try {
      await deleteTraineeDocument(doc.id);
      await loadDocuments();
      onDocumentsChanged?.();
    } catch (err) {
      setError(friendlyError(err, 'Could not delete document.'));
    }
  }

  async function openDocument(doc: TraineeDocument) {
    try {
      const signedUrl = await getTraineeDocumentSignedUrl(doc.id);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(friendlyError(err, 'Could not open document.'));
    }
  }

  const docByType = Object.fromEntries(documents.map((d) => [d.documentType, d])) as Partial<
    Record<TraineeDocumentType, TraineeDocument>
  >;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
        <FileText className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-bold text-gray-800">Trainee Documents</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Upload National ID, recommendation letter, birth certificate, signed rules, and a profile photo for{' '}
        <span className="font-semibold text-gray-700">{traineeName}</span>.
        Each document type is stored once per trainee (max 10 MB).
      </p>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
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
                  doc ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50',
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
                        onClick={() => void openDocument(doc)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50 rounded-lg border border-transparent"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View
                      </button>
                      {mayEdit && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(doc)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-transparent"
                          aria-label={`Delete ${TRAINEE_DOCUMENT_LABELS[type]}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                  {mayEdit && (
                    <label className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer border',
                      busy
                        ? 'bg-gray-200 text-gray-500 border-gray-200'
                        : 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700',
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
