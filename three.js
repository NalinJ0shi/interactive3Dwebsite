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
import Grass from './grass.js';
import Foliage from './Foliage.js';
import Water from './Water.js';
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

const groundShader = {
    uniforms: {
        uColorCenter: { value: new THREE.Color('#b07d54') },
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
let grassField;
// let waterField = new Water(scene, 10);
const grassImg = new Image();
grassImg.src = 'grass_map.png';
grassImg.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = grassImg.width;
    canvas.height = grassImg.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(grassImg, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    grassField = new Grass(scene, 9000, 90, imgData, canvas.width);
};
let targetRotation = 0;
let mixer, walkAction, idleAction,runAction, character;
const clock = new THREE.Clock();
const loader = new GLTFLoader();

let bushField;
const treeTrunks = [];
const texLoader = new THREE.TextureLoader();

texLoader.load('leaf.png', (leafTex) => {
    texLoader.load('matcap.png', (matcapTex) => {
        matcapTex.colorSpace = THREE.SRGBColorSpace;

        loader.load('tree2.glb', (gltf) => {
            const treeModel = gltf.scene;

            for(let i = 0; i < 30; i++) {
                const tree = treeModel.clone();
                const randomX = (Math.random() - 0.5) * 100;
                const randomZ = (Math.random() - 0.5) * 100;
                const s = 3 + Math.random() * 3;

                tree.position.set(randomX, 0, randomZ);
                tree.scale.set(s, s, s);
                tree.rotation.y = Math.random() * Math.PI * 2;
                scene.add(tree);
                treeTrunks.push({ x: randomX, z: randomZ, scale: s });
            }
            bushField = new Foliage(scene, treeTrunks, leafTex, matcapTex);
        });
    });
});
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

const keys = { w: false, a: false, s: false, d: false, shift: false };

window.addEventListener('keydown', (e) => {
    if(e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true;
    if(e.key === 'Shift') keys.shift = true;
});

window.addEventListener('keyup', (e) => {
    if(e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false;
    if(e.key === 'Shift') keys.shift = false;
});
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    if (grassField) grassField.update(time);
    if (bushField) bushField.update(time);
    // if (waterField) waterField.update(time);
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
        }
        else {
            if (idleAction && !idleAction.isRunning()) {
                if (walkAction) walkAction.fadeOut(0.2);
                if (runAction) runAction.fadeOut(0.2);
                idleAction.reset().fadeIn(0.2).play();
            }
        }
        character.rotation.y = lerpAngle(
            character.rotation.y,
            targetRotation,
            0.1
        );

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

    window.addEventListener('resize', () => {
        const aspect = window.innerWidth / window.innerHeight;
        camera.left = -d * aspect; camera.right = d * aspect;
        camera.top = d; camera.bottom = -d;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

