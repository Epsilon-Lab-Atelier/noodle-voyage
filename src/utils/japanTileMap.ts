export type PrefectureTile = { name: string; row: number; col: number };

export const japanTileRows = 13;
export const japanTileColumns = 15;

/**
 * Grid positions for the prefecture tile map. Rows run north to south and
 * columns west to east, so every prefecture keeps its real neighbours on the
 * sides they belong on and the block reads as Japan rather than as an
 * arbitrary grid. Empty cells are seas and mountain ranges, and the wide gap
 * before 沖縄県 stands for the distance to the Ryukyu islands.
 */
export const prefectureTiles: PrefectureTile[] = [
  { name: '北海道', row: 1, col: 15 },
  { name: '青森県', row: 2, col: 14 },
  { name: '秋田県', row: 3, col: 13 }, { name: '岩手県', row: 3, col: 14 },
  { name: '山形県', row: 4, col: 13 }, { name: '宮城県', row: 4, col: 14 },
  { name: '新潟県', row: 5, col: 13 }, { name: '福島県', row: 5, col: 14 },
  { name: '石川県', row: 6, col: 10 }, { name: '富山県', row: 6, col: 11 }, { name: '長野県', row: 6, col: 12 },
  { name: '群馬県', row: 6, col: 13 }, { name: '栃木県', row: 6, col: 14 }, { name: '茨城県', row: 6, col: 15 },
  { name: '福井県', row: 7, col: 10 }, { name: '岐阜県', row: 7, col: 11 }, { name: '山梨県', row: 7, col: 12 },
  { name: '埼玉県', row: 7, col: 14 },
  { name: '島根県', row: 8, col: 6 }, { name: '鳥取県', row: 8, col: 7 }, { name: '京都府', row: 8, col: 9 },
  { name: '滋賀県', row: 8, col: 10 }, { name: '愛知県', row: 8, col: 11 }, { name: '静岡県', row: 8, col: 12 },
  { name: '神奈川県', row: 8, col: 13 }, { name: '東京都', row: 8, col: 14 }, { name: '千葉県', row: 8, col: 15 },
  { name: '山口県', row: 9, col: 5 }, { name: '広島県', row: 9, col: 6 }, { name: '岡山県', row: 9, col: 7 },
  { name: '兵庫県', row: 9, col: 8 }, { name: '大阪府', row: 9, col: 9 }, { name: '奈良県', row: 9, col: 10 },
  { name: '三重県', row: 9, col: 11 },
  { name: '福岡県', row: 10, col: 4 }, { name: '大分県', row: 10, col: 5 }, { name: '香川県', row: 10, col: 7 },
  { name: '徳島県', row: 10, col: 8 }, { name: '和歌山県', row: 10, col: 9 },
  { name: '佐賀県', row: 11, col: 3 }, { name: '熊本県', row: 11, col: 4 }, { name: '宮崎県', row: 11, col: 5 },
  { name: '愛媛県', row: 11, col: 6 }, { name: '高知県', row: 11, col: 7 },
  { name: '長崎県', row: 12, col: 3 }, { name: '鹿児島県', row: 12, col: 4 },
  { name: '沖縄県', row: 13, col: 1 }
];
