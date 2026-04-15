import * as THREE from 'three';

export default class MobileControls {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // The output your character will read
        this.direction = new THREE.Vector2(0, 0); // x and y input (-1.0 to 1.0)
        this.isMoving = false;

        // Pre-allocate objects so we don't trigger garbage collection every frame
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        
        // This is the invisible mathematical plane we raycast against
        this.planeNormal = new THREE.Vector3(0, 1, 0);
        this.plane = new THREE.Plane(this.planeNormal, 0); 
        this.intersectionPoint = new THREE.Vector3();
        this.anchorPoint = new THREE.Vector3();

        this.touchId = null;
        this.maxRadius = 2.0; // How far the stick can stretch

        this.initVisuals();
        this.initEvents();
    }

    initVisuals() {
        // The large anchor ring
        const baseGeom = new THREE.RingGeometry(1.8, 2.0, 32);
        baseGeom.rotateX(-Math.PI / 2);
        const baseMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        this.baseMesh = new THREE.Mesh(baseGeom, baseMat);
        this.baseMesh.visible = false;
        this.scene.add(this.baseMesh);

        // The small moving knob
        const stickGeom = new THREE.CircleGeometry(0.8, 32);
        stickGeom.rotateX(-Math.PI / 2);
        const stickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        this.stickMesh = new THREE.Mesh(stickGeom, stickMat);
        this.stickMesh.visible = false;
        this.scene.add(this.stickMesh);
    }

    initEvents() {
        // Bind 'this' context so we don't lose it inside event listeners
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        window.addEventListener('touchstart', this.onTouchStart, { passive: false });
        window.addEventListener('touchmove', this.onTouchMove, { passive: false });
        window.addEventListener('touchend', this.onTouchEnd);
        window.addEventListener('touchcancel', this.onTouchEnd);
    }

    getHitPoint(clientX, clientY) {
        // Convert screen coordinates to normalized device coordinates (-1 to +1)
        this.pointer.x = (clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(clientY / window.innerHeight) * 2 + 1;

        // Raycast mathematically (instantly), ignoring actual scene meshes
        this.raycaster.setFromCamera(this.pointer, this.camera);
        this.raycaster.ray.intersectPlane(this.plane, this.intersectionPoint);
        return this.intersectionPoint;
    }

    onTouchStart(e) {
        if (this.touchId !== null) return; // Only track one thumb

        const touch = e.changedTouches[0];
        this.touchId = touch.identifier;

        const hit = this.getHitPoint(touch.clientX, touch.clientY);
        if (hit) {
            this.isMoving = true;
            this.anchorPoint.copy(hit);

            this.baseMesh.position.copy(this.anchorPoint);
            this.stickMesh.position.copy(this.anchorPoint);
            
            // Lift slightly to prevent Z-fighting with your terrain
            this.baseMesh.position.y = 0.5;
            this.stickMesh.position.y = 0.6;

            this.baseMesh.visible = true;
            this.stickMesh.visible = true;
        }
    }

    onTouchMove(e) {
        if (!this.isMoving) return;

        let touch = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.touchId) {
                touch = e.changedTouches[i];
                break;
            }
        }
        if (!touch) return;

        const hit = this.getHitPoint(touch.clientX, touch.clientY);
        if (hit) {
            // Calculate vector from anchor to current touch
            const dx = hit.x - this.anchorPoint.x;
            const dz = hit.z - this.anchorPoint.z;
            
            let distance = Math.sqrt(dx * dx + dz * dz);
            let angle = Math.atan2(dz, dx);

            // Restrict stick movement to the base ring
            if (distance > this.maxRadius) {
                distance = this.maxRadius;
            }

            this.stickMesh.position.x = this.anchorPoint.x + Math.cos(angle) * distance;
            this.stickMesh.position.z = this.anchorPoint.z + Math.sin(angle) * distance;

            // Output the normalized vector
            this.direction.set(
                (this.stickMesh.position.x - this.anchorPoint.x) / this.maxRadius,
                (this.stickMesh.position.z - this.anchorPoint.z) / this.maxRadius
            );
        }
    }

    onTouchEnd(e) {
        let ended = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.touchId) {
                ended = true;
                break;
            }
        }

        if (ended) {
            this.touchId = null;
            this.isMoving = false;
            this.direction.set(0, 0);
            this.baseMesh.visible = false;
            this.stickMesh.visible = false;
        }
    }

    dispose() {
        window.removeEventListener('touchstart', this.onTouchStart);
        window.removeEventListener('touchmove', this.onTouchMove);
        window.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('touchcancel', this.onTouchEnd);
        
        this.baseMesh.geometry.dispose();
        this.baseMesh.material.dispose();
        this.stickMesh.geometry.dispose();
        this.stickMesh.material.dispose();
    }
}