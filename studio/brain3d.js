/* Rovi & Shadow Studio — procedural 3D brain for Biblioteka.
   three.js r170 MIT. Shape is generated here (no external model, no AI). */
import * as THREE from "three";
import { OrbitControls } from "./lib/three/addons/controls/OrbitControls.js";

var COLOR = {
  void: 0x05080F,
  hull: 0x0E1B2B,
  mold: 0x1E7F94,
  mold2: 0x2BB3C4,
  glow: 0x5CE6F2,
  ice: 0xBFF6FA,
  steel: 0x8AA4B8,
  fakt: 0x3DDC84,
  dok: 0xF5E6A3,
  teoria: 0xE0A24A,
  spisek: 0xFF5A8A,
  brak: 0x5B6B7A
};

var state = {
  mounted: false,
  low: false,
  progress: 0,
  playing: false,
  loop: false,
  playT0: 0,
  playDur: 12000,
  onOpen: null,
  visible: null
};

var renderer, scene, camera, controls, clock, ro, raf, container;
var group, neuronPts, nodePts, synapseLines, hyphaLines, sporePts;
var nodeIndex = [];
var neuronBase, neuronColors, neuronPos;
var nodeBase, nodeColors, nodeSizes;
var hyphaPaths = [];
var infectLight, raycaster, pointer, pointerDown, pointerMoved;
var reduceMotion = false;
var lastHover = null;

function hash01(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function mulberry32(a) {
  return function () {
    var t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sulcus(x, y, z) {
  var lon = Math.atan2(x, z);
  var lat = Math.atan2(y, Math.sqrt(x * x + z * z));
  var s =
    0.55 * Math.sin(lon * 6.2 + lat * 1.4) * Math.sin(lat * 3.6 + 0.3) +
    0.35 * Math.sin(lon * 11.0 - lat * 2.1) * Math.sin((lat + 0.2) * 7.1) +
    0.22 * Math.sin(lon * 17.4 + lat * 8.2 + 1.1) +
    0.12 * Math.sin(lon * 23.0 - y * 14.0);
  var poles = Math.pow(Math.max(0, Math.cos(lat)), 1.15);
  return Math.max(0, s) * poles;
}

function deformBrain(x, y, z) {
  /* Two ellipsoidal hemispheres with a longitudinal fissure, sulci, temporal lobes. */
  var side = x >= 0 ? 1 : -1;
  var rx = 0.64, ry = 0.98, rz = 0.80;
  var cX = side * (rx + 0.012); /* inner walls almost meet, leaving a narrow fissure */
  var px = x * rx + cX;
  var py = y * ry + 0.04;
  var pz = z * rz + 0.04;
  /* flatten the medial wall into a fissure */
  var plane = side * 0.018;
  if (px * side < 0.18) {
    var tw = (px - plane) / (side * 0.18 - plane);
    if (tw < 1) {
      var flat = plane + (px - plane) * (0.25 + 0.75 * Math.max(0, tw));
      px = flat;
    }
  }
  /* frontal (z>0) wider and slightly taller */
  if (pz > 0) {
    px += side * 0.04 * pz;
    py += 0.06 * pz;
    pz *= 1.06;
  }
  /* occipital (z<0) slightly tucked */
  if (pz < 0) {
    px -= side * 0.03 * (-pz);
    pz *= 1.08;
  }
  /* temporal lobes hang down at the outer lower sides */
  var t =
    Math.exp(-Math.pow((Math.abs(px) - 0.62) / 0.28, 2)) *
    Math.exp(-Math.pow((pz - 0.05) / 0.50, 2)) *
    Math.exp(-Math.pow((py + 0.15) / 0.55, 2));
  py -= 0.38 * t;
  px += side * 0.10 * t;
  /* brainstem under the midline, back-of-center */
  var stem = Math.exp(-Math.pow(px / 0.16, 2)) * Math.exp(-Math.pow((pz + 0.05) / 0.22, 2));
  if (py < -0.35) {
    py -= 0.22 * stem * Math.max(0, -0.35 - py);
    px *= 1 - 0.45 * stem;
  }
  var sul = sulcus(px, py, pz);
  var k = 1 - 0.13 * sul;
  return new THREE.Vector3(px * k, py * (k * 0.98 + 0.02), pz * k);
}

function cerebellumPoint(rng) {
  var u = rng() * Math.PI * 2;
  var v = rng() * Math.PI;
  var r = 0.32 + 0.04 * Math.sin(u * 9) * Math.sin(v * 7);
  var x = r * Math.sin(v) * Math.cos(u);
  var y = r * 0.7 * Math.cos(v);
  var z = r * 0.85 * Math.sin(v) * Math.sin(u);
  var w = 0.04 * Math.sin(u * 14) * Math.sin(v * 10);
  return new THREE.Vector3(x * (1 - w), y * (1 - w) - 0.72, z * (1 - w) - 0.52);
}

function sampleCortex(rng) {
  var tries = 0;
  while (tries++ < 8) {
    var u = rng() * 2 * Math.PI;
    var v = Math.acos(2 * rng() - 1);
    var p = deformBrain(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    if (Math.abs(p.x) > 0.08 || rng() < 0.15) return p;
  }
  return deformBrain(0.2, 0.2, 0.2);
}

function nodeColor(n) {
  var et = n.etykiety || [];
  if (et.indexOf("teoria_spiskowa") >= 0) return new THREE.Color(COLOR.spisek);
  if (et.indexOf("teoria") >= 0) return new THREE.Color(COLOR.teoria);
  if (et.indexOf("dokument_zrodlowy") >= 0) return new THREE.Color(COLOR.dok);
  if (et.indexOf("fakt") >= 0) return new THREE.Color(COLOR.fakt);
  if (n.brak_zrodla && n.typ === "sprawa") return new THREE.Color(COLOR.brak);
  if (n.typ === "dzial") return new THREE.Color(COLOR.mold2);
  if (n.typ === "decyzja") return new THREE.Color(0xC9A66B);
  if (n.typ === "ksiazka") return new THREE.Color(0x7EC8E3);
  if (n.typ === "piosenka") return new THREE.Color(0x9B7EDC);
  if (n.typ === "gra") return new THREE.Color(0x5DDC9A);
  return new THREE.Color(COLOR.steel);
}

function placeNode(n) {
  var h1 = hash01(n.id);
  var h2 = hash01(n.id + "|b");
  var h3 = hash01(n.id + "|c");
  var typ = n.typ || "sprawa";
  var u, v, p, r;
  if (typ === "dzial") {
    u = h1 * 2 * Math.PI;
    v = Math.acos(2 * h2 - 1);
    p = deformBrain(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    return p.multiplyScalar(0.28 + 0.22 * h3);
  }
  if (typ === "decyzja") {
    p = deformBrain((h1 - 0.5) * 0.9, 0.85 - (0.15 + h2 * 0.35) * 0.3, (h3 - 0.5) * 0.8);
    return p;
  }
  if (typ === "ksiazka" || typ === "piosenka" || typ === "gra") {
    p = deformBrain(-0.7 - h1 * 0.5, -0.35 - h2 * 0.4, (h3 - 0.4) * 0.8);
    return p;
  }
  u = h1 * 2 * Math.PI;
  v = Math.acos(2 * h2 - 1);
  p = deformBrain(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
  r = typ === "sprawa" ? 0.97 : 0.90 + 0.06 * h3;
  return p.multiplyScalar(r);
}

function buildHemiMesh(side, low, mat) {
  var geo = new THREE.SphereGeometry(1, low ? 28 : 48, low ? 20 : 32, side > 0 ? 0 : Math.PI, Math.PI);
  var pos = geo.attributes.position;
  var v = new THREE.Vector3();
  for (var i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    /* keep this vertex in its hemisphere before deform */
    if (v.x * side < 0) v.x = 0;
    var p = deformBrain(v.x, v.y, v.z);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function buildHull(low) {
  var mat = new THREE.MeshStandardMaterial({
    color: 0x0A1824,
    emissive: 0x0C3A48,
    emissiveIntensity: 0.62,
    roughness: 0.68,
    metalness: 0.06,
    transparent: true,
    opacity: 0.40,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  var g = new THREE.Group();
  g.add(buildHemiMesh(-1, low, mat));
  g.add(buildHemiMesh(1, low, mat));
  var cgeo = new THREE.SphereGeometry(0.34, low ? 16 : 24, low ? 12 : 18);
  var cpos = cgeo.attributes.position;
  var v = new THREE.Vector3();
  for (var j = 0; j < cpos.count; j++) {
    v.fromBufferAttribute(cpos, j).normalize();
    var wr = 1 - 0.10 * Math.abs(Math.sin(v.x * 16) * Math.sin(v.z * 14));
    cpos.setXYZ(j, v.x * 0.36 * wr, v.y * 0.22 * wr - 0.82, v.z * 0.30 * wr - 0.62);
  }
  cgeo.computeVertexNormals();
  g.add(new THREE.Mesh(cgeo, mat.clone()));
  return g;
}

function buildAmbientNeurons(low) {
  var n = low ? 3200 : 8500;
  var rng = mulberry32(0xB10E40);
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  var ice = new THREE.Color(COLOR.ice);
  var steel = new THREE.Color(COLOR.steel);
  var c = new THREE.Color();
  for (var i = 0; i < n; i++) {
    var p = (i < n * 0.12) ? cerebellumPoint(rng) : sampleCortex(rng);
    if (i >= n * 0.12 && rng() < 0.25) p.multiplyScalar(0.72 + rng() * 0.22);
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    c.copy(steel).lerp(ice, rng() * 0.6);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  neuronPos = pos;
  neuronBase = new Float32Array(col);
  neuronColors = col;
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: low ? 0.018 : 0.014,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  }));
}

function nearSurface(grid, p, radius) {
  var gx = Math.floor((p.x + 2) * 6);
  var gy = Math.floor((p.y + 2) * 6);
  var gz = Math.floor((p.z + 2) * 6);
  var out = [];
  for (var dx = -1; dx <= 1; dx++) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dz = -1; dz <= 1; dz++) {
        var k = (gx + dx) + "," + (gy + dy) + "," + (gz + dz);
        var arr = grid[k];
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].distanceToSquared(p) < radius * radius) out.push(arr[i]);
        }
      }
    }
  }
  return out;
}

function buildHyphae(surface, low) {
  var rng = mulberry32(0x10E40D);
  var grid = {};
  for (var i = 0; i < surface.length; i++) {
    var p = surface[i];
    var k = Math.floor((p.x + 2) * 6) + "," + Math.floor((p.y + 2) * 6) + "," + Math.floor((p.z + 2) * 6);
    (grid[k] || (grid[k] = [])).push(p);
  }
  var seeds = [];
  /* brainstem, both hemispheres, frontal, occipital */
  var seedHints = [
    new THREE.Vector3(0, -0.85, 0.05),
    new THREE.Vector3(-0.55, 0.1, 0.4),
    new THREE.Vector3(0.55, 0.1, 0.4),
    new THREE.Vector3(0, 0.3, 0.7),
    new THREE.Vector3(0, -0.1, -0.7),
    new THREE.Vector3(-0.4, -0.5, 0.1),
    new THREE.Vector3(0.4, -0.5, 0.1)
  ];
  for (var s = 0; s < seedHints.length; s++) {
    var best = surface[0], bd = 1e9;
    for (var j = 0; j < surface.length; j++) {
      var d = surface[j].distanceToSquared(seedHints[s]);
      if (d < bd) { bd = d; best = surface[j]; }
    }
    seeds.push(best.clone());
  }
  var extra = low ? 4 : 10;
  for (var e = 0; e < extra; e++) seeds.push(surface[Math.floor(rng() * surface.length)].clone());

  var paths = [];
  function walk(start, dir, steps, depth) {
    var pts = [start.clone()];
    var cur = start.clone();
    var d = dir.clone().normalize();
    for (var step = 0; step < steps; step++) {
      var cand = nearSurface(grid, cur, 0.18);
      var bestP = null, bestScore = -1e9;
      for (var i = 0; i < cand.length; i++) {
        var v = cand[i].clone().sub(cur);
        var len = v.length();
        if (len < 0.012 || len > 0.16) continue;
        v.multiplyScalar(1 / len);
        var score = v.dot(d) + (rng() - 0.5) * 0.45;
        if (score > bestScore) { bestScore = score; bestP = cand[i]; }
      }
      if (!bestP) break;
      d.lerp(bestP.clone().sub(cur).normalize(), 0.55);
      cur = bestP.clone();
      pts.push(cur);
      if (depth < (low ? 2 : 3) && rng() < 0.18 && step > 4) {
        var nd = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).add(d).normalize();
        walk(cur, nd, Math.floor(steps * 0.45), depth + 1);
      }
    }
    if (pts.length > 2) paths.push(pts);
  }
  var mainSteps = low ? 36 : 55;
  for (var si = 0; si < seeds.length; si++) {
    var dir0 = seeds[si].clone().normalize();
    /* grow outward along a random tangent */
    var tan = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5);
    tan.cross(dir0);
    if (tan.lengthSq() < 1e-6) tan.set(1, 0, 0);
    tan.normalize();
    walk(seeds[si], tan, mainSteps, 0);
  }
  hyphaPaths = paths;
  return paths;
}

function hyphaGeometry(progress) {
  var t = Math.max(0, Math.min(1, progress));
  var positions = [];
  var colors = [];
  var spores = [];
  var glow = new THREE.Color(COLOR.glow);
  var mold = new THREE.Color(COLOR.mold2);
  for (var p = 0; p < hyphaPaths.length; p++) {
    var pts = hyphaPaths[p];
    var nShow = Math.max(0, Math.floor((pts.length - 1) * t));
    for (var i = 0; i < nShow; i++) {
      var a = pts[i], b = pts[i + 1];
      var u = i / Math.max(1, pts.length - 1);
      var lit = Math.min(1, (t - u) * 3);
      var c = mold.clone().lerp(glow, 0.4 + 0.6 * lit);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i % 2 === 0) {
        spores.push((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5);
      }
    }
  }
  return {
    linePos: new Float32Array(positions),
    lineCol: new Float32Array(colors),
    sporePos: new Float32Array(spores)
  };
}

function applyInfection(t) {
  state.progress = Math.max(0, Math.min(1, t));
  var p = state.progress;
  var glow = new THREE.Color(COLOR.glow);
  var mold = new THREE.Color(COLOR.mold);
  /* ambient neurons pick up infection based on radius from core + hyphal proximity proxy (y/z hash) */
  if (neuronColors && neuronPos) {
    var n = neuronColors.length / 3;
    for (var i = 0; i < n; i++) {
      var x = neuronPos[i * 3], y = neuronPos[i * 3 + 1], z = neuronPos[i * 3 + 2];
      /* front starts at brainstem (bottom) and spreads up/out */
      var seedDist = Math.sqrt(x * x + (y + 0.7) * (y + 0.7) * 0.7 + z * z);
      var wave = p * 2.2;
      var inf = Math.max(0, Math.min(1, (wave - seedDist) / 0.55));
      /* pulse */
      if (inf > 0 && inf < 1) inf = inf * (0.75 + 0.25 * Math.sin(performance.now() * 0.004 + i * 0.17));
      var r = neuronBase[i * 3], g = neuronBase[i * 3 + 1], b = neuronBase[i * 3 + 2];
      neuronColors[i * 3] = r + (glow.r - r) * inf;
      neuronColors[i * 3 + 1] = g + (glow.g - g) * inf;
      neuronColors[i * 3 + 2] = b + (glow.b - b) * inf;
    }
    neuronPts.geometry.attributes.color.needsUpdate = true;
  }
  if (nodeColors && nodeIndex.length) {
    for (var k = 0; k < nodeIndex.length; k++) {
      var nd = nodeIndex[k];
      var pos = nd.pos;
      var seedDist2 = Math.sqrt(pos.x * pos.x + (pos.y + 0.7) * (pos.y + 0.7) * 0.7 + pos.z * pos.z);
      var inf2 = Math.max(0, Math.min(1, (p * 2.2 - seedDist2) / 0.55));
      var base = nd.base;
      nodeColors[k * 3] = base.r + (glow.r - base.r) * inf2 * 0.85;
      nodeColors[k * 3 + 1] = base.g + (glow.g - base.g) * inf2 * 0.85;
      nodeColors[k * 3 + 2] = base.b + (glow.b - base.b) * inf2 * 0.85;
      nodeSizes[k] = nd.size * (1 + 0.7 * inf2);
    }
    nodePts.geometry.attributes.color.needsUpdate = true;
    nodePts.geometry.attributes.size.needsUpdate = true;
  }
  var hg = hyphaGeometry(p);
  if (hyphaLines) {
    hyphaLines.geometry.setAttribute("position", new THREE.BufferAttribute(hg.linePos, 3));
    hyphaLines.geometry.setAttribute("color", new THREE.BufferAttribute(hg.lineCol, 3));
    hyphaLines.geometry.computeBoundingSphere();
    hyphaLines.visible = p > 0.001 && hg.linePos.length > 0;
  }
  if (sporePts) {
    sporePts.geometry.setAttribute("position", new THREE.BufferAttribute(hg.sporePos, 3));
    sporePts.geometry.computeBoundingSphere();
    sporePts.visible = p > 0.001 && hg.sporePos.length > 0;
  }
  if (infectLight) {
    infectLight.intensity = 1.2 + 4.5 * p;
    infectLight.color.set(p < 0.3 ? COLOR.mold : COLOR.glow);
  }
  var ev = new CustomEvent("rss-brain-progress", { detail: { progress: p } });
  window.dispatchEvent(ev);
}

function setHint(text, visible) {
  if (!state.hint) return;
  if (!visible || !text) {
    state.hint.hidden = true;
    return;
  }
  state.hint.hidden = false;
  state.hint.textContent = text;
}

function pickNode(ev) {
  if (!renderer || !nodePts) return null;
  var rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  /* raycast points: threshold in world units */
  raycaster.params.Points = { threshold: state.low ? 0.06 : 0.045 };
  var hits = raycaster.intersectObject(nodePts, false);
  if (!hits.length) return null;
  var idx = hits[0].index;
  return nodeIndex[idx] || null;
}

function onPointerDown(ev) {
  pointerDown = { x: ev.clientX, y: ev.clientY };
  pointerMoved = 0;
}

function onPointerMove(ev) {
  if (pointerDown) {
    var dx = ev.clientX - pointerDown.x, dy = ev.clientY - pointerDown.y;
    pointerMoved = Math.max(pointerMoved, Math.hypot(dx, dy));
  }
  var hit = pickNode(ev);
  lastHover = hit;
  if (hit && hit.node) {
    var n = hit.node;
    setHint(n.nazwa || n.id, true);
    renderer.domElement.style.cursor = "pointer";
  } else {
    setHint("", false);
    renderer.domElement.style.cursor = "grab";
  }
}

function onPointerUp(ev) {
  if (pointerMoved < 8) {
    var hit = pickNode(ev);
    if (hit && hit.node && typeof state.onOpen === "function") state.onOpen(hit.node);
  }
  pointerDown = null;
}

function tick() {
  raf = requestAnimationFrame(tick);
  if (!renderer) return;
  var dt = clock.getDelta();
  if (state.playing) {
    var u = (performance.now() - state.playT0) / state.playDur;
    if (u >= 1) {
      applyInfection(1);
      if (state.loop) {
        state.playT0 = performance.now();
        applyInfection(0);
      } else {
        state.playing = false;
        window.dispatchEvent(new CustomEvent("rss-brain-play-end"));
      }
    } else {
      var eased = u * u * (3 - 2 * u);
      applyInfection(eased);
    }
  } else if (state.progress > 0 && state.progress < 1) {
    /* gentle pulse on a static mid-infection frame */
    applyInfection(state.progress);
  }
  if (controls) controls.update(dt);
  if (group && !reduceMotion) {
    /* very slow independent drift if auto-rotate is off? leave to OrbitControls */
  }
  renderer.render(scene, camera);
}

function qualityLow() {
  var w = window.innerWidth || 1100;
  var dpr = window.devicePixelRatio || 1;
  var cores = navigator.hardwareConcurrency || 8;
  return w < 900 || dpr >= 2.5 || cores <= 4;
}

function canWebGL() {
  try {
    var c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

function fit() {
  if (!controls || !camera) return;
  camera.position.set(2.05, 1.05, 2.35);
  controls.target.set(0, -0.12, 0);
  controls.update();
}

function resize() {
  if (!renderer || !container) return;
  var w = Math.max(1, container.clientWidth);
  var h = Math.max(1, container.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, true);
}

function unmount() {
  state.playing = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (ro) { ro.disconnect(); ro = null; }
  if (renderer) {
    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    renderer.domElement.removeEventListener("pointerup", onPointerUp);
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
  if (state.hint && state.hint.parentNode) state.hint.parentNode.removeChild(state.hint);
  renderer = scene = camera = controls = container = group = null;
  neuronPts = nodePts = synapseLines = hyphaLines = sporePts = null;
  nodeIndex = [];
  state.mounted = false;
  state.hint = null;
}

function mount(el, opts) {
  opts = opts || {};
  if (state.mounted) unmount();
  if (!el || !canWebGL()) return false;
  container = el;
  reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  state.low = opts.low != null ? !!opts.low : qualityLow();
  state.onOpen = opts.onOpen || null;
  state.visible = opts.visible || null;
  state.progress = opts.progress || 0;
  state.loop = !!opts.loop;

  var w = Math.max(1, el.clientWidth);
  var h = Math.max(1, el.clientHeight);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR.void);
  scene.fog = new THREE.FogExp2(COLOR.void, 0.12);
  camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 30);
  renderer = new THREE.WebGLRenderer({ antialias: !state.low, alpha: false, powerPreference: state.low ? "low-power" : "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.low ? 1.5 : 2));
  renderer.setSize(w, h, true);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.setAttribute("aria-label", "Trójwymiarowa mapa pamięci firmy w kształcie mózgu");
  el.innerHTML = "";
  el.appendChild(renderer.domElement);
  var hint = document.createElement("div");
  hint.className = "brain-hint";
  hint.hidden = true;
  el.appendChild(hint);
  state.hint = hint;

  scene.add(new THREE.AmbientLight(0x1A3A48, 1.6));
  var key = new THREE.DirectionalLight(0xBFF6FA, 1.1);
  key.position.set(-1.4, 1.8, 1.6);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0x1E7F94, 0.55);
  fill.position.set(1.6, -0.4, -1.2);
  scene.add(fill);
  infectLight = new THREE.PointLight(COLOR.mold, 1.2, 8, 1.4);
  infectLight.position.set(0, -0.4, 0.2);
  scene.add(infectLight);

  group = new THREE.Group();
  group.add(buildHull(state.low));
  neuronPts = buildAmbientNeurons(state.low);
  group.add(neuronPts);

  /* surface samples for hyphae: reuse ambient neuron positions on the outer shell */
  var surface = [];
  var nAmb = neuronPos.length / 3;
  for (var i = 0; i < nAmb; i++) {
    var sx = neuronPos[i * 3], sy = neuronPos[i * 3 + 1], sz = neuronPos[i * 3 + 2];
    var rr = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (rr > 0.55) surface.push(new THREE.Vector3(sx, sy, sz));
  }
  buildHyphae(surface, state.low);
  var empty = new Float32Array(0);
  hyphaLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  hyphaLines.visible = false;
  group.add(hyphaLines);
  sporePts = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: COLOR.glow,
      size: state.low ? 0.03 : 0.022,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    })
  );
  sporePts.visible = false;
  group.add(sporePts);

  /* graph nodes + synapses */
  var rawNodes = (opts.nodes || []).slice();
  var vis = state.visible;
  if (vis) rawNodes = rawNodes.filter(function (n) { return vis[n.id]; });
  nodeIndex = [];
  var npos = [];
  var ncol = [];
  var nsize = [];
  var idToIdx = {};
  for (var ni = 0; ni < rawNodes.length; ni++) {
    var nd = rawNodes[ni];
    var pos = placeNode(nd);
    var col = nodeColor(nd);
    var size = nd.typ === "dzial" ? 0.07 : nd.typ === "sprawa" ? 0.048 : 0.036;
    idToIdx[nd.id] = nodeIndex.length;
    nodeIndex.push({ node: nd, pos: pos, base: col, size: size });
    npos.push(pos.x, pos.y, pos.z);
    ncol.push(col.r, col.g, col.b);
    nsize.push(size);
  }
  nodeBase = ncol.slice();
  nodeColors = new Float32Array(ncol);
  nodeSizes = new Float32Array(nsize);
  var ngeo = new THREE.BufferGeometry();
  ngeo.setAttribute("position", new THREE.Float32BufferAttribute(npos, 3));
  ngeo.setAttribute("color", new THREE.BufferAttribute(nodeColors, 3));
  ngeo.setAttribute("size", new THREE.BufferAttribute(nodeSizes, 1));
  var nmat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {},
    vertexShader: "attribute float size; attribute vec3 color; varying vec3 vC; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*clamp(180.0/-mv.z, 12.0, 64.0); gl_Position=projectionMatrix*mv; }",
    fragmentShader: "varying vec3 vC; void main(){ vec2 p=gl_PointCoord*2.0-1.0; float d=dot(p,p); if(d>1.0) discard; float a=exp(-d*2.6); gl_FragColor=vec4(vC, a); }"
  });
  nodePts = new THREE.Points(ngeo, nmat);
  group.add(nodePts);

  var epos = [];
  var ecol = [];
  var edges = opts.edges || [];
  var lineCol = new THREE.Color(COLOR.mold2);
  for (var ei = 0; ei < edges.length; ei++) {
    var e = edges[ei];
    var a = idToIdx[e.from], b = idToIdx[e.to];
    if (a == null || b == null) continue;
    var pa = nodeIndex[a].pos, pb = nodeIndex[b].pos;
    var mx = (pa.x + pb.x) * 0.5, my = (pa.y + pb.y) * 0.5, mz = (pa.z + pb.z) * 0.5;
    var ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
    var lift = 0.12 + 0.10 * Math.min(1, pa.distanceTo(pb));
    mx += (mx / ml) * lift; my += (my / ml) * lift; mz += (mz / ml) * lift;
    epos.push(pa.x, pa.y, pa.z, mx, my, mz, mx, my, mz, pb.x, pb.y, pb.z);
    ecol.push(lineCol.r, lineCol.g, lineCol.b, lineCol.r, lineCol.g, lineCol.b,
      lineCol.r, lineCol.g, lineCol.b, lineCol.r, lineCol.g, lineCol.b);
  }
  synapseLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.40,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  synapseLines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(epos, 3));
  synapseLines.geometry.setAttribute("color", new THREE.Float32BufferAttribute(ecol, 3));
  group.add(synapseLines);

  scene.add(group);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 1.35;
  controls.maxDistance = 6.5;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.55;
  controls.enablePan = false;
  fit();

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.style.cursor = "grab";

  clock = new THREE.Clock();
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(function () { resize(); });
    ro.observe(el);
  } else {
    window.addEventListener("resize", resize);
  }
  applyInfection(state.progress);
  state.mounted = true;
  tick();
  return true;
}

function play(opts) {
  opts = opts || {};
  state.playDur = opts.duration || 12000;
  state.loop = !!opts.loop;
  if (opts.from != null) applyInfection(opts.from);
  state.playT0 = performance.now();
  state.playing = true;
}

function stop() { state.playing = false; }

function setInfection(t) {
  state.playing = false;
  applyInfection(t);
}

function setLoop(v) { state.loop = !!v; }

var api = {
  mount: mount,
  unmount: unmount,
  resize: resize,
  fit: fit,
  play: play,
  stop: stop,
  setInfection: setInfection,
  setLoop: setLoop,
  getProgress: function () { return state.progress; },
  isMounted: function () { return state.mounted; },
  canWebGL: canWebGL
};

window.RSS = window.RSS || {};
window.RSS.brain3d = api;
window.dispatchEvent(new Event("rss-brain-ready"));
