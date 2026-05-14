import * as THREE from "three";

export function createPointerTools({ renderer, camera, gridGroup }) {
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundIntersection = new THREE.Vector3();

  function getPointerNdc(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function getGroundPointFromPointer(event) {
    const pointer = getPointerNdc(event);

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, groundIntersection);
    if (!hit) {
      return null;
    }

    return groundIntersection.clone();
  }

  function getHoveredHexCoord(event) {
    const pointer = getPointerNdc(event);
    raycaster.setFromCamera(pointer, camera);

    const intersections = raycaster.intersectObjects(gridGroup.children, true);
    for (const intersection of intersections) {
      if (intersection.instanceId === undefined) {
        continue;
      }

      const instanceData = intersection.object.userData.instanceData;
      const hoveredInstance = instanceData?.[intersection.instanceId];
      if (hoveredInstance?.coord) {
        return hoveredInstance.coord;
      }
    }

    return null;
  }

  return {
    getGroundPointFromPointer,
    getHoveredHexCoord,
  };
}
