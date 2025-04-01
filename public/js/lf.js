import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import Stats from './stats.js';

const apertureInput = document.querySelector('#aperture');
const focusInput = document.querySelector('#focus');
//const stInput = document.querySelector('#stplane');
const loadWrap = document.querySelector('#load-wrap');
const loadBtn = document.querySelector('#load');

const translateX_Input = document.querySelector("#translateX");
const translateY_Input = document.querySelector("#translateY");
const translateZ_Input = document.querySelector("#translateZ");
const resetBtn = document.querySelector("#reset");

let currentX = 0;
let currentY = 0;
let currentZ = 1;

const scene = new THREE.Scene();
let width = window.innerWidth;
let height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, width/height, 1, 100);
const renderer = new THREE.WebGLRenderer();
let fragmentShader, vertexShader;

renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);
camera.position.z = 2;
scene.add(camera);

let fieldTexture;
let plane, planeMat, planePts;
const file_directory = "./public/images/Img_0000168/";
const prefix = "168_image_";
const camsX = 7;
const camsY = 7;
const resX = 352;
const resY = 512;
const cameraGap = 0.1; // cm hardcoded for now
let aperture = Number(apertureInput.value);
let focus = Number(focusInput.value);

let translateX = Number(translateX_Input.value);
let translateY = Number(translateY_Input.value);
let translateZ = Number(translateZ_Input.value);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target = new THREE.Vector3(0,0,1);
controls.panSpeed = 2;

//===========================================
//              STATS for FPS
//===========================================
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width/height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.render(scene, camera);
});

apertureInput.addEventListener('input', e => {
  aperture = Number(apertureInput.value);
  planeMat.uniforms.aperture.value = aperture;
});

focusInput.addEventListener('input', e => {
  focus = Number(focusInput.value);
  planeMat.uniforms.focus.value = focus;
});


translateX_Input.addEventListener('input', e => {
  translateX = Number(translateX_Input.value);
  changeLocationX();
});
translateY_Input.addEventListener('input', e => {
  translateY = Number(translateY_Input.value);
  changeLocationY();
});
translateZ_Input.addEventListener('input', e => {
  translateZ = Number(translateZ_Input.value);
  changeLocationZ();
});

loadBtn.addEventListener('click', async () => {
  loadBtn.setAttribute('disabled', true);
  await loadScene();
});

resetBtn.addEventListener('click', async () => {
  changeLocation();
});

function animate() {
	requestAnimationFrame(animate);
    stats.begin();
    controls.update();
	renderer.render(scene, camera);
  currentX = camera.position.x;
  currentY = camera.position.y;
  currentZ = camera.position.z;
    stats.end();

}

async function loadScene() {
  await loadShaders();
  //await extractVideo();
  await extractLF();
  loadPlane();
  animate();
}

async function loadShaders() {
  vertexShader = await fetch('./public/shader/vertex.glsl').then(res => res.text());
  fragmentShader = await fetch('./public/shader/fragment.glsl').then(res => res.text());
  console.log('Loaded shaders');
}

function changeLocationX(){
  camera.position.x = translateX;
  renderer.render(scene, camera);
}
function changeLocationY(){
  camera.position.y = translateY;
  renderer.render(scene, camera);
}
function changeLocationZ(){
  camera.position.z = translateZ;
  renderer.render(scene, camera);
}

function changeLocation(xx=0,yy=0,zz=2){
    //camera.position.set(0, 0, 2);
    //controls.enabled = false;
    camera.position.z = zz;
    camera.position.x = xx;
    camera.position.y = yy;
    renderer.render(scene, camera);
    //controls.enabled = true;
}

async function extractLF() {
  const img = document.createElement('img');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = resX;
  canvas.height = resY;
  canvas.setAttribute('id', 'videosrc');
  img.src = file_directory+prefix+"3_3.png";
  console.log('starting extraction');
  //=======================================================================//
  async function extractImages() {
    const allBuffer = new Uint8Array(resX * resY * 4 * camsX * camsY);
    let offset = 0;
    for (let i = 0; i < camsX; i++) {
      for (let j = 0; j < camsY; j++) {
        const imageUrl = file_directory+prefix+i+"_"+j+".png"
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const imgData = await createImageBitmap(blob);
        
        const canvas = document.createElement('canvas');
        canvas.width = resX;
        canvas.height = resY;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgData, 0, 0);
  
        const imageData = ctx.getImageData(0, 0, resX, resY);
        allBuffer.set(imageData.data, offset);
        offset += imageData.data.byteLength;
  
        loadBtn.textContent = `Loaded ${Math.round(100 * ((i * camsY + j) + 1) / (camsX * camsY))}%`;
      }
    }
  
    loadWrap.style.display = 'none';
    
    fieldTexture = new THREE.DataTexture2DArray(allBuffer, resX, resY, camsX * camsY);
    console.log('Loaded field data');
    console.log(allBuffer);
  
    planeMat.uniforms.field.value = fieldTexture;
    fieldTexture.needsUpdate = true;

  }
  //=======================================================================//
  img.addEventListener('load', async () => {
    await extractImages();
    console.log('loaded data');
  });
}

function loadPlane() {
  const planeGeo = new THREE.PlaneGeometry(camsX * cameraGap, camsY * cameraGap, camsX, camsY);
  
  planeMat = new THREE.ShaderMaterial({
    uniforms: {
      field: { value: fieldTexture },
      camArraySize: new THREE.Uniform(new THREE.Vector2(camsX, camsY)),
      aperture: { value: aperture },
      focus: { value: focus }
    },
    vertexShader,
    fragmentShader,
  });
  plane = new THREE.Mesh(planeGeo, planeMat);
  const ptsMat = new THREE.PointsMaterial({ size: 0.01, color: 0xeeccff });
  //planePts = new THREE.Points(planeGeo, ptsMat);
  //planePts.visible = stInput.checked;
  //plane.add(planePts);

  scene.add(plane);
  console.log('Loaded plane');
}
