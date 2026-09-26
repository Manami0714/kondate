interface Props {
  /** 選んでいる食材の数 */
  selectedCount: number;
  /** 保存の目安を過ぎた食材の数 */
  pastCount: number;
  busy: boolean;
  onSelectPast: () => void;
  onClear: () => void;
  onRemove: () => void;
  onClose: () => void;
}

/** 在庫の整理中に一覧の上に出すボタン:目安を過ぎたものを選ぶ・選択を外す・やめる・選んだものを消す */
export function TidyBar({ selectedCount, pastCount, busy, onSelectPast, onClear, onRemove, onClose }: Props) {
  return (
    <div className="form" style={{ gap: 8, marginBottom: 12 }}>
      <p className="field-hint" style={{ margin: 0 }}>
        在庫から消す食材を選んでください。
      </p>
      {/* 幅の狭い iPhone でも文字が折り返さないよう、長いボタンは1段を使う */}
      <div className="btn-row btn-row-nowrap">
        <button type="button" className="btn" disabled={pastCount === 0} onClick={onSelectPast}>
          目安を過ぎたものを選ぶ{pastCount > 0 ? `(${pastCount}品)` : ''}
        </button>
      </div>
      <div className="btn-row btn-row-nowrap">
        <button type="button" className="btn" disabled={selectedCount === 0} onClick={onClear}>
          選択を外す
        </button>
        <button type="button" className="btn" onClick={onClose}>
          やめる
        </button>
      </div>
      <button type="button" className="btn btn-danger btn-block" disabled={selectedCount === 0 || busy} onClick={onRemove}>
        {selectedCount > 0 ? `選んだ${selectedCount}品を在庫から消す` : '選んだ食材を在庫から消す'}
      </button>
    </div>
  );
}
