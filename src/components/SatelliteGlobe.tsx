import { useEffect, useRef, useState } from 'react';
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

interface ParsedSat {
  name: string;
  satrec: SatRec;
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

  // Keep the live list of satellites and the time multiplier in refs so the
  // animation loop (set up once) always sees the latest values.
  const satsRef = useRef<ParsedSat[]>([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // --- Fetch TLEs whenever the selected group changes. ---
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

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

    // Simulated clock — advances faster than real time by `speedRef.current`.
    let simTime = Date.now();
    let lastReal = performance.now();
    let lastPropagate = 0;

    const propagateSats = (date: Date) => {
      const sats = satsRef.current;
      const gmst = gstime(date);
      const posAttr = satGeo.getAttribute('position') as THREE.BufferAttribute;
      let drawn = 0;
      for (let i = 0; i < sats.length && drawn < MAX_SATS; i++) {
        const pv = propagate(sats[i].satrec, date);
        const p = pv?.position;
        if (!p || Number.isNaN(p.x)) continue;
        // ECI (km) -> scene (Earth radii). ECI Z is the north pole -> scene Y.
        positions[drawn * 3] = p.x / EARTH_RADIUS_KM;
        positions[drawn * 3 + 1] = p.z / EARTH_RADIUS_KM;
        positions[drawn * 3 + 2] = -p.y / EARTH_RADIUS_KM;
        drawn++;
      }
      posAttr.needsUpdate = true;
      satGeo.setDrawRange(0, drawn);
      // Spin the globe to sidereal time so it turns under the inertial orbits.
      // (Approximate geographic registration — good enough for a viewer.)
      earth.rotation.y = -gmst;
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
      controls.dispose();
      renderer.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      satGeo.dispose();
      satMat.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

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

      <div ref={mountRef} style={{ width: '100%', lineHeight: 0 }} />

      <figcaption style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#a1a1a1' }}>
        Drag to rotate, scroll to zoom. Positions are propagated in your browser
        with SGP4 (satellite.js) from CelesTrak two-line elements. Teal dots are
        satellites; the globe spins at sidereal rate beneath their inertial orbits.
      </figcaption>
    </figure>
  );
}
