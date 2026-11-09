import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * The hero: two porcelain tablets carrying the same function drift together
 * and fuse into one shared file. Every other cycle the merge breaks the type
 * check and the tablets are pushed back apart: the two outcomes Twins has.
 */

export type HeroPhase = "apart" | "joining" | "kept" | "refused";

const ACCENT = "#4a2cff";
const RED = "#e0341f";
const GREEN = "#0e8f61";
const INK = "#141311";

const CODE = [
  "export function formatDate(d: Date) {",
  "  const day = String(d.getDate())",
  "    .padStart(2, \"0\");",
  "  const month = MONTHS[d.getMonth()];",
  "  return `${day} ${month}`;",
  "}",
];

type Face = { path: string; tag: string; tone: "copy" | "kept" | "refused" };

function drawFace(face: Face): HTMLCanvasElement {
  const W = 1024;
  const H = 1100;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, W, H);

  const mono = (w: number, px: number) => `${w} ${px}px "Martian Mono", ui-monospace, monospace`;
  const tone = face.tone === "kept" ? GREEN : face.tone === "refused" ? RED : ACCENT;

  // header: path and tag
  g.fillStyle = "rgba(20,19,17,0.55)";
  g.font = mono(500, 30);
  g.fillText(face.path, 72, 120);
  g.font = mono(600, 24);
  const tw = g.measureText(face.tag).width + 40;
  g.fillStyle = tone;
  roundRect(g, 72, 160, tw, 50, 25);
  g.fill();
  g.fillStyle = "#ffffff";
  g.fillText(face.tag, 92, 194);

  g.fillStyle = "rgba(20,19,17,0.12)";
  g.fillRect(72, 250, W - 144, 2);

  // code, every line marked as a duplicate on the copies
  const top = 310;
  const lh = 84;
  CODE.forEach((line, i) => {
    const y = top + i * lh;
    if (face.tone !== "kept") {
      g.fillStyle = face.tone === "refused" ? "rgba(224,52,31,0.09)" : "rgba(74,44,255,0.08)";
      g.fillRect(60, y - 48, W - 120, lh - 8);
      g.fillStyle = tone;
      g.fillRect(60, y - 48, 6, lh - 8);
    }
    g.font = mono(400, 31);
    g.fillStyle = INK;
    g.fillText(line, 84, y);
  });

  // footer line
  const fy = top + CODE.length * lh + 84;
  g.fillStyle = "rgba(20,19,17,0.12)";
  g.fillRect(72, fy - 60, W - 144, 2);
  g.font = mono(500, 26);
  g.fillStyle = face.tone === "copy" ? "rgba(20,19,17,0.5)" : tone;
  const foot =
    face.tone === "kept"
      ? "2 callers rewired · 0 new errors"
      : face.tone === "refused"
        ? "TS2554 Expected 2 arguments"
        : "6 lines, written twice";
  g.fillText(foot, 72, fy);
  return c;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (t: number) => Math.min(1, Math.max(0, t));

// one cycle, seconds
const T_APART = 2.4;
const T_JOIN = 1.3;
const T_HOLD = 3.2;
const T_SPLIT = 1.2;
const CYCLE = T_APART + T_JOIN + T_HOLD + T_SPLIT;

export function Hero3D({ onPhase }: { onPhase?: (p: HeroPhase) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const phaseCb = useRef(onPhase);
  phaseCb.current = onPhase;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0.7, 11);
    camera.lookAt(0, -0.6, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe9e6de, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-4, 7, 6);
    scene.add(key);
    const glow = new THREE.PointLight(ACCENT, 0, 9, 1.6);
    glow.position.set(0, 0, 2.2);
    scene.add(glow);

    // soft contact shadow: a blurred ellipse under each tablet
    const sc = document.createElement("canvas");
    sc.width = sc.height = 256;
    const sg = sc.getContext("2d")!;
    const grad = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(20,19,17,0.55)");
    grad.addColorStop(0.45, "rgba(20,19,17,0.22)");
    grad.addColorStop(1, "rgba(20,19,17,0)");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 256, 256);
    const shadowTex = new THREE.CanvasTexture(sc);
    const shadowGeo = new THREE.PlaneGeometry(3.6, 0.9);
    const makeShadow = () => {
      const m = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = -1.75;
      scene.add(m);
      return m;
    };
    const shA = makeShadow();
    const shB = makeShadow();

    const W = 2.7;
    const H = 2.95;
    const slabGeo = new RoundedBoxGeometry(W, H, 0.18, 6, 0.09);
    const faceGeo = new THREE.PlaneGeometry(W * 0.94, W * 0.94 * (1100 / 1024));
    const porcelain = () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xfbfaf6,
        roughness: 0.36,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        sheen: 0.3,
      });

    const textures: THREE.Texture[] = [];
    const tex = (face: Face) => {
      const t = new THREE.CanvasTexture(drawFace(face));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.push(t);
      return t;
    };

    const group = new THREE.Group();
    scene.add(group);

    const makeTablet = () => {
      const g = new THREE.Group();
      const slab = new THREE.Mesh(slabGeo, porcelain());
      g.add(slab);
      const faceMat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.z = 0.092;
      g.add(face);
      // a thin accent rim drawn just behind the face
      const rimMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false });
      const rim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.08, H + 0.08, 0.02, 4, 0.11), rimMat);
      rim.position.z = -0.08;
      rim.renderOrder = -1;
      g.add(rim);
      group.add(g);
      return { g, slab, faceMat, rimMat, rim };
    };

    const A = makeTablet();
    const B = makeTablet();
    let faces: { a: THREE.Texture; b: THREE.Texture; kept: THREE.Texture; refused: THREE.Texture } | null = null;

    const build = () => {
      if (disposed) return;
      faces = {
        a: tex({ path: "src/lib/date.ts", tag: "COPY 1", tone: "copy" }),
        b: tex({ path: "src/utils/format.ts", tag: "COPY 2", tone: "copy" }),
        kept: tex({ path: "src/shared/format-date.ts", tag: "KEPT", tone: "kept" }),
        refused: tex({ path: "src/utils/format.ts", tag: "SAID NO", tone: "refused" }),
      };
      A.faceMat.map = faces.a;
      B.faceMat.map = faces.b;
      A.faceMat.needsUpdate = B.faceMat.needsUpdate = true;
    };
    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fontsReady) {
      Promise.all([fontsReady.load('400 31px "Martian Mono"'), fontsReady.load('600 24px "Martian Mono"')])
        .catch(() => undefined)
        .then(build);
    } else build();

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      // keep both tablets in frame on narrow screens
      camera.position.z = w / h < 1.4 ? 11 * Math.min(2, 1.4 / Math.max(0.5, w / h)) : 11;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let pointerX = 0;
    let pointerY = 0;
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointerX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointerY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let visible = true;
    const io = new IntersectionObserver((entries) => (visible = entries.some((x) => x.isIntersecting)), { threshold: 0 });
    io.observe(el);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last: HeroPhase | null = null;
    const emit = (p: HeroPhase) => {
      if (p !== last) {
        last = p;
        phaseCb.current?.(p);
      }
    };

    const clock = new THREE.Clock();
    let elapsed = 0;
    let raf = 0;
    const SEP = 1.85;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) {
        clock.getDelta();
        return;
      }
      elapsed += Math.min(clock.getDelta(), 0.05);
      const cycleIndex = Math.floor(elapsed / CYCLE);
      const refuse = cycleIndex % 2 === 1;
      let t = reduced ? T_APART + T_JOIN + 0.5 : elapsed % CYCLE;

      // how far together (0 apart, 1 fused)
      let join = 0;
      let phase: HeroPhase = "apart";
      if (t < T_APART) {
        join = 0;
      } else if (t < T_APART + T_JOIN) {
        join = ease((t - T_APART) / T_JOIN);
        phase = "joining";
      } else if (t < T_APART + T_JOIN + T_HOLD) {
        join = 1;
        phase = refuse ? "refused" : "kept";
      } else {
        join = 1 - ease((t - T_APART - T_JOIN - T_HOLD) / T_SPLIT);
        phase = "apart";
      }
      const sinceFuse = t - (T_APART + T_JOIN);

      // a refused merge never quite fuses: it touches, shakes, and is pushed back
      let gap = 1 - join;
      if (refuse && phase === "refused") {
        const kick = clamp(sinceFuse / 0.5);
        gap = 0.16 * ease(kick) + Math.sin(sinceFuse * 38) * 0.035 * (1 - kick);
      }
      const bob = Math.sin(elapsed * 1.1) * 0.06;
      A.g.position.set(-SEP * gap, bob, 0.02 * (1 - gap));
      B.g.position.set(SEP * gap, -bob, -0.02);
      A.g.rotation.y = 0.32 * gap;
      B.g.rotation.y = -0.32 * gap;
      A.g.rotation.z = -0.03 * gap;
      B.g.rotation.z = 0.03 * gap;

      shA.position.x = A.g.position.x;
      shB.position.x = B.g.position.x;
      shA.material.opacity = 0.42 - bob * 0.8;
      shB.material.opacity = 0.42 + bob * 0.8;

      const fused = phase === "kept";
      if (faces) {
        A.faceMat.map = fused ? faces.kept : faces.a;
        B.faceMat.map = phase === "refused" ? faces.refused : faces.b;
        B.g.visible = !fused;
        shB.visible = !fused;
      }

      // the rim and light pulse once on the outcome
      const pulse = phase === "kept" || phase === "refused" ? Math.exp(-sinceFuse * 2.2) : 0;
      const tone = phase === "refused" ? RED : ACCENT;
      glow.color.set(tone);
      glow.intensity = 14 * pulse;
      A.rimMat.color.set(phase === "kept" ? GREEN : tone);
      B.rimMat.color.set(tone);
      A.rimMat.opacity = phase === "kept" ? 0.9 * pulse + 0.12 : phase === "joining" ? 0.25 * join : 0;
      B.rimMat.opacity = phase === "refused" ? 0.9 * pulse + 0.15 : phase === "joining" ? 0.25 * join : 0;
      A.rim.visible = A.rimMat.opacity > 0.01;
      B.rim.visible = B.rimMat.opacity > 0.01;
      const s = 1 + (phase === "kept" ? 0.03 * pulse : 0);
      A.g.scale.setScalar(s);

      group.rotation.y += (pointerX * 0.12 - group.rotation.y) * 0.04;
      group.rotation.x += (pointerY * 0.05 - group.rotation.x) * 0.04;
      emit(phase);
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      textures.forEach((t) => t.dispose());
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      envTex.dispose();
      shadowTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (failed) return null;
  return <div ref={host} className="absolute inset-0" aria-hidden />;
}
