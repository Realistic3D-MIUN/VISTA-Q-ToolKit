// 1_flowers.js
import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import Stats from './stats.js';
import { VRButton } from './VRButton.js';
import { XRControllerModelFactory } from './XRControllerModelFactory.js';
import * as ThreeMeshUI from 'https://cdn.jsdelivr.net/npm/three-mesh-ui@6.4.0/+esm';

// Global variables for tracking
let test_id = "";
let currentMode = null; // 'desktop' or 'vr'
let phase = "start"; // Phases: "start", "presentation", "rating"
let presentationTimer = null;
let isInVR = false;
let isTestMode = true;

// Arrays to keep the results
let sampleID_List = [];
let rating_List = [];

// Test sequence variables
let testSequences = [];
let currentSequenceIndex = 0;

// Rating scale
let ratings = ["Excellent", "Very Good", "Good", "Acceptable", "Poor"]; // Default ratings

// ========================================================
// Get UI elements
// ========================================================
const apertureInput = document.querySelector('#aperture');
const focusInput = document.querySelector('#focus');
const loadWrap = document.querySelector('#load-wrap');
const loadBtn = document.querySelector('#load');
const testIdModal = document.querySelector('#testIdModal');
const modeSelectionModal = document.querySelector('#modeSelectionModal');
const sampleIdDisplay = document.querySelector('#sampleIdDisplay');
const controlsContainer = document.querySelector('#controlsContainer');

let vertexShader, fragmentShader;

// Hide the load button initially
if (loadWrap) loadWrap.style.display = 'none';

// ========================================================
// Create Scene, Camera, and Renderer
// ========================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x808080); // Set black background
let width = window.innerWidth;
let height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);

const cameraRig = new THREE.Group();
camera.position.set(0, 0, 0);
cameraRig.position.set(0, 0, 2);
cameraRig.add(camera);
scene.add(cameraRig);

// Create the renderer and enable WebXR.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// Create VR button but don't append it yet - we'll do that in VR mode
const vrButton = VRButton.createButton(renderer);
vrButton.id = 'VRButton'; // Set ID for CSS targeting
document.body.appendChild(vrButton);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, -2);
controls.panSpeed = 2;

// VR state variables
const vrState = {
  vrViewbox: null,
  trackingActive: false,
  initialHeadPosition: new THREE.Vector3(),
  currentHeadPosition: new THREE.Vector3(),
  trackingOffset: new THREE.Vector3(),
  trackButton: null,
  controller: null,
  raycaster: new THREE.Raycaster(),
  presentationTime: 15, // 15 seconds presentation time
  ratingButtons: [],
  uiContainer: null,
  initialPositionSet: false
};

// ========================================================
// Test Flow Functions
// ========================================================

// Initialize test sequence
async function initTestSequence() {
  try {
    const response = await fetch('./public/Test_Configs/Light_Field_Test_Sequence.csv');
    const text = await response.text();
    const lines = text.split("\n").slice(1); // Skip header
    
    testSequences = lines
      .map(line => line.trim())
      .filter(line => line.length > 0) // Skip empty rows
      .map(line => {
        const [
          sample_id,
          lf_directory_path,
          file_prefix,
          cam_horizontal,
          cam_vertical,
          image_width,
          image_height,
          zoom_factor,
          presentation_time
        ] = line.split(",").map(item => item.trim());
        
        return {
          sample_id,
          lf_directory_path,
          file_prefix,
          cam_horizontal: parseInt(cam_horizontal),
          cam_vertical: parseInt(cam_vertical),
          image_width: parseInt(image_width),
          image_height: parseInt(image_height),
          zoom_factor: parseFloat(zoom_factor),
          presentation_time: parseFloat(presentation_time)
        };
      });
    
    // Shuffle the sequences
    shuffle(testSequences);
    
  } catch (error) {
    console.error("Error loading test sequences:", error);
  }
}

// Shuffle array function
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Load next light field in sequence
async function loadNextLightField() {
  if (currentSequenceIndex >= testSequences.length) {
    showEndOfTest();
    return;
  }

  const sequence = testSequences[currentSequenceIndex];
  currentSequence = sequence; // Store current sequence for VR mode
  phase = "presentation"; // Set phase at the start
  
  try {
    // Make sure the VR viewbox is not visible during loading
    if (currentMode === "vr" && renderer.xr.isPresenting && vrState.vrViewbox) {
      vrState.vrViewbox.visible = false;
    }
    
    // Load shaders if not already loaded
    if (!vertexShader || !fragmentShader) {
      await loadShaders();
    }

    // Update sample ID display before loading starts (desktop mode only)
    if (currentMode === "desktop") {
      sampleIdDisplay.textContent = `Sample ID: ${sequence.sample_id}`;
      // Only show sample ID in trainig mode
      //sampleIdDisplay.style.display = 'block'; // Ensure it's visible
      sampleIdDisplay.visible = isTestMode ? false : true;
    }
    
    // Extract light field images
    await extractLF(
      sequence.lf_directory_path,
      sequence.file_prefix,
      sequence.cam_horizontal,
      sequence.cam_vertical,
      sequence.image_width,
      sequence.image_height
    );

    // Create or update the plane based on mode
    if (currentMode === "desktop") {
      createOrUpdatePlane(sequence.cam_horizontal, sequence.cam_vertical);
      
      // Explicitly make plane visible
      if (plane) {
        plane.visible = true;
      }
      
      // Reset camera position to default for each new light field
      camera.position.set(0, 0, 0);
      cameraRig.position.set(0, 0, 2);
      controls.target.set(0, 0, -2);
      controls.update();
    } else if (currentMode === "vr" && renderer.xr.isPresenting) {
      // If in VR mode, update or create VR plane
      if (vrState.vrViewbox) {
        // Update existing VR plane
        updateVRPlane(sequence.cam_horizontal, sequence.cam_vertical);
      } else {
        // Create new VR plane
        createVRPlane();
      }
      
      // Only make VR plane visible after it has been fully updated
      if (vrState.vrViewbox) {
        vrState.vrViewbox.visible = true;
      }
    }
    
    // Add to sample ID list after successful loading
    sampleID_List.push(sequence.sample_id);
    
    // Start presentation timer
    if (presentationTimer) clearTimeout(presentationTimer);
    presentationTimer = setTimeout(() => {
      if (currentMode === "desktop") {
        showRatingButtons();
      } else if (currentMode === "vr" && renderer.xr.isPresenting) {
        phase = "rating";
        createVRRatingButtons();
      }
    }, sequence.presentation_time * 1000);
    
  } catch (error) {
    console.error("Error loading light field:", error);
    // Move to rating phase even if something unexpected happens
    if (currentMode === "desktop") {
      showRatingButtons();
    } else if (currentMode === "vr" && renderer.xr.isPresenting) {
      phase = "rating";
      createVRRatingButtons();
    }
  }
}

// Show rating buttons
function showRatingButtons() {
  phase = "rating";
  
  // Hide the light field plane
  if (plane) {
    plane.visible = false;
  }
  
  // Hide the sample ID display
  sampleIdDisplay.style.display = 'none';
  
  // Clear the controls container
  controlsContainer.innerHTML = '';
  
  // Create rating buttons container with centered styling
  const ratingContainer = document.createElement('div');
  ratingContainer.style.position = 'fixed';
  ratingContainer.style.left = '50%';
  ratingContainer.style.top = '50%';
  ratingContainer.style.transform = 'translate(-50%, -50%)';
  ratingContainer.style.display = 'flex';
  ratingContainer.style.flexDirection = 'row'; // Changed to row for horizontal layout
  ratingContainer.style.gap = '10px';
  ratingContainer.style.alignItems = 'center';
  ratingContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  ratingContainer.style.padding = '20px';
  ratingContainer.style.borderRadius = '8px';
  ratingContainer.style.flexWrap = 'wrap'; // Allow wrapping on smaller screens
  ratingContainer.style.justifyContent = 'center';
  
  // Create rating buttons
  ratings.forEach(rating => {
    const button = document.createElement('button');
    button.textContent = rating;
    button.className = 'rating-button';
    button.style.minWidth = '180px'; // Minimum width for buttons
    button.onclick = () => handleRating(rating);
    ratingContainer.appendChild(button);
  });
  
  controlsContainer.appendChild(ratingContainer);
}

// Handle rating selection
function handleRating(rating) {
  // Prevent multiple clicks
  if (phase !== "rating") return;
  
  // Save the rating
  rating_List.push(rating);
  console.log('=========================================');
  console.log(`RATING DATA: Sample: ${sampleID_List[currentSequenceIndex]}, Rating: ${rating}`);
  console.log('=========================================');
  
  // Clear the rating buttons immediately
  controlsContainer.innerHTML = '';
  
  // Move to next sequence
  currentSequenceIndex++;
  
  // Check if we're at the end
  if (currentSequenceIndex >= testSequences.length) {
    showEndOfTest();
    return;
  }
  
  // Reset camera position to default
  camera.position.set(0, 0, 0);
  cameraRig.position.set(0, 0, 2);
  controls.target.set(0, 0, -2);
  controls.update();
  
  // Load next sequence without showing sample ID yet (will be shown in loadNextLightField)
  phase = "loading"; // Add a loading phase to prevent interaction
  loadNextLightField();
}

// Show end of test message
function showEndOfTest() {
  phase = "end";
  
  if (currentMode === "desktop") {
    // Desktop mode end of test handling
    
    // Clear the scene
    if (plane) {
      plane.geometry.dispose();
      plane.material.dispose();
      scene.remove(plane);
      plane = null;
    }
    
    // Clear the sample ID display
    sampleIdDisplay.textContent = "";
    sampleIdDisplay.style.display = 'none';
    
    // Create centered thank you message container
    const messageContainer = document.createElement('div');
    messageContainer.style.position = 'fixed';
    messageContainer.style.left = '50%';
    messageContainer.style.top = '50%';
    messageContainer.style.transform = 'translate(-50%, -50%)';
    messageContainer.style.textAlign = 'center';
    messageContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    messageContainer.style.padding = '30px';
    messageContainer.style.borderRadius = '8px';
    messageContainer.style.zIndex = '1000';
    
    // Create thank you message
    const thankYouHeading = document.createElement('h1');
    thankYouHeading.textContent = "Thank you for your participation!";
    thankYouHeading.style.color = '#007bff';
    thankYouHeading.style.fontSize = '24px';
    thankYouHeading.style.marginBottom = '20px';
    
    messageContainer.appendChild(thankYouHeading);
    controlsContainer.innerHTML = '';
    controlsContainer.appendChild(messageContainer);
  } else if (currentMode === "vr" && renderer.xr.isPresenting) {
    // VR mode end of test handling
    showVREndOfTest();
  }
  
  // Send results to server
  sendResults();
}

// Send results to server
async function sendResults() {
  try {
    const response = await fetch('/api/write_light_field_results', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        testID: test_id,
        sceneID: sampleID_List,
        rating: rating_List
      })
    });
    
    const data = await response.json();
    console.log('Server response:', data);
  } catch (error) {
    console.error('Error sending results:', error);
  }
}

// Fetch rating scale from server
async function fetchRatingScale() {
  try {
    const response = await fetch('/api/getACR_Scale/');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    ratings = data;
  } catch (error) {
    console.error('Error fetching rating scale:', error);
    // Keep using default ratings
  }
}

// ========================================================
// Event Listeners
// ========================================================

// Test ID submission
document.getElementById('testIdSubmit').addEventListener('click', () => {
  const input = document.getElementById('testIdInput').value.trim();
  if (input === "") {
    alert("Please enter a valid test ID.");
    return;
  }
  test_id = input;
  testIdModal.style.display = 'none';
  modeSelectionModal.style.display = 'flex';
});

// Mode selection
document.getElementById('desktopMode').addEventListener('click', async () => {
  currentMode = 'desktop';
  modeSelectionModal.style.display = 'none';
  document.body.classList.add('desktop-mode'); // Add class to body for CSS targeting
  await initTestSequence();
  await fetchRatingScale();
  createStartButton();
});

document.getElementById('vrMode').addEventListener('click', async () => {
  console.log('VR mode selected - preparing to enter VR');
  currentMode = 'vr';
  modeSelectionModal.style.display = 'none';
  
  // Add a message to indicate VR is ready
  const vrReadyMessage = document.createElement('div');
  vrReadyMessage.style.position = 'fixed';
  vrReadyMessage.style.left = '50%';
  vrReadyMessage.style.top = '50%';
  vrReadyMessage.style.transform = 'translate(-50%, -50%)';
  vrReadyMessage.style.color = 'white';
  vrReadyMessage.style.fontSize = '24px';
  vrReadyMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  vrReadyMessage.style.padding = '20px';
  vrReadyMessage.style.borderRadius = '10px';
  vrReadyMessage.style.zIndex = '1000';
  vrReadyMessage.textContent = 'VR Mode Ready - Click the VR button to enter';
  document.body.appendChild(vrReadyMessage);
  
  try {
    // Initialize test sequences and rating scale
    console.log('Loading test sequences and rating scale...');
    await initTestSequence();
    await fetchRatingScale();
    
    // Pre-load font textures manually using Image objects
    console.log('Pre-loading font assets for ThreeMeshUI...');
    const fontImagePromise = new Promise((resolve, reject) => {
      const fontImage = new Image();
      fontImage.onload = () => resolve();
      fontImage.onerror = () => reject(new Error('Failed to load font texture'));
      fontImage.src = './public/js/assets/Roboto-msdf.png';
    });
    
    // Pre-load font JSON using fetch
    const fontJsonPromise = fetch('./public/js/assets/Roboto-msdf.json')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load font JSON');
        return response.json();
      });
    
    // Wait for both resources to load
    await Promise.all([fontImagePromise, fontJsonPromise]);
    console.log('Font assets pre-loaded successfully');
    
    // Make sure the VR button is visible
    if (!document.getElementById('VRButton')) {
      document.body.appendChild(VRButton.createButton(renderer));
    }
    
    // Enable XR in the renderer
    renderer.xr.enabled = true;
    
    // Highlight the VR button to make it more noticeable
    const enterVRButton = document.getElementById('VRButton');
    if (enterVRButton) {
      enterVRButton.style.border = '3px solid #00ff00';
      enterVRButton.style.boxShadow = '0 0 10px #00ff00';
    }
    
    console.log('VR mode ready - click VR button to enter');
  } catch (error) {
    console.error('Error preparing for VR mode:', error);
    vrReadyMessage.textContent = 'Error preparing VR mode: ' + error.message;
    vrReadyMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
  }
});

// ========================================================
// Original Light Field Loading and Rendering Code
// ========================================================
let fieldTexture, plane, planeMat;
const file_directory = "./public/examples/images/light_field_images/sample_22/"; // Adjust if necessary.
const prefix = "22_image_";
const camsX = 9;
const camsY = 9;
const resX = 512;
const resY = 512;
const cameraGap = 0.1;
let aperture = Number(apertureInput.value);
let focus = Number(focusInput.value);

async function extractLF(directory, prefix, camX, camY, resX, resY) {
  console.log('Starting extraction of light field images');
  const totalImages = camX * camY;
  const allBuffer = new Uint8Array(resX * resY * 4 * totalImages);
  let offset = 0;
  const startTime = performance.now();
  
  for (let i = 0; i < camX; i++) {
    for (let j = 0; j < camY; j++) {
      const imageUrl = `${directory}${prefix}${i}_${j}.png`;
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error(`Failed to load ${imageUrl}`);
          continue;
        }
        const blob = await response.blob();
        const imgData = await createImageBitmap(blob);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = resX;
        tempCanvas.height = resY;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(imgData, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, resX, resY);
        allBuffer.set(imageData.data, offset);
        offset += imageData.data.byteLength;
        
        // Update loading progress
        const progress = Math.round(100 * ((i * camY + j) + 1) / totalImages);
        if (loadBtn) loadBtn.textContent = `Loaded ${progress}%`;
        console.log(`Loading progress: ${progress}%`);
      } catch (error) {
        console.error(`Error loading image ${imageUrl}:`, error);
      }
    }
  }
  
  const endTime = performance.now();
  console.log(`Extraction took ${endTime - startTime} milliseconds`);
  
  if (loadWrap) loadWrap.style.display = 'none';
  
  fieldTexture = new THREE.DataTexture2DArray(allBuffer, resX, resY, totalImages);
  fieldTexture.needsUpdate = true;
}

function loadDesktopPlane() {
  // Create a plane whose size is determined by the number of cameras and the camera gap.
  const planeGeo = new THREE.PlaneGeometry(camsX * cameraGap, camsY * cameraGap, camsX, camsY);
  
  // Create a ShaderMaterial that uses our light-field texture and our shaders.
  // Note the added uniform `uCameraPos` that will supply the effective eye position.
  planeMat = new THREE.ShaderMaterial({
    uniforms: {
      field: { value: fieldTexture },
      camArraySize: { value: new THREE.Vector2(camsX, camsY) },
      aperture: { value: aperture },
      focus: { value: focus },
      uCameraPos: { value: new THREE.Vector3(0, 0, 2) }
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide, // Render both sides
  });
  
  plane = new THREE.Mesh(planeGeo, planeMat);
  // Position the plane so that it appears in front of the viewer.
  plane.position.z = -2;
  scene.add(plane);
  console.log('Loaded desktop plane');
}

// ========================================================
// Stats Panel for Debugging
// ========================================================
//const stats = new Stats();
//stats.showPanel(0);
//document.body.appendChild(stats.dom);

// ========================================================
// Window Resize Handling
// ========================================================
window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// ========================================================
// UI Event Listeners
// ========================================================
apertureInput.addEventListener('input', () => {
  const aperture = Number(apertureInput.value);
  if (planeMat && planeMat.uniforms.aperture) {
    planeMat.uniforms.aperture.value = aperture;
  }
});

focusInput.addEventListener('input', () => {
  const focus = Number(focusInput.value);
  if (planeMat && planeMat.uniforms.focus) {
    planeMat.uniforms.focus.value = focus;
  }
});

loadBtn.addEventListener('click', async () => {
  loadBtn.setAttribute('disabled', true);
  await loadScene();
});

// ========================================================
// Animation Loop
// ========================================================
function animate() {
  // Only update controls in desktop mode
  if (!renderer.xr.isPresenting && controls) {
    controls.update();
  }
  
  // Update camera position uniform (handles head tracking for VR)
  updateCameraPositionUniform();
  
  // In VR we want to show a hover effect on interactive buttons
  if (renderer.xr.isPresenting && vrState.controller) {
    // Set up raycaster for hover effects
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(vrState.controller.matrixWorld);
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(vrState.controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix);
    raycaster.set(origin, direction);
    
    // Hover effect for the start button (if present)
    if (vrState.uiContainer) {
      // Handle ThreeMeshUI containers
      if (typeof ThreeMeshUI !== 'undefined' && ThreeMeshUI.Block && vrState.uiContainer instanceof ThreeMeshUI.Block) {
        const intersects = raycaster.intersectObject(vrState.uiContainer, true);
        if (intersects.length > 0) {
          if (!vrState.uiContainer.userData.isHovered) {
            vrState.uiContainer.userData.isHovered = true;
            vrState.uiContainer.scale.set(1.2, 1.2, 1.2);
          }
        } else {
          if (vrState.uiContainer.userData.isHovered) {
            vrState.uiContainer.userData.isHovered = false;
            vrState.uiContainer.scale.set(1, 1, 1);
          }
        }
      } 
      // Handle regular meshes or groups
      else {
        const intersects = raycaster.intersectObject(vrState.uiContainer, true);
        if (intersects.length > 0) {
          if (!vrState.uiContainer.userData.isHovered) {
            vrState.uiContainer.userData.isHovered = true;
            vrState.uiContainer.scale.set(1.2, 1.2, 1.2);
          }
        } else {
          if (vrState.uiContainer.userData.isHovered) {
            vrState.uiContainer.userData.isHovered = false;
            vrState.uiContainer.scale.set(1, 1, 1);
          }
        }
      }
    }
    
    // Handle hover effects for rating buttons
    if (phase === "rating" && vrState.ratingButtons && vrState.ratingButtons.length > 0) {
      // Reset all button hover states first
      vrState.ratingButtons.forEach(button => {
        if (button.userData && button.userData.originalScale) {
          let isIntersected = false;
          const intersects = raycaster.intersectObject(button, true);
          
          if (intersects.length > 0) {
            isIntersected = true;
          }
          
          // Handle hover state
          if (isIntersected && !button.userData.isHovered) {
            button.userData.isHovered = true;
            button.scale.copy(button.userData.hoverScale || new THREE.Vector3(1.2, 1.2, 1));
          } else if (!isIntersected && button.userData.isHovered) {
            button.userData.isHovered = false;
            button.scale.copy(button.userData.originalScale || new THREE.Vector3(1, 1, 1));
          }
        }
      });
    }
    
    // Hover effect for exit button - exactly like in mono.html
    const exitButton = scene.getObjectByName("exitButton");
    if (exitButton) {
      const intersects = raycaster.intersectObject(exitButton);
      if (intersects.length > 0) {
        exitButton.scale.lerp(new THREE.Vector3(1.2, 1.2, 1), 0.1);
      } else {
        exitButton.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
    
    // Update ThreeMeshUI if available
    if (typeof ThreeMeshUI !== 'undefined' && typeof ThreeMeshUI.update === 'function') {
      ThreeMeshUI.update();
    }
  }
  
  // Render the scene
  renderer.render(scene, camera);
}

// Handle head tracking in VR mode
function handleVRHeadTracking() {
  if (!vrState.trackingActive || !renderer.xr.isPresenting) return;
  
  // Get current head position
  const xrCamera = renderer.xr.getCamera(camera);
  xrCamera.getWorldPosition(vrState.currentHeadPosition);
  
  // If we haven't set the initial position yet, set it now
  if (!vrState.initialPositionSet) {
    vrState.initialHeadPosition.copy(vrState.currentHeadPosition);
    vrState.initialPositionSet = true;
    console.log('Initial head position set:', vrState.initialHeadPosition);
  }
  
  // Calculate movement since tracking started
  const deltaX = vrState.currentHeadPosition.x - vrState.initialHeadPosition.x;
  const deltaY = vrState.currentHeadPosition.y - vrState.initialHeadPosition.y;
  
  // Scale the movement to appropriate values for the light field
  // Adjust these factors to control the strength of the parallax effect
  const scaleX = 2.0; // Increase scale for more noticeable effect
  const scaleY = 2.0;
  
  // Set tracking offset for camera position uniform
  vrState.trackingOffset.x = deltaX * scaleX;
  vrState.trackingOffset.y = deltaY * scaleY;
  
  // Debug log occasionally (1% chance each frame)
  if (Math.random() < 0.01) {
    console.log(`Head tracking: deltaX=${deltaX.toFixed(3)}, deltaY=${deltaY.toFixed(3)}, offsetX=${vrState.trackingOffset.x.toFixed(3)}, offsetY=${vrState.trackingOffset.y.toFixed(3)}`);
  }
}

// ========================================================
// Scene Loading: Shaders, Light-Field Data, and the Plane
// ========================================================
async function loadScene() {
  await loadShaders();
  await extractLF(file_directory, prefix, camsX, camsY, resX, resY);
  loadDesktopPlane(); // Only load the desktop plane initially
  renderer.setAnimationLoop(animate);
}

// Load shader source code (adjust relative paths if needed).
async function loadShaders() {
  try {
    vertexShader = await fetch('./public/shader/lf_vr/vertex_low.glsl').then(res => res.text());
    fragmentShader = await fetch('./public/shader/lf_vr/fragment_low.glsl').then(res => res.text());
    
    // Modify fragment shader to use black color for out-of-view pixels instead of red
    fragmentShader = fragmentShader.replace(
      "gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);", 
      "gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);"
    );
    
    // Remove the grid lines from the fragment shader
    fragmentShader = fragmentShader.replace(
      `// Visual grid for alignment - show thin grid lines at fixed intervals
    bool isGridLine = false;
    float gridSize = 0.1;
    if (mod(vUv.x, gridSize) < 0.002 || mod(vUv.y, gridSize) < 0.002) {
        isGridLine = true;
    }`, 
      `// Grid lines removed
    bool isGridLine = false;`
    );
    
    fragmentShader = fragmentShader.replace(
      `if (isGridLine) {
        // Mix in a blue grid for alignment
        gl_FragColor = vec4(mix(color.rgb / colorCount, vec3(0.0, 0.0, 1.0), 0.3), 1.0);
    } else {
        gl_FragColor = vec4(color.rgb / colorCount, 1.0);
    }`,
      `// No grid lines, just normal color
    gl_FragColor = vec4(color.rgb / colorCount, 1.0);`
    );
    
    console.log('Loaded and modified shaders - grid lines removed');
  } catch (error) {
    console.error("Error loading shaders:", error);
  }
}

// These functions change the position of the camera rig for desktop testing.
function changeLocationX(x) {
  cameraRig.position.x = x;
  renderer.render(scene, camera);
}
function changeLocationY(y) {
  cameraRig.position.y = y;
  renderer.render(scene, camera);
}
function changeLocationZ(z) {
  cameraRig.position.z = z;
  renderer.render(scene, camera);
}
function changeLocation(xx = 0, yy = 0, zz = 2) {
  cameraRig.position.set(xx, yy, zz);
  renderer.render(scene, camera);
}

// ========================================================
// Modified loadLightField function to work with test sequences
// ========================================================
async function loadLightField(sequence) {
  const {
    lf_directory_path,
    file_prefix,
    cam_horizontal,
    cam_vertical,
    image_width,
    image_height
  } = sequence;

  // Load shaders if not already loaded
  if (!vertexShader || !fragmentShader) {
    await loadShaders();
  }

  // Extract light field images
  await extractLF(
    lf_directory_path,
    file_prefix,
    cam_horizontal,
    cam_vertical,
    image_width,
    image_height
  );

  // Create or update the plane
  createOrUpdatePlane(cam_horizontal, cam_vertical);
}

// Export necessary functions and variables
export {
  scene,
  camera,
  renderer,
  controls,
  loadLightField,
  animate
};

// Create start button for desktop mode
function createStartButton() {
  controlsContainer.innerHTML = '';
  
  // Create a centered container
  const startButtonContainer = document.createElement('div');
  startButtonContainer.style.position = 'fixed';
  startButtonContainer.style.left = '50%';
  startButtonContainer.style.top = '50%';
  startButtonContainer.style.transform = 'translate(-50%, -50%)';
  startButtonContainer.style.textAlign = 'center';
  startButtonContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  startButtonContainer.style.padding = '20px';
  startButtonContainer.style.borderRadius = '8px';
  
  const startButton = document.createElement('button');
  startButton.textContent = 'Start Test';
  startButton.className = 'rating-button';
  startButton.style.fontSize = '24px';
  startButton.style.padding = '15px 30px';
  startButton.style.width = '180px';
  startButton.style.height = '60px';
  startButton.onclick = startTest;
  
  startButtonContainer.appendChild(startButton);
  controlsContainer.appendChild(startButtonContainer);
}

// Start the test
async function startTest() {
  // Remove the start button immediately
  controlsContainer.innerHTML = '';
  
  // Hide the sample ID display until the first light field is loaded
  sampleIdDisplay.style.display = 'none';
  
  // Reset phase to loading
  phase = "loading";
  
  // Reset camera position to default
  camera.position.set(0, 0, 0);
  cameraRig.position.set(0, 0, 2);
  controls.target.set(0, 0, -2);
  controls.update();
  
  // Load shaders first
  await loadShaders();
  
  // Start the test sequence
  loadNextLightField();
}

function createOrUpdatePlane(camX, camY) {
  // Create a plane whose size is determined by the number of cameras and the camera gap
  const planeGeo = new THREE.PlaneGeometry(camX * cameraGap, camY * cameraGap, camX, camY);
  
  // Create a ShaderMaterial that uses our light-field texture and our shaders
  planeMat = new THREE.ShaderMaterial({
    uniforms: {
      field: { value: fieldTexture },
      camArraySize: { value: new THREE.Vector2(camX, camY) },
      aperture: { value: aperture },
      focus: { value: focus },
      uCameraPos: { value: new THREE.Vector3(0, 0, 2) }
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide, // Render both sides
  });
  
  // If plane already exists, just update its geometry and material
  if (plane) {
    plane.geometry.dispose();
    plane.geometry = planeGeo;
    plane.material.dispose();
    plane.material = planeMat;
    // Make sure the plane is at the correct position
    plane.position.set(0, 0, -2);
  } else {
    // Create new plane
    plane = new THREE.Mesh(planeGeo, planeMat);
    // Position the plane so that it appears in front of the viewer
    plane.position.z = -2;
    scene.add(plane);
  }
  
  // Start the animation loop if not already running
  if (!renderer.xr.isPresenting) {
    renderer.setAnimationLoop(animate);
  }
  
  console.log('Created/Updated plane with dimensions:', camX, camY);
}

// Initialize VR features and event listeners
function initVRFeatures() {
  console.log('Initializing VR features');
  
  // Set up XR session event listeners
  renderer.xr.addEventListener('sessionstart', function() {
    console.log('XR session started');
    
    // Disable orbit controls
    if (controls) controls.enabled = false;
    
    // If in desktop mode, hide the plane
    if (plane) plane.visible = false;
    
    // Set up VR environment with a slight delay to let WebXR initialize
    setTimeout(setupVRSession, 200);
  });
  
  renderer.xr.addEventListener('sessionend', function() {
    console.log('XR session ended');
    
    // Clean up VR resources
    cleanupVRSession();
    
    // Enable orbit controls
    if (controls) controls.enabled = true;
    
    // If in desktop mode, show the plane again
    if (currentMode === 'desktop' && plane) {
      plane.visible = true;
    }
  });
  
  
  console.log('VR event listeners registered');
}

// Set up VR button click handler for preloading resources
function setupVRButtonHandler() {
  const vrButton = document.getElementById('vrMode');
  if (!vrButton) return;
  
  vrButton.addEventListener('click', async () => {
    console.log('VR mode button clicked - loading resources');
    
    // Set VR flag and mode
    currentMode = 'vr';
    
    // Show loading indicator
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.style.display = 'block';
    
    try {
      // Load resources sequentially (not in parallel) to avoid memory issues
      console.log('Loading test sequences...');
      await initTestSequence();
      
      console.log('Loading rating scale...');
      await fetchRatingScale();
      
      console.log('Loading shaders...');
      await loadShaders();
      
      console.log('Resources loaded, VR mode ready');
      
      // Hide loading indicator
      if (loadingElement) loadingElement.style.display = 'none';
      
      // Highlight the VR button to indicate it's ready
      vrButton.style.backgroundColor = '#4CAF50';
      vrButton.style.color = 'white';
      vrButton.textContent = 'Enter VR Mode (Ready)';
      
      // Set up the VR session when the user clicks the button again
      vrButton.addEventListener('click', () => {
        console.log('Entering VR session');
        
        // Make sure XR is enabled and reference space is set
        renderer.xr.enabled = true;
        renderer.xr.setReferenceSpaceType('local');
        
        // Simplify entering VR - just click the VR button directly
        if (!document.getElementById('VRButton')) {
          document.body.appendChild(VRButton.createButton(renderer));
        }
        document.getElementById('VRButton').click();
      }, { once: true });
    } catch (error) {
      console.error('Error loading VR resources:', error);
      if (loadingElement) loadingElement.style.display = 'none';
      alert('Failed to load VR resources: ' + error.message);
    }
  }, { once: true });
}

// ========================================================
// Initialize all features
// ========================================================
function init() {
  console.log('Initializing application');
  
  // Basic renderer setup 
  renderer.xr.enabled = true;
  
  // Set reference space type for VR
  renderer.xr.setReferenceSpaceType('local');
  
  // Create Exit VR button using ThreeMeshUI but initially hide it (exactly like mono.html)
  if (typeof ThreeMeshUI !== 'undefined' && ThreeMeshUI.Block) {
    try {
      const exitContainer = new ThreeMeshUI.Block({
        width: 0.6,
        height: 0.2,
        padding: 0.05,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: "./public/js/assets/Roboto-msdf.json",
        fontTexture: "./public/js/assets/Roboto-msdf.png",
        fontSize: 0.05,
        borderRadius: 0.05,
        backgroundColor: new THREE.Color(0xff4444),
        backgroundOpacity: 1
      });

      const exitText = new ThreeMeshUI.Text({
        content: 'Exit VR',
        fontColor: new THREE.Color(0xffffff),
        fontSize: 0.05,
        textAlign: 'center',
        textShadow: true,
        textShadowColor: new THREE.Color(0x000000),
        textShadowBlur: 0.01
      });

      exitContainer.add(exitText);
      exitContainer.position.set(0, 0.8, -2);
      exitContainer.name = "exitButton";
      exitContainer.visible = false; // Initially hide the exit button
      scene.add(exitContainer);
      console.log('Exit VR button created and hidden');
    } catch (error) {
      console.error('Error creating exit button:', error);
    }
  }
  
  // Add ambient light to scene for better visibility
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Setup VR features
  initVRFeatures();
  
  // Setup desktop mode if needed
  if (currentMode === 'desktop') {
    initDesktopMode();
  }
  
  // Create listener for window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // Start the animation loop
  renderer.setAnimationLoop(animate);
}

// Wait for the DOM to be loaded, then initialize
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - initializing application');
  init();
});

// Update camera position uniform
function updateCameraPositionUniform() {
  // For desktop view
  if (!renderer.xr.isPresenting) {
    if (planeMat && planeMat.uniforms.uCameraPos) {
      planeMat.uniforms.uCameraPos.value.copy(camera.getWorldPosition(new THREE.Vector3()));
    }
  } 
  // For VR view
  else if (vrState.vrViewbox && vrState.vrViewbox.material && vrState.vrViewbox.material.uniforms) {
    // Always ensure head tracking is updated if tracking is active
    if (vrState.trackingActive) {
      handleVRHeadTracking();
    }
    
    // Get the current uniform value
    const uniformValue = vrState.vrViewbox.material.uniforms.uCameraPos.value;
    
    // Set camera position using tracking offsets
    // Apply head movement offsets if tracking is active, otherwise use default position
    if (vrState.trackingActive) {
      uniformValue.set(
        vrState.trackingOffset.x, 
        vrState.trackingOffset.y, 
        1.0  // Fixed Z position for correct light field rendering
      );
      
      // Debug log once per second to avoid spam
      if (Math.random() < 0.01) {
        console.log('VR Camera Pos with tracking:', 
          uniformValue.x.toFixed(3),
          uniformValue.y.toFixed(3),
          uniformValue.z.toFixed(3),
          'Tracking active:',
          vrState.trackingActive
        );
      }
    } else {
      // Default position when tracking is off
      uniformValue.set(0, 0, 1.0);
    }
  }
}

// ========================================================
// Setup VR Session - following mono.html approach
// ========================================================
function setupVRSession() {
  console.log('Setting up VR session');
  
  // Clear existing controllers
  if (vrState.controller) {
    vrState.controller.removeEventListener('selectstart', onControllerSelectStart);
    vrState.controller.removeEventListener('selectend', onControllerSelectEnd);
    scene.remove(vrState.controller);
  }
  
  if (vrState.controllerGrip) {
    scene.remove(vrState.controllerGrip);
  }
  
  // Initialize controller
  vrState.controller = renderer.xr.getController(0);
  vrState.controller.addEventListener('selectstart', onControllerSelectStart);
  vrState.controller.addEventListener('selectend', onControllerSelectEnd);
  scene.add(vrState.controller);
  
  // Create a controller grip and add the controller model
  const controllerModelFactory = new XRControllerModelFactory();
  vrState.controllerGrip = renderer.xr.getControllerGrip(0);
  vrState.controllerGrip.add(controllerModelFactory.createControllerModel(vrState.controllerGrip));
  scene.add(vrState.controllerGrip);
  
  // Create a line geometry that points forward from the controller
  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);
  const rayMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // red line for visibility
  const rayLine = new THREE.Line(rayGeometry, rayMaterial);
  rayLine.name = 'controllerRay';
  rayLine.scale.z = 5; // Extend the ray length as needed
  vrState.controller.add(rayLine);
  
  // Always enable head tracking in VR mode by default
  vrState.trackingActive = true;
  vrState.initialPositionSet = false;
  
  // Create the track button
  createTrackButton();
  
  console.log('VR controller and head tracking setup complete');
  
  // Create simple start button with ThreeMeshUI with a slight delay
  // to ensure everything is properly initialized
  setTimeout(() => {
    createSimpleVRStartButton();
  }, 500);
}

// ========================================================
// Create simple VR Start Button using ThreeMeshUI
// ========================================================
function createSimpleVRStartButton() {
  console.log('Creating simple ThreeMeshUI start button');
  
  // Check if ThreeMeshUI is available and has Block component
  if (typeof ThreeMeshUI !== 'undefined' && ThreeMeshUI.Block) {
    try {
      // Create container with explicit paths to fonts - match mono.html style
      const container = new ThreeMeshUI.Block({
        width: 0.6,
        height: 0.2,
        padding: 0.05,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: "./public/js/assets/Roboto-msdf.json",
        fontTexture: "./public/js/assets/Roboto-msdf.png",
        fontSize: 0.05,
        borderRadius: 0.05,
        backgroundColor: new THREE.Color(0x007bff),
        backgroundOpacity: 1
      });
      
      // Position container in front of the user at eye level
      container.position.set(0, 0, -0.5);
      scene.add(container);
      
      // Create text
      const buttonText = new ThreeMeshUI.Text({
        content: 'START TEST',
        fontColor: new THREE.Color(0xffffff)
      });
      
      // Add text to container
      container.add(buttonText);
      
      // Set up hover effect data
      container.userData.originalScale = new THREE.Vector3(1, 1, 1);
      container.userData.hoverScale = new THREE.Vector3(1.2, 1.2, 1);
      container.userData.isHovered = false;
      
      // Store for later use
      vrState.uiContainer = container;
      
      console.log('ThreeMeshUI start button created - positioned at:', container.position);
      return;
    } catch (error) {
      console.error('Error creating ThreeMeshUI button:', error);
    }
  } else {
    console.warn('ThreeMeshUI is not properly initialized, falling back to basic THREE.js');
  }
  
  // If we get here, either ThreeMeshUI wasn't available or there was an error
  // Fall back to a simple mesh
  createFallbackStartButton();
}

// Create a fallback start button using basic THREE.js meshes
function createFallbackStartButton() {
  console.log('Creating fallback start button');
  
  // Create a simple colored plane
  const geometry = new THREE.PlaneGeometry(0.6, 0.2);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0x007bff,
    side: THREE.DoubleSide
  });
  
  const buttonMesh = new THREE.Mesh(geometry, material);
  buttonMesh.position.set(0, 0, -1.0);
  scene.add(buttonMesh);
  
  // Create text on a canvas
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 64;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("START TEST", canvas.width / 2, canvas.height / 2 + 10);
  
  const textTexture = new THREE.CanvasTexture(canvas);
  const textMaterial = new THREE.MeshBasicMaterial({ 
    map: textTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  
  const textMesh = new THREE.Mesh(geometry, textMaterial);
  textMesh.position.set(0, 0, 0.001); // Slightly in front of the button
  buttonMesh.add(textMesh);
  
  // Group both meshes
  const buttonGroup = new THREE.Group();
  buttonGroup.add(buttonMesh);
  buttonGroup.add(textMesh);
  buttonGroup.position.set(0, 0, -1.0);
  scene.add(buttonGroup);
  
  // Add hover data
  buttonGroup.userData.originalScale = new THREE.Vector3(1, 1, 1);
  buttonGroup.userData.hoverScale = new THREE.Vector3(1.2, 1.2, 1);
  buttonGroup.userData.isHovered = false;
  
  // Store for later use
  vrState.uiContainer = buttonGroup;
  
  console.log('Fallback start button created');
}

// ========================================================
// Controller interaction
// ========================================================
function onControllerSelectStart(event) {
  console.log('Controller select start event');
  
  if (!vrState.controller) {
    return;
  }
  
  // Create raycaster from controller
  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(vrState.controller.matrixWorld);
  const origin = new THREE.Vector3();
  origin.setFromMatrixPosition(vrState.controller.matrixWorld);
  const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix);
  raycaster.set(origin, direction);
  
  // Check for exit button interaction - exactly like mono.html
  const exitButton = scene.getObjectByName("exitButton");
  const exitButtonMesh = scene.getObjectByName("exitButton");
  if (exitButtonMesh) {
    const intersects = raycaster.intersectObject(exitButtonMesh);
    if (intersects.length > 0 && renderer.xr.isPresenting) {
      const session = renderer.xr.getSession();
      if (session) session.end();
      cleanupAndReset();
      return;
    }
  }

  if (exitButton) {
    const intersects = raycaster.intersectObject(exitButton);
    if (intersects.length > 0) {
      console.log("Exit VR button clicked");
      if (renderer.xr.isPresenting) {
        renderer.xr.getSession().end();
      }
      // Clean up and reset state
      cleanupAndReset();
      return;
    }
  }
  
  // Check if the track button was clicked
  if (vrState.trackButton) {
    const intersects = raycaster.intersectObject(vrState.trackButton, true);
    if (intersects.length > 0) {
      console.log('Track button clicked!');
      
      // Toggle tracking
      vrState.trackingActive = !vrState.trackingActive;
      
      // Update button color for visual feedback
      if (vrState.trackButton.material) {
        vrState.trackButton.material.color.set(vrState.trackingActive ? 0x00ff00 : 0xff0000);
      }
      
      // Reset initial position when activating tracking
      if (vrState.trackingActive) {
        vrState.initialPositionSet = false;
        console.log('Tracking activated');
      } else {
        console.log('Tracking deactivated');
      }
      
      return; // Don't process other interactions if track button was clicked
    }
  }
  
  // Check UI container (start button) interaction
  if (vrState.uiContainer && phase === 'start') {
    console.log('Checking for start button interaction');
    const intersects = raycaster.intersectObject(vrState.uiContainer, true);
    if (intersects.length > 0) {
      console.log('Start button hit!');
      if (vrState.uiContainer) {
        scene.remove(vrState.uiContainer);
        vrState.uiContainer = null;
      }
      
      // Call the handler (at the next frame to avoid issues)
      setTimeout(() => {
        handleVRStartButtonClick();
      }, 10);
      
      return;
    }
  }
  
  // Check rating buttons interaction
  if (phase === "rating" && vrState.ratingButtons && vrState.ratingButtons.length > 0) {
    for (let i = 0; i < vrState.ratingButtons.length; i++) {
      const button = vrState.ratingButtons[i];
      const intersects = raycaster.intersectObject(button, true);
      
      if (intersects.length > 0 && button.userData && button.userData.rating) {
        handleVRRatingButtonClick(button.userData.rating);
        return;
      }
    }
  }
}

function onControllerSelectEnd(event) {
  console.log('Controller select end event');
}

// ========================================================
// Update ThreeMeshUI elements in animation loop
// ========================================================
function updateVRUI() {
  if (!renderer.xr.isPresenting) return;
  
  // Update ThreeMeshUI elements
  ThreeMeshUI.update();
}

// ========================================================
// Clean up VR session resources
// ========================================================
function cleanupVRSession() {
  if (vrState.controller) {
    vrState.controller.removeEventListener('selectstart', onControllerSelectStart);
    vrState.controller.removeEventListener('selectend', onControllerSelectEnd);
  }
  
  if (vrState.trackButton) {
    scene.remove(vrState.trackButton);
    vrState.trackButton = null;
  }
  
  // Remove VR-specific plane
  if (vrState.vrViewbox) {
    scene.remove(vrState.vrViewbox);
    vrState.vrViewbox = null;
  }
  
  // Show the regular plane again
  if (plane) {
    plane.visible = true;
  }
  
  // Reset tracking state
  vrState.trackingActive = false;
  vrState.initialPositionSet = false;
  
  console.log('VR session cleaned up');
}

// ========================================================
// Clean up and reset application state
// ========================================================
function cleanupAndReset() {
  console.log('Cleaning up and resetting application state');
  
  // First, clean up VR session resources
  cleanupVRSession();
  
  // Remove any remaining VR UI elements
  removeVRRatingButtons();
  
  // Reset state variables to initial values
  phase = "start";
  currentSequenceIndex = 0;
  sampleID_List = [];
  rating_List = [];
  
  // Create a new start button if we want to stay in VR mode
  // or wait for the user to select a new mode
  if (document.getElementById('modeSelectionModal')) {
    document.getElementById('modeSelectionModal').style.display = 'flex';
  } else {
    // If there's no mode selection modal, recreate the start button
    setTimeout(() => {
      createSimpleVRStartButton();
    }, 500);
  }
  
  console.log('Application state reset complete');
}

// ========================================================
// Create VR Plane
// ========================================================
function createVRPlane() {
  console.log('Creating VR plane');
  
  if (!fragmentShader || !vertexShader) {
    console.error('Shaders not loaded for VR plane');
    return;
  }
  
  if (!fieldTexture) {
    console.error('Field texture not loaded for VR plane');
    return;
  }
  
  console.log('Building VR light field plane...');
  
  try {
    // Get the current sequence
    const currentSequence = testSequences[currentSequenceIndex];
    if (!currentSequence) {
      console.error('No current sequence available');
      return;
    }
    
    // Create material with identical uniforms to desktop mode
    const vrPlaneMat = new THREE.ShaderMaterial({
      uniforms: {
        field: { value: fieldTexture },
        camArraySize: { value: new THREE.Vector2(
          currentSequence.cam_horizontal, 
          currentSequence.cam_vertical
        )},
        aperture: { value: aperture },
        focus: { value: focus },
        uCameraPos: { value: new THREE.Vector3(0, 0, 1.0) }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.DoubleSide
    });
    
    // Extract zoom factor from current sequence
    const zoomFactor = currentSequence.zoom_factor || 1.0;
    // Calculate Z position based on zoom factor
    const zPosition = zoomFactor - 1.0;
    
    console.log(`Using zoom_factor: ${zoomFactor}, setting Z position to: ${zPosition}`);
    
    // Create or update geometry
    if (!vrState.vrViewbox) {
      // Create new plane with original dimensions for proper scale
      const planeGeometry = new THREE.PlaneGeometry(
        currentSequence.cam_horizontal * cameraGap, 
        currentSequence.cam_vertical * cameraGap, 
        currentSequence.cam_horizontal,
        currentSequence.cam_vertical
      );
      
      vrState.vrViewbox = new THREE.Mesh(planeGeometry, vrPlaneMat);
      
      // Position the plane using zoom factor for Z position
      // Note: In Three.js, NEGATIVE Z is in front of the camera!
      vrState.vrViewbox.position.set(0, 0, zPosition);
      vrState.vrViewbox.rotation.set(0, 0, 0);
      
      // Initially set visibility to false - loadNextLightField will control this
      vrState.vrViewbox.visible = false;
      
      scene.add(vrState.vrViewbox);
      console.log('New VR plane created at position:', vrState.vrViewbox.position);
    } else {
      // Update existing plane
      vrState.vrViewbox.geometry.dispose();
      vrState.vrViewbox.material.dispose();
      
      vrState.vrViewbox.geometry = new THREE.PlaneGeometry(
        currentSequence.cam_horizontal * cameraGap, 
        currentSequence.cam_vertical * cameraGap, 
        currentSequence.cam_horizontal,
        currentSequence.cam_vertical
      );
      vrState.vrViewbox.material = vrPlaneMat;
      
      // Update position based on zoom factor
      vrState.vrViewbox.position.set(0, 0, zPosition);
      vrState.vrViewbox.rotation.set(0, 0, 0);
      
      // Don't set visibility here - loadNextLightField will control this
      vrState.vrViewbox.visible = false;
      
      console.log('Existing VR plane updated at position:', vrState.vrViewbox.position);
    }
    
    // Reset tracking state
    vrState.trackingActive = true;
    vrState.initialPositionSet = false;
    
    console.log('VR plane setup complete, tracking active');
  } catch (error) {
    console.error('Error creating VR plane:', error);
  }
}

// ========================================================
// Create VR Rating Buttons 
// ========================================================
function createVRRatingButtons() {
  console.log('Creating VR rating buttons');
  
  // Hide the VR viewbox when showing rating buttons
  if (vrState.vrViewbox) {
    console.log('Hiding VR viewbox for rating phase');
    vrState.vrViewbox.visible = false;
  }
  
  // Clean up any existing buttons
  removeVRRatingButtons();

  // Create a container for organizing the buttons
  const buttonContainer = new THREE.Group();
  buttonContainer.position.set(0, 0, -0.5); // Same height as start button, in front of user
  scene.add(buttonContainer);
  
  // Check if ThreeMeshUI is properly initialized first
  if (typeof ThreeMeshUI !== 'undefined' && ThreeMeshUI.Block) {
    try {
      // First try using ThreeMeshUI
      createThreeMeshUIRatingButtons(buttonContainer);
      return;
    } catch (error) {
      console.error('Error creating ThreeMeshUI rating buttons:', error);
    }
  } else {
    console.warn('ThreeMeshUI not available for rating buttons, using fallback');
  }
  
  // If we reach here, use the fallback method
  createFallbackRatingButtons(buttonContainer);
}

// Create rating buttons using ThreeMeshUI
function createThreeMeshUIRatingButtons(buttonContainer) {
  console.log('Creating ThreeMeshUI rating buttons');
  
  // Create a title above the buttons using ThreeMeshUI
  const titleContainer = new ThreeMeshUI.Block({
    width: 0.8,
    height: 0.15,
    padding: 0.02,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: "./public/js/assets/Roboto-msdf.json",
    fontTexture: "./public/js/assets/Roboto-msdf.png",
    fontSize: 0.05,
    backgroundColor: new THREE.Color(0x000000),
    backgroundOpacity: 0.7
  });
  
  const titleText = new ThreeMeshUI.Text({
    content: 'Please rate the quality',
    fontColor: new THREE.Color(0xffffff),
  });
  
  titleContainer.add(titleText);
  titleContainer.position.set(0, 0.2, 0);
  buttonContainer.add(titleContainer);
  vrState.ratingButtons.push(titleContainer);
  
  // Calculate layout based on number of ratings - similar to mono.html
  const buttonWidth = 0.6;
  const buttonHeight = 0.2;
  const spacing = 0.05;
  const totalWidth = (buttonWidth * ratings.length) + (spacing * (ratings.length - 1));
  const startX = -totalWidth / 2 + buttonWidth / 2;
  
  // Create each rating button
  ratings.forEach((rating, index) => {
    // Create button with ThreeMeshUI - using consistent style
    const ratingContainer = new ThreeMeshUI.Block({
      width: buttonWidth,
      height: buttonHeight,
      padding: 0.02,
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: "./public/js/assets/Roboto-msdf.json",
      fontTexture: "./public/js/assets/Roboto-msdf.png",
      fontSize: 0.04,
      borderRadius: 0.02,
      backgroundColor: new THREE.Color(0x007bff), // All buttons use the same color - blue
      backgroundOpacity: 0.9
    });
    
    // Add rating text
    const ratingText = new ThreeMeshUI.Text({
      content: rating,
      fontColor: new THREE.Color(0xffffff),
    });
    
    ratingContainer.add(ratingText);
    
    // Position in a row
    ratingContainer.position.set(startX + (index * (buttonWidth + spacing)), 0, 0);
    
    // Store rating in userData for interaction
    ratingContainer.userData.rating = rating;
    // Add original scale for hover effect
    ratingContainer.userData.originalScale = new THREE.Vector3(1, 1, 1);
    ratingContainer.userData.hoverScale = new THREE.Vector3(1.2, 1.2, 1);
    ratingContainer.userData.isHovered = false;
    
    // Add to container and tracking array
    buttonContainer.add(ratingContainer);
    vrState.ratingButtons.push(ratingContainer);
  });
  
  console.log('Created', ratings.length, 'ThreeMeshUI rating buttons');
}

// Create fallback rating buttons using basic THREE.js meshes
function createFallbackRatingButtons(buttonContainer) {
  console.log('Creating fallback rating buttons');
  
  // Create title first
  const titleCanvas = document.createElement('canvas');
  titleCanvas.width = 768;
  titleCanvas.height = 256;
  const titleCtx = titleCanvas.getContext('2d');
  titleCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  titleCtx.fillRect(0, 0, titleCanvas.width, titleCanvas.height);
  titleCtx.fillStyle = '#FFFFFF';
  titleCtx.font = 'bold 46px Arial';
  titleCtx.textAlign = 'center';
  titleCtx.textBaseline = 'middle';
  titleCtx.fillText('Please rate the quality', titleCanvas.width / 2, titleCanvas.height / 2);
  
  const titleTexture = new THREE.CanvasTexture(titleCanvas);
  const titleMaterial = new THREE.MeshBasicMaterial({
    map: titleTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  
  const titleGeometry = new THREE.PlaneGeometry(0.8, 0.2);
  const titleMesh = new THREE.Mesh(titleGeometry, titleMaterial);
  titleMesh.position.set(0, 0.2, 0);
  buttonContainer.add(titleMesh);
  vrState.ratingButtons.push(titleMesh);
  
  // Calculate layout - use same dimensions as ThreeMeshUI buttons
  const buttonWidth = 0.6;
  const buttonHeight = 0.2;
  const spacing = 0.05;
  const totalWidth = (buttonWidth * ratings.length) + (spacing * (ratings.length - 1));
  const startX = -totalWidth / 2 + buttonWidth / 2;
  
  // Create each button
  ratings.forEach((rating, index) => {
    // Create button background
    const buttonGeometry = new THREE.PlaneGeometry(buttonWidth, buttonHeight);
    const buttonMaterial = new THREE.MeshBasicMaterial({
      color: 0x007bff, // Same blue color for all buttons
      side: THREE.DoubleSide
    });
    
    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
    buttonMesh.position.set(startX + (index * (buttonWidth + spacing)), 0, 0);
    buttonContainer.add(buttonMesh);
    
    // Create text label
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 46px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rating, canvas.width / 2, canvas.height / 2);
    
    const textTexture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    const textMesh = new THREE.Mesh(buttonGeometry, textMaterial);
    textMesh.position.set(0, 0, 0.001); // Slightly in front of button
    buttonMesh.add(textMesh);
    
    // Store rating in userData
    buttonMesh.userData.rating = rating;
    // Add scale data for hover effects
    buttonMesh.userData.originalScale = new THREE.Vector3(1, 1, 1);
    buttonMesh.userData.hoverScale = new THREE.Vector3(1.2, 1.2, 1);
    buttonMesh.userData.isHovered = false;
    
    // Add to tracking array
    vrState.ratingButtons.push(buttonMesh);
  });
  
  console.log('Created', ratings.length, 'fallback rating buttons');
}

// ========================================================
// Handle VR Start Button Click
// ========================================================
async function handleVRStartButtonClick() {
  console.log('VR start button clicked');
  
  // Prevent multiple clicks
  if (phase !== "start" && phase !== "loading") {
    console.log('Ignoring click - not in start or loading phase');
    return;
  }
  
  // Change phase immediately
  phase = "loading";
  
  // Remove the start button if still present
  if (vrState.uiContainer) {
    scene.remove(vrState.uiContainer);
    vrState.uiContainer = null;
  }
  
  // Create loading message
  const loadingMessage = createVRMessage('Loading light field...', 0x3498db);
  
  try {
    // Reset current sequence index
    currentSequenceIndex = 0;
    
    // Reset results arrays
    sampleID_List = [];
    rating_List = [];
    
    console.log('Initializing test sequence');
    
    // Ensure we have test sequences
    if (!testSequences || testSequences.length === 0) {
      console.log('No test sequences available, loading test sequences');
      await initTestSequence();
    }
    
    if (!testSequences || testSequences.length === 0) {
      throw new Error('Failed to load test sequences');
    }
    
    // Make sure shaders are loaded
    if (!vertexShader || !fragmentShader) {
      console.log('Shaders not loaded, loading now');
      await loadShaders();
    }
    
    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to load shaders');
    }
    
    console.log('Test sequences loaded:', testSequences.length);
    console.log('Shaders loaded successfully');
    
    // Set up tracking and make sure it's enabled
    vrState.trackingActive = true;
    vrState.initialPositionSet = false;
    
    // Load the first light field
    console.log('Loading first light field');
    await loadNextLightField();
    
    // Change phase to presentation
    phase = "presentation";
    
    // Remove loading message
    scene.remove(loadingMessage);
    
    console.log('VR test started successfully, now in presentation phase');
  } catch (error) {
    console.error('Error starting VR test:', error);
    
    // Remove loading message and show error
    scene.remove(loadingMessage);
    createVRMessage(`Error: ${error.message}\nTry exiting VR and restarting`, 0xff0000);
    
    // Reset phase
    phase = "start";
    
    // Create a new start button after 3 seconds
    setTimeout(() => {
      createSimpleVRStartButton();
    }, 3000);
  }
}

// ========================================================
// Handle VR Rating Button Click
// ========================================================
function handleVRRatingButtonClick(rating) {
  console.log('VR rating button clicked:', rating);
  
  // Get the current sample ID
  const currentSampleID = sampleID_List[sampleID_List.length - 1];
  
  // Log the rating data
  console.log(`Rating recorded: Sample=${currentSampleID}, Rating=${rating}`);
  
  // Add to ratings data
  rating_List.push(rating);
  
  // Remove rating buttons
  removeVRRatingButtons();
  
  // Increment sequence index
  currentSequenceIndex++;
  
  // Check if we've reached the end of the test
  if (currentSequenceIndex >= testSequences.length) {
    showVREndOfTest();
  } else {
    // Show loading message for next sample
    const loadingMessage = createVRMessage('Loading next sample...', 0x3498db);
    
    // Load the next light field with a slight delay
    setTimeout(() => {
      scene.remove(loadingMessage);
      
      // Don't make the old vrViewbox visible before loading the new light field
      // We'll let loadNextLightField handle the visibility
      
      loadNextLightField();
    }, 1000);
  }
}

// ========================================================
// Show VR End of Test
// ========================================================
function showVREndOfTest() {
  console.log('Showing VR end of test');
  
  // Clean up the light field plane
  if (vrState.vrViewbox) {
    // Dispose of materials and geometry
    if (vrState.vrViewbox.material) {
      vrState.vrViewbox.material.dispose();
    }
    if (vrState.vrViewbox.geometry) {
      vrState.vrViewbox.geometry.dispose();
    }
    
    // Remove from scene
    scene.remove(vrState.vrViewbox);
    vrState.vrViewbox = null;
  }
  
  // Create thank you message
  createVRThankYouMessage();
  
  // Show the exit button
  const exitButton = scene.getObjectByName("exitButton");
  if (exitButton) {
    exitButton.visible = true;
    console.log('Exit button made visible');
  } else {
    console.log('Exit button not found, creating new one');
    // Create Exit VR button using ThreeMeshUI
    const exitContainer = new ThreeMeshUI.Block({
      width: 0.6,
      height: 0.2,
      padding: 0.05,
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: "./public/js/assets/Roboto-msdf.json",
      fontTexture: "./public/js/assets/Roboto-msdf.png",
      fontSize: 0.05,
      borderRadius: 0.05,
      backgroundColor: new THREE.Color(0xff4444),
      backgroundOpacity: 1
    });

    const exitText = new ThreeMeshUI.Text({
      content: 'Exit VR',
      fontColor: new THREE.Color(0xffffff),
      fontSize: 0.05,
      textAlign: 'center',
      textShadow: true,
      textShadowColor: new THREE.Color(0x000000),
      textShadowBlur: 0.01
    });

    exitContainer.add(exitText);
    exitContainer.position.set(0, 0.8, -2);
    exitContainer.name = "exitButton";
    exitContainer.visible = true;
    scene.add(exitContainer);
  }
  
  // Send results to server
  sendResults();
}

// ========================================================
// Create VR Message
// ========================================================
function createVRMessage(message, color = 0x3498db) {
  // Create a container for the message
  const container = new THREE.Group();
  container.position.set(0, 0, -1.0);
  scene.add(container);
  
  // Create background panel
  const panelGeometry = new THREE.PlaneGeometry(0.6, 0.3);
  const panelMaterial = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  
  const panel = new THREE.Mesh(panelGeometry, panelMaterial);
  container.add(panel);
  
  // Create text
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 32px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#ffffff';
  
  // Handle multi-line messages
  const lines = message.split('\n');
  const lineHeight = 40;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  
  lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });
  
  const texture = new THREE.CanvasTexture(canvas);
  const textMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide
  });
  
  const textPlane = new THREE.Mesh(panelGeometry, textMaterial);
  textPlane.position.set(0, 0, 0.001);
  container.add(textPlane);
  
  // Add to tracking list for cleanup
  vrState.ratingButtons.push(container);
  
  return container;
}

// ========================================================
// Handle VR controller selection
// ========================================================
function onSelectVR(event) {
  console.log('VR controller select triggered');
  
  // Use raycaster to check for intersections with UI elements
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(vrState.controller.matrixWorld);
  
  vrState.raycaster.ray.origin.setFromMatrixPosition(vrState.controller.matrixWorld);
  vrState.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  
  // Check for button interactions based on current phase
  if (phase === "start" && vrState.trackButton) {
    const intersects = vrState.raycaster.intersectObject(vrState.trackButton);
    
    if (intersects.length > 0) {
      console.log('Start button hit!');
      // Start button clicked
      handleVRStartButtonClick();
    }
  } else if (phase === "rating" && vrState.ratingButtons.length > 0) {
    // Check intersections with all rating buttons
    const intersects = vrState.raycaster.intersectObjects(vrState.ratingButtons);
    
    if (intersects.length > 0) {
      // Get the hit object
      const hitObject = intersects[0].object;
      
      // Find the rating from userData
      const rating = hitObject.userData.rating || hitObject.parent?.userData?.rating;
      
      if (rating) {
        console.log('Rating selected:', rating);
        handleVRRatingButtonClick(rating);
      }
    }
  }
  
  // Check for exit button interaction - copied exactly from mono.html
  const exitButton = scene.getObjectByName("exitButton");
  const exitButtonMesh = scene.getObjectByName("exitButton");
  if (exitButtonMesh) {
    const intersects = vrState.raycaster.intersectObject(exitButtonMesh);
    if (intersects.length > 0 && renderer.xr.isPresenting) {
      const session = renderer.xr.getSession();
      if (session) session.end();
      cleanupAndReset();
    }
  }

  if (exitButton) {
    const intersects = vrState.raycaster.intersectObject(exitButton);
    if (intersects.length > 0) {
      console.log("Exit VR button clicked");
      if (renderer.xr.isPresenting) {
        renderer.xr.end();
      }
      // Clean up and reset state
      cleanupAndReset();
    }
  }
}

// Reference to current sequence for VR mode
let currentSequence = null;

// Update VR plane with new dimensions
function updateVRPlane(camX, camY) {
  if (!vrState.vrViewbox || !fieldTexture) return;
  
  // Get the current sequence for zoom factor
  const currentSequence = testSequences[currentSequenceIndex];
  if (!currentSequence) {
    console.error('No current sequence available for updating VR plane');
    return;
  }
  
  // Extract zoom factor and calculate Z position
  const zoomFactor = currentSequence.zoom_factor || 1.0;
  const zPosition = zoomFactor - 1.0;
  
  console.log(`Updating VR plane with zoom_factor: ${zoomFactor}, Z position: ${zPosition}`);
  
  // Create new geometry with correct dimensions
  const newGeometry = new THREE.PlaneGeometry(
    camX * cameraGap,
    camY * cameraGap,
    camX,
    camY
  );
  
  // Create new material with updated texture
  const newMaterial = new THREE.ShaderMaterial({
    uniforms: {
      field: { value: fieldTexture },
      camArraySize: { value: new THREE.Vector2(camX, camY) },
      aperture: { value: aperture },
      focus: { value: focus },
      uCameraPos: { value: new THREE.Vector3(0, 0, 1.0) }
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });
  
  // Dispose old resources
  vrState.vrViewbox.geometry.dispose();
  vrState.vrViewbox.material.dispose();
  
  // Update with new geometry and material
  vrState.vrViewbox.geometry = newGeometry;
  vrState.vrViewbox.material = newMaterial;
  
  // Update position based on zoom factor
  vrState.vrViewbox.position.set(0, 0, zPosition);
  
  // Keep the plane invisible - loadNextLightField will control visibility
  vrState.vrViewbox.visible = false;
}

// Fix duplicate functions
function updateVRController() {
  console.log('This function is no longer used');
}

// ========================================================
// Remove VR Rating Buttons
// ========================================================
function removeVRRatingButtons() {
  if (vrState.ratingButtons && vrState.ratingButtons.length > 0) {
    console.log('Removing VR rating buttons:', vrState.ratingButtons.length);
    
    // Remove each button from the scene
    vrState.ratingButtons.forEach(button => {
      if (button.parent) {
        button.parent.remove(button);
      } else {
        scene.remove(button);
      }
      
      // Dispose of geometries and materials to prevent memory leaks
      if (button.geometry) button.geometry.dispose();
      
      // Handle different types of materials
      if (button.material) {
        if (Array.isArray(button.material)) {
          button.material.forEach(mat => mat.dispose());
        } else {
          button.material.dispose();
        }
      }
      
      // For ThreeMeshUI components - safely check type
      if (typeof ThreeMeshUI !== 'undefined' && ThreeMeshUI.Block && button instanceof ThreeMeshUI.Block) {
        button.children.forEach(child => {
          if (child.material) child.material.dispose();
          if (child.geometry) child.geometry.dispose();
        });
      }
    });
    
    // Clear the array
    vrState.ratingButtons = [];
    
    console.log('VR rating buttons removed');
  }
}

// ========================================================
// Create Exit VR button
// ========================================================
function createVRExitButton() {
  // Check if ThreeMeshUI is available
  if (typeof ThreeMeshUI !== 'undefined' && ThreeMeshUI.Block) {
    try {
      // Create exit button container
      const exitContainer = new ThreeMeshUI.Block({
        width: 0.4,
        height: 0.15,
        padding: 0.03,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: "./public/js/assets/Roboto-msdf.json",
        fontTexture: "./public/js/assets/Roboto-msdf.png",
        fontSize: 0.05,
        borderRadius: 0.05,
        backgroundColor: new THREE.Color(0xff4444), // Red for exit button
        backgroundOpacity: 1
      });

      // Create exit text
      const exitText = new ThreeMeshUI.Text({
        content: 'EXIT VR',
        fontColor: new THREE.Color(0xffffff),
      });

      // Add text to container
      exitContainer.add(exitText);
      
      // Position in front of the user, where they can see it
      exitContainer.position.set(0, 0, -2);
      
      // Set name for identification
      exitContainer.name = "exitButton";
      
      // Add to scene
      scene.add(exitContainer);
      
      // Add to rating buttons array for proper cleanup and hover effects
      vrState.ratingButtons.push(exitContainer);
      
      console.log('ThreeMeshUI Exit VR button created');
      return;
    } catch (error) {
      console.error('Error creating ThreeMeshUI Exit button:', error);
    }
  }
  
  // If ThreeMeshUI is not available, create a fallback button
  createFallbackExitButton();
}

// Create fallback Exit VR button using basic THREE.js
function createFallbackExitButton() {
  // Create button geometry and material
  const geometry = new THREE.PlaneGeometry(0.4, 0.15);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xff4444, // Red for exit button
    side: THREE.DoubleSide
  });
  
  // Create button mesh
  const buttonMesh = new THREE.Mesh(geometry, material);
  
  // Create text
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT VR', canvas.width / 2, canvas.height / 2);
  
  // Create text texture and material
  const textTexture = new THREE.CanvasTexture(canvas);
  const textMaterial = new THREE.MeshBasicMaterial({
    map: textTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  
  // Create text mesh
  const textMesh = new THREE.Mesh(geometry, textMaterial);
  textMesh.position.set(0, 0, 0.001); // Slightly in front
  buttonMesh.add(textMesh);
  
  // Create group
  const buttonGroup = new THREE.Group();
  buttonGroup.add(buttonMesh);
  buttonGroup.name = "exitButton";
  buttonGroup.position.set(0, 0, -2.0); // Position in front of the user
  
  // Add to scene
  scene.add(buttonGroup);
  
  // Add to rating buttons array for proper cleanup and hover effects
  vrState.ratingButtons.push(buttonGroup);
  
  console.log('Fallback Exit VR button created');
}

// ========================================================
// Create VR Thank You message
// ========================================================
function createVRThankYouMessage() {
  // Check if ThreeMeshUI is available
  if (typeof ThreeMeshUI !== 'undefined' && ThreeMeshUI.Block) {
    try {
      // Create message container
      const messageContainer = new ThreeMeshUI.Block({
        width: 0.8,
        height: 0.2,
        padding: 0.05,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: "./public/js/assets/Roboto-msdf.json",
        fontTexture: "./public/js/assets/Roboto-msdf.png",
        fontSize: 0.06,
        borderRadius: 0.05,
        backgroundColor: new THREE.Color(0x007bff),
        backgroundOpacity: 0.9
      });

      // Create message text
      const messageText = new ThreeMeshUI.Text({
        content: "Thank you for your participation!",
        fontColor: new THREE.Color(0xffffff),
      });

      // Add text to container
      messageContainer.add(messageText);
      
      // Position at eye level
      messageContainer.position.set(0, 0.5, -0.5);
      
      // Add to scene
      scene.add(messageContainer);
      
      // Add to rating buttons array for proper cleanup
      vrState.ratingButtons.push(messageContainer);
      
      console.log('ThreeMeshUI Thank You message created');
      return messageContainer;
    } catch (error) {
      console.error('Error creating ThreeMeshUI Thank You message:', error);
    }
  }
  
  // If ThreeMeshUI is not available, create a fallback message
  return createFallbackThankYouMessage();
}

// Create fallback Thank You message
function createFallbackThankYouMessage() {
  // Create canvas for text
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#007bff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Thank you for your participation!', canvas.width / 2, canvas.height / 2);
  
  // Create texture and material
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide
  });
  
  // Create mesh
  const geometry = new THREE.PlaneGeometry(0.8, 0.2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, -1.0);
  
  // Add to scene
  scene.add(mesh);
  
  // Add to rating buttons array for proper cleanup
  vrState.ratingButtons.push(mesh);
  
  console.log('Fallback Thank You message created');
  return mesh;
}

// Create a simple track button for VR to toggle head tracking
function createTrackButton() {
  // Create a simple, large button
  const buttonGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.05);
  const buttonMaterial = new THREE.MeshBasicMaterial({ 
    color: vrState.trackingActive ? 0x00ff00 : 0xff0000  // Green if active, red if inactive
  });
  const trackButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
  
  // Position the button to the right side, at eye level, and closer to the user
  trackButton.position.set(0.7, 1.5, -0.7); // Move closer to user and at eye level
  
  // Create a visible label
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TRACK ON/OFF', canvas.width/2, canvas.height/2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const textMaterial = new THREE.MeshBasicMaterial({ 
    map: texture, 
    transparent: true 
  });
  const textPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.2),
    textMaterial
  );
  textPlane.position.z = 0.026; // Slightly in front of the button
  trackButton.add(textPlane);
  
  // Add a sphere to make the button more noticeable
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.05),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  sphere.position.set(0, 0, 0.05);
  trackButton.add(sphere);
  
  scene.add(trackButton);
  vrState.trackButton = trackButton;
  
  console.log('Track button created at position:', trackButton.position);
  return trackButton;
}
