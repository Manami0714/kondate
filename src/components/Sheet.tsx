import { useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 右上に置くボタン(保存など) */
  action?: ReactNode;
}

/** 下から出る画面 */
export function Sheet({ title, onClose, children, action }: Props) {
  // 後ろの画面がスクロールしないようにする
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button type="button" className="btn btn-small" onClick={onClose}>
            閉じる
          </button>
          <h2 className="sheet-title">{title}</h2>
          <div>{action}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
