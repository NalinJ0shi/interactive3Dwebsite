import * as THREE from 'three';

export default class Foliage {
    constructor(scene, treeTrunks, leafTexture, matcapTexture) {
        this.scene = scene;
        this.count = treeTrunks.length; // One crown for every trunk!

        // 1. BUILD THE "CARDBOARD SPHERE"
        const planes = [];
        for (let i = 0; i < 30; i++) {
            const geom = new THREE.PlaneGeometry(1, 1);
            
            // Randomly rotate the plane in every direction
            geom.rotateX(Math.random() * Math.PI);
            geom.rotateY(Math.random() * Math.PI);
            geom.rotateZ(Math.random() * Math.PI);
            
            // Push it slightly outward from the center to make it puffy
            geom.translate(
                (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8
            );
            planes.push(geom);
        }

        // Merge all 30 planes into one giant Geometry for performance
        const positions = [];
        const uvs = [];
        const normals = [];
        planes.forEach(g => {
            positions.push(...g.attributes.position.array);
            uvs.push(...g.attributes.uv.array);
            normals.push(...g.attributes.normal.array);
        });
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

        // 2. THE MATERIAL (Alpha Cutout + Fake Sun Matcap + Wind)
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                tAlpha: { value: leafTexture },
                tMatcap: { value: matcapTexture }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                uniform float uTime;

                float getWind(vec2 p) {
                    return sin(p.x * 0.5 + uTime * 1.5) * cos(p.y * 0.5 + uTime * 1.2);
                }

                void main() {
                    vUv = uv;

                    // Calculate normal relative to the camera for the Matcap
                    mat3 normalMatrixInstanced = mat3(modelViewMatrix * instanceMatrix);
                    vNormal = normalize(normalMatrixInstanced * normal);

                    // Wind Setup: Only wave the top half of the leaf cluster
                    // position.y is roughly -0.5 at bottom and +0.5 at top
                    float heightWeight = max(0.0, position.y + 0.5); 
                    
                    vec3 pos = position;
                    vec3 worldPos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                    float wind = getWind(worldPos.xz);
                    
                    // Apply wind movement
                    pos.x += wind * heightWeight * 0.15;
                    pos.z += wind * heightWeight * 0.1;

                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tAlpha;
                uniform sampler2D tMatcap;
                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {
                    // 1. THE COOKIE CUTTER: Read the Black & White leaf image
                    vec4 alphaMap = texture2D(tAlpha, vUv);
                    
                    // If the pixel is dark (black background), make it invisible!
                    if (alphaMap.r < 0.5) {
                        discard; 
                    }

                    // 2. THE FAKE SUN: Calculate Matcap lighting
                    vec3 n = normalize(vNormal);
                    vec2 matcapUV = n.xy * 0.5 + 0.5;
                    vec4 matcapColor = texture2D(tMatcap, matcapUV);

                    gl_FragColor = matcapColor;
                }
            `,
            side: THREE.DoubleSide, 
            transparent: false // 'discard' is much faster than true transparency!
        });

        // 3. THE INSTANCED MESH (The Handshake!)
        this.mesh = new THREE.InstancedMesh(geometry, this.material, this.count);
        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < this.count; i++) {
            const trunk = treeTrunks[i]; 

            // Lift the leaves up so they sit on top of the trunk.
            // *NOTE: Adjust the '1.5' up or down if the leaves are hovering or sinking!*
            const crownHeight = trunk.scale * 1.5; 

            dummy.position.set(trunk.x, crownHeight, trunk.z);
            
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.rotation.z = (Math.random() - 0.5) * 0.2; 
            
            // Make the crown scale match the trunk scale
            dummy.scale.setScalar(trunk.scale * 1.2); 
            
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }

        this.scene.add(this.mesh);
    }

    update(time) {
        if (this.material) {
            this.material.uniforms.uTime.value = time;
        }
    }
}