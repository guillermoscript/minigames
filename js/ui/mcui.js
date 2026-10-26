'use strict';
/* MCUI: the MiniCaos menu kit (docs/ui/01-menu-redesign.md). One look for every menu in every world: 16-bit plates with bitten
   corners, Press Start 2P, 4 px ink outlines, dithered backgrounds, a moving focus frame, the same back button in the same place.

   ES5 on purpose (var, function, no ?. ?? spread or async) so the LA FIESTA pages (docs/style-lab/fiesta-*.js) can load it too.
   Immediate mode, like button() in js/main.js: every frame the screen calls begin(), draws its widgets (each one registers its
   rectangle and id), then end(). Focus, taps, scrolling, keys and the gamepad all work from that list.

   Frame
     begin(ctx, view, key)   view = { w, h, ox, tall, t }: w×h is the layout area (800×600 wide, 400×H tall); fills span -ox..w+ox.
                             key names the screen: when it changes the old focus is remembered and the new screen's is restored.
     end()                   resolves focus, draws the focus frame and the toast
   Host input (return true when the kit used the event)
     down(p) move(p) up(p)   p = { x, y, touch } in layout coordinates. A tap fires on release, so lists can be dragged.
     wheel(dy)  key(e)       key: arrows/WASD move, Enter/Space confirm, Esc/Backspace back, Q/E tabs. Gamepad maps onto these keys.
   Widgets
     btn(id,x,y,w,h,label,fn,o)  o = { tone, size, icon, key, off, prime, sub, align }
     card(id,x,y,w,h,o)          o = { color, art(cx,cy,t,focused), title, desc, foot, badges:[{text,tone,icon}], stamp, fn, off, prime }
     area(id,x,y,w,h,fn,o)       invisible tap target; o = { focus, prime } makes it focusable
     panel(x,y,w,h,o)  badge(x,y,text,tone,o)  header(title,o)  back(fn,label)  player(id,x,y,w,h,o,fn)
     tile(id,x,y,w,h,fill,draw(dy,focused),fn,o)  tabBar(id,x,y,w,h,labels,sel,fn)  pager(id,cx,y,page,pages,fn)  setBack(fn)  onEdge(fn)
     keybar(list)  toast(text,tone)  dialog(o)  loading(text,k)  bg(theme)  wipe(k,color)
     text(s,x,y,size,col,align,maxW)  para(s,x,y,w,size,col,align,lh)  icon(name,x,y,unit,col)  plate(x,y,w,h,fill,o)
   Tests
     items() -> [{ id, x, y, w, h }]   client(id) -> { x, y } page pixels of the centre   press(id)                             */
var MCUI = (function () {
  var INKC = '#14101c';
  var FONT = '"Press Start 2P", "Courier New", monospace';
  var TONE = {
    paper: '#fffdf2', gold: '#FFE14D', go: '#5CFF7A', info: '#4DB8FF', lilac: '#B49CFF', bad: '#FF4D4D', off: '#8f8b9c',
    night: '#2b2757', night2: '#322d66', panel: '#252c4b', panelDk: '#171c34'
  };
  var WORLD = { classic: '#4DB8FF', venezuela: '#FFE14D', fiesta: '#FF4D9E', margarita: '#3DDC97' };
  var THEME = {
    menu: ['#2b2757', '#322d66'], title: ['#6a3de8', '#7C4DFF'], classic: ['#1f3a66', '#24467a'],
    venezuela: ['#3a2a5a', '#46336b'], fiesta: ['#4a1f4f', '#58265e'], margarita: ['#0d3b4a', '#114a5c']
  };

  var X = null, V = { w: 800, h: 600, ox: 0, tall: false, t: 0 };
  var list = [], focusId = null, focusVis = false, inputMode = 'touch', screen = '', memory = {}, enteredAt = 0;
  var backFn = null, tabFn = null, edgeFn = null, region = null, scrolls = {}, modal = false;
  var ptr = { x: -999, y: -999, down: false, sx: 0, sy: 0, moved: false, id: null, scroll: null, s0: 0 };
  var toastS = null, sounds = {}, pad = { held: {}, at: {} };

  /* ───────────── helpers ───────────── */
  function tr(s) { return typeof t === 'function' ? t(String(s)) : String(s); }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  var MIXC = {};
  function mix(a, b, k) {
    var key = a + b + k; if (MIXC[key]) return MIXC[key];
    var A = hex(a), B = hex(b), s = '#';
    for (var i = 0; i < 3; i++) { var v = Math.round(A[i] + (B[i] - A[i]) * k).toString(16); s += v.length < 2 ? '0' + v : v; }
    return (MIXC[key] = s);
  }
  function tone(c) { return TONE[c] || c || TONE.paper; }
  function lum(c) { var A = hex(c); return (0.299 * A[0] + 0.587 * A[1] + 0.114 * A[2]) / 255; }
  function snap(v) { return Math.round(v); }
  function play(name) { if (sounds[name]) try { sounds[name](); } catch (e) {} }
  function find(id, arr) { arr = arr || list; for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function inside(it, p) {
    if (p.x < it.x || p.x > it.x + it.w || p.y < it.y || p.y > it.y + it.h) return false;
    var r = it.clip; return !r || (p.y >= r.y && p.y <= r.y + r.h);
  }
  function hit(p) { for (var i = list.length - 1; i >= 0; i--) if (!list[i].off && inside(list[i], p)) return list[i]; return null; }
  function add(it) { it.clip = region ? region.rect : null; it.sc = region ? region.sc : null; list.push(it); return it; }
  function rect(x, y, w, h, c) { X.fillStyle = c; X.fillRect(snap(x), snap(y), snap(w), snap(h)); }
  /* the 16-bit box: a rectangle with an n×n square bitten out of each corner */
  function notch(x, y, w, h, n, c) { x = snap(x); y = snap(y); w = snap(w); h = snap(h); X.fillStyle = c; X.fillRect(x + n, y, w - 2 * n, h); X.fillRect(x, y + n, w, h - 2 * n); }

  /* ───────────── text ───────────── */
  function font(size) { X.font = size + 'px ' + FONT; }
  function width(s, size) { font(size); return X.measureText(s).width; }
  /* Press Start 2P draws accented capitals at lowercase height, so they are drawn as the plain capital plus a pixel mark above it
     (rows -3..-2 of the 8×8 cell, one empty row over the letter). */
  var ACC = { 'Á': ['A', 'acute'], 'É': ['E', 'acute'], 'Í': ['I', 'acute'], 'Ó': ['O', 'acute'], 'Ú': ['U', 'acute'], 'Ü': ['U', 'dots'], 'Ñ': ['N', 'tilde'] };
  var MARK = { acute: [[4, -3], [3, -2]], dots: [[2, -2], [5, -2]], tilde: [[2, -3], [3, -3], [6, -3], [1, -2], [4, -2], [5, -2]] };
  function marks(s, x, y, size, col, align, mw) {
    var full = X.measureText(s).width, k = mw ? mw / full : 1, cw = X.measureText('M').width * k, u = size / 8 * (mw ? Math.min(1, k) : 1);
    var x0 = align === 'left' ? x : align === 'right' ? x - full * k : x - full * k / 2, top = y - size / 2;
    X.fillStyle = col;
    for (var i = 0; i < s.length; i++) {
      var a = ACC[s.charAt(i)]; if (!a) continue;
      var m = MARK[a[1]]; for (var j = 0; j < m.length; j++) X.fillRect(snap(x0 + i * cw + m[j][0] * u), snap(top + m[j][1] * u), Math.ceil(u), Math.ceil(u));
    }
  }
  function plain(s) { return s.replace(/[ÁÉÍÓÚÜÑ]/g, function (c) { return ACC[c][0]; }); }
  /* one line; a light colour gets a hard ink drop shadow (2 px, 4 px from size 32), dark text none */
  function text(s, x, y, size, col, align, maxW) {
    s = tr(s); col = col || '#fff'; size = size || 16; align = align || 'center';
    while (maxW && size > 8 && width(s, size) > maxW) size -= 8;
    font(size); X.textAlign = align; X.textBaseline = 'middle';
    var yy = snap(y + size * 0.06), mw = maxW && width(s, size) > maxW ? maxW : undefined, p = plain(s), acc = p !== s;
    if (col !== INKC && lum(col) > 0.25) {
      var d = size >= 32 ? 4 : 2; X.fillStyle = INKC; X.fillText(p, snap(x) + d, yy + d, mw);
      if (acc) marks(s, snap(x) + d, yy + d, size, INKC, align, mw);
    }
    X.fillStyle = col; X.fillText(p, snap(x), yy, mw);
    if (acc) marks(s, snap(x), yy, size, col, align, mw);
    return size;
  }
  /* greedy word wrap into lines that fit w */
  function wrap(s, w, size) {
    var words = tr(s).split(' '), out = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var tryL = line ? line + ' ' + words[i] : words[i];
      if (line && width(tryL, size) > w) { out.push(line); line = words[i]; } else line = tryL;
    }
    if (line) out.push(line);
    return out;
  }
  function para(s, x, y, w, size, col, align, lh) {
    size = size || 16; lh = lh || Math.round(size * 1.5);
    var lines = wrap(s, w, size), ax = align === 'left' ? x : align === 'right' ? x + w : x + w / 2;
    for (var i = 0; i < lines.length; i++) text(lines[i], ax, y + i * lh, size, col, align || 'center', w);
    return lines.length * lh;
  }
  /* a label inside a box: one line, else two lines, else a smaller size */
  function label(s, cx, cy, w, h, size, col, align, lx) {
    s = tr(s);
    for (var sz = size; sz >= 8; sz -= 8) {
      if (width(s, sz) <= w) { text(s, align === 'left' ? lx : cx, cy, sz, col, align, w); return; }
      var lines = wrap(s, w, sz);
      if (lines.length === 2 && sz * 2.6 <= h && width(lines[0], sz) <= w && width(lines[1], sz) <= w) {
        var gap = Math.round(sz * 0.7);
        text(lines[0], align === 'left' ? lx : cx, cy - gap, sz, col, align, w);
        text(lines[1], align === 'left' ? lx : cx, cy + gap, sz, col, align, w); return;
      }
    }
    text(s, align === 'left' ? lx : cx, cy, 8, col, align, w);
  }

  /* ───────────── pixel icons (rows of a bitmap, '1' = ink colour) ───────────── */
  var ICON = {
    left: ['00011', '00111', '01111', '11111', '01111', '00111', '00011'],
    right: ['11000', '11100', '11110', '11111', '11110', '11100', '11000'],
    star: ['0001000', '0011100', '1111111', '0111110', '0011100', '0110110', '1100011'],
    person: ['01110', '01110', '01110', '00100', '11111', '11111', '01010', '01010'],
    note: ['000111', '001101', '001001', '001001', '011001', '111011', '110011'],
    mute: ['0001000', '0011001', '1111010', '1111100', '1111010', '0011001', '0001000'],
    globe: ['0011100', '0101010', '1111111', '1010101', '1111111', '0101010', '0011100'],
    lock: ['01110', '10001', '10001', '11111', '11011', '11011', '11111'],
    gear: ['0101010', '1111111', '0110110', '1100011', '0110110', '1111111', '0101010'],
    cup: ['1111111', '1011101', '0111110', '0011100', '0001000', '0011100', '0111110'],
    friends: ['0110000110', '0110000110', '0000000000', '1111001111', '1111001111', '1111001111'],
    play: ['1000', '1100', '1110', '1111', '1110', '1100', '1000'],
    check: ['0000001', '0000011', '1000110', '1101100', '0111000', '0010000'],
    share: ['0001100', '0011110', '0101101', '0001100', '0001100', '1101011', '1111111'],
    wifi: ['0111110', '1000001', '0011100', '0100010', '0001000', '0001000'],
    nowifi: ['1000001', '0100010', '0010100', '0001000', '0010100', '0100010', '1000001']
  };
  function icon(name, x, y, u, col) {
    var rows = ICON[name]; if (!rows) return 0;
    var w = rows[0].length, h = rows.length, x0 = snap(x - w * u / 2), y0 = snap(y - h * u / 2);
    X.fillStyle = col || '#fff';
    for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) if (rows[r].charAt(c) === '1') X.fillRect(x0 + c * u, y0 + r * u, u, u);
    return w * u;
  }
  /* icon with a 1-unit ink outline (light icons on light faces) */
  function iconInk(name, x, y, u, col) {
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) if (dx || dy) icon(name, x + dx * u, y + dy * u, u, INKC);
    return icon(name, x, y, u, col);
  }

  /* ───────────── plates ───────────── */
  /* chunky plate: ink base `depth` px lower, ink outline o, face, 2 px light top and 4 px shade bottom. Returns the face's y offset. */
  function plate(x, y, w, h, fill, o) {
    o = o || {}; var ol = o.o == null ? 4 : o.o, depth = o.depth == null ? 6 : o.depth;
    var dy = o.pressed ? depth - 2 : o.hover ? -2 : 0;
    if (depth) notch(x - ol, y - ol + depth, w + 2 * ol, h + 2 * ol, ol, INKC);
    notch(x - ol, y - ol + dy, w + 2 * ol, h + 2 * ol, ol, INKC);
    notch(x, y + dy, w, h, 0, fill);
    rect(x, y + dy, w, 2, mix(fill, '#ffffff', 0.45));
    rect(x, y + dy + h - 4, w, 4, mix(fill, INKC, 0.28));
    return dy;
  }
  function state(id) {
    var hv = ptr.id === id && ptr.down && !ptr.moved, f = focusId === id;
    return { pressed: hv, hover: !hv && (f && (focusVis || inputMode === 'mouse')), focus: f };
  }
  function keycap(s, x, y) {
    var w = Math.max(24, width(s, 8) + 10);
    notch(x - 2, y - 10, w + 4, 22, 2, INKC); rect(x, y - 8, w, 16, '#fffdf2'); rect(x, y + 4, w, 4, '#d9d4c3');
    text(s, x + w / 2, y, 8, INKC); return w + 4;
  }
  function showKeys() { return inputMode === 'key' || inputMode === 'pad' || (inputMode === 'mouse' && !(typeof TOUCH !== 'undefined' && TOUCH)); }
  function padName(k) { return inputMode !== 'pad' ? k : ({ ESC: 'B', ENTER: 'A', 'Q/E': 'LB/RB', O: 'SELECT' })[k] || k; }

  function btn(id, x, y, w, h, lab, fn, o) {
    o = o || {}; var fill = o.off ? TONE.off : tone(o.tone), s = state(id);
    var dy = plate(x, y, w, h, fill, { pressed: s.pressed, hover: s.hover });
    var col = o.col || (lum(fill) > 0.5 ? INKC : '#fff'), size = o.size || 16, cx = x + w / 2, cy = y + h / 2 + dy;
    var left = x + 16, avail = w - 32;
    if (o.icon) {
      var iw = (ICON[o.icon] ? ICON[o.icon][0].length : 5) * 3;
      if (lab) { icon(o.icon, x + 16 + iw / 2, cy, 3, col); left = x + 24 + iw; avail = w - (24 + iw) - 16; cx = left + avail / 2; }
      else icon(o.icon, cx, cy, 3, col);
    }
    if (o.key && showKeys()) { var kw = width(padName(o.key), 8) + 14; keycap(padName(o.key), x + w - kw - 10, cy); avail -= kw + 6; if (!o.icon) cx = x + 16 + avail / 2; }
    if (lab) {
      if (o.sub) { label(lab, cx, cy - 10, avail, h / 2, size, col, o.align, left); text(o.sub, o.align === 'left' ? left : cx, cy + 14, 8, col === INKC ? '#4a4558' : '#ddd', o.align || 'center', avail); }
      else label(lab, cx, cy, avail, h - 8, size, col, o.align, left);
    }
    if (o.dot) { notch(x + w - 14, y - 10 + dy, 24, 24, 2, INKC); rect(x + w - 12, y - 8 + dy, 20, 20, TONE.bad); text(String(o.dot), x + w - 2, y + 2 + dy, 8, '#fff'); }
    return add({ id: id, x: x, y: y, w: w, h: h, fn: o.off ? o.offFn || null : fn, off: o.off && !o.offFn, prime: o.prime });
  }
  /* generic plate you draw on yourself: draw(dy) gets the face's press offset */
  function tile(id, x, y, w, h, fill, draw, fn, o) {
    o = o || {}; var s = state(id), dy = plate(x, y, w, h, fill, { pressed: s.pressed, hover: s.hover, o: o.o, depth: o.depth });
    if (draw) { X.save(); X.beginPath(); X.rect(x, y + dy, w, h); X.clip(); try { draw(dy, s.focus); } catch (e) {} X.restore(); }
    return add({ id: id, x: x, y: y, w: w, h: h, fn: o.off ? null : fn, off: !!o.off && !o.offFn, prime: o.prime });
  }
  /* tab bar: the active tab is gold and sits 4 px lower, joined to the content; Q/E (LB/RB) flip tabs */
  function tabBar(id, x, y, w, h, labels, sel, fn, icons) {
    var n = labels.length, gap = 8, tw = Math.floor((w - gap * (n - 1)) / n), fit = true;
    for (var j = 0; j < n; j++) if (width(tr(labels[j]), 16) > tw - 16) fit = false;   // one size for every tab: 16, or icon + 8 when a label is too long
    for (var i = 0; i < n; i++) {
      (function (i) {
        var on = i === sel, s = state(id + i), tx = x + i * (tw + gap), dy = plate(tx, y + (on ? 4 : 0), tw, h - 4, on ? TONE.gold : TONE.panel, { pressed: s.pressed, hover: s.hover && !on, depth: on ? 0 : 4 });
        var cy = y + (on ? 4 : 0) + dy + (h - 4) / 2, col = on ? INKC : '#fff';
        if (fit) label(labels[i], tx + tw / 2, cy, tw - 16, h - 8, 16, col);
        else { if (icons && icons[i]) icon(icons[i], tx + tw / 2, cy - 9, 2, col); text(labels[i], tx + tw / 2, icons ? cy + 11 : cy, 8, col, 'center', tw - 8); }
        add({ id: id + i, x: tx, y: y, w: tw, h: h, fn: on ? null : function () { fn(i); }, tab: true });
      })(i);
    }
    tabFn = function (d) { var k = (sel + d + n) % n; if (k !== sel) { play('tick'); fn(k); } };
  }
  /* pager: ◄ PAGE n/m ►, wraps around */
  var pageTurn = null;   // { prefix, dir }: after a page flip from the grid edge, focus the new page's first (or last) tile
  function pager(id, cx, y, page, pages, fn, prefix) {
    if (pages < 2) return;
    btn(id + '-prev', cx - 168, y, 64, 56, '', function () { fn((page + pages - 1) % pages); }, { icon: 'left', tone: 'gold' });
    btn(id + '-next', cx + 104, y, 64, 56, '', function () { fn((page + 1) % pages); }, { icon: 'right', tone: 'gold' });
    text(tr('PAGE {n}/{total}').replace('{n}', page + 1).replace('{total}', pages), cx, y + 28, 16, '#fff', 'center', 192);
    edgeFn = function (d) {
      if (prefix && String(focusId).indexOf(prefix) !== 0) return;   // only from the grid's own tiles
      play('tick'); fn((page + d + pages) % pages); pageTurn = { prefix: prefix, dir: d };
    };
  }
  function area(id, x, y, w, h, fn, o) { o = o || {}; return add({ id: id, x: x, y: y, w: w, h: h, fn: fn, nofocus: !o.focus, prime: o.prime }); }

  function panel(x, y, w, h, o) {
    o = o || {}; var fill = tone(o.tone || 'panel');
    notch(x - 4, y - 4 + 6, w + 8, h + 8, 4, 'rgba(20,16,28,.55)');
    notch(x - 4, y - 4, w + 8, h + 8, 4, INKC); rect(x, y, w, h, fill);
    rect(x, y, w, 2, mix(fill, '#ffffff', 0.18));
    if (o.band) { rect(x, y, w, 8, o.band); rect(x, y + 8, w, 2, mix(o.band, INKC, 0.35)); }
  }
  function badge(x, y, s, tn, o) {
    o = o || {}; var fill = tone(tn || 'paper'), col = lum(fill) > 0.5 ? INKC : '#fff', ic = o.icon ? (ICON[o.icon][0].length * 2 + 6) : 0;
    var w = snap(width(tr(s), 8) + 12 + ic), h = 20, x0 = o.align === 'right' ? x - w : x;
    notch(x0 - 2, y - 2, w + 4, h + 4, 2, INKC); rect(x0, y, w, h, fill);
    if (o.icon) icon(o.icon, x0 + 6 + ic / 2 - 3, y + h / 2, 2, col);
    text(s, x0 + ic + (w - ic) / 2, y + h / 2 + 1, 8, col);
    return w + 4;
  }
  function stamp(s, cx, cy, col) {
    X.save(); X.translate(snap(cx), snap(cy)); X.rotate(-0.12);
    var w = width(tr(s), 16) + 24;
    notch(-w / 2 - 4, -20, w + 8, 40, 4, INKC); rect(-w / 2, -16, w, 32, col || TONE.gold);
    text(s, 0, 1, 16, INKC); X.restore();
  }

  /* world card, horizontal: art on the left (the world's colour, dithered), text on the right. Same card at 800×600 and 400 tall. */
  function card(id, x, y, w, h, o) {
    var s = state(id), off = !!o.off, col = off ? TONE.off : (o.color || TONE.info);
    var dy = plate(x, y, w, h, off ? '#bdb9c9' : TONE.paper, { pressed: s.pressed, hover: s.hover });
    var aw = Math.min(136, Math.round(w * (V.tall ? 0.3 : 0.37))), yy = y + dy;
    rect(x, yy, aw, h, col); dither(x, yy, aw, h, mix(col, INKC, 0.14), 4);
    rect(x + aw, yy, 4, h, INKC);
    X.save(); X.beginPath(); X.rect(x, yy, aw, h); X.clip();
    var ak = aw / 136;   // art is drawn for a 136-wide panel; narrower panels (tall layout) scale it down
    X.translate(snap(x + aw / 2), snap(yy + h / 2)); X.scale(ak, ak);
    if (o.art) try { o.art(0, 0, V.t, s.focus && (focusVis || inputMode === 'mouse')); } catch (e) {}
    X.restore();
    var tx = x + aw + 16, tw = w - aw - 28;
    text(o.title, tx, yy + 26, 24, off ? '#6d6a80' : INKC, 'left', tw);
    var lh = 0; if (o.desc) lh = para(o.desc, tx, yy + 58, tw, 16, off ? '#6d6a80' : '#4a4558', 'left', 22);
    if (o.foot) { var fx = tx; if (o.footIcon) { iconInk(o.footIcon, tx + 7, yy + 64 + lh, 2, TONE.gold); fx += 20; } text(o.foot, fx, yy + 64 + lh, 16, off ? '#6d6a80' : '#c47a00', 'left', tw - 20); }
    var bx = tx;
    for (var i = 0; i < (o.badges || []).length; i++) { var b = o.badges[i]; bx += badge(bx, yy + h - 34, b.text, off ? 'off' : b.tone, { icon: b.icon }) + 6; }
    if (o.stamp) stamp(o.stamp, x + aw / 2, yy + h - 30, o.stampCol);
    return add({ id: id, x: x, y: y, w: w, h: h, fn: o.fn, prime: o.prime });
  }

  /* player badge: avatar (host-drawn) + name + tag */
  function player(id, x, y, w, h, o, fn) {
    var s = state(id), dy = plate(x, y, w, h, TONE.paper, { pressed: s.pressed, hover: s.hover, depth: 4 });
    if (o.avatar) try { o.avatar(x + h / 2 + 4, y + h - 8 + dy, h); } catch (e) {}
    if (V.tall && w < 100) return add({ id: id, x: x, y: y, w: w, h: h, fn: fn });
    label(o.name, 0, y + h / 2 + dy, w - h - 16, h - 8, 16, o.color && lum(o.color) < 0.75 ? o.color : INKC, 'left', x + h + 8);
    return fn ? add({ id: id, x: x, y: y, w: w, h: h, fn: fn }) : null;
  }

  /* ───────────── fixed chrome ───────────── */
  function back(fn, lab) {
    backFn = fn;
    if (V.tall) return btn('back', 16, 16, 56, 56, '', fn, { icon: 'left' });
    return btn('back', 16 - V.ox, 16, 136, 56, lab || 'GO BACK', fn, { icon: 'left' });
  }
  function header(title, o) {
    o = o || {};
    if (o.band) { rect(-V.ox, 0, V.w + 2 * V.ox, 88, o.band); dither(-V.ox, 0, V.w + 2 * V.ox, 88, mix(o.band, INKC, 0.12), 4); rect(-V.ox, 88, V.w + 2 * V.ox, 4, INKC); }
    var maxW = V.tall ? V.w - 2 * 80 : V.w - 2 * 176;
    if (V.tall) label(title, V.w / 2, 44, maxW, 72, 16, o.col || TONE.gold);   // narrow: two lines of 16 before going smaller
    else text(title, V.w / 2, 44, 32, o.col || TONE.gold, 'center', maxW);
    return V.tall ? 104 : 104;
  }
  function keybar(items) {
    if (!showKeys() || V.tall) return;
    var x = 24 - V.ox, y = V.h - 28;
    for (var i = 0; i < items.length; i++) {
      x += keycap(padName(items[i][0]), x, y) + 8;
      text(items[i][1], x, y, 8, '#fff', 'left'); x += width(tr(items[i][1]), 8) + 24;
    }
  }

  /* ───────────── background, wipe, toast, dialog, loading ───────────── */
  var PAT = {};
  function pattern(a, b) {
    var key = a + b; if (PAT[key]) return PAT[key];
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var g = c.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 32, 32); g.fillStyle = b;
    g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16);
    g.fillStyle = mix(b, '#ffffff', 0.06); g.fillRect(0, 0, 16, 2); g.fillRect(16, 16, 16, 2);
    return (PAT[key] = X.createPattern(c, 'repeat'));
  }
  function dither(x, y, w, h, c, step) {
    X.fillStyle = c; step = step || 4;
    for (var yy = 0; yy < h; yy += step * 2) for (var xx = ((yy / (step * 2)) & 1) * step; xx < w; xx += step * 2) X.fillRect(snap(x + xx), snap(y + yy), step, step);
  }
  function bg(theme) {
    var th = THEME[theme] || THEME.menu, off = Math.floor(V.t * 8) % 32;
    X.save(); X.fillStyle = pattern(th[0], th[1]); X.translate(off, off);
    X.fillRect(-V.ox - 32, -32, V.w + 2 * V.ox + 64, V.h + 64); X.restore();
    rect(-V.ox, V.h - 8, V.w + 2 * V.ox, 8, 'rgba(20,16,28,.35)');
  }
  /* screen-change curtain: k 0 → 1 slides the slanted ink sheet off to the right in 8 px steps */
  function wipe(k, col) {
    if (k >= 1) return;
    var reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    var e = 1 - Math.pow(1 - Math.max(0, k), 3), x0 = Math.floor((-V.ox + e * (V.w + 2 * V.ox + 160)) / 8) * 8, xr = V.w + V.ox + 200, H = V.h;
    for (var y = 0; y < H; y += 8) { var sx = x0 - Math.floor((y / H) * 160 / 8) * 8; rect(sx, y, xr - sx, 8, INKC); if (col) rect(sx - 8, y, 8, 8, col); }
  }
  function toast(s, tn) { toastS = { s: s, col: tone(tn || 'go'), t0: V.t }; }
  function drawToast() {
    if (!toastS) return; var age = V.t - toastS.t0; if (age > 2.6) { toastS = null; return; }
    var w = Math.min(V.w - 32, width(tr(toastS.s), 16) + 48), x = (V.w - w) / 2, step = Math.min(3, Math.floor(age / 0.05));
    var y = V.h - 72 + (3 - step) * 16;
    notch(x - 4, y - 4, w + 8, 48, 4, INKC); rect(x, y, w, 40, TONE.panelDk); rect(x, y, 6, 40, toastS.col);
    text(toastS.s, x + w / 2 + 3, y + 21, 16, toastS.col, 'center', w - 24);
  }
  /* modal: drops everything registered so far and keeps only its own buttons. buttons = [{ label, fn, tone }]; Esc = the last one */
  function dialog(o) {
    list = []; modal = true;
    rect(-V.ox, 0, V.w + 2 * V.ox, V.h, 'rgba(20,16,28,.8)');
    var w = V.tall ? V.w - 32 : 480, x = (V.w - w) / 2, bodyH = o.body ? wrap(o.body, w - 48, 16).length * 24 : 0, h = 152 + bodyH, y = Math.round((V.h - h) / 2);
    panel(x, y, w, h, { tone: 'night', band: o.band || TONE.gold });
    text(o.title, V.w / 2, y + 40, 16, TONE.gold, 'center', w - 32);
    if (o.body) para(o.body, x + 24, y + 72, w - 48, 16, '#fff', 'center', 24);
    var bs = o.buttons || [], bw = Math.floor((w - 48 - (bs.length - 1) * 16) / bs.length);
    for (var i = 0; i < bs.length; i++) btn('dlg' + i, x + 24 + i * (bw + 16), y + h - 84, bw, 64, bs[i].label, bs[i].fn, { tone: bs[i].tone || 'paper', prime: i === 0 });
    backFn = bs.length ? bs[bs.length - 1].fn : null;
  }
  function loading(s, k) {
    bg('menu');
    var w = Math.min(V.w - 64, 320), x = (V.w - w) / 2, y = V.h / 2 + 24, n = 10, seg = Math.floor(Math.max(0, Math.min(1, k)) * n);
    text(s, V.w / 2, V.h / 2 - 32, 16, '#fff', 'center', V.w - 32);
    notch(x - 4, y - 4, w + 8, 32, 4, INKC); rect(x, y, w, 24, TONE.panelDk);
    var sw = (w - 4 * (n + 1)) / n;
    for (var i = 0; i < n; i++) rect(x + 4 + i * (sw + 4), y + 4, sw, 16, i < seg ? TONE.gold : '#2c3659');
  }

  /* ───────────── scrolling (tall layouts) ───────────── */
  /* scrollStart(id, y0, y1, contentH) -> offset to add to every y inside; clip on until scrollEnd() */
  function scrollStart(id, y0, y1, contentH) {
    var sc = scrolls[id] || (scrolls[id] = { y: 0, max: 0 });
    sc.max = Math.max(0, contentH - (y1 - y0)); sc.y = Math.max(0, Math.min(sc.max, sc.y));
    region = { id: id, rect: { x: -V.ox, y: y0, w: V.w + 2 * V.ox, h: y1 - y0 }, sc: sc };
    X.save(); X.beginPath(); X.rect(-V.ox, y0, V.w + 2 * V.ox, y1 - y0); X.clip();
    return -Math.round(sc.y);
  }
  function scrollEnd() {
    if (!region) return; X.restore();
    var r = region.rect, sc = region.sc;
    if (sc.max > 0) { var bh = Math.max(24, r.h * r.h / (r.h + sc.max)), by = r.y + (r.h - bh) * (sc.y / sc.max); rect(V.w - 8, r.y, 4, r.h, 'rgba(20,16,28,.5)'); rect(V.w - 8, by, 4, bh, TONE.gold); }
    region = null;
  }

  /* ───────────── frame ───────────── */
  function begin(ctx, view, key) {
    X = ctx; V = view; list = []; backFn = null; tabFn = null; edgeFn = null; modal = false; region = null;
    if (key !== screen) { if (screen) memory[screen] = focusId; screen = key; focusId = memory[key] || null; enteredAt = V.t; ptr.id = null; }
    pollPad();
    if (X.imageSmoothingEnabled !== undefined) X.imageSmoothingEnabled = false;
  }
  function focusable(arr) { arr = arr || list; var out = []; for (var i = 0; i < arr.length; i++) if (!arr[i].nofocus && !arr[i].off) out.push(arr[i]); return out; }
  function end() {
    var f = focusable(), cur = find(focusId, f);
    if (pageTurn) {
      var tiles = []; for (var q = 0; q < f.length; q++) if (f[q].id.indexOf(pageTurn.prefix) === 0) tiles.push(f[q]);
      if (tiles.length) { cur = pageTurn.dir > 0 ? tiles[0] : tiles[tiles.length - 1]; focusId = cur.id; }
      pageTurn = null;
    }
    if (!cur && f.length) { cur = null; for (var i = 0; i < f.length; i++) if (f[i].prime) { cur = f[i]; break; } cur = cur || f[0]; focusId = cur.id; }
    if (cur && cur.clip) keepVisible(cur);
    if (cur && focusVis) {
      var x = cur.x - 10, y = cur.y - 10, w = cur.w + 20, h = cur.h + 20 + 2, ph = Math.floor(V.t / 0.15) % 2;
      X.save(); if (cur.clip) { X.beginPath(); X.rect(-V.ox, cur.clip.y - 12, V.w + 2 * V.ox, cur.clip.h + 24); X.clip(); }
      for (var s = 0; s < w; s += 8) { rect(x + s, y, 4, 4, (s / 8 + ph) % 2 ? TONE.gold : INKC); rect(x + s, y + h - 4, 4, 4, (s / 8 + ph + 1) % 2 ? TONE.gold : INKC); }
      for (var s2 = 0; s2 < h; s2 += 8) { rect(x, y + s2, 4, 4, (s2 / 8 + ph + 1) % 2 ? TONE.gold : INKC); rect(x + w - 4, y + s2, 4, 4, (s2 / 8 + ph) % 2 ? TONE.gold : INKC); }
      if (cur.x - 34 > -V.ox && !covered(cur, cur.x - 24, cur.y + cur.h / 2)) { var bob = Math.floor(V.t * 4) % 2 * 2; iconInk('right', cur.x - 24 - bob, cur.y + cur.h / 2, 3, TONE.gold); }
      X.restore();
    }
    drawToast();
  }
  function covered(cur, px, py) {
    for (var i = 0; i < list.length; i++) { var o = list[i]; if (o !== cur && !o.nofocus && px >= o.x - 12 && px <= o.x + o.w + 12 && py >= o.y && py <= o.y + o.h) return true; }
    return false;
  }
  function keepVisible(it) {
    var r = it.clip; if (!r || !it.sc) return;
    var top = it.y, bot = it.y + it.h;
    if (top < r.y + 12) it.sc.y = Math.max(0, it.sc.y - (r.y + 12 - top));
    else if (bot > r.y + r.h - 12) it.sc.y = Math.min(it.sc.max, it.sc.y + (bot - (r.y + r.h - 12)));
  }

  /* ───────────── focus movement ───────────── */
  function move(dir) {
    var f = focusable(), cur = find(focusId, f); if (!cur) { if (f.length) focusId = f[0].id; return; }
    var cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2, best = null, bestS = 1e9;
    for (var i = 0; i < f.length; i++) {
      var c = f[i]; if (c === cur) continue;
      var ox = c.x + c.w / 2, oy = c.y + c.h / 2, dx = ox - cx, dy = oy - cy, prim, cross, overlap;
      if (dir === 'left' || dir === 'right') {
        prim = dir === 'right' ? c.x - (cur.x + cur.w) : cur.x - (c.x + c.w); if ((dir === 'right' ? dx : -dx) <= 4) continue;
        overlap = Math.min(c.y + c.h, cur.y + cur.h) - Math.max(c.y, cur.y); if (overlap <= 0) continue;   // sideways stays in the row
        cross = 0;
      } else {
        prim = dir === 'down' ? c.y - (cur.y + cur.h) : cur.y - (c.y + c.h); if ((dir === 'down' ? dy : -dy) <= 4) continue;
        overlap = Math.min(c.x + c.w, cur.x + cur.w) - Math.max(c.x, cur.x); cross = overlap > 0 ? 0 : Math.abs(dx);
      }
      var sc = Math.max(0, prim) + cross * 3 + (overlap > 0 ? 0 : 1000);
      if (sc < bestS) { bestS = sc; best = c; }
    }
    if (best) { focusId = best.id; play('tick'); }
    else if (edgeFn && (dir === 'left' || dir === 'right')) edgeFn(dir === 'left' ? -1 : 1);   // nothing further that way: e.g. turn the page
  }
  function activate(it) { if (!it || !it.fn) return false; play('click'); it.fn(); return true; }

  var DIRS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' };
  function key(e) {
    var code = e.code; inputMode = e.pad ? 'pad' : 'key';
    if (DIRS[code]) {
      if (e.preventDefault) e.preventDefault();
      if (!focusVis) { focusVis = true; return true; }   // first press only shows where the focus is
      move(DIRS[code]); return true;
    }
    if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
      if (e.preventDefault) e.preventDefault(); focusVis = true;
      return activate(find(focusId));
    }
    if (code === 'Escape' || code === 'Backspace') { if (backFn) { play('back'); backFn(); return true; } return false; }
    if ((code === 'KeyQ' || code === 'KeyE') && tabFn) { tabFn(code === 'KeyQ' ? -1 : 1); return true; }
    return false;
  }

  /* ───────────── pointer ───────────── */
  function down(p) {
    inputMode = p.touch ? 'touch' : 'mouse'; focusVis = false;
    ptr.down = true; ptr.sx = p.x; ptr.sy = p.y; ptr.moved = false; ptr.x = p.x; ptr.y = p.y;
    var it = hit(p); ptr.id = it ? it.id : null;
    ptr.scroll = null; for (var i = 0; i < list.length; i++) if (list[i].sc && list[i].clip && p.y >= list[i].clip.y && p.y <= list[i].clip.y + list[i].clip.h) { ptr.scroll = list[i].sc; ptr.s0 = list[i].sc.y; break; }
    if (it && !it.nofocus) focusId = it.id;
    return !!it || !!ptr.scroll;
  }
  function moveP(p) {
    ptr.x = p.x; ptr.y = p.y;
    if (ptr.down) {
      if (Math.abs(p.y - ptr.sy) > 10 || Math.abs(p.x - ptr.sx) > 10) ptr.moved = true;
      if (ptr.scroll && ptr.moved) ptr.scroll.y = Math.max(0, Math.min(ptr.scroll.max, ptr.s0 - (p.y - ptr.sy)));
      return;
    }
    if (!p.touch) { inputMode = 'mouse'; var it = hit(p); if (it && !it.nofocus && it.id !== focusId) { focusId = it.id; focusVis = false; play('tick'); } }
  }
  function up(p) {
    var was = ptr.down; ptr.down = false; if (!was) return false;
    var it = hit(p), ok = !ptr.moved && it && it.id === ptr.id; ptr.id = null;
    if (ok) return activate(it);
    return false;
  }
  function wheel(dy) { for (var i = 0; i < list.length; i++) if (list[i].sc) { var sc = list[i].sc; sc.y = Math.max(0, Math.min(sc.max, sc.y + dy)); return true; } return false; }

  /* ───────────── gamepad: same events as the keyboard ───────────── */
  var PADMAP = { 0: 'Enter', 1: 'Escape', 9: 'Enter', 8: 'KeyO', 4: 'KeyQ', 5: 'KeyE', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' };
  function pollPad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    var pads = navigator.getGamepads(), gp = null, i;
    for (i = 0; i < pads.length; i++) if (pads[i]) { gp = pads[i]; break; }
    if (!gp) return;
    var down = {};
    for (var b in PADMAP) if (gp.buttons[b] && gp.buttons[b].pressed) down[PADMAP[b]] = true;
    var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (ax < -0.5) down.ArrowLeft = true; if (ax > 0.5) down.ArrowRight = true; if (ay < -0.5) down.ArrowUp = true; if (ay > 0.5) down.ArrowDown = true;
    for (var k in down) {
      var first = !pad.held[k], rep = /^Arrow/.test(k) && pad.at[k] && V.t >= pad.at[k];
      if (first || rep) {
        pad.at[k] = V.t + (first ? 0.35 : 0.12);
        try { dispatchEvent(new KeyboardEvent('keydown', { code: k, key: k === 'Escape' ? 'Escape' : k === 'Enter' ? 'Enter' : '' })); } catch (e) {}
        inputMode = 'pad';
      }
    }
    for (var h in pad.held) if (!down[h]) { delete pad.at[h]; }
    pad.held = down;
  }

  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) document.fonts.load('16px "Press Start 2P"').catch(function () {});

  return {
    TONE: TONE, WORLD: WORLD, INK: INKC, mix: mix,
    begin: begin, end: end, down: down, move: moveP, up: up, wheel: wheel, key: key,
    btn: btn, card: card, area: area, panel: panel, badge: badge, header: header, back: back, player: player, keybar: keybar,
    toast: toast, dialog: dialog, loading: loading, bg: bg, wipe: wipe, stamp: stamp, dither: dither,
    text: text, para: para, label: label, width: width, icon: icon, iconInk: iconInk, plate: plate, notch: notch,
    scrollStart: scrollStart, scrollEnd: scrollEnd,
    tabs: function (fn) { tabFn = fn; },
    tile: tile, tabBar: tabBar, pager: pager,
    onEdge: function (fn) { edgeFn = fn; },
    setBack: function (fn) { backFn = fn; },
    sounds: function (o) { sounds = o || {}; },
    focus: function (id) { if (id !== undefined) { focusId = id; } return focusId; },
    setMemory: function (key, id) { memory[key] = id; },
    /* true while the host has switched screens but the kit has not drawn the new one yet: input must wait for that frame */
    stale: function (key) { return key !== screen; },
    view: function () { return V; },
    mode: function () { return inputMode; },
    items: function () { var out = []; for (var i = 0; i < list.length; i++) out.push({ id: list[i].id, x: list[i].x, y: list[i].y, w: list[i].w, h: list[i].h, off: !!list[i].off }); return out; },
    client: function (id) {
      var it = find(id); if (!it || !X) return null;
      var r = X.canvas.getBoundingClientRect(), cw = X.canvas.width, ch = X.canvas.height;
      return { x: r.left + (it.x + it.w / 2 + V.ox) * r.width / cw, y: r.top + (it.y + it.h / 2) * r.height / ch };
    },
    press: function (id) { return activate(find(id)); }
  };
})();
