import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class RenderPipeline {
  readonly postPasses: number;
  private readonly composer: EffectComposer | null;
  private width = 0;
  private height = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    renderer.info.autoReset = false;
    const params = new URLSearchParams(window.location.search);
    const usePost = window.innerWidth >= 900 && !params.has('no-post');
    if (!usePost) {
      this.composer = null;
      this.postPasses = 0;
      return;
    }
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.075, 0.12, 1.35));
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.postPasses = 2;
    this.resize();
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.info.reset();
    if (this.composer) this.composer.render();
    else this.renderer.render(scene, camera);
  }

  resize(): void {
    if (!this.composer) return;
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.composer.setSize(width, height);
  }

  dispose(): void {
    this.composer?.dispose();
  }
}
