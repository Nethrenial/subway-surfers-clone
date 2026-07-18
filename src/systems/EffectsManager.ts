import * as THREE from 'three';
import { ObjectPool, type Poolable } from '../core/ObjectPool';
import type { Player } from '../entities/Player';
import { sampleTrackRenderPose, type TrackRenderPose } from './TrackCurve';

class BurstParticle implements Poolable {
  active = false;
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  life = 0;

  reset(): void {
    this.active = false;
  }
}

export class EffectsManager {
  readonly group = new THREE.Group();

  private readonly pool = new ObjectPool(() => new BurstParticle(), 48);
  private readonly geometry = new THREE.IcosahedronGeometry(0.08, 0);
  private readonly material = new THREE.MeshBasicMaterial({ color: '#ffe17a' });
  private readonly mesh = new THREE.InstancedMesh(this.geometry, this.material, 48);
  private readonly streakGeometry = new THREE.BoxGeometry(0.035, 0.025, 3.4);
  private readonly streakMaterial = new THREE.MeshBasicMaterial({ color: '#67efff', transparent: true, opacity: 0.32 });
  private readonly streaks = new THREE.InstancedMesh(this.streakGeometry, this.streakMaterial, 24);
  private readonly streakZ = new Float32Array(24);
  private readonly streakX = new Float32Array(24);
  private readonly streakY = new Float32Array(24);
  private readonly shieldGeometry = new THREE.SphereGeometry(1, 20, 12);
  private readonly shieldMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color('#45edff') }, time: { value: 0 } },
    vertexShader: `varying vec3 vNormalView; varying vec3 vView; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vNormalView = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vNormalView; varying vec3 vView; uniform vec3 color; uniform float time; void main(){ float rim = pow(1.0 - abs(dot(vNormalView,vView)), 2.4); float pulse = 0.72 + sin(time*7.0)*0.18; gl_FragColor = vec4(color * (1.1 + rim), rim * 0.46 * pulse); }`,
  });
  private readonly shield = new THREE.Mesh(this.shieldGeometry, this.shieldMaterial);
  private readonly trailGeometry = new THREE.PlaneGeometry(0.16, 2.5);
  private readonly trailMaterial = new THREE.MeshBasicMaterial({
    color: '#4feeff', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide,
  });
  private readonly leftTrail = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
  private readonly rightTrail = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly renderPose: TrackRenderPose = { x: 0, y: 0, z: 0, pitch: 0 };
  private readonly trackPitchAxis = new THREE.Vector3(1, 0, 0);

  constructor() {
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shield.visible = false;
    this.leftTrail.rotation.x = -Math.PI / 2;
    this.rightTrail.rotation.x = -Math.PI / 2;
    for (let index = 0; index < this.streakZ.length; index += 1) {
      this.streakZ[index] = -5 - index * 4.2;
      this.streakX[index] = (index % 2 === 0 ? -1 : 1) * (3.3 + (index % 5) * 0.28);
      this.streakY[index] = 0.18 + (index % 4) * 0.42;
    }
    this.group.add(this.mesh, this.streaks, this.shield, this.leftTrail, this.rightTrail);
  }

  burst(x: number, y: number, z: number): void {
    for (let i = 0; i < 8; i += 1) {
      const particle = this.pool.acquire();
      if (!particle) return;
      const angle = (i / 8) * Math.PI * 2;
      particle.x = x;
      particle.y = y;
      particle.z = z;
      particle.vx = Math.cos(angle) * 1.8;
      particle.vy = 1.4 + (i % 3) * 0.35;
      particle.vz = Math.sin(angle) * 1.2;
      particle.life = 0.42;
    }
  }

  update(delta: number, speed: number, player: Player, shieldActive: boolean): void {
    let index = 0;
    for (const particle of this.pool.items) {
      if (!particle.active) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        this.pool.release(particle);
        continue;
      }
      particle.vy -= 5.5 * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.z += particle.vz * delta;
      sampleTrackRenderPose(particle.x, particle.z, this.renderPose);
      this.position.set(this.renderPose.x, particle.y + this.renderPose.y, this.renderPose.z);
      this.rotation.setFromAxisAngle(this.trackPitchAxis, this.renderPose.pitch);
      this.scale.setScalar(Math.max(0.25, particle.life / 0.42));
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.mesh.setMatrixAt(index++, this.matrix);
    }
    this.mesh.count = index;
    this.mesh.instanceMatrix.needsUpdate = true;

    for (let streakIndex = 0; streakIndex < this.streakZ.length; streakIndex += 1) {
      this.streakZ[streakIndex] += speed * delta * 1.35;
      if (this.streakZ[streakIndex] > 12) this.streakZ[streakIndex] -= 102;
      sampleTrackRenderPose(this.streakX[streakIndex], this.streakZ[streakIndex], this.renderPose);
      this.position.set(this.renderPose.x, this.streakY[streakIndex] + this.renderPose.y, this.renderPose.z);
      this.rotation.setFromAxisAngle(this.trackPitchAxis, this.renderPose.pitch);
      this.scale.set(1, 1, 0.75 + speed / 22);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.streaks.setMatrixAt(streakIndex, this.matrix);
    }
    this.streaks.count = this.streakZ.length;
    this.streaks.instanceMatrix.needsUpdate = true;
    this.streakMaterial.opacity = 0.2 + Math.min(0.22, speed / 75);

    this.shield.visible = shieldActive;
    this.shield.position.set(player.position.x, player.position.y + 1, player.position.z);
    this.shield.scale.set(0.82, 1.15, 0.72);
    this.shieldMaterial.uniforms.time.value += delta;

    this.leftTrail.position.set(player.position.x - 0.2, player.position.y + 0.08, player.position.z + 1.35);
    this.rightTrail.position.set(player.position.x + 0.2, player.position.y + 0.08, player.position.z + 1.35);
    const trailScale = 0.72 + speed / 25;
    this.leftTrail.scale.y = trailScale;
    this.rightTrail.scale.y = trailScale;
  }

  reset(): void {
    this.pool.releaseAll();
    this.mesh.count = 0;
    this.shield.visible = false;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.streakGeometry.dispose();
    this.streakMaterial.dispose();
    this.shieldGeometry.dispose();
    this.shieldMaterial.dispose();
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
  }
}
