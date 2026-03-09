import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import towerAssetUrl from "./assets/tower_asset.glb?url";
import cityModuleAssetUrl from "./assets/city_module_asset.glb?url";

const canvas = document.getElementById("gl");
const sceneChooser = document.getElementById("sceneChooser");
const audioButton = document.getElementById("audioToggle");
const modeBadge = document.getElementById("modeBadge");
const timeIndicator = document.getElementById("timeIndicator");
const query = new URLSearchParams(window.location.search);
const debugView = query.get("debug") === "1";
const initialSceneQuery = query.get("scene");
const readNumberParam = (key) => {
  const raw = query.get(key);
  if (raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};
const binaryHourQuery = readNumberParam("binaryHour");
const binaryHourRateQuery = readNumberParam("binaryHourRate");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.035);
pmremGenerator.dispose();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030f);
scene.fog = new THREE.FogExp2(0x02030f, 0.065);
scene.environment = envRT.texture;

const gltfLoader = new GLTFLoader();
const blenderTowerRoot = new THREE.Group();
const blenderCityRoot = new THREE.Group();
scene.add(blenderTowerRoot);
scene.add(blenderCityRoot);
let usingBlenderTower = false;
let usingBlenderCity = false;
let blenderMinuteHand = null;
let blenderHourHand = null;

function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, resolve, undefined, reject);
  });
}

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 140);
camera.position.set(0.0, 3.2, 18.0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 2.2, 0);
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
bloomPass.enabled = !debugView;

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
crtPass.enabled = !debugView;

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

const binaryFill = new THREE.HemisphereLight(0x8fb7ff, 0x050916, 0.55);
binaryFill.visible = false;
scene.add(binaryFill);

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

const binarySystemGroup = new THREE.Group();
binarySystemGroup.visible = false;
scene.add(binarySystemGroup);

const orbitLineMat = new THREE.LineBasicMaterial({ color: 0x6caeff, transparent: true, opacity: 0.35 });
function makeOrbitLine(radius, color = 0x6caeff) {
  const pts = [];
  const segments = 96;
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), orbitLineMat.clone().setValues({ color }));
}

const starAGroup = new THREE.Group();
const starAMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.7, 32, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff4c2 }),
);
const starAHalo = new THREE.Mesh(
  new THREE.SphereGeometry(2.6, 20, 16),
  new THREE.MeshBasicMaterial({
    color: 0xffd57a,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
starAGroup.add(starAMesh);
starAGroup.add(starAHalo);
binarySystemGroup.add(starAGroup);

const starBGroup = new THREE.Group();
const starBMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.15, 28, 20),
  new THREE.MeshBasicMaterial({ color: 0xbfd4ff }),
);
const starBHalo = new THREE.Mesh(
  new THREE.SphereGeometry(2.0, 18, 14),
  new THREE.MeshBasicMaterial({
    color: 0x7ca7ff,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
starBGroup.add(starBMesh);
starBGroup.add(starBHalo);
binarySystemGroup.add(starBGroup);

const binaryStarALight = new THREE.PointLight(0xfff4c2, 6500, 220, 2.0);
const binaryStarBLight = new THREE.PointLight(0xbfd4ff, 4800, 210, 2.0);
scene.add(binaryStarALight);
scene.add(binaryStarBLight);

const planetOrbitRadius = 13.8;
const planetGroup = new THREE.Group();
const planetPivot = new THREE.Group();
binarySystemGroup.add(planetPivot);
planetPivot.add(planetGroup);

const planetMesh = new THREE.Mesh(
  new THREE.SphereGeometry(2.9, 64, 48),
  new THREE.MeshPhysicalMaterial({
    color: 0x3a6fd1,
    roughness: 0.92,
    metalness: 0.04,
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
  }),
);
planetGroup.add(planetMesh);

const cloudLayer = new THREE.Mesh(
  new THREE.SphereGeometry(2.99, 40, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0xbcd6ff,
    transparent: true,
    opacity: 0.22,
    roughness: 0.8,
    metalness: 0.02,
  }),
);
planetGroup.add(cloudLayer);

const binaryBaryOrbit = makeOrbitLine(4.8, 0xff8de6);
binarySystemGroup.add(binaryBaryOrbit);
const planetOrbitLine = makeOrbitLine(planetOrbitRadius, 0x67bbff);
binarySystemGroup.add(planetOrbitLine);

const surfaceForeground = new THREE.Mesh(
  new THREE.CircleGeometry(7.2, 48),
  new THREE.MeshPhysicalMaterial({
    color: 0x274488,
    roughness: 0.95,
    metalness: 0.06,
    clearcoat: 0.05,
    emissive: new THREE.Color(0x0b1233),
    emissiveIntensity: 0.4,
  }),
);
surfaceForeground.visible = false;
scene.add(surfaceForeground);

const surfacePovGroup = new THREE.Group();
surfacePovGroup.visible = false;
scene.add(surfacePovGroup);

const surfaceSky = new THREE.Mesh(
  new THREE.SphereGeometry(120, 48, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uDay: { value: 0.2 },
      uTwilight: { value: 0.0 },
      uSecond: { value: 0.0 },
      uA: { value: new THREE.Vector3(0, 1, 0) },
      uB: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uDay;
      uniform float uTwilight;
      uniform float uSecond;
      uniform vec3 uA;
      uniform vec3 uB;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 nightTop = vec3(0.004, 0.012, 0.045);
        vec3 nightHorizon = vec3(0.03, 0.045, 0.1);
        vec3 twiTop = vec3(0.12, 0.15, 0.33);
        vec3 twiHorizon = vec3(0.95, 0.33, 0.2);
        vec3 dayTop = vec3(0.24, 0.58, 0.93);
        vec3 dayHorizon = vec3(0.95, 0.72, 0.48);
        vec3 nightCol = mix(nightHorizon, nightTop, h);
        vec3 twiCol = mix(twiHorizon, twiTop, h);
        vec3 dayCol = mix(dayHorizon, dayTop, h);
        vec3 base = mix(mix(nightCol, twiCol, uTwilight), dayCol, uDay);
        float horizonBand = smoothstep(0.02, 0.22, h) * (1.0 - smoothstep(0.22, 0.35, h));
        base += vec3(1.0, 0.42, 0.22) * horizonBand * uTwilight * 0.35;
        float glowA = pow(max(dot(dir, normalize(uA)), 0.0), 22.0);
        float glowB = pow(max(dot(dir, normalize(uB)), 0.0), 20.0) * uSecond;
        vec3 col = base + vec3(1.0, 0.72, 0.36) * glowA * 0.95 + vec3(0.6, 0.78, 1.0) * glowB * 1.25;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }),
);
surfacePovGroup.add(surfaceSky);

const surfaceGround = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220, 1, 1),
  new THREE.MeshPhysicalMaterial({
    color: 0x182337,
    roughness: 0.98,
    metalness: 0.0,
    clearcoat: 0.02,
    clearcoatRoughness: 0.85,
  }),
);
surfaceGround.rotation.x = -Math.PI / 2;
surfaceGround.position.y = -0.02;
surfacePovGroup.add(surfaceGround);

let surfaceOcean = null;

function makeSurfaceSun(coreColor, glowColor, coreSize, glowSize) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(coreSize, 24, 16),
    new THREE.MeshBasicMaterial({ color: coreColor, depthTest: false, toneMapped: false }),
  );
  core.renderOrder = 120;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(glowSize, glowSize),
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(glowColor) },
        uStrength: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p);
          float core = smoothstep(0.18, 0.0, d);
          float halo = smoothstep(0.52, 0.0, d) * 0.7;
          float a = (core + halo) * uStrength;
          gl_FragColor = vec4(uColor * (core * 1.4 + halo), a);
        }
      `,
    }),
  );
  glow.renderOrder = 121;
  g.add(core);
  g.add(glow);
  return { group: g, core, glow };
}

const surfaceSunA = makeSurfaceSun(0xfff2be, 0xffcb6d, 1.8, 12);
const surfaceSunB = makeSurfaceSun(0xc6dbff, 0x7eb1ff, 1.2, 9);
surfacePovGroup.add(surfaceSunA.group);
surfacePovGroup.add(surfaceSunB.group);

const surfaceReflectionA = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 90),
  new THREE.MeshBasicMaterial({
    color: 0xffd48b,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
);
surfaceReflectionA.rotation.x = -Math.PI / 2;
surfaceReflectionA.position.set(0, 0.05, -70);
surfacePovGroup.add(surfaceReflectionA);

const surfaceReflectionB = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 82),
  new THREE.MeshBasicMaterial({
    color: 0x8dc2ff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
);
surfaceReflectionB.rotation.x = -Math.PI / 2;
surfaceReflectionB.position.set(-8, 0.05, -72);
surfacePovGroup.add(surfaceReflectionB);

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
surfaceOcean = new Water(new THREE.PlaneGeometry(220, 220, 100, 100), {
  textureWidth: 1024,
  textureHeight: 1024,
  waterNormals,
  sunDirection: new THREE.Vector3(0.0, 1.0, -1.0).normalize(),
  sunColor: 0xffffff,
  waterColor: 0x195f9f,
  distortionScale: 2.3,
  fog: true,
  alpha: 0.96,
});
surfaceOcean.rotation.x = -Math.PI / 2;
surfaceOcean.position.set(0, 0.01, -95);
surfaceOcean.material.uniforms.size.value = 1.9;
surfacePovGroup.add(surfaceOcean);
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

const towerDetailMat = neonMat(0x7cc7ff, 0.9, 0.24, { metalness: 0.42, clearcoatRoughness: 0.14 });
const towerAccentMat = neonMat(0xff7cf8, 1.5, 0.16, { metalness: 0.38 });

for (let i = -2; i <= 2; i += 1) {
  const x = i * 1.42;
  const braceFront = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.6, 0.16), towerDetailMat);
  braceFront.position.set(x, 0.52, 1.18);
  towerGroup.add(braceFront);

  const braceBack = braceFront.clone();
  braceBack.position.z = -1.18;
  towerGroup.add(braceBack);
}

for (let i = 0; i < 4; i += 1) {
  const sx = i < 2 ? -2.95 : 2.95;
  const sz = i % 2 === 0 ? -1.08 : 1.08;
  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.7, 10), towerDetailMat);
  pylon.position.set(sx, 0.5, sz);
  towerGroup.add(pylon);
}

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

const shaftRibGeo = new THREE.BoxGeometry(0.1, 5.8, 0.1);
for (let i = 0; i < 4; i += 1) {
  const rib = new THREE.Mesh(shaftRibGeo, towerDetailMat);
  const angle = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
  rib.position.set(Math.cos(angle) * 0.6, 3.66, Math.sin(angle) * 0.6);
  towerGroup.add(rib);
}

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

const clockTickGroup = new THREE.Group();
towerGroup.add(clockTickGroup);

for (let i = 0; i < 12; i += 1) {
  const isMajor = i % 3 === 0;
  const tick = new THREE.Mesh(
    new THREE.BoxGeometry(isMajor ? 0.034 : 0.024, isMajor ? 0.12 : 0.08, 0.026),
    isMajor ? towerAccentMat : towerDetailMat,
  );
  const a = (i / 12) * Math.PI * 2;
  tick.position.set(Math.sin(a) * 0.365, 4.35 + Math.cos(a) * 0.365, 0.754);
  tick.rotation.z = -a;
  clockTickGroup.add(tick);
}

const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.31, 0.04), neonMat(0xffef74, 2.25, 0.12));
minuteHand.geometry.translate(0, 0.155, 0);
minuteHand.position.set(0, 4.35, 0.752);
towerGroup.add(minuteHand);

const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.205, 0.045), neonMat(0xffef74, 2.0, 0.12));
hourHand.geometry.translate(0, 0.102, 0);
hourHand.position.set(0, 4.35, 0.758);
towerGroup.add(hourHand);

const towerCables = [];
for (let i = 0; i < 3; i += 1) {
  const points = [];
  const segments = 56;
  const radius = 1.0 + i * 0.13;
  for (let s = 0; s <= segments; s += 1) {
    const a = (s / segments) * Math.PI * 2;
    const y = 2.25 + (s / segments) * 3.2 + Math.sin(a * 3 + i * 1.4) * 0.08;
    points.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
  }
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 220, 0.024, 8, false),
    neonMat(i % 2 === 0 ? 0xff74f8 : 0x6fd9ff, 1.2 + i * 0.2, 0.14, {
      transparent: true,
      opacity: 0.92,
      clearcoat: 0.95,
      clearcoatRoughness: 0.1,
    }),
  );
  towerCables.push(cable);
  towerGroup.add(cable);
}

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
const cityCapMat = new THREE.MeshPhysicalMaterial({
  color: 0x77a9ff,
  emissive: new THREE.Color(0x2640a0),
  emissiveIntensity: 1.1,
  roughness: 0.24,
  metalness: 0.46,
  clearcoat: 0.8,
  clearcoatRoughness: 0.18,
  vertexColors: true,
});
const cityCaps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityCapMat, cityCount);
const antennaMat = new THREE.MeshPhysicalMaterial({
  color: 0x9ed8ff,
  emissive: new THREE.Color(0xff79f8),
  emissiveIntensity: 1.4,
  roughness: 0.22,
  metalness: 0.66,
  clearcoat: 0.86,
  clearcoatRoughness: 0.12,
  vertexColors: true,
});
const cityAntennas = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8), antennaMat, cityCount);
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

  const capHeight = Math.max(0.09, 0.07 + h * 0.05);
  cityDummy.position.set(x, h - 0.32 + capHeight * 0.5, z);
  cityDummy.scale.set(Math.max(0.18, w * 0.78), capHeight, Math.max(0.18, d * 0.78));
  cityDummy.lookAt(0, cityDummy.position.y, 0);
  cityDummy.updateMatrix();
  cityCaps.setMatrixAt(i, cityDummy.matrix);

  const antennaHeight = 0.3 + Math.random() * 1.1;
  const hasAntenna = Math.random() > 0.42;
  const offsetX = (Math.random() - 0.5) * w * 0.26;
  const offsetZ = (Math.random() - 0.5) * d * 0.26;
  cityDummy.position.set(
    x + offsetX,
    h - 0.32 + capHeight + (hasAntenna ? antennaHeight * 0.5 : 0.005),
    z + offsetZ,
  );
  cityDummy.scale.set(
    Math.max(0.012, w * 0.028),
    hasAntenna ? antennaHeight : 0.01,
    Math.max(0.012, d * 0.028),
  );
  cityDummy.lookAt(0, cityDummy.position.y, 0);
  cityDummy.updateMatrix();
  cityAntennas.setMatrixAt(i, cityDummy.matrix);

  cityColor.setHSL(0.58 + Math.random() * 0.08, 0.65, 0.38 + Math.random() * 0.2);
  city.setColorAt(i, cityColor);

  cityColor.setHSL(0.58 + Math.random() * 0.08, 0.8, 0.58 + Math.random() * 0.22);
  cityCaps.setColorAt(i, cityColor);

  cityColor.setHSL(0.84 + Math.random() * 0.1, 0.78, hasAntenna ? 0.74 : 0.0);
  cityAntennas.setColorAt(i, cityColor);

  cityData.push({
    phase: Math.random() * Math.PI * 2,
    amp: 0.4 + Math.random() * 0.8,
    hasAntenna,
    glowOffset: Math.random() * Math.PI * 2,
    x,
    z,
    h,
    w,
    d,
  });
}
city.instanceColor.needsUpdate = true;
cityCaps.instanceColor.needsUpdate = true;
cityAntennas.instanceColor.needsUpdate = true;
skylineGroup.add(city);
skylineGroup.add(cityCaps);
skylineGroup.add(cityAntennas);
city.castShadow = true;
city.receiveShadow = true;
cityCaps.castShadow = true;
cityCaps.receiveShadow = true;
cityAntennas.castShadow = true;
cityAntennas.receiveShadow = true;

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
  .concat([cityMat, cityCapMat, antennaMat]);

towerGroup.traverse((obj) => {
  if (obj.isMesh) {
    obj.castShadow = true;
    obj.receiveShadow = true;
  }
});

Promise.all([loadGLTF(towerAssetUrl), loadGLTF(cityModuleAssetUrl)])
  .then(([towerGLTF, cityGLTF]) => {
    const towerAsset = towerGLTF.scene;
    towerAsset.position.set(0, 0, 0);
    towerAsset.scale.setScalar(0.7);
    towerAsset.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material && "emissiveIntensity" in obj.material) bloomPieces.push(obj.material);
      }
      if (obj.name === "MinuteHand") blenderMinuteHand = obj;
      if (obj.name === "HourHand") blenderHourHand = obj;
    });
    blenderTowerRoot.add(towerAsset);
    towerGroup.visible = false;
    usingBlenderTower = true;

    const moduleTemplate = cityGLTF.scene;
    moduleTemplate.traverse((obj) => {
      if (obj.isMesh && obj.material && "emissiveIntensity" in obj.material) bloomPieces.push(obj.material);
    });

    for (let i = 0; i < cityData.length; i += 1) {
      const c = cityData[i];
      const block = moduleTemplate.clone(true);
      block.position.set(c.x, -0.33, c.z);
      block.scale.set(Math.max(0.28, c.w * 0.95), c.h, Math.max(0.28, c.d * 0.95));
      block.rotation.y = Math.atan2(-c.x, -c.z);
      block.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      blenderCityRoot.add(block);
    }

    skylineGroup.visible = false;
    usingBlenderCity = true;
  })
  .catch((err) => {
    console.error("Blender asset loading failed:", err);
  });

let activeSceneKey = "clocktower";
const sceneLabels = {
  clocktower: "Clocktower",
  binaryExternal: "Binary External",
  binarySurface: "Binary Surface POV",
};
let binaryDayHours = binaryHourQuery !== null ? THREE.MathUtils.euclideanModulo(binaryHourQuery, 24) : 13.2;
const binaryHourRate = binaryHourRateQuery !== null ? binaryHourRateQuery : 0.12;
let lastTickTime = 0;

function format24Hour(hoursValue) {
  const h = THREE.MathUtils.euclideanModulo(hoursValue, 24);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function syncSceneToUrl(sceneKey, options = {}) {
  const { pushHistory = false } = options;
  const url = new URL(window.location.href);
  const currentScene = url.searchParams.get("scene");
  if (currentScene === sceneKey) return;
  url.searchParams.set("scene", sceneKey);
  if (pushHistory) {
    window.history.pushState({ scene: sceneKey }, "", url);
  } else {
    window.history.replaceState({ scene: sceneKey }, "", url);
  }
}

const clocktowerObjects = [
  towerGroup,
  blenderTowerRoot,
  skylineGroup,
  blenderCityRoot,
  ringGroup,
  strobeRig,
  ocean,
  farOcean,
  ground,
  shoreline,
  moonVisual,
  moonReflection,
  moonReflectionWide,
  beaconBeam,
  surfacePovGroup,
];

const binaryObjects = [binarySystemGroup, starAGroup, starBGroup, planetOrbitLine, binaryBaryOrbit, surfacePovGroup];

function applySceneMode(nextSceneKey, options = {}) {
  const { syncUrl = true, pushHistory = false } = options;
  activeSceneKey = sceneLabels[nextSceneKey] ? nextSceneKey : "clocktower";
  const isClocktower = activeSceneKey === "clocktower";

  for (const obj of clocktowerObjects) obj.visible = isClocktower;
  for (const obj of binaryObjects) obj.visible = !isClocktower;
  surfacePovGroup.visible = activeSceneKey === "binarySurface";
  surfaceForeground.visible = activeSceneKey === "binarySurface";

  binaryStarALight.visible = !isClocktower;
  binaryStarBLight.visible = !isClocktower;
  binaryFill.visible = !isClocktower;

  key.visible = isClocktower;
  rim.visible = isClocktower;
  beamLight.visible = isClocktower;
  moon.visible = isClocktower;

  if (isClocktower) {
    camera.up.set(0, 1, 0);
    controls.target.set(0, 2.2, 0);
    planetMesh.visible = true;
    cloudLayer.visible = true;
    if (timeIndicator) timeIndicator.textContent = "Time --:--";
    if (sceneChooser) sceneChooser.value = "clocktower";
  } else if (activeSceneKey === "binaryExternal") {
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    planetMesh.visible = true;
    cloudLayer.visible = true;
    if (sceneChooser) sceneChooser.value = "binaryExternal";
  } else {
    controls.target.set(0, 0, 0);
    planetMesh.visible = false;
    cloudLayer.visible = false;
    camera.up.set(0, 1, 0);
    camera.position.set(0, 1.65, 13.0);
    controls.target.set(0, 1.2, -70);
    if (sceneChooser) sceneChooser.value = "binarySurface";
  }
  controls.update();
  setCinematic(false);
  if (syncUrl) syncSceneToUrl(activeSceneKey, { pushHistory });
}

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
  const sectionText = activeSceneKey === "clocktower"
    ? (currentSection >= 0 ? sectionNames[currentSection] : "Boot")
    : sceneLabels[activeSceneKey];
  modeBadge.textContent = `${camText} // ${sectionText}`;
}

setCinematic(false);
applySceneMode(sceneLabels[initialSceneQuery] ? initialSceneQuery : "clocktower");
if (debugView) {
  modeBadge.textContent = "Debug Camera // Geometry";
}

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
modeBadge.addEventListener("click", () => {
  setCinematic(!cinematic);
  markInteraction();
});
if (sceneChooser) {
  sceneChooser.addEventListener("change", (e) => {
    applySceneMode(e.target.value, { pushHistory: true });
    markInteraction();
  });
}
window.addEventListener("popstate", () => {
  const fromUrl = new URLSearchParams(window.location.search).get("scene");
  applySceneMode(sceneLabels[fromUrl] ? fromUrl : "clocktower", { syncUrl: false });
});

window.__demoState = { ok: true, frames: 0, lastTime: 0, debug: {} };
window.__canvas = canvas;
window.__setBinaryTime = (hours) => {
  if (Number.isFinite(hours)) binaryDayHours = THREE.MathUtils.euclideanModulo(hours, 24);
};
window.__getBinaryTime = () => binaryDayHours;

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

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
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
  const dt = lastTickTime > 0 ? Math.min(0.25, t - lastTickTime) : 0.016;
  lastTickTime = t;
  const audio = synth.getVisualState();
  const beat = audio.beat;
  const level = audio.level;
  const section = Math.floor(t / 11.5) % sectionNames.length;
  if (section !== currentSection) {
    currentSection = section;
    setCinematic(cinematic);
  }

  controls.update();

  const shouldCinematicBlend = cinematic;
  cinematicMix = THREE.MathUtils.lerp(cinematicMix, shouldCinematicBlend ? 1 : 0, 0.02);

  binaryDayHours = THREE.MathUtils.euclideanModulo(binaryDayHours + dt * binaryHourRate, 24);

  if (activeSceneKey !== "clocktower") {
    const sysT = t * 0.24;
    const baryRadiusA = 2.2;
    const baryRadiusB = 2.9;
    starAGroup.position.set(Math.cos(sysT) * baryRadiusA, Math.sin(sysT * 0.35) * 0.35, Math.sin(sysT) * baryRadiusA);
    starBGroup.position.set(
      -Math.cos(sysT * 1.03) * baryRadiusB,
      Math.cos(sysT * 0.42) * 0.45,
      -Math.sin(sysT * 1.03) * baryRadiusB,
    );

    binaryStarALight.position.copy(starAGroup.position);
    binaryStarBLight.position.copy(starBGroup.position);

    const planetOrbitA = sysT * 0.38;
    planetPivot.position.set(Math.cos(planetOrbitA) * planetOrbitRadius, 0, Math.sin(planetOrbitA) * planetOrbitRadius);
    planetGroup.rotation.y = t * 0.25;
    cloudLayer.rotation.y = -t * 0.17;

    const dayPhase = binaryDayHours / 24;
    const primaryAltitude = Math.sin((dayPhase - 0.25) * Math.PI * 2);
    const secondSunStart = 18.48;
    const secondSunEnd = 18.78;
    const secondWindow = smoothstep(secondSunStart, secondSunStart + 0.02, binaryDayHours)
      * (1 - smoothstep(secondSunEnd - 0.02, secondSunEnd, binaryDayHours));
    const secondArc = THREE.MathUtils.clamp(
      (binaryDayHours - secondSunStart) / Math.max(0.0001, secondSunEnd - secondSunStart),
      0,
      1,
    );
    const secondaryAltitude = Math.sin(secondArc * Math.PI) * secondWindow;

    const dayStrength = THREE.MathUtils.clamp(primaryAltitude * 1.15, 0, 1);
    const secondStrength = THREE.MathUtils.clamp(secondaryAltitude * 2.6, 0, 1);
    const daylight = smoothstep(-0.12, 0.25, primaryAltitude);
    const twilight = smoothstep(-0.24, -0.02, primaryAltitude) * (1 - smoothstep(0.15, 0.5, primaryAltitude));
    const nightness = 1 - daylight;

    if (activeSceneKey !== "clocktower") {
      ambient.intensity = 0.1 + daylight * 0.28 + secondStrength * 0.16;
      ambient.color.setRGB(
        THREE.MathUtils.lerp(0.25, 0.56, daylight),
        THREE.MathUtils.lerp(0.32, 0.72, daylight),
        THREE.MathUtils.lerp(0.58, 0.92, daylight),
      );
      scene.fog.color.setRGB(
        THREE.MathUtils.lerp(0.01, 0.23, daylight),
        THREE.MathUtils.lerp(0.02, 0.35, daylight),
        THREE.MathUtils.lerp(0.07, 0.52, daylight),
      );
      scene.background.setRGB(
        THREE.MathUtils.lerp(0.004, 0.2, daylight),
        THREE.MathUtils.lerp(0.01, 0.3, daylight),
        THREE.MathUtils.lerp(0.04, 0.5, daylight),
      );
      scene.fog.density = THREE.MathUtils.lerp(0.072, 0.038, daylight);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.5, 0.86, daylight) + secondStrength * 0.05;
      stars.material.opacity = THREE.MathUtils.lerp(0.92, 0.08, daylight);
    }

    binaryStarALight.intensity = 2200 + dayStrength * 6200;
    binaryStarBLight.intensity = 260 + secondStrength * 4200;
    binaryFill.intensity = 0.12 + daylight * 0.75 + secondStrength * 0.24;
    if (timeIndicator) {
      const phaseText = secondStrength > 0.06 ? "2nd Sun" : dayStrength > 0.05 ? "Day" : "Night";
      timeIndicator.textContent = `Time ${format24Hour(binaryDayHours)} ${phaseText}`;
    }

    if (activeSceneKey === "binaryExternal") {
      const autoAngleBinary = t * 0.11;
      const extAutoPos = new THREE.Vector3(
        Math.cos(autoAngleBinary) * 32,
        12 + Math.sin(t * 0.13) * 3,
        Math.sin(autoAngleBinary) * 32,
      );
      camera.position.lerp(extAutoPos, cinematicMix * 0.05);
      controls.target.lerp(new THREE.Vector3(0, 0, 0), cinematicMix * 0.06);
      surfaceForeground.visible = false;
    } else {
      const primaryAz = Math.sin((binaryDayHours - 12) * 0.18) * 0.4;
      const primaryAlt = primaryAltitude * (Math.PI * 0.38);
      const secondaryAz = -0.32;
      const secondaryAlt = (-0.03 + secondaryAltitude * 0.08) * Math.PI;
      const dirFromAzAlt = (az, alt) =>
        new THREE.Vector3(
          Math.sin(az) * Math.cos(alt),
          Math.sin(alt),
          -Math.cos(az) * Math.cos(alt),
        ).normalize();
      const primaryDir = dirFromAzAlt(primaryAz, primaryAlt);
      const secondaryDir = dirFromAzAlt(secondaryAz, secondaryAlt);

      if (cinematicMix > 0.001) {
        const surfCam = new THREE.Vector3(Math.sin(t * 0.055) * 6.0, 1.7 + Math.sin(t * 0.07) * 0.08, 12.5);
        const surfTarget = new THREE.Vector3(Math.sin(t * 0.04) * 8.0, 1.2, -86);
        camera.position.lerp(surfCam, cinematicMix * 0.045);
        controls.target.lerp(surfTarget, cinematicMix * 0.05);
      }
      if (camera.position.y < 1.0) camera.position.y = 1.0;
      camera.up.set(0, 1, 0);

      surfaceSky.position.copy(camera.position);
      surfaceGround.position.x = camera.position.x;
      surfaceGround.position.z = camera.position.z - 35;
      surfaceOcean.position.x = camera.position.x;
      surfaceOcean.position.z = camera.position.z - 95;
      surfaceOcean.material.uniforms.time.value = t * 0.42;

      const mixedSunDir = primaryDir
        .clone()
        .multiplyScalar(Math.max(0.05, dayStrength))
        .add(secondaryDir.clone().multiplyScalar(Math.max(0.0, secondStrength * 1.2)))
        .normalize();
      surfaceOcean.material.uniforms.sunDirection.value.copy(mixedSunDir);
      surfaceOcean.material.uniforms.distortionScale.value = 1.6 + beat * 1.2 + nightness * 1.1 + twilight * 0.45;
      surfaceOcean.material.uniforms.waterColor.value.setRGB(
        THREE.MathUtils.lerp(0.03, 0.09, daylight),
        THREE.MathUtils.lerp(0.1, 0.35, daylight),
        THREE.MathUtils.lerp(0.24, 0.62, daylight),
      );

      const sunAPos = camera.position.clone().add(primaryDir.clone().multiplyScalar(92));
      const sunBPos = camera.position.clone().add(secondaryDir.clone().multiplyScalar(88));
      surfaceSunA.group.position.copy(sunAPos);
      surfaceSunB.group.position.copy(sunBPos);
      surfaceSunA.group.lookAt(camera.position);
      surfaceSunB.group.lookAt(camera.position);
      surfaceSunA.group.visible = primaryDir.y > -0.28;
      surfaceSunB.group.visible = secondaryDir.y > -0.15 && secondWindow > 0.01;
      surfaceSunA.glow.material.uniforms.uStrength.value = 0.75 + dayStrength * 0.85;
      surfaceSunB.glow.material.uniforms.uStrength.value = 0.55 + secondStrength * 1.1;
      surfaceSunA.core.scale.setScalar(1.05 + dayStrength * 0.35);
      surfaceSunB.core.scale.setScalar(0.95 + secondStrength * 0.6);

      surfaceReflectionA.position.x = camera.position.x + primaryDir.x * 42;
      surfaceReflectionA.position.z = camera.position.z - 74 + primaryDir.z * 16;
      surfaceReflectionA.material.opacity = THREE.MathUtils.clamp(
        primaryDir.y * 1.25 + dayStrength * 0.62 + twilight * 0.35,
        0,
        0.92,
      );
      surfaceReflectionA.scale.x = 0.9 + (1 - Math.abs(primaryDir.x)) * 0.9;
      surfaceReflectionA.scale.y = 1.0 + twilight * 0.28;

      surfaceReflectionB.position.x = camera.position.x + secondaryDir.x * 40;
      surfaceReflectionB.position.z = camera.position.z - 74 + secondaryDir.z * 16;
      surfaceReflectionB.material.opacity = THREE.MathUtils.clamp(secondStrength * 0.92, 0, 0.8);
      surfaceReflectionB.scale.x = 0.85 + secondStrength * 0.7;
      surfaceReflectionB.scale.y = 1.0 + secondStrength * 0.34;

      binaryStarALight.position.copy(camera.position).add(primaryDir.clone().multiplyScalar(76));
      binaryStarBLight.position.copy(camera.position).add(secondaryDir.clone().multiplyScalar(70));
      binaryStarALight.intensity = 150 + dayStrength * 9000;
      binaryStarBLight.intensity = 40 + secondStrength * 8200;
      binaryFill.intensity = 0.25 + dayStrength * 0.38 + secondStrength * 0.3;

      const fgPos = camera.position.clone().add(new THREE.Vector3(0, -1.08, -8.0));
      surfaceForeground.position.lerp(fgPos, 0.14);
      surfaceForeground.rotation.x = -Math.PI / 2;
      surfaceForeground.material.emissiveIntensity = 0.03 + daylight * 0.42 + twilight * 0.22 + secondStrength * 0.25;
      surfaceGround.material.color.setRGB(
        THREE.MathUtils.lerp(0.04, 0.22, daylight),
        THREE.MathUtils.lerp(0.06, 0.28, daylight),
        THREE.MathUtils.lerp(0.11, 0.33, daylight),
      );
      surfaceSky.material.uniforms.uDay.value = THREE.MathUtils.clamp(daylight, 0.0, 1.0);
      surfaceSky.material.uniforms.uTwilight.value = THREE.MathUtils.clamp(twilight, 0.0, 1.0);
      surfaceSky.material.uniforms.uSecond.value = secondStrength;
      surfaceSky.material.uniforms.uA.value.copy(primaryDir);
      surfaceSky.material.uniforms.uB.value.copy(secondaryDir);
    }

    stars.rotation.y = t * 0.004;
    sky.rotation.y = -t * 0.003;
    bloomPass.strength = 0.5 + dayStrength * 0.35 + secondStrength * 0.5 + beat * 0.2;
    bloomPass.radius = 0.24 + secondStrength * 0.12;
    bloomPass.threshold = 0.84 - secondStrength * 0.08;
    crtPass.uniforms.uTime.value = t;
    crtPass.uniforms.uBeat.value = Math.min(1.0, beat * 0.9 + level * 0.35);
    crtPass.uniforms.uGlitch.value = 0.12 + secondStrength * 0.25;

    if (debugView) {
      renderer.render(scene, camera);
    } else {
      composer.render();
    }

    window.__demoState.frames += 1;
    window.__demoState.lastTime = t;
    window.__demoState.debug = {
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      points: renderer.info.render.points,
      level: Number(level.toFixed(3)),
      beat: Number(beat.toFixed(3)),
      scene: activeSceneKey,
      dayPhase: Number(dayPhase.toFixed(3)),
      time24: format24Hour(binaryDayHours),
      secondSun: Number(secondStrength.toFixed(3)),
      cinematicMix: Number(cinematicMix.toFixed(3)),
      blenderTower: usingBlenderTower,
      blenderCity: usingBlenderCity,
      debugView,
    };

    requestAnimationFrame(tick);
    return;
  }

  const autoAngle = t * 0.19;
  renderer.toneMappingExposure = 0.62;
  ambient.intensity = 0.56;
  ambient.color.setHex(0x3346bb);
  scene.background.setHex(0x02030f);
  scene.fog.color.setHex(0x02030f);
  scene.fog.density = 0.065;
  stars.material.opacity = 0.86;
  const autoRadius = 7.2 + Math.sin(t * 0.37) * 1.4;
  const autoPos = new THREE.Vector3(
    Math.cos(autoAngle) * autoRadius,
    2.6 + Math.sin(t * 0.24) * 1.1,
    Math.sin(autoAngle) * autoRadius,
  );

  camera.position.lerp(autoPos, cinematicMix * 0.04);
  controls.target.lerp(new THREE.Vector3(0, 1.45 + Math.sin(t * 0.9) * 0.12, 0), cinematicMix * 0.04);

  const activeTower = usingBlenderTower ? blenderTowerRoot : towerGroup;
  activeTower.rotation.y = Math.sin(t * 0.25) * 0.08 + beat * 0.1;
  activeTower.position.y = Math.sin(t * 0.9) * 0.035 + beat * 0.05;

  if (!usingBlenderTower) {
    minuteHand.rotation.z = -t * 1.85;
    hourHand.rotation.z = -t * 0.39;
  } else {
    if (blenderMinuteHand) blenderMinuteHand.rotation.y = -t * 1.85;
    if (blenderHourHand) blenderHourHand.rotation.y = -t * 0.39;
  }

  const pulse = 0.45 + level * 0.85 + beat * 1.2;
  const sectionBoost = section === 1 ? 1.22 : section === 3 ? 1.34 : 1.0;
  beamLight.intensity = (520 + pulse * 980) * sectionBoost;
  rim.intensity = (360 + Math.sin(t * 2.3) * 110 + pulse * 320) * sectionBoost;
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
    (section === 3 ? 0.78 : 0.48) + level * (section === 1 ? 0.34 : 0.24) + beat * 0.22;
  bloomPass.radius = 0.28 + level * (section === 2 ? 0.18 : 0.12);
  bloomPass.threshold = (section === 3 ? 0.84 : 0.88) - level * 0.03;

  crtPass.uniforms.uTime.value = t;
  crtPass.uniforms.uBeat.value = Math.min(1.0, beat * 1.2 + level * 0.6);
  crtPass.uniforms.uGlitch.value = Math.min(
    1.0,
    (section === 3 ? 0.65 : section === 1 ? 0.35 : 0.15) + beat * 0.7,
  );

  if (debugView) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }

  window.__demoState.frames += 1;
  window.__demoState.lastTime = t;
  window.__demoState.debug = {
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    points: renderer.info.render.points,
    scene: activeSceneKey,
    level: Number(level.toFixed(3)),
    beat: Number(beat.toFixed(3)),
    section,
    oceanTime: Number(ocean.material.uniforms.time.value.toFixed(2)),
    cinematicMix: Number(cinematicMix.toFixed(3)),
    blenderTower: usingBlenderTower,
    blenderCity: usingBlenderCity,
    debugView,
  };

  requestAnimationFrame(tick);
}

tick();
