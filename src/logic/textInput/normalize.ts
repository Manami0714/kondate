// 読み取る前の文字をそろえる(純粋関数)
//
// 2つの形を使う
// - 表示の形(cleanText):半角カナ→全角、全角英数→半角(NFKC)、空白を1つにそろえる。画面に出すのはこちら
// - 比べる形(toMatchForm):表示の形の、ひらがな→カタカナ、英字→小文字。1文字ずつ置き換えるだけなので、
//   表示の形と文字の位置が同じになる(比べる形で見つけた位置で、表示の形を切り出せる)

/** 表示の形にそろえる */
export function cleanText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\s　]+/g, ' ')
    .trim();
}

/** 比べる形にする(文字数は変わらない) */
export function toMatchForm(clean: string): string {
  return clean.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).toLowerCase();
}
