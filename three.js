import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Grass from './grass.js';
import Foliage from './foliage.js';
import Water from './water.js'; 

// --- HELPER FUNCTION ---
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

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(10, 20, 10);
scene.add(sun);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// --- 2. LOADERS ---
const texLoader = new THREE.TextureLoader();
const loader = new GLTFLoader(); 

// --- 3. THE DISPLACEMENT FLOOR ---
const heightTex = texLoader.load('ground_height.jpg');

const floorMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5a524b'), 
    displacementMap: heightTex,
    displacementScale: 15,  
    displacementBias: -7.5, 
    roughness: 0.9,
});

const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150, 128, 128), floorMaterial);
floor.rotation.x = -Math.PI * 0.5;
scene.add(floor);

// --- 4. THE CORAL REEF WATER ---
// We pass heightTex into the water so it knows where the deep parts are!
let waterField = new Water(scene, 150, heightTex); 

// --- 5. THE SMART BOUNCERS (MAP DATA, GRASS, TREES) ---
let grassField;
let bushField;
const treeTrunks = [];

window.terrainData = null; 

const mapImg = new Image();
mapImg.src = 'ground_height.jpg'; 
mapImg.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = mapImg.width;
    canvas.height = mapImg.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(mapImg, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const imgSize = canvas.width;
    
    window.terrainData = { imgData, imgSize };

    grassField = new Grass(scene, 9000, 150, imgData, imgSize);

    texLoader.load('leaf.png', (leafTex) => {
        texLoader.load('matcap.png', (matcapTex) => {
            matcapTex.colorSpace = THREE.SRGBColorSpace;

            loader.load('tree2.glb', (gltf) => {
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
                    const brightness = imgData[pixelIndex];

                    if (brightness < 128) continue; 

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

loader.load('Man+anim3.glb', (gltf) => {
    character = gltf.scene;
    scene.add(character);
    mixer = new THREE.AnimationMixer(character);

    const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Man_Walk');
    const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Man_Idle');
    const runClip = THREE.AnimationClip.findByName(gltf.animations, 'Man_Run');
    
    if (walkClip) {
        walkAction = mixer.clipAction(walkClip);
        walkAction.setLoop(THREE.LoopRepeat);
    }
    if (runClip) {
        runAction = mixer.clipAction(runClip);
        runAction.setLoop(THREE.LoopRepeat);
    }
    if (idleClip) {
        idleAction = mixer.clipAction(idleClip);
        idleAction.setLoop(THREE.LoopRepeat);
        idleAction.play();
    }
});

// --- 7. CONTROLS ---
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
    
    if (grassField) grassField.update(time);
    if (bushField) bushField.update(time);
    if (waterField) waterField.update(time);

    if (character && mixer) {
        let isMoving = keys.w || keys.a || keys.s || keys.d;
        let isRunning = isMoving && keys.shift;

        const speed = isRunning ? 0.3 : 0.15;
        if (isMoving) {
            if (keys.w) { character.position.z -= speed; targetRotation = Math.PI; }
            if (keys.s) { character.position.z += speed; targetRotation = 0; }
            if (keys.a) { character.position.x -= speed; targetRotation = -Math.PI * 0.5; }
            if (keys.d) { character.position.x += speed; targetRotation = Math.PI * 0.5; }
            if (keys.w && keys.d) targetRotation = Math.PI * 0.75;
            if (keys.w && keys.a) targetRotation = -Math.PI * 0.75;
            if (keys.s && keys.d) targetRotation = Math.PI * 0.25;
            if (keys.s && keys.a) targetRotation = -Math.PI * 0.25;
            
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
            if (idleAction && !idleAction.isRunning()) {
                if (walkAction) walkAction.fadeOut(0.2);
                if (runAction) runAction.fadeOut(0.2);
                idleAction.reset().fadeIn(0.2).play();
            }
        }
        
        character.rotation.y = lerpAngle(character.rotation.y, targetRotation, 0.1);
        mixer.update(delta);

        if (window.terrainData) {
            const normalizedX = (character.position.x / 150) + 0.5;
            const normalizedZ = (character.position.z / 150) + 0.5;
            
            const px = Math.max(0, Math.min(window.terrainData.imgSize - 1, Math.floor(normalizedX * window.terrainData.imgSize)));
            const py = Math.max(0, Math.min(window.terrainData.imgSize - 1, Math.floor(normalizedZ * window.terrainData.imgSize)));
            
            const pixelIndex = (py * window.terrainData.imgSize + px) * 4;
            const brightness = window.terrainData.imgData[pixelIndex];
            
            character.position.y = (brightness / 255) * 15 - 7.5;
        }

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

// --- 9. WINDOW RESIZE ---
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -d * aspect; camera.right = d * aspect;
    camera.top = d; camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});