"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Stars, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { LONDON } from "@/lib/coords";

export type Leg = { code: string; flag: string; lat: number; lng: number };
export type Phase = "idle" | "rolling" | "flying" | "landed";

const R = 1.6;

function llToVec(lat: number, lng: number, r = R) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function greatCircle(a: [number, number], b: [number, number], segs = 40) {
  const va = llToVec(a[0], a[1], 1).normalize();
  const vb = llToVec(b[0], b[1], 1).normalize();
  const angle = Math.max(va.angleTo(vb), 1e-3);
  const axis = new THREE.Vector3().crossVectors(va, vb);
  if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0);
  axis.normalize();
  const lift = THREE.MathUtils.clamp(0.06 + angle * 0.3, 0.08, 0.72);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle * t);
    const p = va.clone().applyQuaternion(q);
    p.multiplyScalar(R + Math.sin(Math.PI * t) * lift);
    pts.push(p);
  }
  return pts;
}

function buildPath(waypoints: [number, number][]) {
  const all: THREE.Vector3[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = greatCircle(waypoints[i]!, waypoints[i + 1]!);
    if (i > 0) seg.shift();
    all.push(...seg);
  }
  return new THREE.CatmullRomCurve3(all);
}

function Earth({ texture }: { texture: string }) {
  const tex = useTexture(texture);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh>
      <sphereGeometry args={[R, 96, 96]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  );
}

/** Small low-poly airliner, nose along +z. */
function Jet() {
  return (
    <group scale={0.8}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.13, 10]} />
        <meshBasicMaterial color="#fff4d6" />
      </mesh>
      <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.012, 0.03, 10]} />
        <meshBasicMaterial color="#fff4d6" />
      </mesh>
      <mesh>
        <boxGeometry args={[0.14, 0.004, 0.028]} />
        <meshBasicMaterial color="#ffd27f" />
      </mesh>
      <mesh position={[0, 0, -0.055]}>
        <boxGeometry args={[0.06, 0.004, 0.018]} />
        <meshBasicMaterial color="#ffd27f" />
      </mesh>
      <mesh position={[0, 0.016, -0.058]}>
        <boxGeometry args={[0.004, 0.028, 0.018]} />
        <meshBasicMaterial color="#ffd27f" />
      </mesh>
    </group>
  );
}

function Marker({ leg }: { leg: Leg }) {
  const pos = useMemo(() => llToVec(leg.lat, leg.lng, R + 0.012), [leg]);
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()),
    [pos],
  );
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ring.current) return;
    const f = (Math.sin(s.clock.elapsedTime * 3) * 0.5 + 0.5) * 1.8;
    ring.current.scale.setScalar(1 + f);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - f / 1.8);
  });
  return (
    <group position={pos} quaternion={quat}>
      <mesh>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="#ffd27f" />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.06, 0.085, 40]} />
        <meshBasicMaterial color="#ffb000" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Rig({
  phase,
  flightKey,
  curve,
  span,
  flightSec,
}: {
  phase: Phase;
  flightKey: number;
  curve: THREE.CatmullRomCurve3 | null;
  span: number;
  flightSec: number;
}) {
  const plane = useRef<THREE.Group>(null);
  const flight = useRef<{ key: number; start: number } | null>(null);
  const look = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((state) => {
    const e = state.clock.elapsedTime;
    let t = 0;
    if (phase === "flying") {
      if (!flight.current || flight.current.key !== flightKey) flight.current = { key: flightKey, start: e };
      t = Math.min(1, (e - flight.current.start) / flightSec);
    } else if (phase === "landed") {
      t = 1;
    }

    const desired = new THREE.Vector3();
    const target = new THREE.Vector3();

    if (curve && (phase === "flying" || phase === "landed")) {
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const radial = p.clone().normalize();
      if (plane.current) {
        plane.current.visible = true;
        plane.current.position.copy(p);
        const right = new THREE.Vector3().crossVectors(radial, tan).normalize();
        const up2 = new THREE.Vector3().crossVectors(tan, right).normalize();
        plane.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up2, tan));
      }
      // Chase cam: ride BEHIND the plane along its heading and above it, looking
      // ahead down the flight path — you fly the trajectory with it. Short hops
      // ride higher/closer so the region fills the frame; long hops trail lower
      // for the big sweep. A min-distance clamp stops it ever skimming into space.
      const land = phase === "landed";
      const shortness = 1 - THREE.MathUtils.clamp(span / 1.4, 0, 1);
      const upAmt = THREE.MathUtils.lerp(1.0, 2.0, shortness) * (land ? 0.82 : 1);
      const backAmt = THREE.MathUtils.lerp(1.9, 0.85, shortness) * (land ? 0.7 : 1);
      const cam = p.clone().addScaledVector(radial, upAmt).addScaledVector(tan, -backAmt);
      const minDist = land ? 2.05 : 2.3;
      if (cam.length() < minDist) cam.setLength(minDist);
      desired.copy(cam);
      target.copy(p).addScaledVector(tan, land ? 0 : 0.35);
    } else if (phase === "rolling") {
      if (plane.current) plane.current.visible = false;
      desired.copy(llToVec(LONDON[0], LONDON[1], 1)).multiplyScalar(3.6);
      desired.y += 0.55;
      target.set(0, 0, 0);
    } else {
      if (plane.current) plane.current.visible = false;
      const a = e * 0.1;
      desired.set(Math.sin(a) * 4.2, 1.3, Math.cos(a) * 4.2);
      target.set(0, 0, 0);
    }

    const k = phase === "flying" ? 0.09 : phase === "landed" ? 0.05 : 0.035;
    state.camera.position.lerp(desired, k);
    look.current.lerp(target, 0.14);
    state.camera.lookAt(look.current);
  });

  return (
    <group ref={plane} visible={false}>
      <Jet />
      <pointLight color="#ffd27f" intensity={2} distance={1.2} />
    </group>
  );
}

function Scene({
  phase,
  flightKey,
  legs,
  pastDots,
  flightSec,
  texture,
}: {
  phase: Phase;
  flightKey: number;
  legs: Leg[];
  pastDots: { code: string; lat: number; lng: number }[];
  flightSec: number;
  texture: string;
}) {
  const curve = useMemo(() => {
    if (!legs.length) return null;
    const waypoints: [number, number][] = [LONDON, ...legs.map((l) => [l.lat, l.lng] as [number, number])];
    return buildPath(waypoints);
  }, [legs]);
  const pathPoints = useMemo(() => (curve ? curve.getPoints(Math.max(60, legs.length * 60)) : []), [curve, legs.length]);
  const span = useMemo(() => {
    if (!legs.length) return 0;
    const lon = llToVec(LONDON[0], LONDON[1], 1).normalize();
    return Math.max(...legs.map((l) => lon.angleTo(llToVec(l.lat, l.lng, 1).normalize())));
  }, [legs]);
  const active = phase === "flying" || phase === "landed";

  return (
    <>
      <Stars radius={120} depth={60} count={2600} factor={4} fade speed={0.4} />
      <Suspense fallback={null}>
        <Earth texture={texture} />
      </Suspense>
      <mesh scale={1.16}>
        <sphereGeometry args={[R, 48, 48]} />
        <meshBasicMaterial color="#4aa3ff" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
      <mesh position={llToVec(LONDON[0], LONDON[1], R + 0.01)}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {pastDots.map((d) => (
        <mesh key={d.code} position={llToVec(d.lat, d.lng, R + 0.008)}>
          <sphereGeometry args={[0.02, 10, 10]} />
          <meshBasicMaterial color="#9a6c12" />
        </mesh>
      ))}
      {pathPoints.length > 0 && (
        <Line points={pathPoints} color="#ffce5c" lineWidth={2.4} transparent opacity={0.85} />
      )}
      {active && legs.map((l) => <Marker key={l.code} leg={l} />)}
      <Rig phase={phase} flightKey={flightKey} curve={curve} span={span} flightSec={flightSec} />
    </>
  );
}

export default function Globe({
  phase,
  flightKey,
  legs,
  pastDots,
  flightSec,
  texture = "/earth-blue.jpg",
}: {
  phase: Phase;
  flightKey: number;
  legs: Leg[];
  pastDots: { code: string; lat: number; lng: number }[];
  flightSec: number;
  texture?: string;
}) {
  return (
    <Canvas camera={{ position: [0, 1.25, 4.6], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#05070b"]} />
      <Scene
        phase={phase}
        flightKey={flightKey}
        legs={legs}
        pastDots={pastDots}
        flightSec={flightSec}
        texture={texture}
      />
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.62} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
