import * as THREE from 'three';

export default class Water {
    constructor(scene, size = 150, depthMap) {
        this.scene = scene;
        this.group = new THREE.Group();

        const geometry = new THREE.PlaneGeometry(size, size, 64, 64);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 }, 
                uDepthMap: { value: depthMap }, 
                uColorDeep: { value: new THREE.Color('#77bbe7') },   // Navy blue
                uColorShallow: { value: new THREE.Color('#b6cbcb') } // Neon aqua
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uDepthMap;
                uniform vec3 uColorDeep;
                uniform vec3 uColorShallow;
                uniform float uTime;
                varying vec2 vUv;

                void main() {
                    // 1. BASE DEPTH & COLOR
                    float groundHeight = texture2D(uDepthMap, vUv).r;
                    float shallowFactor = smoothstep(0.0, 0.35, groundHeight);
                    vec3 baseColor = mix(uColorDeep, uColorShallow, shallowFactor);

                    // 2. THE WHITE LINES (FOAM)
                    vec2 noisyUv = vUv + vec2(
                        sin(vUv.y * 50.0 + uTime) * 0.005,
                        cos(vUv.x * 50.0 + uTime) * 0.005
                    );
                    
                    float wobblyDepth = texture2D(uDepthMap, noisyUv).r;
                    
                    // DECREASED MULTIPLIER: Lowered from 40.0 to 20.0 to spread the lines out!
                    float wavePattern = fract(wobblyDepth * 20.0 - uTime * 0.5);
                    float foam = smoothstep(0.85, 0.9, wavePattern);

                    // THE SHORE MASK: 
                    // 0.15 is deep water (foam becomes 0.0). 0.35 is the shore (foam becomes 1.0).
                    float shoreMask = smoothstep(0.15, 0.35, groundHeight);
                    
                    // Multiply foam by the mask so it instantly vanishes in the deep center
                    foam *= shoreMask;

                    vec3 finalColor = mix(baseColor, vec3(1.0, 1.0, 1.0), foam * 0.6);

                    // 3. THE EDGE FADE
                    float edgeFade = 1.0 - smoothstep(0.25, 0.37, groundHeight);
                    float finalAlpha = 0.85 * edgeFade;

                    if (finalAlpha < 0.01) {
                        discard;
                    }

                    gl_FragColor = vec4(finalColor, finalAlpha); 
                }
            `,
            transparent: true, 
            side: THREE.DoubleSide
        });

        const waterMesh = new THREE.Mesh(geometry, this.material);
        waterMesh.rotation.x = -Math.PI / 2;
        waterMesh.position.y = -1.9; 
        
        this.group.add(waterMesh);
        this.scene.add(this.group);
    }

    update(time) {
        if (this.material) {
            this.material.uniforms.uTime.value = time;
        }
    }
}