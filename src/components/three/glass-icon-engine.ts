import * as THREE from "three";

const ORANGE_LO = 0xff5c16;

/** Procedural equirect env (warm key + cool spec ping + orange bounce), PMREM'd for the glass material. */
function makeEnvTexture(renderer: THREE.WebGLRenderer): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#2A2018");
  g.addColorStop(0.5, "#141210");
  g.addColorStop(1, "#060606");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  function blob(cx: number, cy: number, r: number, col: string, a: number) {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a;
    ctx.fillStyle = rg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
  blob(110, 60, 90, "#FFD9BF", 0.95);
  blob(400, 50, 70, "#FFFFFF", 0.9);
  blob(300, 190, 140, "#FF5C16", 0.8);
  blob(60, 210, 100, "#B04A12", 0.6);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

/** Procedural bright grain, used as the glass's roughness map so it isn't a perfect mirror. */
function makeNoiseTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.random() * 105;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

export function glassMaterial(env: THREE.Texture, noise: THREE.Texture, tint = 0xff8a3e) {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0,
    roughness: 0.11,
    roughnessMap: noise,
    transmission: 0.86,
    ior: 1.45,
    transparent: true,
    opacity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    envMap: env,
    envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  });
}

/** Small solid-orange inner elements (eyes, links) for contrast against the glass. */
export function coreMaterial(env: THREE.Texture, tint = ORANGE_LO) {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0.1,
    roughness: 0.3,
    envMap: env,
    envMapIntensity: 1.1,
    emissive: tint,
    emissiveIntensity: 0.35,
  });
}

export type GlassScene = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  env: THREE.Texture;
  noise: THREE.Texture;
  dispose: () => void;
};

/** Shared renderer/camera/lighting/environment rig for a single small glass icon. */
export function createGlassScene(canvas: HTMLCanvasElement, size: number): GlassScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 0, 7.4);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x33261c, 1.4));

  const key = new THREE.DirectionalLight(0xfff2e5, 2.4);
  key.position.set(3, 5, 6);
  scene.add(key);

  const rim = new THREE.PointLight(ORANGE_LO, 30, 20);
  rim.position.set(-4, -2.5, -3);
  scene.add(rim);

  const fill = new THREE.PointLight(0xffb27a, 8, 20);
  fill.position.set(4, -3, 4);
  scene.add(fill);

  const env = makeEnvTexture(renderer);
  const noise = makeNoiseTexture();

  return {
    renderer,
    camera,
    scene,
    env,
    noise,
    dispose() {
      env.dispose();
      noise.dispose();
      renderer.dispose();
    },
  };
}

export function disposeGroup(group: THREE.Group) {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const material = obj.material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material.dispose();
      }
    }
  });
}
