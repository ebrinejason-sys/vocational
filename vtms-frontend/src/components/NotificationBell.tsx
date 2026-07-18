import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useStore } from '../store';
import { cn, formatDate } from '../lib/utils';

export default function NotificationBell() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useStore();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.readAt);
  const unreadCount = unread.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-100 rounded-xl shadow-lg z-40 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsRead()}
                  className="text-[11px] font-medium text-primary-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-gray-400">No notifications yet.</li>
              ) : (
                notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.readAt) markNotificationRead(n.id);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors',
                        !n.readAt && 'bg-primary-50/50'
                      )}
                    >
                      <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 whitespace-pre-wrap line-clamp-4">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{formatDate(n.createdAt.slice(0, 10))}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
