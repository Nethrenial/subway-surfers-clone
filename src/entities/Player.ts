import * as THREE from 'three';
import type { InputFrame } from '../core/InputController';
import { CharacterAnimationController } from '../systems/CharacterAnimationController';

export type PlayerState = 'running' | 'jumping' | 'rolling' | 'crashed';

const LANES = [-2.35, 0, 2.35] as const;
const GRAVITY = 27;
const JUMP_VELOCITY = 10.4;
const ROLL_DURATION = 0.68;

export class Player {
  readonly group = new THREE.Group();
  readonly position = this.group.position;
  readonly halfWidth = 0.48;
  readonly halfDepth = 0.38;
  state: PlayerState = 'running';
  lane = 1;
  targetLane = 1;
  verticalVelocity = 0;
  jumpMultiplier = 1;

  private readonly bodyRoot = new THREE.Group();
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#f1f7ff',
    roughness: 0.3,
    metalness: 0.28,
  });
  private readonly suitMaterial = new THREE.MeshStandardMaterial({
    color: '#173552',
    roughness: 0.5,
    metalness: 0.08,
  });
  private readonly accentMaterial = new THREE.MeshStandardMaterial({
    color: '#41ecff',
    emissive: '#087e9d',
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.22,
  });
  private readonly skinMaterial = new THREE.MeshStandardMaterial({ color: '#8d503c', roughness: 0.72 });
  private readonly geometries: THREE.BufferGeometry[] = [];
  private rollRemaining = 0;
  private queuedJump = false;
  private strideTime = 0;
  private characterAnimation: CharacterAnimationController | null = null;

  constructor() {
    this.position.set(0, 0, 4.1);
    this.group.add(this.bodyRoot);
    this.buildRunner();
  }

  setVisual(model: THREE.Object3D): void {
    this.bodyRoot.clear();
    model.position.set(0, 0, 0);
    model.rotation.y = Math.PI;
    model.scale.setScalar(1);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 1.98 / Math.max(0.001, size.y);
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    const scaledBounds = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBounds.min.y;
    this.bodyRoot.add(model);
    this.characterAnimation = new CharacterAnimationController(model);
  }

  update(delta: number, input: Readonly<InputFrame>): void {
    if (this.state === 'crashed') return;
    if (input.left) this.targetLane = Math.max(0, this.targetLane - 1);
    if (input.right) this.targetLane = Math.min(2, this.targetLane + 1);

    if (input.jump) {
      if (this.isGrounded()) this.startJump();
      else this.queuedJump = true;
    }
    if (input.roll) this.startRoll();

    const laneSmoothing = 1 - Math.exp(-16 * delta);
    this.position.x = THREE.MathUtils.lerp(this.position.x, LANES[this.targetLane], laneSmoothing);
    if (Math.abs(this.position.x - LANES[this.targetLane]) < 0.03) {
      this.position.x = LANES[this.targetLane];
      this.lane = this.targetLane;
    }

    if (!this.isGrounded() || this.verticalVelocity > 0) {
      this.verticalVelocity -= GRAVITY * delta;
      this.position.y += this.verticalVelocity * delta;
      if (this.position.y <= 0) {
        this.position.y = 0;
        this.verticalVelocity = 0;
        if (this.queuedJump) {
          this.queuedJump = false;
          this.startJump();
        } else if (this.rollRemaining <= 0) {
          this.state = 'running';
        }
      }
    }

    if (this.rollRemaining > 0) {
      this.rollRemaining -= delta;
      if (this.rollRemaining <= 0 && this.isGrounded()) this.state = 'running';
    }

    this.strideTime += delta * 13;
    const laneLean = THREE.MathUtils.clamp((LANES[this.targetLane] - this.position.x) * -0.12, -0.25, 0.25);
    this.bodyRoot.rotation.z = THREE.MathUtils.lerp(this.bodyRoot.rotation.z, laneLean, 1 - Math.exp(-12 * delta));
    if (this.state === 'rolling') {
      this.bodyRoot.rotation.x = THREE.MathUtils.lerp(this.bodyRoot.rotation.x, -1.25, 1 - Math.exp(-18 * delta));
      this.bodyRoot.position.y = THREE.MathUtils.lerp(this.bodyRoot.position.y, 0.28, 1 - Math.exp(-18 * delta));
    } else {
      this.bodyRoot.rotation.x = THREE.MathUtils.lerp(this.bodyRoot.rotation.x, 0, 1 - Math.exp(-14 * delta));
      this.bodyRoot.position.y = Math.sin(this.strideTime) * 0.035;
    }
    this.characterAnimation?.update(delta, this.state, 0.7);
  }

  reset(): void {
    this.position.set(0, 0, 4.1);
    this.bodyRoot.position.set(0, 0, 0);
    this.bodyRoot.rotation.set(0, 0, 0);
    this.lane = 1;
    this.targetLane = 1;
    this.verticalVelocity = 0;
    this.rollRemaining = 0;
    this.queuedJump = false;
    this.state = 'running';
  }

  crash(): void {
    this.state = 'crashed';
    this.bodyRoot.rotation.z = -0.78;
    this.bodyRoot.rotation.x = -0.38;
  }

  get colliderMinY(): number {
    return this.position.y + 0.08;
  }

  get colliderMaxY(): number {
    return this.position.y + (this.state === 'rolling' ? 0.82 : 1.92);
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.bodyMaterial.dispose();
    this.suitMaterial.dispose();
    this.accentMaterial.dispose();
    this.skinMaterial.dispose();
  }

  private isGrounded(): boolean {
    return this.position.y <= 0.001;
  }

  private startJump(): void {
    this.verticalVelocity = JUMP_VELOCITY * this.jumpMultiplier;
    this.state = 'jumping';
  }

  private startRoll(): void {
    this.rollRemaining = ROLL_DURATION;
    this.state = 'rolling';
    if (!this.isGrounded()) this.verticalVelocity = Math.min(this.verticalVelocity, -7.5);
  }

  private buildRunner(): void {
    const addPart = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      position: THREE.Vector3Tuple,
      rotation: THREE.Vector3Tuple = [0, 0, 0],
    ) => {
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.bodyRoot.add(mesh);
    };

    addPart(new THREE.CapsuleGeometry(0.32, 0.58, 6, 10), this.suitMaterial, [0, 1.24, 0]);
    addPart(new THREE.SphereGeometry(0.3, 12, 8), this.skinMaterial, [0, 1.86, -0.02]);
    addPart(new THREE.BoxGeometry(0.72, 0.18, 0.3), this.bodyMaterial, [0, 1.5, 0.03]);
    addPart(new THREE.BoxGeometry(0.18, 0.74, 0.2), this.bodyMaterial, [-0.22, 0.58, 0], [0.12, 0, 0.04]);
    addPart(new THREE.BoxGeometry(0.18, 0.74, 0.2), this.bodyMaterial, [0.22, 0.58, 0], [-0.12, 0, -0.04]);
    addPart(new THREE.BoxGeometry(0.14, 0.64, 0.16), this.skinMaterial, [-0.46, 1.18, 0], [0, 0, 0.16]);
    addPart(new THREE.BoxGeometry(0.14, 0.64, 0.16), this.skinMaterial, [0.46, 1.18, 0], [0, 0, -0.16]);
    addPart(new THREE.BoxGeometry(0.42, 0.14, 0.12), this.accentMaterial, [0, 1.35, -0.28]);
    addPart(new THREE.BoxGeometry(0.22, 0.12, 0.5), this.accentMaterial, [-0.23, 0.16, -0.1]);
    addPart(new THREE.BoxGeometry(0.22, 0.12, 0.5), this.accentMaterial, [0.23, 0.16, -0.1]);
  }
}
