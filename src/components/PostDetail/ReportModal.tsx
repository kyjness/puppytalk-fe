// 신고 사유 선택 모달. 제출 시 POST /reports 호출.
import { useState, type FormEvent } from 'react';
import { api } from '../../api/client.js';
import { getApiErrorMessage, getClientErrorCode } from '../../utils/index.js';

const REPORT_REASONS = [
  { value: '스팸', label: '스팸' },
  { value: '욕설', label: '욕설' },
  { value: '부적절한 콘텐츠', label: '부적절한 콘텐츠' },
  { value: '기타', label: '기타' },
];

interface ReportModalProps {
  open: boolean;
  targetType: string | null;
  targetId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReportModal({ open, targetType, targetId, onClose, onSuccess }: ReportModalProps) {
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetType || !targetId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/reports', {
        targetType,
        targetId,
        reason,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(getClientErrorCode(err), '신고 접수에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={`modal-overlay ${open ? 'visible' : ''}`}
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div className="modal">
        <h3 className="modal-title">신고하기</h3>
        <p className="modal-text">신고 사유를 선택해 주세요.</p>
        <form onSubmit={handleSubmit}>
          <div className="modal-report-body">
            <div className="modal-report-options" role="group" aria-label="신고 사유">
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="modal-report-option">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
            {error && (
              <p className="helper-text" style={{ color: 'var(--color-error, #c00)' }}>
                {error}
              </p>
            )}
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn-confirm"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? <span className="btn-inline-loader" aria-label="로딩" /> : '신고'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
