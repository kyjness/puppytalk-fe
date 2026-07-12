// 댓글 입력 폼. 자동 높이 조절(스크롤 없음), 구분선 겹침 방지.
import { useRef, useEffect, useCallback, type FormEvent } from 'react';
import {
  COMMENT_FORM,
  COMMENT_FORM_SUBMIT,
  COMMENT_TEXTAREA,
  COMMENT_WRITE_BOX,
  COMMENT_WRITE_BOX_DIVIDER,
} from './commentClasses.js';

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;

interface CommentFormProps {
  content: string;
  submitting: boolean;
  onChangeContent: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function CommentForm({ content, submitting, onChangeContent, onSubmit }: CommentFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = 'hidden';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  return (
    <section className={COMMENT_WRITE_BOX}>
      <form className={COMMENT_FORM} onSubmit={onSubmit} noValidate>
        <textarea
          ref={textareaRef}
          className={COMMENT_TEXTAREA}
          placeholder="댓글을 남겨보세요"
          value={content}
          onChange={(e) => onChangeContent(e.target.value)}
          rows={1}
        />
        <div className={COMMENT_WRITE_BOX_DIVIDER} />
        <button type="submit" className={COMMENT_FORM_SUBMIT} disabled={submitting}>
          댓글 등록
        </button>
      </form>
    </section>
  );
}
