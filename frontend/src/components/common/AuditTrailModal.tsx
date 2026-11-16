import React, { useEffect, useState } from 'react';
import type { AuditLogItem } from '../../types';
import { api } from '../../api/client';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setLoading(true);
    api.getAuditLogs(projectId)
      .then((items) => {
        if (mounted) setLogs(items);
      })
      .catch((err) => console.warn('Failed to load audit logs:', err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const filteredLogs = filterAction === 'all'
    ? logs
    : logs.filter((l) => l.action.toLowerCase().includes(filterAction.toLowerCase()));

  const getActionBadgeColor = (action: string) => {
    if (action.includes('login')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (action.includes('conflict')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (action.includes('handover')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (action.includes('role') || action.includes('permission')) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (action.includes('redact') || action.includes('sensitive')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/60">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Security & Governance Audit Trail</h2>
              <p className="text-xs text-gray-500">Immutable ledger recording authentication, role changes, data redactions, and sign-offs.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-2 overflow-x-auto text-xs">
          <span className="font-semibold text-gray-600 mr-1">Filter Action:</span>
          {['all', 'login', 'role', 'conflict', 'handover', 'sensitive'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterAction(f)}
              className={`px-3 py-1 rounded-full font-medium capitalize transition-colors cursor-pointer ${
                filterAction === f
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'sensitive' ? 'Data Redaction' : f}
            </button>
          ))}
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2" />
              <p>Loading audit trail...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              No audit entries found matching filter.
            </div>
          ) : (
            filteredLogs.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-lg border border-gray-100 bg-white hover:bg-gray-50/50 transition-colors flex items-start justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${getActionBadgeColor(entry.action)}`}>
                      {entry.action}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {entry.username} {entry.user_role ? `(${entry.user_role})` : ''}
                    </span>
                    {entry.ip_address && (
                      <span className="text-gray-400 font-mono text-[10px]">
                        IP: {entry.ip_address}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 font-medium">{entry.details || 'No event details recorded.'}</p>
                </div>
                <div className="text-right text-gray-400 whitespace-nowrap text-[11px]">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>{filteredLogs.length} audit trail records retrieved</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

