import * as THREE from './three.module.js';

class XRControllerModelFactory {
  constructor() {
    this.gltfLoader = null;
  }

  createControllerModel(controller) {
    // Create a simple controller visualization (cone + line)
    const controllerGroup = new THREE.Group();
    
    // Grip part (handle)
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.02, 0.08, 16),
      new THREE.MeshBasicMaterial({ color: 0x444444 })
    );
    grip.rotation.x = -Math.PI / 2;
    grip.position.z = 0.04;
    controllerGroup.add(grip);
    
    // Controller body
    const controllerBody = new THREE.Mesh(
      new THREE.ConeGeometry(0.015, 0.05, 16),
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    controllerBody.rotation.x = Math.PI;
    controllerBody.position.z = -0.025;
    controllerGroup.add(controllerBody);
    
    // Add a ray for pointing
    const pointing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.002, 0.002, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    pointing.rotation.x = Math.PI / 2;
    pointing.position.z = -0.5;
    controllerGroup.add(pointing);
    
    return controllerGroup;
  }
}

export { XRControllerModelFactory }; 