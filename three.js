    // Add this right after your imports
    function lerpAngle(start, end, t) {
        let diff = Math.abs(end - start);
        if (diff > Math.PI) {
            if (end > start) {
                start += 2 * Math.PI;
            } else {
                end += 2 * Math.PI;
            }
        }
        return start + (end - start) * t;
    }
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

    // --- 1. THE WORLD SETUP ---
    const scene = new THREE.Scene();
    const bgColor = new THREE.Color('#ff9d4d');
    scene.background = bgColor;
    // Mist hides the pointy ends of the plane
    scene.fog = new THREE.Fog(bgColor, 30, 70); 

    // --- 2. THE CAMERA (FOLLOWING EYE) ---
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10; // Zoom level
    const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    
    // This is the "Stick" distance between camera and player
    const camOffset = new THREE.Vector3(20, 20, 20); 
    camera.position.copy(camOffset);

    // --- 3. LIGHTS ---
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    // --- 4. THE MAGIC GROUND (SHADER) ---
    const groundShader = {
        uniforms: {
            uColorCenter: { value: new THREE.Color('#ffcc80') },
            uColorEdge: { value: bgColor }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform vec3 uColorCenter;
            uniform vec3 uColorEdge;
            void main() {
                float dist = distance(vUv, vec2(0.5));
                gl_FragColor = vec4(mix(uColorCenter, uColorEdge, dist * 1.5), 1.0);
            }
        `
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.ShaderMaterial(groundShader));
    floor.rotation.x = -Math.PI * 0.5;
    scene.add(floor);

    // --- 5. LOADING & ANIMATION ---
    let targetRotation = 0; 
    let mixer, walkAction, idleAction, character;
    const clock = new THREE.Clock();
    const loader = new GLTFLoader();

    // Load Trees
    loader.load('tree1.glb', (gltf) => {
        const treeModel = gltf.scene;
        for(let i = 0; i < 30; i++) {
            const tree = treeModel.clone();
            tree.position.set((Math.random() - 0.5) * 100, 0, (Math.random() - 0.5) * 100);
            const s = 3 + Math.random() * 3;
            tree.scale.set(s, s, s);
            tree.rotation.y = Math.random() * Math.PI * 2;
            scene.add(tree);
        }
    });

    // Load Character
    loader.load('Man+anim2.glb', (gltf) => {
        character = gltf.scene;
        scene.add(character);

        mixer = new THREE.AnimationMixer(character);
        
        // Find your NLA strips from Blender
        const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Man_Walk');
        const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Man_Idle');

        if (walkClip) {
            walkAction = mixer.clipAction(walkClip);
            walkAction.setLoop(THREE.LoopRepeat); // FIXED: Force Loop
        }
        if (idleClip) {
            idleAction = mixer.clipAction(idleClip);
            idleAction.setLoop(THREE.LoopRepeat); // FIXED: Force Loop
            idleAction.play();
        }
    });

    // --- 6. INPUTS ---
    const keys = { w: false, a: false, s: false, d: false };
    window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

    // --- 7. RENDERER ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // --- 8. THE MAIN LOOP ---
    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();

        if (character && mixer) {
            let isMoving = keys.w || keys.a || keys.s || keys.d;
            const speed = 0.15;

            // 1. UPDATE TARGET ROTATION & MOVEMENT
            if (isMoving) {
                if (keys.w) { character.position.z -= speed; targetRotation = Math.PI; }
                if (keys.s) { character.position.z += speed; targetRotation = 0; }
                if (keys.a) { character.position.x -= speed; targetRotation = -Math.PI * 0.5; }
                if (keys.d) { character.position.x += speed; targetRotation = Math.PI * 0.5; }

                // Diagonals (Facing the corners)
                if (keys.w && keys.d) targetRotation = Math.PI * 0.75;
                if (keys.w && keys.a) targetRotation = -Math.PI * 0.75;
                if (keys.s && keys.d) targetRotation = Math.PI * 0.25;
                if (keys.s && keys.a) targetRotation = -Math.PI * 0.25;

                // Play Walk Animation
                if (walkAction && !walkAction.isRunning()) {
                    if (idleAction) idleAction.fadeOut(0.2);
                    walkAction.reset().fadeIn(0.2).play();
                }
            } 
            // 2. IF NOT MOVING
            else {
                if (idleAction && !idleAction.isRunning()) {
                    if (walkAction) walkAction.fadeOut(0.2);
                    idleAction.reset().fadeIn(0.2).play();
                }
            }

            // 3. SMOOTH TURN (Happens every frame)
            character.rotation.y = lerpAngle(
                character.rotation.y, 
                targetRotation, 
                0.1 
            );
            // 4. UPDATE PHYSICS & CAMERA
            mixer.update(delta);

            camera.position.set(
                character.position.x + camOffset.x,
                character.position.y + camOffset.y,
                character.position.z + camOffset.z
            );
            camera.lookAt(character.position);

            floor.position.x = character.position.x;
            floor.position.z = character.position.z;
        }

        renderer.render(scene, camera);
    }
    animate();

    // Handle Window Resize
    window.addEventListener('resize', () => {
        const aspect = window.innerWidth / window.innerHeight;
        camera.left = -d * aspect; camera.right = d * aspect;
        camera.top = d; camera.bottom = -d;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

