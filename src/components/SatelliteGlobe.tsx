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

/** WGS72 Earth radius used by SGP4 (satellite.js) for orbital element altitudes. */
const SGP4_EARTH_RADIUS_KM = 6378.135;

/** Click tolerance in screen pixels when picking a satellite. */
const PICK_PX = 14;

/** Number of samples used to trace one full orbit. */
const ORBIT_SAMPLES = 180;

interface ParsedSat {
  name: string;
  satrec: SatRec;
}

/** Human-readable orbital summary derived from a satellite's SGP4 record. */
interface SatDetails {
  name: string;
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
      if (satrec.error === SatRecError.None) sats.push({ name, satrec });
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

  // Keep the live list of satellites and the time multiplier in refs so the
  // animation loop (set up once) always sees the latest values.
  const satsRef = useRef<ParsedSat[]>([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // The satellite drawn at each rendered point index (rebuilt every tick), so a
  // click on a point can be mapped back to its underlying record.
  const drawnSatsRef = useRef<ParsedSat[]>([]);
  // The currently selected satellite, mirrored into a ref for the render loop.
  const selectedRef = useRef<ParsedSat | null>(null);
  selectedRef.current = selected;
  // Set inside the scene effect; (re)builds the orbit trace + marker on demand.
  const rebuildOrbitRef = useRef<(sat: ParsedSat | null) => void>(() => {});

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
        setStatus('live');
      })
      .catch(() => {
        if (cancelled) return;
        const parsed = parseTle(FALLBACK_TLE);
        satsRef.current = parsed;
        setCount(parsed.length);
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
    const height = Math.max(360, Math.round(width * 0.62));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.set(0, 1.6, 4.2);

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
    loader.load(
      STARS_TEXTURE_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const skyGeo = new THREE.SphereGeometry(400, 48, 48);
        const skyMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
        starField = new THREE.Mesh(skyGeo, skyMat);
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
        scene.add(starField);
      },
    );

    // Satellites — a single Points cloud whose buffer we rewrite each tick.
    const satGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_SATS * 3);
    satGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    satGeo.setDrawRange(0, 0);
    const satMat = new THREE.PointsMaterial({
      color: 0x2dd4bf,
      size: 2.4,
      sizeAttenuation: false,
    });
    const satPoints = new THREE.Points(satGeo, satMat);
    scene.add(satPoints);

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

    /** ECI position (km) -> scene coords (Earth radii). Z (north) -> scene Y. */
    const eciToScene = (out: Float32Array, offset: number, p: { x: number; y: number; z: number }) => {
      out[offset] = p.x / EARTH_RADIUS_KM;
      out[offset + 1] = p.z / EARTH_RADIUS_KM;
      out[offset + 2] = -p.y / EARTH_RADIUS_KM;
    };

    // Simulated clock — advances faster than real time by `speedRef.current`.
    let simTime = Date.now();
    let lastReal = performance.now();
    let lastPropagate = 0;

    const propagateSats = (date: Date) => {
      const sats = satsRef.current;
      const gmst = gstime(date);
      const posAttr = satGeo.getAttribute('position') as THREE.BufferAttribute;
      const drawnSats = drawnSatsRef.current;
      drawnSats.length = 0;
      let drawn = 0;
      for (let i = 0; i < sats.length && drawn < MAX_SATS; i++) {
        const pv = propagate(sats[i].satrec, date);
        const p = pv?.position;
        if (!p || Number.isNaN(p.x)) continue;
        eciToScene(positions, drawn * 3, p);
        drawnSats[drawn] = sats[i];
        drawn++;
      }
      posAttr.needsUpdate = true;
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
      orbitLine.visible = true;
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
      const h = Math.max(360, Math.round(w * 0.62));
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

      <div style={{ position: 'relative' }}>
        <div ref={mountRef} style={{ width: '100%', lineHeight: 0 }} />

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
        clear. Positions are propagated in your browser with SGP4 (satellite.js)
        from CelesTrak two-line elements. Teal dots are satellites; the globe
        spins at sidereal rate beneath their inertial orbits.
      </figcaption>
    </figure>
  );
}
