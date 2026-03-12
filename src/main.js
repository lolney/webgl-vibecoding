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
import { clocktowerScene } from "./scenes/clocktowerScene.js";
import { binaryExternalScene } from "./scenes/binaryExternalScene.js";
import { binarySurfaceScene } from "./scenes/binarySurfaceScene.js";
import { createSceneManager } from "./scenes/sceneManager.js";
import { createHudPrimitive } from "./ui/hudPrimitive.js";
import { createDiagnosticsPanel } from "./ui/diagnosticsPanel.js";
import { createOrbitSchematic } from "./ui/orbitSchematic.js";
import { createViewerSchematic } from "./ui/viewerSchematic.js";
import { updateBinaryScene } from "./scenes/controllers/binarySceneController.js";
import { updateClocktowerScene } from "./scenes/controllers/clocktowerSceneController.js";
import { applySceneModeInternal } from "./scenes/controllers/sceneModeController.js";
import { computeBinarySimulationState } from "./scenes/shared/orbital.js";
import {
  binaryDefaultSimulationDays,
  binaryDefaultStartHour,
  binaryTimeMultipliers,
  buildUrlFromState,
  coerceTimeMultiplier,
  getPresetsForScene,
  normalizeObserverCoordinates,
  readBinaryUrlState,
  resolveInitialBinaryState,
} from "./scenes/shared/binaryState.js";

const canvas = document.getElementById("gl");
const audioButton = document.getElementById("audioToggle");
const hud = createHudPrimitive();
const diagnosticsPanel = createDiagnosticsPanel();
const orbitSchematic = createOrbitSchematic();
const viewerSchematic = createViewerSchematic({
  onLatitudeAdjust(deltaDeg) {
    adjustObserverLatitude(deltaDeg, { syncUrl: true });
    markInteraction();
  },
});
const {
  sceneChooser,
  presetChooser,
  modeBadge,
  timeIndicator,
  timeRateButton,
} = hud.elements;
const query = new URLSearchParams(window.location.search);
const debugView = query.get("debug") === "1";
const initialUrlState = readBinaryUrlState(query);
const initialSceneQuery = initialUrlState.scene;
const resolvedInitialBinaryState = resolveInitialBinaryState(initialUrlState);

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

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 320);
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

const clocktowerAmbient = new THREE.AmbientLight(0x3346bb, 0.56);
scene.add(clocktowerAmbient);

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

const binaryAmbient = new THREE.AmbientLight(0x8fb7ff, 0.0);
binaryAmbient.visible = false;
scene.add(binaryAmbient);

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
  new THREE.MeshBasicMaterial({
    color: 0xd8ecff,
    depthTest: false,
    transparent: true,
    opacity: 0.94,
    toneMapped: false,
  }),
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
  new THREE.PointsMaterial({
    color: 0x8bc6ff,
    size: 0.05,
    transparent: true,
    opacity: 0.86,
    vertexColors: true,
    sizeAttenuation: true,
  }),
);
const starCount = 2200;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  const r = 26 + Math.random() * 20;
  const a = Math.random() * Math.PI * 2;
  const y = (Math.random() - 0.05) * 20;
  starPositions[i * 3] = Math.cos(a) * r;
  starPositions[i * 3 + 1] = y;
  starPositions[i * 3 + 2] = Math.sin(a) * r;
  const tint = Math.random();
  starColors[i * 3] = THREE.MathUtils.lerp(0.45, 1.0, tint);
  starColors[i * 3 + 1] = THREE.MathUtils.lerp(0.58, 0.9, 1 - tint * 0.35);
  starColors[i * 3 + 2] = 1.0;
}
stars.geometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
stars.geometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
scene.add(stars);

const nebulaShell = new THREE.Mesh(
  new THREE.SphereGeometry(92, 40, 28),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uOpacity: { value: 0.18 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vDir;
      void main() {
        float haze = 0.5 + 0.5 * sin(vDir.x * 7.0 + vDir.z * 5.0);
        float band = 0.5 + 0.5 * sin(vDir.y * 10.0 - vDir.x * 4.0);
        float cloud = smoothstep(0.56, 0.96, haze * 0.6 + band * 0.4);
        vec3 colA = vec3(0.03, 0.08, 0.18);
        vec3 colB = vec3(0.06, 0.12, 0.28);
        vec3 colC = vec3(0.02, 0.06, 0.14);
        vec3 col = mix(colA, colB, cloud);
        col = mix(col, colC, smoothstep(-0.15, 0.5, vDir.y));
        gl_FragColor = vec4(col, cloud * uOpacity);
      }
    `,
  }),
);
scene.add(nebulaShell);

const binarySystemGroup = new THREE.Group();
binarySystemGroup.visible = false;
binarySystemGroup.scale.setScalar(0.6);
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

function makeVolumetricStar({ radius, coreColor, glowColor, shellColor }) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 36),
    new THREE.ShaderMaterial({
      uniforms: {
        uCore: { value: new THREE.Color(coreColor) },
        uGlow: { value: new THREE.Color(glowColor) },
      },
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vViewDirW;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDirW = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uCore;
        uniform vec3 uGlow;
        varying vec3 vNormalW;
        varying vec3 vViewDirW;
        void main() {
          float ndv = clamp(dot(normalize(vNormalW), normalize(vViewDirW)), 0.0, 1.0);
          float center = pow(ndv, 0.35);
          float limb = pow(1.0 - ndv, 1.9);
          vec3 col = mix(uGlow, uCore, center);
          col += uGlow * limb * 0.75;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      toneMapped: false,
    }),
  );
  group.add(core);

  const shellMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(shellColor) },
      uPower: { value: 2.2 },
      uAlpha: { value: 0.38 },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewDirW;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDirW = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uAlpha;
      varying vec3 vNormalW;
      varying vec3 vViewDirW;
      void main() {
        float ndv = clamp(dot(normalize(vNormalW), normalize(vViewDirW)), 0.0, 1.0);
        float rim = pow(1.0 - ndv, uPower);
        gl_FragColor = vec4(uColor * rim, rim * uAlpha);
      }
    `,
    toneMapped: false,
  });

  const innerShell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.45, 36, 28),
    shellMat.clone(),
  );
  innerShell.material.uniforms.uPower.value = 1.9;
  innerShell.material.uniforms.uAlpha.value = 0.34;
  group.add(innerShell);

  const outerShell = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 2.05, 28, 22),
    shellMat.clone(),
  );
  outerShell.material.uniforms.uPower.value = 2.7;
  outerShell.material.uniforms.uAlpha.value = 0.18;
  group.add(outerShell);

  return { group, core, innerShell, outerShell };
}

const starAGroup = new THREE.Group();
const starAVisual = makeVolumetricStar({
  radius: 1.3,
  coreColor: 0xfff3cc,
  glowColor: 0xffd468,
  shellColor: 0xffb34d,
});
starAGroup.add(starAVisual.group);
binarySystemGroup.add(starAGroup);

const starBGroup = new THREE.Group();
const starBVisual = makeVolumetricStar({
  radius: 1.05,
  coreColor: 0xd9e6ff,
  glowColor: 0x95b6ff,
  shellColor: 0x6f9eff,
});
starBGroup.add(starBVisual.group);
binarySystemGroup.add(starBGroup);

const binaryStarALight = new THREE.PointLight(0xfff4c2, 6500, 220, 2.0);
const binaryStarBLight = new THREE.PointLight(0xbfd4ff, 4800, 210, 2.0);
scene.add(binaryStarALight);
scene.add(binaryStarBLight);

const planetOrbitRadius = 19.2;
const planetGroup = new THREE.Group();
const planetPivot = new THREE.Group();
binarySystemGroup.add(planetPivot);
planetPivot.add(planetGroup);

const planetMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.65, 64, 48),
  new THREE.MeshPhysicalMaterial({
    color: 0x315f8a,
    roughness: 1.0,
    metalness: 0.0,
    clearcoat: 0.02,
    clearcoatRoughness: 0.92,
    envMapIntensity: 0.0,
  }),
);
planetGroup.add(planetMesh);

const cloudLayer = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 40, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0xbcd6ff,
    transparent: true,
    opacity: 0.13,
    roughness: 0.8,
    metalness: 0.02,
    envMapIntensity: 0.0,
  }),
);
planetGroup.add(cloudLayer);

const planetAtmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.74, 48, 36),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uColor: { value: new THREE.Color(0x7db7ff) },
      uPower: { value: 3.2 },
      uIntensity: { value: 0.48 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(max(0.0, 1.0 - dot(normalize(vNormal), normalize(vView))), uPower);
        gl_FragColor = vec4(uColor * rim * uIntensity, rim * 0.7);
      }
    `,
  }),
);
planetGroup.add(planetAtmosphere);

const planetRing = new THREE.Mesh(
  new THREE.RingGeometry(0.78, 0.99, 80),
  new THREE.MeshBasicMaterial({
    color: 0x89ccff,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
planetRing.rotation.x = Math.PI * 0.34;
planetGroup.add(planetRing);

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
      uZenithColor: { value: new THREE.Color(0x2d69b8) },
      uHorizonColor: { value: new THREE.Color(0x95b7e5) },
      uNightZenith: { value: new THREE.Color(0x020712) },
      uNightHorizon: { value: new THREE.Color(0x081428) },
      uRayleighColor: { value: new THREE.Color(0x77b6ff) },
      uMieColorA: { value: new THREE.Color(0xffc07a) },
      uMieColorB: { value: new THREE.Color(0xa9c8ff) },
      uSunDirA: { value: new THREE.Vector3(0, 1, 0) },
      uSunDirB: { value: new THREE.Vector3(0, 1, 0) },
      uDayStrength: { value: 0.2 },
      uTwilightStrength: { value: 0.0 },
      uNightStrength: { value: 1.0 },
      uHaze: { value: 0.2 },
      uScatterStrengthA: { value: 0.0 },
      uScatterStrengthB: { value: 0.0 },
      uMieStrengthA: { value: 0.0 },
      uMieStrengthB: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vLocalDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vLocalDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uNightZenith;
      uniform vec3 uNightHorizon;
      uniform vec3 uRayleighColor;
      uniform vec3 uMieColorA;
      uniform vec3 uMieColorB;
      uniform vec3 uSunDirA;
      uniform vec3 uSunDirB;
      uniform float uDayStrength;
      uniform float uTwilightStrength;
      uniform float uNightStrength;
      uniform float uHaze;
      uniform float uScatterStrengthA;
      uniform float uScatterStrengthB;
      uniform float uMieStrengthA;
      uniform float uMieStrengthB;
      varying vec3 vLocalDir;
      void main() {
        vec3 dir = normalize(vLocalDir);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        float muA = max(dot(dir, normalize(uSunDirA)), 0.0);
        float muB = max(dot(dir, normalize(uSunDirB)), 0.0);
        float rayleighPhaseA = 0.75 * (1.0 + muA * muA);
        float rayleighPhaseB = 0.75 * (1.0 + muB * muB);
        float miePhaseA = pow(muA, mix(10.0, 28.0, 1.0 - uHaze));
        float miePhaseB = pow(muB, mix(12.0, 26.0, 1.0 - uHaze));
        float horizon = pow(1.0 - h, 1.4);
        float density = mix(1.05, 2.5, horizon) * mix(0.75, 1.45, uHaze);

        vec3 nightBase = mix(uNightHorizon, uNightZenith, pow(h, 0.72));
        vec3 dayBase = mix(uHorizonColor, uZenithColor, pow(h, 0.7));
        vec3 scatter = uRayleighColor * (
          rayleighPhaseA * uScatterStrengthA +
          rayleighPhaseB * uScatterStrengthB
        ) * density * (0.45 + 0.55 * h);
        vec3 mie = uMieColorA * miePhaseA * uMieStrengthA
          + uMieColorB * miePhaseB * uMieStrengthB;
        vec3 twilightBoost = uHorizonColor * horizon * (uTwilightStrength * 0.46);
        float waterlineBand = smoothstep(0.0, 0.05, h) * (1.0 - smoothstep(0.05, 0.14, h));

        vec3 litSky = dayBase + scatter + mie + twilightBoost;
        vec3 col = mix(nightBase, litSky, clamp(uDayStrength + uTwilightStrength * 0.72, 0.0, 1.0));
        col *= 1.0 - waterlineBand * 0.24;
        col = mix(col, nightBase, uNightStrength * smoothstep(0.0, 0.35, 1.0 - h) * 0.18);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }),
);
surfacePovGroup.add(surfaceSky);

const surfaceHaze = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 1, 1, 1),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0x5e83b6) },
      uOpacity: { value: 0.1 },
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
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float verticalFade = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.34, 0.72, vUv.y));
        float edgeFade = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
        float band = pow(verticalFade, 1.45) * edgeFade;
        gl_FragColor = vec4(uColor, band * uOpacity);
      }
    `,
  }),
);
surfaceHaze.renderOrder = 95;
surfacePovGroup.add(surfaceHaze);

const surfaceScatterBand = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 1, 1, 1),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xffd1a0) },
      uOpacity: { value: 0.06 },
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
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float horizonBand = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.16, 0.55, vUv.y));
        float edgeFade = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
        float alpha = horizonBand * edgeFade * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  }),
);
surfaceScatterBand.renderOrder = 96;
surfaceScatterBand.visible = false;
surfacePovGroup.add(surfaceScatterBand);

const surfaceGround = new THREE.Mesh(
  new THREE.PlaneGeometry(20000, 20000, 1, 1),
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
surfaceGround.visible = false;
surfacePovGroup.add(surfaceGround);

let surfaceOcean = null;
let surfaceFarOcean = null;

function makeSurfaceSun(coreColor, glowColor, coreSize, glowSize) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(coreSize * 2.0, coreSize * 2.0),
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uColor: { value: new THREE.Color(coreColor) },
        uIntensity: { value: 1.0 },
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
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p);
          float disc = smoothstep(0.5, 0.0, d);
          float edge = smoothstep(0.5, 0.42, d) * 0.22;
          float a = clamp(disc + edge, 0.0, 1.0);
          gl_FragColor = vec4(uColor * (disc * 1.15 + edge) * uIntensity, a);
        }
      `,
    }),
  );
  core.renderOrder = 120;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(glowSize, glowSize),
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uColor: { value: new THREE.Color(glowColor) },
        uStrength: { value: 1.0 },
        uIntensity: { value: 1.0 },
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
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p);
          float core = smoothstep(0.18, 0.0, d);
          float halo = smoothstep(0.52, 0.0, d) * 0.7;
          float a = (core + halo) * uStrength;
          gl_FragColor = vec4(uColor * (core * 1.4 + halo) * uIntensity, a);
        }
      `,
    }),
  );
  glow.renderOrder = 121;
  g.add(core);
  g.add(glow);
  return { group: g, core, glow };
}

function makeAtmosphericBeam(color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, 1, 24),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      toneMapped: false,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uStrength: { value: 0.0 },
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
          float radial = 1.0 - smoothstep(0.0, 0.48, abs(p.x));
          float axial = smoothstep(0.0, 0.26, vUv.y) * (1.0 - smoothstep(0.68, 1.0, vUv.y));
          float taper = 1.0 - smoothstep(0.18, 0.5, abs(p.x) + (1.0 - vUv.y) * 0.18);
          float streak = 0.9 + 0.1 * sin(vUv.y * 18.0 + p.x * 11.0);
          float alpha = radial * axial * taper * streak * uStrength;
          vec3 color = mix(uColor, vec3(1.0), 0.2) * (0.62 + alpha * 0.6);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    }),
  );
  mesh.renderOrder = 118;
  mesh.visible = false;
  return mesh;
}

const surfaceSunA = makeSurfaceSun(0xfff2be, 0xffcb6d, 3.2, 16.0);
const surfaceSunB = makeSurfaceSun(0xc6dbff, 0x7eb1ff, 2.4, 12.0);
const surfaceBeamA = makeAtmosphericBeam(0xffd287);
const surfaceBeamB = makeAtmosphericBeam(0x9fc6ff);
surfaceSunA.group.visible = false;
surfaceSunB.group.visible = false;
surfacePovGroup.add(surfaceSunA.group);
surfacePovGroup.add(surfaceSunB.group);
surfacePovGroup.add(surfaceBeamA);
surfacePovGroup.add(surfaceBeamB);

const surfaceReflectionA = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 160),
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
surfaceReflectionA.visible = false;
surfacePovGroup.add(surfaceReflectionA);

const surfaceReflectionB = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 140),
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
surfaceReflectionB.visible = false;
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
const surfaceOceanGeometry = new THREE.PlaneGeometry(108, 108, 180, 180);
const surfaceOceanBasePos = surfaceOceanGeometry.attributes.position.array.slice();
surfaceOcean = new Water(surfaceOceanGeometry, {
  textureWidth: 1024,
  textureHeight: 1024,
  waterNormals,
  sunDirection: new THREE.Vector3(0.38, 1.0, 0.42).normalize(),
  sunColor: 0xffffff,
  waterColor: 0x123c63,
  distortionScale: 2.0,
  fog: true,
  alpha: 0.97,
});
surfaceOcean.rotation.x = -Math.PI / 2;
surfaceOcean.material.uniforms.size.value = 1.8;
surfacePovGroup.add(surfaceOcean);

const surfaceFarOceanGeometry = new THREE.PlaneGeometry(164, 136, 120, 96);
const surfaceFarOceanBasePos = surfaceFarOceanGeometry.attributes.position.array.slice();
surfaceFarOcean = new Water(surfaceFarOceanGeometry, {
  textureWidth: 512,
  textureHeight: 512,
  waterNormals,
  sunDirection: new THREE.Vector3(0.4, 1.0, 0.35).normalize(),
  sunColor: 0xffffff,
  waterColor: 0x1b4f7c,
  distortionScale: 2.8,
  fog: true,
  alpha: 0.92,
});
surfaceFarOcean.rotation.x = -Math.PI / 2;
surfaceFarOcean.material.uniforms.size.value = 2.4;
surfacePovGroup.add(surfaceFarOcean);
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
const sceneDefinitions = [clocktowerScene, binaryExternalScene, binarySurfaceScene];
const sceneManager = createSceneManager({ sceneDefs: sceneDefinitions });
const sceneByKey = Object.fromEntries(sceneDefinitions.map((sceneDef) => [sceneDef.key, sceneDef]));
const sceneLabels = Object.fromEntries(sceneDefinitions.map((sceneDef) => [sceneDef.key, sceneDef.label]));
hud.setSceneOptions(sceneDefinitions);
hud.setTitle("NEON CLOCKTOWER // DEMOSCENE CUT");
let activePresetKey = resolvedInitialBinaryState.presetKey;
let binaryDayHours = resolvedInitialBinaryState.binaryDayHours;
let binarySimulationDays = resolvedInitialBinaryState.binarySimulationDays;
let binaryHourRateBase = resolvedInitialBinaryState.binaryHourRateBase;
let binaryTimeMultiplier = resolvedInitialBinaryState.binaryTimeMultiplier;
let observerLatitudeTravelDeg = resolvedInitialBinaryState.observerLatitudeInputDeg;
let observerLongitudeBaseDeg = resolvedInitialBinaryState.observerLongitudeInputDeg;
let observerLatitudeDeg = resolvedInitialBinaryState.observerLatitudeDeg;
let observerLongitudeDeg = resolvedInitialBinaryState.observerLongitudeDeg;
let diagnosticsVisible = resolvedInitialBinaryState.diagnosticsVisible || debugView;
let pendingInitialOrbitView = resolvedInitialBinaryState.orbitView;
let pendingInitialSurfacePitch = resolvedInitialBinaryState.surfacePitch;
const surfaceObserverAnchor = new THREE.Vector3();
const surfaceLookDir = new THREE.Vector3(0, 0.04, 1).normalize();
const surfaceViewerForwardWorld = new THREE.Vector3(0, 0, 1);
const surfaceViewDistanceMin = 11.8;
const surfaceViewDistanceMax = 13.2;
const surfacePitchMin = -0.12;
const surfacePitchMax = 1.12;
let surfaceViewDistance = 12.4;
let lastTickTime = 0;
let debugSectionOverride = null;
let debugBeatOverride = null;
let debugLevelOverride = null;
const surfaceQuatA = new THREE.Quaternion();
const surfaceQuatB = new THREE.Quaternion();
const surfaceVecA = new THREE.Vector3();
const surfaceVecB = new THREE.Vector3();

function wrapAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, Math.PI * 2) - Math.PI;
}

function lerpAngle(from, to, t) {
  return from + wrapAngle(to - from) * t;
}

function projectVectorToTangent(vec, up) {
  const tangent = vec.clone().sub(up.clone().multiplyScalar(vec.dot(up)));
  if (tangent.lengthSq() < 1e-8) return tangent.set(0, 0, 1);
  return tangent.normalize();
}

function localDirectionFromAngles(yaw, pitch) {
  const cosPitch = Math.cos(pitch);
  return new THREE.Vector3(
    Math.sin(yaw) * cosPitch,
    Math.sin(pitch),
    Math.cos(yaw) * cosPitch,
  ).normalize();
}

function worldDirectionFromLocal(localDir, orbit) {
  return orbit.east.clone().multiplyScalar(localDir.x)
    .add(orbit.observerNormal.clone().multiplyScalar(localDir.y))
    .add(orbit.north.clone().multiplyScalar(localDir.z))
    .normalize();
}

function localDirectionFromWorld(worldDir, orbit) {
  return new THREE.Vector3(
    worldDir.dot(orbit.east),
    worldDir.dot(orbit.observerNormal),
    worldDir.dot(orbit.north),
  ).normalize();
}

function clampSurfaceForwardWorld(forwardWorld, upWorld) {
  const pitch = Math.asin(THREE.MathUtils.clamp(forwardWorld.dot(upWorld), -1, 1));
  const clampedPitch = THREE.MathUtils.clamp(pitch, surfacePitchMin, surfacePitchMax);
  const tangent = projectVectorToTangent(forwardWorld, upWorld);
  const horizontal = Math.cos(clampedPitch);
  return tangent.multiplyScalar(horizontal)
    .add(upWorld.clone().multiplyScalar(Math.sin(clampedPitch)))
    .normalize();
}

function applyObserverTravelCoordinates(latitudeTravelDeg, longitudeBaseDeg) {
  observerLatitudeTravelDeg = Number.isFinite(latitudeTravelDeg) ? latitudeTravelDeg : 0;
  observerLongitudeBaseDeg = Number.isFinite(longitudeBaseDeg) ? longitudeBaseDeg : 0;
  const nextCoords = normalizeObserverCoordinates(observerLatitudeTravelDeg, observerLongitudeBaseDeg);
  observerLatitudeDeg = nextCoords.latitudeDeg;
  observerLongitudeDeg = nextCoords.longitudeDeg;
  return nextCoords;
}

function setObserverCoordinates(latitudeDeg, longitudeDeg, options = {}) {
  const { syncUrl = false, pushHistory = false } = options;
  activePresetKey = "";
  hud.setPreset("");
  applyObserverTravelCoordinates(latitudeDeg, longitudeDeg);
  if (activeSceneKey === "binarySurface") updateSurfaceCamera(cinematicMix);
  if (syncUrl) syncSceneToUrl(activeSceneKey, { pushHistory });
}

function adjustObserverLatitude(deltaDeg, options = {}) {
  if (!Number.isFinite(deltaDeg) || deltaDeg === 0) return;
  setObserverCoordinates(observerLatitudeTravelDeg + deltaDeg, observerLongitudeBaseDeg, options);
}

function getSurfaceObserverState() {
  return computeBinarySimulationState({
    binaryDayHours,
    simulationDays: binarySimulationDays,
    planetOrbitRadius,
    cameraPosition: surfaceObserverAnchor,
    cameraTarget: surfaceObserverAnchor.clone().add(surfaceLookDir),
    observerLatitude: THREE.MathUtils.degToRad(observerLatitudeTravelDeg || 0),
    observerLongitude: THREE.MathUtils.degToRad(observerLongitudeBaseDeg || 0),
    viewerForwardWorld: surfaceViewerForwardWorld,
  });
}

function updateSurfaceCamera(cinematicMix = 0) {
  const orbit = getSurfaceObserverState();
  if (cinematicMix > 0.001) {
    surfaceViewerForwardWorld.lerp(orbit.primaryDir, cinematicMix * 0.14).normalize();
  }
  const localLook = localDirectionFromWorld(surfaceViewerForwardWorld, orbit);
  surfaceLookDir.copy(localLook);
  camera.position.copy(surfaceObserverAnchor);
  controls.target.copy(surfaceObserverAnchor).add(surfaceLookDir.clone().multiplyScalar(surfaceViewDistance));
  camera.up.set(0, 1, 0);
  camera.lookAt(controls.target);
}

function updateTimeRateLabel() {
  if (!timeRateButton) return;
  timeRateButton.textContent = `${binaryTimeMultiplier}x`;
}

function setSurfaceForwardFromOrbit(orbit, yaw, pitch) {
  const localForward = localDirectionFromAngles(yaw, pitch);
  surfaceViewerForwardWorld.copy(
    worldDirectionFromLocal(localForward, orbit),
  );
}

function aimSurfaceForwardAtPrimary(orbit, pitchOverride = null) {
  const targetYaw = Math.atan2(orbit.primaryLocalDir.x, orbit.primaryLocalDir.z);
  const targetPitch = THREE.MathUtils.clamp(
    Number.isFinite(pitchOverride)
      ? pitchOverride
      : (Math.asin(THREE.MathUtils.clamp(orbit.primaryLocalDir.y, -1, 1)) * 0.5 - 0.03),
    surfacePitchMin,
    surfacePitchMax,
  );
  setSurfaceForwardFromOrbit(orbit, targetYaw, targetPitch);
}

function setBinaryClockHours(hours, options = {}) {
  if (!Number.isFinite(hours)) return;
  const { preserveContinuity = true } = options;
  const normalizedHours = THREE.MathUtils.euclideanModulo(hours, 24);
  binaryDayHours = normalizedHours;
  if (preserveContinuity) {
    const currentTotalHours = binarySimulationDays * 24;
    const nearestDayIndex = Math.round((currentTotalHours - normalizedHours) / 24);
    binarySimulationDays = (nearestDayIndex * 24 + normalizedHours) / 24;
  } else {
    binarySimulationDays = binaryDefaultSimulationDays + ((hours - binaryDefaultStartHour) / 24);
  }
}

function setBinaryTimeMultiplier(mult) {
  binaryTimeMultiplier = coerceTimeMultiplier(mult);
  updateTimeRateLabel();
}

function format24Hour(hoursValue) {
  const h = THREE.MathUtils.euclideanModulo(hoursValue, 24);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function getRuntimeUrlState(overrides = {}) {
  return {
    scene: overrides.scene || activeSceneKey,
    preset: Object.prototype.hasOwnProperty.call(overrides, "preset") ? overrides.preset : activePresetKey,
    binaryHour: Object.prototype.hasOwnProperty.call(overrides, "binaryHour") ? overrides.binaryHour : binaryDayHours,
    binaryLat: Object.prototype.hasOwnProperty.call(overrides, "binaryLat") ? overrides.binaryLat : observerLatitudeTravelDeg,
    binaryLon: Object.prototype.hasOwnProperty.call(overrides, "binaryLon") ? overrides.binaryLon : observerLongitudeBaseDeg,
    binaryHourRate: binaryHourRateBase,
    timeMultiplier: Object.prototype.hasOwnProperty.call(overrides, "timeMultiplier") ? overrides.timeMultiplier : binaryTimeMultiplier,
    cinematic: Object.prototype.hasOwnProperty.call(overrides, "cinematic") ? overrides.cinematic : cinematic,
    diagnostics: Object.prototype.hasOwnProperty.call(overrides, "diagnostics") ? overrides.diagnostics : diagnosticsVisible,
  };
}

function syncSceneToUrl(sceneKey, options = {}) {
  const { pushHistory = false } = options;
  const url = buildUrlFromState(new URL(window.location.href), getRuntimeUrlState({ scene: sceneKey }));
  if (pushHistory) {
    window.history.pushState({ scene: sceneKey }, "", url);
  } else {
    window.history.replaceState({ scene: sceneKey }, "", url);
  }
}

function applyBinaryPreset(presetKey, options = {}) {
  const { syncUrl = true, pushHistory = false, explicitState = null } = options;
  const preset = getPresetsForScene(activeSceneKey).find((entry) => entry.key === presetKey);
  if (!preset) return;
  const presetState = explicitState ? { ...preset.state, ...explicitState } : preset.state;
  activePresetKey = preset.key;
  if (Number.isFinite(presetState.binaryDayHours)) {
    setBinaryClockHours(presetState.binaryDayHours, { preserveContinuity: false });
  }
  if (Number.isFinite(presetState.simulationDays)) {
    binarySimulationDays = presetState.simulationDays;
  }
  if (Number.isFinite(presetState.latitudeDeg)) {
    applyObserverTravelCoordinates(
      presetState.latitudeDeg,
      Number.isFinite(presetState.longitudeDeg) ? presetState.longitudeDeg : observerLongitudeBaseDeg,
    );
  } else if (Number.isFinite(presetState.longitudeDeg)) {
    applyObserverTravelCoordinates(observerLatitudeTravelDeg, presetState.longitudeDeg);
  }
  if (Number.isFinite(presetState.multiplier)) {
    setBinaryTimeMultiplier(presetState.multiplier);
  }
  if (typeof presetState.cinematic === "boolean") {
    setCinematic(presetState.cinematic);
  }
  if (activeSceneKey === "binarySurface") {
    surfaceObserverAnchor.set(0, 1.42, 0);
    const orbit = getSurfaceObserverState();
    aimSurfaceForwardAtPrimary(orbit, presetState.surfacePitch);
    updateSurfaceCamera(0);
  } else if (presetState.orbitView && typeof window.__setOrbitView === "function") {
    window.__setOrbitView(presetState.orbitView);
  }
  hud.setPreset(activePresetKey);
  if (syncUrl) syncSceneToUrl(activeSceneKey, { pushHistory });
}

const clocktowerObjects = [
  towerGroup,
  blenderTowerRoot,
  skylineGroup,
  blenderCityRoot,
  ringGroup,
  strobeRig,
  ...strobeSpots,
  ...strobeTargets,
  ...strobeCones,
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
  const requestedSceneKey = sceneByKey[nextSceneKey] ? nextSceneKey : "clocktower";
  const presetOptions = getPresetsForScene(requestedSceneKey);
  hud.setPresetOptions(presetOptions);
  if (!presetOptions.some((preset) => preset.key === activePresetKey)) {
    activePresetKey = "";
  }
  hud.setPreset(activePresetKey);
  activeSceneKey = applySceneModeInternal({
    nextSceneKey: requestedSceneKey,
    options,
    sceneManager,
    sceneByKey,
    clocktowerScene,
    clocktowerObjects,
    binaryObjects,
    surfacePovGroup,
    surfaceForeground,
    controls,
    camera,
    clocktowerAmbient,
    binaryAmbient,
    binaryStarALight,
    binaryStarBLight,
    binaryFill,
    key,
    rim,
    beamLight,
    moon,
    planetMesh,
    cloudLayer,
    hud,
    timeIndicator,
    syncSceneToUrl,
    setCinematic,
  });
  if (activeSceneKey === "binarySurface") {
    surfaceObserverAnchor.set(0, 1.42, 0);
    surfaceViewDistance = 12.4;
    const orbit = getSurfaceObserverState();
    aimSurfaceForwardAtPrimary(orbit, -0.03);
    updateSurfaceCamera(0);
  }
  controls.enabled = activeSceneKey !== "binarySurface";
  orbitSchematic.setVisible(activeSceneKey === "binarySurface");
  viewerSchematic.setVisible(activeSceneKey === "binarySurface");
  if (timeIndicator) {
    timeIndicator.style.display = activeSceneKey === "clocktower" ? "none" : "inline-block";
  }
  if (timeRateButton) {
    timeRateButton.style.display = activeSceneKey === "binarySurface" ? "inline-block" : "none";
  }
  if (presetChooser) {
    presetChooser.style.display = activeSceneKey === "clocktower" ? "none" : "inline-block";
  }
  diagnosticsPanel.setVisible(diagnosticsVisible);
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
  if (activeSceneKey === "binarySurface") {
    modeBadge.textContent = on ? "Sun Track // Planet POV" : "Free Look // Planet POV";
    return;
  }
  if (activeSceneKey === "binaryExternal") {
    modeBadge.textContent = on ? "Cinematic Orbit // System View" : "Free Orbit // System View";
    return;
  }
  const camText = on ? "Cinematic Orbit" : "Free Orbit";
  const sectionText = currentSection >= 0 ? sectionNames[currentSection] : "Boot";
  modeBadge.textContent = `${camText} // ${sectionText}`;
}

setCinematic(resolvedInitialBinaryState.cinematic);
applySceneMode(sceneByKey[initialSceneQuery] ? initialSceneQuery : resolvedInitialBinaryState.scene);
if (activePresetKey) {
  applyBinaryPreset(activePresetKey, {
    syncUrl: false,
    explicitState: {
      binaryDayHours,
      simulationDays: binarySimulationDays,
      latitudeDeg: observerLatitudeTravelDeg,
      longitudeDeg: observerLongitudeBaseDeg,
      multiplier: binaryTimeMultiplier,
      cinematic,
      surfacePitch: pendingInitialSurfacePitch,
      orbitView: pendingInitialOrbitView,
    },
  });
}
if (debugView) {
  modeBadge.textContent = "Debug Camera // Geometry";
}

function markInteraction() {
  lastInteraction = performance.now();
}

let surfacePointerId = null;
let surfacePointerLastX = 0;
let surfacePointerLastY = 0;

renderer.domElement.addEventListener("pointerdown", (e) => {
  markInteraction();
  activePresetKey = "";
  hud.setPreset("");
  if (cinematic) setCinematic(false);
  if (activeSceneKey === "binarySurface") {
    surfacePointerId = e.pointerId;
    surfacePointerLastX = e.clientX;
    surfacePointerLastY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
});
window.addEventListener("pointermove", (e) => {
  if (activeSceneKey !== "binarySurface" || surfacePointerId !== e.pointerId) return;
  const dx = e.clientX - surfacePointerLastX;
  const dy = e.clientY - surfacePointerLastY;
  surfacePointerLastX = e.clientX;
  surfacePointerLastY = e.clientY;
  const orbit = getSurfaceObserverState();
  surfaceQuatA.setFromAxisAngle(orbit.observerNormal, -dx * 0.0052);
  surfaceViewerForwardWorld.applyQuaternion(surfaceQuatA).normalize();
  const right = surfaceVecA.crossVectors(surfaceViewerForwardWorld, orbit.observerNormal);
  if (right.lengthSq() > 1e-8) {
    right.normalize();
    surfaceQuatB.setFromAxisAngle(right, -dy * 0.0032);
    surfaceViewerForwardWorld.applyQuaternion(surfaceQuatB).normalize();
  }
  surfaceViewerForwardWorld.copy(
    clampSurfaceForwardWorld(surfaceViewerForwardWorld, orbit.observerNormal),
  );
  updateSurfaceCamera(0);
  markInteraction();
});
function releaseSurfacePointer(e) {
  if (surfacePointerId !== e.pointerId) return;
  surfacePointerId = null;
}
window.addEventListener("pointerup", releaseSurfacePointer);
window.addEventListener("pointercancel", releaseSurfacePointer);
renderer.domElement.addEventListener("wheel", (e) => {
  if (activeSceneKey === "binarySurface") {
    activePresetKey = "";
    hud.setPreset("");
    surfaceViewDistance = THREE.MathUtils.clamp(
      surfaceViewDistance + e.deltaY * 0.008,
      surfaceViewDistanceMin,
      surfaceViewDistanceMax,
    );
    e.preventDefault();
  }
  markInteraction();
  if (cinematic) setCinematic(false);
}, { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "c") {
    setCinematic(!cinematic);
    syncSceneToUrl(activeSceneKey);
    markInteraction();
  }
  if (e.key.toLowerCase() === "d") {
    diagnosticsVisible = !diagnosticsVisible;
    diagnosticsPanel.setVisible(diagnosticsVisible);
    syncSceneToUrl(activeSceneKey);
  }
});
modeBadge.addEventListener("click", () => {
  setCinematic(!cinematic);
  syncSceneToUrl(activeSceneKey);
  markInteraction();
});
if (timeRateButton) {
  updateTimeRateLabel();
  timeRateButton.addEventListener("click", () => {
    activePresetKey = "";
    hud.setPreset("");
    const currentIndex = binaryTimeMultipliers.indexOf(binaryTimeMultiplier);
    const nextIndex = (currentIndex + 1) % binaryTimeMultipliers.length;
    binaryTimeMultiplier = binaryTimeMultipliers[nextIndex];
    updateTimeRateLabel();
    syncSceneToUrl(activeSceneKey);
    markInteraction();
  });
}
if (sceneChooser) {
  sceneChooser.addEventListener("change", (e) => {
    activePresetKey = "";
    applySceneMode(e.target.value, { pushHistory: true });
    markInteraction();
  });
}
if (presetChooser) {
  presetChooser.addEventListener("change", (e) => {
    const nextPreset = e.target.value;
    if (!nextPreset) {
      activePresetKey = "";
      syncSceneToUrl(activeSceneKey);
      return;
    }
    applyBinaryPreset(nextPreset, { pushHistory: true });
    markInteraction();
  });
}
window.addEventListener("popstate", () => {
  const nextState = resolveInitialBinaryState(readBinaryUrlState(new URLSearchParams(window.location.search)));
  activePresetKey = nextState.presetKey;
  binaryDayHours = nextState.binaryDayHours;
  binarySimulationDays = nextState.binarySimulationDays;
  binaryHourRateBase = nextState.binaryHourRateBase;
  applyObserverTravelCoordinates(nextState.observerLatitudeInputDeg, nextState.observerLongitudeInputDeg);
  binaryTimeMultiplier = nextState.binaryTimeMultiplier;
  diagnosticsVisible = nextState.diagnosticsVisible || debugView;
  applySceneMode(sceneByKey[nextState.scene] ? nextState.scene : "clocktower", { syncUrl: false });
  setCinematic(nextState.cinematic);
  if (activePresetKey) {
    applyBinaryPreset(activePresetKey, {
      syncUrl: false,
      explicitState: {
        binaryDayHours,
        simulationDays: binarySimulationDays,
        latitudeDeg: observerLatitudeTravelDeg,
        longitudeDeg: observerLongitudeBaseDeg,
        multiplier: binaryTimeMultiplier,
        cinematic: nextState.cinematic,
        surfacePitch: nextState.surfacePitch,
        orbitView: nextState.orbitView,
      },
    });
  }
  diagnosticsPanel.setVisible(diagnosticsVisible);
});

window.__demoState = { ok: true, frames: 0, lastTime: 0, debug: {} };
window.__canvas = canvas;
window.__setBinaryTime = (hours) => {
  activePresetKey = "";
  hud.setPreset("");
  setBinaryClockHours(hours, { preserveContinuity: true });
  if (activeSceneKey === "binarySurface") updateSurfaceCamera(cinematicMix);
};
window.__getBinaryTime = () => binaryDayHours;
window.__getBinarySimulationDays = () => binarySimulationDays;
window.__setObserverLatitude = (latDeg) => {
  if (!Number.isFinite(latDeg)) return;
  setObserverCoordinates(latDeg, observerLongitudeBaseDeg);
};
window.__getObserverLatitude = () => observerLatitudeDeg;
window.__setObserverLongitude = (lonDeg) => {
  if (!Number.isFinite(lonDeg)) return;
  setObserverCoordinates(observerLatitudeTravelDeg, lonDeg);
};
window.__getObserverLongitude = () => observerLongitudeDeg;
window.__setTimeMultiplier = (mult) => {
  activePresetKey = "";
  hud.setPreset("");
  setBinaryTimeMultiplier(mult);
};
window.__getTimeMultiplier = () => binaryTimeMultiplier;
window.__setBinaryHourRate = (rate) => {
  if (!Number.isFinite(rate)) return;
  binaryHourRateBase = rate;
};
window.__getBinaryHourRate = () => binaryHourRateBase;
window.__setClocktowerSection = (section) => {
  if (!Number.isFinite(section)) return;
  debugSectionOverride = THREE.MathUtils.clamp(Math.round(section), 0, sectionNames.length - 1);
};
window.__clearClocktowerSection = () => {
  debugSectionOverride = null;
};
window.__setAudioDrive = (next = {}) => {
  debugBeatOverride = Number.isFinite(next.beat) ? THREE.MathUtils.clamp(next.beat, 0, 1.5) : null;
  debugLevelOverride = Number.isFinite(next.level) ? THREE.MathUtils.clamp(next.level, 0, 1.5) : null;
};
window.__clearAudioDrive = () => {
  debugBeatOverride = null;
  debugLevelOverride = null;
};
window.__setScene = (sceneKey) => {
  activePresetKey = "";
  applySceneMode(sceneByKey[sceneKey] ? sceneKey : "clocktower");
};
window.__setPreset = (presetKey) => {
  applyBinaryPreset(presetKey, { syncUrl: false });
};
window.__setDiagnosticsVisible = (visible) => {
  diagnosticsVisible = Boolean(visible);
  diagnosticsPanel.setVisible(diagnosticsVisible);
};
window.__setOrbitView = (view = {}) => {
  const azimuth = Number.isFinite(view.azimuth) ? view.azimuth : 0;
  const defaultPolar = activeSceneKey === "binarySurface" ? 1.35 : Math.PI * 0.52;
  const polar = Number.isFinite(view.polar) ? view.polar : defaultPolar;
  const distance = Number.isFinite(view.distance) ? view.distance : 12;
  const tx = Number.isFinite(view.targetX) ? view.targetX : controls.target.x;
  const ty = Number.isFinite(view.targetY) ? view.targetY : controls.target.y;
  const tz = Number.isFinite(view.targetZ) ? view.targetZ : controls.target.z;
  const clampedDistance = THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance);
  const s = new THREE.Spherical(
    clampedDistance,
    THREE.MathUtils.clamp(polar, controls.minPolarAngle, controls.maxPolarAngle),
    azimuth,
  );
  const offset = new THREE.Vector3().setFromSpherical(s);
  if (activeSceneKey === "binarySurface") {
    activePresetKey = "";
    hud.setPreset("");
    surfaceViewDistance = clampedDistance;
    const orbit = getSurfaceObserverState();
    const localForward = localDirectionFromAngles(
      azimuth,
      THREE.MathUtils.clamp((Math.PI / 2) - polar, surfacePitchMin, surfacePitchMax),
    );
    surfaceViewerForwardWorld.copy(worldDirectionFromLocal(localForward, orbit));
    updateSurfaceCamera(0);
  } else {
    controls.target.set(tx, ty, tz);
    camera.position.copy(controls.target).add(offset);
    camera.up.set(0, 1, 0);
    controls.update();
  }
  return {
    azimuth: activeSceneKey === "binarySurface"
      ? Math.atan2(surfaceLookDir.x, surfaceLookDir.z)
      : controls.getAzimuthalAngle(),
    polar: activeSceneKey === "binarySurface"
      ? ((Math.PI / 2) - Math.asin(THREE.MathUtils.clamp(surfaceLookDir.y, -1, 1)))
      : controls.getPolarAngle(),
    distance: camera.position.distanceTo(controls.target),
    target: controls.target.toArray(),
  };
};
if (pendingInitialOrbitView && activeSceneKey === "binaryExternal") {
  window.__setOrbitView(pendingInitialOrbitView);
  pendingInitialOrbitView = null;
}

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

const binaryControllerCtx = {
  camera,
  controls,
  renderer,
  scene,
  composer,
  stars,
  nebulaShell,
  sky,
  binaryAmbient,
  binaryFill,
  binaryStarALight,
  binaryStarBLight,
  planetAtmosphere,
  starAGroup,
  starBGroup,
  planetPivot,
  planetGroup,
  cloudLayer,
  surfaceGround,
  surfaceSky,
  surfaceHaze,
  surfaceScatterBand,
  surfaceOcean,
  surfaceOceanGeometry,
  surfaceFarOcean,
  surfaceOceanBasePos,
  surfaceFarOceanGeometry,
  surfaceFarOceanBasePos,
  surfaceSunA,
  surfaceSunB,
  surfaceBeamA,
  surfaceBeamB,
  surfaceReflectionA,
  surfaceReflectionB,
  bloomPass,
  crtPass,
  timeIndicator,
  format24Hour,
  planetOrbitRadius,
  displaceWaterGeometry,
};

const clocktowerControllerCtx = {
  camera,
  controls,
  renderer,
  scene,
  composer,
  stars,
  sky,
  clocktowerAmbient,
  key,
  rim,
  moon,
  moonVisual,
  moonDisk,
  moonHalo,
  moonReflection,
  moonReflectionWide,
  moonDir,
  moonBase,
  shorelineZ,
  beamLight,
  beaconBeam,
  ocean,
  oceanGeometry,
  oceanBasePos,
  farOcean,
  farOceanGeometry,
  farOceanBasePos,
  strobeRig,
  strobeSpots,
  strobeTargets,
  strobeCones,
  ringGroup,
  city,
  cityCount,
  cityData,
  tmpColor,
  tmpDir,
  upAxis,
  bloomPieces,
  ground,
  shoreline,
  bloomPass,
  crtPass,
  sectionNames,
  usingBlenderTower,
  usingBlenderCity,
  blenderTowerRoot,
  towerGroup,
  minuteHand,
  hourHand,
  blenderMinuteHand,
  blenderHourHand,
  debugView,
  displaceWaterGeometry,
};

function tick() {
  const t = clock.getElapsedTime();
  const dt = lastTickTime > 0 ? Math.min(0.25, t - lastTickTime) : 0.016;
  lastTickTime = t;
  const audio = synth.getVisualState();
  const beat = debugBeatOverride ?? audio.beat;
  const level = debugLevelOverride ?? audio.level;
  const section = debugSectionOverride ?? (Math.floor(t / 11.5) % sectionNames.length);
  if (section !== currentSection) {
    currentSection = section;
    setCinematic(cinematic);
  }

  if (activeSceneKey !== "binarySurface") {
    controls.update();
  }
  const shouldCinematicBlend = cinematic;
  cinematicMix = THREE.MathUtils.lerp(cinematicMix, shouldCinematicBlend ? 1 : 0, 0.02);
  const dayAdvance = dt * binaryHourRateBase * binaryTimeMultiplier;
  binaryDayHours = THREE.MathUtils.euclideanModulo(
    binaryDayHours + dayAdvance,
    24,
  );
  binarySimulationDays += dayAdvance / 24;
  if (activeSceneKey === "binarySurface") {
    updateSurfaceCamera(cinematicMix);
  }

  let sceneDebug = {};
  if (activeSceneKey !== "clocktower") {
    sceneDebug = updateBinaryScene(binaryControllerCtx, {
      t,
      beat,
      level,
      cinematicMix,
      activeSceneKey,
      binaryDayHours,
      binarySimulationDays,
      observerLatitudeTravelDeg,
      observerLongitudeBaseDeg,
      observerLatitudeDeg,
      observerLongitudeDeg,
      surfaceViewerForwardWorld,
      debugView,
    });
    orbitSchematic.render(activeSceneKey === "binarySurface" ? sceneDebug.schematic : null);
    viewerSchematic.render(activeSceneKey === "binarySurface" ? sceneDebug.viewerInset : null);
  } else {
    clocktowerControllerCtx.usingBlenderTower = usingBlenderTower;
    clocktowerControllerCtx.usingBlenderCity = usingBlenderCity;
    clocktowerControllerCtx.blenderMinuteHand = blenderMinuteHand;
    clocktowerControllerCtx.blenderHourHand = blenderHourHand;
    sceneDebug = updateClocktowerScene(clocktowerControllerCtx, {
      t,
      beat,
      level,
      section,
      cinematicMix,
    });
    orbitSchematic.render(null);
    viewerSchematic.render(null);
  }

  diagnosticsPanel.render(diagnosticsVisible ? [
    `scene ${sceneLabels[activeSceneKey] || activeSceneKey}`,
    activePresetKey ? `preset ${activePresetKey}` : "preset manual",
    `camera ${cinematic ? "cinematic" : "manual"}`,
    `clock ${format24Hour(binaryDayHours)} @ ${binaryTimeMultiplier}x`,
    `lat ${observerLatitudeDeg.toFixed(1)} lon ${observerLongitudeDeg.toFixed(1)}`,
    sceneDebug.primaryAltitudeDeg !== undefined
      ? `sun A alt ${sceneDebug.primaryAltitudeDeg.toFixed(1)} az ${sceneDebug.primaryAzimuthDeg.toFixed(1)}`
      : "sun A alt --.- az --.-",
    sceneDebug.secondaryAltitudeDeg !== undefined
      ? `sun B alt ${sceneDebug.secondaryAltitudeDeg.toFixed(1)} az ${sceneDebug.secondaryAzimuthDeg.toFixed(1)}`
      : "sun B alt --.- az --.-",
    sceneDebug.lighting
      ? `airmass A ${sceneDebug.lighting.primaryAirMass.toFixed(2)} B ${sceneDebug.lighting.secondaryAirMass.toFixed(2)}`
      : "airmass A --.-- B --.--",
    sceneDebug.lighting
      ? `directLux A ${sceneDebug.lighting.primaryDirectLux.toFixed(0)} B ${sceneDebug.lighting.secondaryDirectLux.toFixed(0)}`
      : "directLux A ---- B ----",
    sceneDebug.lighting
      ? `discLum A ${sceneDebug.lighting.primaryDiscLuminance.toFixed(2)} B ${sceneDebug.lighting.secondaryDiscLuminance.toFixed(2)}`
      : "discLum A --.-- B --.--",
    sceneDebug.lighting
      ? `reflect A ${sceneDebug.lighting.primaryReflectionGain.toFixed(2)} glitter ${sceneDebug.lighting.waterGlitterBlend.toFixed(2)}`
      : "reflect A --.-- glitter --.--",
    sceneDebug.lighting
      ? `exposure ${sceneDebug.lighting.exposure.toFixed(3)} haze ${sceneDebug.lighting.hazeFactor.toFixed(3)}`
      : "exposure --.--- haze --.---",
  ] : []);

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
    sectionOverride: debugSectionOverride,
    beatOverride: debugBeatOverride,
    levelOverride: debugLevelOverride,
    cinematicMix: Number(cinematicMix.toFixed(3)),
    blenderTower: usingBlenderTower,
    blenderCity: usingBlenderCity,
    debugView,
    diagnosticsVisible,
    activePresetKey,
    cinematic,
    binaryDayHours: Number(binaryDayHours.toFixed(4)),
    binaryHourRateBase: Number(binaryHourRateBase.toFixed(4)),
    timeMultiplier: binaryTimeMultiplier,
    binarySimulationDays: Number(binarySimulationDays.toFixed(4)),
    observerLatitudeTravelDeg: Number(observerLatitudeTravelDeg.toFixed(2)),
    observerLongitudeBaseDeg: Number(observerLongitudeBaseDeg.toFixed(2)),
    observerLatitudeDeg: Number(observerLatitudeDeg.toFixed(2)),
    observerLongitudeDeg: Number(observerLongitudeDeg.toFixed(2)),
    surfaceLookLocal: [
      Number(surfaceLookDir.x.toFixed(3)),
      Number(surfaceLookDir.y.toFixed(3)),
      Number(surfaceLookDir.z.toFixed(3)),
    ],
    surfaceForwardWorld: [
      Number(surfaceViewerForwardWorld.x.toFixed(3)),
      Number(surfaceViewerForwardWorld.y.toFixed(3)),
      Number(surfaceViewerForwardWorld.z.toFixed(3)),
    ],
    cameraPos: [Number(camera.position.x.toFixed(3)), Number(camera.position.y.toFixed(3)), Number(camera.position.z.toFixed(3))],
    cameraTarget: [Number(controls.target.x.toFixed(3)), Number(controls.target.y.toFixed(3)), Number(controls.target.z.toFixed(3))],
    ...sceneDebug,
  };

  requestAnimationFrame(tick);
}

tick();
