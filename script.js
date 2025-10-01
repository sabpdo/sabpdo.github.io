// Three.js 3D Room Setup
let scene, camera, renderer, room;
let animationId;
let mouseX = 0,
  mouseY = 0;
let isMouseDown = false;
let targetRotationX = 0,
  targetRotationY = 0;
let rotationX = 0,
  rotationY = 0;
let cameraDistance = 5;
let targetCameraDistance = 5;
let cameraAngleX = 0;
let cameraAngleY = 0;
let targetCameraAngleX = 0;
let targetCameraAngleY = 0;

// Asset loaders
let objLoader, gltfLoader, fbxLoader;
let loadedAssets = {};

// Initialize the 3D scene
function init3D() {
  const canvas = document.getElementById("room-canvas");

  // Check if canvas exists and Three.js is loaded
  if (!canvas) {
    console.error("Canvas element not found!");
    return;
  }

  if (typeof THREE === "undefined") {
    console.error("Three.js not loaded!");
    return;
  }

  console.log("Initializing 3D scene...");

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff); // White background

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // Set initial camera position for diagonal corner view
  cameraAngleX = 0.1; // Slight downward angle
  cameraAngleY = 0.8; // Diagonal corner view angle
  targetCameraAngleX = 0.1;
  targetCameraAngleY = 0.8;
  cameraDistance = 12; // More zoomed out
  targetCameraDistance = 12;

  updateCameraPosition();

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // Initialize loaders
  initLoaders();

  // Load assets first, then create room
  loadAssets().then(() => {
    createRoom();
    animate();
    addMouseControls();
  });
}

// Update camera position using spherical coordinates
function updateCameraPosition() {
  const x = cameraDistance * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
  const y = cameraDistance * Math.sin(cameraAngleX);
  const z = cameraDistance * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);

  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0); // Always look at the center of the room
}

// Initialize asset loaders
function initLoaders() {
  if (typeof THREE.OBJLoader !== "undefined") {
    objLoader = new THREE.OBJLoader();
  }
  if (typeof THREE.GLTFLoader !== "undefined") {
    gltfLoader = new THREE.GLTFLoader();
  }
  if (typeof THREE.FBXLoader !== "undefined") {
    fbxLoader = new THREE.FBXLoader();
  }
}

// Load all 3D assets
async function loadAssets() {
  console.log("Loading 3D assets...");

  const assetsToLoad = [
    { name: "bed", path: "asset_glb/bedDouble.glb", type: "gltf" },
    { name: "table", path: "asset_glb/table.glb", type: "gltf" },
    { name: "table2", path: "asset_glb/table.glb", type: "gltf" },
    { name: "laptop", path: "asset_glb/laptop.glb", type: "gltf" },
    { name: "chair", path: "asset_glb/chairDesk.glb", type: "gltf" },
    { name: "lamp", path: "asset_glb/lampRoundTable.glb", type: "gltf" },
    { name: "books", path: "asset_glb/books.glb", type: "gltf" },
    { name: "cake", path: "asset_glb/cake.glb", type: "gltf" },
  ];

  const loadPromises = assetsToLoad.map((asset) => loadAsset(asset));

  try {
    await Promise.all(loadPromises);
    console.log("All assets loaded successfully!");
  } catch (error) {
    console.warn("Some assets failed to load:", error);
  }
}

// Load individual asset
function loadAsset(asset) {
  return new Promise((resolve, reject) => {
    console.log(`Loading ${asset.name}...`);

    let loader;
    if (asset.type === "gltf" && gltfLoader) {
      loader = gltfLoader;
    } else if (asset.type === "fbx" && fbxLoader) {
      loader = fbxLoader;
    } else if (asset.type === "obj" && objLoader) {
      loader = objLoader;
    } else {
      console.warn(`No suitable loader for ${asset.name} (${asset.type})`);
      // Create a placeholder
      loadedAssets[asset.name] = createGenericPlaceholder();
      resolve();
      return;
    }

    loader.load(
      asset.path,
      (object) => {
        // For GLTF loader, the actual model is in object.scene
        if (asset.type === "gltf") {
          loadedAssets[asset.name] = object.scene;
          console.log(
            `Successfully loaded ${asset.name} - Type: ${object.scene.type}, Children: ${object.scene.children.length}`
          );
        } else {
          loadedAssets[asset.name] = object;
          console.log(
            `Successfully loaded ${asset.name} - Type: ${
              object.type
            }, Children: ${object.children ? object.children.length : "N/A"}`
          );
        }
        resolve();
      },
      undefined,
      (error) => {
        console.error(`Error loading ${asset.name}:`, error);
        // Create a placeholder on error
        loadedAssets[asset.name] = createGenericPlaceholder();
        resolve();
      }
    );
  });
}

// Create generic placeholder for failed loads
function createGenericPlaceholder() {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  return group;
}

// Add mouse controls for room rotation
function addMouseControls() {
  const canvas = document.getElementById("room-canvas");

  // Mouse down event
  canvas.addEventListener("mousedown", (event) => {
    isMouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    canvas.style.cursor = "grabbing";
  });

  // Mouse up event
  canvas.addEventListener("mouseup", () => {
    isMouseDown = false;
    canvas.style.cursor = "grab";
  });

  // Mouse move event
  canvas.addEventListener("mousemove", (event) => {
    if (isMouseDown) {
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      // Update camera angles
      targetCameraAngleY += deltaX * 0.01;
      targetCameraAngleX += deltaY * 0.01;

      // Limit vertical angle to prevent flipping
      targetCameraAngleX = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, targetCameraAngleX)
      );

      mouseX = event.clientX;
      mouseY = event.clientY;
    }
  });

  // Mouse leave event
  canvas.addEventListener("mouseleave", () => {
    isMouseDown = false;
    canvas.style.cursor = "grab";
  });

  // Mouse wheel event for zooming
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    // Zoom in/out based on wheel direction
    const zoomSpeed = 0.5;
    if (event.deltaY < 0) {
      // Zoom in
      targetCameraDistance = Math.max(2, targetCameraDistance - zoomSpeed);
    } else {
      // Zoom out
      targetCameraDistance = Math.min(15, targetCameraDistance + zoomSpeed);
    }
  });

  // Keyboard controls for zooming
  document.addEventListener("keydown", (event) => {
    const zoomSpeed = 0.5;
    switch (event.key) {
      case "+":
      case "=":
        // Zoom in
        targetCameraDistance = Math.max(2, targetCameraDistance - zoomSpeed);
        break;
      case "-":
        // Zoom out
        targetCameraDistance = Math.min(15, targetCameraDistance + zoomSpeed);
        break;
      case "0":
        // Reset zoom
        targetCameraDistance = 5;
        break;
    }
  });

  // Set initial cursor
  canvas.style.cursor = "grab";
}

// Create the 3D room
function createRoom() {
  console.log("Creating 3D room with assets...");
  room = new THREE.Group();

  // Room walls
  createWalls();

  // Use loaded assets for furniture
  createRoomWithAssets();

  // Additional decorations
  createWindow();
  createAdditionalWindows();
  createLights();

  scene.add(room);
  console.log("3D room created successfully!");
}

// Clean up and prepare asset for use
function prepareAsset(asset) {
  if (!asset || !asset.clone) return null;

  const cloned = asset.clone();

  // Ensure the object is properly positioned and scaled
  if (cloned.traverse) {
    cloned.traverse((child) => {
      if (child.isMesh) {
        // Ensure proper material and visibility
        child.castShadow = true;
        child.receiveShadow = true;

        // Fix any potential material issues
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat) mat.needsUpdate = true;
            });
          } else {
            child.material.needsUpdate = true;
          }
        }
      }
    });
  }

  return cloned;
}

// Create room using loaded assets
function createRoomWithAssets() {
  // Bed against the left wall
  const bed = prepareAsset(loadedAssets.bed);
  if (bed) {
    bed.position.set(-5, -2.0, 1.0); // Move bed back slightly and left slightly
    bed.scale.set(4.5, 4.5, 4.5); // Make bed even bigger
    bed.rotation.y = 0; // Rotate to have headrest on back wall
    room.add(bed);
  } else {
    // Fallback bed
    createFallbackBed();
  }

  // Desk against the back wall
  const desk = prepareAsset(loadedAssets.table);
  if (desk) {
    desk.position.set(1.5, -2.2, -3.5); // Move desk slightly right
    desk.scale.set(3.0, 6.75, 3.0); // Make desk 3/4 of current height
    desk.rotation.y = 0; // Flip desk orientation
    room.add(desk);
  } else {
    // Fallback desk
    createFallbackDesk();
  }

  // Laptop on desk
  const laptop = prepareAsset(loadedAssets.laptop);
  if (laptop) {
    laptop.position.set(2.0, 0.0, -3.8); // Move laptop slightly back more
    laptop.scale.set(4.0, 4.0, 4.0); // Make laptop 10 times smaller
    laptop.rotation.y = 0; // Flip laptop orientation
    room.add(laptop);
  } else {
    // Fallback MacBook
    createFallbackMacBook();
  }

  // Chair in front of desk
  const chair = prepareAsset(loadedAssets.chair);
  if (chair) {
    chair.position.set(3.5, -2.0, -3.5); // Move chair back more
    chair.scale.set(4.5, 4.5, 4.5); // Make chair 75% of current size
    chair.rotation.y = Math.PI; // Flip chair orientation
    room.add(chair);
  } else {
    // Fallback chair
    createFallbackChair();
  }

  // Lamp for decoration
  const lamp = prepareAsset(loadedAssets.lamp);
  if (lamp) {
    lamp.position.set(3.2, 0.0, -4.0); // Move lamp slightly right
    lamp.scale.set(3.75, 3.75, 3.75); // Double the size
    room.add(lamp);
  }

  // Create shelves above the desk
  createShelves();

  // Books for decoration on shelves - positioned on the right shelves
  const books = prepareAsset(loadedAssets.books);
  if (books) {
    books.position.set(2, 1.5, -4.0); // Move books slightly up more
    books.scale.set(10.0, 10.0, 10.0); // Make books 10x bigger
    room.add(books);
  }

  // Second table - positioned in a different area
  const table2 = prepareAsset(loadedAssets.table2);
  if (table2) {
    table2.position.set(-4.8, -2.2, 3.75); // Position second table
    table2.scale.set(1.75, 7, 3.5); // Make it more square (larger width and depth)
    table2.rotation.y = 0; // Keep original orientation
    room.add(table2);
  }

  // Cake on the second table
  const cake = prepareAsset(loadedAssets.cake);
  if (cake) {
    cake.position.set(-3.9, -0.19, 3); // Position on the second table
    cake.scale.set(0.02, 0.02, 0.02); // Make cake appropriately sized
    cake.rotation.y = Math.PI / 4; // Rotate cake for better presentation

    // Disable shadows for the cake
    cake.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    room.add(cake);
  }
}

// Create shelves above the desk
function createShelves() {
  const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff }); // White color

  // Shelf brackets - made bigger and adjusted for longer shelves
  for (let i = 0; i < 4; i++) {
    const bracketGeometry = new THREE.BoxGeometry(0.2, 1.2, 0.2);
    const bracket = new THREE.Mesh(bracketGeometry, shelfMaterial);
    bracket.position.set(-1.0 + i * 3.3, 2.3, -4.2); // Support brackets for longer shelves
    room.add(bracket);
  }
}

function createWalls() {
  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffc0cb }); // Pastel pink
  const floorMaterial = new THREE.MeshLambertMaterial({ color: 0xf0a0a0 }); // Light pink wood
  const trimMaterial = new THREE.MeshLambertMaterial({ color: 0xff91a4 }); // Pink trim

  // Floor
  const floorGeometry = new THREE.PlaneGeometry(10, 10);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  floor.receiveShadow = true;
  room.add(floor);

  // Back wall
  const backWallGeometry = new THREE.PlaneGeometry(10, 6);
  const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
  backWall.position.z = -5;
  backWall.position.y = 1;
  room.add(backWall);

  // Left wall with window cutout
  const leftWallGeometry = new THREE.PlaneGeometry(10, 6);
  const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.x = -5;
  leftWall.position.y = 1;
  room.add(leftWall);

  // Create window opening in the wall by making a transparent area
  const windowOpeningGeometry = new THREE.PlaneGeometry(2, 2);
  const windowOpeningMaterial = new THREE.MeshLambertMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.0, // Completely transparent
  });
  const windowOpening = new THREE.Mesh(
    windowOpeningGeometry,
    windowOpeningMaterial
  );
  windowOpening.rotation.y = Math.PI / 2;
  windowOpening.position.x = -4.9;
  windowOpening.position.y = 1;
  room.add(windowOpening);
}

function createShelves() {
  // Top shelf - cute pastel blue
  const shelfGeometry = new THREE.BoxGeometry(3, 0.1, 1);
  const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff }); // Light blue
  const topShelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
  topShelf.position.set(2.5, 1.5, -4.5);
  topShelf.castShadow = true;
  room.add(topShelf);

  // Cute plants on shelves
  createPlant(1.5, 1.6, -4.5, 0x90ee90); // Light green
}

function createPlant(x, y, z, plantColor = 0x90ee90) {
  const plantGroup = new THREE.Group();

  // Cute pot - pastel colors
  const potGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 8);
  const potMaterial = new THREE.MeshLambertMaterial({ color: 0xffc0cb }); // Pink pot
  const pot = new THREE.Mesh(potGeometry, potMaterial);
  pot.position.set(0, 0, 0);
  pot.castShadow = true;
  plantGroup.add(pot);

  // Cute plant - customizable color
  const plantGeometry = new THREE.SphereGeometry(0.2, 8, 6);
  const plantMaterial = new THREE.MeshLambertMaterial({ color: plantColor });
  const plant = new THREE.Mesh(plantGeometry, plantMaterial);
  plant.position.set(0, 0.2, 0);
  plant.scale.set(1, 1.5, 1);
  plant.castShadow = true;
  plantGroup.add(plant);

  // Add small flowers
  for (let i = 0; i < 3; i++) {
    const flowerGeometry = new THREE.SphereGeometry(0.03, 4, 4);
    const flowerMaterial = new THREE.MeshLambertMaterial({ color: 0xff69b4 }); // Hot pink flowers
    const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
    flower.position.set(
      (Math.random() - 0.5) * 0.3,
      0.3 + Math.random() * 0.1,
      (Math.random() - 0.5) * 0.3
    );
    flower.castShadow = true;
    plantGroup.add(flower);
  }

  plantGroup.position.set(x, y, z);
  room.add(plantGroup);
}

function createWindow() {
  // Window frame - cute pastel blue
  //   const windowFrameGeometry = new THREE.PlaneGeometry(2.2, 2.2);
  //   const windowFrameMaterial = new THREE.MeshLambertMaterial({
  //     color: 0xadd8e6,
  //   }); // Light blue
  //   const windowFrame = new THREE.Mesh(windowFrameGeometry, windowFrameMaterial);
  //   windowFrame.position.set(-4.9, 1.5, 0); // Raised window up
  //   windowFrame.rotation.y = Math.PI / 2; // Rotate the window
  //   room.add(windowFrame);

  // Window glass - clear and transparent
  const windowGeometry = new THREE.PlaneGeometry(2, 2);
  const windowMaterial = new THREE.MeshLambertMaterial({
    color: 0x87ceeb, // Light blue sky color
    transparent: true,
    opacity: 0.7, // More opaque
  });
  const window = new THREE.Mesh(windowGeometry, windowMaterial);
  window.position.set(-4.8, 1.4, 0.1); // Raised window up
  window.rotation.y = Math.PI / 2; // Rotate the window
  room.add(window);

  // Add cute window sill with plant
  const sillGeometry = new THREE.BoxGeometry(2.1, 0.1, 0.3);
  const sillMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff }); // Pink
  const sill = new THREE.Mesh(sillGeometry, sillMaterial);
  sill.position.set(-4.8, 0.3, 0.1); // Raised sill up to match window
  sill.rotation.y = Math.PI / 2; // Rotate the shelf
  sill.castShadow = true;
  room.add(sill);

  // Plant on window sill
  createPlant(-4.8, 0.4, 0.2, 0x98fb98); // Pale green - raised up
}

function createAdditionalWindows() {
  // All additional windows removed since we only have two walls now
  // The main window on the left wall is still there from createWindow()
  // Additional windows removed for two-wall corner design
}

function createLights() {
  // Cute string lights with different colors
  const lightColors = [0xff69b4, 0x98fb98, 0xadd8e6, 0xffc0cb, 0xffd700]; // Pink, green, blue, pink, gold

  for (let i = -2; i < 7; i++) {
    const lightGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: lightColors[i],
      emissive: lightColors[i],
      emissiveIntensity: 0.3,
    });
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.set(-2 + i * 1, 3.5, -4.8);
    room.add(light);
  }

  for (let i = -2; i < 10; i++) {
    const lightGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: lightColors[i],
      emissive: lightColors[i],
      emissiveIntensity: 0.3,
    });
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.set(-4.75, 3.5, -4.8 + i * 1);
    room.add(light);
  }
}

// Animation loop
function animate() {
  animationId = requestAnimationFrame(animate);

  // Smooth camera angle interpolation
  cameraAngleX += (targetCameraAngleX - cameraAngleX) * 0.1;
  cameraAngleY += (targetCameraAngleY - cameraAngleY) * 0.1;

  // Smooth camera zoom
  cameraDistance += (targetCameraDistance - cameraDistance) * 0.1;

  // Update camera position
  updateCameraPosition();

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  } else {
    console.error("Renderer, scene, or camera not initialized!");
  }
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Modal functionality
function initModal() {
  const modal = document.getElementById("navigation-modal");
  const navLinks = document.querySelectorAll(".nav-link");
  const contentSections = document.querySelectorAll(".content-section");
  const closeBtn = document.getElementById("close-modal");

  // Show modal on page load
  modal.style.display = "block";

  // Handle navigation clicks
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href").substring(1);
      showContentSection(targetId);
    });
  });

  // Handle close button
  closeBtn.addEventListener("click", () => {
    hideAllContentSections();
  });

  // Close modal when clicking outside
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      hideAllContentSections();
    }
  });

  // Handle scrapbook modal click outside to close
  const scrapbookModal = document.querySelector(".scrapbook-modal");
  if (scrapbookModal) {
    scrapbookModal.addEventListener("click", (e) => {
      if (e.target === scrapbookModal) {
        hideAllContentSections();
      }
    });
  }

  // Handle desktop modal click outside to close
  const desktopModal = document.querySelector(".desktop-modal");
  if (desktopModal) {
    desktopModal.addEventListener("click", (e) => {
      if (e.target === desktopModal) {
        hideAllContentSections();
      }
    });
  }

  // Handle resume preview modal click outside to close
  const resumePreviewModal = document.querySelector(".resume-preview-modal");
  if (resumePreviewModal) {
    resumePreviewModal.addEventListener("click", (e) => {
      if (e.target === resumePreviewModal) {
        hideAllContentSections();
      }
    });
  }
}

function showContentSection(sectionId) {
  // Hide all content sections
  hideAllContentSections();

  // Show the selected section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active");
  }
}

function hideAllContentSections() {
  const contentSections = document.querySelectorAll(".content-section");
  contentSections.forEach((section) => {
    section.classList.remove("active");
  });
}

// Audio player functionality
function initAudioPlayer() {
  const playPauseBtn = document.getElementById("play-pause");
  const progress = document.getElementById("progress");
  const currentTimeEl = document.getElementById("current-time");
  const durationEl = document.getElementById("duration");
  const volumeSlider = document.getElementById("volume");

  let isPlaying = false;

  playPauseBtn.addEventListener("click", () => {
    isPlaying = !isPlaying;
    const icon = playPauseBtn.querySelector("i");
    icon.className = isPlaying ? "fas fa-pause" : "fas fa-play";
  });

  volumeSlider.addEventListener("input", (e) => {
    // Volume control logic would go here
    console.log("Volume:", e.target.value);
  });
}

// Check if Three.js is loaded
function waitForThreeJS() {
  if (typeof THREE !== "undefined") {
    console.log("Three.js loaded successfully!");
    init3D();
  } else {
    console.log("Waiting for Three.js to load...");
    setTimeout(waitForThreeJS, 100);
  }
}

// Initialize everything when page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing...");

  // Wait for Three.js to load
  waitForThreeJS();

  initModal();
  initAudioPlayer();

  window.addEventListener("resize", onWindowResize);
});

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});
