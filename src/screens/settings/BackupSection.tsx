import { useRef, useState } from 'react';
import { db } from '../../db/db';
import type { AllData } from '../../db/types';
import { backupFileName, countData, parseBackup, serializeBackup } from '../../logic/backup';

const TABLE_LABELS: Record<keyof AllData, string> = {
  foods: '食材辞書',
  stocks: '在庫',
  pantry: '常備調味料',
  members: 'メンバー',
  household: '家庭の好み',
  recipes: 'レシピ',
  mealSets: '献立セット',
  stockMoves: '在庫の動き',
  feedbacks: '評価',
};

/** タッチ操作の端末(iPhone など)では共有シートで保存する */
function shouldUseShareSheet(file: File): boolean {
  return navigator.maxTouchPoints > 0 && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Pending = { data: AllData; exportedAt: string; fileName: string };

/** 全データの書き出し・読み込み */
export function BackupSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const exportData = async () => {
    setMessage(null);
    setError(null);
    const now = new Date();
    const text = serializeBackup(await db.readAll(), now);
    const file = new File([text], backupFileName(now), { type: 'application/json' });
    try {
      if (shouldUseShareSheet(file)) {
        await navigator.share({ files: [file] });
      } else {
        downloadFile(file);
      }
      setMessage(`「${file.name}」を書き出しました`);
    } catch (e) {
      // 共有シートを閉じただけのときは何もしない
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError('書き出しに失敗しました');
    }
  };

  const onFileChosen = async (fileList: FileList | null) => {
    setMessage(null);
    setError(null);
    const file = fileList?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPending({ data: result.data, exportedAt: result.exportedAt, fileName: file.name });
  };

  const applyImport = async () => {
    if (!pending) return;
    try {
      await db.replaceAll(pending.data);
      setMessage('読み込みました。データをファイルの内容に置き換えました');
    } catch {
      setError('読み込みに失敗しました。データは変わっていません');
    }
    setPending(null);
  };

  const counts = pending ? countData(pending.data) : null;

  return (
    <>
      <h2 className="section-title">書き出し・読み込み</h2>
      <p className="muted">
        全データを1つのファイルに書き出して保管できます。読み込むと、今のデータはすべてファイルの内容に置き換わります。
      </p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={exportData}>
          書き出し
        </button>
        <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
          読み込み
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => onFileChosen(e.target.files)}
      />
      {message && (
        <p className="card" role="status" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
      {error && (
        <p className="errors" role="alert" style={{ marginTop: 12, paddingLeft: 14 }}>
          {error}
        </p>
      )}

      {pending && counts && (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ marginTop: 0 }}>
            <strong>{pending.fileName}</strong>
            <br />
            <span className="muted">書き出した日時:{new Date(pending.exportedAt).toLocaleString('ja-JP')}</span>
          </p>
          <ul className="muted" style={{ paddingLeft: '1.2em' }}>
            {(Object.keys(TABLE_LABELS) as (keyof AllData)[]).map((t) => (
              <li key={t}>
                {TABLE_LABELS[t]}:{counts[t]}件
              </li>
            ))}
          </ul>
          <p style={{ color: 'var(--danger)' }}>今のデータはすべて消え、この内容に置き換わります。</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setPending(null)}>
              やめる
            </button>
            <button type="button" className="btn btn-primary" onClick={applyImport}>
              置き換える
            </button>
          </div>
        </div>
      )}
    </>
  );
}
