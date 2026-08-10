import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { japanTileColumns, japanTileRows, prefectureTiles } from '../src/utils/japanTileMap';
import { projectWorldPoint, worldMapHeight, worldMapWidth } from '../src/components/worldMapGeometry';

const regions = JSON.parse(fs.readFileSync(path.resolve('data/master/regions.json'), 'utf8')) as {
  prefectures: Array<{ code: string; name: string }>;
};

const cellOf = (name: string) => {
  const tile = prefectureTiles.find((entry) => entry.name === name);
  if (!tile) throw new Error(`missing tile: ${name}`);
  return tile;
};

describe('prefecture tile map', () => {
  it('covers every prefecture exactly once', () => {
    expect(prefectureTiles).toHaveLength(regions.prefectures.length);
    expect(new Set(prefectureTiles.map((tile) => tile.name))).toEqual(
      new Set(regions.prefectures.map((prefecture) => prefecture.name))
    );
  });

  it('places every tile in its own cell inside the grid', () => {
    const cells = prefectureTiles.map((tile) => `${tile.row}:${tile.col}`);
    expect(new Set(cells).size).toBe(prefectureTiles.length);
    for (const tile of prefectureTiles) {
      expect(tile.row).toBeGreaterThanOrEqual(1);
      expect(tile.row).toBeLessThanOrEqual(japanTileRows);
      expect(tile.col).toBeGreaterThanOrEqual(1);
      expect(tile.col).toBeLessThanOrEqual(japanTileColumns);
    }
  });

  it('keeps neighbouring prefectures on the sides they belong on', () => {
    const northOf: Array<[string, string]> = [
      ['北海道', '青森県'], ['青森県', '岩手県'], ['岩手県', '宮城県'], ['秋田県', '山形県'],
      ['山形県', '新潟県'], ['宮城県', '福島県'], ['新潟県', '群馬県'], ['福島県', '栃木県'],
      ['栃木県', '埼玉県'], ['埼玉県', '東京都'], ['長野県', '山梨県'], ['山梨県', '静岡県'],
      ['富山県', '岐阜県'], ['岐阜県', '愛知県'], ['愛知県', '三重県'], ['石川県', '福井県'],
      ['京都府', '大阪府'], ['大阪府', '和歌山県'], ['鳥取県', '岡山県'], ['島根県', '広島県'],
      ['岡山県', '香川県'], ['香川県', '高知県'], ['福岡県', '熊本県'], ['熊本県', '鹿児島県'],
      ['佐賀県', '長崎県'], ['大分県', '宮崎県'], ['鹿児島県', '沖縄県']
    ];
    for (const [north, south] of northOf) {
      expect([north, south, cellOf(north).row < cellOf(south).row]).toEqual([north, south, true]);
    }

    const westOf: Array<[string, string]> = [
      ['長崎県', '熊本県'], ['福岡県', '大分県'], ['山口県', '広島県'], ['広島県', '岡山県'],
      ['岡山県', '兵庫県'], ['兵庫県', '大阪府'], ['大阪府', '奈良県'], ['京都府', '滋賀県'],
      ['愛媛県', '高知県'], ['香川県', '徳島県'], ['福井県', '岐阜県'], ['石川県', '富山県'],
      ['静岡県', '神奈川県'], ['神奈川県', '東京都'], ['東京都', '千葉県'], ['群馬県', '栃木県'],
      ['栃木県', '茨城県'], ['秋田県', '岩手県'], ['山形県', '宮城県'], ['新潟県', '福島県'],
      ['沖縄県', '鹿児島県']
    ];
    for (const [west, east] of westOf) {
      expect([west, east, cellOf(west).col < cellOf(east).col]).toEqual([west, east, true]);
    }
  });
});

describe('world map projection', () => {
  it('places Japan near the centre of the map', () => {
    const { x, y } = projectWorldPoint(36, 138);
    expect(x).toBeGreaterThan(worldMapWidth * 0.44);
    expect(x).toBeLessThan(worldMapWidth * 0.5);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(worldMapHeight);
  });

  it('puts the Americas east of Asia and Europe west of it', () => {
    const seoul = projectWorldPoint(37.6, 127);
    const honolulu = projectWorldPoint(21.3, -157.9);
    const lima = projectWorldPoint(-12.1, -77);
    const tehran = projectWorldPoint(35.7, 51.4);
    expect(seoul.x).toBeLessThan(honolulu.x);
    expect(honolulu.x).toBeLessThan(lima.x);
    expect(tehran.x).toBeLessThan(seoul.x);
  });

  it('keeps every plotted point inside the drawing area', () => {
    for (const [lat, lon] of [[64, -21], [-34, 18.4], [-33.9, 151.2], [19.4, -99.1]] as Array<[number, number]>) {
      const { x, y } = projectWorldPoint(lat, lon);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(worldMapWidth);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(worldMapHeight);
    }
  });
});
