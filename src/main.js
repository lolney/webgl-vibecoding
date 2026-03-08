import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Water } from "three/examples/jsm/objects/Water.js";

const canvas = document.getElementById("gl");
const audioButton = document.getElementById("audioToggle");
const modeBadge = document.getElementById("modeBadge");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.035);
pmremGenerator.dispose();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030f);
scene.fog = new THREE.FogExp2(0x02030f, 0.065);
scene.environment = envRT.texture;

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 140);
camera.position.set(6.8, 2.8, 8.0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1.4, 0);
controls.minDistance = 2.8;
controls.maxDistance = 18.0;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.78,
  0.45,
  0.82,
);
composer.addPass(bloomPass);

const crtPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uBeat: { value: 0 },
    uGlitch: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uBeat;
    uniform float uGlitch;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float r2 = dot(center, center);
      uv += center * r2 * (0.08 + uBeat * 0.03);
      uv.x += sin(uv.y * 110.0 + uTime * 22.0) * uGlitch * 0.0025;

      float chr = (0.0015 + 0.001 * uBeat) * (0.6 + 0.4 * sin(uTime * 0.8));
      vec3 col;
      col.r = texture2D(tDiffuse, uv + vec2(chr, 0.0)).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - vec2(chr, 0.0)).b;

      float scan = 0.94 + 0.06 * sin((vUv.y + uTime * 0.85) * 1250.0);
      float vign = smoothstep(1.15, 0.2, r2);
      float jitter = (fract(sin(dot(vUv + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.015;

      col *= scan * vign;
      col += jitter;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
});
composer.addPass(crtPass);

const ambient = new THREE.AmbientLight(0x3346bb, 0.56);
scene.add(ambient);

const key = new THREE.DirectionalLight(0x8ce9ff, 1.2);
key.position.set(4.2, 6.2, 5.8);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 1;
key.shadow.camera.far = 36;
key.shadow.camera.left = -10;
key.shadow.camera.right = 10;
key.shadow.camera.top = 10;
key.shadow.camera.bottom = -10;
key.shadow.bias = -0.0001;
scene.add(key);

const moon = new THREE.DirectionalLight(0xb2d7ff, 0.85);
moon.position.set(-8, 4.5, -18);
scene.add(moon);

const rim = new THREE.PointLight(0xff4ef7, 8.5, 35, 2.0);
rim.position.set(-6, 3.2, -5);
scene.add(rim);

const beamLight = new THREE.SpotLight(0x59ddff, 9500, 65, 0.23, 0.52, 2.0);
beamLight.position.set(0, 9.2, 0);
beamLight.target.position.set(0, 0, 0);
beamLight.castShadow = true;
beamLight.shadow.mapSize.set(1024, 1024);
beamLight.shadow.camera.near = 0.8;
beamLight.shadow.camera.far = 42;
beamLight.shadow.focus = 0.9;
scene.add(beamLight);
scene.add(beamLight.target);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(60, 42, 42),
  new THREE.MeshBasicMaterial({ color: 0x04082f, side: THREE.BackSide }),
);
scene.add(sky);

const moonVisual = new THREE.Group();
scene.add(moonVisual);

const moonDisk = new THREE.Mesh(
  new THREE.SphereGeometry(1.95, 28, 20),
  new THREE.MeshBasicMaterial({ color: 0xd8ecff, depthTest: false }),
);
moonDisk.renderOrder = 90;
moonVisual.add(moonDisk);

const moonHalo = new THREE.Mesh(
  new THREE.PlaneGeometry(8.5, 8.5, 1, 1),
  new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPulse: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uPulse;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float d = length(p);
        float core = smoothstep(0.26, 0.0, d);
        float glow = smoothstep(0.52, 0.0, d) * 0.75;
        float ring = smoothstep(0.35, 0.32, d) * 0.25;
        vec3 col = vec3(0.72, 0.88, 1.0) * (glow + core + ring);
        float a = (glow * 0.55 + core * 0.65 + ring * 0.4) * (0.85 + uPulse * 0.25);
        gl_FragColor = vec4(col, a);
      }
    `,
  }),
);
moonHalo.renderOrder = 91;
moonVisual.add(moonHalo);

const stars = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: 0x8bc6ff, size: 0.05, transparent: true, opacity: 0.86 }),
);
const starCount = 2200;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  const r = 26 + Math.random() * 20;
  const a = Math.random() * Math.PI * 2;
  const y = (Math.random() - 0.05) * 20;
  starPositions[i * 3] = Math.cos(a) * r;
  starPositions[i * 3 + 1] = y;
  starPositions[i * 3 + 2] = Math.sin(a) * r;
}
stars.geometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
scene.add(stars);

function makeWaterNormalsTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const sx = Math.sin((x / size) * Math.PI * 8.0) * 0.5 + 0.5;
      const sy = Math.cos((y / size) * Math.PI * 11.0) * 0.5 + 0.5;
      const n = (Math.random() * 0.25 + sx * 0.4 + sy * 0.35) * 255;
      data[i] = Math.min(255, n + 20);
      data[i + 1] = Math.min(255, n + 35);
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const waterNormals = makeWaterNormalsTexture(256);
const shorelineZ = -1.35;
const oceanGeometry = new THREE.PlaneGeometry(72, 66, 140, 140);
const oceanBasePos = oceanGeometry.attributes.position.array.slice();
const ocean = new Water(oceanGeometry, {
  textureWidth: 1024,
  textureHeight: 1024,
  waterNormals,
  sunDirection: new THREE.Vector3(0.38, 1.0, 0.42).normalize(),
  sunColor: 0xffffff,
  waterColor: 0x1f5f96,
  distortionScale: 3.4,
  fog: true,
  alpha: 0.95,
});
ocean.rotation.x = -Math.PI / 2;
ocean.position.set(0, -0.43, shorelineZ - 33.0);
ocean.material.uniforms.size.value = 2.2;
scene.add(ocean);

const farOceanGeometry = new THREE.PlaneGeometry(90, 56, 90, 72);
const farOceanBasePos = farOceanGeometry.attributes.position.array.slice();
const farOcean = new Water(farOceanGeometry, {
  textureWidth: 512,
  textureHeight: 512,
  waterNormals,
  sunDirection: new THREE.Vector3(0.4, 1.0, 0.35).normalize(),
  sunColor: 0xffffff,
  waterColor: 0x347fbb,
  distortionScale: 4.6,
  fog: true,
  alpha: 0.9,
});
farOcean.rotation.x = -Math.PI / 2 + 0.2;
farOcean.position.set(0, -0.22, -74);
farOcean.material.uniforms.size.value = 2.8;
scene.add(farOcean);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(72, 26, 1, 1),
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBeat: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBeat;
      varying vec2 vUv;
      varying vec3 vPos;

      void main() {
        float r = length(vPos.xz * vec2(1.0, 0.6));
        float rings = smoothstep(0.96, 1.0, sin(r * 5.2 - uTime * 4.5) * 0.5 + 0.5);
        float gridX = smoothstep(0.94, 1.0, sin(vPos.x * 4.2 + uTime * 1.2) * 0.5 + 0.5);
        float gridZ = smoothstep(0.94, 1.0, sin(vPos.z * 4.2 + uTime * 1.2) * 0.5 + 0.5);
        float grid = max(gridX, gridZ);

        vec3 base = vec3(0.03, 0.04, 0.12);
        vec3 pulse = mix(vec3(0.08, 0.2, 0.45), vec3(0.85, 0.3, 1.0), uBeat);
        vec3 col = base + rings * vec3(0.1, 0.35, 0.75) + grid * pulse * 0.55;

        float fade = smoothstep(36.0, 4.0, r);
        col *= fade;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.36, 11.65);
ground.receiveShadow = true;
scene.add(ground);

const shoreline = new THREE.Mesh(
  new THREE.PlaneGeometry(72, 1.5, 1, 1),
  new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBeat: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBeat;
      varying vec2 vUv;
      void main() {
        float line = 1.0 - smoothstep(0.0, 0.45, abs(vUv.y - 0.5));
        float wave = 0.5 + 0.5 * sin(vUv.x * 130.0 + uTime * 6.0);
        float shimmer = line * (0.35 + wave * 0.65);
        vec3 col = mix(vec3(0.1, 0.45, 0.9), vec3(0.7, 0.95, 1.0), shimmer);
        float alpha = shimmer * (0.28 + uBeat * 0.35);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  }),
);
shoreline.rotation.x = -Math.PI / 2;
shoreline.position.set(0, -0.35, shorelineZ - 0.08);
scene.add(shoreline);

const moonReflection = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 56, 1, 1),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBeat: { value: 0 },
      uStrength: { value: 0.9 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBeat;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float longitudinal = 1.0 - smoothstep(0.0, 0.55, abs(p.x));
        float falloff = smoothstep(0.56, 0.0, abs(p.y));
        float rip = 0.65 + 0.35 * sin(vUv.y * 90.0 + uTime * 6.5 + sin(vUv.y * 24.0));
        float band = longitudinal * falloff * rip;
        vec3 col = mix(vec3(0.2, 0.45, 0.8), vec3(0.85, 0.96, 1.0), band);
        float alpha = band * (0.5 + uBeat * 0.25) * uStrength;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  }),
);
moonReflection.rotation.x = -Math.PI / 2;
moonReflection.position.set(0, -0.38, shorelineZ - 17.0);
moonReflection.renderOrder = 70;
scene.add(moonReflection);

const moonReflectionWide = new THREE.Mesh(
  moonReflection.geometry.clone(),
  moonReflection.material.clone(),
);
moonReflectionWide.rotation.x = -Math.PI / 2;
moonReflectionWide.scale.set(1.9, 1.35, 1.0);
moonReflectionWide.position.set(0, -0.381, shorelineZ - 23.0);
moonReflectionWide.renderOrder = 69;
scene.add(moonReflectionWide);

function neonMat(color, emissive = 0.95, roughness = 0.3, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: emissive,
    roughness,
    metalness: 0.28,
    clearcoat: 0.85,
    clearcoatRoughness: 0.25,
    reflectivity: 0.85,
    ior: 1.45,
    ...extra,
  });
}

const towerGroup = new THREE.Group();
scene.add(towerGroup);

const towerBase = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.9, 2.6), neonMat(0x2f96ff, 0.72, 0.35));
towerBase.position.y = 0.55;
towerGroup.add(towerBase);

const towerStripe = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 2.65), neonMat(0xff48f6, 1.8, 0.2));
towerStripe.position.set(0, 1.35, 0);
towerGroup.add(towerStripe);

for (let i = -2; i <= 2; i += 1) {
  const x = i * 1.32;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.16, 26, 1, false, 0, Math.PI),
    neonMat(0xffd94e, 1.35, 0.14, {
      transmission: 0.36,
      thickness: 0.65,
      attenuationDistance: 2.4,
      attenuationColor: new THREE.Color(0xffcc66),
    }),
  );
  glass.rotation.x = Math.PI / 2;
  glass.position.set(x, 0.34, 1.24);
  towerGroup.add(glass);

  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.052, 16, 52, Math.PI),
    neonMat(0xff4ef7, 1.7, 0.2),
  );
  frame.rotation.x = Math.PI;
  frame.position.set(x, 0.35, 1.24);
  towerGroup.add(frame);

  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.7, 0.04), neonMat(0xffe46f, 0.8, 0.2));
  mullion.position.set(x, 0.26, 1.3);
  towerGroup.add(mullion);
}

const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.42, 6.0, 1.42), neonMat(0x2cc4ff, 1.0, 0.28));
shaft.position.y = 3.66;
towerGroup.add(shaft);

for (let i = 0; i < 6; i += 1) {
  const y = 1.55 + i * 0.8;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.06), neonMat(0xffd949, 1.4, 0.2));
  strip.position.set(i % 2 === 0 ? -0.25 : 0.25, y, 0.72);
  towerGroup.add(strip);
}

const bellStage = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 2.1), neonMat(0x2f84ff, 1.0, 0.2));
bellStage.position.y = 6.95;
towerGroup.add(bellStage);

const dome = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 18), neonMat(0x84bcff, 1.05, 0.16));
dome.scale.y = 0.68;
dome.position.y = 7.62;
towerGroup.add(dome);

const spire = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.65, 12), neonMat(0xffffff, 2.1, 0.08));
spire.position.y = 8.18;
towerGroup.add(spire);

const clockRingOuter = new THREE.Mesh(
  new THREE.TorusGeometry(0.42, 0.045, 18, 72),
  neonMat(0xff86ff, 2.5, 0.14),
);
clockRingOuter.position.set(0, 4.35, 0.74);
towerGroup.add(clockRingOuter);

const clockRingInner = new THREE.Mesh(
  new THREE.TorusGeometry(0.325, 0.028, 18, 72),
  neonMat(0x8ccfff, 1.7, 0.2),
);
clockRingInner.position.set(0, 4.35, 0.742);
towerGroup.add(clockRingInner);

const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.31, 0.04), neonMat(0xffef74, 2.25, 0.12));
minuteHand.geometry.translate(0, 0.155, 0);
minuteHand.position.set(0, 4.35, 0.752);
towerGroup.add(minuteHand);

const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.205, 0.045), neonMat(0xffef74, 2.0, 0.12));
hourHand.geometry.translate(0, 0.102, 0);
hourHand.position.set(0, 4.35, 0.758);
towerGroup.add(hourHand);

const beaconBeam = new THREE.Mesh(
  new THREE.ConeGeometry(1.1, 12.5, 40, 1, true),
  new THREE.MeshBasicMaterial({
    color: 0x59ddff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }),
);
beaconBeam.position.y = 12.8;
beaconBeam.rotation.x = Math.PI;
towerGroup.add(beaconBeam);

const skylineGroup = new THREE.Group();
scene.add(skylineGroup);

const cityCount = 260;
const cityGeo = new THREE.BoxGeometry(1, 1, 1);
const cityMat = new THREE.MeshPhysicalMaterial({
  color: 0x4d5faa,
  emissive: new THREE.Color(0x152459),
  emissiveIntensity: 0.65,
  roughness: 0.35,
  metalness: 0.5,
  clearcoat: 0.6,
  clearcoatRoughness: 0.2,
  vertexColors: true,
});
const city = new THREE.InstancedMesh(cityGeo, cityMat, cityCount);
const cityDummy = new THREE.Object3D();
const cityColor = new THREE.Color();
const cityData = [];
for (let i = 0; i < cityCount; i += 1) {
  let angle = Math.random() * Math.PI * 2;
  let dist = 16 + Math.random() * 18;
  let x = Math.cos(angle) * dist;
  let z = Math.sin(angle) * dist;
  while (Math.abs(x) < 5.2 && z > -2 && z < 13.5) {
    angle = Math.random() * Math.PI * 2;
    dist = 16 + Math.random() * 18;
    x = Math.cos(angle) * dist;
    z = Math.sin(angle) * dist;
  }

  const h = 0.8 + Math.random() * 5.6;
  const w = 0.4 + Math.random() * 1.2;
  const d = 0.4 + Math.random() * 1.3;

  cityDummy.position.set(x, h * 0.5 - 0.32, z);
  cityDummy.scale.set(w, h, d);
  cityDummy.lookAt(0, cityDummy.position.y, 0);
  cityDummy.updateMatrix();
  city.setMatrixAt(i, cityDummy.matrix);

  cityColor.setHSL(0.58 + Math.random() * 0.08, 0.65, 0.38 + Math.random() * 0.2);
  city.setColorAt(i, cityColor);

  cityData.push({ phase: Math.random() * Math.PI * 2, amp: 0.4 + Math.random() * 0.8 });
}
city.instanceColor.needsUpdate = true;
skylineGroup.add(city);
city.castShadow = true;
city.receiveShadow = true;

const ringGroup = new THREE.Group();
scene.add(ringGroup);
for (let i = 0; i < 3; i += 1) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2 + i * 0.55, 0.03 + i * 0.01, 16, 120),
    new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xff5cf7 : 0x57d8ff,
      transparent: true,
      opacity: 0.35 - i * 0.06,
      blending: THREE.AdditiveBlending,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12 + i * 0.18;
  ringGroup.add(ring);
}

const strobeRig = new THREE.Group();
scene.add(strobeRig);

const strobeSpots = [];
const strobeTargets = [];
const strobeCones = [];
const strobeColors = [0x7bdcff, 0xff6cff, 0x8ed4ff, 0xff66d6];

for (let i = 0; i < 4; i += 1) {
  const theta = (i / 4) * Math.PI * 2;
  const target = new THREE.Object3D();
  target.position.set(0, 1.8, 0);
  scene.add(target);
  strobeTargets.push(target);

  const spot = new THREE.SpotLight(strobeColors[i], 6200, 58, 0.2, 0.34, 2.0);
  spot.position.set(Math.cos(theta) * 7.8, 3.9 + (i % 2) * 0.8, Math.sin(theta) * 7.8);
  spot.target = target;
  spot.castShadow = i < 2;
  if (spot.castShadow) {
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.7;
    spot.shadow.camera.far = 34;
    spot.shadow.focus = 0.85;
  }
  scene.add(spot);
  strobeSpots.push(spot);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(spot.distance * Math.tan(spot.angle), spot.distance, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: strobeColors[i],
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  cone.position.copy(spot.position);
  scene.add(cone);
  strobeCones.push(cone);
}

const bloomPieces = towerGroup.children
  .filter((m) => m.material)
  .map((m) => m.material)
  .concat([cityMat]);

towerGroup.traverse((obj) => {
  if (obj.isMesh) {
    obj.castShadow = true;
    obj.receiveShadow = true;
  }
});

function createSynth() {
  let audioCtx = null;
  let master = null;
  let compressor = null;
  let analyser = null;
  let started = false;
  let timer = null;
  let step = 0;
  let bassPhase = 0;
  let beatPulse = 0;

  const bpm = 126;
  const stepDur = (60 / bpm) / 2;

  const leadScale = [659.25, 783.99, 987.77, 1174.66, 987.77, 783.99, 659.25, 587.33];
  const padScale = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 329.63];
  const bassLine = [98.0, 98.0, 87.31, 98.0, 73.42, 87.31, 98.0, 110.0];

  let analyserData = null;

  function pluck(freq, time, len, type, gainAmt, detune = 0, cutoff = 1600) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime(detune, time);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.value = 7;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainAmt, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + len);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + len + 0.05);
  }

  function pad(freq, time, len) {
    const oscA = audioCtx.createOscillator();
    const oscB = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    oscA.type = "sawtooth";
    oscB.type = "triangle";
    oscA.frequency.setValueAtTime(freq, time);
    oscB.frequency.setValueAtTime(freq * 1.002, time);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(620, time);
    filter.Q.value = 1.8;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.045, time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + len);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    oscA.start(time);
    oscB.start(time);
    oscA.stop(time + len + 0.04);
    oscB.stop(time + len + 0.04);
  }

  function hihat(time, open = false) {
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * (open ? 0.18 : 0.05), audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const hp = audioCtx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5500;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(open ? 0.11 : 0.14, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (open ? 0.14 : 0.04));

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(master);
    noise.start(time);
    noise.stop(time + (open ? 0.2 : 0.06));
  }

  function kick(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(132, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.18);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

    osc.connect(gain);
    gain.connect(master);
    osc.start(time);
    osc.stop(time + 0.22);

    beatPulse = 1.0;
  }

  function schedule() {
    const now = audioCtx.currentTime;

    for (let i = 0; i < 4; i += 1) {
      const t = now + i * stepDur;
      const n = step + i;

      const lead = leadScale[n % leadScale.length];
      const padNote = padScale[(n + 2) % padScale.length];
      const bass = bassLine[(bassPhase + n) % bassLine.length];

      if (n % 2 === 0) {
        pluck(lead, t, stepDur * 0.86, "square", 0.09, (n % 8 === 0 ? 6 : -3), 1900);
      }

      pluck(bass, t, stepDur * 0.93, "sawtooth", 0.075, 0, 700);

      if (n % 4 === 0) pad(padNote, t, stepDur * 4.0);
      if (n % 4 === 0) kick(t);
      hihat(t + stepDur * 0.5, n % 8 === 7);
    }

    step += 4;
    if (step % 16 === 0) bassPhase = (bassPhase + 1) % bassLine.length;
  }

  function start() {
    if (started) return;
    audioCtx = new window.AudioContext();
    master = audioCtx.createGain();
    compressor = audioCtx.createDynamicsCompressor();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;
    analyserData = new Uint8Array(analyser.frequencyBinCount);

    compressor.threshold.value = -16;
    compressor.knee.value = 22;
    compressor.ratio.value = 6;

    master.gain.value = 0.22;
    master.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(audioCtx.destination);

    schedule();
    timer = window.setInterval(schedule, stepDur * 1000 * 4);
    started = true;
  }

  function stop() {
    if (!started) return;
    window.clearInterval(timer);
    timer = null;
    master.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
    window.setTimeout(() => {
      audioCtx.close();
      audioCtx = null;
      master = null;
      compressor = null;
      analyser = null;
      analyserData = null;
      started = false;
      step = 0;
      bassPhase = 0;
      beatPulse = 0;
    }, 280);
  }

  function getVisualState() {
    if (!started || !analyser || !analyserData) {
      return { level: 0, beat: 0 };
    }

    analyser.getByteFrequencyData(analyserData);
    let sum = 0;
    for (let i = 0; i < analyserData.length; i += 1) sum += analyserData[i];
    const level = Math.min(1, (sum / analyserData.length) / 160);

    beatPulse *= 0.89;
    return { level, beat: beatPulse };
  }

  function isStarted() {
    return started;
  }

  return { start, stop, isStarted, getVisualState };
}

const synth = createSynth();

audioButton.addEventListener("click", () => {
  if (!synth.isStarted()) {
    synth.start();
    audioButton.textContent = "Stop Audio";
  } else {
    synth.stop();
    audioButton.textContent = "Start Audio";
  }
});

let lastInteraction = performance.now();
let cinematic = false;
let cinematicMix = 0;
let currentSection = -1;
const sectionNames = ["Pulse Forge", "Hyper Lift", "Night Glide", "Strobe Core"];

function setCinematic(on) {
  cinematic = on;
  const camText = on ? "Cinematic Camera" : "Manual Camera";
  const sectionText = currentSection >= 0 ? sectionNames[currentSection] : "Boot";
  modeBadge.textContent = `${camText} // ${sectionText}`;
}

setCinematic(false);

function markInteraction() {
  lastInteraction = performance.now();
}

renderer.domElement.addEventListener("pointerdown", () => {
  markInteraction();
  if (cinematic) setCinematic(false);
});
renderer.domElement.addEventListener("wheel", () => {
  markInteraction();
  if (cinematic) setCinematic(false);
}, { passive: true });
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "c") {
    setCinematic(!cinematic);
    markInteraction();
  }
});

window.__demoState = { ok: true, frames: 0, lastTime: 0, debug: {} };
window.__canvas = canvas;

const clock = new THREE.Clock();
const tmpColor = new THREE.Color();
const tmpDir = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);
const moonDir = new THREE.Vector3();
const moonBase = new THREE.Vector3(-32.0, 11.0, -26.0);

function displaceWaterGeometry(geometry, basePositions, time, amp = 1.0) {
  const pos = geometry.attributes.position;
  const arr = pos.array;
  for (let i = 0; i < arr.length; i += 3) {
    const x = basePositions[i];
    const y = basePositions[i + 1];
    const z = basePositions[i + 2];

    const waveA = Math.sin(x * 0.22 + z * 0.06 + time * 1.15) * 0.34;
    const waveB = Math.cos(x * -0.09 + z * 0.19 - time * 0.82) * 0.25;
    const waveC = Math.sin((x + z) * 0.12 + time * 1.7) * 0.16;
    const chop = Math.sin(x * 0.9 + time * 2.2) * Math.cos(z * 0.7 - time * 1.9) * 0.055;

    arr[i] = x;
    arr[i + 1] = y;
    arr[i + 2] = z + (waveA + waveB + waveC + chop) * amp;
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener("resize", onResize);

function tick() {
  const t = clock.getElapsedTime();
  const audio = synth.getVisualState();
  const beat = audio.beat;
  const level = audio.level;
  const section = Math.floor(t / 11.5) % sectionNames.length;
  if (section !== currentSection) {
    currentSection = section;
    setCinematic(cinematic);
  }

  controls.update();

  const idle = performance.now() - lastInteraction;
  const shouldCinematicBlend = cinematic || idle > 7000;
  cinematicMix = THREE.MathUtils.lerp(cinematicMix, shouldCinematicBlend ? 1 : 0, 0.02);

  const autoAngle = t * 0.19;
  const autoRadius = 7.2 + Math.sin(t * 0.37) * 1.4;
  const autoPos = new THREE.Vector3(
    Math.cos(autoAngle) * autoRadius,
    2.6 + Math.sin(t * 0.24) * 1.1,
    Math.sin(autoAngle) * autoRadius,
  );

  camera.position.lerp(autoPos, cinematicMix * 0.04);
  controls.target.lerp(new THREE.Vector3(0, 1.45 + Math.sin(t * 0.9) * 0.12, 0), cinematicMix * 0.04);

  towerGroup.rotation.y = Math.sin(t * 0.25) * 0.08 + beat * 0.1;
  towerGroup.position.y = Math.sin(t * 0.9) * 0.035 + beat * 0.05;

  minuteHand.rotation.z = -t * 1.85;
  hourHand.rotation.z = -t * 0.39;

  const pulse = 0.45 + level * 0.85 + beat * 1.2;
  const sectionBoost = section === 1 ? 1.22 : section === 3 ? 1.34 : 1.0;
  beamLight.intensity = (900 + pulse * 1800) * sectionBoost;
  rim.intensity = (850 + Math.sin(t * 2.3) * 220 + pulse * 650) * sectionBoost;
  key.intensity = 1.0 + Math.sin(t * 1.25) * 0.3 + level * 0.4 + (section === 2 ? 0.35 : 0);
  moon.intensity = 0.7 + Math.sin(t * 0.4) * 0.15 + level * 0.25;
  beamLight.distance = 62 + level * 6;

  moonVisual.position.set(
    moonBase.x + Math.sin(t * 0.08) * 1.3,
    moonBase.y + Math.sin(t * 0.06) * 0.5,
    moonBase.z + Math.cos(t * 0.07) * 1.2,
  );
  moon.position.copy(moonVisual.position).normalize().multiplyScalar(28);
  moonDir.copy(moon.position).normalize();
  moonVisual.lookAt(camera.position);
  moonHalo.material.uniforms.uPulse.value = 0.2 + level * 0.35 + beat * 0.55;

  moonReflection.position.x = THREE.MathUtils.clamp(moonVisual.position.x * 0.5, -18.0, -12.0);
  moonReflection.position.z = shorelineZ - 20.0 + Math.max(-5, moonVisual.position.z + 36.0) * 0.12;
  moonReflection.scale.x = 0.9 + Math.abs(moonDir.x) * 0.7;
  moonReflection.material.uniforms.uTime.value = t;
  moonReflection.material.uniforms.uBeat.value = Math.min(1.0, level * 0.7 + beat * 0.8);
  moonReflection.material.uniforms.uStrength.value = 1.55 + moon.intensity * 0.42;

  moonReflectionWide.position.x = moonReflection.position.x + 1.1;
  moonReflectionWide.position.z = moonReflection.position.z - 5.2;
  moonReflectionWide.material.uniforms.uTime.value = t * 0.85 + 4.0;
  moonReflectionWide.material.uniforms.uBeat.value = Math.min(1.0, level * 0.55 + beat * 0.6);
  moonReflectionWide.material.uniforms.uStrength.value = 1.0 + moon.intensity * 0.28;

  beaconBeam.rotation.z = Math.sin(t * 1.5) * 0.16 + beat * 0.06;
  beaconBeam.material.opacity = 0.11 + (Math.sin(t * 3.6) * 0.5 + 0.5) * 0.13 + level * 0.18;
  displaceWaterGeometry(oceanGeometry, oceanBasePos, t * 0.9, 1.15 + level * 0.3 + beat * 0.45);
  displaceWaterGeometry(farOceanGeometry, farOceanBasePos, t * 0.72 + 5.0, 0.95 + level * 0.2);

  ocean.material.uniforms.time.value = t * 0.48;
  ocean.material.uniforms.sunDirection.value.copy(key.position).normalize();
  ocean.material.uniforms.distortionScale.value = 3.2 + level * 1.5 + beat * 2.1;
  ocean.position.x = Math.sin(t * 0.05) * 2.0;
  ocean.rotation.z = Math.sin(t * 0.04) * 0.004;
  farOcean.material.uniforms.time.value = t * 0.36 + 12.0;
  farOcean.material.uniforms.sunDirection.value.copy(key.position).normalize();
  farOcean.material.uniforms.distortionScale.value = 4.4 + level * 1.2;

  stars.rotation.y = t * 0.01;
  sky.rotation.y = -t * 0.006;

  strobeRig.rotation.y = t * 0.09;
  for (let i = 0; i < strobeSpots.length; i += 1) {
    const spot = strobeSpots[i];
    const target = strobeTargets[i];
    const cone = strobeCones[i];
    const phase = t * (8.5 + i * 0.75) + i * 1.13;
    const hardStrobe = Math.pow(Math.max(0, Math.sin(phase)), section === 3 ? 7.5 : 5.8);
    const beatAmp = 1.0 + beat * 2.2;
    const base = 60;
    const peak = (section === 3 ? 4400 : 2800) * beatAmp;
    spot.intensity = base + hardStrobe * peak;
    spot.angle = 0.16 + (Math.sin(t * 0.7 + i) * 0.5 + 0.5) * 0.14;

    target.position.set(
      Math.sin(t * 0.48 + i * 1.4) * 1.8,
      1.3 + Math.sin(t * 0.7 + i * 0.8) * 0.55,
      Math.cos(t * 0.52 + i * 1.1) * 1.5,
    );

    cone.position.copy(spot.position);
    tmpDir.copy(target.position).sub(spot.position).normalize();
    cone.quaternion.setFromUnitVectors(upAxis, tmpDir);
    cone.material.opacity = 0.008 + hardStrobe * (0.045 + level * 0.06);
    cone.scale.set(1, 1 + level * 0.12, 1);
  }

  ringGroup.children.forEach((ring, i) => {
    ring.rotation.z = t * (0.2 + i * 0.08) * (i % 2 === 0 ? 1 : -1);
    ring.material.opacity = 0.18 + (Math.sin(t * 1.9 + i * 1.2) * 0.5 + 0.5) * 0.2 + level * 0.18;
    ring.scale.setScalar(1 + beat * (0.08 + i * 0.03));
  });

  for (let i = 0; i < cityCount; i += 1) {
    const c = cityData[i];
    const hue = 0.56 + Math.sin(t * 0.6 + c.phase) * 0.04;
    const lit = 0.35 + (Math.sin(t * 1.8 * c.amp + c.phase) * 0.5 + 0.5) * 0.4 + level * 0.3;
    tmpColor.setHSL(hue, 0.72, lit);
    city.setColorAt(i, tmpColor);
  }
  city.instanceColor.needsUpdate = true;

  for (let i = 0; i < bloomPieces.length; i += 1) {
    const mat = bloomPieces[i];
    if (mat && "emissiveIntensity" in mat) {
      mat.emissiveIntensity = 0.15 + (Math.sin(t * 2.5 + i * 0.7) * 0.5 + 0.5) * 0.55 + level * 0.35;
    }
  }

  ground.material.uniforms.uTime.value = t;
  ground.material.uniforms.uBeat.value = Math.min(1.0, level * 0.8 + beat * 1.2);
  shoreline.material.uniforms.uTime.value = t;
  shoreline.material.uniforms.uBeat.value = Math.min(1.0, level * 0.8 + beat * 1.2);

  bloomPass.strength =
    (section === 3 ? 1.05 : 0.72) + level * (section === 1 ? 0.62 : 0.45) + beat * 0.45;
  bloomPass.radius = 0.4 + level * (section === 2 ? 0.26 : 0.18);
  bloomPass.threshold = (section === 3 ? 0.78 : 0.82) - level * 0.05;

  crtPass.uniforms.uTime.value = t;
  crtPass.uniforms.uBeat.value = Math.min(1.0, beat * 1.2 + level * 0.6);
  crtPass.uniforms.uGlitch.value = Math.min(
    1.0,
    (section === 3 ? 0.65 : section === 1 ? 0.35 : 0.15) + beat * 0.7,
  );

  composer.render();

  window.__demoState.frames += 1;
  window.__demoState.lastTime = t;
  window.__demoState.debug = {
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    points: renderer.info.render.points,
    level: Number(level.toFixed(3)),
    beat: Number(beat.toFixed(3)),
    section,
    oceanTime: Number(ocean.material.uniforms.time.value.toFixed(2)),
    cinematicMix: Number(cinematicMix.toFixed(3)),
  };

  requestAnimationFrame(tick);
}

tick();
