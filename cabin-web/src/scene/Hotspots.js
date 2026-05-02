import * as THREE from 'three';

export class Hotspots {
  constructor(camera, cabinGeometry, domElement) {
    this.camera = camera;
    this.cabinGeometry = cabinGeometry;
    this.dom = domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this._hoveredMesh = null;
    this._handlers = {};
    this._enabled = true;
    this._bind();
  }

  _bind() {
    this.dom.addEventListener('pointermove', e => this._onMove(e), { passive: true });
    this.dom.addEventListener('click', e => this._onClick(e));
  }

  on(hotspot, fn) {
    this._handlers[hotspot] = fn;
  }

  setEnabled(v) { this._enabled = v; }

  _getMouseNDC(e) {
    const rect = this.dom.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  _onMove(e) {
    if (!this._enabled) return;
    const ndc = this._getMouseNDC(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = this.cabinGeometry.hotspotMeshes.filter(m => m.visible !== false);
    const hits = this.raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const hit = hits[0].object;
      if (hit !== this._hoveredMesh) {
        if (this._hoveredMesh) this._unhover(this._hoveredMesh);
        this._hoveredMesh = hit;
        this._hover(hit);
      }
      this.dom.style.cursor = 'pointer';
    } else {
      if (this._hoveredMesh) {
        this._unhover(this._hoveredMesh);
        this._hoveredMesh = null;
      }
      this.dom.style.cursor = 'default';
    }
  }

  _onClick(e) {
    if (!this._enabled) return;
    const ndc = this._getMouseNDC(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = this.cabinGeometry.hotspotMeshes.filter(m => m.visible !== false);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const mesh = hits[0].object;
      const hotspot = mesh.userData.hotspot;
      if (hotspot && this._handlers[hotspot]) {
        this._handlers[hotspot](mesh, hits[0]);
      }
    }
  }

  _hover(mesh) {
    if (mesh.material && mesh.material.emissive !== undefined) {
      mesh._origEmissive = mesh.material.emissive.clone();
      mesh._origEmissiveInt = mesh.material.emissiveIntensity;
      mesh.material.emissive.setHex(0x6080a0);
      mesh.material.emissiveIntensity = 0.15;
    }
  }

  _unhover(mesh) {
    if (mesh.material && mesh._origEmissive) {
      mesh.material.emissive.copy(mesh._origEmissive);
      mesh.material.emissiveIntensity = mesh._origEmissiveInt || 0;
    }
  }
}
