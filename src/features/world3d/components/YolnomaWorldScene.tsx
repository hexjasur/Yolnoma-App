import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  WORLD_NODES,
  createCampfire,
  createDeer,
  createBird,
  createGrassField,
  createMoon,
  createNode,
  createRocks,
  createSittingFigure,
  createTree,
  createWoodenTable,
  type Creature,
} from './worldObjects';

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
