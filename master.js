import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Grass from './grass.js';
import Foliage from './foliage.js';
import Water from './water.js'; 
import MobileControls from './mobile.js';

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

// --- 1. BASIC SETUP ---
const scene = new THREE.Scene();
const bgColor = new THREE.Color('#bdaa9d');
scene.background = bgColor;
scene.fog = new THREE.Fog(bgColor, 10, 60);

const aspect = window.innerWidth / window.innerHeight;
const d = 10;
const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
const camOffset = new THREE.Vector3(20, 20, 20);
camera.position.copy(camOffset);
const joystick = new MobileControls(scene, camera);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(10, 20, 10);
scene.add(sun);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// --- 2. LOADERS & TEXTURES ---
const texLoader = new THREE.TextureLoader();
const loader = new GLTFLoader(); 

// Load Master Map and Splat Map
const masterMap = texLoader.load('master_map3.png');
const splatMap = texLoader.load('images/ground_texture.jpg'); 

const grassTex = texLoader.load('images/grass_texture2.jpg');
const dirtTex = texLoader.load('images/dirt_texture.jpg');

grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
grassTex.colorSpace = THREE.SRGBColorSpace;
dirtTex.colorSpace = THREE.SRGBColorSpace;

// --- 3. THE FLOOR SHADER ---
const floorMaterial = new THREE.ShaderMaterial({
    uniforms: {
        tSplat: { value: splatMap },
        tGrass: { value: grassTex },
        tDirt: { value: dirtTex },
        uRepeat: { value: 30.0 }, 
        uMasterMap: { value: masterMap }, // The packed texture
        uDisplacementScale: { value: 5.0 },
        uDisplacementBias: { value: -3.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform sampler2D uMasterMap;
        uniform float uDisplacementScale;
        uniform float uDisplacementBias;

        void main() {
            vUv = uv;
            vNormal = normal; 
            
            // Look at RED (.r) channel for height displacement
            float displacement = texture2D(uMasterMap, uv).r;
            vec3 newPosition = position + normal * (displacement * uDisplacementScale + uDisplacementBias);
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform sampler2D tSplat;
        uniform sampler2D tGrass;
        uniform sampler2D tDirt;
        uniform float uRepeat;

        void main() {
            vec3 mask = texture2D(tSplat, vUv).rgb;
            vec3 grass = texture2D(tGrass, vUv * uRepeat).rgb;
            vec3 dirt = texture2D(tDirt, vUv * uRepeat).rgb;
            
            vec3 base = vec3(0.35, 0.32, 0.29); 

            vec3 finalColor = mix(base, grass, mask.r);
            finalColor = mix(finalColor, dirt, mask.g);

            float light = dot(vNormal, normalize(vec3(1.0, 2.0, 1.0))) * 0.5 + 0.5;
            finalColor *= light;

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150, 128, 128), floorMaterial);
floor.rotation.x = -Math.PI * 0.5;
scene.add(floor);

// --- 4. WATER ---
// Water already uses `.r` internally for depth, so we just pass the master map!
let waterField = new Water(scene, 150, masterMap); 

// --- 5. THE DATA READER ---
let grassField, bushField;
const treeTrunks = [];
window.terrainData = null; 

const mapImg = new Image();
mapImg.src = 'master_map3.png'; // Load the packed PNG into RAM
mapImg.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = mapImg.width;
    canvas.height = mapImg.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(mapImg, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const imgSize = canvas.width;
    
    window.terrainData = { imgData, imgSize };

    // Pass the image data to Grass (it knows to look at the Green channel)
    grassField = new Grass(scene, 10000, 150, imgData, imgSize);

    texLoader.load('images/leaf.png', (leafTex) => {
        texLoader.load('images/matcap.png', (matcapTex) => {
            matcapTex.colorSpace = THREE.SRGBColorSpace;
            loader.load('models/tree1.glb', (gltf) => {
                const treeModel = gltf.scene;

                let plantedTrees = 0;
                let attempts = 0;

                while (plantedTrees < 30 && attempts < 1000) {
                    attempts++;
                    
                    const randomX = (Math.random() - 0.5) * 150;
                    const randomZ = (Math.random() - 0.5) * 150;

                    const normalizedX = (randomX / 150) + 0.5;
                    const normalizedZ = (randomZ / 150) + 0.5;
                    const pixelX = Math.floor(normalizedX * imgSize);
                    const pixelY = Math.floor(normalizedZ * imgSize);
                    
                    const pixelIndex = (pixelY * imgSize + pixelX) * 4;
                    
                    // Let's spawn trees where there is grass (Green channel)
                    const treeDensity = imgData[pixelIndex + 1]; 
                    if (treeDensity < 128) continue; 

                    const tree = treeModel.clone();
                    const s = 3 + Math.random() * 3;

                    tree.position.set(randomX, 0, randomZ);
                    tree.scale.set(s, s, s);
                    tree.rotation.y = Math.random() * Math.PI * 2;
                    scene.add(tree);
                    
                    treeTrunks.push({ x: randomX, z: randomZ, scale: s });
                    plantedTrees++; 
                }
                
                bushField = new Foliage(scene, treeTrunks, leafTex, matcapTex);
            });
        });
    });
};

// --- 6. LOAD CHARACTER & ANIMATIONS ---
let targetRotation = 0;
let mixer, walkAction, idleAction, runAction, character;

loader.load('models/character.glb', (gltf) => {
    character = gltf.scene;
    scene.add(character);
    mixer = new THREE.AnimationMixer(character);

    const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Man_Walk');
    const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Man_Idle');
    const runClip = THREE.AnimationClip.findByName(gltf.animations, 'Man_Run');
    
    if (walkClip) walkAction = mixer.clipAction(walkClip).setLoop(THREE.LoopRepeat);
    if (runClip) runAction = mixer.clipAction(runClip).setLoop(THREE.LoopRepeat);
    if (idleClip) {
        idleAction = mixer.clipAction(idleClip).setLoop(THREE.LoopRepeat);
        idleAction.play();
    }
});

const keys = { w: false, a: false, s: false, d: false, shift: false };
window.addEventListener('keydown', (e) => {
    if(e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true;
    if(e.key === 'Shift') keys.shift = true;
});
window.addEventListener('keyup', (e) => {
    if(e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false;
    if(e.key === 'Shift') keys.shift = false;
});

// --- 8. ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Update environment shaders
    if (grassField) grassField.update(time);
    if (bushField) bushField.update(time);
    if (waterField) waterField.update(time);

    if (character && mixer) {
        // 1. Check Inputs (Keyboard vs Mobile)
        let isMovingKeys = keys.w || keys.a || keys.s || keys.d;
        
        // Safety check to ensure joystick exists and is being actively pushed
        let isMovingMobile = typeof joystick !== 'undefined' && joystick.isMoving && 
                             (Math.abs(joystick.direction.x) > 0.05 || Math.abs(joystick.direction.y) > 0.05);
        
        let isMoving = isMovingKeys || isMovingMobile;

        // 2. Determine Speed / Running State
        let joystickStrength = typeof joystick !== 'undefined' ? Math.sqrt(joystick.direction.x ** 2 + joystick.direction.y ** 2) : 0;
        let isRunning = (isMovingKeys && keys.shift) || (isMovingMobile && joystickStrength > 0.8);
        
        const speed = isRunning ? 0.3 : 0.15;

        // 3. Movement and Rotation
        if (isMoving) {
            if (isMovingMobile) {
                // --- MOBILE ---
                character.position.x += joystick.direction.x * speed;
                character.position.z += joystick.direction.y * speed;
                targetRotation = Math.atan2(joystick.direction.x, joystick.direction.y);
            } else {
                // --- KEYBOARD ---
                if (keys.w) { character.position.z -= speed; targetRotation = Math.PI; }
                if (keys.s) { character.position.z += speed; targetRotation = 0; }
                if (keys.a) { character.position.x -= speed; targetRotation = -Math.PI * 0.5; }
                if (keys.d) { character.position.x += speed; targetRotation = Math.PI * 0.5; }
                if (keys.w && keys.d) targetRotation = Math.PI * 0.75;
                if (keys.w && keys.a) targetRotation = -Math.PI * 0.75;
                if (keys.s && keys.d) targetRotation = Math.PI * 0.25;
                if (keys.s && keys.a) targetRotation = -Math.PI * 0.25;
            }
            
            // --- ANIMATION BLENDING: RUN OR WALK ---
            if (isRunning) {
                if (runAction && !runAction.isRunning()) {
                    if (walkAction) walkAction.fadeOut(0.2);
                    if (idleAction) idleAction.fadeOut(0.2);
                    runAction.reset().fadeIn(0.2).play();
                }
            } else {
                if (walkAction && !walkAction.isRunning()) {
                    if (runAction) runAction.fadeOut(0.2);
                    if (idleAction) idleAction.fadeOut(0.2);
                    walkAction.reset().fadeIn(0.2).play();
                }
            }
        } else {
            // --- ANIMATION BLENDING: IDLE ---
            if (idleAction && !idleAction.isRunning()) {
                if (walkAction) walkAction.fadeOut(0.2);
                if (runAction) runAction.fadeOut(0.2);
                idleAction.reset().fadeIn(0.2).play();
            }
        }
        
        // Smoothly lerp character rotation
        character.rotation.y = lerpAngle(character.rotation.y, targetRotation, 0.1);
        mixer.update(delta);

        // 4. Ground Collision (Reading the heightmap data)
        if (window.terrainData) {
            const normalizedX = (character.position.x / 150) + 0.5;
            const normalizedZ = (character.position.z / 150) + 0.5;
            
            const px = Math.max(0, Math.min(window.terrainData.imgSize - 1, Math.floor(normalizedX * window.terrainData.imgSize)));
            const py = Math.max(0, Math.min(window.terrainData.imgSize - 1, Math.floor(normalizedZ * window.terrainData.imgSize)));
            
            const pixelIndex = (py * window.terrainData.imgSize + px) * 4;
            const brightness = window.terrainData.imgData[pixelIndex];
            
            // Adjust the Y position based on displacement mapping math
            character.position.y = (brightness / 255) * 5 - 3;
        }

        // 5. Camera Follow
        camera.position.set(
            character.position.x + camOffset.x,
            character.position.y + camOffset.y,
            character.position.z + camOffset.z
        );
        camera.lookAt(character.position);
    }
    
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -d * aspect; camera.right = d * aspect;
    camera.top = d; camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});