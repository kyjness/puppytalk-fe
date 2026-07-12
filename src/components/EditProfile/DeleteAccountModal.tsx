// 회원탈퇴 확인 모달.
interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({ open, onClose, onConfirm }: DeleteAccountModalProps) {
  return (
    <div
      className={`modal-overlay ${open ? 'visible' : ''}`}
      id="delete-modal"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === 'delete-modal') onClose();
      }}
    >
      <div className="modal">
        <h3 className="modal-title">회원탈퇴 하시겠습니까?</h3>
        <p className="modal-text">작성된 게시글과 댓글은 삭제됩니다.</p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            id="delete-modal-cancel"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirm"
            id="delete-modal-confirm"
            onClick={onConfirm}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
