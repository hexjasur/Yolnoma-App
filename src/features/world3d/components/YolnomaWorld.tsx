import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TOOL_CATALOG } from '@/config/toolCatalog';

type WorldNode = { id: string; title: string; subtitle: string; color: string; position: [number, number, number] };

const NODE_COLORS = ['#fbbf24', '#f0abfc', '#93c5fd', '#fdba74', '#fda4af', '#67e8f9', '#d8b4fe', '#a7f3d0', '#fca5a5', '#fde68a'];
const WORLD_TOOLS = TOOL_CATALOG.filter((tool) => tool.id !== 'world-3d');
const WORLD_NODES: WorldNode[] = WORLD_TOOLS.map((tool, index) => {
  const angle = (index / WORLD_TOOLS.length) * Math.PI * 2 - Math.PI / 2;
  return { id: tool.id, title: tool.label.toUpperCase(), subtitle: 'Open workspace', color: NODE_COLORS[index % NODE_COLORS.length], position: [Math.cos(angle) * 12, 1.1, Math.sin(angle) * 12] as [number, number, number] };
});

function createTextSprite(text: string, color: string, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 160;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '700 34px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.shadowColor = color;
  context.shadowBlur = 18;
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, 62);
  context.shadowBlur = 0;
  context.font = '500 22px Inter, Arial, sans-serif';
  context.fillStyle = 'rgba(255,255,255,.62)';
  context.fillText(text === 'YOLNOMA TREE' ? 'The living desktop' : '', canvas.width / 2, 108);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.2 * scale, 0.8 * scale, 1);
  return sprite;
}

function makeBranch(start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material) {
  const direction = end.clone().sub(start);
  const geometry = new THREE.CylinderGeometry(radius * 0.75, radius, direction.length(), 8);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  return mesh;
}

function createGrassField() {
  const field = new THREE.Group();
  const grassMaterials = [
    new THREE.MeshStandardMaterial({ color: '#2d7048', roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: '#4f9560', roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: '#77ae62', roughness: 1 }),
  ];
  const bladeGeometry = new THREE.ConeGeometry(0.055, 0.48, 3);
  for (let index = 0; index < 900; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2.4 + Math.sqrt(Math.random()) * 12;
    const blade = new THREE.Mesh(bladeGeometry, grassMaterials[index % grassMaterials.length]);
    blade.position.set(Math.cos(angle) * radius, 0.18, Math.sin(angle) * radius);
    blade.scale.set(0.7 + Math.random() * 0.8, 0.7 + Math.random() * 0.9, 0.7 + Math.random() * 0.8);
    blade.rotation.y = Math.random() * Math.PI;
    blade.userData.windPhase = Math.random() * Math.PI * 2;
    blade.userData.windStrength = 0.045 + Math.random() * 0.08;
    blade.castShadow = true;
    field.add(blade);
  }
  return field;
}

function createMoon() {
  const moon = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 32), new THREE.MeshStandardMaterial({ color: '#dce7f5', emissive: '#9db7dd', emissiveIntensity: 0.7, roughness: 0.8 }));
  sphere.position.set(-11, 15, -18);
  moon.add(sphere);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(3, 32, 32), new THREE.MeshBasicMaterial({ color: '#a9c9f5', transparent: true, opacity: 0.075, depthWrite: false }));
  halo.position.copy(sphere.position);
  moon.add(halo);
  return moon;
}

function createCampfire() {
  const group = new THREE.Group();
  group.position.set(0, 0, 2.4);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#4a5250', roughness: 1 });
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), stoneMaterial);
    stone.position.set(Math.cos(angle) * 0.8, 0.25, Math.sin(angle) * 0.8);
    stone.scale.set(1.25, 0.72, 0.95);
    stone.castShadow = true;
    group.add(stone);
  }
  const logMaterial = new THREE.MeshStandardMaterial({ color: '#6a3822', roughness: 0.95 });
  for (let index = 0; index < 3; index += 1) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.15, 10), logMaterial);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = index * 1.05;
    log.position.y = 0.48 + index * 0.06;
    log.castShadow = true;
    group.add(log);
  }
  const flameMaterial = new THREE.MeshBasicMaterial({ color: '#ff9f43', transparent: true, opacity: 0.85 });
  const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 2), flameMaterial);
  flame.position.y = 1.15;
  flame.scale.set(0.7, 1.45, 0.7);
  flame.userData.isFlame = true;
  group.add(flame);
  const innerFlame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.95 }));
  innerFlame.position.y = 1.08;
  innerFlame.scale.y = 1.6;
  innerFlame.userData.isFlame = true;
  group.add(innerFlame);
  const light = new THREE.PointLight('#ff8a3d', 3.2, 8, 2);
  light.position.y = 1.25;
  group.add(light);
  const embers = new THREE.Group();
  for (let index = 0; index < 12; index += 1) {
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffcf70' }));
    ember.position.set((Math.random() - 0.5) * 0.7, 0.8 + Math.random() * 2.2, (Math.random() - 0.5) * 0.7);
    ember.userData.emberPhase = Math.random() * Math.PI * 2;
    embers.add(ember);
  }
  group.add(embers);
  return group;
}

function createTree() {
  const group = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: '#543b2a', roughness: 0.92 });
  const leafMaterials = [
    new THREE.MeshStandardMaterial({ color: '#397b58', roughness: 0.85, emissive: '#0b2519', emissiveIntensity: 0.35 }),
    new THREE.MeshStandardMaterial({ color: '#5ca66d', roughness: 0.8, emissive: '#102d1a', emissiveIntensity: 0.28 }),
    new THREE.MeshStandardMaterial({ color: '#86bd70', roughness: 0.85, emissive: '#203a1a', emissiveIntensity: 0.2 }),
  ];
  const trunkEnd = new THREE.Vector3(0, 4.6, 0);
  group.add(makeBranch(new THREE.Vector3(0, 0, 0), trunkEnd, 0.65, bark));
  // Flared roots make the tree feel planted instead of floating above the island.
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const rootEnd = new THREE.Vector3(Math.cos(angle) * 1.7, 0.08, Math.sin(angle) * 1.7);
    group.add(makeBranch(new THREE.Vector3(0, 0.18, 0), rootEnd, 0.2, bark));
  }
  const branchEnds = [
    new THREE.Vector3(-2.8, 5.2, 0.2), new THREE.Vector3(2.6, 5.4, -0.3),
    new THREE.Vector3(-1.5, 7.2, 0), new THREE.Vector3(1.5, 7.4, 0.3),
    new THREE.Vector3(0, 9, 0), new THREE.Vector3(-3.7, 3.7, 0.5), new THREE.Vector3(3.5, 3.9, -0.4),
  ];
  branchEnds.forEach((end, index) => {
    const anchor = index < 5 ? new THREE.Vector3(0, 3.4 + index * 0.9, 0) : new THREE.Vector3(0, 2.5, 0);
    group.add(makeBranch(anchor, end, index < 5 ? 0.25 : 0.32, bark));
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(index === 4 ? 1.75 : 1.35, 18, 12), leafMaterials[index % leafMaterials.length]);
    cloud.position.copy(end).add(new THREE.Vector3(0, 0.75, 0));
    cloud.scale.set(1.25, 0.95, 1.05);
    cloud.castShadow = true;
    cloud.userData.isLeaf = true;
    cloud.userData.windAngle = 0;
    cloud.userData.windVelocity = 0;
    group.add(cloud);
    const accent = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshStandardMaterial({ color: index % 2 ? '#f4c6a5' : '#f6df9b', emissive: '#7a4935', emissiveIntensity: 0.5 }));
    accent.position.copy(end).add(new THREE.Vector3(index % 2 ? 0.6 : -0.6, 0.7, 0.2));
    accent.castShadow = true;
    accent.userData.isBlossom = true;
    group.add(accent);
  });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 14), leafMaterials[1]);
  crown.position.set(0, 9.8, 0);
  crown.scale.set(1.3, 1.05, 1.2);
  crown.castShadow = true;
  crown.userData.isLeaf = true;
  crown.userData.windAngle = 0;
  crown.userData.windVelocity = 0;
  group.add(crown);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.018, 8, 64), new THREE.MeshBasicMaterial({ color: '#f5c77a', transparent: true, opacity: 0.28 }));
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 9.8, 0);
  group.add(halo);
  const label = createTextSprite('YOLNOMA TREE', '#f5c77a', 0.9);
  label.position.set(0, 12, 0);
  group.add(label);
  return group;
}

function createNode(node: WorldNode) {
  const group = new THREE.Group();
  group.position.set(...node.position);
  const color = new THREE.Color(node.color);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 0.3, 32), new THREE.MeshStandardMaterial({ color: '#1b2830', metalness: 0.65, roughness: 0.35, emissive: color, emissiveIntensity: 0.13 }));
  pedestal.position.y = 0.15;
  pedestal.castShadow = true;
  group.add(pedestal);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 2), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.25 }));
  orb.position.y = 1.15;
  orb.castShadow = true;
  orb.userData.nodeId = node.id;
  group.add(orb);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.025, 8, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.5;
  group.add(ring);
  const label = createTextSprite(node.title, node.color, 0.72);
  label.position.y = 2.35;
  group.add(label);
  const subtitle = createTextSprite(node.subtitle, '#ffffff', 0.43);
  subtitle.position.y = 1.95;
  subtitle.material.opacity = 0.62;
  group.add(subtitle);
  group.userData.nodeId = node.id;
  return group;
}

export default function YolnomaWorld({ onSelect }: { onSelect?: (nodeId: string) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07131d');
    scene.fog = new THREE.FogExp2('#07131d', 0.018);
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(15, 9.5, 18);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 2.25, 0);
    controls.minDistance = 9;
    controls.maxDistance = 34;
    controls.maxPolarAngle = Math.PI / 2.05;

    scene.add(new THREE.HemisphereLight('#b7e3ff', '#17251d', 1.4));
    const moonLight = new THREE.DirectionalLight('#a8c7ff', 2.2);
    moonLight.position.set(-10, 18, 8);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    moonLight.shadow.camera.left = -22;
    moonLight.shadow.camera.right = 22;
    moonLight.shadow.camera.top = 22;
    moonLight.shadow.camera.bottom = -22;
    scene.add(moonLight);

    const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#b9dcff', size: 0.08, transparent: true, opacity: 0.8 }));
    const starPositions = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i += 1) { starPositions[i * 3] = (Math.random() - 0.5) * 100; starPositions[i * 3 + 1] = Math.random() * 55 + 4; starPositions[i * 3 + 2] = (Math.random() - 0.5) * 100; }
    stars.geometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    scene.add(stars);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 96), new THREE.MeshStandardMaterial({ color: '#0d211d', roughness: 0.98, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const path = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.15, 64), new THREE.MeshBasicMaterial({ color: '#b58a55', transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.015;
    scene.add(path);
    const grass = createGrassField();
    scene.add(grass);
    scene.add(createMoon());
    const campfire = createCampfire();
    scene.add(campfire);

    const tree = createTree();
    tree.scale.setScalar(0.78);
    scene.add(tree);
    WORLD_NODES.forEach((node) => scene.add(createNode(node)));

    const fireflies = new THREE.Group();
    const fireflyMaterial = new THREE.MeshBasicMaterial({ color: '#d9ff9a', transparent: true, opacity: 0.88 });
    for (let i = 0; i < 42; i += 1) { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), fireflyMaterial); dot.position.set((Math.random() - 0.5) * 22, 0.5 + Math.random() * 7, (Math.random() - 0.5) * 22); dot.userData.phase = Math.random() * Math.PI * 2; fireflies.add(dot); }
    scene.add(fireflies);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const click = (event: MouseEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(scene.children, true).find((item) => item.object.userData.nodeId); if (hit?.object.userData.nodeId) onSelectRef.current?.(hit.object.userData.nodeId); };
    renderer.domElement.addEventListener('click', click);
    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      controls.update();
      tree.children.filter((child) => child.userData.isLeaf).forEach((leaf, index) => {
        const gust = Math.sin(elapsed * 0.7 + index * 0.8) * 0.07 + Math.sin(elapsed * 1.8 + index) * 0.025;
        leaf.userData.windVelocity += (gust - leaf.userData.windAngle) * 0.018;
        leaf.userData.windVelocity *= 0.92;
        leaf.userData.windAngle += leaf.userData.windVelocity;
        leaf.rotation.z = leaf.userData.windAngle;
        leaf.rotation.x = leaf.userData.windAngle * 0.65;
      });
      grass.children.forEach((blade) => {
        const gust = Math.sin(elapsed * 1.05 + blade.userData.windPhase) * blade.userData.windStrength + Math.sin(elapsed * 2.3 + blade.userData.windPhase) * 0.018;
        blade.userData.windVelocity = (blade.userData.windVelocity ?? 0) + (gust - (blade.userData.windAngle ?? 0)) * 0.045;
        blade.userData.windVelocity *= 0.86;
        blade.userData.windAngle = (blade.userData.windAngle ?? 0) + blade.userData.windVelocity;
        blade.rotation.z = blade.userData.windAngle;
        blade.rotation.x = blade.userData.windAngle * 0.35;
      });
      campfire.children.filter((child) => child.userData.isFlame).forEach((flame, index) => {
        flame.rotation.z = Math.sin(elapsed * 4 + index) * 0.12;
        flame.scale.y = (index ? 1.6 : 1.45) + Math.sin(elapsed * 5 + index) * 0.16;
      });
      campfire.children.filter((child) => child.type === 'Group').forEach((emberGroup) => emberGroup.children.forEach((ember) => {
        ember.position.y += Math.sin(elapsed * 1.8 + ember.userData.emberPhase) * 0.002;
      }));
      fireflies.children.forEach((dot) => {
        dot.position.y += Math.sin(elapsed * 1.2 + dot.userData.phase) * 0.0015;
        ((dot as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.45 + (Math.sin(elapsed * 2 + dot.userData.phase) + 1) * 0.25;
      });
      stars.rotation.y = elapsed * 0.002;
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => { if (!mount) return; camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.domElement.removeEventListener('click', click); controls.dispose(); renderer.dispose(); mount.removeChild(renderer.domElement); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose()); else object.material.dispose(); } }); };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}
