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
  it('waits until every module in a batch is behind the camera before recycling', () => {
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
    const firstBatch = director.group.children[0];

    director.update(5.7, 10);
    expect(firstBatch.position.z).toBeCloseTo(61);

    director.update(0.2, 10);
    expect(firstBatch.position.z).toBeLessThan(-60);
    expect(Math.max(...director.group.children.map((batch) => batch.position.z))).toBeGreaterThan(-5);

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
