import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function createSkyGradientTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 512;

  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#9fd6ff");
  gradient.addColorStop(0.45, "#3a78b7");
  gradient.addColorStop(1, "#04101f");

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createScene(mountNode) {
  const scene = new THREE.Scene();
  scene.background = createSkyGradientTexture();
  scene.fog = new THREE.Fog("#89bbe8", 60, 220);

  const camera = new THREE.PerspectiveCamera(
    50,
    mountNode.clientWidth / mountNode.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 14, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
  renderer.shadowMap.enabled = true;
  mountNode.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.screenSpacePanning = false;
  controls.panSpeed = 1.8;
  controls.zoomSpeed = 1.2;
  controls.zoomToCursor = true;
  controls.rotateSpeed = 0.9;
  controls.minDistance = 4;
  controls.maxDistance = 220;
  controls.target.set(0, 2, 0);
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();

  scene.add(new THREE.HemisphereLight("#b4deff", "#1d2a36", 1.5));

  const sun = new THREE.DirectionalLight("#fff3dc", 1.3);
  sun.position.set(22, 28, 18);
  sun.castShadow = true;
  scene.add(sun);

  const gridGroup = new THREE.Group();
  scene.add(gridGroup);

  function resize() {
    camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
  }

  window.addEventListener("resize", resize);

  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  return { gridGroup, controls, renderer, camera };
}

export function replaceGrid(group, mesh) {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1];
    group.remove(child);
    disposeObject3D(child);
  }
  group.add(mesh);
}

function disposeObject3D(object3D) {
  for (const child of object3D.children ?? []) {
    disposeObject3D(child);
  }

  object3D.geometry?.dispose?.();
  if (Array.isArray(object3D.material)) {
    for (const material of object3D.material) {
      material?.dispose?.();
    }
  } else {
    object3D.material?.dispose?.();
  }
}
