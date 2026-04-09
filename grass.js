import * as THREE from 'three';

export default class Grass {
    // We now accept the ghost map data!
    constructor(scene, count = 20000, size = 150, imgData = null, imgSize = 512) {
        this.scene = scene;
        this.count = count;
        this.size = size;

        // 1. CREATE THE "X" SHAPE GEOMETRY (Unchanged)
        const planeGeom = new THREE.PlaneGeometry(0.25, 0.8, 1, 4);
        planeGeom.translate(0, 0.4, 0); 

        const secondPlane = planeGeom.clone();
        secondPlane.rotateY(Math.PI / 2);

        const geometry = new THREE.BufferGeometry();
        const geometries = [planeGeom, secondPlane];
        const positions = [];
        const uvs = [];
        geometries.forEach(g => {
            positions.push(...g.attributes.position.array);
            uvs.push(...g.attributes.uv.array);
        });
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

        // 2. THE MATERIAL (Unchanged)
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColorLow: { value: new THREE.Color('#3a6e2a') }, 
                uColorHigh: { value: new THREE.Color('#ffd24d') } 
            },
            vertexShader: `
                varying vec2 vUv;
                uniform float uTime;
                float getWind(vec2 p) { return sin(p.x * 0.5 + uTime * 1.5) * cos(p.y * 0.5 + uTime * 1.2); }
                void main() {
                    vUv = uv;
                    float strength = pow(uv.y, 2.0); 
                    vec3 pos = position;
                    vec3 worldPos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                    float wind = getWind(worldPos.xz);
                    pos.x += wind * strength * 0.4;
                    pos.z += wind * strength * 0.3;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform vec3 uColorLow;
                uniform vec3 uColorHigh;
                void main() {
                    vec3 col = mix(uColorLow, uColorHigh, vUv.y);
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });

        // 3. THE SMART LOOP (Reads the Map!)
        this.mesh = new THREE.InstancedMesh(geometry, this.material, this.count);
        const dummy = new THREE.Object3D();
        
        let placedGrass = 0;
        let attempts = 0;
        const maxAttempts = this.count * 10; // Prevent freezing if map is entirely black

        while (placedGrass < this.count && attempts < maxAttempts) {
            attempts++;

            // Pick a random spot in the world
            const randomX = (Math.random() - 0.5) * this.size;
            const randomZ = (Math.random() - 0.5) * this.size;

            // --- THE MASK CHECK ---
            if (imgData) {
                // Convert 3D world position to 2D image pixel
                const normalizedX = (randomX / this.size) + 0.5;
                const normalizedZ = (randomZ / this.size) + 0.5;

                const pixelX = Math.floor(normalizedX * imgSize);
                const pixelY = Math.floor(normalizedZ * imgSize);

                // Find this pixel's brightness in the data array
                const pixelIndex = (pixelY * imgSize + pixelX) * 4;
                const brightness = imgData[pixelIndex]; // 0 is black, 255 is white

                // If pixel is mostly black, throw seed in trash and try again!
                if (brightness < 128) {
                    continue; 
                }
            }

            // If we survived the check (it's white), plant the grass!
            dummy.position.set(randomX, 0, randomZ);
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.scale.setScalar(0.6 + Math.random() * 0.8);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(placedGrass, dummy.matrix);
            
            placedGrass++;
        }

        this.mesh.count = placedGrass; // Tell Three.js exactly how many survived
        this.scene.add(this.mesh);
    }

    update(time) {
        this.material.uniforms.uTime.value = time;
    }
}