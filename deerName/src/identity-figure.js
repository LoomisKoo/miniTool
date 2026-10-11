/* 仙鹿起名 · 前世身份 Q 版角色（纯 SVG 拼装）
 * DEER_FIGURE.svg(title, dyn, gender, seed) → <svg> 字符串
 */
(function () {
var INK = '#3a2a24', SKIN = '#ffe0c7', HAIR = '#3a2a24';
var FEMALE = false;

/* ---------- 发型 ---------- */
/* back 画在头后面，front 画在脸上面 */
var FRINGE = 'M31 60 C28 30 44 22 60 22 C76 22 92 30 89 60 L84 60 C84 50 82 45 80 41 L76 46 L72 40 L67 46 L62 40 L57 46 L52 40 L47 46 L43 40 L40 44 C37 49 36 55 36 60 Z';
var SWOOP = 'M31 58 C28 28 46 21 62 22 C80 23 92 34 89 58 L85 58 C85 49 83 42 79 39 C70 44 54 46 40 42 C37 47 35 53 35 58 Z';
var HAIRS = {
  bangs: function (c) { return { front: '<path d="' + FRINGE + '" fill="' + c + '"/>' }; },
  swoop: function (c) { return { front: '<path d="' + SWOOP + '" fill="' + c + '"/>' }; },
  spiky: function (c) { return { front: '<path d="M31 57 C30 40 35 32 39 29 L36 17 L47 25 L51 12 L60 22 L69 11 L73 24 L84 17 L81 30 C87 35 90 45 89 57 L84 51 L80 43 L74 48 L70 41 L64 47 L58 41 L52 47 L46 41 L40 49 L35 51 Z" fill="' + c + '"/>' }; },
  fluffy: function (c) { return { front:
    '<circle cx="36" cy="46" r="8" fill="' + c + '"/><circle cx="84" cy="46" r="8" fill="' + c + '"/>' +
    '<circle cx="41" cy="33" r="10" fill="' + c + '"/><circle cx="79" cy="33" r="10" fill="' + c + '"/>' +
    '<circle cx="52" cy="26" r="10" fill="' + c + '"/><circle cx="68" cy="26" r="10" fill="' + c + '"/>' +
    '<path class="ns" d="M34 46 C36 30 50 24 60 24 C70 24 84 30 86 46 C76 40 70 40 60 42 C50 40 44 40 34 46 Z" fill="' + c + '"/>' }; },
  bob: function (c) { return { front: '<path d="M29 68 C25 30 44 22 60 22 C76 22 95 30 91 68 L84 68 L84 51 C77 45 67 43 60 41 C53 43 43 45 36 51 L36 68 Z" fill="' + c + '"/>' }; },
  long: function (c) { return {
    back: '<path d="M31 50 C27 82 31 100 42 104 L78 104 C89 100 93 82 89 50 Z" fill="' + c + '"/>',
    front: '<path d="' + FRINGE + '" fill="' + c + '"/>' }; },
  ponytail: function (c) { return {
    back: '<path d="M82 34 C104 36 108 70 96 90 C96 72 92 56 80 48 Z" fill="' + c + '"/><circle cx="84" cy="36" r="5" fill="#e25a5a"/>',
    front: '<path d="' + SWOOP + '" fill="' + c + '"/>' }; },
  twintail: function (c) { return {
    back: '<path d="M36 40 C16 44 12 80 22 98 C24 78 28 62 40 52 Z" fill="' + c + '"/><path d="M84 40 C104 44 108 80 98 98 C96 78 92 62 80 52 Z" fill="' + c + '"/>',
    front: '<path d="' + FRINGE + '" fill="' + c + '"/>' }; },
  none: function () { return {}; }
};

/* ---------- 帽饰：back 画在头后，front 画在头前 ---------- */
var HATS = {
  crown: { front: '<path d="M40 32 L43 12 L52 23 L60 8 L68 23 L77 12 L80 32 Z" fill="#ffd34a"/>' +
    '<circle class="ns" cx="60" cy="24" r="3" fill="#e25a5a"/><circle class="ns" cx="48" cy="27" r="2.2" fill="#5ab0e2"/><circle class="ns" cx="72" cy="27" r="2.2" fill="#5ab0e2"/>' },
  helmetA: { front: '<rect x="57" y="12" width="6" height="10" fill="#8e9aa6"/><circle cx="60" cy="11" r="6.5" fill="#e25a4a"/>' +
    '<path d="M30 47 a30 28 0 0 1 60 0 z" fill="#b6c1cc"/><rect x="28" y="41" width="64" height="8" rx="4" fill="#8e9aa6"/>' },
  bun: { back: '<circle cx="60" cy="21" r="10" fill="' + HAIR + '"/>',
    front: '<rect x="45" y="18" width="30" height="3.6" rx="1.8" fill="#ffd34a"/>' },
  guapi: { front: '<path d="M37 37 a23 21 0 0 1 46 0 z" fill="#2e2a2a"/><rect x="35" y="33" width="50" height="6" rx="3" fill="#2e2a2a"/><circle cx="60" cy="15" r="4.5" fill="#e25a4a"/>' },
  douli: { front: '<path d="M12 40 L60 9 L108 40 Q60 51 12 40 Z" fill="#eac27a"/><path d="M36 25 L60 45 M84 25 L60 45" fill="none"/>' },
  douliDark: { front: '<path d="M12 40 L60 9 L108 40 Q60 51 12 40 Z" fill="#5a5f78"/><path d="M36 25 L60 45 M84 25 L60 45" fill="none"/>' +
    '<path d="M100 42 q6 12 2 22" fill="none" style="stroke:#e25a4a;stroke-width:3"/>' },
  headband: { front: '<rect x="31" y="35" width="58" height="8" rx="4" fill="#5b8fd6"/><path d="M88 38 l11 -6 l-1 11 z" fill="#5b8fd6"/>' },
  softcap: { front: '<path d="M37 37 q23 -30 46 0 z" fill="#6f8f6a"/><rect x="35" y="33" width="50" height="6" rx="3" fill="#56764f"/>' },
  twinbuns: { back: '<circle cx="35" cy="29" r="10" fill="' + HAIR + '"/><circle cx="85" cy="29" r="10" fill="' + HAIR + '"/>',
    front: '<circle class="ns" cx="85" cy="22" r="4" fill="#ff8fb0"/><circle class="ns" cx="91" cy="28" r="3.4" fill="#ffb3c8"/><circle class="ns" cx="33" cy="22" r="3.4" fill="#ffb3c8"/>' },
  policeCap: { front: '<path d="M34 39 a26 20 0 0 1 52 0 z" fill="#3e5a86"/><rect x="32" y="35" width="56" height="7" rx="3" fill="#2e4468"/>' +
    '<path d="M40 42 q20 8 40 0 v3 q-20 8 -40 0 z" fill="#222"/><circle cx="60" cy="28" r="4" fill="#ffd34a"/>' },
  sunhat: { front: '<ellipse cx="60" cy="34" rx="41" ry="9" fill="#f3d58a"/><path d="M40 34 a20 18 0 0 1 40 0 z" fill="#f3d58a"/><rect x="40" y="28" width="40" height="5" fill="#e27a5a"/>' },
  hardhat: { front: '<path d="M32 41 a28 26 0 0 1 56 0 z" fill="#ffd34a"/><rect x="28" y="37" width="64" height="7" rx="3.5" fill="#f2b52a"/><rect x="57" y="15" width="6" height="24" rx="3" fill="#f2b52a"/>' },
  mirror: { front: '<rect x="31" y="33" width="58" height="5" rx="2.5" fill="#d0d6de"/><circle cx="60" cy="31" r="7.5" fill="#f2f6fa"/><circle class="ns" cx="60" cy="31" r="3" fill="#9fd4ff"/>' },
  cap: { front: '<path d="M34 41 a26 22 0 0 1 52 0 z" fill="#e25a5a"/><path d="M84 39 q16 0 20 6 h-24 z" fill="#c94444"/>' },
  headphones: { front: '<path d="M31 54 a29 30 0 0 1 58 0" fill="none" style="stroke-width:5"/><rect x="25" y="46" width="10" height="16" rx="5" fill="#b07aff"/><rect x="85" y="46" width="10" height="16" rx="5" fill="#b07aff"/>' },
  beanie: { front: '<path d="M32 45 a28 28 0 0 1 56 0 z" fill="#3f3f52"/><rect x="30" y="39" width="60" height="9" rx="4.5" fill="#5a5a72"/><circle cx="60" cy="15" r="5" fill="#5a5a72"/>' },
  none: {}
};

function futureHelm(acc, top) {
  return { front: '<path d="M29 51 a31 31 0 0 1 62 0 z" fill="#eef2fa"/><rect x="34" y="35" width="52" height="10" rx="5" fill="' + acc + '" opacity=".85"/>' +
    (top === 'crown'
      ? '<path d="M48 22 L50 12 L55 18 L60 9 L65 18 L70 12 L72 22 Z" fill="#ffd34a"/>'
      : '<rect x="58.5" y="8" width="3" height="14" fill="#9aa6b2"/><circle cx="60" cy="8" r="4" fill="' + acc + '"/>') };
}

/* ---------- 配件 ---------- */
var ACC = {
  glasses: '<circle cx="48" cy="57" r="8" fill="none"/><circle cx="72" cy="57" r="8" fill="none"/><path d="M56 57 h8" fill="none"/>',
  shades: '<path d="M38 52 h19 v5 a6 6 0 0 1 -6 6 h-7 a6 6 0 0 1 -6 -6 z" fill="#2a2a3a"/><path d="M63 52 h19 v5 a6 6 0 0 1 -6 6 h-7 a6 6 0 0 1 -6 -6 z" fill="#2a2a3a"/><path d="M57 54 h6" fill="none"/>' +
    '<path class="ns" d="M41 54 l4 0 l-3 4 z M66 54 l4 0 l-3 4 z" fill="#fff" opacity=".7"/>',
  mustache: '<path class="ns" d="M52 62 q4 -4 8 0 q4 -4 8 0 q-4 4 -8 1 q-4 3 -8 -1 z" fill="' + HAIR + '"/>',
  goggles: '<rect x="37" y="44" width="46" height="8" rx="4" fill="#ffb14a"/>'
};

/* ---------- 身体 ---------- */
/* 袖子贴着身体从肩膀垂下；wide = 古装广袖 */
var ARM_PATH = {
  narrow: 'M50 82 C39 83 30 92 24 103 Q26 111 33 109 C37 101 43 96 50 95 Z',
  wide: 'M50 81 C37 83 26 94 18 108 Q25 117 35 112 C38 103 44 97 52 96 Z'
};
function arm(style, c, right) {
  return '<path d="' + ARM_PATH[style] + '" fill="' + c + '"' + (right ? ' transform="translate(120,0) scale(-1,1)"' : '') + '/>';
}
function sleeves() { return ''; }
function legs(c) {
  if (FEMALE) return '<rect x="48" y="112" width="9" height="12" rx="3" fill="' + SKIN + '"/><rect x="63" y="112" width="9" height="12" rx="3" fill="' + SKIN + '"/>' +
    '<path d="M39 104 H81 L87 118 Q60 123 33 118 Z" fill="' + c + '"/>';
  return '<rect x="46" y="108" width="12" height="16" rx="4" fill="' + c + '"/><rect x="62" y="108" width="12" height="16" rx="4" fill="' + c + '"/>';
}
var TORSO = 'M40 82 Q60 76 80 82 L83 112 H37 Z';
var BODIES = {
  robe: function (c, c2) {
    return '<path d="M40 80 Q60 72 80 80 L92 122 Q60 130 28 122 Z" fill="' + c + '"/>' +
      '<path d="M50 78 L60 96 L70 78 Z" fill="' + c2 + '"/>' +
      '<rect x="38" y="100" width="44" height="7" rx="3.5" fill="' + c2 + '"/>' + sleeves(c) +
      (FEMALE ? '<path d="M30 114 Q60 121 90 114 L92 122 Q60 130 28 122 Z" fill="' + c2 + '"/>' +
        '<path d="M57 105 l-5 15 l6 -3 z M63 105 l5 15 l-6 -3 z" fill="' + c2 + '"/>' : '');
  },
  armor: function (c, c2) {
    return BODIES.robe(c, c2) + '<path d="M44 84 H76 L73 106 H47 Z" fill="#cfd8e0"/><path d="M47 92 H73 M48 99 H72" fill="none"/>';
  },
  apronRobe: function (c, c2) {
    return BODIES.robe(c, c2) + '<path d="M46 92 H74 L78 122 Q60 127 42 122 Z" fill="#f6ead4"/>';
  },
  tunic: function (c, c2) {
    return legs(c2) + '<path d="M40 80 Q60 72 80 80 L86 112 Q60 117 34 112 Z" fill="' + c + '"/>' +
      '<path d="M50 78 L60 94 L70 78 Z" fill="#f6ead4"/><rect x="38" y="98" width="44" height="5" rx="2.5" fill="#b77a45"/>' + sleeves(c);
  },
  shirt: function (c, c2) {
    return legs(c2) + '<path d="' + TORSO + '" fill="' + c + '"/><path d="M52 80 Q60 88 68 80" fill="none"/>' + sleeves(c);
  },
  suit: function (c, c2) {
    return legs(c) + '<path d="' + TORSO + '" fill="' + c + '"/><path d="M51 79 L60 99 L69 79 Z" fill="#fff"/>' +
      '<path d="M58 82 h4 l2 11 -4 5 -4 -5 z" fill="#e25a5a"/>' + sleeves(c);
  },
  apron: function (c, c2) {
    return BODIES.shirt(c, c2) + '<rect x="45" y="88" width="30" height="24" rx="4" fill="#fff6e6"/><path d="M52 100 h16" fill="none"/>';
  },
  coat: function (c, c2) {
    return legs(c2) + '<path d="' + TORSO + '" fill="#fbfdff"/><path d="M52 79 L60 94 L68 79 Z" fill="#8fc4ef"/>' +
      '<path d="M52 79 L57 112 M68 79 L63 112" fill="none"/>' + sleeves('#fbfdff');
  },
  worksuit: function (c, c2) {
    return BODIES.shirt(c, c2) + '<rect class="ns" x="38" y="96" width="44" height="5" fill="#fff4a8"/>';
  },
  hoodie: function (c, c2) {
    return legs(c2) + '<path d="' + TORSO + '" fill="' + c + '"/><path d="M44 80 Q60 92 76 80" fill="none"/>' +
      '<path d="M48 100 h24 l-3 10 h-18 z" fill="rgba(0,0,0,.15)"/>' + sleeves(c);
  },
  future: function (c, acc) {
    return legs(c) + '<path d="' + TORSO + '" fill="' + c + '"/>' +
      '<rect class="ns" x="57" y="82" width="6" height="30" fill="' + acc + '"/>' +
      '<rect x="37" y="102" width="46" height="5" fill="' + acc + '"/>';
  }
};
var WIDE = { robe: 1, armor: 1, apronRobe: 1 };

/* ---------- 手持道具：原点 = 右手中心 ---------- */
var PROPS = {
  ruyi: '<g transform="rotate(20)"><rect x="-2.5" y="-30" width="5" height="32" rx="2.5" fill="#6fbf7f"/><circle cx="0" cy="-35" r="7" fill="#8fd49c"/></g>',
  sword: '<g transform="rotate(20)"><path d="M-3 -6 L-3 -38 L0 -45 L3 -38 L3 -6 Z" fill="#eef3f7"/><rect x="-8" y="-9" width="16" height="4" rx="2" fill="#ffd34a"/><rect x="-2.5" y="-5" width="5" height="8" rx="2" fill="#8a5a3a"/></g>',
  laser: '<g transform="rotate(20)"><rect class="ns" x="-5" y="-48" width="10" height="42" rx="5" fill="#7ff3ff" opacity=".45"/><rect x="-2.5" y="-46" width="5" height="40" rx="2.5" fill="#dffcff"/><rect x="-4" y="-7" width="8" height="10" rx="2" fill="#555"/></g>',
  dagger: '<g transform="rotate(25)"><rect class="ns" x="-4" y="-30" width="8" height="24" rx="4" fill="#ff5a7a" opacity=".45"/><rect x="-2" y="-28" width="4" height="22" rx="2" fill="#ffd6de"/><rect x="-3.5" y="-7" width="7" height="9" rx="2" fill="#444"/></g>',
  brush: '<g transform="rotate(25)"><rect x="-2" y="-30" width="4" height="32" rx="2" fill="#a86a3a"/><path d="M-4 -30 Q0 -46 4 -30 Z" fill="' + INK + '"/></g>',
  abacus: '<g transform="translate(-6,-28)"><rect width="28" height="22" rx="3" fill="#c0824a"/><path d="M4 11 H24" fill="none"/>' +
    '<circle cx="8" cy="6" r="2.6" fill="#ffe7a8"/><circle cx="14" cy="6" r="2.6" fill="#ffe7a8"/><circle cx="20" cy="6" r="2.6" fill="#ffe7a8"/>' +
    '<circle cx="8" cy="16" r="2.6" fill="#ffe7a8"/><circle cx="14" cy="16" r="2.6" fill="#ffe7a8"/><circle cx="20" cy="16" r="2.6" fill="#ffe7a8"/></g>',
  hoe: '<g transform="rotate(15)"><rect x="-2.5" y="-40" width="5" height="46" rx="2.5" fill="#c0824a"/><path d="M-2 -40 h15 v8 a4 4 0 0 1 -4 4 h-11 z" fill="#b8c2cc"/></g>',
  wheat: '<g transform="rotate(12)"><rect x="-1.5" y="-38" width="3" height="40" rx="1.5" fill="#d9a84a"/>' +
    '<ellipse cx="-4" cy="-30" rx="3" ry="5" fill="#f3c85a"/><ellipse cx="4" cy="-34" rx="3" ry="5" fill="#f3c85a"/><ellipse cx="-4" cy="-40" rx="3" ry="5" fill="#f3c85a"/><ellipse cx="3" cy="-44" rx="3" ry="5" fill="#f3c85a"/></g>',
  sprout: '<g transform="translate(0,-8)"><path d="M-9 -12 h18 l-3 14 h-12 z" fill="#c9d3e6"/><rect x="-1.5" y="-26" width="3" height="14" fill="#5ab86a"/>' +
    '<ellipse cx="-6" cy="-26" rx="7" ry="4" fill="#7fd48a"/><ellipse cx="6" cy="-30" rx="7" ry="4" fill="#7fd48a"/></g>',
  hammer: '<g transform="rotate(20)"><rect x="-2.5" y="-30" width="5" height="34" rx="2.5" fill="#c0824a"/><rect x="-11" y="-39" width="22" height="11" rx="3" fill="#9aa6b2"/></g>',
  wrench: '<g transform="rotate(20)"><rect x="-3" y="-28" width="6" height="32" rx="3" fill="#9aa6b2"/><circle cx="0" cy="-32" r="8" fill="#9aa6b2"/><rect class="ns" x="-3" y="-42" width="6" height="10" fill="#e9f3fb"/></g>',
  wrenchF: '<g transform="rotate(20)"><rect x="-3" y="-28" width="6" height="32" rx="3" fill="#7ff3ff"/><circle cx="0" cy="-32" r="8" fill="#7ff3ff"/><rect class="ns" x="-3" y="-42" width="6" height="10" fill="#eeeafc"/></g>',
  medbox: '<g transform="translate(-8,-24)"><rect x="8" y="-5" width="10" height="6" rx="2" fill="none"/><rect width="26" height="20" rx="3" fill="#fff"/>' +
    '<rect class="ns" x="11" y="4" width="4" height="12" fill="#e25a5a"/><rect class="ns" x="7" y="8" width="12" height="4" fill="#e25a5a"/></g>',
  capsule: '<g transform="rotate(-30) translate(-5,-30)"><rect width="11" height="26" rx="5.5" fill="#fff"/><path d="M0 13 h11 v7.5 a5.5 5.5 0 0 1 -11 0 z" fill="#ff7a7a"/></g>',
  capsuleF: '<g transform="translate(-10,-34)"><rect class="ns" width="24" height="24" rx="6" fill="#7ff3ff" opacity=".35"/><rect x="5" y="9" width="14" height="6" rx="3" fill="#ff7a9a"/><rect x="9" y="5" width="6" height="14" rx="3" fill="#ff7a9a"/></g>',
  fan: '<path d="M0 0 L-17 -27 A32 32 0 0 1 17 -27 Z" fill="#fff3c4"/><path d="M0 0 L-8 -31 M0 0 L0 -32 M0 0 L8 -31" fill="none"/><circle class="ns" cx="-4" cy="-22" r="3" fill="#ff8fb0"/>',
  mic: '<rect x="-2.5" y="-22" width="5" height="24" rx="2" fill="#555"/><circle cx="0" cy="-27" r="7.5" fill="#b8c2cc"/>',
  micF: '<rect x="-2.5" y="-22" width="5" height="24" rx="2" fill="#555"/><circle class="ns" cx="0" cy="-27" r="11" fill="#ff7af0" opacity=".35"/><circle cx="0" cy="-27" r="7.5" fill="#ffc2f5"/>',
  phone: '<rect x="-6" y="-26" width="14" height="24" rx="3" fill="#3a3a4a"/><rect class="ns" x="-3.5" y="-22" width="9" height="15" rx="1.5" fill="#8fd4ff"/>',
  thermos: '<rect x="-7" y="-26" width="14" height="26" rx="4" fill="#d85a5a"/><rect x="-8" y="-31" width="16" height="7" rx="2" fill="#555"/>',
  laptop: '<g transform="translate(-16,-26)"><rect width="26" height="18" rx="2" fill="#c9d3dc"/><rect class="ns" x="3" y="3" width="20" height="12" rx="1" fill="#8fd4ff"/><rect x="-3" y="18" width="32" height="4" rx="2" fill="#9aa6b2"/></g>',
  holo: '<g transform="translate(-14,-32)"><rect width="26" height="20" rx="3" fill="#7ff3ff" opacity=".55"/><path d="M5 7 h16 M5 13 h10" fill="none"/></g>',
  coin: '<circle cx="2" cy="-22" r="12" fill="#ffd34a"/><text x="2" y="-17" text-anchor="middle" font-size="13" font-weight="700" fill="#a86a1a">¥</text>',
  gourd: '<g transform="translate(4,-4)"><circle cx="0" cy="-19" r="6" fill="#e0664a"/><circle cx="0" cy="-5" r="9" fill="#e0664a"/><rect x="-5" y="-14" width="10" height="3" fill="#ffd34a"/></g>',
  skate: '<g transform="rotate(12)"><rect x="-5" y="-42" width="10" height="44" rx="5" fill="#ff8a5a"/><circle cx="-7" cy="-35" r="2.6" fill="#444"/><circle cx="7" cy="-35" r="2.6" fill="#444"/></g>'
};

/* ---------- 组装 ---------- */
function eye(x, f) {
  var d = x < 60 ? -1 : 1;
  return '<ellipse class="ns" cx="' + x + '" cy="57" rx="' + (f ? 4.8 : 4.3) + '" ry="' + (f ? 6.1 : 5.4) + '" fill="' + INK + '"/>' +
    '<circle class="ns" cx="' + (x + 1.5) + '" cy="54.4" r="' + (f ? 2.1 : 1.8) + '" fill="#fff"/>' +
    '<circle class="ns" cx="' + (x - 1.6) + '" cy="59.8" r="0.9" fill="#fff"/>' +
    (f ? '<path d="M' + (x + d * 4.2) + ' 53.4 l' + (d * 3) + ' -1.6 M' + (x + d * 3) + ' 51.6 l' + (d * 2) + ' -2.6" fill="none" style="stroke:' + INK + ';stroke-width:1.6"/>' : '');
}
function blush(x, f) {
  return '<ellipse class="ns" cx="' + x + '" cy="65" rx="5.5" ry="3.4" fill="#ff8fa3" opacity="' + (f ? .75 : .4) + '"/>' +
    (f ? '<path d="M' + (x - 3) + ' 66 l1.6 -2.6 M' + x + ' 66 l1.6 -2.6 M' + (x + 3) + ' 66 l1.6 -2.6" fill="none" style="stroke:#ff6f8a;stroke-width:1"/>' : '');
}
function brows(f, c) {
  return f
    ? '<path d="M43 49.5 Q47.5 46.5 52 48.8 M68 48.8 Q72.5 46.5 77 49.5" fill="none" style="stroke:' + c + ';stroke-width:1.6"/>'
    : '<path d="M42 49.6 L53 48.4 M67 48.4 L78 49.6" fill="none" style="stroke:' + c + ';stroke-width:3.2"/>';
}
function face(f) {
  return eye(48, f) + eye(72, f) + blush(40, f) + blush(80, f) +
    '<path d="M55 64.5 q2.5 3 5 0 q2.5 3 5 0" fill="none" style="stroke-width:1.8' + (f ? ';stroke:#d0506a' : '') + '"/>';
}
var FACC = {
  flower: '<circle class="ns" cx="85" cy="36" r="4.2" fill="#ff8fb0"/><circle class="ns" cx="80" cy="33" r="3.2" fill="#ffc2d4"/><circle class="ns" cx="85" cy="36" r="1.6" fill="#ffd34a"/>',
  bow: '<path d="M82 30 l-9 -5 v10 z M82 30 l9 -5 v10 z" fill="#ff7a9a"/><circle cx="82" cy="30" r="2.6" fill="#ff5a82"/>'
};
function sparkle(x, y, r, c) {
  return '<path class="ns" d="M' + x + ' ' + (y - r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) +
    ' Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + ' Z" fill="' + c + '"/>';
}

function figure(s) {
  var hat = typeof s.hat === 'string' ? HATS[s.hat] : s.hat;
  var body = BODIES[s.body](s.c, s.c2);
  var feet = '<ellipse cx="50" cy="126" rx="8" ry="4.5" fill="#5a3a2e"/><ellipse cx="70" cy="126" rx="8" ry="4.5" fill="#5a3a2e"/>';
  var style = WIDE[s.body] ? 'wide' : 'narrow';
  var ac = s.body === 'coat' ? '#fbfdff' : s.c;
  var hy = style === 'wide' ? 114 : 107, hx = style === 'wide' ? 26 : 28;
  var hair = HAIRS[s.hair || 'bangs'](s.hc || HAIR);
  return '<svg class="deer-fig" viewBox="0 0 120 140">' +
    '<circle class="ns" cx="60" cy="74" r="54" fill="' + s.tint + '" opacity=".28"/>' +
    sparkle(16, 30, 6, '#ffd34a') + sparkle(106, 58, 4.5, '#fff') + sparkle(12, 92, 3.5, '#fff') +
    (hair.back || '') + (hat.back || '') +
    '<g transform="translate(60,78) scale(.84) translate(-60,-78)">' + feet +
    arm(style, ac) + arm(style, ac, true) + body +
    '<g transform="translate(' + (120 - hx) + ',' + hy + ')">' + PROPS[s.prop] + '</g>' +
    '<circle cx="' + hx + '" cy="' + hy + '" r="6" fill="' + SKIN + '"/><circle cx="' + (120 - hx) + '" cy="' + hy + '" r="6" fill="' + SKIN + '"/>' +
    '</g>' +
    '<circle cx="60" cy="52" r="27" fill="' + SKIN + '"/>' + face(FEMALE) +
    (hair.front || '') + (hat.front || '') + brows(FEMALE, s.hc || HAIR) +
    (s.acc && !(FEMALE && s.acc === 'mustache') ? ACC[s.acc] : '') + (s.facc ? FACC[s.facc] : '') +
    '</svg>';
}

var ERAS = ['古代', '现代', '近未来'];
var CATS = [
  { name: '权贵', rows: [
    { who: '国君 / 公主', body: 'robe', c: '#f4c34a', c2: '#e25a5a', hat: 'crown', prop: 'ruyi', tint: '#f4c34a' },
    { who: '老板 / 董事长', body: 'suit', c: '#34405e', hair: 'slick', hat: 'none', prop: 'thermos', tint: '#5a7ab8' },
    { who: '星舰舰长', body: 'future', c: '#f1f4fb', c2: '#b07aff', hat: futureHelm('#b07aff', 'crown'), hair: 'none', prop: 'holo', tint: '#b07aff' }
  ]},
  { name: '军武', rows: [
    { who: '将军 / 斥候', body: 'armor', c: '#d65a4a', c2: '#8a3a2e', hat: 'helmetA', hair: 'none', prop: 'sword', tint: '#d65a4a' },
    { who: '保安 / 民警', body: 'shirt', c: '#6f8fc0', c2: '#2e4468', hat: 'policeCap', prop: 'phone', tint: '#6f8fc0' },
    { who: '机甲驾驶员', body: 'future', c: '#e4f6f4', c2: '#3fd0c0', hat: futureHelm('#3fd0c0'), hair: 'none', prop: 'laser', tint: '#3fd0c0' }
  ]},
  { name: '文人', rows: [
    { who: '书生 / 史官', body: 'robe', c: '#a7d0ec', c2: '#f6ead4', hat: 'bun', prop: 'brush', tint: '#a7d0ec' },
    { who: '程序员 / 编辑', body: 'hoodie', c: '#9aa6b8', c2: '#4a5670', hair: 'messy', hat: 'none', acc: 'glasses', prop: 'laptop', tint: '#9aa6b8' },
    { who: 'AI 训练师', body: 'future', c: '#eef3fb', c2: '#5ab0ff', hat: futureHelm('#5ab0ff'), hair: 'none', prop: 'holo', tint: '#5ab0ff' }
  ]},
  { name: '商贾', rows: [
    { who: '盐商 / 掌柜', body: 'robe', c: '#e39a5a', c2: '#7a4a2a', hat: 'guapi', acc: 'mustache', prop: 'abacus', tint: '#e39a5a' },
    { who: '小卖部老板', body: 'apron', c: '#6fbf8a', c2: '#3a5a78', hat: 'cap', prop: 'phone', tint: '#6fbf8a' },
    { who: '星际倒爷', body: 'future', c: '#fff6e0', c2: '#ffb14a', hat: futureHelm('#ffb14a'), hair: 'none', prop: 'coin', tint: '#ffb14a' }
  ]},
  { name: '农桑', rows: [
    { who: '农夫 / 桑农', body: 'tunic', c: '#8fbf6a', c2: '#6a5a4a', hat: 'douli', prop: 'hoe', tint: '#8fbf6a' },
    { who: '种粮大户', body: 'shirt', c: '#e8a45a', c2: '#4a6a9a', hat: 'sunhat', prop: 'wheat', tint: '#e8c25a' },
    { who: '太空农场主', body: 'future', c: '#eefaf0', c2: '#5ad06a', hat: futureHelm('#5ad06a'), hair: 'none', prop: 'sprout', tint: '#5ad06a' }
  ]},
  { name: '工匠', rows: [
    { who: '木匠 / 铸剑师', body: 'apronRobe', c: '#9a7a5a', c2: '#5a4030', hat: 'headband', prop: 'hammer', tint: '#c0a07a' },
    { who: '工程师 / 师傅', body: 'worksuit', c: '#f08a4a', c2: '#3a4a6a', hat: 'hardhat', prop: 'wrench', tint: '#f0a04a' },
    { who: '机器人维修师', body: 'future', c: '#f3f0ff', c2: '#ff8a5a', hat: futureHelm('#ff8a5a'), hair: 'none', acc: 'goggles', prop: 'wrenchF', tint: '#ff8a5a' }
  ]},
  { name: '医者', rows: [
    { who: '郎中 / 采药人', body: 'robe', c: '#d6e8cc', c2: '#6f8f6a', hat: 'softcap', prop: 'medbox', tint: '#9fcf8a' },
    { who: '医生 / 护士', body: 'coat', c: '#fbfdff', c2: '#5a6a8a', hat: 'mirror', prop: 'capsule', tint: '#8fc4ef' },
    { who: '基因修复师', body: 'future', c: '#fdf0f6', c2: '#ff7a9a', hat: futureHelm('#ff7a9a'), hair: 'none', prop: 'capsuleF', tint: '#ff7a9a' }
  ]},
  { name: '演艺', rows: [
    { who: '乐师 / 舞姬', body: 'robe', c: '#f5a9bf', c2: '#fff3c4', hat: 'twinbuns', prop: 'fan', tint: '#f5a9bf' },
    { who: '歌手 / 主播', body: 'shirt', c: '#b07aff', c2: '#3a3a4a', hat: 'headphones', prop: 'mic', tint: '#b07aff' },
    { who: '虚拟偶像', body: 'future', c: '#fff0fd', c2: '#ff7af0', hat: futureHelm('#ff7af0'), hair: 'none', prop: 'micF', tint: '#ff7af0' }
  ]},
  { name: '江湖', rows: [
    { who: '侠客 / 剑士', body: 'robe', c: '#4d5a78', c2: '#e25a4a', hat: 'douliDark', prop: 'gourd', tint: '#6a7898' },
    { who: '街头滑手', body: 'hoodie', c: '#3f3f52', c2: '#6a7898', hat: 'beanie', acc: 'shades', prop: 'skate', tint: '#6a7898' },
    { who: '赛博浪人', body: 'future', c: '#2e3246', c2: '#ff5a7a', hat: futureHelm('#ff5a7a'), hair: 'none', acc: 'shades', prop: 'dagger', tint: '#ff5a7a' }
  ]}
];

/* 每格 { m: [发型, 发色, 帽子?], f: [发型, 发色, 帽子?, 发饰?] }，按 [古代, 现代, 近未来] */
var H = HAIR;
var GENDER_PLAN = [
  [{ m: ['bangs'], f: ['long'] },
   { m: ['swoop', '#5a3a2a'], f: ['bob', '#5a3a2a', null, 'bow'] },
   { m: ['swoop', '#8a6adf'], f: ['long', '#8a6adf'] }],
  [{ m: ['none'], f: ['ponytail'] },
   { m: ['swoop'], f: ['bob'] },
   { m: ['swoop', '#2e8a86'], f: ['twintail', '#2e8a86'] }],
  [{ m: ['bangs'], f: ['long', H, 'bun', 'flower'] },
   { m: ['fluffy', '#6a4030'], f: ['long', '#6a4030'] },
   { m: ['swoop', '#3a5a9a'], f: ['bob', '#3a5a9a', null, 'bow'] }],
  [{ m: ['swoop'], f: ['long', H, 'bun', 'flower'] },
   { m: ['swoop', '#7a4a2a'], f: ['ponytail', '#7a4a2a'] },
   { m: ['spiky', '#c07a2a'], f: ['ponytail', '#c07a2a'] }],
  [{ m: ['bangs'], f: ['twintail'] },
   { m: ['swoop', '#6a4030'], f: ['long', '#6a4030'] },
   { m: ['swoop', '#3a7a4a'], f: ['long', '#3a7a4a'] }],
  [{ m: ['spiky'], f: ['ponytail'] },
   { m: ['swoop'], f: ['ponytail'] },
   { m: ['swoop', '#c0503a'], f: ['bob', '#c0503a'] }],
  [{ m: ['swoop'], f: ['long', H, 'bun', 'flower'] },
   { m: ['swoop'], f: ['long'] },
   { m: ['swoop', '#d06a8a'], f: ['long', '#d06a8a'] }],
  [{ m: ['bangs', H, 'bun'], f: ['bangs', H, 'twinbuns'] },
   { m: ['swoop', '#6a3a8a'], f: ['long', '#6a3a8a'] },
   { m: ['swoop', '#ff7ac8'], f: ['twintail', '#ff7ac8'] }],
  [{ m: ['bangs'], f: ['ponytail'] },
   { m: ['swoop', '#2a2a3a'], f: ['long', '#2a2a3a'] },
   { m: ['spiky', '#e0506a'], f: ['ponytail', '#e0506a'] }]
];

function variant(s, p) {
  var v = {};
  for (var k in s) v[k] = s[k];
  v.hair = p[0]; v.hc = p[1] || HAIR;
  if (p[2]) v.hat = p[2];
  v.facc = p[3] || null;
  return v;
}


/* ---------- 岗位 → 门类（按顺序匹配，先中先得） ---------- */
var CAT_INDEX = {};
CATS.forEach(function (c, i) { CAT_INDEX[c.name] = i; });
var RULES = [
  ['医者', /医|药|郎中|稳婆|接生|针灸|炼丹|仵作|护士|护理|疗|诊|正骨|心理|健康管理/],
  ['演艺', /乐|舞|优人|伶|歌|戏|说书|杂技|杂剧|宫调|皮影|傀儡|幻术|魔术|艺人|班头|琴|笛|鼓|唱曲|力士|相扑|角抵|斗鸡|催场|道具|主播|演员|偶像|博主|模特|摄影|画师|画工|画瓷|DJ|UP主|播音|主持|摄像|拍摄|剪辑|化妆|美甲|选秀|校草|校花|照相|冲印|陪玩|陪练|装扮|网红|大V|coser|NPC|场务|放映/],
  ['江湖', /侠|剑士|刺客|盗|贼|赘婿|浪人|丐|赌|骗|隐士|游侠|镖|闲散|常客|孩子|漂$|月光|斜杠|青年|失败/],
  ['军武', /兵|卒|将军|守将|军|校尉|斥候|弩|弓|箭|戈|矛|甲匠|御者|车右|哨|侍卫|捕快|巡捕|衙役|警|保安|武|怯薛|部曲|锦衣卫|漕丁/],
  ['商贾', /商|贩|掌柜|牙人|账房|店|铺|贾|摊主|跑堂|货郎|买办|管事|销售|客服|快递|外卖|收银|代购|电商|酒保|伙计|柜坊|管家|门房|乳母|奶妈|婢|奴|驱口|宫女|侍女|太监|售货|售票|前台|服务员|导购|理货|促销|中介|保险|业务员|跟单|报关|货代|个体户|万元户|企业家|职员|柜员|白领|推销|团购|礼仪|物业|保洁|家政|月嫂|收废品|调酒|招待|话务|接线|咖啡|面包|甜品|花艺|民宿|卖家|选品|带货/],
  ['权贵', /皇|帝|王|君|后$|妃|公主|格格|贝勒|太子|皇子|公子|侯|卿|丞相|宰|大夫|县令|令尹|尹$|吏|使$|使臣|长$|太守|刺史|知府|知县|知州|通判|尚书|御史|首辅|总督|都督|巡抚|驸马|外戚|世家|门阀|士族|贵族|勋贵|八旗|豪强|地主|员外|质子|执事|总管|达鲁花赤|大汗|采邑|啬夫|中常侍|老板|董事|总裁|CEO|经理|总监|主任|官|高管|投资|富二代|拆二代|创始人|合伙人/],
  ['文人', /书|塾|先生|师爷|编辑|记者|作家|话本|诗|文|学|教|讲|程序|码农|设计|研究|翻译|卜|巫|祝|道士|女冠|知客|僧|尼|喇嘛|经师|经生|抄|幕僚|门客|士人|名士|方士|相士|游士|说客|进士|举子|举人|秀才|状元|考生|礼生|地图|天象|史|老师|辅导|版主|写手|干部|公务员|计生|观测|气象|代做|新生|考研|集邮|博客|小说|播客|运营|策划|专员|助理|分析|审核|编剧|实习/],
  ['农桑', /农|桑|田|牧|渔|樵|猎|茶|果|菜|种|养|园|盐|灶户|站户|番户|佃|庶民|平民|小民|贱民|流民|刑徒|香客|客户|宠物|救助|动物/],
  ['工匠', /匠|工|夯|铸|冶|织|染|陶|瓦|窑|木|石|漆|绣|裁|修|机|电|焊|司机|车夫|船|驿|纤|挑夫|脚夫|民夫|伙夫|厨|屠|轿夫|马夫|骆驼|酿|技师|师傅|质检|化验|保管|分拣|邮递|送货|三轮|列车|乘务|站务|停车|门禁|仓库|网管|技术员|刻录|厂妹|厂弟|更夫|旗丁|管理员|运维|调度|打版|收纳|协管|网格|防损|志愿|引导|中控/]
];
var FALLBACK = ['文人', '商贾', '工匠', '演艺', '农桑'];

function hashStr(s) {
  var h = 2166136261;
  s = String(s || '');
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function classify(title) {
  var t = String(title || '');
  for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(t)) return CAT_INDEX[RULES[i][0]];
  return -1;
}
function eraIndex(dyn) {
  var d = String(dyn || '');
  if (/未来/.test(d)) return 2;
  if (/年代|千禧|当代|现代/.test(d)) return 1;
  return 0;
}

window.DEER_FIGURE = {
  CATS: CATS,
  ERAS: ERAS,
  classify: classify,
  render: function (ci, ei, g) {
    FEMALE = g === 'f';
    var out = figure(variant(CATS[ci].rows[ei], GENDER_PLAN[ci][ei][FEMALE ? 'f' : 'm']));
    FEMALE = false;
    return out;
  },
  svg: function (title, dyn, gender, seed) {
    var h = hashStr((seed || '') + '|' + title);
    var ci = classify(title);
    if (ci < 0) ci = CAT_INDEX[FALLBACK[h % FALLBACK.length]];
    var g = gender === 'f' || gender === 'm' ? gender : ((h >>> 3) % 2 ? 'f' : 'm');
    return this.render(ci, eraIndex(dyn), g);
  },
  /* 独立 SVG（自带样式），供 canvas drawImage 使用 */
  dataUrl: function (title, dyn, gender, seed, width) {
    var w = width || 240, hgt = Math.round(w * 140 / 120);
    var css = '<style>path,circle,rect,ellipse{stroke:#6b4a3e;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.ns{stroke:none}</style>';
    var s = this.svg(title, dyn, gender, seed).replace('<svg class="deer-fig" viewBox="0 0 120 140">',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width="' + w + '" height="' + hgt + '">' + css);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
};
})();
