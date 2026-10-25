/* CREW ART (pixel edition): the 30 typist variants, drawn in code at 64x64.
   Copied from the art lab (gemini-art/monkey-variants.js) so the game does not depend on the lab. Game additions, marked GAME:
   - params.hat (2-8, ops.js HATS ids): a worn award hat replaces the costume's headgear; the rest of the costume stays.
   - CrewArt.pose(variant, pose, {expr, hat}): cached frames for the keyboard hop (idle, crouch, launch, air, fall, impact, rebound). */
/**
 * MonkeyOS v2 - Handcrafted 16-Bit Pixel Art Monkey Character Variants
 * 64x64 Modular Sprite Renderers & High-Frame-Count Animation Generators
 *
 * PRODUCTION-GRADE 30 BESPOKE CHARACTER ROSTER across 5 Archetypes:
 *
 * Archetype 1: ATHLETIC & DYNAMIC (v01 - v06)
 *   v01 / runner:           Red tank jersey, headband with fluttering tails, high-top sneakers (Classic Stomper)
 *   v02 / boxer:            Gold silk boxing shorts, wrapped hands/tape, towel draped over shoulders
 *   v03 / gymnast:          Royal blue & white singlet, chalked paws, sweatbands, white slippers
 *   v04 / skater:           Backward snapback ballcap, oversized hoodie, skate shoes, knee pads
 *   v05 / cyclist:          Vintage wool racing cap with flipped bill, yellow jersey, racing goggles
 *   v06 / wrestler:         Cyan & gold lucha libre mask with star eyeholes, championship belt
 *
 * Archetype 2: BLUE-COLLAR CRAFTS & TRADES (v07 - v12)
 *   v07 / dockworker:       Denim overalls, heavy lug boots, rolled cream workshirt (Classic Slammer)
 *   v08 / blacksmith:       Leather apron over dark undershirt, heavy iron tongs, scorched soot marks
 *   v09 / miner:            Hardhat with brass carbide headlamp, pickaxe sheath, coal dust smudges
 *   v10 / carpenter:        Plaid flannel shirt, double-knee work pants, folding carpenter rule
 *   v11 / welder:           Welding goggles tilted up on brow, heavy spark-resistant gauntlets, spats
 *   v12 / railroad:         Striped hickory engineer cap, red bandana neckerchief, pocket watch chain
 *
 * Archetype 3: SCHOLARLY & VICTORIAN (v13 - v18)
 *   v13 / inspector:        Olive herringbone tweed vest, monocle, magnifying glass, oxfords (Classic Inspector)
 *   v14 / professor:        Brown corduroy jacket with elbow patches, bow tie, round spectacles
 *   v15 / clockmaker:       Brass loupe on eye, watchmaker tweezers, apron with gear pockets
 *   v16 / explorer:         Pith helmet, khaki safari jacket, canteen strap, compass medallion
 *   v17 / judge:            White powdered barrister wig, black judicial robe, brass gavel
 *   v18 / reporter:         Fedora with 'PRESS' card in band, unbuttoned trench coat, notebook
 *
 * Archetype 4: INDUSTRIAL & GREASE TECH (v19 - v24)
 *   v19 / grease_mechanic:  Orange tied bandana, toolbelt, bare toes, steel wrench (Classic Mechanic)
 *   v20 / pilot:            Leather aviator jacket with shearling fleece collar, brass flight goggles
 *   v21 / scuba:            Vintage brass deep-sea diving helmet, heavy canvas suit, lead boots
 *   v22 / steampunk:        Leather top hat with brass cogs, cybernetic brass monocle, steam gauge
 *   v23 / radio_operator:   Big retro bakelite headphones over ears, antenna backpack
 *   v24 / alchemist:        Purple scholar robe with flask pouches, bubbling test tubes
 *
 * Archetype 5: WHIMSICAL, ECCENTRIC & ADVENTURE (v25 - v30)
 *   v25 / sailor:           Blue/white striped marinière jersey, navy neckerchief, inky paws (Classic Mischief)
 *   v26 / pirate:           Tricorn hat with skull-and-crossbones, eye patch, red sash, gold hoop earring
 *   v27 / chef:             Tall white pleated toque hat, double-breasted chef coat, red neck scarf
 *   v28 / magician:         Satin top hat with red ribbon band, white gloves, black cape with crimson lining
 *   v29 / ninja:            Black shinobi shozoku hood and cowl, crossed dual wooden ninjato straps
 *   v30 / cowboy:           Wide-brimmed Stetson hat, cowhide vest, red bandana, spurred leather boots
 *
 * All rendered in crisp 64x64 discrete pixel clusters with zero blur, multi-tone color palettes,
 * and 100% compatible with the 5 physical typewriter actions + Victory Dance.
 *
 * UMD / CommonJS / Browser Window support.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MonkeyVariants = root.CrewArt = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ===============================================================
   * 1. MULTI-TONE 16-BIT COLOR PALETTES
   * Shading ramps: Darkest Shadow -> Shadow -> Base -> Mid -> Light -> Specular
   * =============================================================== */

  // 5 Canonical Fur Palettes
  const FUR_PALETTES = {
    golden_tamarin: {
      shadow: '#241405',
      dark:   '#492b0c',
      base:   '#7d4c17',
      mid:    '#b47323',
      light:  '#e29938',
      hi:     '#fac05c'
    },
    silverback_gray: {
      shadow: '#13161a',
      dark:   '#222830',
      base:   '#3a444f',
      mid:    '#566473',
      light:  '#798a9b',
      hi:     '#a2b2c2'
    },
    chestnut_chimp: {
      shadow: '#190b05',
      dark:   '#34180c',
      base:   '#572814',
      mid:    '#7d3d20',
      light:  '#a55530',
      hi:     '#cd7346'
    },
    capuchin_cream: {
      shadow: '#1b140f',
      dark:   '#34281f',
      base:   '#564334',
      mid:    '#7b624f',
      light:  '#a88970',
      hi:     '#d0b297'
    },
    melanistic_black: {
      shadow: '#08090c',
      dark:   '#12151b',
      base:   '#1e232b',
      mid:    '#2b3340',
      light:  '#3f4b5c',
      hi:     '#5b6a80'
    }
  };

  // 5 Canonical Muzzle / Skin Palettes
  const SKIN_PALETTES = {
    golden_tamarin: {
      dark:  '#74401e',
      base:  '#a76332',
      mid:   '#d08853',
      light: '#f3b281',
      hi:    '#fed9b6'
    },
    silverback_gray: {
      dark:  '#44474d',
      base:  '#666c75',
      mid:   '#8b939f',
      light: '#b2bac7',
      hi:    '#d8dee9'
    },
    chestnut_chimp: {
      dark:  '#683a21',
      base:  '#935532',
      mid:   '#bc754b',
      light: '#e19a6f',
      hi:    '#f6c09d'
    },
    capuchin_cream: {
      dark:  '#76573e',
      base:  '#a67d5c',
      mid:   '#c99f7c',
      light: '#ebd0b1',
      hi:    '#f9ebd8'
    },
    melanistic_black: {
      dark:  '#352f33',
      base:  '#564f54',
      mid:   '#7a7277',
      light: '#a49ca1',
      hi:    '#cdc5ca'
    }
  };

  // Shared Common Palette Colors
  const COMMON_PALETTES = {
    eyeWhite:    '#ffffff',
    pupilBlack:  '#0d080c',
    tonguePink:  '#d64258',
    mouthDark:   '#420a12',
    goldDark:    '#704f08',
    goldBase:    '#b88812',
    goldLight:   '#f4c22e',
    goldHi:      '#ffec7a',
    silverDark:  '#2a323d',
    silverBase:  '#586677',
    silverLight: '#94a5b8',
    silverHi:    '#dbe6f2',
    brassDark:   '#4d3708',
    brassBase:   '#9e7415',
    brassLight:  '#e4b42b',
    brassHi:     '#fff28a',
    sparkYellow: '#fff280',
    sparkOrange: '#ff9826',
    sparkWhite:  '#ffffff'
  };

  // Legacy PALETTES object preserved for backwards compatibility
  const PALETTES = {
    stomper: {
      furShadow: FUR_PALETTES.chestnut_chimp.shadow,
      furDark:   FUR_PALETTES.chestnut_chimp.dark,
      furBase:   FUR_PALETTES.chestnut_chimp.base,
      furMid:    FUR_PALETTES.chestnut_chimp.mid,
      furLight:  FUR_PALETTES.chestnut_chimp.light,
      furHi:     FUR_PALETTES.chestnut_chimp.hi,
      skinDark:  SKIN_PALETTES.chestnut_chimp.dark,
      skinBase:  SKIN_PALETTES.chestnut_chimp.base,
      skinMid:   SKIN_PALETTES.chestnut_chimp.mid,
      skinLight: SKIN_PALETTES.chestnut_chimp.light,
      skinHi:    SKIN_PALETTES.chestnut_chimp.hi,
      jerseyShadow: '#540909',
      jerseyDark:   '#8f1212',
      jerseyBase:   '#c91c1c',
      jerseyLight:  '#ee3a3a',
      jerseyHi:     '#ff6f6f',
      trimShadow:   '#7a8694',
      trimBase:     '#c0cad4',
      trimLight:    '#eaf0f6',
      trimWhite:    '#ffffff',
      shoeDark:     '#14181c',
      shoeMid:      '#262e36',
      eyeWhite:     '#ffffff',
      pupil:        '#120806'
    },
    slammer: {
      furShadow: FUR_PALETTES.chestnut_chimp.shadow,
      furDark:   '#221c20',
      furBase:   '#392e35',
      furMid:    '#54444e',
      furLight:  '#735e6a',
      furHi:     '#96808e',
      skinDark:  '#563b2f',
      skinBase:  '#805846',
      skinMid:   '#ab7b64',
      skinLight: '#ce9e86',
      skinHi:    '#f0cbb5',
      shirtShadow: '#6e644f',
      shirtDark:   '#968b70',
      shirtBase:   '#c4b797',
      shirtLight:  '#e6dcbe',
      shirtHi:     '#fffbe8',
      denimShadow: '#101c2b',
      denimDark:   '#1a2c42',
      denimBase:   '#284568',
      denimMid:    '#39608f',
      denimLight:  '#5380b8',
      denimHi:     '#78a3d8',
      brassDark:   '#483408',
      brassBase:   '#946e15',
      brassLight:  '#dfae28',
      brassHi:     '#fff084',
      bootShadow:  '#1c110a',
      bootBase:    '#442716',
      bootMid:     '#6d4025',
      bootLight:   '#985d38',
      tread:       '#121214',
      mouthDark:   '#480d14',
      mouthTongue: '#c94050'
    },
    inspector: {
      furShadow: FUR_PALETTES.chestnut_chimp.shadow,
      furDark:   '#331d10',
      furBase:   '#472c1c',
      furMid:    '#73482e',
      furLight:  '#9f6743',
      silverGray: '#a0a5ad',
      silverLight:'#e0e4eb',
      skinDark:  '#844b24',
      skinBase:  '#b87440',
      skinMid:   '#d9925e',
      skinLight: '#f4be92',
      tweedShadow: '#1f2916',
      tweedDark:   '#314023',
      tweedBase:   '#4b6136',
      tweedLight:  '#6d8b4f',
      tweedHi:     '#8cae69',
      shirtWhite:  '#f4f6f4',
      shirtShadow: '#c8cecc',
      shirtLine:   '#8fa19a',
      tieDark:     '#4a0a1a',
      tieBase:     '#871632',
      tieLight:    '#c4264d',
      pantShadow:  '#16191d',
      pantBase:    '#2c323a',
      pantLight:   '#48515c',
      pantHi:      '#6b7787',
      oxfordDark:  '#2a160c',
      oxfordBase:  '#5a321c',
      oxfordLight: '#8f5532',
      monocleBrass:'#fcd438',
      monocleDark: '#8a6512',
      lensTint:    'rgba(180, 225, 255, 0.45)',
      lensGlint:   '#ffffff',
      mustacheDark:'#2e1b12',
      mustacheBase:'#523223',
      mustacheTip: '#8d5d40'
    },
    mechanic: {
      furShadow: FUR_PALETTES.golden_tamarin.shadow,
      furDark:   '#301b0b',
      furBase:   '#563116',
      furMid:    '#824c24',
      furLight:  '#ae6c36',
      furHi:     '#d8914f',
      skinDark:  '#84481d',
      skinBase:  '#b87440',
      skinMid:   '#df9b64',
      skinLight: '#fad0a0',
      bandanaDark:  '#6b2103',
      bandanaBase:  '#af3c07',
      bandanaMid:   '#e65610',
      bandanaLight: '#ff7824',
      bandanaHi:    '#ffa85c',
      greaseDark:   '#120c14',
      greaseMid:    'rgba(22, 14, 20, 0.70)',
      denimDark:    '#142438',
      denimBase:    '#233d5d',
      denimLight:   '#3d6594',
      cuffBase:     '#c8bc9f',
      cuffLight:    '#e8dec4',
      leatherDark:  '#341c0c',
      leatherBase:  '#603619',
      leatherLight: '#9e592b',
      buckle:       '#dfb02a',
      steelDark:    '#222a33',
      steelBase:    '#475668',
      steelMid:     '#7b8f9e',
      steelLight:   '#c4d6e8',
      steelSpec:    '#ffffff',
      sparkYellow:  '#fff084',
      sparkOrange:  '#ffa034'
    },
    mischief: {
      furShadow: FUR_PALETTES.golden_tamarin.shadow,
      furDark:   '#482e0e',
      furBase:   '#784f18',
      furMid:    '#ab7324',
      furLight:  '#d99738',
      furHi:     '#f7be5c',
      skinDark:  '#8e512c',
      skinBase:  '#b87446',
      skinMid:   '#e29968',
      skinLight: '#f6be95',
      skinHi:    '#ffdec4',
      sailorNavyDark: '#0a1626',
      sailorNavy:     '#162c4a',
      sailorNavyLight:'#264a78',
      stripeWhite:    '#ffffff',
      stripeShade:    '#cdd8e4',
      scarfDark:  '#8f1212',
      scarfBase:  '#db2323',
      scarfLight: '#ff5c5c',
      shortsDark: '#0c192b',
      shortsBase: '#162b48',
      shortsLight:'#264670',
      inkBlack:   '#0c060a',
      inkDark:    '#1c1018',
      ribbonRed:  '#b81424',
      ribbonBlack:'#10080e',
      eyeWhite:   '#ffffff',
      eyePupil:   '#0c0810',
      eyeHighlight:'#ffffff'
    },
    victory: {
      crownShadow: '#5a4008',
      crownDark:   '#8a6512',
      crownBase:   '#b38615',
      crownLight:  '#fad238',
      crownHi:     '#fff29a',
      rubyDark:    '#8f1212',
      rubyBase:    '#e81e35',
      rubyHi:      '#ff8595',
      bananaDark:  '#684d08',
      bananaBase:  '#cba115',
      bananaLight: '#fee035',
      bananaHi:    '#fff89a',
      stemDark:    '#385a1a',
      stemBase:    '#68a02a',
      sparkleWhite:'#ffffff',
      sparkleGold: '#fff084',
      sparkleCyan: '#8ce8ff'
    }
  };

  /* ===============================================================
   * 2. INTEGER-SNAPPED PIXEL ART BUFFER
   * Headless canvas mock for Node.js environments and browser canvas wrapper.
   * =============================================================== */
  class NodeContext2DMock {
    constructor(canvas) {
      this.canvas = canvas;
      this.fillStyle = '#000000';
      this.strokeStyle = '#000000';
      this.lineWidth = 1;
      this.imageSmoothingEnabled = false;
      this.globalAlpha = 1.0;
      this._stack = [];
      this._t = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };
    }
    save() {
      this._stack.push({ ...this._t, ga: this.globalAlpha });
    }
    restore() {
      if (this._stack.length > 0) {
        const s = this._stack.pop();
        this._t = { x: s.x, y: s.y, sx: s.sx, sy: s.sy, rot: s.rot };
        this.globalAlpha = s.ga;
      }
    }
    translate(x, y) {
      this._t.x += x * this._t.sx;
      this._t.y += y * this._t.sy;
    }
    scale(sx, sy) {
      this._t.sx *= sx;
      this._t.sy *= sy;
    }
    rotate(rad) {
      this._t.rot += rad;
    }
    fillRect(x, y, w, h) {
      const bx = Math.floor(this._t.x + x * this._t.sx);
      const by = Math.floor(this._t.y + y * this._t.sy);
      const bw = Math.max(1, Math.floor(w * Math.abs(this._t.sx)));
      const bh = Math.max(1, Math.floor(h * Math.abs(this._t.sy)));
      if (this.canvas._pixels) {
        for (let py = by; py < by + bh; py++) {
          if (py < 0 || py >= this.canvas.height) continue;
          for (let px = bx; px < bx + bw; px++) {
            if (px < 0 || px >= this.canvas.width) continue;
            this.canvas._pixels[py * this.canvas.width + px] = 1;
          }
        }
      }
    }
    clearRect() {}
    beginPath() {}
    moveTo() {}
    lineTo() {}
    stroke() {}
    fill() {}
    arc() {}
    ellipse() {}
    quadraticCurveTo() {}
    closePath() {}
    drawImage() {}
  }

  class NodeCanvasMock {
    constructor(w, h) {
      this.width = w;
      this.height = h;
      this._pixels = new Uint8Array(w * h);
    }
    getContext() {
      return new NodeContext2DMock(this);
    }
    toDataURL() {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    }
  }

  class PixelBuffer {
    constructor(w = 64, h = 64) {
      this.w = w;
      this.h = h;
      if (typeof document !== 'undefined') {
        this.canvas = document.createElement('canvas');
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx = this.canvas.getContext('2d');                      // GAME: no willReadFrequently, so frames stay on the GPU for drawImage
        if (this.ctx) this.ctx.imageSmoothingEnabled = false;
      } else if (typeof OffscreenCanvas !== 'undefined') {
        this.canvas = new OffscreenCanvas(w, h);
        this.ctx = this.canvas.getContext('2d');
        if (this.ctx) this.ctx.imageSmoothingEnabled = false;
      } else {
        this.canvas = new NodeCanvasMock(w, h);
        this.ctx = this.canvas.getContext('2d');
      }
    }

    clear() {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }

    rect(x, y, w, h, col) {
      if (!col) return;
      this.ctx.fillStyle = col;
      this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
    }

    dot(x, y, col) {
      this.rect(x, y, 1, 1, col);
    }

    outlineRect(x, y, w, h, borderCol, fillCol) {
      const ix = Math.floor(x), iy = Math.floor(y), iw = Math.floor(w), ih = Math.floor(h);
      if (fillCol) {
        this.ctx.fillStyle = fillCol;
        this.ctx.fillRect(ix + 1, iy + 1, iw - 2, ih - 2);
      }
      this.ctx.fillStyle = borderCol;
      this.ctx.fillRect(ix, iy, iw, 1);
      this.ctx.fillRect(ix, iy + ih - 1, iw, 1);
      this.ctx.fillRect(ix, iy, 1, ih);
      this.ctx.fillRect(ix + iw - 1, iy, 1, ih);
    }

    beveledBox(x, y, w, h, darkCol, baseCol, lightCol, hiCol) {
      const ix = Math.floor(x), iy = Math.floor(y), iw = Math.floor(w), ih = Math.floor(h);
      this.ctx.fillStyle = darkCol;
      this.ctx.fillRect(ix, iy, iw, ih);
      this.ctx.fillStyle = baseCol;
      this.ctx.fillRect(ix + 1, iy + 1, iw - 2, ih - 2);
      if (lightCol && iw > 2 && ih > 2) {
        this.ctx.fillStyle = lightCol;
        this.ctx.fillRect(ix + 1, iy + 1, iw - 2, 1);
        this.ctx.fillRect(ix + 1, iy + 1, 1, ih - 2);
      }
      if (hiCol && iw > 3 && ih > 3) {
        this.ctx.fillStyle = hiCol;
        this.ctx.fillRect(ix + 1, iy + 1, 1, 1);
      }
    }

    steppedCapsule(x0, y0, x1, y1, r, col) {
      if (!col) return;
      this.ctx.fillStyle = col;
      const minX = Math.floor(Math.min(x0, x1) - r);
      const maxX = Math.ceil(Math.max(x0, x1) + r);
      const minY = Math.floor(Math.min(y0, y1) - r);
      const maxY = Math.ceil(Math.max(y0, y1) + r);
      const vx = x1 - x0, vy = y1 - y0;
      const lenSq = vx * vx + vy * vy || 1;
      const rSq = r * r;

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5 - x0;
          const py = y + 0.5 - y0;
          let t = (px * vx + py * vy) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const cx = x0 + t * vx;
          const cy = y0 + t * vy;
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= rSq) {
            this.ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    steppedCircle(cx, cy, r, col) {
      if (!col) return;
      this.ctx.fillStyle = col;
      const x0 = Math.floor(cx - r), y0 = Math.floor(cy - r);
      const x1 = Math.ceil(cx + r),  y1 = Math.ceil(cy + r);
      const rSq = r * r;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= rSq) {
            this.ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    steppedLine(x0, y0, x1, y1, col, width = 1) {
      this.ctx.fillStyle = col;
      let ix0 = Math.floor(x0), iy0 = Math.floor(y0);
      const ix1 = Math.floor(x1), iy1 = Math.floor(y1);
      const dx = Math.abs(ix1 - ix0), sx = ix0 < ix1 ? 1 : -1;
      const dy = -Math.abs(iy1 - iy0), sy = iy0 < iy1 ? 1 : -1;
      let err = dx + dy;

      while (true) {
        if (width === 1) {
          this.ctx.fillRect(ix0, iy0, 1, 1);
        } else {
          this.ctx.fillRect(ix0 - Math.floor(width / 2), iy0 - Math.floor(width / 2), width, width);
        }
        if (ix0 === ix1 && iy0 === iy1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; ix0 += sx; }
        if (e2 <= dx) { err += dx; iy0 += sy; }
      }
    }

    steppedBezierCurve(x0, y0, cx, cy, x1, y1, col, width = 1) {
      const steps = Math.max(16, Math.round(Math.hypot(x1 - x0, y1 - y0) * 1.5));
      let prevX = Math.round(x0), prevY = Math.round(y0);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const it = 1 - t;
        const curX = Math.round(it * it * x0 + 2 * it * t * cx + t * t * x1);
        const curY = Math.round(it * it * y0 + 2 * it * t * cy + t * t * y1);
        this.steppedLine(prevX, prevY, curX, curY, col, width);
        prevX = curX;
        prevY = curY;
      }
    }
  }

  /* ===============================================================
   * 3. THE 30 BESPOKE MONKEY CHARACTER VARIANT DEFINITIONS
   * =============================================================== */
  const VARIANTS_RAW = [
    // -------------------------------------------------------------
    // ARCHETYPE 1: ATHLETIC & DYNAMIC (v01 - v06)
    // -------------------------------------------------------------
    {
      id: 'v01',
      slug: 'runner',
      name: 'Stomper Runner',
      archetype: 'athletic',
      description: 'Red tank jersey with white racing stripe, headband with fluttering knot tails, high-top red sneakers. The classic key-stomper powerhouse.',
      furKey: 'golden_tamarin',
      skinKey: 'golden_tamarin',
      headgear: 'headband_flutter',
      eyewear: 'standard_focused',
      facial: 'clean',
      torso: 'tank_jersey',
      legs: 'running_shorts',
      footwear: 'sneakers_hightop',
      hands: 'sweatbands_white',
      prop: 'sweatband_badge',
      tailStyle: 'athletic',
      colors: {
        gearDark:   '#8f1212',
        gearBase:   '#c91c1c',
        gearLight:  '#ee3a3a',
        gearHi:     '#ff6f6f',
        trimBase:   '#eaf0f6',
        trimWhite:  '#ffffff',
        accent:     '#ffffff',
        shoeBase:   '#c91c1c',
        shoeTrim:   '#ffffff',
        sole:       '#14181c'
      }
    },
    {
      id: 'v02',
      slug: 'boxer',
      name: 'Southpaw Boxer',
      archetype: 'athletic',
      description: 'Gold silk boxing shorts with black waistband, white tape-wrapped paws, plush white towel draped over muscular shoulders.',
      furKey: 'silverback_gray',
      skinKey: 'silverback_gray',
      headgear: 'shoulder_towel',
      eyewear: 'swollen_brow',
      facial: 'rugged_jaw',
      torso: 'muscular_towel',
      legs: 'boxing_shorts_gold',
      footwear: 'wrapped_paws',
      hands: 'wrapped_tape',
      prop: 'taped_fists',
      tailStyle: 'stout',
      colors: {
        gearDark:   '#8a6512',
        gearBase:   '#cba115',
        gearLight:  '#fee035',
        gearHi:     '#fff692',
        trimBase:   '#181a1c',
        trimWhite:  '#ffffff',
        towelDark:  '#96a0a8',
        towelBase:  '#d0d8e0',
        towelLight: '#ffffff',
        sole:       '#101214'
      }
    },
    {
      id: 'v03',
      slug: 'gymnast',
      name: 'Acrobat Gymnast',
      archetype: 'athletic',
      description: 'Royal blue & white singlet with diagonal sash cut, chalk-dusted paws, blue wristbands, white leather gymnastics slippers.',
      furKey: 'chestnut_chimp',
      skinKey: 'chestnut_chimp',
      headgear: 'sweatband_blue',
      eyewear: 'determined',
      facial: 'clean',
      torso: 'singlet_blue_white',
      legs: 'singlet_shorts',
      footwear: 'gym_slippers',
      hands: 'chalked_paws',
      prop: 'chalk_cloud',
      tailStyle: 'athletic',
      colors: {
        gearDark:   '#143d78',
        gearBase:   '#205cb0',
        gearLight:  '#3e84e4',
        gearHi:     '#7cb3ff',
        trimBase:   '#d0d8e2',
        trimWhite:  '#ffffff',
        accent:     '#ffffff',
        shoeBase:   '#f4f6f8',
        shoeTrim:   '#cdd8e4',
        sole:       '#3a4856'
      }
    },
    {
      id: 'v04',
      slug: 'skater',
      name: 'Street Skater',
      archetype: 'athletic',
      description: 'Backwards teal snapback ballcap with purple bill, oversized purple hoodie with kangaroo pocket, knee pads, skate shoes with caramel gum soles.',
      furKey: 'capuchin_cream',
      skinKey: 'capuchin_cream',
      headgear: 'snapback_backwards',
      eyewear: 'chilled_wink',
      facial: 'smirk',
      torso: 'hoodie_purple',
      legs: 'skate_kneepads',
      footwear: 'skate_shoes_gum',
      hands: 'wrist_guards',
      prop: 'wrist_guard_pad',
      tailStyle: 'prehensile',
      colors: {
        capCrown:   '#126464',
        capBrim:    '#702e96',
        gearDark:   '#3e1858',
        gearBase:   '#642c8c',
        gearLight:  '#8c46bf',
        gearHi:     '#b472e6',
        trimBase:   '#1a1a20',
        trimWhite:  '#ffffff',
        gumSole:    '#b87432',
        padDark:    '#181a1e'
      }
    },
    {
      id: 'v05',
      slug: 'cyclist',
      name: 'Velodrome Cyclist',
      archetype: 'athletic',
      description: 'Vintage wool cycling cap with flipped bill and rainbow stripes, yellow maillot jersey with zip collar, racing goggles on brow, black cleat shoes.',
      furKey: 'chestnut_chimp',
      skinKey: 'chestnut_chimp',
      headgear: 'cycling_cap_vintage',
      eyewear: 'racing_goggles',
      facial: 'focused',
      torso: 'yellow_jersey',
      legs: 'cycling_shorts_black',
      footwear: 'cycling_cleats',
      hands: 'fingerless_gloves',
      prop: 'water_bottle',
      tailStyle: 'athletic',
      colors: {
        gearDark:   '#a67c08',
        gearBase:   '#e8b010',
        gearLight:  '#fed438',
        gearHi:     '#fff08a',
        capBase:    '#202630',
        capStripe1: '#e43232',
        capStripe2: '#28a848',
        capStripe3: '#3274d8',
        trimBase:   '#181c22',
        trimWhite:  '#ffffff',
        sole:       '#0e1014'
      }
    },
    {
      id: 'v06',
      slug: 'wrestler',
      name: 'Lucha Libre Champion',
      archetype: 'athletic',
      description: 'Cyan and gold lucha libre mask with star eyeholes, ornate gold championship belt with eagle medallion, tall laced wrestling boots.',
      furKey: 'melanistic_black',
      skinKey: 'melanistic_black',
      headgear: 'lucha_mask_cyan',
      eyewear: 'lucha_star_eyes',
      facial: 'fierce_growl',
      torso: 'championship_belt',
      legs: 'lucha_tights_cyan',
      footwear: 'wrestling_boots_gold',
      hands: 'wristbands_gold',
      prop: 'gold_eagle_belt',
      tailStyle: 'stout',
      colors: {
        maskBase:   '#167c94',
        maskDark:   '#0d4c5c',
        maskLight:  '#28b2d4',
        goldBase:   '#dfae28',
        goldDark:   '#745008',
        goldLight:  '#ffd438',
        gemRed:     '#d41c2c',
        gemGreen:   '#18a848',
        tightsBase: '#167c94',
        sole:       '#111216'
      }
    },

    // -------------------------------------------------------------
    // ARCHETYPE 2: BLUE-COLLAR CRAFTS & TRADES (v07 - v12)
    // -------------------------------------------------------------
    {
      id: 'v07',
      slug: 'dockworker',
      name: 'Carriage Slammer Dockworker',
      archetype: 'trade',
      description: 'Heavyweight chimp in denim overalls with brass buckles, yellow carpenter pencil in bib pocket, heavy brown lug boots. Built to pull carriage return levers.',
      furKey: 'chestnut_chimp',
      skinKey: 'chestnut_chimp',
      headgear: 'heavy_brow',
      eyewear: 'rugged_eyes',
      facial: 'power_jaw',
      torso: 'overalls_denim',
      legs: 'denim_trousers',
      footwear: 'lug_boots_brown',
      hands: 'rolled_cream_sleeves',
      prop: 'pencil_pocket',
      tailStyle: 'stout',
      colors: {
        shirtBase:  '#c4b797',
        shirtLight: '#e6dcbe',
        shirtDark:  '#968b70',
        denimBase:  '#284568',
        denimDark:  '#1a2c42',
        denimLight: '#5380b8',
        brassBase:  '#946e15',
        brassLight: '#dfae28',
        bootBase:   '#442716',
        bootDark:   '#1c110a',
        bootLight:  '#844b24',
        pencil:     '#ffd230',
        sole:       '#121214'
      }
    },
    {
      id: 'v08',
      slug: 'blacksmith',
      name: 'Iron Forge Blacksmith',
      archetype: 'trade',
      description: 'Heavy scorched cowhide leather apron over charcoal undershirt, heavy iron forging tongs, soot smudges on muzzle, heat-shielded boots.',
      furKey: 'chestnut_chimp',
      skinKey: 'chestnut_chimp',
      headgear: 'leather_sweatband',
      eyewear: 'squinting_focus',
      facial: 'soot_smudge',
      torso: 'apron_blacksmith',
      legs: 'heavy_work_pants',
      footwear: 'blacksmith_boots',
      hands: 'soot_stained_paws',
      prop: 'iron_tongs',
      tailStyle: 'stout',
      colors: {
        apronDark:  '#301a0e',
        apronBase:  '#542e18',
        apronLight: '#7e4828',
        shirtDark:  '#181a20',
        shirtBase:  '#282c36',
        ironDark:   '#282e38',
        ironBase:   '#4c5666',
        ironLight:  '#7a889e',
        soot:       '#0e0c10',
        bootBase:   '#24160e',
        sole:       '#101014'
      }
    },
    {
      id: 'v09',
      slug: 'miner',
      name: 'Carbide Miner',
      archetype: 'trade',
      description: 'Bright safety-yellow mining hardhat with brass carbide headlamp glowing warm beam, pickaxe slung on back, coal dust grime across brow.',
      furKey: 'melanistic_black',
      skinKey: 'melanistic_black',
      headgear: 'mining_hardhat_yellow',
      eyewear: 'coal_dust_eyes',
      facial: 'coal_dust_smudges',
      torso: 'miner_suspenders',
      legs: 'canvas_trousers_gray',
      footwear: 'steel_toe_boots',
      hands: 'grimy_paws',
      prop: 'pickaxe_back',
      tailStyle: 'stout',
      colors: {
        hatDark:    '#b88406',
        hatBase:    '#f4b410',
        hatLight:   '#ffd642',
        lampBrass:  '#dfae28',
        lampBeam:   '#fffde0',
        shirtDark:  '#20242c',
        shirtBase:  '#383e4c',
        pantDark:   '#343840',
        pantBase:   '#525864',
        pickWood:   '#744c26',
        pickIron:   '#646e7c',
        coalDust:   '#0a0b0e',
        sole:       '#111216'
      }
    },
    {
      id: 'v10',
      slug: 'carpenter',
      name: 'Timber Carpenter',
      archetype: 'trade',
      description: 'Red & navy buffalo-check plaid flannel shirt with rolled cuffs, canvas double-knee work trousers, yellow folding carpenter ruler in tool pocket.',
      furKey: 'golden_tamarin',
      skinKey: 'golden_tamarin',
      headgear: 'ear_pencil',
      eyewear: 'determined',
      facial: 'clean',
      torso: 'flannel_plaid',
      legs: 'double_knee_canvas',
      footwear: 'tan_work_boots',
      hands: 'calloused_paws',
      prop: 'folding_ruler',
      tailStyle: 'prehensile',
      colors: {
        plaidRed:   '#9e1a1a',
        plaidNavy:  '#1c2838',
        plaidWhite: '#f0ece0',
        pantDark:   '#705836',
        pantBase:   '#9e8054',
        pantLight:  '#c4a474',
        rulerYellow:'#fad028',
        bootBase:   '#7c5428',
        bootLight:  '#a8743c',
        pencil:     '#ffd230',
        sole:       '#141416'
      }
    },
    {
      id: 'v11',
      slug: 'welder',
      name: 'Arc Welder',
      archetype: 'trade',
      description: 'Tinted dark-green welding goggles pushed up on brow, heavy spark-resistant cowhide gauntlets, protective leather apron and spats.',
      furKey: 'silverback_gray',
      skinKey: 'silverback_gray',
      headgear: 'welding_goggles_up',
      eyewear: 'shielded_eyes',
      facial: 'stoic',
      torso: 'welder_leather_apron',
      legs: 'heavy_denim_spats',
      footwear: 'welder_spat_boots',
      hands: 'welding_gauntlets',
      prop: 'arc_sparks',
      tailStyle: 'stout',
      colors: {
        goggleDark: '#121418',
        goggleLens: '#165c26',
        goggleRim:  '#2a323c',
        apronDark:  '#303824',
        apronBase:  '#4a5436',
        apronLight: '#6a7852',
        gauntletBase:'#704424',
        gauntletDark:'#462812',
        spatBase:   '#644026',
        sparkCol:   '#fff68a',
        sole:       '#101214'
      }
    },
    {
      id: 'v12',
      slug: 'railroad',
      name: 'Steam Railroad Engineer',
      archetype: 'trade',
      description: 'Classic blue-and-white hickory stripe engineer cap, knotted red bandana neckerchief, denim vest with swinging brass pocket watch chain.',
      furKey: 'capuchin_cream',
      skinKey: 'capuchin_cream',
      headgear: 'engineer_cap_hickory',
      eyewear: 'observant',
      facial: 'whistle_lips',
      torso: 'railroad_vest_bandana',
      legs: 'hickory_trousers',
      footwear: 'railroader_boots',
      hands: 'oiled_paws',
      prop: 'pocket_watch_chain',
      tailStyle: 'prehensile',
      colors: {
        hickoryBlue:'#1a2a40',
        hickoryWhite:'#f4f6fa',
        bandanaRed: '#b81c1c',
        bandanaHi:  '#ff4a4a',
        vestDenim:  '#223a58',
        watchBrass: '#dfae28',
        watchChain: '#ffd438',
        bootBase:   '#221610',
        sole:       '#0f1012'
      }
    },

    // -------------------------------------------------------------
    // ARCHETYPE 3: SCHOLARLY & VICTORIAN (v13 - v18)
    // -------------------------------------------------------------
    {
      id: 'v13',
      slug: 'inspector',
      name: 'Platen Inspector',
      archetype: 'scholarly',
      description: 'Olive herringbone tweed vest with brass buttons, monocle with glint, brass magnifying glass, oxfords. Distinguished detective inspecting text.',
      furKey: 'chestnut_chimp',
      skinKey: 'chestnut_chimp',
      headgear: 'silver_temples',
      eyewear: 'monocle_brass',
      facial: 'curled_mustache',
      torso: 'tweed_vest_tie',
      legs: 'tailored_trousers',
      footwear: 'oxfords_brown',
      hands: 'groomed_paws',
      prop: 'magnifying_glass',
      tailStyle: 'athletic',
      colors: {
        tweedDark:  '#314023',
        tweedBase:  '#4b6136',
        tweedLight: '#6d8b4f',
        tweedHi:    '#8cae69',
        shirtWhite: '#f4f6f4',
        tieDark:    '#4a0a1a',
        tieBase:    '#871632',
        tieLight:   '#c4264d',
        pantDark:   '#16191d',
        pantBase:   '#2c323a',
        pantLight:  '#48515c',
        oxfordBase: '#5a321c',
        monocleBrass:'#fcd438',
        glassTint:  'rgba(180, 225, 255, 0.45)',
        mustache:   '#382014',
        sole:       '#110905'
      }
    },
    {
      id: 'v14',
      slug: 'professor',
      name: 'Tenured Professor',
      archetype: 'scholarly',
      description: 'Brown corduroy jacket with suede elbow patches, cream collared shirt, burgundy/gold polka dot bow tie, round wireframe spectacles.',
      furKey: 'chestnut_chimp',
      skinKey: 'chestnut_chimp',
      headgear: 'scholar_untamed_hair',
      eyewear: 'round_spectacles',
      facial: 'neat_mustache',
      torso: 'corduroy_jacket_bowtie',
      legs: 'wool_slacks_tan',
      footwear: 'leather_loafers',
      hands: 'ink_chalk_fingers',
      prop: 'lecture_book',
      tailStyle: 'athletic',
      colors: {
        jacketDark: '#3e2212',
        jacketBase: '#62381e',
        jacketLight:'#8c522e',
        suedePatch: '#9e6238',
        shirtCream: '#f8f2e4',
        bowDark:    '#4a0a18',
        bowBase:    '#87162e',
        bowDot:     '#fcd438',
        slacksBase: '#8e7454',
        glassGold:  '#e2b42c',
        glassGlint: '#ffffff',
        loaferBase: '#462412',
        sole:       '#120c08'
      }
    },
    {
      id: 'v15',
      slug: 'clockmaker',
      name: 'Horologist Clockmaker',
      archetype: 'scholarly',
      description: 'Multi-lens brass loupe attached over right eye, navy watchmaker apron with specialized micro-gear pockets, precision watchmaker tweezers.',
      furKey: 'capuchin_cream',
      skinKey: 'capuchin_cream',
      headgear: 'watchmaker_loupe',
      eyewear: 'loupe_arm',
      facial: 'trimmed_whiskers',
      torso: 'horologist_apron',
      legs: 'pinstripe_slacks',
      footwear: 'polished_shoes',
      hands: 'delicate_paws',
      prop: 'watchmaker_tweezers',
      tailStyle: 'prehensile',
      colors: {
        apronDark:  '#101c2e',
        apronBase:  '#1e3250',
        apronLight: '#2e4a74',
        loupeBrass: '#cc9a18',
        loupeHi:    '#ffd438',
        lensCyan:   '#98d8f8',
        gearGold:   '#fad028',
        gearSilver: '#c4d0dc',
        pantBase:   '#2e3440',
        shoeBase:   '#181c24',
        sole:       '#0c0e12'
      }
    },
    {
      id: 'v16',
      slug: 'explorer',
      name: 'Safari Explorer',
      archetype: 'scholarly',
      description: 'Beige pith helmet with leather strap, khaki safari bush jacket with bellows pockets, canteen strap slung diagonally, brass compass medallion.',
      furKey: 'golden_tamarin',
      skinKey: 'golden_tamarin',
      headgear: 'pith_helmet',
      eyewear: 'keen_exploring',
      facial: 'rugged_scruff',
      torso: 'safari_jacket_canteen',
      legs: 'safari_shorts_khaki',
      footwear: 'safari_boots',
      hands: 'weathered_paws',
      prop: 'brass_compass',
      tailStyle: 'prehensile',
      colors: {
        pithDark:   '#827252',
        pithBase:   '#b6a47e',
        pithLight:  '#d6c6a4',
        pithBand:   '#52341c',
        jacketDark: '#786848',
        jacketBase: '#a8946c',
        jacketLight:'#c6b48c',
        canteenTin: '#7a8694',
        strapLeather:'#4a2e16',
        compassGold:'#e2b42c',
        bootBase:   '#644222',
        sole:       '#16120e'
      }
    },
    {
      id: 'v17',
      slug: 'judge',
      name: 'Magistrate Judge',
      archetype: 'scholarly',
      description: 'White powdered curled barrister wig with side rolls, flowing black judicial robe with pleated white lace jabot, solid brass gavel.',
      furKey: 'melanistic_black',
      skinKey: 'melanistic_black',
      headgear: 'barrister_wig',
      eyewear: 'stern_gaze',
      facial: 'authoritative',
      torso: 'judicial_robe_jabot',
      legs: 'hidden_robe_legs',
      footwear: 'buckled_court_shoes',
      hands: 'dignified_paws',
      prop: 'brass_gavel',
      tailStyle: 'stout',
      colors: {
        wigDark:    '#b0bcc8',
        wigBase:    '#d8e2ec',
        wigLight:   '#f4f8fc',
        wigRibbon:  '#14161c',
        robeDark:   '#0c0d12',
        robeBase:   '#181a22',
        robeLight:  '#2a2c38',
        jabotWhite: '#ffffff',
        jabotShadow:'#c4ccd6',
        gavelBrass: '#dfae28',
        gavelWood:  '#5c3418',
        buckleSilver:'#d0d8e2',
        sole:       '#0a0b0e'
      }
    },
    {
      id: 'v18',
      slug: 'reporter',
      name: 'Scoop Reporter',
      archetype: 'scholarly',
      description: 'Brown fedora with white PRESS card in hatband, unbuttoned khaki trench coat with lapels, reporter spiral notebook and pencil.',
      furKey: 'silverback_gray',
      skinKey: 'silverback_gray',
      headgear: 'fedora_press',
      eyewear: 'sharp_inquiring',
      facial: 'cigarette_smirk',
      torso: 'trench_coat_open',
      legs: 'pressed_slacks_brown',
      footwear: 'dress_shoes_brown',
      hands: 'note_taking_paws',
      prop: 'reporter_notebook',
      tailStyle: 'athletic',
      colors: {
        fedoraDark: '#5c4832',
        fedoraBase: '#886d4e',
        fedoraLight:'#aa8e6c',
        fedoraBand: '#18181c',
        pressCard:  '#ffffff',
        pressText:  '#101014',
        trenchDark: '#6e5a40',
        trenchBase: '#9c8464',
        trenchLight:'#bfa988',
        noteCover:  '#2a4e74',
        notePaper:  '#f4f0e6',
        pencil:     '#ffd230',
        shoeBase:   '#422414',
        sole:       '#100c0a'
      }
    },

    // -------------------------------------------------------------
    // ARCHETYPE 4: INDUSTRIAL & GREASE TECH (v19 - v24)
    // -------------------------------------------------------------
    {
      id: 'v19',
      slug: 'grease_mechanic',
      name: 'Escapement Mechanic',
      archetype: 'tech',
      description: 'Orange tied bandana with knot tails, grease smudges on brow, rolled denim jeans with beige cuffs, toolbelt with wooden screwdriver, forged steel wrench with sparks.',
      furKey: 'golden_tamarin',
      skinKey: 'golden_tamarin',
      headgear: 'bandana_orange',
      eyewear: 'confident_mechanic',
      facial: 'grease_smudge',
      torso: 'toolbelt_only',
      legs: 'rolled_denim_cuffs',
      footwear: 'bare_toes_gripping',
      hands: 'grease_stained_paws',
      prop: 'steel_wrench_spark',
      tailStyle: 'prehensile',
      colors: {
        bandanaDark:  '#872c05',
        bandanaBase:  '#c74609',
        bandanaMid:   '#e65610',
        bandanaLight: '#ff7824',
        bandanaHi:    '#ffa85c',
        greaseDark:   '#120c14',
        denimDark:    '#142438',
        denimBase:    '#233d5d',
        denimLight:   '#3d6594',
        cuffBase:     '#c8bc9f',
        cuffLight:    '#e8dec4',
        leatherDark:  '#341c0c',
        leatherBase:  '#603619',
        buckle:       '#dfb02a',
        steelDark:    '#222a33',
        steelBase:    '#475668',
        steelMid:     '#7b8f9e',
        steelLight:   '#c4d6e8',
        steelSpec:    '#ffffff',
        sparkYellow:  '#fff084',
        sparkOrange:  '#ffa034'
      }
    },
    {
      id: 'v20',
      slug: 'pilot',
      name: 'Barnstormer Pilot',
      archetype: 'tech',
      description: 'Leather aviator cap with ear flaps, brass flight goggles, dark brown bomber flight jacket with plush cream shearling fleece collar.',
      furKey: 'chestnut_chimp',
      skinKey: 'chestnut_chimp',
      headgear: 'aviator_cap_leather',
      eyewear: 'flight_goggles',
      facial: 'windblown',
      torso: 'bomber_jacket_shearling',
      legs: 'flight_pants_khaki',
      footwear: 'aviator_boots_shearling',
      hands: 'shearling_cuffs',
      prop: 'flight_scarf',
      tailStyle: 'athletic',
      colors: {
        leatherDark:'#2a170d',
        leatherBase:'#472917',
        leatherLight:'#6b3f24',
        shearlingBase:'#ded4b6',
        shearlingLight:'#fff8e4',
        goggleBrass:'#cca024',
        goggleLens: '#80c8f0',
        goggleGlint:'#ffffff',
        pantDark:   '#64543a',
        pantBase:   '#8e7a56',
        scarfSilk:  '#f8f4e8',
        bootBase:   '#341c10',
        sole:       '#100b08'
      }
    },
    {
      id: 'v21',
      slug: 'scuba',
      name: 'Deep Sea Diver',
      archetype: 'tech',
      description: 'Heavy spherical brass diving helmet with circular barred portholes, twill canvas diving suit with bolted breastplate, lead weighted boots.',
      furKey: 'melanistic_black',
      skinKey: 'melanistic_black',
      headgear: 'brass_dive_helmet',
      eyewear: 'helmet_porthole_eyes',
      facial: 'hidden_in_helmet',
      torso: 'dive_suit_breastplate',
      legs: 'canvas_dive_legs',
      footwear: 'lead_weighted_boots',
      hands: 'dive_cuff_paws',
      prop: 'corrugated_air_hose',
      tailStyle: 'stout',
      colors: {
        brassDark:  '#5a3a0c',
        brassBase:  '#966616',
        brassLight: '#d2962a',
        brassHi:    '#fed266',
        portholeGlass:'#40a0d0',
        suitDark:   '#283438',
        suitBase:   '#3e5056',
        suitLight:  '#5a7078',
        leadBase:   '#424a54',
        hoseRubber: '#14181a',
        sole:       '#20242a'
      }
    },
    {
      id: 'v22',
      slug: 'steampunk',
      name: 'Aeronaut Steampunk',
      archetype: 'tech',
      description: 'Leather stovepipe top hat adorned with intermeshing brass cogs, cybernetic brass monocular with glowing amber lens, steam boiler backpack with gauge.',
      furKey: 'silverback_gray',
      skinKey: 'silverback_gray',
      headgear: 'steampunk_tophat_cogs',
      eyewear: 'cybernetic_monocle_amber',
      facial: 'sideburns',
      torso: 'steampunk_vest_boiler',
      legs: 'pinstripe_trousers_spats',
      footwear: 'buttoned_spats_boots',
      hands: 'brass_knuckle_cuffs',
      prop: 'steam_gauge_boiler',
      tailStyle: 'prehensile',
      colors: {
        hatDark:    '#342014',
        hatBase:    '#543422',
        hatLight:   '#784c32',
        cogBrass:   '#dfae28',
        cogHi:      '#ffd84c',
        amberLens:  '#ff941a',
        boilerCopper:'#9a522c',
        gaugeWhite: '#f4f6fa',
        vestBase:   '#4a3020',
        steamPuff:  '#ffffff',
        bootBase:   '#26160e',
        spatBase:   '#ded0be',
        sole:       '#100c0a'
      }
    },
    {
      id: 'v23',
      slug: 'radio_operator',
      name: 'Signal Radio Operator',
      archetype: 'tech',
      description: 'Oversized olive-drab bakelite headphones over ears, canvas field radio harness supporting antenna backpack with red diode indicator, microphone wand.',
      furKey: 'capuchin_cream',
      skinKey: 'capuchin_cream',
      headgear: 'bakelite_headphones',
      eyewear: 'attentive_signals',
      facial: 'microphone_smile',
      torso: 'radio_harness_pack',
      legs: 'olive_drab_fatigues',
      footwear: 'combat_boots_black',
      hands: 'wire_holding_paws',
      prop: 'radio_antenna_backpack',
      tailStyle: 'prehensile',
      colors: {
        phoneDark:  '#202418',
        phoneBase:  '#3a422e',
        phoneLight: '#586448',
        bandSteel:  '#7a8694',
        packOlive:  '#363c2c',
        antennaBrass:'#dfae28',
        ledRed:     '#ff2424',
        fatigueBase:'#464e3a',
        bootBase:   '#181a1c',
        sole:       '#0e1012'
      }
    },
    {
      id: 'v24',
      slug: 'alchemist',
      name: 'Transmutation Alchemist',
      archetype: 'tech',
      description: 'Royal purple scholar robe with gold runic embroidery, cross-body bandolier holding glowing cyan and emerald glass phials, bubbling glass test tube.',
      furKey: 'melanistic_black',
      skinKey: 'melanistic_black',
      headgear: 'alchemist_cowl',
      eyewear: 'mystic_glint',
      facial: 'mysterious_gaze',
      torso: 'alchemist_robe_phials',
      legs: 'flowing_robe_skirt',
      footwear: 'pointed_alchemist_shoes',
      hands: 'potion_holding_paws',
      prop: 'bubbling_test_tube',
      tailStyle: 'prehensile',
      colors: {
        robeDark:   '#28123c',
        robeBase:   '#4c2270',
        robeLight:  '#7234a6',
        robeHi:     '#9c4ee0',
        runeGold:   '#ffd034',
        vialGreen:  '#12c468',
        vialCyan:   '#12bcf0',
        vialMagenta:'#e82cb0',
        vaporBubble:'#f864d8',
        bandolier:  '#4a2c16',
        shoeBase:   '#c89c20',
        sole:       '#0e0a12'
      }
    },

    // -------------------------------------------------------------
    // ARCHETYPE 5: WHIMSICAL, ECCENTRIC & ADVENTURE (v25 - v30)
    // -------------------------------------------------------------
    {
      id: 'v25',
      slug: 'sailor',
      name: 'Ribbon Mischief Sailor',
      archetype: 'whimsical',
      description: 'Blue-and-white horizontal striped marinière jersey, navy sailor flap collar, red neckerchief, inky paw stamps, big anime sparkling eyes, typewriter ribbon loop.',
      furKey: 'golden_tamarin',
      skinKey: 'golden_tamarin',
      headgear: 'sailor_hair_tuft',
      eyewear: 'large_anime_sparkle',
      facial: 'ink_on_nose',
      torso: 'striped_mariniere',
      legs: 'navy_shorts',
      footwear: 'bare_inky_paws',
      hands: 'inky_black_paws',
      prop: 'tangled_ribbon_strand',
      tailStyle: 'inky',
      colors: {
        sailorNavy: '#162c4a',
        stripeWhite:'#ffffff',
        scarfDark:  '#8f1212',
        scarfBase:  '#db2323',
        scarfLight: '#ff5c5c',
        shortsBase: '#162b48',
        inkBlack:   '#0c060a',
        ribbonRed:  '#b81424',
        ribbonBlack:'#10080e',
        eyePupil:   '#0c0810',
        eyeHighlight:'#ffffff'
      }
    },
    {
      id: 'v26',
      slug: 'pirate',
      name: 'Swashbuckler Pirate',
      archetype: 'whimsical',
      description: 'Black leather tricorn hat with skull-and-crossbones and gold galloon trim, eye patch over left eye, gold hoop earring, crimson velvet sash, cutlass at hip.',
      furKey: 'chestnut_chimp',
      skinKey: 'chestnut_chimp',
      headgear: 'pirate_tricorn',
      eyewear: 'eyepatch_left',
      facial: 'pirate_grin',
      torso: 'pirate_coat_sash',
      legs: 'dark_breeches',
      footwear: 'buccaneer_cuffed_boots',
      hands: 'cutlass_grip',
      prop: 'cutlass_blade',
      tailStyle: 'athletic',
      colors: {
        tricornDark:'#101216',
        tricornBase:'#1c2028',
        galloonGold:'#e2b428',
        skullWhite: '#ffffff',
        patchLeather:'#0e0e12',
        earringGold:'#ffd438',
        sashRed:    '#a81424',
        sashHi:     '#e6283c',
        coatNavy:   '#162234',
        cutlassSteel:'#bcc8d6',
        bootBase:   '#281810',
        bootCuff:   '#44281a',
        sole:       '#0c0a0e'
      }
    },
    {
      id: 'v27',
      slug: 'chef',
      name: 'Pastry Chef Patissier',
      archetype: 'whimsical',
      description: 'Tall pleated white toque blanche chef hat, double-breasted white coat with double buttons, red neckerchief ascot, houndstooth checkered kitchen trousers.',
      furKey: 'capuchin_cream',
      skinKey: 'capuchin_cream',
      headgear: 'toque_blanche_tall',
      eyewear: 'cheerful_gourmet',
      facial: 'confectioner_smile',
      torso: 'chef_coat_buttons',
      legs: 'houndstooth_checkered',
      footwear: 'kitchen_clogs_black',
      hands: 'floured_paws',
      prop: 'wooden_mixing_spoon',
      tailStyle: 'prehensile',
      colors: {
        toqueWhite: '#ffffff',
        toqueShade: '#d2dce8',
        coatWhite:  '#ffffff',
        coatShade:  '#c4d0dc',
        buttonDark: '#121418',
        scarfRed:   '#d82424',
        checkDark:  '#181a20',
        checkWhite: '#ffffff',
        spoonWood:  '#aa7238',
        clogBase:   '#18181c',
        sole:       '#0d0d10'
      }
    },
    {
      id: 'v28',
      slug: 'magician',
      name: 'Prestidigitator Magician',
      archetype: 'whimsical',
      description: 'Glossy black satin top hat with crimson silk ribbon band, formal tuxedo cape with vibrant crimson lining, white gloves, star-tipped wooden magic wand.',
      furKey: 'melanistic_black',
      skinKey: 'melanistic_black',
      headgear: 'magician_tophat',
      eyewear: 'mysterious_wink',
      facial: 'magician_smirk',
      torso: 'tuxedo_cape_crimson',
      legs: 'tuxedo_trousers_satin',
      footwear: 'patent_leather_oxfords',
      hands: 'white_magician_gloves',
      prop: 'magic_wand_star',
      tailStyle: 'prehensile',
      colors: {
        hatDark:    '#0c0e12',
        hatBase:    '#181c24',
        hatLight:   '#282e3c',
        ribbonRed:  '#c81628',
        ribbonHi:   '#f42e44',
        tuxBase:    '#12141a',
        shirtWhite: '#ffffff',
        capeLining: '#b81424',
        capeHi:     '#e8283c',
        gloveWhite: '#ffffff',
        wandEbony:  '#101014',
        wandTip:    '#ffffff',
        sparkleGold:'#fff080',
        shoeBase:   '#0d0e12',
        sole:       '#08080a'
      }
    },
    {
      id: 'v29',
      slug: 'ninja',
      name: 'Shinobi Shadow Ninja',
      archetype: 'whimsical',
      description: 'Midnight-black shinobi shozoku hood with cloth face mask and iron forehead protector plate, wrapped forearm and shin gaiters, dual crossed wooden ninjato hilts.',
      furKey: 'silverback_gray',
      skinKey: 'silverback_gray',
      headgear: 'shinobi_cowl_plate',
      eyewear: 'piercing_ninja_slit',
      facial: 'cowl_mask_covered',
      torso: 'shinobi_gi_straps',
      legs: 'ninja_gaiters_kyahan',
      footwear: 'ninja_tabi_split_toe',
      hands: 'ninja_arm_wraps',
      prop: 'dual_crossed_ninjato',
      tailStyle: 'stealth',
      colors: {
        giDark:     '#101318',
        giBase:     '#1a1f26',
        giLight:    '#2c3440',
        wrapDark:   '#0e1014',
        plateIron:  '#646c78',
        plateHi:    '#9ea8b6',
        hiltWood:   '#503622',
        scabbard:   '#14161c',
        eyeGlint:   '#ffffff',
        tabiBase:   '#12151c',
        sole:       '#0a0b0e'
      }
    },
    {
      id: 'v30',
      slug: 'cowboy',
      name: 'Wild West Cowboy',
      archetype: 'whimsical',
      description: 'Wide-brimmed tan felt Stetson cowboy hat with leather band, spotted cowhide vest over chambray workshirt, red bandana neckerchief, boots with spinning brass star spurs.',
      furKey: 'golden_tamarin',
      skinKey: 'golden_tamarin',
      headgear: 'stetson_cowboy_hat',
      eyewear: 'squinting_outlaw',
      facial: 'outlaw_smirk',
      torso: 'cowhide_vest_bandana',
      legs: 'blue_jeans_denim',
      footwear: 'cowboy_boots_spurs',
      hands: 'chambray_sleeves',
      prop: 'brass_star_spurs',
      tailStyle: 'prehensile',
      colors: {
        stetsonDark:'#785834',
        stetsonBase:'#a68052',
        stetsonLight:'#caa474',
        hatBand:    '#3c2212',
        vestBrown:  '#542e16',
        vestWhite:  '#f0ece2',
        chambray:   '#4c6a8e',
        bandanaRed: '#d42424',
        jeansBase:  '#223a5c',
        bootBase:   '#523218',
        spurBrass:  '#e2b428',
        spurSpark:  '#fff48a',
        sole:       '#16100c'
      }
    }
  ];

  // Index VARIANTS by both 'v01'...'v30' and slug name ('runner', 'boxer', etc.)
  const VARIANTS = {};
  const VARIANT_IDS = [];
  const VARIANT_SLUGS = [];

  VARIANTS_RAW.forEach(v => {
    // Attach referenced palettes
    v.fur = FUR_PALETTES[v.furKey] || FUR_PALETTES.chestnut_chimp;
    v.skin = SKIN_PALETTES[v.skinKey] || SKIN_PALETTES.chestnut_chimp;
    v.common = COMMON_PALETTES;

    VARIANTS[v.id] = v;
    VARIANTS[v.slug] = v;
    VARIANT_IDS.push(v.id);
    VARIANT_SLUGS.push(v.slug);
  });

  function getVariant(idOrSlug) {
    if (!idOrSlug) return VARIANTS['v01'];
    const key = String(idOrSlug).trim().toLowerCase();
    return VARIANTS[key] || VARIANTS['v01'];
  }

  function getAllVariantIds() {
    return [...VARIANT_IDS];
  }

  function getAllVariants() {
    return VARIANT_IDS.map(id => VARIANTS[id]);
  }

  function getArchetypes() {
    return [
      { id: 'athletic',  name: 'Athletic & Dynamic',        variants: VARIANT_IDS.slice(0, 6) },
      { id: 'trade',     name: 'Blue-Collar Crafts & Trades', variants: VARIANT_IDS.slice(6, 12) },
      { id: 'scholarly', name: 'Scholarly & Victorian',       variants: VARIANT_IDS.slice(12, 18) },
      { id: 'tech',      name: 'Industrial & Grease Tech',    variants: VARIANT_IDS.slice(18, 24) },
      { id: 'whimsical', name: 'Whimsical, Eccentric & Adventure', variants: VARIANT_IDS.slice(24, 30) }
    ];
  }

  /* ===============================================================
   * 4. MODULAR BESPOKE LAYER RENDERERS
   * =============================================================== */

  /**
   * Layer A: Back Accessories (antennas, backpacks, boiler, pickaxes, swords, cape)
   */
  function drawBackAccessories(buf, ctx, V, P, params) {
    const { squashX = 1, squashY = 1, headY = 0, headbandFlutter = 0 } = params;

    // 1. Runner headband knot tails
    if (V.headgear === 'headband_flutter') {
      const hx = -6 * squashX;
      const hy = -10 + headY;
      const f1 = Math.round(headbandFlutter * 3);
      const f2 = Math.round(headbandFlutter * 2);
      buf.rect(hx - 2, hy - 1, 3, 3, P.gearDark);
      buf.steppedLine(hx - 2, hy, hx - 8, hy - 2 + f1, P.gearDark, 2);
      buf.steppedLine(hx - 2, hy, hx - 8, hy - 2 + f1, P.gearBase, 1);
      buf.dot(hx - 9, hy - 2 + f1, P.gearLight);
      buf.steppedLine(hx - 2, hy + 2, hx - 7, hy + 4 + f2, P.gearDark, 2);
      buf.steppedLine(hx - 2, hy + 2, hx - 7, hy + 4 + f2, P.gearBase, 1);
      buf.dot(hx - 8, hy + 4 + f2, P.gearLight);
    }

    // 2. Mechanic orange bandana knot tails
    if (V.headgear === 'bandana_orange') {
      const bx = -7 * squashX;
      const by = -8 + headY;
      buf.rect(bx - 2, by, 3, 3, P.bandanaDark);
      buf.steppedLine(bx - 2, by + 1, bx - 8, by + 4, P.bandanaDark, 2);
      buf.steppedLine(bx - 2, by + 1, bx - 8, by + 4, P.bandanaLight, 1);
      buf.steppedLine(bx - 2, by + 2, bx - 7, by + 7, P.bandanaDark, 2);
      buf.steppedLine(bx - 2, by + 2, bx - 7, by + 7, P.bandanaLight, 1);
    }

    // 3. Radio Operator Field Antenna Backpack
    if (V.prop === 'radio_antenna_backpack') {
      buf.rect(-10 * squashX, -2 * squashY, 5, 8, P.phoneDark);
      buf.rect(-9 * squashX, -1 * squashY, 4, 6, P.packOlive);
      buf.steppedLine(-8 * squashX, -2 * squashY, -8 * squashX, -15 + headY, P.antennaBrass, 1);
      buf.dot(-8 * squashX, -16 + headY, P.ledRed);
    }

    // 4. Steampunk Miniature Boiler Backpack
    if (V.prop === 'steam_gauge_boiler') {
      buf.rect(-11 * squashX, -3 * squashY, 6, 8, P.boilerCopper);
      buf.rect(-10 * squashX, -2 * squashY, 4, 6, '#b86638');
      buf.rect(-10 * squashX, -7 * squashY, 2, 4, P.cogBrass);
      buf.dot(-11 * squashX, -8 * squashY, P.steamPuff);
      buf.dot(-12 * squashX, -10 * squashY, P.steamPuff);
    }

    // 5. Miner Pickaxe slung across back
    if (V.prop === 'pickaxe_back') {
      buf.steppedLine(-9 * squashX, 9 * squashY, -3 * squashX, -11 * squashY, P.pickWood, 2);
      buf.rect(-6 * squashX, -12 * squashY, 7, 3, P.pickIron);
      buf.dot(-7 * squashX, -13 * squashY, P.pickIron);
      buf.dot(2 * squashX, -11 * squashY, '#c8d4e2');
    }

    // 6. Ninja Crossed Ninjato Sword Hilts
    if (V.prop === 'dual_crossed_ninjato') {
      buf.steppedLine(-8 * squashX, 4 * squashY, -11 * squashX, -12 * squashY, P.scabbard, 2);
      buf.steppedLine(-11 * squashX, -12 * squashY, -13 * squashX, -16 * squashY, P.hiltWood, 2);
      buf.dot(-14 * squashX, -17 * squashY, P.plateIron);
      buf.steppedLine(-5 * squashX, 5 * squashY, -2 * squashX, -13 * squashY, P.scabbard, 2);
      buf.steppedLine(-2 * squashX, -13 * squashY, 0, -17 * squashY, P.hiltWood, 2);
      buf.dot(0, -18 * squashY, P.plateIron);
    }

    // 7. Magician Evening Cape Back
    if (V.torso === 'tuxedo_cape_crimson') {
      buf.rect(-8 * squashX, -2 * squashY, 5, 12 * squashY, P.capeLining);
      buf.rect(-10 * squashX, -1 * squashY, 4, 13 * squashY, P.hatDark);
      buf.dot(-9 * squashX, 12 * squashY, P.capeHi);
    }

    // 8. Judge Magistrate Robe Back Drapes
    if (V.torso === 'judicial_robe_jabot') {
      buf.rect(-9 * squashX, -2 * squashY, 6, 14 * squashY, P.robeDark);
      buf.rect(-8 * squashX, 0, 4, 13 * squashY, P.robeBase);
    }
  }

  /**
   * Layer B: Animated Character Tail
   */
  function drawTail(buf, ctx, V, P, params) {
    const { squashX = 1, squashY = 1, headbandFlutter = 0 } = params;
    const fur = V.fur;
    const sx = Math.round(-4 * squashX);
    const sy = Math.round(8 * squashY);

    if (V.tailStyle === 'stealth') {
      buf.steppedBezierCurve(sx, sy, -10, 8, -12, 12, fur.shadow, 2);
      buf.steppedBezierCurve(sx, sy, -10, 8, -12, 12, fur.base, 1);
      return;
    }

    if (V.tailStyle === 'stout') {
      const stX = Math.round(-5 * squashX);
      const stY = Math.round(9 * squashY);
      buf.steppedBezierCurve(stX, stY, -14, 5, -16, -1, fur.shadow, 3);
      buf.steppedBezierCurve(stX, stY, -14, 5, -16, -1, fur.base, 2);
      return;
    }

    if (V.tailStyle === 'inky') {
      const inkY = Math.round(7 * squashY);
      buf.steppedBezierCurve(sx, inkY, -14, 2, -12, -7, fur.shadow, 2);
      buf.steppedBezierCurve(sx, inkY, -14, 2, -12, -7, fur.base, 1);
      buf.steppedBezierCurve(-12, -7, -10, -11, -7, -9, fur.shadow, 2);
      buf.steppedBezierCurve(-12, -7, -10, -11, -7, -9, fur.base, 1);
      buf.dot(-7, -9, P.inkBlack);
      buf.dot(-8, -9, P.inkBlack);
      return;
    }

    // Default agile / athletic prehensile tail
    const endX = Math.round(-18 + headbandFlutter * 2);
    const ctlX = Math.round(-14 - headbandFlutter * 2);
    buf.steppedBezierCurve(sx, sy, ctlX, 2, endX, -5, fur.shadow, 3);
    buf.steppedBezierCurve(sx, sy, ctlX, 2, endX, -5, fur.base, 1);
  }

  function drawLegAndFootwear(buf, ctx, V, P, legCoords, isFront, params) {
    const { squashX = 1, squashY = 1 } = params;
    const fur = V.fur;
    const skin = V.skin;
    const hipX = (isFront ? 4 : -4) * squashX;
    const hipY = 5 * squashY;
    const fx = Math.round(legCoords[0]);
    const fy = Math.round(legCoords[1]);
    const rLimb = isFront ? 3.0 : 2.8;

    // 1. Leg Trousers / Shorts / Fur Foundation
    if (V.legs === 'running_shorts') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb, P.gearDark);
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb - 0.8, P.gearBase);
      buf.steppedCapsule(fx, fy - 3, fx, fy - 1, 2.0, fur.base);
    } else if (V.legs === 'boxing_shorts_gold') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 4, rLimb + 0.4, P.gearDark);
      buf.steppedCapsule(hipX, hipY, fx, fy - 4, rLimb - 0.4, P.gearBase);
      buf.steppedCapsule(fx, fy - 4, fx, fy - 1, 2.2, fur.base);
    } else if (V.legs === 'singlet_shorts') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb, P.gearDark);
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb - 0.8, P.gearBase);
      buf.steppedCapsule(fx, fy - 3, fx, fy - 1, 2.0, fur.base);
    } else if (V.legs === 'skate_kneepads') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb, P.gearDark);
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb - 0.8, P.gearBase);
      // Knee pad cluster
      const kx = Math.round((hipX + fx) / 2);
      const ky = Math.round((hipY + fy) / 2);
      buf.rect(kx - 2, ky - 2, 4, 4, P.padDark);
      buf.dot(kx - 1, ky - 1, '#3c4048');
    } else if (V.legs === 'cycling_shorts_black') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb, '#141820');
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb - 0.8, '#242c38');
      buf.steppedCapsule(fx, fy - 3, fx, fy - 1, 2.0, fur.base);
    } else if (V.legs === 'lucha_tights_cyan') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, P.maskDark);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.8, P.maskBase);
    } else if (V.legs === 'denim_trousers') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.4, P.denimDark);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.4, P.denimBase);
    } else if (V.legs === 'heavy_work_pants') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.2, '#181c22');
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.6, '#303844');
    } else if (V.legs === 'canvas_trousers_gray') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.2, P.pantDark);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.6, P.pantBase);
    } else if (V.legs === 'double_knee_canvas') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.2, P.pantDark);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.6, P.pantBase);
      buf.rect(fx - 2, fy - 6, 4, 4, P.pantLight);
    } else if (V.legs === 'heavy_denim_spats') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.2, '#142032');
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.6, '#243854');
    } else if (V.legs === 'hickory_trousers') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.2, P.hickoryBlue);
      buf.steppedLine(hipX, hipY, fx, fy - 1, P.hickoryWhite, 1);
    } else if (V.legs === 'tailored_trousers') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, P.pantDark);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.8, P.pantBase);
      buf.steppedLine(hipX, hipY, fx, fy - 2, P.pantLight, 1);
    } else if (V.legs === 'wool_slacks_tan') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, '#503e28');
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.8, P.slacksBase);
    } else if (V.legs === 'pinstripe_slacks' || V.legs === 'pinstripe_trousers_spats') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, '#1a1e26');
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.8, '#2a323e');
      buf.steppedLine(hipX, hipY, fx, fy - 2, '#48566a', 1);
    } else if (V.legs === 'safari_shorts_khaki') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb, P.jacketDark);
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb - 0.8, P.jacketBase);
      buf.steppedCapsule(fx, fy - 3, fx, fy - 1, 2.0, fur.base);
    } else if (V.legs === 'hidden_robe_legs' || V.legs === 'flowing_robe_skirt') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.6, (P.robeDark || '#101218'));
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.2, (P.robeBase || '#1e2430'));
    } else if (V.legs === 'pressed_slacks_brown') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, '#382618');
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.8, '#583c28');
    } else if (V.legs === 'rolled_denim_cuffs') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb + 0.2, P.denimDark);
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb - 0.6, P.denimBase);
      buf.rect(fx - 3, fy - 3, 6, 3, P.cuffBase);
      buf.rect(fx - 3, fy - 3, 6, 1, P.cuffLight);
    } else if (V.legs === 'flight_pants_khaki') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.2, P.pantDark);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.6, P.pantBase);
    } else if (V.legs === 'canvas_dive_legs') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.6, P.suitDark);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.2, P.suitBase);
    } else if (V.legs === 'olive_drab_fatigues') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.2, '#282e22');
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.6, P.fatigueBase);
    } else if (V.legs === 'navy_shorts') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb, P.sailorNavy);
      buf.steppedCapsule(hipX, hipY, fx, fy - 3, rLimb - 0.8, P.shortsBase);
      buf.steppedCapsule(fx, fy - 3, fx, fy - 1, 2.0, fur.base);
    } else if (V.legs === 'dark_breeches') {
      buf.steppedCapsule(hipX, hipY, fx, fy - 2, rLimb, '#141820');
      buf.steppedCapsule(hipX, hipY, fx, fy - 2, rLimb - 0.8, '#222a38');
    } else if (V.legs === 'houndstooth_checkered') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, P.checkDark);
      buf.steppedLine(hipX, hipY, fx, fy, P.checkWhite, 1);
    } else if (V.legs === 'tuxedo_trousers_satin') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, '#0e1014');
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.8, P.tuxBase);
      buf.steppedLine(hipX, hipY, fx, fy - 2, '#485468', 1);
    } else if (V.legs === 'ninja_gaiters_kyahan') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, P.giDark);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.8, P.giBase);
      buf.dot(fx - 1, fy - 3, P.wrapDark);
      buf.dot(fx + 1, fy - 2, P.wrapDark);
    } else if (V.legs === 'blue_jeans_denim') {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb + 0.2, '#142236');
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.6, P.jeansBase);
    } else {
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb, fur.shadow);
      buf.steppedCapsule(hipX, hipY, fx, fy, rLimb - 0.8, fur.base);
    }

    // 2. Footwear / Bare Toes
    if (V.footwear === 'sneakers_hightop') {
      buf.rect(fx - 2, fy - 2, 5, 2, P.trimWhite);
      buf.rect(fx - 2, fy - 1, 5, 1, P.gearBase);
      buf.rect(fx - 4, fy, 8, 4, P.gearDark);
      buf.rect(fx - 3, fy + 1, 7, 3, P.gearBase);
      buf.rect(fx + 1, fy + 1, 3, 3, P.trimWhite);
      buf.rect(fx - 4, fy + 4, 9, 2, P.trimWhite);
      buf.rect(fx - 4, fy + 5, 9, 1, P.sole);
    } else if (V.footwear === 'wrapped_paws') {
      buf.rect(fx - 3, fy - 1, 6, 3, '#c0cad4');
      buf.rect(fx - 2, fy, 5, 2, '#ffffff');
      buf.dot(fx, fy, '#96a0a8');
    } else if (V.footwear === 'gym_slippers') {
      buf.rect(fx - 3, fy, 6, 3, P.shoeTrim);
      buf.rect(fx - 2, fy + 1, 5, 2, P.shoeBase);
      buf.rect(fx - 3, fy + 3, 6, 1, P.sole);
    } else if (V.footwear === 'skate_shoes_gum') {
      buf.rect(fx - 4, fy, 8, 4, '#1c1e24');
      buf.rect(fx - 3, fy + 1, 7, 3, '#2a2e38');
      buf.rect(fx - 4, fy + 4, 8, 2, P.gumSole);
    } else if (V.footwear === 'cycling_cleats') {
      buf.rect(fx - 3, fy, 7, 3, '#10141a');
      buf.rect(fx - 2, fy + 1, 6, 2, '#202634');
      buf.rect(fx - 3, fy + 3, 7, 1, P.sole);
    } else if (V.footwear === 'wrestling_boots_gold') {
      buf.rect(fx - 3, fy - 2, 6, 5, P.goldDark);
      buf.rect(fx - 2, fy - 1, 5, 4, P.goldLight);
      buf.rect(fx - 3, fy + 3, 7, 2, P.sole);
    } else if (V.footwear === 'lug_boots_brown' || V.footwear === 'tan_work_boots' || V.footwear === 'railroader_boots') {
      buf.rect(fx - 4, fy, 9, 4, (P.bootDark || '#1c110a'));
      buf.rect(fx - 3, fy + 1, 8, 3, (P.bootBase || '#442716'));
      buf.rect(fx + 1, fy + 1, 3, 3, (P.bootLight || '#844b24'));
      buf.rect(fx - 4, fy + 4, 10, 2, (P.sole || '#121214'));
    } else if (V.footwear === 'blacksmith_boots' || V.footwear === 'steel_toe_boots' || V.footwear === 'combat_boots_black') {
      buf.rect(fx - 4, fy, 9, 4, '#121418');
      buf.rect(fx - 3, fy + 1, 8, 3, '#262c36');
      buf.rect(fx + 1, fy + 1, 3, 3, '#485468');
      buf.rect(fx - 4, fy + 4, 10, 2, '#0c0e10');
    } else if (V.footwear === 'welder_spat_boots' || V.footwear === 'buttoned_spats_boots') {
      buf.rect(fx - 4, fy, 9, 4, '#241a12');
      buf.rect(fx - 3, fy - 1, 6, 3, (P.spatBase || '#ded0be'));
      buf.dot(fx - 1, fy, '#ffffff');
      buf.rect(fx - 4, fy + 4, 10, 2, '#101014');
    } else if (V.footwear === 'oxfords_brown' || V.footwear === 'leather_loafers' || V.footwear === 'dress_shoes_brown') {
      buf.rect(fx - 4, fy, 8, 4, (P.oxfordDark || P.loaferBase || '#2a160c'));
      buf.rect(fx - 3, fy + 1, 7, 3, (P.oxfordBase || '#5a321c'));
      buf.rect(fx + 1, fy + 1, 2, 2, (P.oxfordLight || '#8f5532'));
      buf.rect(fx - 4, fy + 4, 8, 1, (P.sole || '#110905'));
    } else if (V.footwear === 'bare_toes_gripping') {
      buf.steppedCircle(fx, fy + 1, 2.6, skin.dark);
      buf.steppedCircle(fx, fy + 1, 1.8, skin.mid);
      buf.dot(fx - 2, fy + 2, skin.light);
      buf.dot(fx, fy + 2, skin.light);
      buf.dot(fx + 2, fy + 2, skin.light);
    } else if (V.footwear === 'bare_inky_paws') {
      buf.steppedCircle(fx, fy, 2.6, skin.base);
      buf.steppedCircle(fx, fy, 1.8, skin.light);
      buf.dot(fx - 1, fy + 1, P.inkBlack);
      buf.dot(fx + 1, fy + 1, P.inkBlack);
    } else if (V.footwear === 'lead_weighted_boots') {
      buf.rect(fx - 5, fy - 1, 10, 5, P.leadBase);
      buf.rect(fx - 4, fy, 8, 4, '#586472');
      buf.rect(fx + 1, fy, 3, 4, P.brassDark);
      buf.rect(fx - 5, fy + 4, 11, 2, P.sole);
    } else if (V.footwear === 'buccaneer_cuffed_boots') {
      buf.rect(fx - 4, fy - 2, 7, 3, P.bootCuff);
      buf.rect(fx - 4, fy + 1, 8, 4, P.bootBase);
      buf.rect(fx - 4, fy + 4, 9, 2, P.sole);
    } else if (V.footwear === 'kitchen_clogs_black') {
      buf.rect(fx - 4, fy, 8, 4, P.clogBase);
      buf.rect(fx - 3, fy + 1, 7, 3, '#2a2c34');
      buf.rect(fx - 4, fy + 4, 8, 1, P.sole);
    } else if (V.footwear === 'patent_leather_oxfords') {
      buf.rect(fx - 3, fy, 7, 4, P.shoeBase);
      buf.rect(fx - 2, fy + 1, 6, 3, '#1c2028');
      buf.dot(fx + 1, fy + 1, '#ffffff'); // Glint
      buf.rect(fx - 3, fy + 4, 8, 1, P.sole);
    } else if (V.footwear === 'ninja_tabi_split_toe') {
      buf.rect(fx - 3, fy, 7, 4, P.tabiBase);
      buf.rect(fx - 2, fy + 1, 6, 3, '#242a36');
      buf.dot(fx + 2, fy + 2, P.sole); // Split toe cleft
      buf.rect(fx - 3, fy + 4, 7, 1, P.sole);
    } else if (V.footwear === 'cowboy_boots_spurs') {
      buf.rect(fx - 3, fy, 8, 4, P.bootBase);
      buf.rect(fx - 2, fy + 1, 7, 3, '#784824');
      buf.rect(fx + 2, fy + 2, 3, 2, '#3c2210'); // Pointed toe
      buf.rect(fx - 4, fy + 4, 8, 1, P.sole);
      // Spinning Brass Star Spur!
      buf.dot(fx - 5, fy + 2, P.spurBrass);
      buf.dot(fx - 6, fy + 2, P.spurSpark);
      buf.dot(fx - 5, fy + 1, P.spurBrass);
      buf.dot(fx - 5, fy + 3, P.spurBrass);
    } else {
      buf.steppedCircle(fx, fy + 1, 2.4, skin.dark);
      buf.steppedCircle(fx, fy + 1, 1.6, skin.base);
    }
  }

  /**
   * Layer D: Torso & Bespoke Outfits
   */
  function drawTorsoAndOutfit(buf, ctx, V, P, params) {
    const { squashX = 1, squashY = 1, bodyTilt = 0 } = params;
    const fur = V.fur;
    const skin = V.skin;

    ctx.save();
    const bTiltX = Math.round(bodyTilt * 4);
    ctx.translate(bTiltX, 0);

    const tw = Math.round(11 * squashX);
    const th = Math.round(11 * squashY);
    const ty = Math.round(-4 * squashY);

    // 1. Broad Powerhouse Workwear (Dockworker Overalls)
    if (V.torso === 'overalls_denim') {
      const cw = Math.round(15 * squashX);
      const ch = Math.round(13 * squashY);
      buf.beveledBox(-cw / 2, -5 * squashY, cw, ch, P.shirtDark, P.shirtBase, P.shirtLight, '#fffbe8');
      const ow = Math.round(13 * squashX);
      const oh = Math.round(12 * squashY);
      buf.beveledBox(-ow / 2, -2 * squashY, ow, oh, P.denimDark, P.denimBase, P.denimLight, '#78a3d8');
      buf.rect(-5, -6 * squashY, 3, 5, P.denimDark);
      buf.rect(-5, -6 * squashY, 2, 5, P.denimBase);
      buf.rect(3, -6 * squashY, 3, 5, P.denimDark);
      buf.rect(3, -6 * squashY, 2, 5, P.denimBase);
      buf.rect(-6, -2 * squashY, 4, 3, P.brassDark);
      buf.rect(-5, -2 * squashY, 3, 2, P.brassLight);
      buf.rect(2, -2 * squashY, 4, 3, P.brassDark);
      buf.rect(3, -2 * squashY, 3, 2, P.brassLight);
      buf.rect(-3, 1, 6, 5, P.denimDark);
      buf.rect(-2, 2, 4, 3, '#39608f');
      buf.rect(1, -1, 1, 3, P.pencil);
      buf.dot(1, -2, '#201810');
      ctx.restore();
      return;
    }

    // Base body foundation
    buf.steppedCapsule(-5 * squashX, 0, 5 * squashX, 0, 6.5 * squashY, fur.shadow);
    buf.steppedCapsule(-4 * squashX, 0, 4 * squashX, 0, 5.5 * squashY, fur.base);

    // 2. Tank Jersey (Runner)
    if (V.torso === 'tank_jersey') {
      buf.rect(-tw / 2, ty, tw, th, P.gearDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.gearBase);
      buf.rect(-tw / 2, ty, 1, 4, P.trimWhite);
      buf.rect(tw / 2 - 1, ty, 1, 4, P.trimWhite);
      buf.rect(-1, ty + 1, 2, th - 2, P.trimWhite); // White racing stripe
      const sw = Math.round(10 * squashX), sh = Math.round(5 * squashY), sy = Math.round(6 * squashY);
      buf.rect(-sw / 2, sy, sw, sh, P.gearDark);
      buf.rect(-sw / 2 + 1, sy, sw - 2, sh - 1, P.gearBase);
      buf.rect(-sw / 2, sy, 1, sh, P.trimWhite);
      buf.rect(sw / 2 - 1, sy, 1, sh, P.trimWhite);
    }
    // 3. Boxer Muscular Fur Chest + Draped Towel
    else if (V.torso === 'muscular_towel') {
      buf.steppedCapsule(-3 * squashX, 1, 3 * squashX, 1, 3.8 * squashY, skin.mid);
      // Gold boxing shorts waistband
      buf.rect(-tw / 2, 4 * squashY, tw, 3, P.trimBase);
      buf.rect(-tw / 2, 6 * squashY, tw, 5, P.gearBase);
      // Towel draped over shoulders
      buf.rect(-6 * squashX, ty - 1, 3, 9 * squashY, P.towelLight);
      buf.rect(4 * squashX, ty - 1, 3, 9 * squashY, P.towelLight);
      buf.rect(-5 * squashX, ty - 2, 11 * squashX, 3, P.towelBase);
    }
    // 4. Gymnastics Singlet
    else if (V.torso === 'singlet_blue_white') {
      buf.rect(-tw / 2, ty, tw, th, P.gearDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.gearBase);
      // Diagonal sash
      buf.steppedLine(-tw / 2, ty + th - 2, tw / 2, ty + 1, P.trimWhite, 2);
    }
    // 5. Skater Hoodie
    else if (V.torso === 'hoodie_purple') {
      buf.rect(-tw / 2 - 1, ty, tw + 2, th + 2, P.gearDark);
      buf.rect(-tw / 2, ty + 1, tw, th, P.gearBase);
      buf.rect(-4, ty + 5, 8, 4, P.gearDark); // Kangaroo pocket
      buf.dot(-2, ty + 2, P.trimWhite); // Strings
      buf.dot(2, ty + 2, P.trimWhite);
    }
    // 6. Cyclist Yellow Jersey
    else if (V.torso === 'yellow_jersey') {
      buf.rect(-tw / 2, ty, tw, th, P.gearDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.gearBase);
      buf.rect(-1, ty, 2, 5, P.trimBase); // Black zipper neck
      buf.rect(-tw / 2, ty + 5, tw, 2, '#202834'); // Chest stripe
    }
    // 7. Lucha Wrestler Belt
    else if (V.torso === 'championship_belt') {
      buf.steppedCapsule(-3 * squashX, 0, 3 * squashX, 0, 3.8 * squashY, skin.mid);
      // Gold Championship Belt
      buf.rect(-tw / 2 - 1, 4 * squashY, tw + 2, 5, P.goldDark);
      buf.rect(-tw / 2, 4 * squashY + 1, tw, 3, P.goldLight);
      buf.rect(-3, 3 * squashY, 6, 6, P.goldDark);
      buf.rect(-2, 3 * squashY + 1, 4, 4, P.goldLight);
      buf.dot(0, 4 * squashY, P.gemRed);
      buf.dot(-2, 4 * squashY + 2, P.gemGreen);
      buf.dot(2, 4 * squashY + 2, P.gemGreen);
    }
    // 8. Blacksmith Cowhide Apron
    else if (V.torso === 'apron_blacksmith') {
      buf.rect(-tw / 2, ty, tw, th, P.shirtDark);
      buf.rect(-tw / 2 + 1, ty + 2, tw - 2, th, P.apronDark);
      buf.rect(-tw / 2 + 2, ty + 3, tw - 4, th - 2, P.apronBase);
      buf.rect(-2, ty, 4, 3, P.apronDark); // Neck loop
      buf.dot(-2, 2, P.soot); // Soot flecks
      buf.dot(2, 4, P.soot);
    }
    // 9. Miner Suspenders & Twill Shirt
    else if (V.torso === 'miner_suspenders') {
      buf.rect(-tw / 2, ty, tw, th, P.shirtDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.shirtBase);
      buf.rect(-4, ty, 2, th, '#20242a'); // Leather suspenders
      buf.rect(3, ty, 2, th, '#20242a');
      buf.dot(-4, ty + 4, P.lampBrass);
      buf.dot(3, ty + 4, P.lampBrass);
    }
    // 10. Plaid Flannel Shirt (Carpenter)
    else if (V.torso === 'flannel_plaid') {
      buf.rect(-tw / 2, ty, tw, th, P.plaidNavy);
      for (let r = 0; r < th; r += 2) {
        buf.rect(-tw / 2, ty + r, tw, 1, P.plaidRed);
      }
      for (let c = 0; c < tw; c += 3) {
        buf.rect(-tw / 2 + c, ty, 1, th, P.plaidWhite);
      }
    }
    // 11. Welder Olive Leather Apron
    else if (V.torso === 'welder_leather_apron') {
      buf.rect(-tw / 2, ty, tw, th, P.apronDark);
      buf.rect(-tw / 2 + 1, ty + 2, tw - 2, th, P.apronBase);
      buf.rect(-3, ty, 6, 3, P.apronDark);
    }
    // 12. Railroad Vest & Red Bandana
    else if (V.torso === 'railroad_vest_bandana') {
      buf.rect(-tw / 2, ty, tw, th, P.hickoryBlue);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.vestDenim);
      // Red knotted neckerchief
      buf.rect(-3, ty - 1, 6, 3, P.bandanaRed);
      buf.dot(0, ty + 1, P.bandanaHi);
      // Gold watch chain loop
      buf.steppedLine(-1, ty + 4, 3, ty + 6, P.watchChain, 1);
    }
    // 13. Tweed Vest & Burgundy Tie (Inspector)
    else if (V.torso === 'tweed_vest_tie') {
      buf.rect(-tw / 2, ty, tw, th, P.shirtWhite);
      buf.steppedLine(-2, ty, -2, ty + th, P.pantLight);
      buf.steppedLine(2, ty, 2, ty + th, P.pantLight);
      buf.rect(-tw / 2, ty + 1, tw, th - 1, P.tweedDark);
      buf.rect(-tw / 2 + 1, ty + 2, tw - 2, th - 3, P.tweedBase);
      buf.dot(-3, ty + 3, P.tweedHi);
      buf.dot(3, ty + 3, P.tweedHi);
      buf.dot(-2, ty + 6, P.tweedHi);
      buf.dot(2, ty + 6, P.tweedHi);
      buf.rect(-2, ty + 1, 4, 2, P.shirtWhite);
      buf.rect(-1, ty + 2, 2, 6, P.tieBase);
      buf.dot(0, ty + 2, P.tieLight);
      buf.dot(0, ty + 4, P.monocleBrass);
      buf.dot(0, ty + 6, P.monocleBrass);
    }
    // 14. Corduroy Jacket & Bow Tie (Professor)
    else if (V.torso === 'corduroy_jacket_bowtie') {
      buf.rect(-tw / 2, ty, tw, th, P.jacketDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.jacketBase);
      buf.rect(-2, ty, 4, 4, P.shirtCream);
      buf.rect(-2, ty + 1, 4, 2, P.bowBase); // Bow tie
      buf.dot(0, ty + 1, P.bowDot);
    }
    // 15. Horologist Clockmaker Apron
    else if (V.torso === 'horologist_apron') {
      buf.rect(-tw / 2, ty, tw, th, P.apronDark);
      buf.rect(-tw / 2 + 1, ty + 2, tw - 2, th - 2, P.apronBase);
      buf.rect(-3, ty + 4, 6, 4, P.apronDark);
      buf.dot(-1, ty + 3, P.gearGold);
      buf.dot(1, ty + 3, P.gearSilver);
    }
    // 16. Safari Bush Jacket (Explorer)
    else if (V.torso === 'safari_jacket_canteen') {
      buf.rect(-tw / 2, ty, tw, th, P.jacketDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.jacketBase);
      buf.rect(-4, ty + 2, 3, 3, P.jacketLight); // Bellows pockets
      buf.rect(2, ty + 2, 3, 3, P.jacketLight);
      buf.rect(-4, ty + 6, 3, 3, P.jacketLight);
      buf.rect(2, ty + 6, 3, 3, P.jacketLight);
      // Canteen diagonal strap
      buf.steppedLine(-tw / 2, ty, tw / 2, ty + th, P.strapLeather, 1);
      buf.steppedCircle(tw / 2 - 1, ty + th - 2, 2.4, P.canteenTin);
    }
    // 17. Judicial Robe & White Jabot (Judge)
    else if (V.torso === 'judicial_robe_jabot') {
      buf.rect(-tw / 2 - 1, ty, tw + 2, th + 2, P.robeDark);
      buf.rect(-tw / 2, ty + 1, tw, th, P.robeBase);
      buf.rect(-3, ty, 6, 5, P.jabotWhite); // White lace bib collar
      buf.steppedLine(-2, ty + 3, 2, ty + 3, P.jabotShadow, 1);
    }
    // 18. Scoop Reporter Trench Coat
    else if (V.torso === 'trench_coat_open') {
      buf.rect(-tw / 2, ty, tw, th, '#f4f0e6');
      buf.rect(-tw / 2 - 1, ty, 4, th + 1, P.trenchDark);
      buf.rect(-tw / 2, ty, 3, th, P.trenchBase);
      buf.rect(tw / 2 - 3, ty, 4, th + 1, P.trenchDark);
      buf.rect(tw / 2 - 2, ty, 3, th, P.trenchBase);
    }
    // 19. Toolbelt & Grease Smudge (Mechanic)
    else if (V.torso === 'toolbelt_only') {
      buf.steppedCapsule(-3 * squashX, 0, 3 * squashX, 0, 4.0 * squashY, skin.mid);
      buf.dot(-2, -1, P.greaseDark);
      buf.dot(-1, 0, P.greaseDark);
      buf.rect(-tw / 2, 4 * squashY, tw, 3, P.leatherDark);
      buf.rect(-tw / 2, 4 * squashY, tw, 2, P.leatherBase);
      buf.rect(-2, 4 * squashY, 4, 3, P.buckle);
      buf.rect(-tw / 2 - 1, 4 * squashY + 1, 3, 4, P.leatherDark);
      buf.rect(-tw / 2, 4 * squashY - 2, 2, 3, '#cf8532');
    }
    // 20. Aviator Bomber Jacket (Pilot)
    else if (V.torso === 'bomber_jacket_shearling') {
      buf.rect(-tw / 2, ty, tw, th, P.leatherDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.leatherBase);
      buf.rect(-tw / 2 - 1, ty - 1, tw + 2, 3, P.shearlingLight); // Shearling collar
      buf.rect(-tw / 2, ty + th - 2, tw, 2, P.shearlingLight);
    }
    // 21. Canvas Dive Suit with Brass Breastplate (Scuba)
    else if (V.torso === 'dive_suit_breastplate') {
      buf.rect(-tw / 2 - 1, ty, tw + 2, th + 1, P.suitDark);
      buf.rect(-tw / 2, ty + 1, tw, th - 1, P.suitBase);
      buf.steppedCircle(0, ty + 3, 4.2, P.brassDark);
      buf.steppedCircle(0, ty + 3, 3.2, P.brassBase);
      buf.dot(0, ty + 3, P.brassHi);
    }
    // 22. Steampunk Waistcoat & Boiler Gauge
    else if (V.torso === 'steampunk_vest_boiler') {
      buf.rect(-tw / 2, ty, tw, th, P.hatDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.vestBase);
      buf.steppedCircle(2, ty + 3, 3.2, P.cogBrass);
      buf.steppedCircle(2, ty + 3, 2.2, P.gaugeWhite);
      buf.dot(2, ty + 3, '#101014');
    }
    // 23. Radio Harness
    else if (V.torso === 'radio_harness_pack') {
      buf.rect(-tw / 2, ty, tw, th, '#282e22');
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.fatigueBase);
      buf.steppedLine(-tw / 2, ty, tw / 2, ty + th, '#202418', 2);
      buf.steppedLine(tw / 2, ty, -tw / 2, ty + th, '#202418', 2);
    }
    // 24. Alchemist Robe & Potion Bandolier
    else if (V.torso === 'alchemist_robe_phials') {
      buf.rect(-tw / 2 - 1, ty, tw + 2, th + 3, P.robeDark);
      buf.rect(-tw / 2, ty + 1, tw, th + 1, P.robeBase);
      buf.dot(-3, ty + th, P.runeGold);
      buf.dot(3, ty + th, P.runeGold);
      // Bandolier with glowing phials
      buf.steppedLine(-tw / 2, ty + 1, tw / 2, ty + th, P.bandolier, 2);
      buf.dot(-1, ty + 3, P.vialGreen);
      buf.dot(1, ty + 5, P.vialCyan);
    }
    // 25. Sailor Marinière Striped Jersey
    else if (V.torso === 'striped_mariniere') {
      buf.rect(-6 * squashX, ty - 1, 12 * squashX, 3, P.sailorNavy);
      buf.rect(-tw / 2, ty, tw, th, P.sailorNavy);
      buf.rect(-tw / 2, ty + 2, tw, 2, P.stripeWhite);
      buf.rect(-tw / 2, ty + 6, tw, 2, P.stripeWhite);
      buf.rect(-tw / 2, ty + 10, tw, 1, P.stripeWhite);
      buf.rect(-2, ty + 1, 4, 3, P.scarfDark);
      buf.rect(-1, ty + 1, 2, 2, P.scarfBase);
      buf.dot(0, ty + 1, P.scarfLight);
    }
    // 26. Pirate Open Naval Coat & Sash
    else if (V.torso === 'pirate_coat_sash') {
      buf.rect(-tw / 2, ty, tw, th, '#f4ece0');
      buf.rect(-tw / 2 - 1, ty, 3, th, P.coatNavy);
      buf.rect(tw / 2 - 2, ty, 3, th, P.coatNavy);
      buf.rect(-tw / 2, 3 * squashY, tw, 4, P.sashRed);
      buf.rect(-tw / 2, 4 * squashY, tw, 2, P.sashHi);
    }
    // 27. Chef Double-Breasted Jacket
    else if (V.torso === 'chef_coat_buttons') {
      buf.rect(-tw / 2, ty, tw, th, P.coatShade);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.coatWhite);
      buf.rect(-2, ty, 4, 2, P.scarfRed);
      buf.dot(-2, ty + 3, P.buttonDark);
      buf.dot(1, ty + 3, P.buttonDark);
      buf.dot(-2, ty + 6, P.buttonDark);
      buf.dot(1, ty + 6, P.buttonDark);
    }
    // 28. Magician Tuxedo & Evening Cape
    else if (V.torso === 'tuxedo_cape_crimson') {
      buf.rect(-tw / 2, ty, tw, th, P.tuxBase);
      buf.rect(-3, ty, 6, 6, P.shirtWhite);
      buf.rect(-2, ty + 1, 4, 2, P.ribbonRed);
    }
    // 29. Ninja Shinobi Shozoku Gi
    else if (V.torso === 'shinobi_gi_straps') {
      buf.rect(-tw / 2, ty, tw, th, P.giDark);
      buf.rect(-tw / 2 + 1, ty + 1, tw - 2, th - 2, P.giBase);
      buf.steppedLine(-tw / 2, ty, tw / 2, ty + th - 2, P.wrapDark, 2);
      buf.steppedLine(tw / 2, ty, -tw / 2, ty + th - 2, P.wrapDark, 2);
      buf.rect(-tw / 2, 4 * squashY, tw, 2, P.wrapDark);
    }
    // 30. Cowboy Cowhide Vest & Bandana
    else if (V.torso === 'cowhide_vest_bandana') {
      buf.rect(-tw / 2, ty, tw, th, P.chambray);
      buf.rect(-tw / 2 - 1, ty + 1, 4, th - 1, P.vestBrown);
      buf.dot(-tw / 2 + 1, ty + 3, P.vestWhite);
      buf.rect(tw / 2 - 3, ty + 1, 4, th - 1, P.vestBrown);
      buf.dot(tw / 2 - 2, ty + 4, P.vestWhite);
      buf.rect(-3, ty, 6, 3, P.bandanaRed);
      buf.dot(0, ty + 2, P.bandanaRed);
    }

    ctx.restore();
  }

  /**
   * Layer F: Arms & Forearms
   */
  function drawArmAndWrist(buf, ctx, V, P, armCoords, isFront, params) {
    const { squashX = 1, squashY = 1 } = params;
    const fur = V.fur;
    const skin = V.skin;
    const shoulderX = (isFront ? 5 : -5) * squashX;
    const shoulderY = -2 * squashY;
    const ax = Math.round(armCoords[0]);
    const ay = Math.round(armCoords[1]);
    const rLimb = isFront ? 3.0 : 2.8;

    // Upper arm sleeve / fur
    buf.steppedCapsule(shoulderX, shoulderY, ax, ay, rLimb, fur.shadow);
    buf.steppedCapsule(shoulderX, shoulderY, ax, ay, rLimb - 0.8, fur.base);

    // Hand paw
    buf.steppedCircle(ax, ay + 1, 2.2, skin.mid);

    // Wrist accessories
    if (V.hands === 'sweatbands_white') {
      buf.rect(ax - 2, ay - 2, 4, 3, P.trimWhite);
      buf.rect(ax - 2, ay - 1, 4, 1, P.trimBase);
    } else if (V.hands === 'wrapped_tape') {
      buf.rect(ax - 2, ay - 2, 4, 3, '#c0cad4');
      buf.rect(ax - 2, ay - 1, 4, 2, '#ffffff');
    } else if (V.hands === 'chalked_paws') {
      buf.steppedCircle(ax, ay + 1, 2.2, '#ffffff');
      buf.dot(ax + 1, ay, '#ffffff');
    } else if (V.hands === 'wrist_guards') {
      buf.rect(ax - 2, ay - 2, 4, 3, P.padDark);
      buf.dot(ax, ay - 1, '#788494');
    } else if (V.hands === 'welding_gauntlets') {
      buf.rect(ax - 3, ay - 3, 6, 5, P.gauntletDark);
      buf.rect(ax - 2, ay - 2, 5, 4, P.gauntletBase);
    } else if (V.hands === 'rolled_cream_sleeves') {
      buf.rect(ax - 3, ay - 3, 5, 3, P.shirtLight);
      buf.rect(ax - 3, ay - 1, 5, 1, P.shirtDark);
    } else if (V.hands === 'white_magician_gloves') {
      buf.steppedCircle(ax, ay + 1, 2.4, P.gloveWhite);
    } else if (V.hands === 'ninja_arm_wraps') {
      buf.rect(ax - 2, ay - 2, 4, 3, P.wrapDark);
    } else if (V.hands === 'inky_black_paws') {
      buf.dot(ax, ay + 1, P.inkBlack);
      buf.dot(ax - 1, ay + 1, P.inkBlack);
    }
  }

  /**
   * Layer G: Handheld Props & Action Items
   */
  function drawHandheldProp(buf, ctx, V, P, armCoords, params) {
    const { spark = false, glint = false, leverGrip = 0, ribbonTug = 0 } = params;
    const ax = Math.round(armCoords[0]);
    const ay = Math.round(armCoords[1]);

    // 1. Escapement Wrench & contact sparks
    if (V.prop === 'steel_wrench_spark') {
      const wAngle = params.wrenchAngle || 0.4;
      const wx = ax + Math.round(Math.cos(wAngle) * 8);
      const wy = ay + Math.round(Math.sin(wAngle) * 8);
      buf.steppedLine(ax, ay, wx, wy, P.steelDark, 3);
      buf.steppedLine(ax, ay, wx, wy, P.steelMid, 1);
      buf.steppedLine(ax, ay, wx, wy, P.steelSpec, 1);
      buf.steppedCircle(wx, wy, 3.4, P.steelDark);
      buf.steppedCircle(wx, wy, 2.4, P.steelMid);
      buf.dot(wx, wy, '#0a0d10');
      buf.dot(wx + 1, wy - 1, P.steelSpec);
      if (spark) {
        buf.dot(wx + 3, wy - 3, P.sparkYellow);
        buf.dot(wx + 4, wy - 4, '#ffffff');
        buf.dot(wx + 5, wy - 2, P.sparkOrange);
        buf.dot(wx + 2, wy - 5, P.sparkYellow);
      }
    }

    // 2. Brass Magnifying Glass (Inspector)
    if (V.prop === 'magnifying_glass') {
      const gx = ax + 5, gy = ay - 4;
      buf.steppedLine(ax, ay, gx - 2, gy + 3, P.tweedDark, 2);
      buf.steppedLine(ax, ay, gx - 2, gy + 3, P.monocleBrass, 1);
      buf.steppedCircle(gx, gy, 4.8, P.tweedDark);
      buf.steppedCircle(gx, gy, 4.0, P.monocleBrass);
      buf.steppedCircle(gx, gy, 2.8, P.glassTint);
      if (glint || params.expr === 'inspect') {
        buf.dot(gx - 1, gy - 2, '#ffffff');
        buf.dot(gx - 2, gy - 1, '#ffffff');
      }
    }

    // 3. Blacksmith Iron Forging Tongs
    if (V.prop === 'iron_tongs') {
      buf.steppedLine(ax, ay, ax + 6, ay - 6, P.ironDark, 2);
      buf.steppedLine(ax, ay, ax + 8, ay - 4, P.ironDark, 2);
      buf.dot(ax + 7, ay - 7, '#ff6a24'); // Glowing red-hot rivet in tongs!
    }

    // 4. Folding Carpenter Ruler
    if (V.prop === 'folding_ruler') {
      buf.steppedLine(ax, ay, ax + 5, ay - 5, P.rulerYellow, 2);
      buf.dot(ax + 2, ay - 2, '#18181a');
      buf.dot(ax + 4, ay - 4, '#18181a');
    }

    // 5. Arc Welder Contact Sparks
    if (V.prop === 'arc_sparks' && spark) {
      buf.dot(ax + 4, ay - 2, P.sparkCol);
      buf.dot(ax + 5, ay - 3, '#ffffff');
      buf.dot(ax + 6, ay - 1, '#ffaa34');
      buf.dot(ax + 3, ay - 4, '#ffffff');
    }

    // 6. Horologist Watchmaker Tweezers
    if (V.prop === 'watchmaker_tweezers') {
      buf.steppedLine(ax, ay, ax + 5, ay - 4, P.loupeBrass, 1);
      buf.steppedLine(ax, ay, ax + 5, ay - 6, P.loupeBrass, 1);
      buf.dot(ax + 6, ay - 5, P.gearGold); // Holding tiny gear
    }

    // 7. Magistrate Brass Gavel
    if (V.prop === 'brass_gavel') {
      buf.steppedLine(ax, ay, ax + 4, ay - 5, P.gavelWood, 2);
      buf.rect(ax + 2, ay - 8, 5, 3, P.gavelBrass);
      buf.dot(ax + 3, ay - 8, '#ffffff');
    }

    // 8. Reporter Notebook & Pencil
    if (V.prop === 'reporter_notebook') {
      buf.rect(ax + 2, ay - 6, 6, 8, P.noteCover);
      buf.rect(ax + 3, ay - 5, 4, 6, P.notePaper);
      buf.steppedLine(ax - 1, ay, ax + 3, ay - 2, P.pencil, 1);
      buf.dot(ax + 4, ay - 3, '#101014');
    }

    // 9. Alchemist Bubbling Test Tube
    if (V.prop === 'bubbling_test_tube') {
      buf.rect(ax + 3, ay - 6, 3, 8, '#d4e6f4');
      buf.rect(ax + 4, ay - 4, 1, 5, P.vialMagenta);
      buf.dot(ax + 4, ay - 7, P.vaporBubble);
      buf.dot(ax + 5, ay - 9, P.vaporBubble);
    }

    // 10. Sailor Tangled Ribbon Loop
    if (V.prop === 'tangled_ribbon_strand') {
      const tugX = Math.round(ribbonTug * 6);
      ctx.strokeStyle = P.ribbonRed;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ax - 10, ay);
      ctx.quadraticCurveTo(ax + tugX, ay - 6, ax + 8, ay + 6);
      ctx.stroke();
      ctx.strokeStyle = P.ribbonBlack;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ax - 10, ay + 2);
      ctx.quadraticCurveTo(ax + tugX, ay - 4, ax + 8, ay + 8);
      ctx.stroke();
    }

    // 11. Pirate Steel Cutlass
    if (V.prop === 'cutlass_blade') {
      buf.steppedLine(ax, ay, ax + 3, ay - 3, P.galloonGold, 2); // Guard
      buf.steppedLine(ax + 3, ay - 3, ax + 9, ay - 9, P.cutlassSteel, 2);
      buf.dot(ax + 9, ay - 10, '#ffffff');
    }

    // 12. Pastry Chef Wooden Spoon
    if (V.prop === 'wooden_mixing_spoon') {
      buf.steppedLine(ax, ay, ax + 4, ay - 6, P.spoonWood, 1);
      buf.steppedCircle(ax + 5, ay - 7, 2.0, P.spoonWood);
    }

    // 13. Magician Star-Tipped Wand
    if (V.prop === 'magic_wand_star') {
      buf.steppedLine(ax, ay, ax + 6, ay - 6, P.wandEbony, 1);
      buf.dot(ax + 7, ay - 7, P.wandTip);
      buf.dot(ax + 8, ay - 8, P.sparkleGold);
      buf.dot(ax + 9, ay - 6, '#ffffff');
    }

    // Carriage Slammer Lever Ball Knob
    if (leverGrip > 0 && V.id === 'v07') {
      buf.steppedCircle(ax + 2, ay - 2, 3.5, P.brassDark);
      buf.steppedCircle(ax + 2, ay - 2, 2.5, P.brassLight);
      buf.dot(ax + 2, ay - 3, P.brassLight);
    }
  }

  /**
   * Layer H: Head, Hats, Facial Features & Eyewear
   */
  function drawHeadAndHeadgear(buf, ctx, V, P, params) {
    const { headY = 0, headTilt = 0, expr = 'determined', glint = false } = params;
    const fur = V.fur;
    const skin = V.skin;

    ctx.save();
    const hTiltX = Math.round(headTilt * 5);
    ctx.translate(hTiltX, Math.round(headY));

    // 1. Ears
    buf.steppedCircle(-8.5, -4, 4.0, fur.shadow);
    buf.steppedCircle(-8.5, -4, 3.0, fur.base);
    buf.steppedCircle(-8.5, -4, 1.8, skin.base);
    buf.steppedCircle(8.5, -4, 4.0, fur.shadow);
    buf.steppedCircle(8.5, -4, 3.0, fur.base);
    buf.steppedCircle(8.5, -4, 1.8, skin.base);

    // Ear Accessories
    if (!params.hat && V.headgear === 'bakelite_headphones') {               // GAME: a worn hat replaces the headphones
      // Big retro radio headphones over ears
      buf.steppedCircle(-9, -4, 4.8, P.phoneDark);
      buf.steppedCircle(-9, -4, 3.6, P.phoneBase);
      buf.steppedCircle(9, -4, 4.8, P.phoneDark);
      buf.steppedCircle(9, -4, 3.6, P.phoneBase);
      // Steel headband across crown
      buf.steppedLine(-8, -10, 8, -10, P.bandSteel, 2);
    } else if (V.headgear === 'pirate_tricorn') {
      // Gold hoop earring on right ear
      buf.dot(9, -2, P.earringGold);
      buf.dot(10, -2, P.earringGold);
      buf.dot(9, -1, P.earringGold);
    }

    // 2. Skull Dome
    buf.steppedCircle(0, -6, 7.8, fur.shadow);
    buf.steppedCircle(0, -6, 7.0, fur.base);
    buf.steppedCircle(0, -7.5, 5.5, fur.light);

    // 3. Wigs / Hair Features
    if (!params.hat && V.headgear === 'barrister_wig') {                       // GAME: ...and the wig
      // White powdered barrister wig
      buf.steppedCircle(0, -7, 8.2, P.wigDark);
      buf.steppedCircle(0, -7, 7.4, P.wigBase);
      buf.steppedCircle(0, -8, 6.0, P.wigLight);
      // Side curls
      buf.rect(-9, -7, 3, 8, P.wigBase);
      buf.rect(7, -7, 3, 8, P.wigBase);
      buf.dot(-9, -3, P.wigLight);
      buf.dot(9, -3, P.wigLight);
    } else if (V.headgear === 'silver_temples') {
      // Distinguished silver temples
      buf.dot(-6, -6, P.tweedHi);
      buf.dot(-6, -7, '#ffffff');
      buf.dot(6, -6, P.tweedHi);
      buf.dot(6, -7, '#ffffff');
    }

    // 4. Hats & Headgear
    if (params.hat) {
      /* GAME: drawn after the face instead (see drawGameHat) */
    } else if (V.headgear === 'headband_flutter') {
      buf.rect(-7, -11, 14, 4, P.gearDark);
      buf.rect(-7, -10, 14, 2, P.gearBase);
      buf.rect(-7, -10, 14, 1, P.gearHi);
      buf.rect(-1, -10, 3, 2, P.trimWhite);
    } else if (V.headgear === 'sweatband_blue') {
      buf.rect(-7, -11, 14, 3, P.gearDark);
      buf.rect(-7, -10, 14, 2, P.gearBase);
    } else if (V.headgear === 'snapback_backwards') {
      buf.rect(-7, -11, 14, 5, P.capCrown);
      buf.rect(-8, -8, 4, 3, P.capBrim); // Flat visor turned backwards
    } else if (V.headgear === 'cycling_cap_vintage') {
      buf.rect(-7, -11, 14, 4, P.capBase);
      buf.rect(-1, -11, 2, 4, P.capStripe1);
      buf.rect(3, -9, 5, 2, P.capBase); // Flipped up visor
    } else if (V.headgear === 'lucha_mask_cyan') {
      buf.steppedCircle(0, -6, 7.8, P.maskDark);
      buf.steppedCircle(0, -6, 7.0, P.maskBase);
      buf.steppedCircle(0, -7.5, 5.5, P.maskLight);
    } else if (V.headgear === 'mining_hardhat_yellow') {
      buf.rect(-8, -12, 16, 5, P.hatDark);
      buf.rect(-7, -12, 14, 4, P.hatBase);
      buf.rect(-6, -13, 12, 1, P.hatLight);
      // Carbide lamp & beam
      buf.rect(-2, -10, 4, 3, P.lampBrass);
      buf.dot(0, -9, P.lampBeam);
      buf.dot(2, -8, P.lampBeam);
      buf.dot(4, -7, P.lampBeam);
    } else if (V.headgear === 'engineer_cap_hickory') {
      buf.rect(-8, -13, 16, 6, P.hickoryBlue);
      buf.rect(-8, -13, 16, 5, P.hickoryWhite);
      buf.rect(-8, -8, 16, 2, P.hickoryBlue);
      for (let s = -6; s <= 6; s += 3) {
        buf.steppedLine(s, -13, s, -8, P.hickoryBlue, 1);
      }
    } else if (V.headgear === 'pith_helmet') {
      buf.steppedCircle(0, -10, 8.0, P.pithDark);
      buf.steppedCircle(0, -10, 7.0, P.pithBase);
      buf.rect(-10, -7, 20, 2, P.pithLight); // Broad brim
      buf.rect(-7, -8, 14, 1, P.pithBand);   // Leather band
      buf.dot(0, -13, P.pithDark);           // Ventilation spike
    } else if (V.headgear === 'fedora_press') {
      buf.rect(-8, -13, 16, 5, P.fedoraDark);
      buf.rect(-7, -13, 14, 4, P.fedoraBase);
      buf.rect(-10, -8, 20, 2, P.fedoraDark); // Fedora brim
      buf.rect(-7, -9, 14, 1, P.fedoraBand);  // Hatband
      buf.rect(3, -11, 4, 3, P.pressCard);    // White PRESS card
      buf.dot(4, -10, P.pressText);
    } else if (V.headgear === 'bandana_orange') {
      buf.rect(-7, -10, 14, 4, P.bandanaDark);
      buf.rect(-7, -9, 14, 2, P.bandanaBase);
      buf.rect(-7, -9, 14, 1, P.bandanaHi);
      buf.dot(-2, -12, fur.light);
      buf.dot(0, -12, fur.mid);
    } else if (V.headgear === 'aviator_cap_leather') {
      buf.rect(-8, -11, 16, 5, P.leatherDark);
      buf.rect(-7, -11, 14, 4, P.leatherBase);
      // Flight goggles strapped on brow
      buf.rect(-6, -9, 12, 3, P.leatherDark);
      buf.steppedCircle(-3, -8, 2.4, P.goggleBrass);
      buf.steppedCircle(3, -8, 2.4, P.goggleBrass);
      buf.dot(-3, -8, P.goggleLens);
      buf.dot(3, -8, P.goggleLens);
    } else if (V.headgear === 'brass_dive_helmet') {
      // Complete spherical brass dive helmet
      buf.steppedCircle(0, -6, 9.2, P.brassDark);
      buf.steppedCircle(0, -6, 8.2, P.brassBase);
      buf.steppedCircle(0, -7.5, 6.5, P.brassLight);
      // Circular barred front porthole
      buf.steppedCircle(0, -5, 4.4, P.brassDark);
      buf.steppedCircle(0, -5, 3.4, P.portholeGlass);
      buf.steppedLine(-3, -5, 3, -5, P.brassDark, 1); // Crossbars
      buf.steppedLine(0, -8, 0, -2, P.brassDark, 1);
      buf.dot(-1, -6, '#ffffff'); // Specular glint
      // Top lifting ring
      buf.rect(-2, -12, 4, 2, P.brassBase);
      ctx.restore();
      return; // Scuba face is inside the helmet porthole!
    } else if (V.headgear === 'steampunk_tophat_cogs') {
      // Tall stovepipe top hat with brass cogs
      buf.rect(-6, -16, 12, 9, P.hatDark);
      buf.rect(-5, -16, 10, 8, P.hatBase);
      buf.rect(-8, -8, 16, 2, P.hatDark); // Brim
      buf.steppedCircle(-2, -11, 2.4, P.cogBrass);
      buf.dot(-2, -11, P.cogHi);
      buf.steppedCircle(2, -13, 2.0, P.cogBrass);
    } else if (V.headgear === 'alchemist_cowl') {
      buf.rect(-8, -12, 16, 6, P.robeDark);
      buf.rect(-7, -12, 14, 5, P.robeBase);
      buf.dot(0, -14, P.robeDark); // Pointed tip
    } else if (V.headgear === 'pirate_tricorn') {
      buf.rect(-10, -11, 20, 4, P.tricornDark);
      buf.rect(-8, -11, 16, 3, P.tricornBase);
      buf.rect(-10, -11, 20, 1, P.galloonGold); // Gold galloon trim
      buf.dot(0, -10, P.skullWhite);            // Jolly roger skull
    } else if (V.headgear === 'toque_blanche_tall') {
      // Tall pleated white toque blanche chef hat
      buf.rect(-7, -17, 14, 10, P.toqueShade);
      buf.rect(-6, -17, 12, 9, P.toqueWhite);
      buf.rect(-7, -8, 14, 2, P.toqueShade);
      buf.steppedLine(-3, -16, -3, -9, P.toqueShade, 1);
      buf.steppedLine(0, -16, 0, -9, P.toqueShade, 1);
      buf.steppedLine(3, -16, 3, -9, P.toqueShade, 1);
    } else if (V.headgear === 'magician_tophat') {
      // Glossy black satin top hat with crimson ribbon
      buf.rect(-6, -16, 12, 9, P.hatDark);
      buf.rect(-5, -16, 10, 8, P.hatBase);
      buf.rect(-5, -16, 2, 7, P.hatLight); // Silk shine
      buf.rect(-8, -8, 16, 2, P.hatDark);
      buf.rect(-6, -9, 12, 2, P.ribbonRed); // Crimson band
      buf.dot(-3, -9, P.ribbonHi);
    } else if (V.headgear === 'shinobi_cowl_plate') {
      buf.steppedCircle(0, -6, 7.8, P.giDark);
      buf.steppedCircle(0, -6, 7.0, P.giBase);
      // Metal forehead protector plate
      buf.rect(-5, -10, 10, 3, P.plateIron);
      buf.rect(-4, -10, 8, 2, P.plateHi);
      buf.dot(0, -9, P.giDark); // Engraved emblem
    } else if (V.headgear === 'stetson_cowboy_hat') {
      // Wide-brimmed tan felt Stetson cowboy hat
      buf.rect(-6, -15, 12, 8, P.stetsonDark);
      buf.rect(-5, -15, 10, 7, P.stetsonBase);
      buf.rect(-11, -8, 22, 2, P.stetsonDark); // Wide curved brim
      buf.rect(-10, -9, 20, 1, P.stetsonLight);
      buf.rect(-5, -9, 10, 1, P.hatBand);
    }

    // 5. Muzzle & Facial Skin
    buf.steppedCircle(-2.8, -5, 3.8, skin.dark);
    buf.steppedCircle(2.8, -5, 3.8, skin.dark);
    buf.steppedCapsule(-2.5, -3, 2.5, -3, 4.2, skin.base);
    buf.steppedCapsule(-2.0, -2, 2.0, -2, 3.2, skin.light);

    // 6. Facial Markings & Details
    if (V.facial === 'grease_smudge') {
      buf.dot(-3, -2, P.greaseDark);
      buf.dot(-4, -1, P.greaseDark);
      buf.dot(3, -7, P.greaseDark);
    } else if (V.facial === 'soot_smudge') {
      buf.dot(-2, -2, P.soot);
      buf.dot(2, -3, P.soot);
    } else if (V.facial === 'coal_dust_smudges') {
      buf.dot(-3, -3, P.coalDust);
      buf.dot(3, -2, P.coalDust);
      buf.dot(0, -1, P.coalDust);
    } else if (V.facial === 'curled_mustache') {
      buf.rect(-4, -1, 8, 2, P.mustache);
      buf.dot(-4, -2, P.mustache);
      buf.dot(3, -2, P.mustache);
    } else if (V.facial === 'neat_mustache') {
      buf.rect(-3, -1, 6, 2, fur.dark);
    } else if (V.facial === 'trimmed_whiskers') {
      buf.dot(-4, -1, fur.dark);
      buf.dot(3, -1, fur.dark);
    } else if (V.facial === 'ink_on_nose') {
      buf.dot(0, -2, P.inkBlack);
    } else if (V.facial === 'cowl_mask_covered') {
      // Ninja lower cloth cowl mask covering mouth/snout
      buf.rect(-5, -3, 10, 4, P.giDark);
      buf.rect(-4, -2, 8, 3, P.giBase);
    }

    // 7. Eyes & Eyewear
    if (V.eyewear === 'monocle_brass') {
      // Left eye normal
      buf.rect(-5, -6, 3, 2, COMMON_PALETTES.eyeWhite);
      buf.rect(-4, -6, 2, 2, COMMON_PALETTES.pupilBlack);
      buf.dot(-4, -6, COMMON_PALETTES.eyeWhite);
      // Right eye with brass monocle
      buf.steppedCircle(3.5, -5.5, 3.2, P.tweedDark);
      buf.steppedCircle(3.5, -5.5, 2.4, P.monocleBrass);
      buf.rect(2, -7, 3, 3, COMMON_PALETTES.eyeWhite);
      buf.dot(3, -6, COMMON_PALETTES.pupilBlack);
      if (glint || expr === 'inspect') {
        buf.dot(2, -7, '#ffffff');
        buf.dot(4, -5, '#ffffff');
      }
      buf.dot(5, -4, P.monocleBrass);
      buf.dot(4, -2, P.monocleBrass);
    } else if (V.eyewear === 'round_spectacles') {
      buf.steppedCircle(-3.5, -5.5, 2.8, P.glassGold);
      buf.steppedCircle(3.5, -5.5, 2.8, P.glassGold);
      buf.rect(-4, -6, 2, 2, COMMON_PALETTES.pupilBlack);
      buf.rect(3, -6, 2, 2, COMMON_PALETTES.pupilBlack);
      buf.dot(-4, -6, P.glassGlint);
      buf.dot(3, -6, P.glassGlint);
      buf.dot(0, -5, P.glassGold); // Bridge
    } else if (V.eyewear === 'eyepatch_left') {
      // Black eyepatch over left eye
      buf.rect(-5, -7, 4, 4, P.patchLeather);
      buf.steppedLine(-6, -8, 0, -4, P.patchLeather, 1); // Strap
      // Right eye fierce
      buf.rect(2, -6, 3, 2, COMMON_PALETTES.eyeWhite);
      buf.rect(3, -6, 2, 2, COMMON_PALETTES.pupilBlack);
      buf.dot(3, -6, COMMON_PALETTES.eyeWhite);
    } else if (V.eyewear === 'large_anime_sparkle') {
      // 5x5 sparkling eyes with double catchlights
      buf.rect(-5, -7, 4, 4, COMMON_PALETTES.eyeWhite);
      buf.rect(1, -7, 4, 4, COMMON_PALETTES.eyeWhite);
      buf.rect(-4, -7, 3, 3, P.eyePupil);
      buf.rect(2, -7, 3, 3, P.eyePupil);
      buf.dot(-4, -7, P.eyeHighlight);
      buf.dot(-3, -6, P.eyeHighlight);
      buf.dot(2, -7, P.eyeHighlight);
      buf.dot(3, -6, P.eyeHighlight);
    } else if (V.eyewear === 'piercing_ninja_slit') {
      buf.rect(-5, -6, 3, 1, '#ffffff');
      buf.rect(2, -6, 3, 1, '#ffffff');
      buf.dot(-4, -6, '#101014');
      buf.dot(3, -6, '#101014');
    } else if (V.eyewear === 'lucha_star_eyes') {
      buf.dot(-4, -7, P.goldLight);
      buf.dot(-5, -6, P.goldLight);
      buf.dot(-3, -6, P.goldLight);
      buf.dot(-4, -5, P.goldLight);
      buf.dot(3, -7, P.goldLight);
      buf.dot(2, -6, P.goldLight);
      buf.dot(4, -6, P.goldLight);
      buf.dot(3, -5, P.goldLight);
      buf.dot(-4, -6, '#0c0808');
      buf.dot(3, -6, '#0c0808');
    } else {
      // Standard expressive eyes
      if (expr === 'screech' || expr === 'roaring') {
        buf.rect(-5, -7, 4, 3, COMMON_PALETTES.eyeWhite);
        buf.rect(1, -7, 4, 3, COMMON_PALETTES.eyeWhite);
        buf.dot(-3, -6, COMMON_PALETTES.pupilBlack);
        buf.dot(3, -6, COMMON_PALETTES.pupilBlack);
        buf.steppedLine(-6, -8, -1, -7, fur.shadow);
        buf.steppedLine(6, -8, 1, -7, fur.shadow);
      } else if (expr === 'wink') {
        buf.rect(-5, -6, 3, 2, COMMON_PALETTES.pupilBlack);
        buf.dot(-4, -6, COMMON_PALETTES.eyeWhite);
        buf.steppedLine(1, -6, 5, -6, fur.shadow, 1);
      } else {
        buf.rect(-5, -6, 3, 2, COMMON_PALETTES.eyeWhite);
        buf.rect(2, -6, 3, 2, COMMON_PALETTES.eyeWhite);
        buf.rect(-4, -6, 2, 2, COMMON_PALETTES.pupilBlack);
        buf.rect(3, -6, 2, 2, COMMON_PALETTES.pupilBlack);
        buf.dot(-4, -6, COMMON_PALETTES.eyeWhite);
        buf.dot(3, -6, COMMON_PALETTES.eyeWhite);
      }
    }

    // 8. Mouth
    if (V.facial !== 'cowl_mask_covered') {
      if (expr === 'screech' || expr === 'roaring') {
        buf.rect(-3, 0, 6, 3, COMMON_PALETTES.mouthDark);
        buf.rect(-2, 0, 4, 1, COMMON_PALETTES.eyeWhite);
        buf.dot(0, 2, COMMON_PALETTES.tonguePink);
      } else if (expr === 'giggle') {
        buf.rect(-2, 0, 5, 2, COMMON_PALETTES.mouthDark);
        buf.dot(0, 1, COMMON_PALETTES.tonguePink);
      } else {
        buf.steppedLine(-3, 0, 3, 0, skin.dark);
        buf.dot(2, 0, skin.dark);
      }
    }
    if (params.hat) drawGameHat(buf, params.hat);

    ctx.restore();
  }

  /* GAME: the award hats from ops.js HATS, sized to the 64px head (skull dome centre 0,-6, radius 7.8) */
  const HAT = { ink: '#1a0f14', inkL: '#3a2a30', red: '#b8322a', redL: '#e86a50', gold: '#ffd23a', goldD: '#c98f0e', blue: '#2e44a8', blueL: '#5470d8', white: '#fff6d6' };
  function drawGameHat(buf, id) {
    if (id === 2) {                                               // top hat
      buf.rect(-9, -14, 18, 2, HAT.ink); buf.rect(-5, -23, 10, 9, HAT.ink); buf.rect(-5, -17, 10, 2, HAT.red); buf.rect(-4, -22, 1, 4, HAT.inkL);
    } else if (id === 3) {                                        // party cone
      for (let r = 0; r < 11; r++) { const w = Math.max(1, Math.round(10 - r * .9)); buf.rect(-Math.floor(w / 2), -14 - r, w, 1, r % 4 === 1 ? HAT.gold : HAT.red); }
      buf.steppedCircle(0, -26, 1.6, HAT.gold);
    } else if (id === 4) {                                        // beret
      buf.steppedCircle(0, -14, 7.5, HAT.blue); buf.rect(-8, -13, 16, 3, HAT.blue); buf.rect(-5, -18, 6, 1, HAT.blueL); buf.rect(0, -23, 1, 2, HAT.blue);
    } else if (id === 5) {                                        // crown
      buf.rect(-7, -17, 14, 4, HAT.gold); [-7, -2, 3].forEach(x => buf.rect(x, -20, 2, 3, HAT.gold)); buf.rect(6, -20, 1, 3, HAT.gold);
      buf.rect(-7, -14, 14, 1, HAT.goldD); buf.dot(0, -16, HAT.red); buf.dot(-4, -16, HAT.blueL); buf.dot(4, -16, HAT.blueL);
    } else if (id === 6) {                                        // baseball cap
      buf.steppedCircle(0, -13, 7.2, HAT.red); buf.rect(-8, -13, 16, 2, HAT.red); buf.rect(2, -12, 10, 2, HAT.ink); buf.rect(-4, -18, 4, 1, HAT.redL);
    } else if (id === 7) {                                        // hibiscus flower
      [[5, -15], [3, -13], [7, -13], [5, -11]].forEach(([x, y]) => buf.steppedCircle(x, y, 1.8, HAT.red)); buf.dot(5, -13, HAT.gold);
    } else if (id === 8) {                                        // graduation cap
      buf.rect(-6, -17, 12, 4, HAT.ink); buf.rect(-11, -19, 22, 2, HAT.ink); buf.rect(-10, -19, 20, 1, HAT.inkL); buf.rect(8, -18, 1, 6, HAT.gold); buf.rect(7, -12, 3, 2, HAT.gold);
    }
  }

  /* ===============================================================
   * 5. MASTER MODULAR 64x64 RENDERER
   * =============================================================== */
  function renderCustomMonkey64(variantId = 'v01', actionState = 'idle', params = {}) {
    const V = getVariant(variantId);
    const P = V.colors;

    const {
      x = 32,
      y = 32,
      facing = 1,
      squashX = 1.0,
      squashY = 1.0,
      bodyTilt = 0,
      headTilt = 0,
      headY = 0,
      expr = 'determined',
      armL = [-11, 8],
      armR = [11, 8],
      legL = [-6, 17],
      legR = [6, 17],
      headbandFlutter = 0,
      squatImpact = false,
      wrenchAngle = 0.4,
      spark = false,
      glint = false,
      leverGrip = 0,
      ribbonTug = 0,
      prop = null,
      hat = 0
    } = params;

    const buf = new PixelBuffer(64, 64);
    const ctx = buf.ctx;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (facing === -1) ctx.scale(-1, 1);

    const renderParams = {
      squashX,
      squashY,
      bodyTilt,
      headTilt,
      headY,
      expr,
      armL,
      armR,
      legL,
      legR,
      headbandFlutter,
      squatImpact,
      wrenchAngle,
      spark,
      glint,
      leverGrip,
      ribbonTug,
      prop,
      hat
    };

    // 1. Back Layer: Accessories & Tails
    drawBackAccessories(buf, ctx, V, P, renderParams);
    drawTail(buf, ctx, V, P, renderParams);

    // 2. Back Leg & Footwear
    drawLegAndFootwear(buf, ctx, V, P, legL, false, renderParams);

    // 3. Torso & Costume
    drawTorsoAndOutfit(buf, ctx, V, P, renderParams);

    // 4. Front Leg & Footwear
    drawLegAndFootwear(buf, ctx, V, P, legR, true, renderParams);

    // Impact dust kickup
    if (squatImpact) {
      buf.dot(legR[0] - 6, legR[1] + 5, P.trimBase || '#c0cad4');
      buf.dot(legR[0] + 6, legR[1] + 5, P.trimBase || '#c0cad4');
      buf.dot(legL[0] - 6, legL[1] + 5, P.trimBase || '#c0cad4');
    }

    // 5. Back Arm & Hand
    drawArmAndWrist(buf, ctx, V, P, armL, false, renderParams);

    // 6. Head, Hat, Eyes & Muzzle
    drawHeadAndHeadgear(buf, ctx, V, P, renderParams);

    // 7. Front Arm & Hand
    drawArmAndWrist(buf, ctx, V, P, armR, true, renderParams);

    // 8. Handheld Props
    drawHandheldProp(buf, ctx, V, P, armR, renderParams);

    // 9. Victory Accessories if requested
    if (prop === 'crown' || prop === 'all') {
      renderCrownAccessory(buf, 0, -12 + headY);
    }
    if (prop === 'banana' || prop === 'all') {
      renderBananaAccessory(buf, armR[0] + 5, armR[1] - 8);
    }

    ctx.restore();
    return buf.canvas;
  }

  /* ===============================================================
   * 6. VICTORY ACCESSORIES
   * =============================================================== */
  function renderCrownAccessory(buf, cx, cy) {
    const P = PALETTES.victory;
    const x = Math.round(cx);
    const y = Math.round(cy);

    buf.rect(x - 6, y, 12, 3, P.crownShadow);
    buf.rect(x - 5, y + 1, 10, 1, P.crownBase);
    buf.rect(x - 5, y, 10, 1, P.crownLight);

    buf.rect(x - 5, y - 3, 2, 3, P.crownBase);
    buf.dot(x - 5, y - 4, P.crownLight);
    buf.rect(x + 3, y - 3, 2, 3, P.crownBase);
    buf.dot(x + 4, y - 4, P.crownLight);
    buf.rect(x - 1, y - 5, 2, 5, P.crownLight);
    buf.dot(x - 1, y - 6, P.crownHi);

    buf.dot(x, y - 3, P.rubyBase);
    buf.dot(x - 1, y - 3, P.rubyHi);
  }

  function renderBananaAccessory(buf, bx, by) {
    const P = PALETTES.victory;
    const x = Math.round(bx);
    const y = Math.round(by);

    buf.steppedCircle(x, y, 3.8, P.bananaDark);
    buf.steppedCircle(x + 1, y - 2, 3.2, P.bananaBase);
    buf.steppedCircle(x + 2, y - 4, 2.6, P.bananaLight);
    buf.dot(x + 2, y - 5, P.bananaHi);

    buf.rect(x - 1, y + 2, 2, 2, P.stemBase);
    buf.dot(x - 1, y + 3, P.stemDark);

    buf.dot(x + 4, y - 6, P.sparkleGold);
    buf.dot(x - 3, y - 4, P.sparkleWhite);
  }

  /* ===============================================================
   * 7. LEGACY CHARACTER RENDERERS (Backwards Compatible)
   * =============================================================== */
  function renderStomper64(params = {}) {
    return renderCustomMonkey64('runner', 'idle', params);
  }

  function renderCarriageSlammer64(params = {}) {
    return renderCustomMonkey64('dockworker', 'slam', params);
  }

  function renderPlatenInspector64(params = {}) {
    return renderCustomMonkey64('inspector', 'roll', params);
  }

  function renderEscapementMechanic64(params = {}) {
    return renderCustomMonkey64('grease_mechanic', 'tap', params);
  }

  function renderRibbonMischief64(params = {}) {
    return renderCustomMonkey64('sailor', 'tug', params);
  }

  function renderVictoryMonkey64(params = {}) {
    const { variant = 'runner', x = 32, y = 32, facing = 1, danceCycle = 0 } = params;
    const bob = Math.abs(Math.sin(danceCycle * Math.PI * 2)) * 6;
    const kick = Math.sin(danceCycle * Math.PI * 2) * 6;
    const tilt = Math.sin(danceCycle * Math.PI * 2) * 0.16;

    const canvas = renderCustomMonkey64(variant, 'dance', {
      x,
      y: y - bob,
      facing,
      squashX: 1.05,
      squashY: 0.95,
      bodyTilt: tilt,
      headTilt: -tilt * 0.8,
      headY: -bob * 0.2,
      expr: 'wink',
      armL: [Math.round(-12), Math.round(-10)], armR: [Math.round(12), Math.round(-12)],
      legL: [Math.round(-5 - kick), Math.round(16 + Math.abs(kick) * 0.5)], legR: [Math.round(5 + kick), Math.round(16 - Math.abs(kick) * 0.5)],
      prop: 'crown'
    });

    const ctx = canvas.getContext('2d');
    const buf = {
      rect: (rx, ry, rw, rh, c) => { ctx.fillStyle = c; ctx.fillRect(rx, ry, rw, rh); },
      dot:  (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect(dx, dy, 1, 1); },
      steppedCircle: (cx, cy, r, c) => {
        ctx.fillStyle = c;
        const x0 = Math.floor(cx - r), y0 = Math.floor(cy - r), x1 = Math.ceil(cx + r), y1 = Math.ceil(cy + r);
        for (let py = y0; py <= y1; py++) {
          for (let px = x0; px <= x1; px++) {
            if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    };

    renderBananaAccessory(buf, x + 15, y - bob - 14);

    const P = PALETTES.victory;
    const spX1 = x - 18 + Math.round(Math.cos(danceCycle * Math.PI * 4) * 4);
    const spY1 = y - 16 + Math.round(Math.sin(danceCycle * Math.PI * 4) * 4);
    buf.dot(spX1, spY1, P.sparkleGold);
    buf.dot(spX1, spY1 - 1, P.sparkleWhite);
    buf.dot(spX1 - 1, spY1, P.sparkleWhite);
    buf.dot(spX1 + 1, spY1, P.sparkleWhite);

    return canvas;
  }

  /* ===============================================================
   * 8. CINEMATIC 20-24 FPS PHYSICAL TYPEWRITER ACTION GENERATORS
   * Fluid sub-frame easing & natural physics curves for all 30 variants.
   * =============================================================== */

  /**
   * Action 1: KEY STOMP (18 frames @ 24 FPS)
   * Anticipation crouch, rocket leap launch, parabolic apex hurdle float, plunging drop,
   * impact squash on keycap, elastic rebound.
   */
  function generateKeyStomp64(variantId = 'runner') {
    const V = getVariant(variantId);
    const frames = [];
    const totalFrames = 18;

    for (let f = 0; f < totalFrames; f++) {
      let squashX = 1.0, squashY = 1.0;
      let yOff = 0;
      let expr = 'determined';
      let armL = [-11, 8], armR = [11, 8];
      let legL = [-6, 17], legR = [6, 17];
      let headbandFlutter = 0;
      let squatImpact = false;

      if (f < 4) {
        // Frames 0-3: Anticipation Squat (Ease in)
        const p = f / 3;
        squashX = 1.0 + p * 0.32;
        squashY = 1.0 - p * 0.32;
        yOff = p * 6;
        expr = 'determined';
        armL = [-13, 10 + p * 2];
        armR = [13, 10 + p * 2];
        legL = [-8, 15];
        legR = [8, 15];
        headbandFlutter = -0.4 * p;
      } else if (f < 7) {
        // Frames 4-6: Rocket Leap Launch
        const p = (f - 4) / 3;
        squashX = 0.82;
        squashY = 1.28;
        yOff = -6 - p * 18;
        expr = 'screech';
        armL = [-12, -10];
        armR = [12, -10];
        legL = [-4, 19];
        legR = [4, 19];
        headbandFlutter = 1.4 + p * 0.4;
      } else if (f < 12) {
        // Frames 7-11: Mid-Air Hurdle Apex Float (Sinusoidal float)
        const p = (f - 7) / 5;
        const floatArc = Math.sin(p * Math.PI);
        squashX = 0.94 + floatArc * 0.06;
        squashY = 1.06 - floatArc * 0.06;
        yOff = -24 - floatArc * 4;
        expr = 'focus';
        armL = [-14, -2];
        armR = [12, 4];
        legL = [-8, 12 + floatArc * 3];
        legR = [6, 18 - floatArc * 2];
        headbandFlutter = Math.sin(p * Math.PI * 2) * 1.8;
      } else if (f < 15) {
        // Frames 12-14: Aerodynamic Plunge Down
        const p = (f - 12) / 3;
        squashX = 0.85;
        squashY = 1.25;
        yOff = -18 + p * 28;
        expr = 'screech';
        armL = [-8, 6];
        armR = [8, 6];
        legL = [-6, 19];
        legR = [6, 19];
        headbandFlutter = 2.0;
      } else if (f < 17) {
        // Frames 15-16: Dual-Foot Impact Squash on Keycap!
        squashX = 1.46;
        squashY = 0.62;
        yOff = 12;
        expr = 'screech';
        armL = [-16, 12];
        armR = [16, 12];
        legL = [-12, 11];
        legR = [12, 11];
        headbandFlutter = -1.6;
        squatImpact = true;
      } else {
        // Frame 17: Rebound Return
        squashX = 1.04;
        squashY = 0.96;
        yOff = 3;
        expr = 'determined';
        armL = [-11, 8];
        armR = [11, 8];
        legL = [-6, 17];
        legR = [6, 17];
        headbandFlutter = 0.2;
      }

      frames.push(renderCustomMonkey64(V.id, 'stomp', {
        x: 32,
        y: 32 + yOff,
        facing: 1,
        squashX,
        squashY,
        bodyTilt: 0,
        headTilt: 0,
        headY: squashY < 0.8 ? 3 : 0,
        expr,
        armL,
        armR,
        legL,
        legR,
        headbandFlutter,
        squatImpact
      }));
    }

    return {
      name: `${V.name}: Key Stomp (64x64)`,
      id: `key_stomp_${V.slug}`,
      variant: V.slug,
      frames,
      fps: 24,
      description: `${V.description} Executes anticipation crouch, rocket leap, hurdle apex float, and dual-foot sneaker impact squash.`
    };
  }

  /**
   * Action 2: CARRIAGE SLAM (20 frames @ 22 FPS)
   * Reach up toward brass return lever, clamping paws, full-body drop and heave pull,
   * smooth carriage ride, release and reset.
   */
  function generateCarriageLever64(variantId = 'dockworker') {
    const V = getVariant(variantId);
    const frames = [];
    const totalFrames = 20;

    for (let f = 0; f < totalFrames; f++) {
      let pull = 0;
      let bodyTilt = 0;
      let headTilt = 0;
      let expr = 'roaring';
      let armL = [-14, 2], armR = [14, -12];
      let leverGrip = 0;

      if (f < 5) {
        // Frames 0-4: Reach up with both hands toward lever
        const p = f / 4;
        pull = p * 0.25;
        bodyTilt = -p * 0.15;
        headTilt = -p * 0.22;
        armL = [-8, -8 - p * 6];
        armR = [12, -10 - p * 8];
        expr = 'clenched';
        leverGrip = 0;
      } else if (f < 9) {
        // Frames 5-8: Clamp paws onto brass lever
        const p = (f - 5) / 4;
        pull = 0.25 + p * 0.25;
        bodyTilt = -0.15 - p * 0.15;
        headTilt = 0.1;
        armL = [6, -14];
        armR = [12, -16];
        expr = 'clenched';
        leverGrip = 1;
      } else if (f < 14) {
        // Frames 9-13: Full-Body Weight Drop & Power Pull!
        const p = (f - 9) / 5;
        pull = 0.5 + p * 0.5;
        bodyTilt = -0.30 - p * 0.28;
        headTilt = 0.25;
        armL = [4 - p * 4, -8 + p * 10];
        armR = [10 - p * 4, -10 + p * 12];
        expr = 'roaring';
        leverGrip = 1;
      } else if (f < 18) {
        // Frames 14-17: Riding the gliding carriage smoothly
        const p = (f - 14) / 4;
        pull = 1.0 - p * 0.65;
        bodyTilt = -0.25 + p * 0.22;
        headTilt = -0.08;
        armL = [-10, 0];
        armR = [8, -4];
        expr = 'smile';
        leverGrip = 0.6;
      } else {
        // Frames 18-19: Lever snap & recovery reset
        pull = 0.08;
        bodyTilt = 0;
        headTilt = 0;
        armL = [-14, 2];
        armR = [14, 2];
        expr = 'clenched';
        leverGrip = 0;
      }

      frames.push(renderCustomMonkey64(V.id, 'slam', {
        x: 32 - pull * 7,
        y: 32 + pull * 3,
        facing: 1,
        squashX: 1.0 + pull * 0.18,
        squashY: 1.0 - pull * 0.18,
        bodyTilt,
        headTilt,
        headY: Math.round(pull * 2),
        expr,
        armL,
        armR,
        leverGrip
      }));
    }

    return {
      name: `${V.name}: Carriage Lever Pull (64x64)`,
      id: `carriage_lever_${V.slug}`,
      variant: V.slug,
      frames,
      fps: 22,
      description: `${V.description} Reaches up to grip brass return lever, drops full body weight to slam the carriage rail, and rides smoothly.`
    };
  }

  /**
   * Action 3: PLATEN ROLL (18 frames @ 22 FPS)
   * Upright walking on rotating platen cylinder, sinusoidal foot clearance,
   * tool examination and lens glints.
   */
  function generateRollerAcrobat64(variantId = 'inspector') {
    const V = getVariant(variantId);
    const frames = [];
    const totalFrames = 18;

    for (let f = 0; f < totalFrames; f++) {
      const step = (f / totalFrames) * Math.PI * 2;
      const legBobL = Math.sin(step) * 4.2;
      const legBobR = Math.sin(step + Math.PI) * 4.2;
      const glint = (f % 5 === 0);

      const legL = [-5, 16 + legBobL];
      const legR = [5, 16 + legBobR];

      frames.push(renderCustomMonkey64(V.id, 'roll', {
        x: 32,
        y: 31 + Math.abs(Math.sin(step * 2)) * 1.6,
        facing: 1,
        squashX: 1.02,
        squashY: 0.98,
        bodyTilt: Math.sin(step) * 0.06,
        headTilt: Math.sin(step) * 0.08,
        headY: 0,
        expr: glint ? 'inspect' : 'smile',
        armL: [Math.round(-12), Math.round(7)], armR: [Math.round(10), Math.round(-3 + Math.sin(step) * 1.6)],
        legL,
        legR,
        glint
      }));
    }

    return {
      name: `${V.name}: Roller Acrobat (64x64)`,
      id: `roller_acrobat_${V.slug}`,
      variant: V.slug,
      frames,
      fps: 22,
      description: `${V.description} Treadmill steps across rubber platen cylinder inspecting typed text with smooth natural footing.`
    };
  }

  /**
   * Action 4: ESCAPEMENT RATCHET TAP (18 frames @ 22 FPS)
   * Perched on gearbox bracket, raising tool/paw, precise strike tap on rotating ratchet cog tooth,
   * contact spark burst, satisfaction recoil.
   */
  function generateEscapementMechanic64(variantId = 'grease_mechanic') {
    const V = getVariant(variantId);
    const frames = [];
    const totalFrames = 18;

    for (let f = 0; f < totalFrames; f++) {
      let tap = 0;
      let expr = 'smile';
      let spark = false;
      let wrenchAngle = 0.4;

      if (f >= 5 && f <= 9) {
        // Strike tap downward
        tap = Math.sin(((f - 5) / 4) * Math.PI);
        wrenchAngle = 0.4 + tap * 0.65;
        if (f === 7 || f === 8) {
          expr = 'tap';
          spark = true;
        }
      } else if (f > 9 && f < 14) {
        // Recoil & smirk
        tap = (14 - f) * 0.08;
        wrenchAngle = 0.4 - tap * 0.25;
        expr = 'smirk';
      }

      frames.push(renderCustomMonkey64(V.id, 'tap', {
        x: 32,
        y: 32 + tap * 2,
        facing: -1,
        squashX: 1.0 + tap * 0.1,
        squashY: 1.0 - tap * 0.1,
        bodyTilt: -tap * 0.15,
        headTilt: tap * 0.12,
        headY: 0,
        expr,
        armL: [Math.round(-7), Math.round(6)], armR: [Math.round(12 + tap * 4), Math.round(-4 - tap * 4)],
        legL: [Math.round(-7), Math.round(16)], legR: [Math.round(5), Math.round(16)],
        wrenchAngle,
        spark
      }));
    }

    return {
      name: `${V.name}: Ratchet Strike Tap (64x64)`,
      id: `escapement_tap_${V.slug}`,
      variant: V.slug,
      frames,
      fps: 22,
      description: `${V.description} Perches on gearbox frame and strikes rotating ratchet cog tooth with tool, generating contact sparks.`
    };
  }

  /**
   * Action 5: RIBBON TUG (18 frames @ 22 FPS)
   * Playful rhythmic tug of two-tone red/black typewriter ribbon strand,
   * stepping with elastic slack, curious giggles and winks.
   */
  function generateRibbonMischief64(variantId = 'sailor') {
    const V = getVariant(variantId);
    const frames = [];
    const totalFrames = 18;

    for (let f = 0; f < totalFrames; f++) {
      const cycle = (f / totalFrames) * Math.PI * 2;
      const tug = Math.sin(cycle);
      const expr = (f >= 4 && f <= 10) ? 'giggle' : (f > 10 && f < 14 ? 'curious' : 'wink');

      frames.push(renderCustomMonkey64(V.id, 'tug', {
        x: 32 + tug * 3.5,
        y: 33 - Math.abs(tug) * 2.2,
        facing: 1,
        squashX: 1.05 + tug * 0.1,
        squashY: 0.95 - tug * 0.1,
        bodyTilt: tug * 0.18,
        headTilt: -tug * 0.14,
        headY: 0,
        expr,
        armL: [Math.round(-9), Math.round(5 + tug * 3)], armR: [Math.round(11 + tug * 4), Math.round(-1 - tug * 4)],
        legL: [Math.round(-6), Math.round(15)], legR: [Math.round(6), Math.round(15)],
        ribbonTug: tug
      }));
    }

    return {
      name: `${V.name}: Ribbon Mischief Tug (64x64)`,
      id: `ribbon_tug_${V.slug}`,
      variant: V.slug,
      frames,
      fps: 22,
      description: `${V.description} Playfully tugs and stretches two-tone typewriter ribbon, leaving prints and winking.`
    };
  }

  /**
   * Action 6: VICTORY DANCE (18 frames @ 24 FPS)
   * High-kick jumps, royal golden crown with ruby, golden banana trophy,
   * orbiting starburst sparkles.
   */
  function generateVictoryDance64(variantId = 'runner') {
    const V = getVariant(variantId);
    const frames = [];
    const totalFrames = 18;

    for (let f = 0; f < totalFrames; f++) {
      const danceCycle = f / totalFrames;
      frames.push(renderVictoryMonkey64({
        variant: V.id,
        x: 32,
        y: 32,
        facing: 1,
        danceCycle
      }));
    }

    return {
      name: `${V.name}: Victory Dance (64x64)`,
      id: `victory_dance_${V.slug}`,
      variant: V.slug,
      frames,
      fps: 24,
      description: `${V.description} Celebratory dance with royal golden crown, ripe golden banana trophy, high kicks, and orbiting sparkles.`
    };
  }

  /**
   * Universal Action Animation Generator
   */
  function generateActionAnimation64(variantId, actionType = 'key_stomp') {
    switch (actionType) {
      case 'key_stomp':
      case 'stomp':
        return generateKeyStomp64(variantId);
      case 'carriage_slam':
      case 'slam':
        return generateCarriageLever64(variantId);
      case 'platen_roll':
      case 'roll':
        return generateRollerAcrobat64(variantId);
      case 'escapement_tap':
      case 'tap':
        return generateEscapementMechanic64(variantId);
      case 'ribbon_tug':
      case 'tug':
        return generateRibbonMischief64(variantId);
      case 'victory_dance':
      case 'victory':
      case 'dance':
      default:
        return generateVictoryDance64(variantId);
    }
  }

  /* ===============================================================
   * 9. SPRITESHEET EXPORTER & UTILITIES
   * =============================================================== */
  function exportVariantSpritesheet(animData) {
    const { frames, name } = animData;
    const frameW = frames[0].width || 64;
    const frameH = frames[0].height || 64;

    let sheetCanvas;
    if (typeof document !== 'undefined') {
      sheetCanvas = document.createElement('canvas');
    } else if (typeof OffscreenCanvas !== 'undefined') {
      sheetCanvas = new OffscreenCanvas(frameW * frames.length, frameH);
    } else {
      sheetCanvas = new NodeCanvasMock(frameW * frames.length, frameH);
    }
    sheetCanvas.width = frameW * frames.length;
    sheetCanvas.height = frameH;

    const sCtx = sheetCanvas.getContext('2d');
    if (sCtx) sCtx.imageSmoothingEnabled = false;

    frames.forEach((frame, i) => {
      if (sCtx.drawImage) {
        sCtx.drawImage(frame, i * frameW, 0);
      }
    });

    return {
      name,
      canvas: sheetCanvas,
      dataUrl: sheetCanvas.toDataURL ? sheetCanvas.toDataURL('image/png') : '',
      frameW,
      frameH,
      frameCount: frames.length,
      fps: animData.fps
    };
  }

  function getAllVariantAnimations64() {
    return [
      generateKeyStomp64('runner'),
      generateCarriageLever64('dockworker'),
      generateRollerAcrobat64('inspector'),
      generateEscapementMechanic64('grease_mechanic'),
      generateRibbonMischief64('sailor'),
      generateVictoryDance64('runner')
    ];
  }

  /* ===============================================================
   * 10. PUBLIC MODULE EXPORTS
   * =============================================================== */
  /* GAME: poses for the keyboard hop. Taken from the key-stomp generator, but without its vertical travel (the game moves the monkey along the arc),
     so nothing is clipped: feet rest near y 55 of the 64px frame. Cached per variant/pose/expression/hat. */
  const POSES = {
    idle:    { sx: 1, sy: 1, y: 0, expr: 'determined', armL: [-11, 8], armR: [11, 8], legL: [-6, 17], legR: [6, 17] },
    breathe: { sx: 1.04, sy: .96, y: 1, expr: 'determined', armL: [-11, 9], armR: [11, 9], legL: [-6, 17], legR: [6, 17] },
    crouch:  { sx: 1.3, sy: .7, y: 6, expr: 'determined', armL: [-13, 12], armR: [13, 12], legL: [-8, 15], legR: [8, 15], headY: 3 },
    launch:  { sx: .82, sy: 1.28, y: -4, expr: 'screech', armL: [-12, -10], armR: [12, -10], legL: [-4, 19], legR: [4, 19] },
    air:     { sx: .97, sy: 1.03, y: -2, expr: 'giggle', armL: [-14, -2], armR: [12, 4], legL: [-8, 14], legR: [6, 17] },
    fall:    { sx: .86, sy: 1.22, y: -3, expr: 'screech', armL: [-8, 6], armR: [8, 6], legL: [-6, 19], legR: [6, 19] },
    impact:  { sx: 1.42, sy: .64, y: 9, expr: 'screech', armL: [-16, 12], armR: [16, 12], legL: [-12, 11], legR: [12, 11], headY: 3, impact: true },
    rebound: { sx: 1.04, sy: .96, y: 2, expr: 'determined', armL: [-11, 8], armR: [11, 8], legL: [-6, 17], legR: [6, 17] },
  };
  const poseCache = new Map();
  function pose(variant, name = 'idle', o = {}) {
    const P = POSES[name] || POSES.idle, expr = o.expr || P.expr, hat = o.hat || 0, key = variant + '|' + name + '|' + expr + '|' + hat;
    let cv = poseCache.get(key);
    if (!cv) {
      cv = renderCustomMonkey64(variant, 'stomp', { x: 32, y: 34 + P.y, facing: 1, squashX: P.sx, squashY: P.sy, headY: P.headY || 0, expr, armL: P.armL, armR: P.armR, legL: P.legL, legR: P.legR, squatImpact: !!P.impact, hat });
      poseCache.set(key, cv);
    }
    return cv;
  }

  return {
    pose, POSES,
    // Registries & Selectors
    VARIANTS,
    VARIANT_IDS,
    VARIANT_SLUGS,
    FUR_PALETTES,
    SKIN_PALETTES,
    COMMON_PALETTES,
    PALETTES,
    PixelBuffer,

    getVariant,
    getAllVariantIds,
    getAllVariants,
    getArchetypes,

    // Master Renderers
    renderCustomMonkey64,
    renderCrownAccessory,
    renderBananaAccessory,

    // Legacy Renderers
    renderStomper64,
    renderCarriageSlammer64,
    renderPlatenInspector64,
    renderEscapementMechanic64,
    renderRibbonMischief64,
    renderVictoryMonkey64,

    // Action Animation Generators
    generateActionAnimation64,
    generateKeyStomp64,
    generateCarriageLever64,
    generateRollerAcrobat64,
    generateEscapementMechanic64,
    generateRibbonMischief64,
    generateVictoryDance64,

    // Export Utilities
    getAllVariantAnimations64,
    exportVariantSpritesheet
  };
}));
