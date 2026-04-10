import * as THREE from 'three';

export default class Water {
    constructor(scene, size = 150) {
        this.scene = scene;
        this.group = new THREE.Group();

        // 1. A large plane to cover the area [00:07:17]
        const geometry = new THREE.PlaneGeometry(size, size, 64, 64);

        // 2. Base Water Layer
        // Since your floor shader is brown, we need a blue base.
        const baseMaterial = new THREE.MeshBasicMaterial({
            color: '#4db8ff',
            transparent: true,
            opacity: 0.7,
            depthWrite: false
        });
        const baseMesh = new THREE.Mesh(geometry, baseMaterial);
        baseMesh.rotation.x = -Math.PI / 2;
        baseMesh.position.y = 0.05; // Slightly above ground
        this.group.add(baseMesh);

        // 3. The Stylized Ripple Shader Layer
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uRippleColor: { value: new THREE.Color('#ffffff') }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uRippleColor;
                varying vec2 vUv;

                void main() {
                    // Simulate distance from the shore. 
                    // Bruno used a terrain texture for this [00:07:23]
                    float dist = distance(vUv, vec2(0.5));

                    // Distort the UVs to mimic the organic Perlin noise variation [00:07:51]
                    vec2 noisyUv = vUv + vec2(
                        sin(vUv.y * 40.0 + uTime) * 0.005,
                        cos(vUv.x * 40.0 + uTime) * 0.005
                    );
                    float noisyDist = distance(noisyUv, vec2(0.5));

                    // Use fract (modulo) to loop the value from 0 to 1 [00:07:31]
                    // Apply time to make the pattern move [00:07:42]
                    float rippleProgress = fract(noisyDist * 25.0 - uTime * 0.8);

                    // Discard pixels when the value is greater than a threshold [00:07:57]
                    // This is what creates the empty space between the lines!
                    if (rippleProgress > 0.1) {
                        discard; 
                    }

                    gl_FragColor = vec4(uRippleColor, 1.0);
                }
            `,
            transparent: true, 
            side: THREE.DoubleSide
        });

        const rippleMesh = new THREE.Mesh(geometry, this.material);
        rippleMesh.rotation.x = -Math.PI / 2;
        rippleMesh.position.y = 0.06; // Slightly above the base layer to avoid Z-fighting
        this.group.add(rippleMesh);

        this.scene.add(this.group);
    }

    update(time) {
        if (this.material) {
            this.material.uniforms.uTime.value = time;
        }
    }
}