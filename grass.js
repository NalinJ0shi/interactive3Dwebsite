import * as THREE from 'three';

export default class Grass {
    // FIX: Ultra-tiny patch! 12 blades of grass in a 0.5 size box.
    constructor(scene, count = 12, size = 0.5) {
        this.scene = scene;
        this.count = count;
        this.size = size;

        // 1. CREATE THE "X" SHAPE GEOMETRY
        // We create one plane, then another rotated 90 degrees
        const planeGeom = new THREE.PlaneGeometry(0.25, 0.8, 1, 4);
        planeGeom.translate(0, 0.4, 0); // Put bottom at 0 height

        // Create the cross-section
        const secondPlane = planeGeom.clone();
        secondPlane.rotateY(Math.PI / 2);

        // Combine them into one "X" geometry
        // Note: Using BufferGeometry.merge to keep it fast
        const geometry = new THREE.BufferGeometry();
        const geometries = [planeGeom, secondPlane];
        
        // Manual merge to avoid extra imports for now
        const positions = [];
        const uvs = [];
        geometries.forEach(g => {
            positions.push(...g.attributes.position.array);
            uvs.push(...g.attributes.uv.array);
        });
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

        // 2. THE MATERIAL (Wind + Color)
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColorLow: { value: new THREE.Color('#3a6e2a') }, // Base color
                uColorHigh: { value: new THREE.Color('#ffd24d') } // Tips (Yellowish like sunset)
            },
            vertexShader: `
                varying vec2 vUv;
                uniform float uTime;

                // Simple Math Wind
                float getWind(vec2 p) {
                    return sin(p.x * 0.5 + uTime * 1.5) * cos(p.y * 0.5 + uTime * 1.2);
                }

                void main() {
                    vUv = uv;
                    
                    // The magic: Only top of blade moves (uv.y goes 0 to 1)
                    float strength = pow(uv.y, 2.0); 

                    vec3 pos = position;
                    // Get world position of this specific blade
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
                    // Vertical gradient mix
                    vec3 col = mix(uColorLow, uColorHigh, vUv.y);
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });

        // 3. THE INSTANCED MESH (The Performance King)
        this.mesh = new THREE.InstancedMesh(geometry, this.material, this.count);
        
        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            // Place grass around the floor
            dummy.position.set(
                (Math.random() - 0.5) * this.size,
                0,
                (Math.random() - 0.5) * this.size
            );
            
            dummy.rotation.y = Math.random() * Math.PI;
            // Randomly make some grass taller than others
            dummy.scale.setScalar(0.6 + Math.random() * 0.8);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.mesh);
    }

    update(time) {
        this.material.uniforms.uTime.value = time;
    }
}