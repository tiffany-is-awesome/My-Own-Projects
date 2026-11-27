/* ---------- Dish-specific drawings (for dishes without a photo) ----------
   Same backdrop, light and shadow as the generic plates, but each dish is drawn so you can
   tell what it is. Canvas space is 800 × 1000, centre (400, 500). */
const DISH_ART = (() => {
  const TAU = Math.PI * 2;
  function kit(x, R) {
    const k = {};
    k.shadow = (b, oy, a = .26) => { x.shadowColor = `rgba(0,0,0,${a})`; x.shadowBlur = b; x.shadowOffsetY = oy; };
    k.noShadow = () => { x.shadowColor = "transparent"; x.shadowBlur = 0; x.shadowOffsetY = 0; };
    k.ell = (cx, cy, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); x.fill(); };
    k.circ = (cx, cy, r, col) => k.ell(cx, cy, r, r, col);
    k.rr = (cx, cy, w, h, rad, col, rot = 0) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = col; x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, rad); x.fill(); x.restore(); };
    k.blob = (cx, cy, rad, col, pts = 10, jag = .3) => { x.fillStyle = col; x.beginPath(); for (let i = 0; i <= pts; i++) { const a = i / pts * TAU, rr = rad * (1 - jag / 2 + R() * jag), px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.fill(); };
    k.scatter = (n, cx, cy, rx, ry, fn) => { for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()); fn(cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, i); } };
    k.specks = (n, cx, cy, rx, ry, col, s = 4) => k.scatter(n, cx, cy, rx, ry, (px, py) => k.ell(px, py, s * (.6 + R() * .8), s * (.4 + R() * .5), col, R() * 3));
    k.leaf = (cx, cy, s, rot, col = "#4E9A5B") => { x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = col; x.beginPath(); x.moveTo(0, -18 * s); x.quadraticCurveTo(14 * s, 0, 0, 18 * s); x.quadraticCurveTo(-14 * s, 0, 0, -18 * s); x.fill(); x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 1.5 * s; x.beginPath(); x.moveTo(0, -14 * s); x.lineTo(0, 14 * s); x.stroke(); x.restore(); };
    k.cube = (cx, cy, s, col, shade, rot) => { x.save(); x.translate(cx, cy); x.rotate(rot ?? (R() - .5) * 1.2); x.fillStyle = shade || "rgba(0,0,0,.18)"; x.beginPath(); x.roundRect(-s / 2 + 3, -s / 2 + 4, s, s, s * .18); x.fill(); x.fillStyle = col; x.beginPath(); x.roundRect(-s / 2, -s / 2, s, s, s * .18); x.fill(); x.fillStyle = "rgba(255,255,255,.28)"; x.beginPath(); x.roundRect(-s / 2 + 3, -s / 2 + 3, s * .45, s * .28, 4); x.fill(); x.restore(); };
    k.bananaCoin = (cx, cy, r) => { k.circ(cx, cy, r + 2, "#E9D69A"); k.circ(cx, cy, r, "#F8EDC4"); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; k.circ(cx + Math.cos(a) * r * .32, cy + Math.sin(a) * r * .32, r * .07, "#8A6A3A"); } };
    k.carrotCoin = (cx, cy, r) => { k.circ(cx, cy, r, "#E8833A"); k.circ(cx, cy, r * .55, "#F4A15A"); };
    k.plate = (r = 330) => { k.shadow(36, 16); k.circ(400, 500, r, "#FAFAF7"); k.noShadow(); x.strokeStyle = "rgba(0,0,0,.06)"; x.lineWidth = 3; x.beginPath(); x.arc(400, 500, r * .76, 0, TAU); x.stroke(); };
    k.bowl = (inner) => { k.shadow(40, 20); const g = x.createRadialGradient(340, 420, 40, 400, 500, 330); g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#E4E1DA"); x.fillStyle = g; x.beginPath(); x.arc(400, 500, 320, 0, TAU); x.fill(); k.noShadow(); k.circ(400, 500, 284, inner); };
    k.board = () => { k.shadow(36, 16); x.fillStyle = "#B98A57"; x.beginPath(); x.roundRect(110, 170, 580, 680, 28); x.fill(); k.noShadow(); x.strokeStyle = "rgba(80,45,15,.16)"; x.lineWidth = 2; for (let i = 0; i < 24; i++) { const xx = 130 + R() * 540; x.beginPath(); x.moveTo(xx, 185); x.bezierCurveTo(xx + (R() - .5) * 30, 420, xx + (R() - .5) * 30, 640, xx + (R() - .5) * 20, 835); x.stroke(); } };
    k.skillet = () => { k.shadow(40, 18); x.save(); x.translate(400, 500); x.rotate(.75); x.fillStyle = "#1A1A1A"; x.beginPath(); x.roundRect(250, -28, 260, 56, 26); x.fill(); x.restore(); k.circ(400, 500, 300, "#232323"); k.noShadow(); k.circ(400, 500, 272, "#303030"); };
    k.gloss = (cx, cy, rx, ry, rot = -.5, a = .55) => k.ell(cx, cy, rx, ry, `rgba(255,255,255,${a})`, rot);
    /* a tall glass seen from slightly above */
    k.glass = (top, bottom, foam) => {
      k.shadow(30, 14, .18); x.fillStyle = "rgba(255,255,255,.6)"; x.beginPath(); x.moveTo(250, 250); x.lineTo(550, 250); x.lineTo(515, 860); x.quadraticCurveTo(400, 890, 285, 860); x.closePath(); x.fill(); k.noShadow();
      const lg = x.createLinearGradient(0, 330, 0, 860); lg.addColorStop(0, top); lg.addColorStop(1, bottom);
      x.fillStyle = lg; x.beginPath(); x.moveTo(262, 330); x.lineTo(538, 330); x.lineTo(512, 845); x.quadraticCurveTo(400, 872, 288, 845); x.closePath(); x.fill();
      k.ell(400, 332, 138, 22, foam || top);
      x.strokeStyle = "rgba(255,255,255,.75)"; x.lineWidth = 10; x.lineCap = "round"; x.beginPath(); x.moveTo(278, 300); x.lineTo(300, 830); x.stroke();
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 5; x.beginPath(); x.moveTo(505, 360); x.lineTo(490, 800); x.stroke();
      x.strokeStyle = "rgba(0,0,0,.08)"; x.lineWidth = 3; x.beginPath(); x.ellipse(400, 252, 150, 22, 0, 0, TAU); x.stroke();
    };
    k.straw = (col = "#2E6B5A") => { x.strokeStyle = col; x.lineWidth = 16; x.lineCap = "round"; x.beginPath(); x.moveTo(480, 110); x.lineTo(440, 560); x.stroke(); x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 4; x.beginPath(); x.moveTo(476, 120); x.lineTo(437, 540); x.stroke(); };
    return k;
  }
  const D = {
    "leche-flan": (x, k, R) => {
      k.plate(); k.ell(400, 560, 250, 150, "#8E3F0C"); k.ell(400, 560, 230, 132, "#A9520F");
      k.shadow(20, 10, .2);
      x.fillStyle = "#EDB24A"; x.beginPath(); x.moveTo(215, 470); x.lineTo(215, 560); x.ellipse(400, 560, 185, 92, 0, Math.PI, 0, true); x.lineTo(585, 470); x.closePath(); x.fill(); k.noShadow();
      const g = x.createLinearGradient(0, 470, 0, 640); g.addColorStop(0, "#F6CD6B"); g.addColorStop(1, "#E5A33C"); x.fillStyle = g; x.beginPath(); x.moveTo(215, 470); x.lineTo(215, 560); x.ellipse(400, 560, 185, 92, 0, Math.PI, 0, true); x.lineTo(585, 470); x.closePath(); x.fill();
      const t = x.createRadialGradient(350, 440, 20, 400, 470, 200); t.addColorStop(0, "#C8701C"); t.addColorStop(1, "#8E3F0C"); k.ell(400, 470, 185, 92, "#7A340A"); x.fillStyle = t; x.beginPath(); x.ellipse(400, 466, 180, 88, 0, 0, TAU); x.fill();
      for (let i = 0; i < 9; i++) { const px = 230 + i * 42 + R() * 10; x.fillStyle = "#9A4810"; x.beginPath(); x.moveTo(px - 10, 480 + Math.sin(i) * 20); x.quadraticCurveTo(px, 520 + R() * 40, px + 10, 482 + Math.sin(i) * 20); x.fill(); }
      k.gloss(330, 440, 70, 18, -.15, .45); k.gloss(470, 455, 28, 8, -.15, .35);
      k.specks(14, 400, 600, 170, 60, "rgba(255,240,200,.5)", 3);
    },
    "banana-bread": (x, k, R) => {
      k.board();
      // the loaf in 3/4 view: dark side, domed golden-brown top with the classic split
      k.shadow(22, 12, .28); k.rr(400, 395, 430, 150, 36, "#6E3A14"); k.noShadow();
      k.rr(400, 395, 420, 140, 34, "#7E4419");
      const g = x.createLinearGradient(0, 250, 0, 380); g.addColorStop(0, "#B26A2A"); g.addColorStop(1, "#8A4A1A");
      x.fillStyle = g; x.beginPath(); x.moveTo(190, 370); x.bezierCurveTo(200, 250, 600, 250, 610, 370); x.closePath(); x.fill();
      x.strokeStyle = "#5A2E0E"; x.lineWidth = 9; x.lineCap = "round"; x.beginPath(); x.moveTo(250, 318); x.bezierCurveTo(330, 288, 470, 330, 552, 300); x.stroke();
      x.strokeStyle = "#E2B27A"; x.lineWidth = 4; x.beginPath(); x.moveTo(256, 310); x.bezierCurveTo(330, 282, 468, 322, 546, 292); x.stroke();
      k.gloss(300, 300, 60, 12, -.2, .25);
      k.bananaCoin(340, 296, 22); k.bananaCoin(460, 306, 20);
      for (const [cx, cy, rot] of [[300, 640, -.12], [470, 690, .1]]) {
        k.shadow(18, 8, .22); k.rr(cx, cy, 210, 250, 40, "#7A4318", rot); k.noShadow();
        k.rr(cx, cy, 190, 230, 34, "#D9A866", rot);
        x.save(); x.translate(cx, cy); x.rotate(rot); for (let i = 0; i < 40; i++) k.ell((R() - .5) * 160, (R() - .5) * 200, 3 + R() * 4, 2 + R() * 3, R() < .4 ? "#8A5A2A" : "rgba(255,255,255,.35)", R() * 3); x.restore();
      }
    },
    "banana-cue": (x, k, R) => {
      k.plate();
      for (const [cy, rot] of [[380, -.12], [520, .05], [660, -.06]]) {
        x.save(); x.translate(400, cy); x.rotate(rot);
        x.strokeStyle = "#D9B77A"; x.lineWidth = 10; x.lineCap = "round"; x.beginPath(); x.moveTo(-300, 6); x.lineTo(290, -4); x.stroke();
        k.shadow(14, 6, .25); x.fillStyle = "#B8691C"; x.beginPath(); x.moveTo(-210, 0); x.bezierCurveTo(-150, -70, 150, -70, 220, -10); x.bezierCurveTo(160, 40, -150, 45, -210, 0); x.fill(); k.noShadow();
        const g = x.createLinearGradient(0, -55, 0, 40); g.addColorStop(0, "#E09A3A"); g.addColorStop(1, "#9A4E10"); x.fillStyle = g; x.beginPath(); x.moveTo(-200, -2); x.bezierCurveTo(-140, -62, 140, -62, 210, -12); x.bezierCurveTo(150, 32, -140, 38, -200, -2); x.fill();
        k.gloss(-40, -32, 90, 9, -.05, .5); for (let i = 0; i < 18; i++) k.circ(-170 + R() * 340, -30 + R() * 50, 2 + R() * 2.5, "rgba(255,230,170,.7)");
        x.restore();
      }
    },
    "grilled-cheese": (x, k, R) => {
      k.plate();
      const half = (cx, cy, rot, flip) => {
        x.save(); x.translate(cx, cy); x.rotate(rot); if (flip) x.scale(-1, 1);
        k.shadow(18, 8, .25); x.fillStyle = "#B8722A"; x.beginPath(); x.moveTo(-150, -150); x.lineTo(150, 150); x.lineTo(-150, 150); x.closePath(); x.fill(); k.noShadow();
        const g = x.createLinearGradient(-150, -150, 150, 150); g.addColorStop(0, "#E2A64E"); g.addColorStop(1, "#C9822F"); x.fillStyle = g; x.beginPath(); x.moveTo(-140, -128); x.lineTo(128, 140); x.lineTo(-140, 140); x.closePath(); x.fill();
        x.strokeStyle = "rgba(110,55,15,.35)"; x.lineWidth = 9; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-140, -60 + i * 55); x.lineTo(-60 + i * 55, 140); x.stroke(); }
        x.fillStyle = "#F6C437"; x.beginPath(); x.moveTo(-150, -150); x.lineTo(150, 150); x.lineTo(158, 140); x.lineTo(-140, -160); x.closePath(); x.fill();
        for (let i = 0; i < 4; i++) { const t = .15 + i * .22, px = -150 + 300 * t, py = -150 + 300 * t; x.fillStyle = "#F6C437"; x.beginPath(); x.ellipse(px + 10, py - 8, 12, 26 + R() * 14, -.8, 0, TAU); x.fill(); }
        x.restore();
      };
      half(330, 500, .1, false); half(480, 520, -.2, true);
      k.ell(560, 330, 50, 50, "#D9443A"); k.ell(560, 330, 38, 38, "#E86A55"); k.specks(6, 560, 330, 22, 22, "#F7D08A", 3);
    },
    "banana-oatmeal": (x, k, R) => {
      k.bowl("#E6D3AA");
      k.scatter(260, 400, 500, 268, 268, (px, py) => k.ell(px, py, 6 + R() * 6, 4 + R() * 4, R() < .5 ? "#EFE1C0" : "#D8C08F", R() * 3));
      const coins = [[300, 420], [350, 400], [405, 395], [460, 405], [510, 425], [330, 470], [390, 462], [450, 470]];
      coins.forEach(([cx, cy]) => { k.shadow(6, 3, .2); k.bananaCoin(cx, cy, 30); k.noShadow(); });
      x.strokeStyle = "rgba(214,150,40,.85)"; x.lineWidth = 8; x.lineCap = "round"; x.beginPath(); x.moveTo(260, 560); x.bezierCurveTo(330, 520, 420, 640, 540, 560); x.stroke();
      k.specks(70, 400, 560, 200, 120, "#8A4E1E", 2.5);
    },
    "fruit-salad": (x, k, R) => {
      k.bowl("#FBF3E1");
      const fruits = ["#F2A73A", "#F6D04D", "#EE7A3A", "#F4E7B8", "#E9465A", "#F6D04D", "#F2A73A"];
      k.scatter(46, 400, 500, 240, 240, (px, py, i) => { if (i % 6 === 5) k.bananaCoin(px, py, 24); else if (i % 9 === 4) { k.cube(px, py, 34, "#F7E6A8"); } else k.cube(px, py, 40 + R() * 10, fruits[i % fruits.length]); });
      k.scatter(18, 400, 500, 230, 230, (px, py) => k.blob(px, py, 16, "rgba(255,250,238,.9)", 8, .5));
      k.gloss(300, 360, 70, 22, -.6, .5);
    },
    "coconut-veg-curry": (x, k, R) => {
      k.bowl("#E4A13A");
      const g = x.createRadialGradient(380, 460, 30, 400, 500, 280); g.addColorStop(0, "#F0B755"); g.addColorStop(1, "#D88A28"); x.fillStyle = g; x.beginPath(); x.arc(400, 500, 280, 0, TAU); x.fill();
      x.strokeStyle = "rgba(255,244,215,.85)"; x.lineWidth = 14; x.lineCap = "round"; x.beginPath(); x.arc(400, 500, 150, .4, 3.6); x.stroke(); x.lineWidth = 8; x.beginPath(); x.arc(400, 500, 90, 3.8, 6.6); x.stroke();
      k.scatter(12, 400, 500, 220, 220, (px, py) => k.cube(px, py, 46, "#F4D27A"));
      k.scatter(10, 400, 500, 220, 220, (px, py) => k.carrotCoin(px, py, 22));
      k.scatter(9, 400, 500, 210, 210, (px, py) => k.rr(px, py, 60, 16, 8, "#5E9A3E", R() * 3));
      k.scatter(12, 400, 500, 200, 200, (px, py) => k.leaf(px, py, .9, R() * 3, "#3F8A4A"));
      k.specks(30, 400, 500, 230, 230, "#B2321E", 3);
    },
    "veg-soup": (x, k, R) => {
      k.bowl("#E7C277");
      const g = x.createRadialGradient(370, 450, 20, 400, 500, 280); g.addColorStop(0, "#F1D691"); g.addColorStop(1, "#D9AE5C"); x.fillStyle = g; x.beginPath(); x.arc(400, 500, 280, 0, TAU); x.fill();
      k.scatter(14, 400, 500, 215, 215, (px, py) => k.carrotCoin(px, py, 24));
      k.scatter(10, 400, 500, 215, 215, (px, py) => k.cube(px, py, 40, "#F5E3A8"));
      k.scatter(10, 400, 500, 215, 215, (px, py) => { x.save(); x.translate(px, py); x.rotate(R() * 3); x.fillStyle = "#C9DFA2"; x.beginPath(); x.ellipse(0, 0, 46, 14, 0, 0, TAU); x.fill(); x.fillStyle = "rgba(255,255,255,.4)"; x.fillRect(-36, -2, 72, 3); x.restore(); });
      k.scatter(26, 400, 500, 240, 240, (px, py) => { x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 5 + R() * 9, 0, TAU); x.stroke(); });
      k.scatter(14, 400, 500, 200, 200, (px, py) => k.leaf(px, py, .8, R() * 3, "#3F8A4A"));
    },
    "chicken-cabbage-fried-rice": (x, k, R) => {
      k.plate();
      k.shadow(20, 8, .16); k.blob(400, 500, 235, "#E7CF96", 18, .12); k.noShadow();
      k.scatter(700, 400, 500, 225, 225, (px, py) => k.ell(px, py, 8, 3.5, R() < .5 ? "#F4E6C2" : "#DDBE7E", R() * 3));
      k.scatter(14, 400, 500, 180, 180, (px, py) => k.blob(px, py, 22, "#C98B52", 8, .4));
      k.scatter(14, 400, 500, 190, 190, (px, py) => k.rr(px, py, 54, 12, 6, "#BFD8A0", R() * 3));
      k.scatter(12, 400, 500, 180, 180, (px, py) => k.blob(px, py, 13, "#F4C842", 7, .5));
      k.scatter(28, 400, 500, 200, 200, (px, py) => { x.strokeStyle = "#4E9A5B"; x.lineWidth = 4; x.beginPath(); x.arc(px, py, 7, 0, TAU); x.stroke(); });
    },
    "veg-frittata": (x, k, R) => {
      k.skillet();
      const g = x.createRadialGradient(380, 470, 40, 400, 500, 270); g.addColorStop(0, "#F7D772"); g.addColorStop(.8, "#E9B84A"); g.addColorStop(1, "#B9782A"); x.fillStyle = g; x.beginPath(); x.arc(400, 500, 262, 0, TAU); x.fill();
      x.fillStyle = "#303030"; x.beginPath(); x.moveTo(400, 500); x.arc(400, 500, 266, -.35, .35); x.closePath(); x.fill();
      k.shadow(10, 4, .3); x.fillStyle = "#F3CF66"; x.beginPath(); x.moveTo(430, 520); x.arc(430, 520, 262, -.3, .4); x.closePath(); x.fill(); k.noShadow();
      k.scatter(22, 400, 500, 220, 220, (px, py) => k.blob(px, py, 14, "#D9443A", 7, .5));
      k.scatter(26, 400, 500, 220, 220, (px, py) => k.leaf(px, py, 1, R() * 3, "#3F8A4A"));
      k.scatter(30, 400, 500, 230, 230, (px, py) => k.circ(px, py, 5 + R() * 6, "rgba(170,100,30,.35)"));
    },
    "tuna-tomato-pasta": (x, k, R) => {
      k.plate();
      x.lineCap = "round"; for (let i = 0; i < 70; i++) { x.strokeStyle = R() < .5 ? "#F1D98B" : "#E6C66E"; x.lineWidth = 7; const r0 = 40 + R() * 180, a0 = R() * TAU; x.beginPath(); x.arc(400 + (R() - .5) * 30, 500 + (R() - .5) * 30, r0, a0, a0 + 1.5 + R() * 2.5); x.stroke(); }
      k.shadow(12, 5, .18); k.blob(400, 480, 120, "#C9402E", 12, .3); k.noShadow(); k.blob(400, 476, 100, "#D9533A", 12, .3);
      k.scatter(10, 400, 480, 95, 80, (px, py) => k.cube(px, py, 22, "#B5321F"));
      k.scatter(12, 400, 480, 110, 95, (px, py) => k.blob(px, py, 14, "#E6CDB4", 7, .6));
      k.scatter(24, 400, 490, 200, 200, (px, py) => k.leaf(px, py, .6, R() * 3, "#3F8A4A"));
    },
    "corned-beef-potatoes": (x, k, R) => {
      k.plate();
      k.shadow(16, 6, .18); k.blob(400, 500, 225, "#9C4636", 16, .14); k.noShadow(); k.blob(400, 496, 205, "#B05440", 16, .16);
      k.scatter(120, 400, 500, 200, 200, (px, py) => { x.strokeStyle = R() < .5 ? "#C8705A" : "#8A3428"; x.lineWidth = 4; x.lineCap = "round"; const a = R() * TAU; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 18, py + Math.sin(a) * 18); x.stroke(); });
      k.scatter(26, 400, 500, 210, 210, (px, py) => k.cube(px, py, 42, R() < .5 ? "#E9B95A" : "#D99A3C"));
      k.scatter(40, 400, 500, 200, 200, (px, py) => { x.strokeStyle = R() < .5 ? "#A8473A" : "#8E3A2E"; x.lineWidth = 7; x.lineCap = "round"; const a = R() * 3; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * 20, py + Math.sin(a) * 30, px + Math.cos(a + 1) * 34, py + Math.sin(a + 1) * 24); x.stroke(); });
      k.scatter(12, 400, 500, 190, 190, (px, py) => { x.strokeStyle = "rgba(245,230,200,.8)"; x.lineWidth = 5; x.beginPath(); x.arc(px, py, 16, .3, 2.6); x.stroke(); });
      k.scatter(18, 400, 500, 210, 210, (px, py) => k.leaf(px, py, .6, R() * 3, "#3F8A4A"));
    },
    "chicken-sandwich": (x, k, R) => {
      k.board();
      // two halves cut corner to corner, cut edge facing us so the filling shows
      const half = (cx, cy, rot) => {
        x.save(); x.translate(cx, cy); x.rotate(rot);
        k.shadow(18, 8, .25); x.fillStyle = "#B9804A"; x.beginPath(); x.moveTo(-165, -165); x.lineTo(165, -165); x.lineTo(165, 165); x.closePath(); x.fill(); k.noShadow();
        const g = x.createLinearGradient(0, -165, 0, 165); g.addColorStop(0, "#F0D29A"); g.addColorStop(1, "#E2B874"); x.fillStyle = g; x.beginPath(); x.moveTo(-138, -150); x.lineTo(150, -150); x.lineTo(150, 138); x.closePath(); x.fill();
        k.scatter(22, 60, -60, 70, 70, (px, py) => k.circ(px, py, 2.5, "rgba(150,100,40,.35)"));
        // the cut face: bread, lettuce, chicken filling, bread
        const band = (off, w, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(-165 + off, -165 - off + w); x.lineTo(165 + off - w, 165 - off); x.lineTo(165 + off, 165 - off + w * 0); x.lineTo(-165 + off + w, -165 - off + w * 0); x.closePath(); x.fill(); };
        x.save(); x.beginPath(); x.moveTo(-170, -160); x.lineTo(160, 170); x.lineTo(130, 200); x.lineTo(-200, -130); x.closePath(); x.clip();
        const lines = [[0, "#F6EBD2"], [12, "#6DB36F"], [22, "#EFDDB2"], [40, "#F6EBD2"]];
        for (const [o, col] of lines) { x.strokeStyle = col; x.lineWidth = o === 22 ? 22 : 12; x.beginPath(); x.moveTo(-165 - o * .7, -165 + o * .7); x.lineTo(165 - o * .7, 165 + o * .7); x.stroke(); }
        for (let n = 0; n < 14; n++) { const t = R(); k.ell(-165 + 330 * t - 15, -165 + 330 * t + 15, 6, 3.5, R() < .5 ? "#C9A06A" : "#7FB36A", .78); }
        x.strokeStyle = "#5DA25F"; x.lineWidth = 6; x.beginPath(); for (let n = 0; n <= 16; n++) { const t = n / 16, px = -165 + 330 * t - 9, py = -165 + 330 * t + 9 + (n % 2) * 6; n ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
        x.restore(); x.restore();
      };
      half(340, 420, .12); half(470, 640, -.15);
      k.scatter(6, 590, 280, 40, 30, (px, py) => k.ell(px, py, 16, 9, "#9CC36A", R() * 3));
    },
    "tortang-talong": (x, k, R) => {
      k.plate();
      x.save(); x.translate(400, 520); x.rotate(-.35);
      k.shadow(18, 8, .22); x.fillStyle = "#C98A2A"; x.beginPath(); x.ellipse(0, 0, 250, 140, 0, 0, TAU); x.fill(); k.noShadow();
      const g = x.createRadialGradient(-40, -30, 20, 0, 0, 250); g.addColorStop(0, "#F3CC63"); g.addColorStop(1, "#D99A3A"); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 238, 128, 0, 0, TAU); x.fill();
      for (let i = 0; i < 7; i++) { x.strokeStyle = "rgba(91,42,74,.55)"; x.lineWidth = 8; x.lineCap = "round"; x.beginPath(); x.moveTo(-150 + i * 8, -60 + i * 20); x.lineTo(150 - i * 10, -40 + i * 16); x.stroke(); }
      k.scatter(24, 0, 0, 200, 100, (px, py) => k.circ(px, py, 5 + R() * 7, "rgba(160,90,25,.35)"));
      x.fillStyle = "#4F6B2E"; x.beginPath(); x.moveTo(-250, -10); x.lineTo(-300, -40); x.lineTo(-305, 20); x.closePath(); x.fill(); k.ell(-245, -6, 22, 30, "#5E7A34");
      x.restore();
      k.shadow(10, 4, .2); k.circ(600, 330, 54, "#FFFFFF"); k.noShadow(); k.circ(600, 330, 42, "#C9342A"); k.gloss(588, 318, 14, 6, -.5, .5);
    },
    "fruit-yogurt-smoothie": (x, k, R) => {
      k.glass("#F3A6BE", "#E07196", "#F7C3D3"); k.straw("#E07196");
      k.scatter(6, 400, 336, 110, 12, (px, py) => k.circ(px, py, 13, "#9C2A4A"));
      k.bananaCoin(560, 272, 40); k.circ(250, 300, 26, "#C2304E"); k.leaf(250, 270, .9, .2, "#4E9A5B");
    },
    "avocado-shake": (x, k, R) => {
      k.glass("#C9DC8E", "#9FBF5A", "#E3EDB8"); k.straw("#2E6B5A");
      x.save(); x.translate(600, 300); x.rotate(.4); k.ell(0, 0, 70, 95, "#3E5A1E"); k.ell(0, 0, 60, 85, "#B9D27A"); k.ell(0, 0, 44, 66, "#E3EDB2"); k.circ(0, 18, 26, "#8A5A2E"); k.gloss(-8, 8, 10, 5, -.5, .4); x.restore();
    },
    "cucumber-cooler": (x, k, R) => {
      k.glass("rgba(214,236,196,.92)", "rgba(170,210,150,.95)", "#E7F3DA"); k.straw("#2E6B5A");
      for (const [cx, cy, r] of [[350, 520, 46], [450, 650, 42], [380, 760, 38]]) { k.circ(cx, cy, r, "#4F8A3A"); k.circ(cx, cy, r - 6, "#CFE5B0"); k.scatter(7, cx, cy, r * .45, r * .45, (px, py) => k.ell(px, py, 3, 1.6, "#F4F8EA", R() * 3)); }
      k.scatter(8, 400, 430, 110, 70, (px, py) => k.rr(px, py, 26, 22, 5, "rgba(255,255,255,.55)", R()));
      k.leaf(560, 280, 1.4, .5, "#3F8A4A"); k.leaf(590, 300, 1.1, 1.1, "#4E9A5B");
    },
    "papaya-milk-shake": (x, k, R) => {
      k.glass("#F7B57A", "#EE8A4A", "#FAD2AC"); k.straw("#2E6B5A");
      x.save(); x.translate(590, 310); x.rotate(-.5); x.fillStyle = "#6E8A2E"; x.beginPath(); x.moveTo(-90, 0); x.quadraticCurveTo(0, -90, 90, 0); x.closePath(); x.fill(); x.fillStyle = "#F08A4B"; x.beginPath(); x.moveTo(-80, -2); x.quadraticCurveTo(0, -78, 80, -2); x.closePath(); x.fill(); for (let i = 0; i < 8; i++) k.circ(-30 + i * 8, -14 - Math.sin(i / 7 * Math.PI) * 14, 5, "#2A2B29"); x.restore();
    }
  };
  return { has: id => !!D[id], draw(x, r, R) { D[r.id](x, kit(x, R), R); } };
})();
