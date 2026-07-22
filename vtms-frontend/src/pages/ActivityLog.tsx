import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { friendlyError, cn } from '../lib/utils';
import { reviewDeleteRequest } from '../lib/deleteRequests';

interface ActivityRow {
  id: string;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  created_at: string;
}

interface DeleteRequestRow {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  reason: string;
  status: string;
  created_at: string;
  requested_by: string | null;
  requester?: { full_name: string; email: string } | null;
}

export default function ActivityLogPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from('activity_log')
      .select('id, actor_email, actor_name, action, entity_type, entity_id, summary, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (loadError) {
      setError(friendlyError(loadError, 'Could not load activity log.'));
      setRows([]);
    } else {
      setRows((data ?? []) as ActivityRow[]);
    }

    if (profile?.role === 'admin' || profile?.role === 'director') {
      const { data: reqs, error: reqError } = await supabase
        .from('delete_requests')
        .select('id, entity_type, entity_id, entity_label, reason, status, created_at, requested_by, profiles:requested_by(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!reqError && reqs) {
        setDeleteRequests(
          reqs.map((r) => {
            const requesterRaw = r.profiles as
              | { full_name: string; email: string }
              | { full_name: string; email: string }[]
              | null;
            const requester = Array.isArray(requesterRaw) ? requesterRaw[0] ?? null : requesterRaw;
            return {
              id: r.id as string,
              entity_type: r.entity_type as string,
              entity_id: r.entity_id as string,
              entity_label: r.entity_label as string,
              reason: r.reason as string,
              status: r.status as string,
              created_at: r.created_at as string,
              requested_by: r.requested_by as string | null,
              requester,
            };
          }),
        );
      } else {
        setDeleteRequests([]);
      }
    }

    setLoading(false);
  }, [profile?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReview(requestId: string, decision: 'approve' | 'reject') {
    if (!isAdmin) return;
    const note =
      decision === 'reject'
        ? window.prompt('Optional note to the requester (why rejected):') ?? undefined
        : undefined;
    if (decision === 'reject' && note === null) return;
    setReviewBusy(requestId);
    setBanner(null);
    try {
      await reviewDeleteRequest({ requestId, decision, reviewNote: note || undefined });
      setBanner(decision === 'approve' ? 'Delete approved and executed.' : 'Delete request rejected.');
      await load();
    } catch (err) {
      setBanner(friendlyError(err, 'Could not review request.'));
    } finally {
      setReviewBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-600" />
          <div>
            <h1 className="font-display text-xl font-semibold text-gray-900">Activity log</h1>
            <p className="text-xs text-gray-500">
              Staff actions and pending delete requests (newest first).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
      {banner && (
        <p className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{banner}</p>
      )}

      {(profile?.role === 'admin' || profile?.role === 'director') && (
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-50 flex items-center gap-2 bg-amber-50/60">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <div>
              <h2 className="text-sm font-semibold text-amber-900">Pending delete requests</h2>
              <p className="text-[11px] text-amber-800/80">
                Only admins can approve (executes delete) or reject.
              </p>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-gray-400 p-5 text-center">Loading…</p>
          ) : deleteRequests.length === 0 ? (
            <p className="text-sm text-gray-400 p-5 text-center">No pending delete requests.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {deleteRequests.map((r) => (
                <li key={r.id} className="px-4 py-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {r.entity_type}: {r.entity_label}
                      </p>
                      <p className="text-xs text-gray-500">
                        Requested by {r.requester?.full_name ?? 'Staff'}
                        {r.requester?.email ? ` (${r.requester.email})` : ''} ·{' '}
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-700 mt-1">
                        <span className="font-semibold">Reason:</span> {r.reason}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={reviewBusy === r.id}
                          onClick={() => void handleReview(r.id, 'approve')}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Approve delete
                        </button>
                        <button
                          type="button"
                          disabled={reviewBusy === r.id}
                          onClick={() => void handleReview(r.id, 'reject')}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 p-6 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 p-6 text-center">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800 text-xs">{r.actor_name ?? '—'}</p>
                      <p className="text-[11px] text-gray-400">{r.actor_email ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-800">
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
