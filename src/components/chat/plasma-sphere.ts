import * as THREE from "three";
import { PLASMA_SPHERE_CONFIG } from "./plasma-sphere-config";

const NOISE_FUNCTIONS = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  float fbm(vec3 p) {
    float total = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 3; i++) {
      total += snoise(p * frequency) * amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return total;
  }
`;

const SHELL_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SHELL_FRAGMENT_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    float fresnel = pow(1.0 - dot(normalize(vNormal), normalize(vViewPosition)), 2.5);
    gl_FragColor = vec4(uColor, fresnel * uOpacity);
  }
`;

const PLASMA_VERTEX_SHADER = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PLASMA_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uScale;
  uniform float uBrightness;
  uniform float uThreshold;
  uniform vec3 uColorVoid;
  uniform vec3 uColorDeep;
  uniform vec3 uColorMid;
  uniform vec3 uColorBright;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  ${NOISE_FUNCTIONS}

  void main() {
    vec3 p = vPosition * uScale;

    vec3 q = vec3(
      fbm(p + vec3(0.0, uTime * 0.05, 0.0)),
      fbm(p + vec3(5.2, 1.3, 2.8) + uTime * 0.05),
      fbm(p + vec3(2.2, 8.4, 0.5) - uTime * 0.02)
    );

    float density = fbm(p + 2.0 * q);
    float t = (density + 0.4) * 0.8;
    float alpha = smoothstep(uThreshold + 0.04, 0.72, t);

    vec3 color = mix(uColorVoid, uColorDeep, smoothstep(uThreshold, 0.38, t));
    color = mix(color, uColorMid, smoothstep(uThreshold, 0.52, t));
    color = mix(color, uColorBright, smoothstep(0.5, 0.82, t));
    color = mix(color, vec3(1.0), smoothstep(0.82, 1.0, t));

    float facing = dot(normalize(vNormal), normalize(vViewPosition));
    float depthFactor = (facing + 1.0) * 0.5;
    float finalAlpha = alpha * (0.08 + 0.92 * depthFactor);

    gl_FragColor = vec4(color * uBrightness, finalAlpha);
  }
`;

const PARTICLE_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uSizeMultiplier;
  uniform float uAlphaBase;
  uniform float uAlphaRange;
  attribute float aSize;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 0.2 + pos.x) * 0.02;
    pos.x += cos(uTime * 0.15 + pos.z) * 0.02;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float baseSize = (10.0 * aSize + 6.0) * uSizeMultiplier;
    gl_PointSize = baseSize * (1.0 / -mvPosition.z);
    vAlpha = uAlphaBase + uAlphaRange * sin(uTime + aSize * 10.0);
  }
`;

const PARTICLE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uSoftness;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float nd = dist * 2.0;
    float core = exp(-nd * nd * (14.0 / uSoftness));
    float halo = exp(-nd * nd * (4.5 / uSoftness));
    float glow = core * 0.28 + halo * 0.72;
    glow = pow(glow, 1.35);

    vec3 color = mix(uColor, vec3(1.0), core * 0.4);
    float alpha = glow * vAlpha;

    gl_FragColor = vec4(color, alpha);
  }
`;

type PlasmaSphereOptions = {
  canvasSize?: number;
  orbSize?: number;
  glowLayer?: boolean;
};

type PlasmaSphereScene = {
  dispose: () => void;
};

function createParticleMaterial(
  config: typeof PLASMA_SPHERE_CONFIG,
  options: {
    sizeMultiplier: number;
    alphaBase: number;
    alphaRange: number;
    softness: number;
    color?: number;
  },
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(options.color ?? config.colorParticle) },
      uSizeMultiplier: { value: options.sizeMultiplier },
      uAlphaBase: { value: options.alphaBase },
      uAlphaRange: { value: options.alphaRange },
      uSoftness: { value: options.softness },
    },
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });
}

export function createPlasmaSphere(
  container: HTMLDivElement,
  size: number,
  options: PlasmaSphereOptions = {},
): PlasmaSphereScene {
  const config = PLASMA_SPHERE_CONFIG;
  const canvasSize = options.canvasSize ?? size;
  const orbSize = options.orbSize ?? size;
  const isGlowLayer = options.glowLayer ?? false;
  const sceneScale = orbSize / canvasSize;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  const scene = new THREE.Scene();
  if (!isGlowLayer) {
    scene.background = null;
  }

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.z = config.cameraZ;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(canvasSize, canvasSize);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  container.appendChild(renderer.domElement);

  const mainGroup = new THREE.Group();
  mainGroup.scale.setScalar(sceneScale);
  scene.add(mainGroup);

  const pointLight = new THREE.PointLight(0x0088ff, 2.0, 10);
  mainGroup.add(pointLight);

  const shellGeo = new THREE.SphereGeometry(1.0, 48, 48);

  const shellFrontMat = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX_SHADER,
    fragmentShader: SHELL_FRAGMENT_SHADER,
    uniforms: {
      uColor: { value: new THREE.Color(config.shellColor) },
      uOpacity: {
        value: isGlowLayer ? config.shellGlowOpacity : config.shellOpacity,
      },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    depthWrite: false,
  });

  mainGroup.add(new THREE.Mesh(shellGeo, shellFrontMat));

  const plasmaMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: config.plasmaScale },
      uBrightness: { value: config.plasmaBrightness },
      uThreshold: { value: config.voidThreshold },
      uColorVoid: { value: new THREE.Color(config.colorVoid) },
      uColorDeep: { value: new THREE.Color(config.colorDeep) },
      uColorMid: { value: new THREE.Color(config.colorMid) },
      uColorBright: { value: new THREE.Color(config.colorBright) },
    },
    vertexShader: PLASMA_VERTEX_SHADER,
    fragmentShader: PLASMA_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const plasmaMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.998, 64, 64),
    plasmaMat,
  );
  mainGroup.add(plasmaMesh);

  const particleCount = 300;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const sphereRadius = 0.95;

  for (let i = 0; i < particleCount; i++) {
    const r = sphereRadius * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = Math.random();
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const particleMat = createParticleMaterial(config, {
    sizeMultiplier: 1.0,
    alphaBase: 0.22,
    alphaRange: 0.14,
    softness: 1.0,
  });

  const particleGlowMat = createParticleMaterial(config, {
    sizeMultiplier: 2.1,
    alphaBase: 0.1,
    alphaRange: 0.06,
    softness: 2.4,
    color: config.colorBright,
  });

  mainGroup.add(new THREE.Points(particleGeo, particleMat));
  mainGroup.add(new THREE.Points(particleGeo, particleGlowMat));

  const timer = new THREE.Timer();
  let frameId = 0;

  function animate() {
    frameId = requestAnimationFrame(animate);
    timer.update();
    const elapsed = timer.getElapsed();
    const scaledTime = elapsed * config.timeScale;

    plasmaMat.uniforms.uTime.value = scaledTime;
    particleMat.uniforms.uTime.value = elapsed;
    particleGlowMat.uniforms.uTime.value = elapsed;
    plasmaMesh.rotation.y = elapsed * 0.08;
    mainGroup.rotation.x += config.rotationSpeedX;
    mainGroup.rotation.y += config.rotationSpeedY;

    renderer.render(scene, camera);
  }

  animate();

  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [
    shellGeo,
    shellFrontMat,
    plasmaMesh.geometry,
    plasmaMat,
    particleGeo,
    particleMat,
    particleGlowMat,
  ];

  return {
    dispose() {
      cancelAnimationFrame(frameId);
      for (const item of disposables) {
        item.dispose();
      }
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
  };
}
