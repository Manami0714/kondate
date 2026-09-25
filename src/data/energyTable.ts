// 推定エネルギー必要量(身体活動レベル「ふつう」、kcal/日)
//
// 出典:厚生労働省「日本人の食事摂取基準(2025年版)」策定検討会報告書 各論 1-1 エネルギー
//   https://www.mhlw.go.jp/stf/newpage_44138.html(エネルギーの分割版 PDF:/content/10904750/001316461.pdf)
//   報告書の表3(基礎代謝量基準値)・表4(身体活動レベル基準値)・表6(エネルギー蓄積量)から値を出し、
//   食事摂取基準(2025年版)の推定エネルギー必要量を載せている資料と照らし合わせて確かめた値。
//   0歳は乳児の区分のうち「6〜8か月」の値を使う(年齢を整数で持つため)

export interface EnergyRow {
  /** この年齢以上(歳) */
  minAge: number;
  /** 年齢区分の表示 */
  label: string;
  male: number;
  female: number;
}

/** 年齢の低い順 */
export const ENERGY_TABLE: readonly EnergyRow[] = [
  { minAge: 0, label: '0歳(6〜8か月の値)', male: 650, female: 600 },
  { minAge: 1, label: '1〜2歳', male: 950, female: 900 },
  { minAge: 3, label: '3〜5歳', male: 1300, female: 1250 },
  { minAge: 6, label: '6〜7歳', male: 1550, female: 1450 },
  { minAge: 8, label: '8〜9歳', male: 1850, female: 1700 },
  { minAge: 10, label: '10〜11歳', male: 2250, female: 2100 },
  { minAge: 12, label: '12〜14歳', male: 2600, female: 2400 },
  { minAge: 15, label: '15〜17歳', male: 2850, female: 2300 },
  { minAge: 18, label: '18〜29歳', male: 2600, female: 1950 },
  { minAge: 30, label: '30〜49歳', male: 2750, female: 2050 },
  { minAge: 50, label: '50〜64歳', male: 2650, female: 1950 },
  { minAge: 65, label: '65〜74歳', male: 2350, female: 1850 },
  { minAge: 75, label: '75歳以上', male: 2250, female: 1750 },
];
