import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TOOL_CATALOG } from '@/config/toolCatalog';

type WorldNode = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  position: [number, number, number];
};
type Creature = {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPos: THREE.Vector3;
  type: 'deer' | 'bird' | 'sitter';
};

const NODE_COLORS = [
  '#fbbf24',
  '#f0abfc',
  '#93c5fd',
  '#fdba74',
  '#fda4af',
  '#67e8f9',
  '#d8b4fe',
  '#a7f3d0',
  '#fca5a5',
  '#fde68a',
];
const WORLD_TOOLS = TOOL_CATALOG.filter((tool) => tool.id !== 'world-3d');
const WORLD_NODES: WorldNode[] = WORLD_TOOLS.map((tool, index) => {
  const angle = (index / WORLD_TOOLS.length) * Math.PI * 2 - Math.PI / 2;
  return {
    id: tool.id,
    title: tool.label.toUpperCase(),
    subtitle: 'Open workspace',
    color: NODE_COLORS[index % NODE_COLORS.length],
    position: [Math.cos(angle) * 16, 1.1, Math.sin(angle) * 16] as [
      number,
      number,
      number,
    ],
  };
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
  context.fillText(
    text === 'YOLNOMA TREE' ? 'The living desktop' : '',
    canvas.width / 2,
    108,
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  sprite.scale.set(3.2 * scale, 0.8 * scale, 1);
  return sprite;
}

function makeBranch(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const direction = end.clone().sub(start);
  const geometry = new THREE.CylinderGeometry(
    radius * 0.75,
    radius,
    direction.length(),
    8,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
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
  for (let index = 0; index < 2400; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2.4 + Math.sqrt(Math.random()) * 24;
    const blade = new THREE.Mesh(
      bladeGeometry,
      grassMaterials[index % grassMaterials.length],
    );
    blade.position.set(
      Math.cos(angle) * radius,
      0.18,
      Math.sin(angle) * radius,
    );
    blade.scale.set(
      0.7 + Math.random() * 0.8,
      0.7 + Math.random() * 0.9,
      0.7 + Math.random() * 0.8,
    );
    blade.rotation.y = Math.random() * Math.PI;
    blade.userData.windPhase = Math.random() * Math.PI * 2;
    blade.userData.windStrength = 0.045 + Math.random() * 0.08;
    blade.castShadow = true;
    field.add(blade);
  }
  return field;
}

function createRocks() {
  const rocks = new THREE.Group();
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: '#5a6b74',
    roughness: 0.95,
    metalness: 0.05,
  });
  const positions = [
    [-8, 0, 6],
    [7, 0, -9],
    [-11, 0, -5],
    [9, 0, 8],
    [-6, 0, -12],
    [12, 0, 3],
    [-14, 0, 8],
    [5, 0, 14],
    [-9, 0, 11],
    [11, 0, -10],
  ];
  positions.forEach((pos) => {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.65, 1),
      rockMaterial,
    );
    rock.position.set(...(pos as [number, number, number]));
    rock.scale.set(
      0.8 + Math.random() * 1.2,
      0.6 + Math.random() * 0.7,
      0.8 + Math.random() * 1.2,
    );
    rock.castShadow = true;
    rocks.add(rock);
  });
  return rocks;
}

function createDeer() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#8b6f47',
    roughness: 0.8,
  });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1.2, 4, 8),
    bodyMaterial,
  );
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12),
    bodyMaterial,
  );
  head.position.set(0, 0.35, 0.65);
  head.castShadow = true;
  group.add(head);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8),
      bodyMaterial,
    );
    leg.position.set(
      (i % 2 === 0 ? -1 : 1) * 0.25,
      -0.55,
      (i < 2 ? 1 : -1) * 0.3,
    );
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  const antlers = [];
  for (let side = -1; side <= 1; side += 2) {
    const antler1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.6, 6),
      bodyMaterial,
    );
    antler1.position.set(side * 0.15, 0.7, 0.6);
    antler1.rotation.z = side * 0.35;
    antler1.castShadow = true;
    group.add(antler1);
    const antler2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.45, 6),
      bodyMaterial,
    );
    antler2.position.set(side * 0.2, 1.05, 0.5);
    antler2.rotation.z = side * 0.5;
    antler2.castShadow = true;
    group.add(antler2);
  }
  group.userData.legs = legs;
  group.scale.set(0.6, 0.6, 0.6);
  return group;
}

function createBird() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#6b4c3a',
    roughness: 0.7,
    emissive: '#3a2a1f',
    emissiveIntensity: 0.2,
  });
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 10),
    bodyMaterial,
  );
  body.scale.set(1.2, 0.8, 0.9);
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    bodyMaterial,
  );
  head.position.set(0, 0.08, 0.25);
  head.castShadow = true;
  group.add(head);
  const wingLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.08, 0.3),
    new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 0.75 }),
  );
  wingLeft.position.set(-0.35, -0.05, -0.05);
  wingLeft.castShadow = true;
  group.add(wingLeft);
  const wingRight = wingLeft.clone();
  wingRight.position.x = 0.35;
  group.add(wingRight);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.06, 0.4),
    new THREE.MeshStandardMaterial({ color: '#4a2a1a', roughness: 0.8 }),
  );
  tail.position.set(0, -0.08, -0.35);
  tail.castShadow = true;
  group.add(tail);
  group.userData.wings = [wingLeft, wingRight];
  group.userData.wingPhase = Math.random() * Math.PI * 2;
  group.scale.set(0.4, 0.4, 0.4);
  return group;
}

function createMoon() {
  const moon = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 32, 32),
    new THREE.MeshStandardMaterial({
      color: '#dce7f5',
      emissive: '#9db7dd',
      emissiveIntensity: 0.7,
      roughness: 0.8,
    }),
  );
  sphere.position.set(-11, 15, -18);
  moon.add(sphere);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(3, 32, 32),
    new THREE.MeshBasicMaterial({
      color: '#a9c9f5',
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
    }),
  );
  halo.position.copy(sphere.position);
  moon.add(halo);
  return moon;
}

function createCampfire() {
  const group = new THREE.Group();
  group.position.set(0, 0, 2.4);
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: '#4a5250',
    roughness: 1,
  });
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.28, 0),
      stoneMaterial,
    );
    stone.position.set(Math.cos(angle) * 0.8, 0.25, Math.sin(angle) * 0.8);
    stone.scale.set(1.25, 0.72, 0.95);
    stone.castShadow = true;
    group.add(stone);
  }
  const logMaterial = new THREE.MeshStandardMaterial({
    color: '#6a3822',
    roughness: 0.95,
  });
  for (let index = 0; index < 3; index += 1) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 1.15, 10),
      logMaterial,
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = index * 1.05;
    log.position.y = 0.48 + index * 0.06;
    log.castShadow = true;
    group.add(log);
  }
  const flameMaterial = new THREE.MeshBasicMaterial({
    color: '#ff9f43',
    transparent: true,
    opacity: 0.85,
  });
  const flame = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.58, 2),
    flameMaterial,
  );
  flame.position.y = 1.15;
  flame.scale.set(0.7, 1.45, 0.7);
  flame.userData.isFlame = true;
  group.add(flame);
  const innerFlame = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 1),
    new THREE.MeshBasicMaterial({
      color: '#fff3b0',
      transparent: true,
      opacity: 0.95,
    }),
  );
  innerFlame.position.y = 1.08;
  innerFlame.scale.y = 1.6;
  innerFlame.userData.isFlame = true;
  group.add(innerFlame);
  const light = new THREE.PointLight('#ff8a3d', 3.2, 8, 2);
  light.position.y = 1.25;
  group.add(light);
  const embers = new THREE.Group();
  for (let index = 0; index < 12; index += 1) {
    const ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 6),
      new THREE.MeshBasicMaterial({ color: '#ffcf70' }),
    );
    ember.position.set(
      (Math.random() - 0.5) * 0.7,
      0.8 + Math.random() * 2.2,
      (Math.random() - 0.5) * 0.7,
    );
    ember.userData.emberPhase = Math.random() * Math.PI * 2;
    embers.add(ember);
  }
  group.add(embers);
  return group;
}

function createTree() {
  const group = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({
    color: '#543b2a',
    roughness: 0.92,
  });
  const leafMaterials = [
    new THREE.MeshStandardMaterial({
      color: '#397b58',
      roughness: 0.85,
      emissive: '#0b2519',
      emissiveIntensity: 0.35,
    }),
    new THREE.MeshStandardMaterial({
      color: '#5ca66d',
      roughness: 0.8,
      emissive: '#102d1a',
      emissiveIntensity: 0.28,
    }),
    new THREE.MeshStandardMaterial({
      color: '#86bd70',
      roughness: 0.85,
      emissive: '#203a1a',
      emissiveIntensity: 0.2,
    }),
  ];
  const trunkEnd = new THREE.Vector3(0, 4.6, 0);
  group.add(makeBranch(new THREE.Vector3(0, 0, 0), trunkEnd, 0.65, bark));
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const rootEnd = new THREE.Vector3(
      Math.cos(angle) * 1.7,
      0.08,
      Math.sin(angle) * 1.7,
    );
    group.add(makeBranch(new THREE.Vector3(0, 0.18, 0), rootEnd, 0.2, bark));
  }
  const branchEnds = [
    new THREE.Vector3(-2.8, 5.2, 0.2),
    new THREE.Vector3(2.6, 5.4, -0.3),
    new THREE.Vector3(-1.5, 7.2, 0),
    new THREE.Vector3(1.5, 7.4, 0.3),
    new THREE.Vector3(0, 9, 0),
    new THREE.Vector3(-3.7, 3.7, 0.5),
    new THREE.Vector3(3.5, 3.9, -0.4),
    new THREE.Vector3(0, 5, 2),
    new THREE.Vector3(0, 6, -1.5),
    new THREE.Vector3(-1.5, 5.8, -2.2),
    new THREE.Vector3(1.5, 6.2, -2.1),
  ];
  branchEnds.forEach((end, index) => {
    const anchor =
      index < 5
        ? new THREE.Vector3(0, 3.4 + index * 0.9, 0)
        : new THREE.Vector3(0, 2.5, 0);
    group.add(makeBranch(anchor, end, index < 5 ? 0.25 : 0.32, bark));
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(index === 4 ? 1.75 : 1.35, 18, 12),
      leafMaterials[index % leafMaterials.length],
    );
    cloud.position.copy(end).add(new THREE.Vector3(0, 0.75, 0));
    cloud.scale.set(1.25, 0.95, 1.05);
    cloud.castShadow = true;
    cloud.userData.isLeaf = true;
    cloud.userData.windAngle = 0;
    cloud.userData.windVelocity = 0;
    group.add(cloud);
    const accent = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({
        color: index % 2 ? '#f4c6a5' : '#f6df9b',
        emissive: '#7a4935',
        emissiveIntensity: 0.5,
      }),
    );
    accent.position
      .copy(end)
      .add(new THREE.Vector3(index % 2 ? 0.6 : -0.6, 0.7, 0.2));
    accent.castShadow = true;
    accent.userData.isBlossom = true;
    group.add(accent);
  });
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 20, 14),
    leafMaterials[1],
  );
  crown.position.set(0, 9.8, 0);
  crown.scale.set(1.3, 1.05, 1.2);
  crown.castShadow = true;
  crown.userData.isLeaf = true;
  crown.userData.windAngle = 0;
  crown.userData.windVelocity = 0;
  group.add(crown);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.018, 8, 64),
    new THREE.MeshBasicMaterial({
      color: '#f5c77a',
      transparent: true,
      opacity: 0.28,
    }),
  );
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
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.1, 0.3, 32),
    new THREE.MeshStandardMaterial({
      color: '#1b2830',
      metalness: 0.65,
      roughness: 0.35,
      emissive: color,
      emissiveIntensity: 0.13,
    }),
  );
  pedestal.position.y = 0.15;
  pedestal.castShadow = true;
  group.add(pedestal);
  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.65, 2),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.25,
    }),
  );
  orb.position.y = 1.15;
  orb.castShadow = true;
  orb.userData.nodeId = node.id;
  group.add(orb);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.025, 8, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
  );
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

function createWoodenTable() {
  const table = new THREE.Group();
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: '#8b6f47',
    roughness: 0.8,
  });

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.08, 1.2),
    woodMaterial,
  );
  top.position.y = 0.72;
  top.castShadow = true;
  table.add(top);

  const legPositions = [
    [-0.75, 0.35, -0.45],
    [0.75, 0.35, -0.45],
    [-0.75, 0.35, 0.45],
    [0.75, 0.35, 0.45],
  ];

  legPositions.forEach((pos) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.72, 0.08),
      woodMaterial,
    );
    leg.position.set(...(pos as [number, number, number]));
    leg.castShadow = true;
    table.add(leg);
  });

  return table;
}

function createSittingFigure() {
  const figure = new THREE.Group();
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: '#d4a574',
    roughness: 0.7,
  });
  const clothMaterial = new THREE.MeshStandardMaterial({
    color: '#3a3a4a',
    roughness: 0.85,
  });

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.4, 0.22),
    clothMaterial,
  );
  torso.position.y = 0.4;
  torso.castShadow = true;
  figure.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 12),
    skinMaterial,
  );
  head.position.set(0, 0.85, 0);
  head.castShadow = true;
  figure.add(head);

  for (let side of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8),
      skinMaterial,
    );
    arm.position.set(side * 0.2, 0.55, 0);
    arm.rotation.z = side * 0.4;
    arm.castShadow = true;
    figure.add(arm);
  }

  for (let side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8),
      clothMaterial,
    );
    leg.position.set(side * 0.12, 0.08, 0.15);
    leg.rotation.z = side * 0.15;
    leg.castShadow = true;
    figure.add(leg);
  }

  figure.scale.set(0.85, 0.85, 0.85);
  return figure;
}

export default function YolnomaWorld({
  onSelect,
}: {
  onSelect?: (nodeId: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const creaturesRef = useRef<Creature[]>([]);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07131d');
    scene.fog = new THREE.FogExp2('#07131d', 0.018);
    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200,
    );
    camera.position.set(15, 9.5, 18);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = 'none';
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 2.25, 0);
    controls.minDistance = 9;
    controls.maxDistance = 48;
    controls.maxPolarAngle = Math.PI / 2.05;

    scene.add(new THREE.HemisphereLight('#b7e3ff', '#17251d', 1.4));
    const moonLight = new THREE.DirectionalLight('#a8c7ff', 2.2);
    moonLight.position.set(-10, 18, 8);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    moonLight.shadow.camera.left = -28;
    moonLight.shadow.camera.right = 28;
    moonLight.shadow.camera.top = 28;
    moonLight.shadow.camera.bottom = -28;
    scene.add(moonLight);

    const stars = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: '#b9dcff',
        size: 0.08,
        transparent: true,
        opacity: 0.8,
      }),
    );
    const starPositions = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i += 1) {
      starPositions[i * 3] = (Math.random() - 0.5) * 100;
      starPositions[i * 3 + 1] = Math.random() * 55 + 4;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    stars.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3),
    );
    scene.add(stars);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(28, 96),
      new THREE.MeshStandardMaterial({
        color: '#0d211d',
        roughness: 0.98,
        metalness: 0.02,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const path = new THREE.Mesh(
      new THREE.RingGeometry(4.6, 5.15, 64),
      new THREE.MeshBasicMaterial({
        color: '#b58a55',
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.015;
    scene.add(path);
    const grass = createGrassField();
    scene.add(grass);
    scene.add(createRocks());
    scene.add(createMoon());
    const campfire = createCampfire();
    scene.add(campfire);

    const tree = createTree();
    tree.scale.setScalar(0.78);
    scene.add(tree);
    WORLD_NODES.forEach((node) => scene.add(createNode(node)));

    const fireflies = new THREE.Group();
    const fireflyMaterial = new THREE.MeshBasicMaterial({
      color: '#d9ff9a',
      transparent: true,
      opacity: 0.88,
    });
    for (let i = 0; i < 42; i += 1) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        fireflyMaterial,
      );
      dot.position.set(
        (Math.random() - 0.5) * 28,
        0.5 + Math.random() * 7,
        (Math.random() - 0.5) * 28,
      );
      dot.userData.phase = Math.random() * Math.PI * 2;
      fireflies.add(dot);
    }
    scene.add(fireflies);

    const creatures = new THREE.Group();
    scene.add(creatures);

    // table & sitter
    const table = createWoodenTable();
    table.position.set(2.2, 0, -1.8);
    scene.add(table);

    const sitter = createSittingFigure();
    sitter.position.set(2.4, 0.75, -1.2);
    sitter.rotation.y = 0.3;
    creatures.add(sitter);
    creaturesRef.current.push({
      mesh: sitter,
      position: sitter.position.clone(),
      velocity: new THREE.Vector3(),
      targetPos: sitter.position.clone(),
      type: 'sitter',
    });

    for (let i = 0; i < 6; i++) {
      const deer = createDeer();
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 14;
      deer.position.set(
        Math.cos(angle) * radius,
        0.3,
        Math.sin(angle) * radius,
      );
      creatures.add(deer);
      creaturesRef.current.push({
        mesh: deer,
        position: deer.position.clone(),
        velocity: new THREE.Vector3(),
        targetPos: new THREE.Vector3(
          Math.cos(Math.random() * Math.PI * 2) * 20,
          0.3,
          Math.sin(Math.random() * Math.PI * 2) * 20,
        ),
        type: 'deer',
      });
    }

    for (let i = 0; i < 8; i++) {
      const bird = createBird();
      bird.position.set(
        (Math.random() - 0.5) * 30,
        3 + Math.random() * 6,
        (Math.random() - 0.5) * 30,
      );
      creatures.add(bird);
      creaturesRef.current.push({
        mesh: bird,
        position: bird.position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0,
          (Math.random() - 0.5) * 2,
        ),
        targetPos: new THREE.Vector3(
          (Math.random() - 0.5) * 30,
          3 + Math.random() * 6,
          (Math.random() - 0.5) * 30,
        ),
        type: 'bird',
      });
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pressedKeys = new Set<string>();
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'shift'].includes(key)) {
        event.preventDefault();
        pressedKeys.add(key);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) =>
      pressedKeys.delete(event.key.toLowerCase());
    const click = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find((item) => item.object.userData.nodeId);
      if (hit?.object.userData.nodeId)
        onSelectRef.current?.(hit.object.userData.nodeId);
    };
    renderer.domElement.addEventListener('click', click);
    renderer.domElement.addEventListener('contextmenu', preventContextMenu);
    renderer.domElement.addEventListener('mousedown', () =>
      renderer.domElement.focus(),
    );
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      controls.update();
      const moveDirection = new THREE.Vector3();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3()
        .crossVectors(forward, camera.up)
        .normalize();
      if (pressedKeys.has('w')) moveDirection.add(forward);
      if (pressedKeys.has('s')) moveDirection.sub(forward);
      if (pressedKeys.has('d')) moveDirection.add(right);
      if (pressedKeys.has('a')) moveDirection.sub(right);
      if (moveDirection.lengthSq() > 0) {
        const speed = (pressedKeys.has('shift') ? 8 : 4.5) * delta;
        moveDirection.normalize().multiplyScalar(speed);
        camera.position.add(moveDirection);
        controls.target.add(moveDirection);
      }
      tree.children
        .filter((child) => child.userData.isLeaf)
        .forEach((leaf, index) => {
          const gust =
            Math.sin(elapsed * 0.7 + index * 0.8) * 0.07 +
            Math.sin(elapsed * 1.8 + index) * 0.025;
          leaf.userData.windVelocity +=
            (gust - leaf.userData.windAngle) * 0.018;
          leaf.userData.windVelocity *= 0.92;
          leaf.userData.windAngle += leaf.userData.windVelocity;
          leaf.rotation.z = leaf.userData.windAngle;
          leaf.rotation.x = leaf.userData.windAngle * 0.65;
        });
      grass.children.forEach((blade) => {
        const gust =
          Math.sin(elapsed * 1.05 + blade.userData.windPhase) *
            blade.userData.windStrength +
          Math.sin(elapsed * 2.3 + blade.userData.windPhase) * 0.018;
        blade.userData.windVelocity =
          (blade.userData.windVelocity ?? 0) +
          (gust - (blade.userData.windAngle ?? 0)) * 0.045;
        blade.userData.windVelocity *= 0.86;
        blade.userData.windAngle =
          (blade.userData.windAngle ?? 0) + blade.userData.windVelocity;
        blade.rotation.z = blade.userData.windAngle;
        blade.rotation.x = blade.userData.windAngle * 0.35;
      });
      campfire.children
        .filter((child) => child.userData.isFlame)
        .forEach((flame, index) => {
          flame.rotation.z = Math.sin(elapsed * 4 + index) * 0.12;
          flame.scale.y =
            (index ? 1.6 : 1.45) + Math.sin(elapsed * 5 + index) * 0.16;
        });
      campfire.children
        .filter((child) => child.type === 'Group')
        .forEach((emberGroup) =>
          emberGroup.children.forEach((ember) => {
            ember.position.y +=
              Math.sin(elapsed * 1.8 + ember.userData.emberPhase) * 0.002;
          }),
        );
      fireflies.children.forEach((dot) => {
        dot.position.y += Math.sin(elapsed * 1.2 + dot.userData.phase) * 0.0015;
        ((dot as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
          0.45 + (Math.sin(elapsed * 2 + dot.userData.phase) + 1) * 0.25;
      });

      creaturesRef.current.forEach((creature) => {
        if (creature.type === 'sitter') {
          // stationary, facing fire
          return;
        } else if (creature.type === 'deer') {
          if (creature.targetPos.distanceTo(creature.position) < 1.5) {
            creature.targetPos.set(
              Math.cos(Math.random() * Math.PI * 2) * (8 + Math.random() * 16),
              0.3,
              Math.sin(Math.random() * Math.PI * 2) * (8 + Math.random() * 16),
            );
          }
          const desired = creature.targetPos
            .clone()
            .sub(creature.position)
            .normalize()
            .multiplyScalar(2.5);
          creature.velocity.lerp(desired, 0.08);
          creature.position.add(
            creature.velocity.clone().multiplyScalar(delta),
          );
          creature.mesh.position.copy(creature.position);
          creature.mesh.lookAt(
            creature.position.clone().add(creature.velocity),
          );
          const legs = creature.mesh.userData.legs;
          if (legs) {
            legs.forEach((leg: THREE.Mesh, idx: number) => {
              leg.rotation.x = Math.sin(elapsed * 4 + idx) * 0.4;
            });
          }
        } else if (creature.type === 'bird') {
          if (creature.targetPos.distanceTo(creature.position) < 2) {
            creature.targetPos.set(
              (Math.random() - 0.5) * 32,
              3 + Math.random() * 6,
              (Math.random() - 0.5) * 32,
            );
          }
          const desired = creature.targetPos
            .clone()
            .sub(creature.position)
            .normalize()
            .multiplyScalar(3);
          creature.velocity.lerp(desired, 0.05);
          creature.position.add(
            creature.velocity.clone().multiplyScalar(delta),
          );
          creature.mesh.position.copy(creature.position);
          creature.mesh.lookAt(
            creature.position.clone().add(creature.velocity),
          );
          const wings = creature.mesh.userData.wings;
          if (wings) {
            wings.forEach((wing: THREE.Mesh) => {
              wing.rotation.z =
                Math.sin(elapsed * 8 + creature.mesh.userData.wingPhase) * 0.6;
            });
          }
        }
      });

      stars.rotation.y = elapsed * 0.002;
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.domElement.removeEventListener('click', click);
      renderer.domElement.removeEventListener(
        'contextmenu',
        preventContextMenu,
      );
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material))
            object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
}
