import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  twoline2satrec,
  propagate,
  gstime,
  SatRecError,
  type SatRec,
} from 'satellite.js';
import { FALLBACK_TLE } from './fallbackTLE';

/** Mean Earth radius in km — our scene uses Earth radii as the unit. */
const EARTH_RADIUS_KM = 6371;

/** NASA-derived textures shipped by `three-globe`, served with CORS via unpkg. */
const EARTH_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const STARS_TEXTURE_URL = 'https://unpkg.com/three-globe/example/img/night-sky.png';

/** Selectable CelesTrak groups. Counts are approximate. */
const GROUPS: { id: string; label: string }[] = [
  { id: 'stations', label: 'Space stations (~few)' },
  { id: 'visual', label: 'Brightest / visual (~150)' },
  { id: 'gps-ops', label: 'GPS operational (~30)' },
  { id: 'starlink', label: 'Starlink (~6000)' },
  { id: 'active', label: 'All active (~10000)' },
];

/** Hard cap so the main thread stays responsive even for huge groups. */
const MAX_SATS = 4000;

/**
 * Satellite categories used to colour-code the point cloud. A satellite is
 * classified purely from its CelesTrak name, so the same colours apply whether
 * you load a single group or the whole active catalogue. Order matters: the
 * first matching pattern wins, and "Other" is the catch-all fallback.
 *
 * `hex` drives the rendered point colour; `css` is the matching legend swatch.
 */
interface Category {
  id: string;
  label: string;
  hex: number;
  css: string;
  /** Case-insensitive test against the satellite's name. */
  match: (upperName: string) => boolean;
}

const CATEGORIES: Category[] = [
  {
    id: 'stations',
    label: 'Space stations',
    hex: 0xf87171,
    css: '#f87171',
    match: (n) => /ISS|ZARYA|CSS|TIANHE|TIANGONG|MIR|PROGRESS|SOYUZ|CREW DRAGON|CYGNUS/.test(n),
  },
  {
    id: 'starlink',
    label: 'Starlink',
    hex: 0x38bdf8,
    css: '#38bdf8',
    match: (n) => n.includes('STARLINK'),
  },
  {
    id: 'oneweb',
    label: 'OneWeb',
    hex: 0xc084fc,
    css: '#c084fc',
    match: (n) => n.includes('ONEWEB'),
  },
  {
    id: 'navigation',
    label: 'Navigation (GPS/GLONASS/…)',
    hex: 0xa3e635,
    css: '#a3e635',
    match: (n) => /GPS|NAVSTAR|GLONASS|GALILEO|BEIDOU|QZS|NAVIC|IRNSS/.test(n),
  },
  {
    id: 'iridium',
    label: 'Iridium',
    hex: 0xfb923c,
    css: '#fb923c',
    match: (n) => n.includes('IRIDIUM'),
  },
  {
    id: 'other',
    label: 'Other',
    hex: 0x2dd4bf,
    css: '#2dd4bf',
    match: () => true,
  },
];

const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

/** Classify a satellite by its name and return the owning category id. */
function categorize(name: string): string {
  const upper = name.toUpperCase();
  for (const cat of CATEGORIES) {
    if (cat.match(upper)) return cat.id;
  }
  return 'other';
}

/**
 * Count how many satellites fall in each category and return legend entries in
 * the canonical {@link CATEGORIES} order, omitting categories with no members.
 */
function buildLegend(sats: ParsedSat[]): { id: string; label: string; css: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of sats) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  return CATEGORIES.filter((c) => (counts.get(c.id) ?? 0) > 0).map((c) => ({
    id: c.id,
    label: c.label,
    css: c.css,
    count: counts.get(c.id) ?? 0,
  }));
}

/** WGS72 Earth radius used by SGP4 (satellite.js) for orbital element altitudes. */
const SGP4_EARTH_RADIUS_KM = 6378.135;

/** Click tolerance in screen pixels when picking a satellite. */
const PICK_PX = 14;

/** Number of samples used to trace one full orbit. */
const ORBIT_SAMPLES = 180;

/**
 * How altitude maps to scene distance.
 *  - `true`: real proportions — LEO hugs the globe, GEO sits far out.
 *  - `compressed`: a visualization aid that exaggerates low altitudes so the
 *    crowded LEO shells spread into visible bands (the "Shell view" mode).
 */
type ViewMode = 'true' | 'compressed';

/**
 * Map an altitude above Earth's surface (in Earth radii) to a scene radius
 * measured from the globe centre. The surface always maps to radius 1, so the
 * globe itself is unchanged; only the spacing of orbits above it differs.
 *
 * In `compressed` mode we apply a logarithmic remap that stretches the first
 * few thousand kilometres (where LEO lives) while still keeping MEO/GEO ordered
 * and on-screen. This is a visual aid, not a physically accurate scale.
 */
function radiusForAltitude(altitudeEr: number, mode: ViewMode): number {
  const alt = Math.max(0, altitudeEr);
  if (mode === 'true') return 1 + alt;
  // log1p grows fast near 0 then flattens; the multiplier sets how far the
  // GEO belt (~5.6 Er altitude) ends up from the surface in compressed view.
  return 1 + Math.log1p(alt * 6) * 0.9;
}

interface ParsedSat {
  name: string;
  satrec: SatRec;
  /** Category id from {@link categorize}, used for colour coding. */
  category: string;
}

/** Human-readable orbital summary derived from a satellite's SGP4 record. */
interface SatDetails {
  name: string;
  category: string;
  noradId: string;
  inclinationDeg: number;
  periodMin: number;
  apogeeKm: number;
  perigeeKm: number;
  eccentricity: number;
}

function computeDetails(sat: ParsedSat): SatDetails {
  const s = sat.satrec;
  return {
    name: sat.name,
    category: sat.category,
    noradId: String(s.satnum),
    inclinationDeg: (s.inclo * 180) / Math.PI,
    // Mean motion `no` is in radians/minute, so one revolution is 2π/no minutes.
    periodMin: (2 * Math.PI) / s.no,
    // `alta`/`altp` are apogee/perigee altitudes expressed in Earth radii.
    apogeeKm: s.alta * SGP4_EARTH_RADIUS_KM,
    perigeeKm: s.altp * SGP4_EARTH_RADIUS_KM,
    eccentricity: s.ecco,
  };
}

/** Split raw 3-line-element text into satellite records via satellite.js. */
function parseTle(text: string): ParsedSat[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const sats: ParsedSat[] = [];
  for (let i = 0; i + 2 < lines.length || (i + 1 < lines.length && lines[i].startsWith('1 ')); i += 3) {
    // Standard layout: name line, then "1 ..." and "2 ...".
    const name = lines[i];
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (!l1 || !l2 || !l1.startsWith('1 ') || !l2.startsWith('2 ')) continue;
    try {
      const satrec = twoline2satrec(l1, l2);
      if (satrec.error === SatRecError.None) sats.push({ name, satrec, category: categorize(name) });
    } catch {
      /* skip malformed records */
    }
  }
  return sats;
}

type Status = 'loading' | 'live' | 'fallback';

export default function SatelliteGlobe() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [group, setGroup] = useState('stations');
  const [speed, setSpeed] = useState(60); // time multiplier
  const [status, setStatus] = useState<Status>('loading');
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState<ParsedSat | null>(null);
  // Per-category counts for the currently loaded set, driving the colour legend.
  const [legend, setLegend] = useState<{ id: string; label: string; css: string; count: number }[]>(
    [],
  );

  // View mode (true scale vs. compressed "Shell view"), the control menu's
  // open state, and per-layer visibility toggles.
  const [viewMode, setViewMode] = useState<ViewMode>('true');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSats, setShowSats] = useState(true);
  const [showOrbit, setShowOrbit] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [showEarth, setShowEarth] = useState(true);

  // Keep the live list of satellites and the time multiplier in refs so the
  // animation loop (set up once) always sees the latest values.
  const satsRef = useRef<ParsedSat[]>([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // The current view mode mirrored into a ref for the render loop.
  const viewModeRef = useRef<ViewMode>(viewMode);
  viewModeRef.current = viewMode;

  // The satellite drawn at each rendered point index (rebuilt every tick), so a
  // click on a point can be mapped back to its underlying record.
  const drawnSatsRef = useRef<ParsedSat[]>([]);
  // The currently selected satellite, mirrored into a ref for the render loop.
  const selectedRef = useRef<ParsedSat | null>(null);
  selectedRef.current = selected;
  // Set inside the scene effect; (re)builds the orbit trace + marker on demand.
  const rebuildOrbitRef = useRef<(sat: ParsedSat | null) => void>(() => {});
  // Set inside the scene effect; restores the camera to its starting pose.
  const resetViewRef = useRef<() => void>(() => {});
  // Set inside the scene effect; toggles a named layer's visibility.
  const setLayerRef = useRef<(layer: 'sats' | 'orbit' | 'stars' | 'earth', visible: boolean) => void>(
    () => {},
  );

  const details = useMemo(() => (selected ? computeDetails(selected) : null), [selected]);

  // --- Fetch TLEs whenever the selected group changes. ---
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    // A new group means the previous selection no longer applies.
    setSelected(null);

    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(
      group,
    )}&FORMAT=tle`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseTle(text);
        if (parsed.length === 0) throw new Error('no records');
        satsRef.current = parsed.slice(0, MAX_SATS);
        setCount(satsRef.current.length);
        setLegend(buildLegend(satsRef.current));
        setStatus('live');
      })
      .catch(() => {
        if (cancelled) return;
        const parsed = parseTle(FALLBACK_TLE);
        satsRef.current = parsed;
        setCount(parsed.length);
        setLegend(buildLegend(parsed));
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, [group]);

  // --- Three.js scene: created once, lives for the component's lifetime. ---
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = Math.max(440, Math.round(width * 0.72));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    const CAMERA_HOME = new THREE.Vector3(0, 1.6, 4.2);
    camera.position.copy(CAMERA_HOME);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.3;
    controls.maxDistance = 30;
    controls.rotateSpeed = 0.5;

    // Lighting: soft ambient so the whole globe reads, plus a "sun".
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(5, 3, 5);
    scene.add(sun);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    // Earth — textured if the NASA Blue Marble loads, neutral blue otherwise.
    const earthGeo = new THREE.SphereGeometry(1, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({ color: 0x1f3a5f, shininess: 6 });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);
    loader.load(
      EARTH_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        earthMat.map = tex;
        earthMat.color.set(0xffffff);
        earthMat.needsUpdate = true;
      },
      undefined,
      () => {
        /* keep the solid-colour fallback */
      },
    );

    // Starfield background — NASA deep star map on a big inward-facing sphere,
    // with a procedural point-cloud fallback if the texture is unavailable.
    let starField: THREE.Object3D | null = null;
    // Desired starfield visibility, tracked here so a toggle made before the
    // texture finishes loading is still honoured once it appears.
    let starsVisible = true;
    loader.load(
      STARS_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const skyGeo = new THREE.SphereGeometry(400, 48, 48);
        const skyMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
        starField = new THREE.Mesh(skyGeo, skyMat);
        starField.visible = starsVisible;
        scene.add(starField);
      },
      undefined,
      () => {
        const starGeo = new THREE.BufferGeometry();
        const n = 2000;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const v = new THREE.Vector3().randomDirection().multiplyScalar(300);
          pos.set([v.x, v.y, v.z], i * 3);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        starField = new THREE.Points(
          starGeo,
          new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: false }),
        );
        starField.visible = starsVisible;
        scene.add(starField);
      },
    );

    // Satellites — a single Points cloud whose position and colour buffers we
    // rewrite each tick. Per-vertex colours encode each satellite's category.
    const satGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_SATS * 3);
    const satColors = new Float32Array(MAX_SATS * 3);
    satGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    satGeo.setAttribute('color', new THREE.BufferAttribute(satColors, 3));
    satGeo.setDrawRange(0, 0);
    const satMat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 2.4,
      sizeAttenuation: false,
    });
    const satPoints = new THREE.Points(satGeo, satMat);
    scene.add(satPoints);

    // Pre-resolve each category's colour into linear RGB triplets so the render
    // loop only does buffer writes (no per-point colour-space conversion).
    const categoryRgb: Record<string, [number, number, number]> = {};
    for (const cat of CATEGORIES) {
      const c = new THREE.Color().setHex(cat.hex, THREE.SRGBColorSpace);
      categoryRgb[cat.id] = [c.r, c.g, c.b];
    }

    // Highlight marker — a single, larger amber point tracking the selection.
    const highlightGeo = new THREE.BufferGeometry();
    highlightGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const highlightMat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 9,
      sizeAttenuation: false,
    });
    const highlight = new THREE.Points(highlightGeo, highlightMat);
    highlight.visible = false;
    highlight.renderOrder = 2;
    scene.add(highlight);

    // Orbit trace — one full revolution of the selected satellite (ECI frame),
    // so it stays fixed in inertial space just like the satellite points.
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((ORBIT_SAMPLES + 1) * 3), 3),
    );
    const orbitMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.7 });
    const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
    orbitLine.visible = false;
    scene.add(orbitLine);

    /**
     * ECI position (km) -> scene coords (Earth radii). Z (north) -> scene Y.
     * The radial magnitude is remapped through `radiusForAltitude` so the same
     * direction can be drawn at true or compressed altitude depending on mode.
     */
    const eciToScene = (out: Float32Array, offset: number, p: { x: number; y: number; z: number }) => {
      // Scene axes: X stays, ECI Z (north) -> scene Y, ECI Y -> scene -Z.
      const x = p.x / EARTH_RADIUS_KM;
      const y = p.z / EARTH_RADIUS_KM;
      const z = -p.y / EARTH_RADIUS_KM;
      const r = Math.hypot(x, y, z);
      if (r < 1e-6) {
        out[offset] = x;
        out[offset + 1] = y;
        out[offset + 2] = z;
        return;
      }
      // r is the true geocentric distance in Earth radii; altitude is r - 1.
      const scaled = radiusForAltitude(r - 1, viewModeRef.current) / r;
      out[offset] = x * scaled;
      out[offset + 1] = y * scaled;
      out[offset + 2] = z * scaled;
    };

    // Simulated clock — advances faster than real time by `speedRef.current`.
    let simTime = Date.now();
    let lastReal = performance.now();
    let lastPropagate = 0;

    const propagateSats = (date: Date) => {
      const sats = satsRef.current;
      const gmst = gstime(date);
      const posAttr = satGeo.getAttribute('position') as THREE.BufferAttribute;
      const colorAttr = satGeo.getAttribute('color') as THREE.BufferAttribute;
      const drawnSats = drawnSatsRef.current;
      drawnSats.length = 0;
      let drawn = 0;
      for (let i = 0; i < sats.length && drawn < MAX_SATS; i++) {
        const pv = propagate(sats[i].satrec, date);
        const p = pv?.position;
        if (!p || Number.isNaN(p.x)) continue;
        eciToScene(positions, drawn * 3, p);
        const rgb = categoryRgb[sats[i].category] ?? categoryRgb.other;
        satColors[drawn * 3] = rgb[0];
        satColors[drawn * 3 + 1] = rgb[1];
        satColors[drawn * 3 + 2] = rgb[2];
        drawnSats[drawn] = sats[i];
        drawn++;
      }
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      satGeo.setDrawRange(0, drawn);

      // Track the selected satellite with the highlight marker.
      const sel = selectedRef.current;
      if (sel) {
        const pv = propagate(sel.satrec, date);
        const p = pv?.position;
        if (p && !Number.isNaN(p.x)) {
          const hPos = highlightGeo.getAttribute('position') as THREE.BufferAttribute;
          eciToScene(hPos.array as Float32Array, 0, p);
          hPos.needsUpdate = true;
          highlight.visible = true;
        } else {
          highlight.visible = false;
        }
      }

      // Spin the globe to sidereal time so it turns under the inertial orbits.
      // (Approximate geographic registration — good enough for a viewer.)
      earth.rotation.y = -gmst;
    };

    // Trace one full orbit of `sat` starting at the current simulated time.
    // Whether the trace is shown also depends on the "Orbit trace" layer toggle.
    let orbitLayerVisible = true;
    rebuildOrbitRef.current = (sat: ParsedSat | null) => {
      if (!sat) {
        orbitLine.visible = false;
        highlight.visible = false;
        return;
      }
      const periodMs = ((2 * Math.PI) / sat.satrec.no) * 60000;
      const arr = orbitGeo.getAttribute('position').array as Float32Array;
      const last = new Float32Array(3);
      for (let i = 0; i <= ORBIT_SAMPLES; i++) {
        const t = simTime + (i / ORBIT_SAMPLES) * periodMs;
        const pv = propagate(sat.satrec, new Date(t));
        const p = pv?.position;
        if (p && !Number.isNaN(p.x)) {
          eciToScene(last, 0, p);
        }
        arr[i * 3] = last[0];
        arr[i * 3 + 1] = last[1];
        arr[i * 3 + 2] = last[2];
      }
      (orbitGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      orbitGeo.setDrawRange(0, ORBIT_SAMPLES + 1);
      orbitGeo.computeBoundingSphere();
      orbitLine.visible = orbitLayerVisible;
    };

    // Restore the camera to its starting pose (used by the "Reset view" button).
    resetViewRef.current = () => {
      controls.target.set(0, 0, 0);
      camera.position.copy(CAMERA_HOME);
      camera.updateProjectionMatrix();
      controls.update();
    };

    // Toggle a named layer's visibility from the control menu.
    setLayerRef.current = (layer, visible) => {
      switch (layer) {
        case 'sats':
          satPoints.visible = visible;
          break;
        case 'orbit':
          orbitLayerVisible = visible;
          // Only actually show it when a satellite is selected.
          orbitLine.visible = visible && !!selectedRef.current;
          break;
        case 'stars':
          starsVisible = visible;
          if (starField) starField.visible = visible;
          break;
        case 'earth':
          earth.visible = visible;
          break;
      }
    };

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      simTime += (now - lastReal) * speedRef.current;
      lastReal = now;

      // Re-propagate at ~10 Hz; render every frame for smooth controls.
      if (now - lastPropagate > 100) {
        propagateSats(new Date(simTime));
        lastPropagate = now;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Click to select / unselect a satellite. ---
    const projected = new THREE.Vector3();
    const candidate = new THREE.Vector3();

    // Is `point` hidden behind the Earth from the camera's viewpoint?
    const isOccluded = (point: THREE.Vector3) => {
      const dir = point.clone().sub(camera.position);
      const dist = dir.length();
      dir.normalize();
      const b = camera.position.dot(dir);
      const c = camera.position.dot(camera.position) - 1; // Earth radius == 1
      const disc = b * b - c;
      if (disc < 0) return false;
      const t = -b - Math.sqrt(disc);
      return t > 0.001 && t < dist - 0.02;
    };

    const pickSatellite = (clientX: number, clientY: number): ParsedSat | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const drawn = satGeo.drawRange.count;
      let best = -1;
      let bestDist = PICK_PX;
      for (let i = 0; i < drawn; i++) {
        candidate.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        projected.copy(candidate).project(camera);
        if (projected.z > 1) continue; // behind the camera
        const sx = (projected.x * 0.5 + 0.5) * rect.width;
        const sy = (-projected.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - px, sy - py);
        if (d < bestDist && !isOccluded(candidate)) {
          bestDist = d;
          best = i;
        }
      }
      return best >= 0 ? drawnSatsRef.current[best] ?? null : null;
    };

    // Treat a press-release without meaningful movement as a click (so dragging
    // the globe with OrbitControls does not change the selection).
    let downX = 0;
    let downY = 0;
    let moved = false;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      moved = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) moved = true;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (moved) return;
      setSelected(pickSatellite(e.clientX, e.clientY));
    };
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = Math.max(440, Math.round(w * 0.72));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      rebuildOrbitRef.current = () => {};
      resetViewRef.current = () => {};
      setLayerRef.current = () => {};
      controls.dispose();
      renderer.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      satGeo.dispose();
      satMat.dispose();
      highlightGeo.dispose();
      highlightMat.dispose();
      orbitGeo.dispose();
      orbitMat.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // Rebuild the orbit trace + marker whenever the selection changes.
  useEffect(() => {
    rebuildOrbitRef.current(selected);
  }, [selected]);

  // When the view mode flips, the satellite points re-map automatically on the
  // next tick (eciToScene reads the live ref), but the static orbit trace needs
  // an explicit rebuild so it lines up with the dots.
  useEffect(() => {
    rebuildOrbitRef.current(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Bridge each layer toggle into the scene.
  useEffect(() => {
    setLayerRef.current('sats', showSats);
  }, [showSats]);
  useEffect(() => {
    setLayerRef.current('orbit', showOrbit);
  }, [showOrbit]);
  useEffect(() => {
    setLayerRef.current('stars', showStars);
  }, [showStars]);
  useEffect(() => {
    setLayerRef.current('earth', showEarth);
  }, [showEarth]);

  const statusLabel =
    status === 'loading'
      ? 'Loading elements…'
      : status === 'live'
        ? `Live from CelesTrak — ${count} objects`
        : `Offline fallback — ${count} objects`;

  return (
    <figure
      style={{
        margin: '2rem 0',
        borderRadius: '1rem',
        border: '1px solid #262626',
        background: '#111111',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          padding: '0.9rem 1rem',
          borderBottom: '1px solid #262626',
          fontSize: '0.85rem',
          color: '#a1a1a1',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Group</span>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            style={{
              background: '#1a1a1a',
              color: '#ededed',
              border: '1px solid #262626',
              borderRadius: '0.4rem',
              padding: '0.25rem 0.5rem',
            }}
          >
            {GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 180px' }}>
          <span>Speed {speed}×</span>
          <input
            type="range"
            min={1}
            max={500}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            style={{ flex: 1, accentColor: '#2dd4bf' }}
            aria-label="Time multiplier"
          />
        </label>

        <span
          style={{
            color: status === 'fallback' ? '#fbbf24' : '#2dd4bf',
            whiteSpace: 'nowrap',
          }}
        >
          ● {statusLabel}
        </span>
      </div>

      {legend.length > 1 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem 1rem',
            padding: '0.6rem 1rem',
            borderBottom: '1px solid #262626',
            fontSize: '0.78rem',
            color: '#a1a1a1',
          }}
        >
          <span style={{ color: '#a1a1a1' }}>Colour key</span>
          {legend.map((entry) => (
            <span
              key={entry.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '0.7rem',
                  height: '0.7rem',
                  borderRadius: '50%',
                  background: entry.css,
                  flex: '0 0 auto',
                }}
              />
              <span style={{ color: '#ededed' }}>{entry.label}</span>
              <span>({entry.count})</span>
            </span>
          ))}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div ref={mountRef} style={{ width: '100%', lineHeight: 0 }} />

        {/* Control menu — view mode, layer toggles, and reset camera. */}
        <div
          style={{
            position: 'absolute',
            top: '0.75rem',
            left: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            alignItems: 'flex-start',
          }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Toggle controls menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(17, 17, 17, 0.9)',
              border: '1px solid #3f3f46',
              borderRadius: '0.6rem',
              color: '#ededed',
              cursor: 'pointer',
              fontSize: '0.8rem',
              padding: '0.4rem 0.6rem',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span aria-hidden="true">☰</span> Controls
          </button>

          {menuOpen && (
            <div
              style={{
                width: 'min(220px, calc(100vw - 3rem))',
                background: 'rgba(17, 17, 17, 0.92)',
                border: '1px solid #3f3f46',
                borderRadius: '0.6rem',
                padding: '0.75rem 0.85rem',
                fontSize: '0.8rem',
                color: '#ededed',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <div>
                <div style={{ color: '#a1a1a1', marginBottom: '0.35rem' }}>View mode</div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {(
                    [
                      ['true', 'True scale'],
                      ['compressed', 'Shell view'],
                    ] as [ViewMode, string][]
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      aria-pressed={viewMode === mode}
                      style={{
                        flex: 1,
                        background: viewMode === mode ? '#2dd4bf' : '#1a1a1a',
                        color: viewMode === mode ? '#04221d' : '#ededed',
                        border: '1px solid #3f3f46',
                        borderRadius: '0.4rem',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: viewMode === mode ? 600 : 400,
                        padding: '0.3rem 0.4rem',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p
                  style={{
                    margin: '0.4rem 0 0',
                    fontSize: '0.7rem',
                    lineHeight: 1.35,
                    color: '#a1a1a1',
                  }}
                >
                  {viewMode === 'true'
                    ? 'True scale: every satellite sits at its real altitude, so the low-orbit shells crowd against the globe.'
                    : 'Shell view: a non-physical log scale that fans the crowded low-orbit shells out into visible bands. A visual aid, not a real distance.'}
                </p>
              </div>

              <div>
                <div style={{ color: '#a1a1a1', marginBottom: '0.35rem' }}>Layers</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {(
                    [
                      ['Satellites', showSats, setShowSats],
                      ['Orbit trace', showOrbit, setShowOrbit],
                      ['Starfield', showStars, setShowStars],
                      ['Earth', showEarth, setShowEarth],
                    ] as [string, boolean, (v: boolean) => void][]
                  ).map(([label, value, setter]) => (
                    <label
                      key={label}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setter(e.target.checked)}
                        style={{ accentColor: '#2dd4bf' }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => resetViewRef.current()}
                style={{
                  background: '#1a1a1a',
                  color: '#ededed',
                  border: '1px solid #3f3f46',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.5rem',
                }}
              >
                Reset view
              </button>
            </div>
          )}
        </div>

        {details && (
          <div
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              width: 'min(240px, calc(100% - 1.5rem))',
              background: 'rgba(17, 17, 17, 0.9)',
              border: '1px solid #3f3f46',
              borderRadius: '0.6rem',
              padding: '0.75rem 0.85rem',
              fontSize: '0.8rem',
              color: '#ededed',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <strong style={{ color: '#fbbf24', wordBreak: 'break-word' }}>{details.name}</strong>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close selection"
                style={{
                  flex: '0 0 auto',
                  background: 'transparent',
                  border: 'none',
                  color: '#a1a1a1',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: '0.6rem',
                rowGap: '0.25rem',
                margin: 0,
                color: '#a1a1a1',
              }}
            >
              <dt>Category</dt>
              <dd
                style={{
                  margin: 0,
                  color: '#ededed',
                  textAlign: 'right',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.4rem',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '0.65rem',
                    height: '0.65rem',
                    borderRadius: '50%',
                    background: (CATEGORY_BY_ID[details.category] ?? CATEGORY_BY_ID.other).css,
                    flex: '0 0 auto',
                  }}
                />
                {(CATEGORY_BY_ID[details.category] ?? CATEGORY_BY_ID.other).label}
              </dd>
              <dt>NORAD</dt>
              <dd style={{ margin: 0, color: '#ededed', textAlign: 'right' }}>{details.noradId}</dd>
              <dt>Inclination</dt>
              <dd style={{ margin: 0, color: '#ededed', textAlign: 'right' }}>
                {details.inclinationDeg.toFixed(2)}°
              </dd>
              <dt>Period</dt>
              <dd style={{ margin: 0, color: '#ededed', textAlign: 'right' }}>
                {details.periodMin.toFixed(1)} min
              </dd>
              <dt>Apogee</dt>
              <dd style={{ margin: 0, color: '#ededed', textAlign: 'right' }}>
                {Math.round(details.apogeeKm).toLocaleString()} km
              </dd>
              <dt>Perigee</dt>
              <dd style={{ margin: 0, color: '#ededed', textAlign: 'right' }}>
                {Math.round(details.perigeeKm).toLocaleString()} km
              </dd>
              <dt>Eccentricity</dt>
              <dd style={{ margin: 0, color: '#ededed', textAlign: 'right' }}>
                {details.eccentricity.toFixed(4)}
              </dd>
            </dl>
          </div>
        )}
      </div>

      <figcaption style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#a1a1a1' }}>
        Drag to rotate, scroll to zoom. Click a satellite to highlight it, trace
        its orbit, and read its orbital parameters; click empty space or ✕ to
        clear. Use <strong style={{ color: '#ededed' }}>☰ Controls</strong> to
        switch between <strong style={{ color: '#ededed' }}>True scale</strong>{' '}
        (real altitudes — low orbits hug the globe) and{' '}
        <strong style={{ color: '#ededed' }}>Shell view</strong> (a non-physical
        log scale that spreads the crowded low-orbit shells into visible bands),
        toggle layers on or off, and reset the camera. Positions are propagated
        in your browser with SGP4 (satellite.js) from CelesTrak two-line
        elements. Dots are colour-coded by category (Starlink, OneWeb, space
        stations, navigation, Iridium, and everything else) per the colour key
        above; the globe spins at sidereal rate beneath their inertial orbits.
      </figcaption>
    </figure>
  );
}
