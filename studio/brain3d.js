/* Rovi & Shadow Studio — 3D Biblioteka (mózg).
   three.js r170 MIT.
   Geometry sampled from: 3D Reference Organ for Brain, Male v1.3 —
   Kristen Browne & Heidi Schlehlein (2023), Human Reference Atlas / HuBMAP,
   CC BY 4.0 (https://doi.org/10.48539/HBM929.XKCL.339), derived from the
   Allen Human Reference Atlas – 3D, 2020 (Ding et al., 2016).
   The mesh is used only as a point-cloud / sampling guide — no tissue
   surface or biological textures are rendered. No endorsement by the
   authors, HRA, Allen Institute or NIH. See assets/brain/ATTRIBUTION.txt.
   White-matter fibers are stylized DTI-like streamlines (visualization only).
   Examination figures are original procedural geometry (no AI, no third-party mesh).
   Fallback: procedural point cloud if the GLB cannot be loaded.
*/
import * as THREE from "three";
import { OrbitControls } from "./lib/three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "./lib/three/addons/loaders/GLTFLoader.js";
import { LineSegments2 } from "./lib/three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "./lib/three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "./lib/three/addons/lines/LineMaterial.js";

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
  brak: 0x5B6B7A,
  violet: 0x8B6CFF,
  gold: 0xE8C36A,
  electric: 0x4CC9FF
};

var ASSET = {
  glb: new URL("./assets/brain/brain-cortex.glb", import.meta.url).href,
  tracts: new URL("./assets/brain/tracts.bin", import.meta.url).href,
  meta: new URL("./assets/brain/brain-meta.json", import.meta.url).href
};


var TAB_LOBE = {
  biuro: "cc",
  bibl: "overview",
  art: "temporal_L",
  vid: "occipital_L",
  org: "parietal_L",
  kal: "frontal_R",
  zar: "temporal_R",
  kan: "occipital_R",
  settings: "brainstem",
  cmd: "frontal_L",
  list: "parietal_R",
  dec: "frontal_L",
  zuz: "cerebellum_L",
  more: "overview"
};
var LOBE_TAB = {
  cc: "biuro",
  frontal_L: "cmd",
  frontal_R: "kal",
  parietal_L: "org",
  parietal_R: "list",
  temporal_L: "art",
  temporal_R: "zar",
  occipital_L: "vid",
  occipital_R: "kan",
  cerebellum_L: "zuz",
  cerebellum_R: "zuz",
  brainstem: "settings"
};
var TAB_LABEL = {
  biuro: "Biuro", bibl: "Biblioteka", art: "Artykuły", vid: "Filmy",
  org: "Struktura", kal: "Kalendarz", zar: "Zarabianie", kan: "Kanały",
  settings: "Szef / Łącze", cmd: "Polecenia", list: "Rejestr", dec: "Decyzje",
  zuz: "Zużycie", more: "Więcej"
};

var LOBE_BUNDLES = {
  frontal_L: ["slf_L", "arc_L", "ifof_L", "cst_L", "cing_L", "unc_L", "cc"],
  frontal_R: ["slf_R", "arc_R", "ifof_R", "cst_R", "cing_R", "unc_R", "cc"],
  parietal_L: ["slf_L", "cing_L", "cc"],
  parietal_R: ["slf_R", "cing_R", "cc"],
  temporal_L: ["arc_L", "ilf_L", "unc_L", "ac"],
  temporal_R: ["arc_R", "ilf_R", "unc_R", "ac"],
  occipital_L: ["ilf_L", "ifof_L", "or_L"],
  occipital_R: ["ilf_R", "ifof_R", "or_R"],
  cerebellum_L: ["cbp"],
  cerebellum_R: ["cbp"],
  brainstem: ["cst_L", "cst_R", "cbp"],
  cc: ["cc"]
};

var LOBE_IDS = {
  frontal_L: 1, frontal_R: 2,
  parietal_L: 3, parietal_R: 4,
  temporal_L: 5, temporal_R: 6,
  occipital_L: 7, occipital_R: 8,
  cerebellum_L: 9, cerebellum_R: 10,
  brainstem: 11
};

var netUniforms = null;
var netAtoms, netDust, netSynapses, netRings, netElectrons, netLinks;
var netSamples = [];
var electronData = [];

var state = {
  mounted: false,
  low: false,
  progress: 0,
  playing: false,
  loop: false,
  playT0: 0,
  playDur: 12000,
  onOpen: null,
  visible: null,
  sceneMode: "mold",
  ready: false,
  hint: null,
  shellTab: "biuro",
  libMode: false,
  focusKey: "overview",
  onNavigate: null
};

var renderer, scene, camera, controls, clock, ro, raf, container;
var group, examGroup, brainPivot;
var tractLines, tractMat, tractTubes, pulsePts, nodePts, hyphaLines, sporePts;
var nodeIndex = [];
var nodeBase, nodeColors, nodeSizes;
var fibers = []; /* {name, pts: Float32Array(n*3), n} */
var infectUniforms = [];
var labelEls = [];
var labelLayer, hud, eegCanvas, eegCtx;
var infectLight, raycaster, pointer, pointerDown, pointerMoved;
var reduceMotion = false;
var lastHover = null;
var meta = null;
var calipers, scanRing;
var pendingMode = null;
var pendingShell = null;
var lobeMeshes = {};
var camFly = null;
var activeBundles = null;

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
  var side = x >= 0 ? 1 : -1;
  var rx = 0.64, ry = 0.98, rz = 0.80;
  var cX = side * (rx + 0.012);
  var px = x * rx + cX;
  var py = y * ry + 0.04;
  var pz = z * rz + 0.04;
  var fiss = Math.exp(-((x * x) / 0.0038)) * (0.55 + 0.45 * Math.max(0, 0.35 - Math.abs(y)));
  px *= 1 - 0.22 * fiss;
  var sul = sulcus(x, y, z);
  var rad = 1 - 0.10 * sul;
  if (y < -0.15 && Math.abs(z) > 0.15) {
    var t = Math.max(0, -y - 0.15);
    py -= t * 0.22;
    px *= 1 + t * 0.35;
  }
  if (y < -0.55) {
    py -= 0.12;
    px *= 0.55;
    pz *= 0.7;
  }
  return new THREE.Vector3(px * rad, py * rad, pz * rad);
}

function parseTracts(buf) {
  var u8 = new Uint8Array(buf);
  var dv = new DataView(buf);
  var mag = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (mag !== "RSSF") throw new Error("bad tracts magic");
  var n = dv.getUint32(8, true);
  var off = 12;
  var out = [];
  var dec = new TextDecoder("ascii");
  for (var i = 0; i < n; i++) {
    var nl = u8[off]; off += 1;
    var name = dec.decode(u8.subarray(off, off + nl)); off += nl;
    var np = dv.getUint16(off, true); off += 2;
    var bytes = np * 12;
    var pts = new Float32Array(buf.slice(off, off + bytes));
    off += bytes;
    out.push({ name: name, pts: pts, n: np });
  }
  return out;
}

function sampleFiber(f, t) {
  var u = Math.max(0, Math.min(1, t)) * (f.n - 1);
  var i = Math.floor(u);
  var k = Math.min(f.n - 1, i + 1);
  var a = u - i;
  var p = f.pts;
  return new THREE.Vector3(
    p[i * 3] + (p[k * 3] - p[i * 3]) * a,
    p[i * 3 + 1] + (p[k * 3 + 1] - p[i * 3 + 1]) * a,
    p[i * 3 + 2] + (p[k * 3 + 2] - p[i * 3 + 2]) * a
  );
}

function fiberTangent(f, t) {
  var a = sampleFiber(f, Math.max(0, t - 0.02));
  var b = sampleFiber(f, Math.min(1, t + 0.02));
  return b.sub(a).normalize();
}

function dtiColor(dx, dy, dz, out) {
  var l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  /* Standard DTI: red = L-R (x), green = A-P (z), blue = S-I (y) */
  out.r = Math.abs(dx) / l;
  out.g = Math.abs(dz) / l;
  out.b = Math.abs(dy) / l;
  var boost = 0.35;
  out.r = out.r * (1 - boost) + boost * 0.15;
  out.g = out.g * (1 - boost) + boost * 0.55;
  out.b = out.b * (1 - boost) + boost * 0.85;
  return out;
}

function buildTractLines(list, low) {
  var pos = [];
  var col = [];
  var c = new THREE.Color();
  var step = low ? 2 : 1;
  var used = [];
  for (var i = 0; i < list.length; i += step) {
    var f = list[i];
    used.push(f);
    for (var k = 0; k < f.n - 1; k++) {
      var ax = f.pts[k * 3], ay = f.pts[k * 3 + 1], az = f.pts[k * 3 + 2];
      var bx = f.pts[(k + 1) * 3], by = f.pts[(k + 1) * 3 + 1], bz = f.pts[(k + 1) * 3 + 2];
      pos.push(ax, ay, az, bx, by, bz);
      dtiColor(bx - ax, by - ay, bz - az, c);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  var geo = new LineSegmentsGeometry();
  geo.setPositions(pos);
  geo.setColors(col);
  tractMat = new LineMaterial({
    vertexColors: true,
    linewidth: low ? 1.05 : 1.2,
    transparent: true,
    opacity: 0.20,
    dashed: false,
    worldUnits: false,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  if (renderer) {
    var s = new THREE.Vector2();
    renderer.getDrawingBufferSize(s);
    tractMat.resolution.set(s.x, s.y);
  }
  var lines = new LineSegments2(geo, tractMat);
  lines.renderOrder = 2;
  lines.frustumCulled = false;
  return { lines: lines, used: used };
}

function buildPulses(used) {
  var n = used.length;
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  var c = new THREE.Color();
  for (var i = 0; i < n; i++) {
    var f = used[i];
    var p = sampleFiber(f, 0);
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    var t0 = f.pts, k = Math.min(1, f.n - 1);
    dtiColor(t0[k * 3] - t0[0], t0[k * 3 + 1] - t0[1], t0[k * 3 + 2] - t0[2], c);
    col[i * 3] = Math.min(1, c.r + 0.35);
    col[i * 3 + 1] = Math.min(1, c.g + 0.35);
    col[i * 3 + 2] = Math.min(1, c.b + 0.45);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  var mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: state.low ? 10.0 : 13.0 } },
    vertexShader: "attribute vec3 color; varying vec3 vC; uniform float uSize; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=uSize*clamp(1.6/-mv.z, 0.7, 3.2); gl_Position=projectionMatrix*mv; }",
    fragmentShader: "varying vec3 vC; void main(){ vec2 p=gl_PointCoord*2.0-1.0; float d=dot(p,p); if(d>1.0) discard; float a=exp(-d*3.2)*0.7; vec3 col=vC*0.85; float lum=max(col.r,max(col.g,col.b)); col*=0.7/max(0.7,lum); gl_FragColor=vec4(col, a); }"
  });
  var pts = new THREE.Points(geo, mat);
  pts.renderOrder = 3;
  pts.frustumCulled = false;
  pts.userData.used = used;
  pts.userData.phase = used.map(function (f, i) { return hash01(f.name + ":" + i); });
  pts.userData.speed = used.map(function (f, i) { return 0.18 + 0.22 * hash01(f.name + "|s|" + i); });
  return pts;
}


function buildTractTubes(list, low) {
  var sides = low ? 5 : 6;
  var radius = low ? 0.009 : 0.0075;
  var step = low ? 2 : 1;
  var positions = [];
  var colors = [];
  var prog = [];
  var indices = [];
  var c = new THREE.Color();
  var vbase = 0;
  var used = [];
  var N = new THREE.Vector3();
  var B = new THREE.Vector3();
  var T = new THREE.Vector3();
  var tmp = new THREE.Vector3();
  for (var fi = 0; fi < list.length; fi += step) {
    var f = list[fi];
    if (!f || f.n < 2) continue;
    used.push(f);
    var n = f.n;
    var px = f.pts;
    T.set(px[3] - px[0], px[4] - px[1], px[5] - px[2]).normalize();
    N.set(0, 1, 0);
    if (Math.abs(T.y) > 0.9) N.set(1, 0, 0);
    N.sub(tmp.copy(T).multiplyScalar(N.dot(T))).normalize();
    for (var i = 0; i < n; i++) {
      var i3 = i * 3;
      var j3 = (i < n - 1 ? i + 1 : i) * 3;
      var k3 = (i > 0 ? i - 1 : i) * 3;
      T.set(px[j3] - px[k3], px[j3 + 1] - px[k3 + 1], px[j3 + 2] - px[k3 + 2]);
      if (T.lengthSq() < 1e-10) T.set(0, 1, 0); else T.normalize();
      N.sub(tmp.copy(T).multiplyScalar(N.dot(T)));
      if (N.lengthSq() < 1e-8) {
        N.set(0, 1, 0);
        N.sub(tmp.copy(T).multiplyScalar(N.dot(T)));
      }
      N.normalize();
      B.crossVectors(T, N).normalize();
      dtiColor(px[j3] - px[i3], px[j3 + 1] - px[i3 + 1], px[j3 + 2] - px[i3 + 2], c);
      var cr = Math.min(1, c.r * 1.15 + 0.05);
      var cg = Math.min(1, c.g * 1.15 + 0.05);
      var cb = Math.min(1, c.b * 1.15 + 0.08);
      var u = i / (n - 1);
      for (var s = 0; s < sides; s++) {
        var ang = (s / sides) * Math.PI * 2;
        var cs = Math.cos(ang), sn = Math.sin(ang);
        positions.push(
          px[i3] + (N.x * cs + B.x * sn) * radius,
          px[i3 + 1] + (N.y * cs + B.y * sn) * radius,
          px[i3 + 2] + (N.z * cs + B.z * sn) * radius
        );
        colors.push(cr, cg, cb);
        prog.push(u);
      }
      if (i > 0) {
        var prev = vbase + (i - 1) * sides;
        var cur = vbase + i * sides;
        for (var s2 = 0; s2 < sides; s2++) {
          var s3 = (s2 + 1) % sides;
          indices.push(prev + s2, cur + s2, cur + s3, prev + s2, cur + s3, prev + s3);
        }
      }
    }
    vbase += n * sides;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("aT", new THREE.Float32BufferAttribute(prog, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  var mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: [
      "attribute vec3 color; attribute float aT;",
      "varying vec3 vC; varying float vT; varying vec3 vN; varying vec3 vV;",
      "void main(){",
      "  vC=color; vT=aT;",
      "  vec4 w=modelMatrix*vec4(position,1.0);",
      "  vN=normalize(mat3(modelMatrix)*normal);",
      "  vV=cameraPosition-w.xyz;",
      "  gl_Position=projectionMatrix*viewMatrix*w;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "varying vec3 vC; varying float vT; varying vec3 vN; varying vec3 vV;",
      "uniform float uTime;",
      "void main(){",
      "  float fres=pow(1.0-abs(dot(normalize(vN), normalize(vV))), 1.6);",
      "  float pulse=exp(-40.0*abs(fract(vT - uTime*0.28)-0.02));",
      "  vec3 col=vC*(0.24+0.28*fres) + vec3(0.55,0.85,1.0)*pulse*0.55;",
      "  float lum=max(col.r, max(col.g, col.b));",
      "  col*=0.58/max(0.58, lum);",
      "  float a=0.09 + 0.32*pulse + 0.08*fres;",
      "  gl_FragColor=vec4(col, clamp(a,0.05,0.40));",
      "}"
    ].join("\n")
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  mesh.userData.used = used;
  mesh.userData.pulseUniform = mat.uniforms.uTime;
  return mesh;
}

function updatePulses(t) {
  if (!pulsePts || reduceMotion) return;
  var used = pulsePts.userData.used;
  var phase = pulsePts.userData.phase;
  var speed = pulsePts.userData.speed;
  var pos = pulsePts.geometry.getAttribute("position");
  for (var i = 0; i < used.length; i++) {
    var mul = 1;
    if (activeBundles && used[i] && activeBundles[used[i].name]) mul = 2.4;
    var u = (phase[i] + t * speed[i] * mul) % 1;
    var p = sampleFiber(used[i], u);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
}

function mapNodeToLobe(n, deptOf, metaMap) {
  if (n.id === "dzial:mostek") return "cc";
  var dept = n.typ === "dzial" ? n.id : (deptOf[n.id] || null);
  if (dept && metaMap && metaMap[dept]) return metaMap[dept];
  if (dept === "dzial:mostek") return "cc";
  var typ = n.typ || "";
  if (typ === "piosenka") return "temporal_R";
  if (typ === "ksiazka") return "temporal_L";
  if (typ === "gra") return "cerebellum_L";
  if (typ === "tiktok") return "occipital_R";
  if (typ === "long" || typ === "krotki") return "occipital_L";
  if (typ === "decyzja") return "frontal_L";
  return hash01(n.id) > 0.5 ? "frontal_L" : "parietal_R";
}

function fibersForLobe(lobe) {
  var names = LOBE_BUNDLES[lobe] || LOBE_BUNDLES.frontal_L;
  var out = [];
  for (var i = 0; i < fibers.length; i++) {
    if (names.indexOf(fibers[i].name) >= 0) out.push(fibers[i]);
  }
  return out.length ? out : fibers;
}

function placeOnTract(n, deptOf, metaMap) {
  var lobe = mapNodeToLobe(n, deptOf, metaMap);
  var cand = fibersForLobe(lobe);
  var fi = Math.floor(hash01(n.id) * cand.length) % cand.length;
  var f = cand[fi];
  var t = 0.12 + hash01(n.id + "|t") * 0.76;
  var p = sampleFiber(f, t);
  var tang = fiberTangent(f, t);
  var outward = p.clone().normalize();
  if (outward.lengthSq() < 0.01) outward.set(0, 1, 0);
  /* sit just off the fiber so the glow doesn't swallow the node */
  var lift = n.typ === "dzial" ? 0.028 : 0.018;
  var side = new THREE.Vector3();
  side.crossVectors(tang, outward);
  if (side.lengthSq() < 1e-6) side.crossVectors(tang, new THREE.Vector3(0, 1, 0));
  side.normalize();
  var sgn = hash01(n.id + "|s") > 0.5 ? 1 : -1;
  p.addScaledVector(outward, lift);
  p.addScaledVector(side, sgn * lift * 0.45);
  return { pos: p, lobe: lobe, fiber: f };
}

function buildDeptOf(nodes, edges) {
  var map = {};
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].typ === "dzial") map[nodes[i].id] = nodes[i].id;
  }
  for (var pass = 0; pass < 5; pass++) {
    for (var e = 0; e < edges.length; e++) {
      var a = edges[e].from, b = edges[e].to;
      if (map[a] && !map[b]) map[b] = map[a];
      else if (map[b] && !map[a]) map[a] = map[b];
    }
  }
  return map;
}

function attachNodes(opts) {
  var rawNodes = (opts.nodes || []).slice();
  var vis = state.visible;
  if (vis) rawNodes = rawNodes.filter(function (n) { return vis[n.id]; });
  var deptOf = buildDeptOf(opts.nodes || [], opts.edges || []);
  var metaMap = (meta && meta.deptLobes) || {};
  nodeIndex = [];
  var npos = [];
  var ncol = [];
  var nsize = [];
  for (var ni = 0; ni < rawNodes.length; ni++) {
    var nd = rawNodes[ni];
    var placed = placeOnTract(nd, deptOf, metaMap);
    var col = nodeColor(nd);
    var size = nd.typ === "dzial" ? 0.08 : nd.typ === "sprawa" ? 0.052 : 0.038;
    nodeIndex.push({ node: nd, pos: placed.pos, base: col, size: size, lobe: placed.lobe });
    npos.push(placed.pos.x, placed.pos.y, placed.pos.z);
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
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {},
    vertexShader: "attribute float size; attribute vec3 color; varying vec3 vC; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*clamp(200.0/-mv.z, 14.0, 72.0); gl_Position=projectionMatrix*mv; }",
    fragmentShader: "varying vec3 vC; void main(){ vec2 p=gl_PointCoord*2.0-1.0; float d=dot(p,p); if(d>1.0) discard; float a=exp(-d*2.4); gl_FragColor=vec4(vC, a); }"
  });
  nodePts = new THREE.Points(ngeo, nmat);
  nodePts.renderOrder = 4;
  nodePts.frustumCulled = false;
  brainPivot.add(nodePts);
}

function seedList() {
  var seeds = (meta && meta.moldSeeds) || [];
  var out = [];
  for (var i = 0; i < seeds.length && i < 8; i++) {
    var s = seeds[i];
    out.push(new THREE.Vector3(s[0], s[1], s[2]));
  }
  if (!out.length) {
    out = [
      new THREE.Vector3(-0.45, 0.15, 0.55),
      new THREE.Vector3(0.48, 0.18, 0.52),
      new THREE.Vector3(-0.62, -0.15, 0.35),
      new THREE.Vector3(0.60, -0.12, 0.32),
      new THREE.Vector3(-0.2, 0.05, -0.7),
      new THREE.Vector3(-0.15, 0.55, 0.05),
      new THREE.Vector3(0.2, 0.52, 0.0),
      new THREE.Vector3(0.1, -0.55, -0.2)
    ];
  }
  return out;
}

function applySeedUniforms() {
  var seeds = seedList();
  var starts = [0.00, 0.05, 0.10, 0.14, 0.18, 0.22, 0.26, 0.30];
  for (var i = 0; i < infectUniforms.length; i++) {
    var u = infectUniforms[i];
    u.uNSeeds.value = seeds.length;
    for (var k = 0; k < 8; k++) {
      if (u.uSeed.value[k]) {
        if (k < seeds.length) u.uSeed.value[k].copy(seeds[k]);
        else u.uSeed.value[k].set(0, 0, 0);
      }
      u.uStart.value[k] = starts[k] || 0;
    }
  }
  return { seeds: seeds, starts: starts };
}

function buildHyphae(seeds) {
  var rng = mulberry32(0xB10E01D);
  var paths = [];
  var surface = [];
  if (netSamples && netSamples.length) {
    var step = state.low ? 3 : 2;
    for (var i = 0; i < netSamples.length; i += step) {
      var s = netSamples[i];
      surface.push(new THREE.Vector3(s.x, s.y, s.z));
    }
  } else if (brainPivot) {
    brainPivot.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.getAttribute) return;
      if (o.name && /back/i.test(o.name)) return;
      if (!o.name || !lobeMeshes[o.name]) return;
      var pos = o.geometry.getAttribute("position");
      if (!pos) return;
      var step = state.low ? 9 : 5;
      var v = new THREE.Vector3();
      for (var i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        o.localToWorld(v);
        if (brainPivot) brainPivot.worldToLocal(v);
        surface.push(v.clone());
      }
    });
  }
  if (surface.length < 20) return [];
  function nearest(p, excludeR, from) {
    var best = null, bd = 1e9;
    for (var i = 0; i < surface.length; i++) {
      var d = p.distanceToSquared(surface[i]);
      if (d < bd && d > excludeR * excludeR) {
        if (from && surface[i].distanceToSquared(from) < 0.0001) continue;
        bd = d; best = surface[i];
      }
    }
    return best;
  }
  for (var s = 0; s < seeds.length; s++) {
    var branches = state.low ? 5 : 8;
    for (var b = 0; b < branches; b++) {
      var path = [seeds[s].clone()];
      var cur = seeds[s].clone();
      var steps = 7 + Math.floor(rng() * 6);
      for (var k = 0; k < steps; k++) {
        var nxt = nearest(cur, 0.04, path[Math.max(0, path.length - 2)]);
        if (!nxt) break;
        var mid = cur.clone().lerp(nxt, 0.7);
        mid.x += (rng() - 0.5) * 0.05;
        mid.y += (rng() - 0.5) * 0.04;
        mid.z += (rng() - 0.5) * 0.05;
        path.push(mid);
        cur = nxt;
      }
      if (path.length > 2) paths.push({ seed: s, pts: path, birth: s * 0.04 + b * 0.015 });
    }
  }
  return paths;
}

var hyphaPaths = [];

function applyInfection(t) {
  t = Math.max(0, Math.min(1, t));
  state.progress = t;
  for (var i = 0; i < infectUniforms.length; i++) {
    infectUniforms[i].uT.value = t;
  }
  if (infectLight) {
    infectLight.intensity = 0.4 + t * 2.2;
    infectLight.distance = 4 + t * 6;
  }
  /* hyphae grow with t from several foci */
  if (hyphaLines && hyphaPaths.length) {
    var pos = [];
    var col = [];
    var c1 = new THREE.Color(COLOR.mold);
    var c2 = new THREE.Color(COLOR.glow);
    var spores = [];
    var starts = [0.00, 0.05, 0.10, 0.14, 0.18, 0.22, 0.26, 0.30];
    for (var h = 0; h < hyphaPaths.length; h++) {
      var path = hyphaPaths[h];
      var local = (t - path.birth) / 0.55;
      if (local <= 0) continue;
      local = Math.min(1, local);
      var nshow = Math.max(2, Math.floor(local * (path.pts.length - 1)));
      for (var k = 0; k < nshow - 1; k++) {
        var a = path.pts[k], b = path.pts[k + 1];
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        var u = k / Math.max(1, nshow);
        col.push(
          c1.r + (c2.r - c1.r) * u, c1.g + (c2.g - c1.g) * u, c1.b + (c2.b - c1.b) * u,
          c1.r + (c2.r - c1.r) * u, c1.g + (c2.g - c1.g) * u, c1.b + (c2.b - c1.b) * u
        );
      }
    }
    var seeds = seedList();
    for (var s = 0; s < seeds.length; s++) {
      if (t > (starts[s] || 0)) {
        var sp = seeds[s];
        spores.push(sp.x, sp.y, sp.z);
      }
    }
    hyphaLines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    hyphaLines.geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    hyphaLines.geometry.computeBoundingSphere();
    hyphaLines.visible = pos.length > 0;
    if (sporePts) {
      sporePts.geometry.setAttribute("position", new THREE.Float32BufferAttribute(spores, 3));
      sporePts.geometry.computeBoundingSphere();
      sporePts.visible = spores.length > 0;
    }
  }
  if (nodePts && nodeIndex.length) {
    var seeds = seedList();
    var starts = [0.00, 0.05, 0.10, 0.14, 0.18, 0.22, 0.26, 0.30];
    var attr = nodePts.geometry.getAttribute("color");
    for (var n = 0; n < nodeIndex.length; n++) {
      var p = nodeIndex[n].pos;
      var inf = 0;
      for (var s = 0; s < seeds.length; s++) {
        var R = Math.max(0, t - starts[s]) * 2.05;
        var d = p.distanceTo(seeds[s]);
        var f = 1 - smoothstep(R * 0.4, R + 0.06, d);
        if (f > inf) inf = f;
      }
      var b = nodeIndex[n].base;
      var mold = new THREE.Color(COLOR.glow);
      attr.setXYZ(n, b.r + (mold.r - b.r) * inf, b.g + (mold.g - b.g) * inf, b.b + (mold.b - b.b) * inf);
    }
    attr.needsUpdate = true;
  }
  var pct = Math.round(t * 100);
  if (state._hudPct !== pct) {
    state._hudPct = pct;
    updateHud();
  }
  try {
    window.dispatchEvent(new CustomEvent("rss-brain-progress", { detail: { progress: t } }));
  } catch (e) {}
}

function smoothstep(e0, e1, x) {
  var u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1)));
  return u * u * (3 - 2 * u);
}

function matGrey() {
  return new THREE.MeshStandardMaterial({
    color: 0xA7B0B8,
    roughness: 0.48,
    metalness: 0.08,
    emissive: 0x0A1218,
    emissiveIntensity: 0.15
  });
}

function makeGreyAlien(rng) {
  var g = new THREE.Group();
  var mat = matGrey();
  var eye = new THREE.MeshStandardMaterial({
    color: 0x05070B,
    roughness: 0.22,
    metalness: 0.15,
    emissive: 0x143044,
    emissiveIntensity: 0.55
  });
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), mat);
  head.scale.set(0.88, 1.22, 1.02);
  head.position.y = 1.12;
  g.add(head);
  var jaw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat);
  jaw.scale.set(0.85, 0.7, 0.9);
  jaw.position.set(0, 0.98, 0.04);
  g.add(jaw);
  function addEye(sx) {
    var e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eye);
    e.scale.set(1.15, 0.7, 0.55);
    e.position.set(sx * 0.09, 1.10, 0.16);
    e.rotation.y = sx * 0.35;
    g.add(e);
  }
  addEye(-1); addEye(1);
  var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8), mat);
  neck.position.y = 0.90;
  g.add(neck);
  var torso = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat);
  torso.scale.set(0.72, 1.15, 0.55);
  torso.position.y = 0.62;
  g.add(torso);
  var pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat);
  pelvis.scale.set(0.85, 0.7, 0.6);
  pelvis.position.y = 0.38;
  g.add(pelvis);
  function limb(len, r, pos, rot) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, len, 7), mat);
    m.position.copy(pos);
    m.rotation.set(rot.x, rot.y, rot.z);
    g.add(m);
    return m;
  }
  limb(0.42, 0.035, new THREE.Vector3(-0.16, 0.62, 0.02), new THREE.Vector3(0, 0, 0.55));
  limb(0.42, 0.035, new THREE.Vector3(0.16, 0.62, 0.02), new THREE.Vector3(0, 0, -0.55));
  limb(0.38, 0.04, new THREE.Vector3(-0.07, 0.18, 0.02), new THREE.Vector3(0.12, 0, 0.08));
  limb(0.38, 0.04, new THREE.Vector3(0.07, 0.18, 0.02), new THREE.Vector3(0.12, 0, -0.08));
  g.scale.setScalar(0.95 + rng() * 0.12);
  return g;
}

function makeHuman() {
  var g = new THREE.Group();
  var cloth = new THREE.MeshStandardMaterial({ color: 0x1A2230, roughness: 0.7, metalness: 0.1 });
  var skin = new THREE.MeshStandardMaterial({ color: 0xC4A48A, roughness: 0.65, metalness: 0.02 });
  var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.42, 6, 10), cloth);
  torso.rotation.z = Math.PI / 2;
  torso.position.set(0, 0.02, 0.02);
  g.add(torso);
  var hips = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), cloth);
  hips.scale.set(1.1, 0.7, 0.85);
  hips.position.set(0.28, 0.0, 0.02);
  g.add(hips);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin);
  head.position.set(-0.46, 0.05, 0.0);
  g.add(head);
  var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 8), skin);
  neck.rotation.z = Math.PI / 2;
  neck.position.set(-0.36, 0.04, 0);
  g.add(neck);
  function leg(z) {
    var l = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.38, 4, 8), cloth);
    l.rotation.z = Math.PI / 2;
    l.position.set(0.58, 0.0, z);
    g.add(l);
  }
  leg(-0.08); leg(0.08);
  function arm(z, y) {
    var a = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.32, 4, 8), cloth);
    a.rotation.z = Math.PI / 2;
    a.position.set(0.02, y, z);
    g.add(a);
  }
  arm(-0.20, 0.02); arm(0.20, 0.02);
  return g;
}

function buildExamScene() {
  var g = new THREE.Group();
  g.visible = false;
  var tableMat = new THREE.MeshStandardMaterial({
    color: 0x2A3340, metalness: 0.65, roughness: 0.28,
    emissive: 0x0A1820, emissiveIntensity: 0.2
  });
  var table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.05), tableMat);
  table.position.set(0, -1.22, 0);
  g.add(table);
  var edge = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.03, 1.09), new THREE.MeshStandardMaterial({
    color: 0x5CE6F2, emissive: 0x1E7F94, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.3
  }));
  edge.position.set(0, -1.17, 0);
  g.add(edge);
  var legMat = tableMat;
  [[-1.15, -1.6, -0.42], [1.15, -1.6, -0.42], [-1.15, -1.6, 0.42], [1.15, -1.6, 0.42]].forEach(function (p) {
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.72, 8), legMat);
    leg.position.set(p[0], p[1], p[2]);
    g.add(leg);
  });
  var floor = new THREE.GridHelper(7, 28, 0x163040, 0x0C1824);
  floor.position.y = -1.96;
  g.add(floor);
  var human = makeHuman();
  human.position.set(0.1, -1.08, 0);
  g.add(human);
  function yawTo(obj, x, z) {
    obj.rotation.set(0, Math.atan2(x - obj.position.x, z - obj.position.z), 0);
  }
  var rng = mulberry32(0xA11E4);
  var a1 = makeGreyAlien(rng);
  a1.position.set(-1.35, -1.96, 0.70);
  a1.scale.setScalar(1.15);
  yawTo(a1, 0, 0);
  g.add(a1);
  var a2 = makeGreyAlien(rng);
  a2.position.set(1.40, -1.96, 0.70);
  a2.scale.setScalar(1.18);
  yawTo(a2, 0, 0);
  g.add(a2);
  var a3 = makeGreyAlien(rng);
  a3.position.set(0.15, -1.96, -1.35);
  a3.scale.setScalar(1.12);
  yawTo(a3, 0, 0);
  g.add(a3);
  /* overhead lamp */
  var lamp = new THREE.SpotLight(0xBFF6FA, 2.2, 8, 0.55, 0.4, 1.2);
  lamp.position.set(0.2, 2.2, 0.8);
  lamp.target.position.set(0, -0.2, 0);
  g.add(lamp);
  g.add(lamp.target);
  var lampFill = new THREE.PointLight(0x1E7F94, 1.1, 6, 1.4);
  lampFill.position.set(-1.2, 0.8, 1.0);
  g.add(lampFill);
  return g;
}

function buildCalipers() {
  var g = new THREE.Group();
  var mat = new THREE.LineBasicMaterial({
    color: 0x5CE6F2, transparent: true, opacity: 0.28, depthWrite: false
  });
  var pts = [];
  function tickLine(a, b) { pts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  var x0 = -1.15, x1 = 1.15, y0 = -0.85, y1 = 0.75, z0 = -0.95, z1 = 0.95;
  /* frame around the brain */
  tickLine(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y0, z0));
  tickLine(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x0, y1, z0));
  tickLine(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x0, y0, z1));
  tickLine(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x0, y1, z1));
  tickLine(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x1, y0, z1));
  tickLine(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x1, y1, z0));
  var step = 0.2;
  for (var x = x0; x <= x1 + 0.001; x += step) {
    tickLine(new THREE.Vector3(x, y0, z0), new THREE.Vector3(x, y0 - 0.04, z0));
  }
  for (var y = y0; y <= y1 + 0.001; y += step) {
    tickLine(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x0 - 0.04, y, z0));
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  var lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = 6;
  g.add(lines);
  return g;
}

function buildScanRing() {
  var geo = new THREE.TorusGeometry(0.95, 0.008, 8, 64);
  var mat = new THREE.MeshBasicMaterial({
    color: 0x5CE6F2, transparent: true, opacity: 0.0, depthWrite: false
  });
  var m = new THREE.Mesh(geo, mat);
  m.rotation.x = Math.PI / 2;
  m.visible = false;
  m.renderOrder = 7;
  return m;
}

function setSceneMode(mode) {
  if (mode !== "exam") mode = "mold";
  state.sceneMode = mode;
  if (!state.mounted) { pendingMode = mode; return; }
  var exam = mode === "exam";
  if (examGroup) examGroup.visible = exam;
  if (scanRing) scanRing.visible = exam;
  for (var i = 0; i < infectUniforms.length; i++) {
    infectUniforms[i].uHolo.value = exam ? 1.0 : 0.0;
  }
  if (brainPivot) {
    if (exam) {
      brainPivot.position.set(0, 0.22, 0);
      brainPivot.scale.setScalar(0.92);
    } else {
      brainPivot.position.set(0, 0, 0);
      brainPivot.scale.setScalar(1);
    }
  }
  if (calipers) calipers.visible = true;
  if (scene) {
    scene.fog = exam
      ? new THREE.FogExp2(0x03050A, 0.08)
      : new THREE.FogExp2(COLOR.void, 0.08);
    scene.background = new THREE.Color(exam ? 0x03050A : COLOR.void);
  }
  if (controls) {
    controls.autoRotate = !reduceMotion && !exam;
    fit();
  }
  if (hud) {
    var tag = hud.querySelector(".hud-mode");
    if (tag) tag.textContent = exam ? "TRYB // BADANIE KOSMITÓW" : "TRYB // PLEŚŃ · SIEĆ";
  }
}

function applyHoloTime(t) {
  for (var i = 0; i < infectUniforms.length; i++) {
    infectUniforms[i].uTime.value = t;
  }
  if (tractTubes && tractTubes.userData.pulseUniform) tractTubes.userData.pulseUniform.value = t;
  if (scanRing && state.sceneMode === "exam") {
    scanRing.visible = true;
    scanRing.position.y = Math.sin(t * 0.9) * 0.45;
    scanRing.material.opacity = 0.45;
    scanRing.rotation.z = t * 0.15;
  }
}

function buildHud(el) {
  var wrap = document.createElement("div");
  wrap.className = "brain-hud";
  wrap.innerHTML =
    '<div class="hud-scan"></div>' +
    '<div class="hud-col hud-left">' +
      '<div class="hud-brand">RSS // NEURO-SCAN</div>' +
      '<div class="hud-mode">TRYB // PLEŚŃ · SIEĆ</div>' +
      '<canvas class="hud-eeg" width="280" height="64" aria-hidden="true"></canvas>' +
      '<div class="hud-counts" id="brainCounts"></div>' +
      '<div class="hud-infect">INFEKCJA <b id="brainInfectHud">0%</b></div>' +
    "</div>" +
    '<div class="hud-col hud-right">' +
      '<div class="hud-right-title">AKTYWNOŚĆ DZIAŁÓW</div>' +
      '<div class="hud-depts" id="brainDepts"></div>' +
    "</div>";
  el.appendChild(wrap);
  hud = wrap;
  eegCanvas = wrap.querySelector(".hud-eeg");
  eegCtx = eegCanvas ? eegCanvas.getContext("2d") : null;
  labelLayer = document.createElement("div");
  labelLayer.className = "brain-labels";
  el.appendChild(labelLayer);
}

function countLabels(nodes) {
  var c = { fakt: 0, dokument_zrodlowy: 0, teoria: 0, teoria_spiskowa: 0, brak: 0 };
  for (var i = 0; i < nodes.length; i++) {
    var et = nodes[i].etykiety || [];
    var hit = false;
    if (et.indexOf("fakt") >= 0) { c.fakt++; hit = true; }
    if (et.indexOf("dokument_zrodlowy") >= 0) { c.dokument_zrodlowy++; hit = true; }
    if (et.indexOf("teoria") >= 0) { c.teoria++; hit = true; }
    if (et.indexOf("teoria_spiskowa") >= 0) { c.teoria_spiskowa++; hit = true; }
    if (nodes[i].brak_zrodla && nodes[i].typ === "sprawa" && !hit) c.brak++;
  }
  return c;
}

function updateHud() {
  if (!hud) return;
  var inf = hud.querySelector("#brainInfectHud");
  if (inf) inf.textContent = Math.round(state.progress * 100) + "%";
  var countsEl = hud.querySelector("#brainCounts");
  if (countsEl) {
    var nodes = nodeIndex.map(function (x) { return x.node; });
    var c = countLabels(nodes);
    countsEl.innerHTML =
      '<span class="c fakt">FAKT <b>' + c.fakt + "</b></span>" +
      '<span class="c dok">DOKUMENT <b>' + c.dokument_zrodlowy + "</b></span>" +
      '<span class="c teo">TEORIA <b>' + c.teoria + "</b></span>" +
      '<span class="c spi">SPISKOWA <b>' + c.teoria_spiskowa + "</b></span>";
  }
  var de = hud.querySelector("#brainDepts");
  if (de && meta && meta.deptLabels) {
    var byLobe = {};
    for (var i = 0; i < nodeIndex.length; i++) {
      var L = nodeIndex[i].lobe || "";
      byLobe[L] = (byLobe[L] || 0) + 1;
    }
    var keys = ["frontal_L", "frontal_R", "parietal_L", "parietal_R", "temporal_L", "temporal_R", "occipital_L", "occipital_R", "cerebellum_L", "cerebellum_R", "brainstem", "cc"];
    var html = "";
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var labs = (meta.deptLabels[key] || []).join(" · ");
      if (!labs && key === "cc") labs = "Mostek";
      if (!labs) continue;
      var n = byLobe[key] || 0;
      var title = (meta.lobes && meta.lobes[key] && meta.lobes[key].label) || key;
      var pct = Math.min(100, 18 + n * 8 + state.progress * 30);
      html += '<div class="dept-row" title="' + title + '"><span class="dn">' + labs + '</span><span class="db"><i style="width:' + pct + '%"></i></span></div>';
    }
    de.innerHTML = html;
  }
}

function drawEeg(t) {
  if (!eegCtx || !eegCanvas) return;
  var w = eegCanvas.width, h = eegCanvas.height;
  eegCtx.clearRect(0, 0, w, h);
  var channels = 3;
  var amp = 8 + state.progress * 10;
  for (var c = 0; c < channels; c++) {
    eegCtx.beginPath();
    eegCtx.strokeStyle = c === 0 ? "rgba(92,230,242,.85)" : c === 1 ? "rgba(61,220,132,.7)" : "rgba(245,230,163,.7)";
    eegCtx.lineWidth = 1.2;
    var y0 = 12 + c * 18;
    for (var x = 0; x < w; x++) {
      var u = x / w;
      var y = y0 + Math.sin(u * 22 + t * (2.2 + c * 0.4) + c) * amp * 0.35
        + Math.sin(u * 54 + t * 5.5 + c * 2) * amp * 0.12
        + (Math.sin(u * 9 + t * 0.7 + c) > 0.92 ? amp * 0.55 * Math.sin(u * 80) : 0);
      if (x === 0) eegCtx.moveTo(x, y); else eegCtx.lineTo(x, y);
    }
    eegCtx.stroke();
  }
}

function buildLabels() {
  if (!labelLayer || !meta || !meta.lobes) return;
  labelLayer.innerHTML = "";
  labelEls = [];
  var keys = Object.keys(meta.lobes);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === "cc") continue; /* Mostek already on frontal / dedicated */
    var info = meta.lobes[key];
    var div = document.createElement("div");
    div.className = "brain-label";
    var depts = (meta.deptLabels && meta.deptLabels[key]) ? meta.deptLabels[key].join(" · ") : "";
    div.innerHTML = "<em>" + (info.label || key) + "</em>" + (depts ? "<span>" + depts + "</span>" : "");
    labelLayer.appendChild(div);
    var p = info.labelPos || info.center || [0, 0, 0];
    labelEls.push({ el: div, pos: new THREE.Vector3(p[0], p[1], p[2]), key: key });
  }
  /* Mostek on the commissure */
  if (meta.lobes.cc) {
    var div2 = document.createElement("div");
    div2.className = "brain-label brain-label-core";
    div2.innerHTML = "<em>Spoidło wielkie</em><span>Mostek</span>";
    labelLayer.appendChild(div2);
    var p2 = meta.lobes.cc.labelPos || [0, 0.42, 0.12];
    labelEls.push({ el: div2, pos: new THREE.Vector3(p2[0], p2[1], p2[2]), key: "cc" });
  }
}

function projectLabels() {
  if (!camera || !labelEls.length || !container) return;
  var w = container.clientWidth, h = container.clientHeight;
  var v = new THREE.Vector3();
  var camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  for (var i = 0; i < labelEls.length; i++) {
    var item = labelEls[i];
    v.copy(item.pos);
    if (brainPivot) brainPivot.localToWorld(v);
    var to = v.clone().sub(camera.position);
    var behind = to.dot(camDir) < 0;
    v.project(camera);
    var x = (v.x * 0.5 + 0.5) * w;
    var y = (-v.y * 0.5 + 0.5) * h;
    var vis = !behind && v.z < 1 && x > -40 && x < w + 40 && y > 8 && y < h - 8;
    item.el.style.transform = "translate(" + x + "px," + y + "px)";
    item.el.style.opacity = vis ? (state.low ? "0.85" : "0.95") : "0";
  }
}


function frameView(pos, target) {
  target = target || new THREE.Vector3();
  var aspect = (camera && camera.aspect) ? camera.aspect : 1.2;
  if (aspect < 1.3) {
    var d = pos.clone().sub(target);
    var k = 1.3 / Math.max(0.72, aspect);
    pos = target.clone().add(d.multiplyScalar(Math.min(k, 1.6)));
  }
  return { pos: pos, target: target };
}

function viewpointFor(key) {
  if (!key || key === "overview") {
    return frameView(new THREE.Vector3(2.15, 1.28, 2.55), new THREE.Vector3(0, 0.02, 0));
  }
  var info = meta && meta.lobes && meta.lobes[key];
  var c = info && info.center
    ? new THREE.Vector3(info.center[0], info.center[1], info.center[2])
    : new THREE.Vector3();
  var out = c.clone();
  if (out.lengthSq() < 1e-4) out.set(0.25, 0.45, 1);
  out.normalize();
  /* Stay far enough that the whole brain stays in frame; only bias toward the lobe. */
  var pos = new THREE.Vector3().copy(out).multiplyScalar(2.25)
    .add(new THREE.Vector3(0.15, 0.75, 0.35))
    .addScaledVector(c, 0.35);
  if (pos.length() < 2.45) pos.setLength(2.5);
  var target = c.clone().multiplyScalar(0.42);
  if (key === "cc") {
    pos.set(1.15, 1.35, 2.05);
    target.set(0, 0.12, 0.08);
  }
  if (key === "brainstem") {
    pos.set(1.7, 0.35, 2.0);
    target.set(0, -0.35, 0.04);
  }
  return frameView(pos, target);
}

function setHighlight(key) {
  state.focusKey = key || "overview";
  var names = LOBE_BUNDLES[key] || null;
  activeBundles = null;
  if (names) {
    activeBundles = {};
    for (var i = 0; i < names.length; i++) activeBundles[names[i]] = 1;
  }
  var overview = !key || key === "overview";
  if (netUniforms) {
    netUniforms.uOverview.value = overview ? 1 : 0;
    if (overview) netUniforms.uFocusId.value = 0;
    else if (key === "cc") netUniforms.uFocusId.value = 100;
    else netUniforms.uFocusId.value = LOBE_IDS[key] || 0;
  }
}

function focusLobe(key, opts) {
  opts = opts || {};
  key = key || "overview";
  state.focusKey = key;
  if (!camera || !controls) {
    pendingShell = pendingShell || { tab: state.shellTab };
    return;
  }
  var vp = viewpointFor(key);
  if (reduceMotion || opts.instant) {
    camera.position.copy(vp.pos);
    controls.target.copy(vp.target);
    controls.update();
    camFly = null;
    return;
  }
  camFly = {
    p0: camera.position.clone(),
    p1: vp.pos,
    t0: controls.target.clone(),
    t1: vp.target,
    start: performance.now(),
    dur: opts.duration != null ? opts.duration : 900
  };
  controls.autoRotate = false;
}

function tickCam() {
  if (!camFly || !camera || !controls) return;
  var u = (performance.now() - camFly.start) / (camFly.dur || 900);
  if (u >= 1) {
    camera.position.copy(camFly.p1);
    controls.target.copy(camFly.t1);
    camFly = null;
    if (!reduceMotion && (state.shellTab === "bibl" || state.focusKey === "overview")) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
    }
    controls.update();
    return;
  }
  u = u * u * (3 - 2 * u);
  camera.position.lerpVectors(camFly.p0, camFly.p1, u);
  controls.target.lerpVectors(camFly.t0, camFly.t1, u);
}

function applyLabelFilter() {
  if (!labelEls.length) return;
  var key = state.focusKey;
  var showAll = state.libMode || key === "overview";
  for (var i = 0; i < labelEls.length; i++) {
    var el = labelEls[i].el;
    var on = showAll;
    if (!on && key) {
      var txt = (el.textContent || "") + (el.innerHTML || "");
      /* labelEls don't store key; match by known label text from meta */
    }
    /* store key on item if present */
    if (labelEls[i].key) on = showAll || labelEls[i].key === key || (key === "cc" && labelEls[i].key === "cc");
    el.classList.toggle("is-quiet", !showAll && !on);
    el.classList.toggle("is-focus", !showAll && !!on);
  }
}

function setLibraryMode(on) {
  state.libMode = !!on;
  if (hud) hud.classList.toggle("brain-hud-mini", !state.libMode);
  applyLabelFilter();
}

function setShellMode(tab, opts) {
  opts = opts || {};
  tab = tab || "biuro";
  state.shellTab = tab;
  var key = TAB_LOBE[tab] || "overview";
  if (!state.mounted || !state.ready) {
    pendingShell = { tab: tab, opts: opts };
    return;
  }
  if (tab !== "bibl" && state.sceneMode === "exam") setSceneMode("mold");
  setLibraryMode(tab === "bibl");
  setHighlight(key);
  focusLobe(key, opts);
  applyLabelFilter();
}

function setGraph(opts) {
  opts = opts || {};
  if (!brainPivot) return;
  state.onOpen = opts.onOpen || state.onOpen;
  state.visible = opts.visible || null;
  if (opts.nodes || opts.edges) {
    if (nodePts && nodePts.parent) nodePts.parent.remove(nodePts);
    if (nodePts && nodePts.geometry) nodePts.geometry.dispose();
    attachNodes({ nodes: opts.nodes || [], edges: opts.edges || [], visible: state.visible, onOpen: state.onOpen });
  } else if (opts.visible && nodePts) {
    /* filter in place if only visibility changed — rebuild is safer */
    if (nodePts.parent) nodePts.parent.remove(nodePts);
    if (nodePts.geometry) nodePts.geometry.dispose();
    attachNodes({ nodes: (opts.nodes || []), edges: opts.edges || [], visible: opts.visible, onOpen: state.onOpen });
  }
}

function setOnNavigate(fn) { state.onNavigate = fn || null; }

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
  if (state.sceneMode === "exam") {
    camera.position.set(2.05, 0.95, 2.55);
    controls.target.set(0, -0.45, 0);
    controls.minDistance = 1.5;
    controls.maxDistance = 8.5;
  } else {
    var vp = frameView(new THREE.Vector3(2.15, 1.28, 2.55), new THREE.Vector3(0, 0.02, 0));
    camera.position.copy(vp.pos);
    controls.target.copy(vp.target);
    controls.minDistance = 1.2;
    controls.maxDistance = 6.5;
  }
  controls.update();
}

function resize() {
  if (!renderer || !container) return;
  var w = Math.max(1, container.clientWidth);
  var h = Math.max(1, container.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, true);
  if (tractMat && renderer) {
    var s = new THREE.Vector2();
    renderer.getDrawingBufferSize(s);
    tractMat.resolution.set(s.x, s.y);
  }
  syncNetRes();
}

function pickNode(ev) {
  if (!renderer || !camera || !nodePts || !nodeIndex.length) return null;
  var rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  /* points threshold in pixels */
  raycaster.params.Points = raycaster.params.Points || {};
  raycaster.params.Points.threshold = 0.07;
  var hits = raycaster.intersectObject(nodePts, false);
  if (hits && hits.length) {
    var idx = hits[0].index;
    if (idx != null && nodeIndex[idx]) return nodeIndex[idx];
  }
  /* fallback: nearest in screen space */
  var best = null, bd = 28 * 28;
  var v = new THREE.Vector3();
  var w = rect.width, h = rect.height;
  var mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
  for (var i = 0; i < nodeIndex.length; i++) {
    v.copy(nodeIndex[i].pos);
    if (brainPivot) brainPivot.localToWorld(v);
    v.project(camera);
    if (v.z > 1) continue;
    var dx = (v.x * 0.5 + 0.5) * w - mx;
    var dy = (-v.y * 0.5 + 0.5) * h - my;
    var d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = nodeIndex[i]; }
  }
  return best;
}

function onPointerDown(ev) {
  pointerDown = { x: ev.clientX, y: ev.clientY };
  pointerMoved = false;
}

function onPointerMove(ev) {
  if (pointerDown) {
    var dx = ev.clientX - pointerDown.x, dy = ev.clientY - pointerDown.y;
    if (dx * dx + dy * dy > 16) pointerMoved = true;
  }
  var hit = pickNode(ev);
  var lobe = hit ? null : pickLobe(ev);
  var key = hit ? ("n:" + hit.node.id) : (lobe ? ("l:" + lobe) : "");
  if (key !== lastHover) {
    lastHover = key;
    if (state.hint) {
      if (hit && hit.node) {
        state.hint.textContent = hit.node.nazwa || hit.node.id;
        state.hint.hidden = false;
      } else if (lobe) {
        var tab = LOBE_TAB[lobe];
        var lab = (meta && meta.lobes && meta.lobes[lobe] && meta.lobes[lobe].label) || lobe;
        state.hint.textContent = tab ? (lab + " → " + (TAB_LABEL[tab] || tab)) : lab;
        state.hint.hidden = false;
      } else {
        state.hint.hidden = true;
      }
    }
    if (renderer) renderer.domElement.style.cursor = (hit || lobe) ? "pointer" : "grab";
  }
}

function pickLobe(ev) {
  if (!renderer || !camera) return null;
  var list = [];
  Object.keys(lobeMeshes).forEach(function (k) {
    if (lobeMeshes[k]) list.push(lobeMeshes[k]);
  });
  if (!list.length) return null;
  var rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  var hits = raycaster.intersectObjects(list, false);
  if (hits && hits.length && hits[0].object && hits[0].object.name) return hits[0].object.name;
  return null;
}

function onPointerUp(ev) {
  if (pointerDown && !pointerMoved) {
    var hit = pickNode(ev);
    if (hit && hit.node && state.onOpen) state.onOpen(hit.node);
    else if (state.onNavigate) {
      var lobe = pickLobe(ev);
      if (lobe) state.onNavigate(lobe, LOBE_TAB[lobe] || null);
    }
  }
  pointerDown = null;
}

function clearGroup(obj) {
  if (!obj) return;
  obj.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      var mats = o.material.length ? o.material : [o.material];
      mats.forEach(function (m) { if (m && m.dispose) m.dispose(); });
    }
  });
}

function unmount() {
  state.playing = false;
  state.ready = false;
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
  if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
  if (labelLayer && labelLayer.parentNode) labelLayer.parentNode.removeChild(labelLayer);
  renderer = scene = camera = controls = container = group = examGroup = brainPivot = null;
  tractLines = tractMat = tractTubes = pulsePts = nodePts = hyphaLines = sporePts = null;
  netAtoms = netDust = netSynapses = netRings = netElectrons = netLinks = null;
  netUniforms = null;
  netSamples = [];
  electronData = [];
  calipers = scanRing = hud = eegCanvas = eegCtx = labelLayer = null;
  labelEls = [];
  nodeIndex = [];
  fibers = [];
  infectUniforms = [];
  hyphaPaths = [];
  lobeMeshes = {};
  camFly = null;
  activeBundles = null;
  state.mounted = false;
  state.hint = null;
}


function makeNetUniforms() {
  if (netUniforms) return netUniforms;
  var seeds = [];
  for (var i = 0; i < 8; i++) seeds.push(new THREE.Vector3());
  netUniforms = {
    uT: { value: 0 },
    uTime: { value: 0 },
    uHolo: { value: 0 },
    uNSeeds: { value: 0 },
    uSeed: { value: seeds },
    uStart: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
    uFocusId: { value: 0 },
    uOverview: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMold: { value: new THREE.Color(COLOR.mold) },
    uMold2: { value: new THREE.Color(COLOR.glow) }
  };
  infectUniforms.push(netUniforms);
  return netUniforms;
}

function syncNetRes() {
  if (!netUniforms || !netUniforms.uRes || !renderer) return;
  renderer.getDrawingBufferSize(netUniforms.uRes.value);
}

function lobeTint(id) {
  var c = new THREE.Color();
  if (id === 1 || id === 2) c.set(0x4CC9FF);
  else if (id === 3 || id === 4) c.set(0x5CE6F2);
  else if (id === 5 || id === 6) c.set(0x8B6CFF);
  else if (id === 7 || id === 8) c.set(0x7EE8FF);
  else if (id === 9 || id === 10) c.set(0x6A5CFF);
  else if (id === 11) c.set(0xE8C36A);
  else c.set(0x4CC9FF);
  return c;
}

function lobeIdOfName(name) {
  var id = LOBE_IDS[name];
  if (id) return id;
  var n = (name || "").toLowerCase();
  if (n.indexOf("cerebellum") >= 0) return 9;
  if (n.indexOf("brainstem") >= 0) return 11;
  if (n.indexOf("frontal") >= 0) return 1;
  if (n.indexOf("parietal") >= 0) return 3;
  if (n.indexOf("temporal") >= 0) return 5;
  if (n.indexOf("occipital") >= 0) return 7;
  return 1;
}

function lobeIdFromPos(x, y, z) {
  if (y < -0.62) {
    if (Math.abs(x) < 0.18 && z > -0.15) return 11;
    return x < 0 ? 9 : 10;
  }
  if (z < -0.42) return x < 0 ? 7 : 8;
  if (y < -0.08 && Math.abs(z) < 0.55 && Math.abs(x) > 0.25) return x < 0 ? 5 : 6;
  if (y > 0.12 && z > 0.05) return x < 0 ? 1 : 2;
  return x < 0 ? 3 : 4;
}

function bakeMeshWorld(mesh) {
  mesh.updateWorldMatrix(true, false);
  var g = mesh.geometry.clone();
  var pos = g.getAttribute("position");
  var v = new THREE.Vector3();
  for (var i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeBoundingSphere();
  mesh.geometry = g;
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix();
}

function makePickMesh(mesh) {
  mesh.material = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide
  });
  mesh.renderOrder = 0;
  mesh.frustumCulled = true;
  if (mesh.name) lobeMeshes[mesh.name] = mesh;
  return mesh;
}

function sampleMeshes(meshes) {
  var total = 0;
  meshes.forEach(function (m) {
    var pos = m.geometry && m.geometry.getAttribute("position");
    if (pos) total += pos.count;
  });
  var target = state.low ? 10000 : 28000;
  var step = Math.max(1, Math.floor(total / Math.max(1, target)));
  var out = [];
  var tmp = new THREE.Vector3();
  meshes.forEach(function (m) {
    var pos = m.geometry && m.geometry.getAttribute("position");
    if (!pos) return;
    var lid = lobeIdOfName(m.name);
    for (var i = 0; i < pos.count; i += step) {
      tmp.fromBufferAttribute(pos, i);
      out.push({ x: tmp.x, y: tmp.y, z: tmp.z, lobe: lid, name: m.name || "" });
    }
  });
  return out;
}

var NET_GLSL_HEAD = [
  "precision highp float;",
  "uniform float uT, uTime, uHolo, uOverview, uFocusId;",
  "uniform int uNSeeds;",
  "uniform vec3 uSeed[8];",
  "uniform float uStart[8];",
  "uniform vec3 uMold, uMold2;",
  "float infection(vec3 p){",
  "  float m=0.0;",
  "  for(int i=0;i<8;i++){",
  "    if(i>=uNSeeds) break;",
  "    float d=length(p-uSeed[i]);",
  "    float R=max(0.0, uT-uStart[i])*2.05;",
  "    float f=1.0-smoothstep(R*0.40, R+0.06, d);",
  "    m=max(m,f);",
  "  }",
  "  return clamp(m,0.0,1.0);",
  "}",
  "float focusAmt(float lobe){",
  "  if(uOverview>0.5) return 1.0;",
  "  if(uFocusId>99.0) return (lobe>0.5 && lobe<2.5) ? 1.2 : 0.28;",
  "  return (abs(lobe-uFocusId)<0.5) ? 1.22 : 0.28;",
  "}"
].join("\n");

function atomMaterial() {
  var u = makeNetUniforms();
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: u,
    vertexShader: [
      "attribute float aLobe;",
      "attribute float aPhase;",
      "attribute float aSize;",
      "attribute vec3 color;",
      "varying float vLobe;",
      "varying float vPhase;",
      "varying vec3 vW;",
      "varying vec3 vCol;",
      "uniform vec2 uRes;",
      "void main(){",
      "  vLobe=aLobe; vPhase=aPhase; vCol=color;",
      "  vec4 w=modelMatrix*vec4(position,1.0);",
      "  vW=w.xyz;",
      "  vec4 mv=viewMatrix*w;",
      "  gl_PointSize=aSize * uRes.y * 0.15 / max(-mv.z, 0.35);",
      "  gl_Position=projectionMatrix*mv;",
      "}"
    ].join("\n"),
    fragmentShader: NET_GLSL_HEAD + "\n" + [
      "varying float vLobe, vPhase;",
      "varying vec3 vW, vCol;",
      "void main(){",
      "  vec2 p=gl_PointCoord*2.0-1.0;",
      "  float d=length(p);",
      "  if(d>1.0) discard;",
      "  float core=exp(-d*d*16.0);",
      "  float ring=smoothstep(0.52,0.36,d)*smoothstep(0.16,0.32,d);",
      "  float halo=exp(-d*d*6.5);",
      "  float flicker=0.75+0.25*sin(uTime*4.8+vPhase);",
      "  float inf=infection(vW);",
      "  float foc=focusAmt(vLobe);",
      "  vec3 col=mix(vCol, mix(uMold, uMold2, 0.7), inf);",
      "  col += vec3(0.90,0.74,0.28)*core*0.35;",
      "  col *= flicker * (0.55 + 0.45*foc);",
      "  col += vec3(0.55,0.85,1.0)*ring*0.55*foc;",
      "  float wave=0.5+0.5*sin(vW.y*7.2 - uTime*1.85 + vW.x*3.1);",
      "  col += vec3(0.28,0.55,1.0)*wave*0.10*foc;",
      "  float lum=max(col.r, max(col.g, col.b));",
      "  col*=0.72/max(0.72, lum);",
      "  float alpha=(core*0.70 + halo*0.10 + ring*0.20)*mix(0.45,0.80,foc);",
      "  alpha=mix(alpha, min(0.85, alpha*1.08), inf);",
      "  if(uHolo>0.01){",
      "    float scan=0.5+0.5*sin(vW.y*28.0+uTime*4.5);",
      "    col=mix(col, vec3(0.40,0.95,1.0), uHolo*(0.25+0.40*scan));",
      "    alpha=mix(alpha, max(alpha,0.55+0.28*scan), uHolo*0.7);",
      "  }",
      "  gl_FragColor=vec4(col, clamp(alpha,0.0,1.0));",
      "}"
    ].join("\n")
  });
}

function dustMaterial() {
  var u = makeNetUniforms();
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: u,
    vertexShader: [
      "attribute float aLobe;",
      "attribute float aPhase;",
      "attribute float aSize;",
      "attribute vec3 color;",
      "varying float vLobe;",
      "varying float vPhase;",
      "varying vec3 vW;",
      "varying vec3 vCol;",
      "uniform float uTime;",
      "uniform vec2 uRes;",
      "void main(){",
      "  vLobe=aLobe; vPhase=aPhase; vCol=color;",
      "  vec3 p=position;",
      "  p += 0.014*vec3(sin(uTime*0.7+aPhase), cos(uTime*0.9+aPhase*1.3), sin(uTime*1.1+aPhase*0.6));",
      "  vec4 w=modelMatrix*vec4(p,1.0);",
      "  vW=w.xyz;",
      "  vec4 mv=viewMatrix*w;",
      "  gl_PointSize=aSize * uRes.y * 0.11 / max(-mv.z, 0.35);",
      "  gl_Position=projectionMatrix*mv;",
      "}"
    ].join("\n"),
    fragmentShader: NET_GLSL_HEAD + "\n" + [
      "varying float vLobe, vPhase;",
      "varying vec3 vW, vCol;",
      "void main(){",
      "  vec2 p=gl_PointCoord*2.0-1.0;",
      "  float d=length(p);",
      "  if(d>1.0) discard;",
      "  float g=exp(-d*d*6.0);",
      "  float flicker=0.55+0.45*sin(uTime*6.2+vPhase*2.0);",
      "  float inf=infection(vW);",
      "  float foc=focusAmt(vLobe);",
      "  vec3 col=mix(vCol, uMold2, inf*0.8);",
      "  col *= flicker * (0.45+0.55*foc);",
      "  float inter=0.5+0.5*sin(vW.x*9.0+vW.z*8.0 - uTime*2.2);",
      "  col += vec3(0.6,0.45,1.0)*inter*0.25;",
      "  float alpha=g*0.26*foc*flicker;",
      "  if(uHolo>0.01) alpha=mix(alpha, alpha+0.2, uHolo);",
      "  gl_FragColor=vec4(col, clamp(alpha,0.0,0.85));",
      "}"
    ].join("\n")
  });
}

function lineNetMaterial() {
  var u = makeNetUniforms();
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: u,
    vertexShader: [
      "attribute float aLobe;",
      "attribute float aPhase;",
      "attribute float aU;",
      "attribute vec3 color;",
      "varying float vLobe, vPhase, vU;",
      "varying vec3 vW, vCol;",
      "void main(){",
      "  vLobe=aLobe; vPhase=aPhase; vU=aU; vCol=color;",
      "  vec4 w=modelMatrix*vec4(position,1.0);",
      "  vW=w.xyz;",
      "  gl_Position=projectionMatrix*viewMatrix*w;",
      "}"
    ].join("\n"),
    fragmentShader: NET_GLSL_HEAD + "\n" + [
      "varying float vLobe, vPhase, vU;",
      "varying vec3 vW, vCol;",
      "void main(){",
      "  float inf=infection(vW);",
      "  float foc=focusAmt(vLobe);",
      "  vec3 col=mix(vCol, mix(uMold, uMold2, 0.7), inf);",
      "  float pulse=pow(max(0.0, sin(uTime*2.6 - vU*6.2832 + vPhase)), 8.0);",
      "  col += vec3(0.75,0.95,1.0)*pulse;",
      "  col += vec3(0.90,0.72,0.28)*pulse*0.45;",
      "  col *= (0.45 + 0.55*foc);",
      "  float lum=max(col.r, max(col.g, col.b));",
      "  col*=0.62/max(0.62, lum);",
      "  float alpha=mix(0.10, 0.32, foc) + pulse*0.22 + inf*0.12;",
      "  if(uHolo>0.01){",
      "    float scan=0.5+0.5*sin(vW.y*24.0+uTime*4.5);",
      "    col=mix(col, vec3(0.45,0.95,1.0), uHolo*(0.2+0.35*scan));",
      "    alpha=mix(alpha, alpha+0.2, uHolo*0.6);",
      "  }",
      "  gl_FragColor=vec4(col, clamp(alpha,0.0,1.0));",
      "}"
    ].join("\n")
  });
}

function electronMaterial() {
  var u = makeNetUniforms();
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: u,
    vertexShader: [
      "attribute float aSize;",
      "attribute vec3 color;",
      "varying vec3 vCol;",
      "uniform vec2 uRes;",
      "void main(){",
      "  vCol=color;",
      "  vec4 mv=modelViewMatrix*vec4(position,1.0);",
      "  gl_PointSize=aSize * uRes.y * 0.18 / max(-mv.z, 0.35);",
      "  gl_Position=projectionMatrix*mv;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "varying vec3 vCol;",
      "void main(){",
      "  vec2 p=gl_PointCoord*2.0-1.0;",
      "  float d=length(p);",
      "  if(d>1.0) discard;",
      "  float g=exp(-d*d*8.0);",
      "  gl_FragColor=vec4(vCol, g);",
      "}"
    ].join("\n")
  });
}

function ringMaterial() {
  var u = makeNetUniforms();
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: u,
    vertexShader: [
      "attribute float aLobe;",
      "attribute float aPhase;",
      "varying float vLobe;",
      "varying vec3 vW;",
      "void main(){",
      "  vLobe=aLobe;",
      "  vec4 w=modelMatrix*vec4(position,1.0);",
      "  vW=w.xyz;",
      "  gl_Position=projectionMatrix*viewMatrix*w;",
      "}"
    ].join("\n"),
    fragmentShader: NET_GLSL_HEAD + "\n" + [
      "varying float vLobe;",
      "varying vec3 vW;",
      "void main(){",
      "  float foc=focusAmt(vLobe);",
      "  float inf=infection(vW);",
      "  vec3 col=mix(vec3(0.45,0.80,1.0), mix(uMold2, vec3(0.90,0.72,0.30), 0.35), inf);",
      "  float alpha=(0.28+0.45*foc) * (0.7+0.3*sin(uTime*3.0+vW.x*8.0));",
      "  if(uHolo>0.01) col=mix(col, vec3(0.4,0.95,1.0), uHolo*0.4);",
      "  gl_FragColor=vec4(col, clamp(alpha,0.0,0.85));",
      "}"
    ].join("\n")
  });
}

function buildLocalSynapses(samples, low) {
  var n = samples.length;
  var cell = 0.085;
  var buckets = Object.create(null);
  function key(ix, iy, iz) { return ix + "," + iy + "," + iz; }
  for (var i = 0; i < n; i++) {
    var s = samples[i];
    var k = key(Math.floor(s.x / cell), Math.floor(s.y / cell), Math.floor(s.z / cell));
    (buckets[k] || (buckets[k] = [])).push(i);
  }
  var maxLines = low ? 2200 : 7000;
  var pos = [], col = [], lobe = [], phase = [], uu = [];
  var used = 0;
  var stride = Math.max(1, Math.floor(n / (maxLines * 1.4)));
  for (var a = 0; a < n && used < maxLines; a += stride) {
    var sa = samples[a];
    var ax = Math.floor(sa.x / cell), ay = Math.floor(sa.y / cell), az = Math.floor(sa.z / cell);
    var best1 = -1, bd1 = 0.014, best2 = -1, bd2 = 0.014;
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dz = -1; dz <= 1; dz++) {
          var list = buckets[key(ax + dx, ay + dy, az + dz)];
          if (!list) continue;
          for (var t = 0; t < list.length; t++) {
            var b = list[t];
            if (b <= a) continue;
            var sb = samples[b];
            var ddx = sa.x - sb.x, ddy = sa.y - sb.y, ddz = sa.z - sb.z;
            var d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 < 0.0004 || d2 > 0.014) continue;
            if (d2 < bd1) { bd2 = bd1; best2 = best1; bd1 = d2; best1 = b; }
            else if (d2 < bd2) { bd2 = d2; best2 = b; }
          }
        }
      }
    }
    var pair = [best1, best2];
    for (var p = 0; p < pair.length; p++) {
      var b = pair[p];
      if (b < 0 || used >= maxLines) continue;
      var sb = samples[b];
      var ca = lobeTint(sa.lobe), cb = lobeTint(sb.lobe);
      pos.push(sa.x, sa.y, sa.z, sb.x, sb.y, sb.z);
      col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
      var lid = sa.lobe || sb.lobe;
      lobe.push(lid, lid);
      var ph = (a * 0.37 + b * 0.13) % 6.2832;
      phase.push(ph, ph);
      uu.push(0, 1);
      used++;
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("aLobe", new THREE.Float32BufferAttribute(lobe, 1));
  geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
  geo.setAttribute("aU", new THREE.Float32BufferAttribute(uu, 1));
  geo.computeBoundingSphere();
  var lines = new THREE.LineSegments(geo, lineNetMaterial());
  lines.renderOrder = 3;
  lines.frustumCulled = true;
  return lines;
}

function buildEntangleLinks(samples, low) {
  var rng = mulberry32(0xE7A6);
  var nWant = low ? 14 : 28;
  var pos = [], col = [], lobe = [], phase = [], uu = [];
  var n = samples.length;
  if (n < 8) return null;
  var tries = 0;
  var made = 0;
  while (made < nWant && tries < nWant * 40) {
    tries++;
    var i = Math.floor(rng() * n);
    var j = Math.floor(rng() * n);
    if (i === j) continue;
    var a = samples[i], b = samples[j];
    if (a.lobe && b.lobe && a.lobe === b.lobe) continue;
    var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    var d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 0.35 || d2 > 2.8) continue;
    var mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5, z: (a.z + b.z) * 0.5 };
    var lift = 0.08 + rng() * 0.06;
    var len = Math.sqrt(mid.x * mid.x + mid.y * mid.y + mid.z * mid.z) || 1;
    mid.x += mid.x / len * lift;
    mid.y += mid.y / len * lift + 0.04;
    mid.z += mid.z / len * lift;
    var segs = 6;
    var ph = rng() * 6.2832;
    var goldish = rng() > 0.45;
    var c1 = goldish ? new THREE.Color(COLOR.gold) : new THREE.Color(COLOR.violet);
    var c2 = goldish ? new THREE.Color(0xFFE6A0) : new THREE.Color(0xC5B0FF);
    function bez(t) {
      var o = 1 - t;
      return {
        x: o * o * a.x + 2 * o * t * mid.x + t * t * b.x,
        y: o * o * a.y + 2 * o * t * mid.y + t * t * b.y,
        z: o * o * a.z + 2 * o * t * mid.z + t * t * b.z
      };
    }
    for (var s = 0; s < segs; s++) {
      var p0 = bez(s / segs), p1 = bez((s + 1) / segs);
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      var u0 = s / segs, u1 = (s + 1) / segs;
      col.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
      lobe.push(a.lobe, b.lobe);
      phase.push(ph, ph);
      uu.push(u0, u1);
    }
    made++;
  }
  if (!pos.length) return null;
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("aLobe", new THREE.Float32BufferAttribute(lobe, 1));
  geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
  geo.setAttribute("aU", new THREE.Float32BufferAttribute(uu, 1));
  geo.computeBoundingSphere();
  var lines = new THREE.LineSegments(geo, lineNetMaterial());
  lines.renderOrder = 4;
  lines.frustumCulled = true;
  return lines;
}

function attachNetwork(samples) {
  netSamples = samples || [];
  electronData = [];
  makeNetUniforms();
  syncNetRes();
  var low = state.low;
  var n = netSamples.length;
  if (!n) return;

  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  var lobes = new Float32Array(n);
  var phase = new Float32Array(n);
  var sizes = new Float32Array(n);
  var c = new THREE.Color();
  for (var i = 0; i < n; i++) {
    var s = netSamples[i];
    pos[i * 3] = s.x; pos[i * 3 + 1] = s.y; pos[i * 3 + 2] = s.z;
    c.copy(lobeTint(s.lobe));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    lobes[i] = s.lobe;
    phase[i] = (i * 12.9898) % 6.2832;
    sizes[i] = (low ? 0.050 : 0.038) * (0.80 + (i % 7) * 0.04);
  }
  var geoA = new THREE.BufferGeometry();
  geoA.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geoA.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geoA.setAttribute("aLobe", new THREE.BufferAttribute(lobes, 1));
  geoA.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geoA.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geoA.computeBoundingSphere();
  netAtoms = new THREE.Points(geoA, atomMaterial());
  netAtoms.renderOrder = 5;
  netAtoms.frustumCulled = true;
  brainPivot.add(netAtoms);

  /* quantum dust + interference */
  var nDust = Math.min(n, low ? 1100 : 2600);
  var dStep = Math.max(1, Math.floor(n / nDust));
  var dpos = [], dcol = [], dlobe = [], dph = [], dsz = [];
  for (var d = 0; d < n; d += dStep) {
    var sd = netSamples[d];
    dpos.push(sd.x, sd.y, sd.z);
    var dc = (d % 11 === 0) ? new THREE.Color(COLOR.gold) : ((d % 5 === 0) ? new THREE.Color(COLOR.violet) : new THREE.Color(COLOR.electric));
    dcol.push(dc.r, dc.g, dc.b);
    dlobe.push(sd.lobe);
    dph.push((d * 7.13) % 6.2832);
    dsz.push(low ? 0.030 : 0.024);
  }
  /* stellar halo — silhouette just outside the brain */
  var hStep = low ? 8 : 5;
  for (var h = 0; h < n; h += hStep) {
    var sh = netSamples[h];
    var len = Math.sqrt(sh.x * sh.x + sh.y * sh.y + sh.z * sh.z) || 1;
    var k = 1.085;
    dpos.push(sh.x / len * len * k, sh.y / len * len * k, sh.z / len * len * k);
    var hc = (h % 9 === 0) ? new THREE.Color(COLOR.gold) : new THREE.Color(0x3A7CFF);
    dcol.push(hc.r, hc.g, hc.b);
    dlobe.push(sh.lobe);
    dph.push((h * 3.7) % 6.2832);
    dsz.push(low ? 0.024 : 0.020);
  }
  /* inner quantum cores */
  var nCore = low ? 8 : 14;
  for (var q = 0; q < nCore; q++) {
    var sc = netSamples[Math.floor((q + 0.5) * n / nCore) % n];
    dpos.push(sc.x * 0.38, sc.y * 0.38, sc.z * 0.38);
    var cc = (q % 2) ? new THREE.Color(COLOR.gold) : new THREE.Color(COLOR.violet);
    dcol.push(cc.r, cc.g, cc.b);
    dlobe.push(sc.lobe || 11);
    dph.push(q * 1.7);
    dsz.push(low ? 0.070 : 0.080);
  }
  var geoD = new THREE.BufferGeometry();
  geoD.setAttribute("position", new THREE.Float32BufferAttribute(dpos, 3));
  geoD.setAttribute("color", new THREE.Float32BufferAttribute(dcol, 3));
  geoD.setAttribute("aLobe", new THREE.Float32BufferAttribute(dlobe, 1));
  geoD.setAttribute("aPhase", new THREE.Float32BufferAttribute(dph, 1));
  geoD.setAttribute("aSize", new THREE.Float32BufferAttribute(dsz, 1));
  geoD.computeBoundingSphere();
  netDust = new THREE.Points(geoD, dustMaterial());
  netDust.renderOrder = 2;
  brainPivot.add(netDust);

  netSynapses = buildLocalSynapses(netSamples, low);
  if (netSynapses) brainPivot.add(netSynapses);
  netLinks = buildEntangleLinks(netSamples, low);
  if (netLinks) brainPivot.add(netLinks);

  /* orbital rings + electrons */
  var nRings = low ? 22 : 56;
  var ringStep = Math.max(1, Math.floor(n / nRings));
  var ringPts = [], ringCol = [];
  var rSeg = 22;
  electronData = [];
  var epos = [], ecol = [], esz = [];
  var eIdx = 0;
  for (var r = 0, ri = 0; r < n && ri < nRings; r += ringStep, ri++) {
    var sr = netSamples[r];
    var rad = 0.016 + (ri % 5) * 0.0028;
    var nx = sr.x, ny = sr.y, nz = sr.z;
    var nlen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= nlen; ny /= nlen; nz /= nlen;
    var ax, ay, az, bx, by, bz;
    if (Math.abs(ny) < 0.9) { ax = ny; ay = -nx; az = 0; }
    else { ax = 0; ay = -nz; az = ny; }
    var al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    ax /= al; ay /= al; az /= al;
    bx = ny * az - nz * ay;
    by = nz * ax - nx * az;
    bz = nx * ay - ny * ax;
    var rc = (ri % 4 === 0) ? new THREE.Color(COLOR.gold) : ((ri % 3 === 0) ? new THREE.Color(COLOR.violet) : new THREE.Color(COLOR.electric));
    for (var rs = 0; rs < rSeg; rs++) {
      var a0 = (rs / rSeg) * Math.PI * 2;
      var a1 = ((rs + 1) / rSeg) * Math.PI * 2;
      var x0 = sr.x + (Math.cos(a0) * ax + Math.sin(a0) * bx) * rad;
      var y0 = sr.y + (Math.cos(a0) * ay + Math.sin(a0) * by) * rad;
      var z0 = sr.z + (Math.cos(a0) * az + Math.sin(a0) * bz) * rad;
      var x1 = sr.x + (Math.cos(a1) * ax + Math.sin(a1) * bx) * rad;
      var y1 = sr.y + (Math.cos(a1) * ay + Math.sin(a1) * by) * rad;
      var z1 = sr.z + (Math.cos(a1) * az + Math.sin(a1) * bz) * rad;
      ringPts.push(x0, y0, z0, x1, y1, z1);
      ringCol.push(rc.r, rc.g, rc.b, rc.r, rc.g, rc.b);
    }
    var nEl = low ? 1 : 2;
    for (var e = 0; e < nEl; e++) {
      electronData.push({
        cx: sr.x, cy: sr.y, cz: sr.z,
        ax: ax, ay: ay, az: az,
        bx: bx, by: by, bz: bz,
        r: rad,
        speed: 1.4 + (ri % 6) * 0.35,
        phase: ri * 0.7 + e * Math.PI,
        gold: (ri % 4 === 0)
      });
      epos.push(sr.x, sr.y, sr.z);
      if (ri % 4 === 0) ecol.push(0.91, 0.76, 0.35);
      else if (ri % 3 === 0) ecol.push(0.55, 0.42, 1.0);
      else ecol.push(0.30, 0.80, 1.0);
      esz.push(low ? 0.07 : 0.06);
      eIdx++;
    }
  }
  if (ringPts.length) {
    var geoR = new THREE.BufferGeometry();
    geoR.setAttribute("position", new THREE.Float32BufferAttribute(ringPts, 3));
    geoR.setAttribute("color", new THREE.Float32BufferAttribute(ringCol, 3));
    var rmat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    netRings = new THREE.LineSegments(geoR, rmat);
    netRings.renderOrder = 6;
    brainPivot.add(netRings);
  }
  if (epos.length) {
    var geoE = new THREE.BufferGeometry();
    geoE.setAttribute("position", new THREE.Float32BufferAttribute(epos, 3));
    geoE.setAttribute("color", new THREE.Float32BufferAttribute(ecol, 3));
    geoE.setAttribute("aSize", new THREE.Float32BufferAttribute(esz, 1));
    netElectrons = new THREE.Points(geoE, electronMaterial());
    netElectrons.renderOrder = 8;
    brainPivot.add(netElectrons);
  }
}

function updateElectrons(t) {
  if (!netElectrons || !electronData.length) return;
  var attr = netElectrons.geometry.getAttribute("position");
  for (var i = 0; i < electronData.length; i++) {
    var e = electronData[i];
    var a = t * e.speed + e.phase;
    var ca = Math.cos(a), sa = Math.sin(a);
    attr.setXYZ(
      i,
      e.cx + (ca * e.ax + sa * e.bx) * e.r,
      e.cy + (ca * e.ay + sa * e.by) * e.r,
      e.cz + (ca * e.az + sa * e.bz) * e.r
    );
  }
  attr.needsUpdate = true;
}

function sampleProceduralCloud() {
  var low = state.low;
  var detail = low ? 4 : 6;
  var geo = new THREE.IcosahedronGeometry(1, detail);
  var pos = geo.getAttribute("position");
  var v = new THREE.Vector3();
  var out = [];
  var step = low ? 2 : 1;
  for (var i = 0; i < pos.count; i += step) {
    v.fromBufferAttribute(pos, i);
    var d = deformBrain(v.x, v.y, v.z);
    out.push({ x: d.x, y: d.y, z: d.z, lobe: lobeIdFromPos(d.x, d.y, d.z), name: "cortex_proc" });
  }
  geo.dispose();
  /* cerebellum + stem volumes */
  var rng = mulberry32(0xC10);
  var nCb = low ? 400 : 900;
  for (var c = 0; c < nCb; c++) {
    var u = rng() * Math.PI * 2;
    var w = Math.acos(2 * rng() - 1);
    var rr = Math.pow(rng(), 0.55);
    var x = Math.sin(w) * Math.cos(u) * 0.38 * 1.15 * rr;
    var y = Math.cos(w) * 0.38 * 0.7 * rr - 0.72;
    var z = Math.sin(w) * Math.sin(u) * 0.38 * 0.85 * rr - 0.22;
    out.push({ x: x, y: y, z: z, lobe: x < 0 ? 9 : 10, name: "cerebellum_proc" });
  }
  var nSt = low ? 120 : 260;
  for (var s = 0; s < nSt; s++) {
    var t = rng();
    var ang = rng() * Math.PI * 2;
    var rad = (0.12 + (0.16 - 0.12) * t) * Math.sqrt(rng());
    out.push({
      x: Math.cos(ang) * rad,
      y: -0.85 + (t - 0.5) * 0.45,
      z: 0.05 + Math.sin(ang) * rad,
      lobe: 11,
      name: "brainstem_proc"
    });
  }
  return out;
}

function buildFromAssets(gltf, tractList, metaIn, opts) {
  meta = metaIn || meta;
  fibers = tractList || [];
  brainPivot = new THREE.Group();
  brainPivot.name = "brain";
  var root = gltf && gltf.scene ? gltf.scene : gltf;
  if (root) {
    root.updateMatrixWorld(true);
    var meshes = [];
    root.traverse(function (o) {
      if (o.isMesh) meshes.push(o);
    });
    meshes.forEach(function (m) {
      bakeMeshWorld(m);
      makePickMesh(m);
      brainPivot.add(m);
    });
    attachNetwork(sampleMeshes(meshes));
  }
  applySeedUniforms();
  var built = buildTractLines(fibers, state.low);
  tractLines = built.lines;
  brainPivot.add(tractLines);
  tractTubes = buildTractTubes(fibers, state.low);
  brainPivot.add(tractTubes);
  pulsePts = buildPulses(tractTubes.userData.used || built.used);
  brainPivot.add(pulsePts);
  attachNodes(opts || {});
  hyphaPaths = buildHyphae(seedList());
  var empty = new Float32Array(0);
  hyphaLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true
    })
  );
  hyphaLines.renderOrder = 6;
  hyphaLines.visible = false;
  brainPivot.add(hyphaLines);
  sporePts = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: COLOR.glow,
      size: state.low ? 0.045 : 0.035,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    })
  );
  sporePts.renderOrder = 7;
  sporePts.visible = false;
  brainPivot.add(sporePts);
  calipers = buildCalipers();
  brainPivot.add(calipers);
  scanRing = buildScanRing();
  brainPivot.add(scanRing);
  group.add(brainPivot);
  buildLabels();
  state._hudPct = -1;
  applyInfection(state.progress);
  updateHud();
  state.ready = true;
  if (pendingMode) { setSceneMode(pendingMode); pendingMode = null; }
  else setSceneMode(state.sceneMode);
  if (pendingShell) {
    var ps = pendingShell; pendingShell = null;
    setShellMode(ps.tab, ps.opts || { instant: true });
  } else if (state.shellTab) {
    setShellMode(state.shellTab, { instant: true });
  }
}

function proceduralHull() {
  var geo = new THREE.IcosahedronGeometry(1, state.low ? 3 : 5);
  var pos = geo.attributes.position;
  var v = new THREE.Vector3();
  for (var i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    var d = deformBrain(v.x, v.y, v.z);
    pos.setXYZ(i, d.x, d.y, d.z);
  }
  geo.computeVertexNormals();
  var mesh = new THREE.Mesh(geo);
  mesh.name = "cortex_proc";
  return mesh;
}

function buildProceduralTracts() {
  var rng = mulberry32(0xD71);
  var list = [];
  function deformSamp() {
    var u = rng() * Math.PI * 2;
    var v = Math.acos(2 * rng() - 1);
    return deformBrain(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)).multiplyScalar(0.72);
  }
  for (var i = 0; i < (state.low ? 80 : 140); i++) {
    var a = deformSamp(), b = deformSamp();
    var mid = a.clone().add(b).multiplyScalar(0.5);
    mid.multiplyScalar(0.45);
    var n = 28;
    var pts = new Float32Array(n * 3);
    for (var k = 0; k < n; k++) {
      var t = k / (n - 1);
      var omt = 1 - t;
      var x = omt * omt * a.x + 2 * omt * t * mid.x + t * t * b.x;
      var y = omt * omt * a.y + 2 * omt * t * mid.y + t * t * b.y;
      var z = omt * omt * a.z + 2 * omt * t * mid.z + t * t * b.z;
      pts[k * 3] = x; pts[k * 3 + 1] = y; pts[k * 3 + 2] = z;
    }
    list.push({ name: "proc", pts: pts, n: n });
  }
  return list;
}

function buildProcedural(opts) {
  meta = meta || {
    lobes: {},
    deptLabels: {},
    deptLobes: {},
    moldSeeds: [
      [-0.45, 0.2, 0.5], [0.45, 0.2, 0.5],
      [-0.55, -0.15, 0.3], [0.55, -0.15, 0.3],
      [0, 0.1, -0.65], [0, 0.55, 0.05],
      [-0.2, -0.55, -0.15], [0.2, -0.55, -0.15]
    ]
  };
  fibers = buildProceduralTracts();
  brainPivot = new THREE.Group();
  var hull = proceduralHull();
  makePickMesh(hull);
  brainPivot.add(hull);
  var cb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16));
  cb.scale.set(1.15, 0.7, 0.85);
  cb.position.set(0, -0.72, -0.22);
  cb.name = "cerebellum_proc";
  makePickMesh(cb);
  brainPivot.add(cb);
  var st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 12));
  st.position.set(0, -0.85, 0.05);
  st.name = "brainstem_proc";
  makePickMesh(st);
  brainPivot.add(st);
  attachNetwork(sampleProceduralCloud());
  applySeedUniforms();
  var built = buildTractLines(fibers, state.low);
  tractLines = built.lines;
  brainPivot.add(tractLines);
  tractTubes = buildTractTubes(fibers, state.low);
  brainPivot.add(tractTubes);
  pulsePts = buildPulses(tractTubes.userData.used || built.used);
  brainPivot.add(pulsePts);
  attachNodes(opts || {});
  hyphaPaths = buildHyphae(seedList());
  hyphaLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.62,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  hyphaLines.renderOrder = 6;
  brainPivot.add(hyphaLines);
  sporePts = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: COLOR.glow, size: 0.035, transparent: true, opacity: 0.62,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    })
  );
  sporePts.renderOrder = 7;
  brainPivot.add(sporePts);
  calipers = buildCalipers();
  brainPivot.add(calipers);
  scanRing = buildScanRing();
  brainPivot.add(scanRing);
  group.add(brainPivot);
  buildLabels();
  state._hudPct = -1;
  applyInfection(state.progress);
  updateHud();
  state.ready = true;
  if (pendingMode) { setSceneMode(pendingMode); pendingMode = null; }
  else setSceneMode(state.sceneMode);
  if (pendingShell) {
    var ps = pendingShell; pendingShell = null;
    setShellMode(ps.tab, ps.opts || { instant: true });
  } else if (state.shellTab) {
    setShellMode(state.shellTab, { instant: true });
  }
}

function loadAssets() {
  var loader = new GLTFLoader();
  var glbP = new Promise(function (res, rej) {
    loader.load(ASSET.glb, res, undefined, rej);
  });
  var trP = fetch(ASSET.tracts).then(function (r) {
    if (!r.ok) throw new Error("tracts " + r.status);
    return r.arrayBuffer().then(parseTracts);
  });
  var metaP = fetch(ASSET.meta).then(function (r) {
    if (!r.ok) throw new Error("meta " + r.status);
    return r.json();
  });
  return Promise.all([glbP, trP, metaP]);
}

function mount(el, opts) {
  opts = opts || {};
  if (state.mounted) unmount();
  if (!el || !canWebGL()) return false;
  container = el;
  reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  state.low = opts.low != null ? !!opts.low : qualityLow();
  state.onOpen = opts.onOpen || null;
  state.onNavigate = opts.onNavigate || state.onNavigate;
  state.visible = opts.visible || null;
  if (opts.tab) state.shellTab = opts.tab;
  state.progress = opts.progress || 0;
  state.loop = !!opts.loop;
  state.ready = false;
  infectUniforms = [];

  var w = Math.max(1, el.clientWidth);
  var h = Math.max(1, el.clientHeight);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR.void);
  scene.fog = new THREE.FogExp2(COLOR.void, 0.08);
  camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 40);
  renderer = new THREE.WebGLRenderer({
    antialias: !state.low,
    alpha: false,
    powerPreference: state.low ? "low-power" : "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.low ? 1.6 : 2));
  renderer.setSize(w, h, true);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.setAttribute("aria-label", "Trójwymiarowa sieć pamięci firmy w kształcie mózgu: neurony, synapsy i szlaki świetlne");
  el.innerHTML = "";
  el.appendChild(renderer.domElement);
  var hint = document.createElement("div");
  hint.className = "brain-hint";
  hint.hidden = true;
  el.appendChild(hint);
  state.hint = hint;
  buildHud(el);

  scene.add(new THREE.AmbientLight(0x152038, 0.7));
  var key = new THREE.DirectionalLight(0x8EC8FF, 0.4);
  key.position.set(-1.4, 1.9, 1.7);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0x1E7F94, 0.28);
  fill.position.set(1.6, -0.3, -1.1);
  scene.add(fill);
  var rim = new THREE.DirectionalLight(0x8B6CFF, 0.25);
  rim.position.set(0.2, 0.4, -1.8);
  scene.add(rim);
  infectLight = new THREE.PointLight(COLOR.glow, 0.7, 8, 1.4);
  infectLight.position.set(0, -0.2, 0.2);
  scene.add(infectLight);

  group = new THREE.Group();
  scene.add(group);
  examGroup = buildExamScene();
  scene.add(examGroup);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 1.2;
  controls.maxDistance = 6.5;
  controls.autoRotate = !reduceMotion && state.sceneMode !== "exam";
  controls.autoRotateSpeed = 0.45;
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
  state.mounted = true;
  tick();

  loadAssets().then(function (pack) {
    if (!state.mounted || container !== el) return;
    buildFromAssets(pack[0], pack[1], pack[2], opts);
    fit();
  }).catch(function (err) {
    console.warn("RSS brain: GLB/tracts unavailable, procedural fallback", err);
    if (!state.mounted || container !== el) return;
    buildProcedural(opts);
    fit();
  });
  return true;
}

function tick() {
  if (!state.mounted || !renderer) return;
  raf = requestAnimationFrame(tick);
  var dt = clock ? clock.getDelta() : 0.016;
  var t = clock ? clock.elapsedTime : 0;
  if (state.playing) {
    var u = (performance.now() - state.playT0) / (state.playDur || 12000);
    if (u >= 1) {
      if (state.loop) {
        state.playT0 = performance.now();
        applyInfection(0);
      } else {
        applyInfection(1);
        state.playing = false;
        window.dispatchEvent(new CustomEvent("rss-brain-play-end"));
      }
    } else {
      var eased = u * u * (3 - 2 * u);
      applyInfection(eased);
    }
  }
  if (!reduceMotion) {
    updatePulses(t);
    updateElectrons(t);
  }
  applyHoloTime(t);
  tickCam();
  if (controls) controls.update();
  projectLabels();
  drawEeg(t);
  renderer.render(scene, camera);
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
  setSceneMode: setSceneMode,
  getSceneMode: function () { return state.sceneMode; },
  setShellMode: setShellMode,
  setLibraryMode: setLibraryMode,
  setHighlight: setHighlight,
  focusLobe: focusLobe,
  setGraph: setGraph,
  setOnNavigate: setOnNavigate,
  tabToLobe: TAB_LOBE,
  lobeToTab: LOBE_TAB,
  getShellTab: function () { return state.shellTab; },
  getProgress: function () { return state.progress; },
  isMounted: function () { return state.mounted; },
  isReady: function () { return state.ready; },
  canWebGL: canWebGL
};

window.RSS = window.RSS || {};
window.RSS.brain3d = api;
window.dispatchEvent(new Event("rss-brain-ready"));
