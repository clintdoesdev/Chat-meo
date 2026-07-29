import * as THREE from "three";

/** Shared renderer/camera/lighting rig for a small transparent decorative 3D icon. */
export function createIconRenderer(canvas: HTMLCanvasElement, size: number) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 4);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffdcc2, 0.85));

  const key = new THREE.DirectionalLight(0xfff2e6, 1.6);
  key.position.set(2.5, 3, 3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffe8d0, 0.6);
  fill.position.set(-1.5, -2, 2.5);
  scene.add(fill);

  const rim = new THREE.PointLight(0xff8a3c, 0.9);
  rim.position.set(-2, -1.5, 2);
  scene.add(rim);

  return { renderer, camera, scene };
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
