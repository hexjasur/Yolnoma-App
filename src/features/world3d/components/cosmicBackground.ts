import * as THREE from 'three';

const STAR_COLORS = ['#d9ecff', '#fff4d5', '#b7d5ff', '#ffd8b0'];

export type CosmicBackground = {
  group: THREE.Group;
  update: (camera: THREE.Camera) => void;
  dispose: () => void;
};

type StarLayerOptions = {
  count: number;
  radius: number;
  minHeight: number;
  maxHeight: number;
  size: number;
  parallax: number;
  opacity: number;
};

function createStarLayer(options: StarLayerOptions) {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: options.opacity,
    fog: false,
    vertexColors: true,
  });
  const stars = new THREE.InstancedMesh(geometry, material, options.count);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  for (let index = 0; index < options.count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * options.radius;
    const position = new THREE.Vector3(
      Math.cos(angle) * distance,
      options.minHeight + Math.random() * (options.maxHeight - options.minHeight),
      Math.sin(angle) * distance,
    );
    const size = options.size * (0.45 + Math.random() * 1.35);
    matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(size, size, size));
    stars.setMatrixAt(index, matrix);
    color.set(STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]);
    stars.setColorAt(index, color);
  }

  stars.instanceMatrix.needsUpdate = true;
  if (stars.instanceColor) stars.instanceColor.needsUpdate = true;
  stars.userData.parallax = options.parallax;
  return stars;
}

function createHaloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const gradient = context.createRadialGradient(128, 80, 4, 128, 80, 120);
  gradient.addColorStop(0, 'rgba(222, 190, 255, 0.2)');
  gradient.addColorStop(0.25, 'rgba(152, 174, 255, 0.12)');
  gradient.addColorStop(0.7, 'rgba(91, 119, 198, 0.035)');
  gradient.addColorStop(1, 'rgba(45, 64, 120, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGalaxy() {
  const galaxy = new THREE.Group();
  galaxy.position.set(-34, 30, -66);
  galaxy.rotation.set(-0.18, 0.22, -0.32);
  galaxy.userData.parallax = 0.035;

  const haloTexture = createHaloTexture();
  if (haloTexture) {
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 9),
      new THREE.MeshBasicMaterial({
        map: haloTexture,
        color: '#b6a8ff',
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    halo.userData.cosmicTexture = haloTexture;
    galaxy.add(halo);
  }

  const dustGeometry = new THREE.IcosahedronGeometry(1, 0);
  const dustMaterial = new THREE.MeshBasicMaterial({
    color: '#eadbff',
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    fog: false,
  });
  const dust = new THREE.InstancedMesh(dustGeometry, dustMaterial, 96);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  for (let index = 0; index < 96; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.pow(Math.random(), 0.7) * 5.8;
    const position = new THREE.Vector3(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * (1.2 + radius * 0.16),
      Math.sin(angle) * radius * 0.34,
    );
    const size = 0.018 + Math.random() * 0.055;
    matrix.compose(position, new THREE.Quaternion(), new THREE.Vector3(size, size, size));
    dust.setMatrixAt(index, matrix);
    color.set(index % 3 === 0 ? '#ffd8b7' : index % 2 === 0 ? '#c7d6ff' : '#f0d8ff');
    dust.setColorAt(index, color);
  }
  dust.instanceMatrix.needsUpdate = true;
  if (dust.instanceColor) dust.instanceColor.needsUpdate = true;
  galaxy.add(dust);
  return galaxy;
}

export function createCosmicBackground(): CosmicBackground {
  const group = new THREE.Group();
  const nearStars = createStarLayer({
    count: 240,
    radius: 72,
    minHeight: 7,
    maxHeight: 48,
    size: 0.045,
    parallax: 0.018,
    opacity: 0.82,
  });
  const farStars = createStarLayer({
    count: 180,
    radius: 96,
    minHeight: 12,
    maxHeight: 58,
    size: 0.032,
    parallax: 0.008,
    opacity: 0.52,
  });
  const galaxy = createGalaxy();
  group.add(farStars, galaxy, nearStars);

  const previousCameraPosition = new THREE.Vector3();
  let hasPreviousCameraPosition = false;
  const update = (camera: THREE.Camera) => {
    if (!hasPreviousCameraPosition) {
      previousCameraPosition.copy(camera.position);
      hasPreviousCameraPosition = true;
      return;
    }
    const cameraDelta = camera.position.clone().sub(previousCameraPosition);
    group.children.forEach((layer) => {
      const parallax = Number(layer.userData.parallax ?? 0);
      layer.position.addScaledVector(cameraDelta, parallax);
      if (layer === galaxy) layer.rotation.y += 0.00035;
    });
    previousCameraPosition.copy(camera.position);
  };

  const dispose = () => {
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
      const texture = object.userData.cosmicTexture as THREE.Texture | undefined;
      texture?.dispose();
    });
  };

  return { group, update, dispose };
}
