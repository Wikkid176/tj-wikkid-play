// Browser host for the PC version (WebAssembly), desktop and phone: the 16:9 HD view drawn at twice the game's
// 427x240, walk banks, the light map, the album, keyboard, controllers and on-screen soft keys. Old School view
// switches to the 1x pixel sheets at 320x240 inside the TV frame, as on PC.
(() => {
  'use strict';
  const WIDE = 427, SH = 240, R = 2;  // HD frame buffer: 854x480; Old School: 640x480
  const phone = matchMedia('(pointer: coarse)').matches;
  const tintLimit = (phone ? 16 : 32) * 1024 * 1024;
  const bankLimit = (phone ? 96 : 192) * 1024 * 1024;
  let SW = WIDE, renderedFrames = 0, skippedFrames = 0, cacheEvictions = 0;
  let tintBytes = 0, bankBytes = 0, assetEpoch = 0, backdropBytes = 0;
  const sheetEpoch = [];

  const screen = document.getElementById('screen'), sctx = screen.getContext('2d', { alpha: false });
  const fb = document.createElement('canvas'); fb.width = SW * R; fb.height = SH * R;
  const g = fb.getContext('2d');
  let tv = null;  // the Old School TV frame picture
  const statusEl = document.getElementById('status'), startBtn = document.getElementById('start'), barEl = document.getElementById('bar');
  let M, mem, wasm, sfxBufs = [], AC = null, sfxGain = null, lc = null, lx = null, retro = false;
  const hd = [], lo = [], want = new Set(), loading = new Map(); let cover = null;

  // ---------- display ----------
  function resize() {
    const vw = innerWidth, vh = innerHeight, s = Math.min(vw / WIDE, vh / SH);
    const w = Math.floor(WIDE * s), h = Math.floor(SH * s);
    // The browser compositor scales the bounded canvas to CSS/device pixels.
    // Avoid rasterizing a 4K/6K canvas just to present an 854x480 game frame.
    const maxPixels = phone ? 1280 * 720 : 1920 * 1080;
    const dpr = Math.min(devicePixelRatio || 1, 3, Math.sqrt(maxPixels / Math.max(1, w * h)));
    screen.style.width = w + 'px'; screen.style.height = h + 'px';
    screen.width = Math.round(w * dpr); screen.height = Math.round(h * dpr);
    // soft keys sized to the black bars beside the game screen (wide phones have room; squarer ones get smaller keys)
    const k = vw > vh ? Math.max(.62, Math.min(1.15, ((vw - w) / 2 - 14) / 212)) : Math.max(.62, Math.min(1, (vw - 190) / 212));
    document.documentElement.style.setProperty('--k', k.toFixed(3));
  }
  addEventListener('resize', resize); resize();
  function present() {
    sctx.imageSmoothingQuality = 'low';  // bilinear, matching the Windows SDL renderer
    if (!retro) { sctx.imageSmoothingEnabled = true; sctx.drawImage(fb, 0, 0, screen.width, screen.height); return; }
    // Old School: the 320x240 picture inside the TV (the frame's screen hole is given in the PC's 1708x960 window)
    const W = screen.width, H = screen.height; sctx.fillStyle = '#000'; sctx.fillRect(0, 0, W, H);
    let x0 = (W - H * 4 / 3) / 2, y0 = 0, x1 = W - x0, y1 = H;
    if (tv && tv.complete && tv.naturalWidth) { sctx.imageSmoothingEnabled = true; sctx.drawImage(tv, 0, 0, W, H); const h = M.tvHole; x0 = h[0] / 1708 * W; y0 = h[1] / 960 * H; x1 = h[2] / 1708 * W; y1 = h[3] / 960 * H; }
    sctx.imageSmoothingEnabled = false; sctx.drawImage(fb, 0, 0, 320 * R, SH * R, x0, y0, x1 - x0, y1 - y0);
    sctx.globalAlpha = .12; sctx.fillStyle = '#000'; for (let y = y0; y < y1; y += 3) sctx.fillRect(x0, y, x1 - x0, 1); sctx.globalAlpha = 1;  // scanlines
  }

  // ---------- sheets (loaded when the game asks for them) ----------
  function load(sh, old) {
    const arr = old ? lo : hd, key = (old ? 'l' : 'h') + sh; if (arr[sh] || loading.has(key)) return;
    const S = M.sheets[sh], im = new Image(), epoch = sheetEpoch[sh] || 0;
    const p = new Promise(res => { im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { if (want.has(sh) && (sheetEpoch[sh] || 0) === epoch) { arr[sh] = im; assetEpoch++; } if (loading.get(key) === p) loading.delete(key); res(); }); };
      im.onerror = () => { if (loading.get(key) === p) loading.delete(key); res(); }; });
    loading.set(key, p); im.src = old ? 'lo/' + S.id + '.png' : 'sheets/' + S.id + '.' + S.ext;
  }
  function geo(sh) {
    const S = M.sheets[sh]; if (!S) return null;
    if (retro) { const im = lo[sh]; if (!im) { if (want.has(sh)) load(sh, true); return null; } const c = S.lo; return { im, cw: c.cw, ch: c.ch, ax: c.ax, ay: c.ay, cols: c.cols, k: 1, fx: 1, fy: 1 }; }
    const im = hd[sh]; if (!im) { if (want.has(sh)) load(sh, false); return null; }
    return { im, cw: S.cw, ch: S.ch, ax: S.ax, ay: S.ay, cols: S.cols, k: 4, fx: im.width / S.W, fy: im.height / S.H };
  }
  // walk banks: 52 (or 24) extra poses per enemy and boss in one atlas, 8 columns, each cell padded around the sheet's frame
  const banks = [new Map(), new Map()];  // mode (0 HD, 1 Old School) -> sheet -> {im, count} | 'loading' | 'bad'
  function dropBank(mode, sh) {
    const v = banks[mode].get(sh);
    if (v && v.im) { bankBytes -= v.bytes; v.im.onload = v.im.onerror = null; v.im.src = ''; }
    banks[mode].delete(sh);
  }
  function bankRoom(bytes, keepMode, keepSheet) {
    while (bankBytes + bytes > bankLimit) {
      let oldest = null;
      for (let mode = 0; mode < 2; mode++) for (const [sh, v] of banks[mode]) {
        if (!v.im || (mode === keepMode && sh === keepSheet) || performance.now() - v.used < 250) continue;
        if (!oldest || v.used < oldest.used) oldest = { mode, sh, used: v.used };
      }
      if (!oldest) return false;
      dropBank(oldest.mode, oldest.sh); invalidateSheetCache(oldest.sh); cacheEvictions++;
    }
    return true;
  }
  function anim(sh, mode) {
    const b = banks[mode], v = b.get(sh);
    if (v && v.im) { v.used = performance.now(); return v.count; }
    if (v === 'loading' || v === 'bad') return 0;
    const S = M.sheets[sh]; if (!S || !want.has(sh)) return 0;
    // Include pending decodes in the limit; at most two large banks decode together.
    let pending = 0; for (const set of banks) for (const entry of set.values()) if (entry === 'loading') pending++;
    if (pending >= 2) return 0;
    const p = M.pad * (mode ? 1 : 4), cw = (mode ? S.lo.cw : S.cw) + 2 * p, ch = (mode ? S.lo.ch : S.ch) + 2 * p;
    const packed = M.animation?.[mode ? 'lo' : 'hd']?.[S.id];
    const estimate = packed ? packed.size[0] * packed.size[1] * 4 : Math.round(cw * 8 * ch * 7 * 4 / (mode ? 1 : 4));
    if (!bankRoom(estimate, mode, sh)) return 0;
    bankBytes += estimate; b.set(sh, 'loading');
    const epoch = sheetEpoch[sh] || 0, im = new Image(); let finished = false;
    const finish = () => { if (finished) return false; finished = true; bankBytes -= estimate; im.onload = im.onerror = null; return true; };
    im.onload = async () => {
      if (im.decode) { try { await im.decode(); } catch (_) {} }
      if (!finish()) return;
      if (!want.has(sh) || (sheetEpoch[sh] || 0) !== epoch) return;
      const source = packed ? packed.sourceSize : [im.width, im.height];
      const fx = source[0] / (cw * 8), rows = Math.round(source[1] / (ch * fx)), count = packed ? packed.count : rows === 7 ? 52 : rows === 3 ? 24 : 0;
      const bytes = im.width * im.height * 4;
      if (count && bankRoom(bytes, mode, sh)) { bankBytes += bytes; b.set(sh, { im, count, cw, ch, p, fx, fy: source[1] / (ch * (count === 52 ? 7 : 3)), packed, bytes, used: performance.now() }); assetEpoch++; }
      else b.set(sh, count ? 'waiting' : 'bad');
    };
    im.onerror = () => { if (finish() && (sheetEpoch[sh] || 0) === epoch) b.set(sh, 'bad'); };
    im.src = 'anim/' + (mode ? 'lo' : 'hd') + '/' + S.id + '.png'; return 0;
  }
  function bankGeo(sh, ox, oy, fr) {
    const v = banks[retro ? 1 : 0].get(sh); if (!v || !v.im) return null; const S = M.sheets[sh], k = retro ? 1 : 4;
    const ax = (retro ? S.lo.ax : S.ax) + v.p - ox * k, ay = (retro ? S.lo.ay : S.ay) + v.p - oy * k;
    if (v.packed) {
      const r = v.packed.rects[fr]; if (!r) return null;
      const left = (r[4] - fr % 8 * v.cw * v.fx) / v.fx, top = (r[5] - Math.floor(fr / 8) * v.ch * v.fy) / v.fy;
      return {im: v.im, cw: r[2] / v.fx, ch: r[3] / v.fy, ax: ax - left, ay: ay - top, cols: 1, k, fx: v.fx, fy: v.fy, bank: true, region: r, trimLeft: left, trimTop: top};
    }
    return { im: v.im, cw: v.cw, ch: v.ch, ax, ay, cols: 8, k, fx: v.fx, fy: v.fy, bank: true };
  }
  // tinted / solid-colour versions of a frame, cached
  const cache = new Map(), backdrops = new Map();
  function freeCanvas(c) { c.width = c.height = 0; }
  function invalidateSheetCache(sh) {
    for (const [key, entry] of cache) if (entry.sh === sh) { cache.delete(key); tintBytes -= entry.bytes; freeCanvas(entry.canvas); }
    const backdrop = backdrops.get(sh); if (backdrop) { backdropBytes -= backdrop.width * backdrop.height * 4; freeCanvas(backdrop); backdrops.delete(sh); }
  }
  function cachedBackdrop(sh, G) {
    let c = backdrops.get(sh); if (c) return c;
    // Bake the exact blurred spill once, rather than filtering it every frame.
    c = document.createElement('canvas'); c.width = WIDE * R; c.height = SH * R;
    const x = c.getContext('2d'); x.setTransform(R, 0, 0, R, 0, 0);
    const h = WIDE * 3 / 4; x.save(); if ('filter' in x) x.filter = 'blur(6px)';
    x.drawImage(G.im, 0, 0, G.cw * G.fx, G.ch * G.fy, 0, (SH - h) / 2, WIDE, h); x.restore();
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, WIDE, SH);
    const ox = (WIDE - 320) / 2;
    for (let i = 0; i < 12; i++) { x.fillStyle = `rgba(0,0,0,${(90 - i * 7) / 255})`; x.fillRect(ox - (i + 1) * .75, 0, .75, SH); x.fillRect(ox + 320 + i * .75, 0, .75, SH); }
    const bytes = c.width * c.height * 4;
    while (backdropBytes + bytes > (phone ? 4 : 8) * 1024 * 1024 && backdrops.size) {
      const key = backdrops.keys().next().value, old = backdrops.get(key); backdropBytes -= old.width * old.height * 4; freeCanvas(old); backdrops.delete(key);
    }
    backdropBytes += bytes; backdrops.set(sh, c); return c;
  }
  function variant(sh, G, fr, flags, rgba) {
    const key = (G.bank ? 'b' : '') + sh + ':' + fr + ':' + (flags & 6) + ':' + (rgba >>> 8) + (retro ? 'r' : ''); let entry = cache.get(key); if (entry) { cache.delete(key); cache.set(key, entry); return entry.canvas; } let c;
    const w = Math.max(1, Math.round(G.cw * G.fx)), h = Math.max(1, Math.round(G.ch * G.fy));
    c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const sx = G.region ? G.region[0] : (fr % G.cols) * G.cw * G.fx, sy = G.region ? G.region[1] : Math.floor(fr / G.cols) * G.ch * G.fy;
    x.drawImage(G.im, sx, sy, G.cw * G.fx, G.ch * G.fy, 0, 0, w, h);
    const col = `rgb(${rgba >>> 24},${(rgba >>> 16) & 255},${(rgba >>> 8) & 255})`;
    if (flags & 4) { x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, w, h); }
    else { x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'destination-in'; x.drawImage(G.im, sx, sy, G.cw * G.fx, G.ch * G.fy, 0, 0, w, h); }
    const bytes = w * h * 4;
    while (tintBytes + bytes > tintLimit && cache.size) {
      const oldest = cache.keys().next().value, old = cache.get(oldest); cache.delete(oldest); tintBytes -= old.bytes; freeCanvas(old.canvas); cacheEvictions++;
    }
    if (bytes <= tintLimit) { cache.set(key, {canvas: c, bytes, sh}); tintBytes += bytes; } return c;
  }
  function frameDraw(ctx, G, sh, fr, flags, rgba) {  // draws the frame with its anchor at the origin, in the sheet's pixels
    if (flags & 6) { ctx.globalAlpha = (rgba & 255) / 255; ctx.drawImage(variant(sh, G, fr, flags, rgba), -G.ax, -G.ay, G.cw, G.ch); }
    else { const fx = G.region ? G.region[0] : (fr % G.cols) * G.cw * G.fx, fy = G.region ? G.region[1] : Math.floor(fr / G.cols) * G.ch * G.fy; ctx.drawImage(G.im, fx, fy, G.cw * G.fx, G.ch * G.fy, -G.ax, -G.ay, G.cw, G.ch); }
  }
  const rnd = v => retro ? Math.round(v) : v;
  const env = {
    js_log: p => console.log(cstr(p)),
    js_input: () => inputMask(),
    js_input_player: p => playerMask(p),
    js_menu_input: () => menuClaim(),
    js_load(sh) { want.add(sh); load(sh, retro); },
    js_unload(sh) { want.delete(sh); sheetEpoch[sh] = (sheetEpoch[sh] || 0) + 1; hd[sh] = lo[sh] = null; dropBank(0, sh); dropBank(1, sh); invalidateSheetCache(sh); },  // the chapter's walk banks go with their sheets
    js_retro(on) { retro = !!on; SW = retro ? 320 : WIDE; fb.width = SW * R; assetEpoch++; for (const sh of want) load(sh, retro); },
    js_spr(sh, fr, x, y, flags, rgba, sx, sy, deg) { sprite(geo(sh), sh, fr, x, y, flags, rgba, sx, sy, deg); },
    js_bank(sh, fr, x, y, flags, rgba, sx, sy, deg, ox, oy) { sprite(bankGeo(sh, ox, oy, fr), sh, fr, x, y, flags, rgba, sx, sy, deg); },
    js_anim: (sh, mode) => anim(sh, mode),
    js_backdrop(sh) { const G = geo(sh); if (G) g.drawImage(cachedBackdrop(sh, G), 0, 0, WIDE, SH); },
    js_light_begin(amb) { if (!lc || lc.width !== SW) { lc = document.createElement('canvas'); lc.width = SW; lc.height = SH; lx = lc.getContext('2d'); }
      lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.fillStyle = `rgb(${amb >>> 16 & 255},${amb >>> 8 & 255},${amb & 255})`; lx.fillRect(0, 0, SW, SH); lx.globalCompositeOperation = 'lighter'; },
    js_light(sh, fr, x, y, sx, sy, rgba) { const G = geo(sh); if (!G || !lx) return; rgba >>>= 0;
      lx.save(); lx.translate(x, y); lx.scale(sx / G.k, sy / G.k); frameDraw(lx, G, sh, fr, 2, rgba); lx.restore(); },
    js_light_end() { if (!lc) return; g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.drawImage(lc, 0, 0, SW, SH); g.restore(); },
    js_spr_affine(sh, fr, flags, rgba, ox, oy, ux, uy, vx, vy) { affine(geo(sh), sh, fr, flags, rgba, ox, oy, ux, uy, vx, vy); },
    js_bank_affine(sh, fr, flags, rgba, ox, oy, ux, uy, vx, vy, bx, by) { affine(bankGeo(sh, bx, by, fr), sh, fr, flags, rgba, ox, oy, ux, uy, vx, vy); },
    js_spr_rows(sh, sy, h, dx, dy, dw, flags) {
      const G = geo(sh); if (!G || h <= 0 || dw <= 0) return;
      const s = [0, sy * G.k * G.fy, G.cw * G.fx, h * G.k * G.fy];
      if (flags & 1) { g.save(); g.translate(dx + dw, dy); g.scale(-1, 1); g.drawImage(G.im, ...s, 0, 0, dw, h); g.restore(); }
      else g.drawImage(G.im, ...s, dx, dy, dw, h);
    },
    js_spr_part(sh, sx, sy, w, h, dx, dy) { const G = geo(sh); if (!G || w <= 0 || h <= 0) return;
      g.drawImage(G.im, sx * G.k * G.fx, sy * G.k * G.fy, w * G.k * G.fx, h * G.k * G.fy, rnd(dx), rnd(dy), w, h); },
    js_rect(x, y, w, h, rgba) { rgba >>>= 0; if (w <= 0 || h <= 0) return; g.fillStyle = `rgba(${rgba >>> 24},${(rgba >>> 16) & 255},${(rgba >>> 8) & 255},${(rgba & 255) / 255})`;
      if (retro) g.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); else g.fillRect(x, y, w, h); },
    js_music(t, full) { Music.play(t, full); },
    js_music_stop() { Music.stop(); },
    js_music_volume(v) { Music.vol = v; Music.el.volume = v; },
    js_sfx(id, vol, rate) {
      if (!AC || !sfxBufs[id]) return;
      try { const s = AC.createBufferSource(), gn = AC.createGain(); s.buffer = sfxBufs[id]; s.playbackRate.value = rate || 1; gn.gain.value = vol * .8; s.connect(gn); gn.connect(sfxGain); s.start(); } catch (e) {}
    },
    js_album_count: () => M.album.length,
    js_album_play(t) { Music.album(t); },
    js_album_pause(p) { Music.paused = !!p; if (p) Music.el.pause(); else if (Music.alb >= 0 && !Music.done) Music.el.play().catch(() => {}); },
    js_album_pos: () => Music.alb >= 0 ? (Music.done ? M.album[Music.alb] : Music.el.currentTime || 0) : 0,
    js_album_len: () => Music.alb >= 0 ? M.album[Music.alb] || Music.el.duration || 0 : 0,
    js_album_done: () => Music.alb >= 0 && Music.done ? 1 : 0,
    js_cover(x, y, w, h) { if (cover && cover.complete) { g.save(); g.imageSmoothingEnabled = true; g.drawImage(cover, x, y, w, h); g.restore(); } },
    js_save_load(p, n) { try { const s = localStorage.getItem('wk_save'); if (!s) return 0; const b = Uint8Array.from(atob(s), c => c.charCodeAt(0)); const k = Math.min(b.length, n); new Uint8Array(mem.buffer, p, k).set(b.subarray(0, k)); return k; } catch (e) { return 0; } },
    js_save_store(p, n) { try { const b = new Uint8Array(mem.buffer, p, n); let s = ''; b.forEach(v => s += String.fromCharCode(v)); localStorage.setItem('wk_save', btoa(s)); } catch (e) {} },
  };
  function sprite(G, sh, fr, x, y, flags, rgba, sx, sy, deg) {
    if (!G) return; rgba >>>= 0;
    const tl = flags & 8, flip = flags & 1, vflip = flags & 16;
    const left = tl ? (flip ? -(G.cw + (G.trimLeft || 0)) : (G.trimLeft || 0)) : (flip ? G.ax - G.cw : -G.ax), top = tl ? (vflip ? -(G.ch + (G.trimTop || 0)) : (G.trimTop || 0)) : (vflip ? G.ay - G.ch : -G.ay);
    if (!deg && sx >= 0 && sy >= 0) { const x0 = x + left * sx / G.k, y0 = y + top * sy / G.k, x1 = x0 + G.cw * Math.abs(sx) / G.k, y1 = y0 + G.ch * Math.abs(sy) / G.k;
      if (x1 < -1 || y1 < -1 || x0 > SW + 1 || y0 > SH + 1) return; }
    g.save(); if (flags & 32) g.globalCompositeOperation = 'lighter'; g.translate(rnd(x), rnd(y)); if (deg) g.rotate(deg * Math.PI / 180);
    g.scale((flip ? -sx : sx) / G.k, (vflip ? -sy : sy) / G.k);
    if (tl) g.translate(G.ax + (G.trimLeft || 0), G.ay + (G.trimTop || 0));
    frameDraw(g, G, sh, fr, flags, rgba); g.restore();
  }
  function affine(G, sh, fr, flags, rgba, ox, oy, ux, uy, vx, vy) {
    if (!G) return; rgba >>>= 0; if (flags & 1) { ux = -ux; uy = -uy; }
    g.save(); g.transform(ux, uy, vx, vy, ox, oy); g.scale(1 / G.k, 1 / G.k); frameDraw(g, G, sh, fr, flags & 6, rgba); g.restore();
  }
  function cstr(p) { const b = new Uint8Array(mem.buffer, p); let s = ''; for (let i = 0; b[i]; i++) s += String.fromCharCode(b[i]); return s; }

  // ---------- music and the album (one audio element, so phones that need a tap to allow sound only ask once) ----------
  const Music = {
    el: new Audio(), cur: -1, full: 0, vol: .8, alb: -1, done: false, paused: false, away: false,
    play(t, full) {
      if (t === 0 || t >= 64) full = 0;  // these only exist as instrumentals
      if (this.alb < 0 && t === this.cur && full === this.full) return;  // the game asks every frame in Fighter Mode
      this.alb = -1; this.cur = t; this.full = full;
      // as on PC: the menu plays the Urban Legend instrumental; track + 64 is a stage track's boss remix
      const hard = t >= 64, f = M.music[t === 0 ? 8 : hard ? t - 64 : t]; if (!f) return;
      this.el.loop = true; this.el.src = 'music/' + (hard ? 'hard' : full && t !== 0 ? 'full' : 'inst') + '/' + f + '.mp3'; this.el.volume = this.vol;
      if (!this.away) this.el.play().catch(() => {});
    },
    album(t) {
      this.cur = -2; this.alb = t; this.done = false; this.paused = false;
      this.el.loop = false; this.el.src = 'album/' + String(t + 1).padStart(2, '0') + '.mp3'; this.el.volume = this.vol;
      if (!this.away) this.el.play().catch(() => {});
    },
    stop() { this.el.pause(); this.cur = -1; this.alb = -1; },
    resume() { if ((this.cur >= 0 || (this.alb >= 0 && !this.paused && !this.done)) && this.el.paused) this.el.play().catch(() => {}); },
  };
  Music.el.addEventListener('ended', () => { if (Music.alb >= 0) Music.done = true; });
  Music.el.preload = 'auto';

  // ---------- input ----------
  const B = { left: 1, right: 2, up: 4, down: 8, punch: 16, kick: 32, jump: 64, rage: 128, start: 256, back: 512 };
  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyJ: 'punch', KeyZ: 'punch', KeyK: 'kick', KeyX: 'kick', Space: 'jump', KeyC: 'jump', KeyL: 'rage', KeyV: 'rage', Enter: 'start', KeyP: 'start', Escape: 'back', Backspace: 'back' };
  let kb = 0, touch = 0, pulse = 0, tap = 0;  // tap: a press the game hasn't seen yet (very quick taps would otherwise fall between frames)
  addEventListener('keydown', e => { const k = KEYS[e.code]; if (!k) return; e.preventDefault(); kb |= B[k]; });
  addEventListener('keyup', e => { const k = KEYS[e.code]; if (!k) return; e.preventDefault(); kb &= ~B[k]; });
  addEventListener('blur', () => { kb = 0; touch = 0; releaseAll(); });
  function maskOf(p) { const bt = i => p.buttons[i] && p.buttons[i].pressed; const ax = p.axes[0] || 0, ay = p.axes[1] || 0; let m = 0;
    if (ax < -.4 || bt(14)) m |= B.left; if (ax > .4 || bt(15)) m |= B.right; if (ay < -.4 || bt(12)) m |= B.up; if (ay > .4 || bt(13)) m |= B.down;
    if (bt(0)) m |= B.jump; if (bt(2)) m |= B.punch; if (bt(1)) m |= B.kick; if (bt(3) || bt(5) || bt(7)) m |= B.rage; if (bt(9)) m |= B.start; if (bt(8)) m |= B.back; return m; }
  // Player 1 is the controller last used on the menus (or the first connected); player 2 is the first OTHER controller doing something
  // player 1's isn't, so a controller the phone lists twice can never steer both players.
  let p1pad = -1, p2pad = -1, pm = {}; const padPrev = {};
  function updatePads() {
    pm = {}; const ps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of ps) { if (!p || !p.connected) continue; pm[p.index] = maskOf(p); if (pm[p.index]) padUsed(); }
    if (!(p1pad in pm)) p1pad = -1; if (!(p2pad in pm)) p2pad = -1;
  }
  function menuClaim() {
    for (const k in pm) { const i = +k, edge = pm[k] & ~(padPrev[k] || 0); padPrev[k] = pm[k];
      if (edge && i !== p1pad) { const c = p1Index(); if (c < 0 || pm[c] !== pm[k]) { p1pad = i; if (p2pad === i) p2pad = -1; } } }
  }
  function p1Index() { if (p1pad >= 0) return p1pad; const ks = Object.keys(pm); return ks.length ? +ks[0] : -1; }
  function allPads() { let m = 0; for (const k in pm) m |= pm[k]; return m; }
  function inputMask() { return kb | touch | tap | pulse | allPads(); }
  function playerMask(p) {
    const s1 = p1Index(), m1 = s1 >= 0 ? pm[s1] : 0;
    if (p === 0) return kb | m1 | touch | tap | pulse;
    let m2 = 0;
    if (p2pad >= 0 && p2pad !== s1) m2 = pm[p2pad] || 0;
    else for (const k in pm) { const i = +k; if (i === s1) continue; if (pm[k] && pm[k] !== m1) { p2pad = i; m2 = pm[k]; break; } }
    return m2;
  }

  // ---------- soft keys: shown on touch screens, hidden while a controller is in use, back on the next touch ----------
  const tEl = document.getElementById('touch'); let softOn = matchMedia('(pointer: coarse)').matches;
  function showSoft(on) { softOn = on; tEl.hidden = !on || !running; }
  function padUsed() { if (softOn) { showSoft(false); releaseAll(); } }
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !softOn) showSoft(true); }, true);
  const held = new Map();  // pointer id -> button element
  function releaseAll() { held.forEach(el => el.classList.remove('on')); held.clear(); touch &= 15; stickEnd(); }
  function keysUnder(x, y) { const el = document.elementFromPoint(x, y); return el && el.dataset && el.dataset.k ? el : null; }
  function recomputeButtons() { let m = 0; held.forEach(el => { if (el) m |= B[el.dataset.k]; }); touch = (touch & 15) | m;
    tEl.querySelectorAll('[data-k]').forEach(el => el.classList.toggle('on', [...held.values()].includes(el))); }
  // buttons: a finger can slide from one button to the next (punch -> kick) without lifting
  tEl.addEventListener('pointerdown', e => { const el = keysUnder(e.clientX, e.clientY); if (!el) return; e.preventDefault(); unlock(); held.set(e.pointerId, el); tap |= B[el.dataset.k]; recomputeButtons(); vib(); });
  tEl.addEventListener('pointermove', e => { if (!held.has(e.pointerId)) return; const el = keysUnder(e.clientX, e.clientY); if (el && el !== held.get(e.pointerId)) { held.set(e.pointerId, el); tap |= B[el.dataset.k]; recomputeButtons(); vib(); } });
  const up = e => { if (held.delete(e.pointerId)) recomputeButtons(); };
  tEl.addEventListener('pointerup', up); tEl.addEventListener('pointercancel', up);
  function vib() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }
  // stick: floats to wherever the thumb lands in the left part of the screen
  const stick = document.getElementById('stick'), knob = document.getElementById('knob'), zone = document.getElementById('zone'); let sid = null, cx = 0, cy = 0;
  function stickSet(dx, dy) { const m = Math.hypot(dx, dy), r = 46; knob.style.transform = `translate(${m > r ? dx / m * r : dx}px,${m > r ? dy / m * r : dy}px)`;
    let b = 0; const d = 16; if (m > d) { const a = Math.atan2(dy, dx), s = Math.PI / 8; // 8 directions
      if (a > -3 * s && a < 3 * s) b |= B.right; if (a > 5 * s || a < -5 * s) b |= B.left; if (a > s && a < 7 * s) b |= B.down; if (a < -s && a > -7 * s) b |= B.up; }
    touch = (touch & ~15) | b; }
  function stickEnd() { sid = null; stickSet(0, 0); stick.classList.remove('live'); }
  zone.addEventListener('pointerdown', e => { e.preventDefault(); unlock(); if (sid !== null) return; sid = e.pointerId; zone.setPointerCapture(sid);
    const zr = zone.getBoundingClientRect(), sr = stick.getBoundingClientRect(); cx = e.clientX; cy = e.clientY;
    const sx = Math.max(sr.width / 2 + 6, Math.min(zr.width - sr.width / 2, cx - zr.left)), sy = Math.max(sr.height / 2, Math.min(zr.height - sr.height / 2 - 6, cy - zr.top));
    stick.style.left = (sx - sr.width / 2) + 'px'; stick.style.top = (sy - sr.height / 2) + 'px'; stick.style.bottom = 'auto'; stick.classList.add('live'); stickSet(0, 0); });
  zone.addEventListener('pointermove', e => { if (e.pointerId === sid) stickSet(e.clientX - cx, e.clientY - cy); });
  const se = e => { if (e.pointerId === sid) stickEnd(); }; zone.addEventListener('pointerup', se); zone.addEventListener('pointercancel', se);
  // the phone's own Back gesture/button works as the game's BACK
  try { history.pushState({ wk: 1 }, ''); addEventListener('popstate', () => { pulse = B.back; setTimeout(() => pulse = 0, 120); history.pushState({ wk: 1 }, ''); }); } catch (e) {}

  // ---------- audio unlock ----------
  function unlock() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); sfxGain = AC.createGain(); sfxGain.connect(AC.destination); } catch (e) { return; }
    const all = M.sfx.map((n, i) => [i, n]).concat(Object.entries(M.sfxExtra || {}).map(([i, n]) => [+i, n]));
    all.forEach(([i, n]) => fetch('sfx/' + n + '.wav').then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b)).then(buf => sfxBufs[i] = buf).catch(() => {}));
    Music.el.play().catch(() => {});
  }

  // ---------- keep the screen on; pause everything when the app goes to the background ----------
  let lock = null;
  async function wake() { try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => lock = null); } } catch (e) {} }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Music.away = true; Music.el.pause(); if (AC) AC.suspend(); }
    else { Music.away = false; if (running) { Music.resume(); if (AC) AC.resume(); wake(); last = performance.now(); acc = 0; } }
  });

  // ---------- boot ----------
  async function boot() {
    M = await (await fetch('assets.json')).json();
    cover = new Image(); cover.src = 'album/cover.jpg'; tv = new Image(); tv.src = 'frame/tv.png';
    const resp = await fetch('game.wasm'); const bytes = await resp.arrayBuffer();
    const r = await WebAssembly.instantiate(bytes, { env }); wasm = r.instance.exports; mem = wasm.memory;
    statusEl.textContent = navigator.getGamepads && [...navigator.getGamepads()].some(p => p) ? 'Controller found' : 'Ready';
    startBtn.hidden = false; startBtn.focus();
  }
  let last = 0, acc = 0, running = false, holdT = 0, lastAssetEpoch = -1;
  function frame(t) {
    if (!running) return;
    const dt = Math.min(.1, (t - last) / 1000 || 0); last = t;
    if (loading.size && holdT < 4) { holdT += dt; barEl.hidden = holdT < .25; requestAnimationFrame(frame); return; }  // wait for the art a scene needs
    holdT = 0; barEl.hidden = true; acc += dt;
    let n = 0; while (acc >= 1 / 60 && n < 4) { updatePads(); wasm.tick(); tap = 0; acc -= 1 / 60; n++; if (loading.size) { acc = 0; break; } }
    if (n === 4) acc = 0;
    if (!loading.size && (n > 0 || lastAssetEpoch !== assetEpoch)) { renderedFrames++; lastAssetEpoch = assetEpoch; g.setTransform(R, 0, 0, R, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = !retro; g.imageSmoothingQuality = 'low';
      g.fillStyle = '#000'; g.fillRect(0, 0, SW, SH); wasm.draw(); present(); } else skippedFrames++;
    requestAnimationFrame(frame);
  }
  startBtn.addEventListener('click', async () => {
    unlock();
    try { const d = document.documentElement; if (d.requestFullscreen && !document.fullscreenElement) await d.requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
    try { if (window.screen.orientation && window.screen.orientation.lock) window.screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
    wake();
    document.getElementById('boot').hidden = true; wasm.init(); running = true; showSoft(softOn); last = performance.now(); requestAnimationFrame(frame); screen.focus();
  });
  addEventListener('gamepadconnected', () => { if (!running) statusEl.textContent = 'Controller found'; });
  boot().catch(e => { statusEl.textContent = 'Could not load the game: ' + e.message; });
  try { if (window.top !== window) document.getElementById('install').hidden = true; } catch (e) { document.getElementById('install').hidden = true; }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__wk = { get wasm() { return wasm; }, press(mask) { kb = mask; }, get loading() { return loading.size; }, get soft() { return softOn; }, get perf() { return { tintBytes, tintLimit, bankBytes, bankLimit, backdropBytes, cacheEvictions, renderedFrames, skippedFrames, canvas: [screen.width, screen.height] }; } };
})();
