import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WorldArtDirector, type WorldTemplates } from '../src/systems/WorldArtDirector';

function template(name: string): THREE.Group {
  const root = new THREE.Group();
  root.name = name;
  root.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    new THREE.MeshBasicMaterial(),
  ));
  return root;
}

describe('WorldArtDirector', () => {
  it('follows the Earth curve and recycles individual world modules', () => {
    const templates: WorldTemplates = {
      arch: template('arch'),
      pylon: template('pylon'),
      lamp: template('lamp'),
      billboard: template('billboard'),
      utility: template('utility'),
      buildingA: template('building-a'),
      buildingB: template('building-b'),
    };
    const director = new WorldArtDirector(templates);
    const firstModule = director.group.children[0];
    const curvedModule = director.group.children[2];

    director.update(2, 10);
    expect(firstModule.position.z).toBeCloseTo(24);
    expect(curvedModule.position.x).toBe(0);
    expect(curvedModule.position.y).toBeLessThan(0);
    expect(curvedModule.rotation.x).toBeLessThan(0);
    expect(curvedModule.rotation.y).toBe(0);

    director.update(0.3, 10);
    expect(firstModule.position.z).toBeLessThan(-100);
    expect(Math.max(...director.group.children.map((module) => module.position.z))).toBeGreaterThan(0);

    director.dispose();
    for (const root of Object.values(templates)) {
      root.traverse((object: THREE.Object3D) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      });
    }
  });
});
