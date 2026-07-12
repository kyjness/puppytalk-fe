// 댓글 삭제 확인 모달.
interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CommentDeleteModal({ open, onClose, onConfirm }: ConfirmModalProps) {
  return (
    <div
      className={`modal-overlay ${open ? 'visible' : ''}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <h3 className="modal-title">댓글을 삭제하시겠습니까?</h3>
        <p className="modal-text">삭제한 내용은 복구 할 수 없습니다.</p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirm"
            onClick={onConfirm}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
