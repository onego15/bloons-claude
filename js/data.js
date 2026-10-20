'use strict';
// ---------------------------------------------------------------------------
// Game data: towers, enemies, levels and waves.
// ---------------------------------------------------------------------------

const TOWERS = {
  squirrel: {
    name: 'どんぐりリス', kind: 'shooter', cost: 100, key: '1', air: true, dtype: 'phys',
    blurb: '素早くドングリを投げる。空の敵にも当たる万能タワー。',
    levels: [
      { dmg: 9, rate: 1.5, range: 135 },
      { cost: 85, title: 'かたいドングリ', desc: '攻撃力と連射がアップ', dmg: 13, rate: 1.9, range: 145 },
      { cost: 150, title: 'ドングリ名人', desc: '射程がのびて さらに連射', dmg: 18, rate: 2.3, range: 160 },
    ],
    branches: {
      A: { cost: 330, title: 'スナイパーリス', desc: '超遠距離から一撃必殺。装甲を無視', dmg: 85, rate: 0.7, range: 280, pierce: 1, target: 'strong' },
      B: { cost: 360, title: 'ガトリングリス', desc: 'ドングリの嵐。数で押す敵に強い', dmg: 12, rate: 7.5, range: 165 },
    },
  },
  mortar: {
    name: 'キノコ砲', kind: 'mortar', cost: 130, key: '2', air: false, dtype: 'phys',
    blurb: '胞子爆弾を山なりに撃つ。範囲攻撃。地上の敵のみ。',
    levels: [
      { dmg: 24, rate: 0.5, range: 175, splash: 52 },
      { cost: 120, title: 'でっかい胞子', desc: '威力と爆発範囲がアップ', dmg: 36, rate: 0.5, range: 180, splash: 58 },
      { cost: 200, title: 'こなごな胞子', desc: '連射と爆発範囲がアップ', dmg: 52, rate: 0.62, range: 185, splash: 66 },
    ],
    branches: {
      A: { cost: 420, title: 'ドカンダケ', desc: '超巨大爆発で敵をしびれさせる', dmg: 135, rate: 0.5, range: 195, splash: 92, stun: 0.7 },
      B: { cost: 400, title: 'ばくれつホウシ', desc: '着弾後に小さな爆弾がはじけ飛ぶ', dmg: 58, rate: 0.66, range: 190, splash: 64, cluster: 5, clusterDmg: 30 },
    },
  },
  frost: {
    name: 'しずくの祠', kind: 'frost', cost: 110, key: '3', air: true, dtype: 'magic',
    blurb: '氷のしずくで敵の足を遅くする。魔法攻撃。',
    levels: [
      { dmg: 4, rate: 1.1, range: 125, slow: 0.4, slowDur: 1.6, splash: 0 },
      { cost: 95, title: 'こおりの粒', desc: '周囲もまとめて凍らせる', dmg: 7, rate: 1.1, range: 130, slow: 0.5, slowDur: 1.8, splash: 36 },
      { cost: 160, title: 'ひょうけつ', desc: '強力なスロウと広い範囲', dmg: 11, rate: 1.2, range: 140, slow: 0.55, slowDur: 2.0, splash: 46 },
    ],
    branches: {
      A: { cost: 360, title: 'ふぶきの祠', desc: '吹雪で射程内すべての敵を凍らせる', dmg: 16, rate: 0.7, range: 150, slow: 0.65, slowDur: 2.2, pulse: true },
      B: { cost: 380, title: 'つららの祠', desc: '巨大つらら。凍った敵に2倍ダメージ', dmg: 75, rate: 0.9, range: 175, slow: 0.5, slowDur: 1.8, splash: 30, shatter: 2 },
    },
  },
  thunder: {
    name: 'カミナリ灯', kind: 'thunder', cost: 170, key: '4', air: true, dtype: 'magic',
    blurb: '敵から敵へ連鎖する稲妻。魔法攻撃で甲羅も関係なし。',
    levels: [
      { dmg: 16, rate: 0.85, range: 145, chains: 3 },
      { cost: 140, title: 'びりびり電球', desc: '威力アップ、連鎖+1', dmg: 24, rate: 0.85, range: 150, chains: 4 },
      { cost: 230, title: 'いかずちの灯', desc: '威力と連射アップ、連鎖+1', dmg: 34, rate: 1.0, range: 155, chains: 5 },
    ],
    branches: {
      A: { cost: 480, title: 'テスラ灯', desc: '稲妻が10体まで連鎖する', dmg: 42, rate: 1.4, range: 165, chains: 10 },
      B: { cost: 500, title: 'かみなり雲', desc: '特大の雷を落とし周囲をしびれさせる', dmg: 230, rate: 0.55, range: 210, splash: 72, stun: 0.45, storm: true },
    },
  },
  farm: {
    name: 'ミツバチ農園', kind: 'farm', cost: 150, key: '5', air: false, dtype: 'none',
    blurb: 'ウェーブ開始ごとにハチミツ（ゴールド）を生み出す。',
    levels: [
      { income: 30, range: 0 },
      { cost: 160, title: '花畑の拡張', desc: '収入 30 → 55', income: 55, range: 0 },
      { cost: 240, title: '黄金の巣箱', desc: '収入 55 → 95', income: 95, range: 0 },
    ],
    branches: null,
  },
};
const TOWER_ORDER = ['squirrel', 'mortar', 'frost', 'thunder', 'farm'];

const ENEMIES = {
  gloomlet: { name: 'プチグルーム', hp: 28, speed: 52, reward: 5, lives: 1, r: 14,
    desc: 'いたずら好きのインクのかたまり。' },
  zipper: { name: 'ダッシュグルーム', hp: 19, speed: 108, reward: 5, lives: 1, r: 11,
    desc: 'とにかく足が速い。連射タワーで止めよう。' },
  shell: { name: 'カブトグルーム', hp: 110, speed: 36, armor: 0.55, reward: 12, lives: 2, r: 17,
    desc: '石の甲羅で物理攻撃を55%カット。魔法がよく効く。' },
  bubble: { name: 'アワグルーム', hp: 60, speed: 42, reward: 8, lives: 2, r: 19, split: 3,
    desc: '割れると中からプチグルームが3体飛び出す。' },
  moth: { name: 'ヨルガ', hp: 40, speed: 68, fly: true, reward: 8, lives: 1, r: 13,
    desc: '空を飛ぶ。キノコ砲の攻撃が当たらない。' },
  wisp: { name: 'オバケビ', hp: 72, speed: 58, mres: 0.75, reward: 10, lives: 1, r: 14,
    desc: '魔法攻撃を75%カット。ドングリや胞子で倒そう。' },
  mender: { name: 'イヤシグルーム', hp: 85, speed: 44, heal: true, reward: 12, lives: 1, r: 15,
    desc: 'まわりの仲間を回復する。優先して倒そう。' },
  brute: { name: 'ドスグルーム', hp: 520, speed: 30, armor: 0.25, reward: 60, lives: 5, r: 26,
    desc: '大きくてタフ。ゴールに着くとライフ-5。' },
  king: { name: 'グルームキング', hp: 5200, speed: 21, armor: 0.3, mres: 0.15, reward: 400, lives: 20, r: 42, boss: true,
    desc: 'グルームたちの王さま。手下を呼び出す。' },
};

// wave group: [type, count, gap(s), delay(s), path index (-1 = alternate)]
const LEVELS = [
  {
    id: 0,
    name: 'ひだまり草原',
    sub: 'はじまりの道',
    theme: 'meadow',
    seed: 11,
    gold: 320, lives: 20, hpMul: 1.0,
    paths: [
      [[-70, 190], [120, 185], [270, 205], [345, 300], [300, 420], [330, 530], [470, 560], [600, 505], [650, 385], [610, 265], [690, 165], [850, 150], [960, 235], [945, 375], [1015, 490], [1135, 505], [1195, 430]],
    ],
    home: [1195, 420],
    pond: [[805, 395, 70, 46]],
    waves: [
      [['gloomlet', 8, 1.1]],
      [['gloomlet', 12, 0.8]],
      [['gloomlet', 10, 0.8], ['zipper', 6, 0.6, 7]],
      [['zipper', 8, 0.5], ['gloomlet', 12, 0.6, 3]],
      [['shell', 4, 2.2], ['gloomlet', 14, 0.6, 2]],
      [['zipper', 18, 0.35], ['shell', 6, 1.6, 4]],
      [['bubble', 6, 1.6], ['gloomlet', 16, 0.45, 5]],
      [['moth', 10, 0.9], ['shell', 8, 1.2, 3], ['zipper', 14, 0.35, 8]],
      [['gloomlet', 26, 0.28], ['bubble', 8, 1.2, 4], ['moth', 10, 0.8, 9]],
      [['brute', 2, 8], ['zipper', 22, 0.3, 2], ['shell', 10, 1.0, 6], ['moth', 12, 0.7, 10]],
    ],
  },
  {
    id: 1,
    name: 'もみじの森',
    sub: 'ふたつの小道',
    theme: 'autumn',
    seed: 23,
    gold: 450, lives: 20, hpMul: 1.12,
    paths: [
      [[-70, 130], [140, 140], [270, 215], [400, 225], [520, 300], [610, 370], [760, 370], [860, 260], [1000, 220], [1110, 300], [1100, 430], [1180, 515]],
      [[-70, 575], [130, 560], [250, 470], [390, 455], [520, 420], [610, 370], [760, 370], [860, 260], [1000, 220], [1110, 300], [1100, 430], [1180, 515]],
    ],
    home: [1185, 505],
    pond: [],
    waves: [
      [['gloomlet', 8, 1.0, 0, 0], ['gloomlet', 8, 1.0, 2, 1]],
      [['zipper', 10, 0.6, 0, -1], ['gloomlet', 10, 0.8, 4, -1]],
      [['shell', 4, 2.0, 0, 0], ['gloomlet', 14, 0.6, 1, 1]],
      [['wisp', 6, 1.2, 0, -1], ['zipper', 12, 0.4, 5, 0]],
      [['bubble', 6, 1.4, 0, -1], ['shell', 5, 1.8, 3, 1]],
      [['moth', 12, 0.7, 0, -1], ['gloomlet', 20, 0.4, 3, -1]],
      [['mender', 3, 3, 0, 0], ['shell', 8, 1.2, 1, 0], ['wisp', 8, 1, 2, 1]],
      [['zipper', 30, 0.25, 0, -1], ['bubble', 6, 1.2, 6, -1]],
      [['brute', 1, 1, 0, 0], ['wisp', 10, 0.8, 2, 1], ['mender', 3, 3, 4, 0]],
      [['moth', 16, 0.5, 0, -1], ['shell', 12, 1.0, 4, -1]],
      [['bubble', 10, 1.0, 0, -1], ['mender', 4, 2.5, 3, -1], ['zipper', 20, 0.3, 8, -1]],
      [['brute', 3, 5, 0, -1], ['wisp', 14, 0.6, 2, -1], ['gloomlet', 30, 0.25, 6, -1]],
      [['shell', 16, 0.8, 0, -1], ['moth', 18, 0.5, 4, -1], ['mender', 5, 2, 6, -1]],
      [['brute', 5, 3.5, 0, -1], ['bubble', 12, 0.9, 3, -1], ['wisp', 16, 0.5, 8, -1], ['zipper', 30, 0.2, 12, -1]],
    ],
  },
  {
    id: 2,
    name: 'ゆきどけ高原',
    sub: 'キングの進軍',
    theme: 'snow',
    seed: 37,
    gold: 560, lives: 20, hpMul: 1.28,
    paths: [
      [[-70, 300], [130, 300], [215, 170], [370, 115], [515, 185], [520, 330], [395, 425], [270, 470], [265, 555], [420, 560], [590, 520], [700, 420], [700, 285], [800, 165], [975, 145], [1085, 240], [1005, 375], [1060, 520], [1185, 545]],
      [[905, -70], [900, 60], [975, 145], [1085, 240], [1005, 375], [1060, 520], [1185, 545]],
    ],
    home: [1190, 530],
    pond: [[150, 470, 64, 40]],
    waves: [
      [['gloomlet', 14, 0.7, 0, 0]],
      [['zipper', 14, 0.45, 0, 0], ['gloomlet', 8, 0.8, 3, 1]],
      [['shell', 4, 2.0, 0, 0], ['wisp', 4, 1.4, 6, 0]],
      [['moth', 10, 0.7, 0, 1], ['gloomlet', 18, 0.45, 2, 0]],
      [['bubble', 8, 1.2, 0, 0], ['mender', 3, 3, 3, 0]],
      [['brute', 1, 1, 0, 0], ['zipper', 20, 0.3, 2, 1]],
      [['wisp', 14, 0.6, 0, 0], ['shell', 10, 1.0, 3, 0], ['moth', 8, 0.8, 6, 1]],
      [['bubble', 12, 0.9, 0, -1], ['mender', 4, 2.5, 4, 0]],
      [['brute', 2, 4, 0, 0], ['zipper', 26, 0.25, 2, 1], ['shell', 10, 1.0, 5, 0]],
      [['moth', 22, 0.4, 0, -1], ['wisp', 14, 0.6, 4, 0]],
      [['shell', 18, 0.7, 0, 0], ['mender', 6, 2, 3, 0], ['bubble', 8, 1, 6, 1]],
      [['brute', 4, 3, 0, -1], ['gloomlet', 40, 0.2, 2, -1]],
      [['wisp', 20, 0.45, 0, -1], ['moth', 20, 0.45, 4, -1], ['zipper', 30, 0.2, 8, 0]],
      [['king', 1, 1, 0, 0], ['shell', 14, 1.2, 6, 0], ['mender', 6, 3, 10, 0], ['moth', 16, 0.8, 14, 1], ['brute', 3, 6, 20, 1]],
    ],
  },
];
