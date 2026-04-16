import * as THREE from 'three';

export default class CameraControls {
    constructor(camera, character) {
        this.camera = camera;
        this.character = character;
        
        this.camOffset = new THREE.Vector3(20, 20, 20); // Your isometric angle
        this.panOffset = new THREE.Vector3(0, 0, 0);
        this.panTarget = new THREE.Vector3(0, 0, 0);
        this.isPanning = false;

        this.initEvents();
    }

    initEvents() {
        // Bind 'this' so we don't lose context inside the event listeners
        this.onContextMenu = (e) => e.preventDefault();
        
        this.onMouseDown = (e) => {
            if (e.button === 2) { 
                this.isPanning = true;
                document.body.style.cursor = 'grabbing'; 
            }
        };

        this.onMouseUp = (e) => {
            if (e.button === 2) {
                this.isPanning = false;
                document.body.style.cursor = 'grab';
            }
        };

        this.onMouseMove = (e) => {
            if (this.isPanning) {
                const panSpeed = 0.05;
                this.panTarget.x -= (e.movementX + e.movementY) * panSpeed;
                this.panTarget.z -= (e.movementY - e.movementX) * panSpeed;
            }
        };

        window.addEventListener('contextmenu', this.onContextMenu);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('mousemove', this.onMouseMove);
    }

    update(isMoving) {
        // 1. Smoothly glide the actual offset toward the target offset
        this.panOffset.lerp(this.panTarget, 0.1);

        // 2. If the user moves the character, reset the pan back to 0
        if (isMoving) {
            this.panTarget.set(0, 0, 0);
        }

        // 3. Apply the offset to the camera's position
        this.camera.position.set(
            this.character.position.x + this.camOffset.x + this.panOffset.x,
            this.character.position.y + this.camOffset.y,
            this.character.position.z + this.camOffset.z + this.panOffset.z
        );
        
        // 4. Tell the camera to look at the character PLUS the offset
        this.camera.lookAt(
            this.character.position.x + this.panOffset.x,
            this.character.position.y,
            this.character.position.z + this.panOffset.z
        );
    }
}