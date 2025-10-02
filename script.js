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

// Global saturation boost factor for all materials (1.0 = no change)
const SATURATION_BOOST = 1.8; // Stronger saturation boost

// Utility: boost an THREE.Color's saturation in HSL space
function boostColorSaturation(color, factor) {
  if (!color || typeof color.getHSL !== "function") return;
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  hsl.s = Math.min(1, hsl.s * factor);
  color.setHSL(hsl.h, hsl.s, hsl.l);
}

// Utility: apply saturation boost to a material (supports arrays)
function boostMaterialSaturation(material, factor) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((m) => boostMaterialSaturation(m, factor));
    return;
  }
  if (material.color) {
    boostColorSaturation(material.color, factor);
    material.needsUpdate = true;
  }
}

// Utility: traverse a group/object and boost saturation on all mesh materials
function boostSaturationOnGroup(object3D, factor = SATURATION_BOOST) {
  if (!object3D || !object3D.traverse) return;
  object3D.traverse((child) => {
    if (child.isMesh && child.material) {
      boostMaterialSaturation(child.material, factor);
    }
  });
}

// Utility: gently increase brightness on all mesh materials in a group
function increaseBrightnessOnGroup(object3D, factor = 1.15) {
  if (!object3D || !object3D.traverse) return;
  object3D.traverse((child) => {
    if (child.isMesh && child.material) {
      const apply = (mat) => {
        if (mat && mat.color) {
          mat.color.multiplyScalar(factor);
          mat.needsUpdate = true;
        }
      };
      if (Array.isArray(child.material)) {
        child.material.forEach(apply);
      } else {
        apply(child.material);
      }
    }
  });
}

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
  cameraAngleX = 0.5; // Higher up but tilted down slightly
  cameraAngleY = 0.8; // Diagonal corner view angle
  targetCameraAngleX = 0.5;
  targetCameraAngleY = 0.8;
  cameraDistance = 12; // More zoomed out
  targetCameraDistance = 12;

  updateCameraPosition();

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Ensure correct color space and brighter, filmic tonemapping
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffe8cc, 0.4);
  scene.add(ambientLight);

  // // Soft skylight + ground bounce to better light PBR assets
  // const hemiLight = new THREE.HemisphereLight(0xffead6, 0xb07c5e, 0.45);
  // hemiLight.position.set(0, 5, 0);
  // scene.add(hemiLight);

  const directionalLight = new THREE.DirectionalLight(0xffe6cc, 1.0);
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
    { name: "cake", path: "asset_glb/strawberry_cake.glb", type: "gltf" },
    {
      name: "bunny",
      path: "asset_glb/new_assets/bunny_plush_toy.glb",
      type: "gltf",
    },
    // new_assets additions
    {
      name: "newBed",
      path: "asset_glb/new_assets/cute_stylized_bed_-_low_poly_-_game_ready.glb",
      type: "gltf",
    },
    {
      name: "indoorPlantNew",
      path: "asset_glb/new_assets/indoor_plant.glb",
      type: "gltf",
    },
    {
      name: "modernPainting",
      path: "asset_glb/new_assets/modern_three_panel_painting.glb",
      type: "gltf",
    },
    {
      name: "owlVase",
      path: "asset_glb/new_assets/owl_flowers_vase.glb",
      type: "gltf",
    },
    {
      name: "stringLightsNew",
      path: "asset_glb/new_assets/simple_string_lights.glb",
      type: "gltf",
    },
    {
      name: "windowAsset",
      path: "asset_glb/new_assets/window.glb",
      type: "gltf",
    },
    {
      name: "camera",
      path: "asset_glb/new_assets/zefir_camera_with_domiplan_lens.glb",
      type: "gltf",
    },
    {
      name: "wetFloorSign",
      path: "asset_glb/new_assets/wet_floor_sign_primal_fear.glb",
      type: "gltf",
    },
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

  // Add click handling for menu items
  canvas.addEventListener("click", (event) => {
    if (isMouseDown) return; // Don't trigger on drag

    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / canvas.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / canvas.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(room.children, true);

    for (let intersect of intersects) {
      if (
        intersect.object.name &&
        (intersect.object.name.startsWith("menu-item-") ||
          intersect.object.name.startsWith("menu-text-"))
      ) {
        const section = intersect.object.userData.section;
        console.log(`Clicked menu item: ${section}`);
        showContentSection(section);
        break;
      }
      // Also check if we clicked on a child of a text group
      if (
        intersect.object.parent &&
        intersect.object.parent.name &&
        intersect.object.parent.name.startsWith("menu-text-")
      ) {
        const section = intersect.object.parent.userData.section;
        console.log(`Clicked menu text: ${section}`);
        showContentSection(section);
        break;
      }
    }
  });
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

  // Slightly increase saturation for a richer look
  boostSaturationOnGroup(cloned);

  return cloned;
}

// Create room using loaded assets
function createRoomWithAssets() {
  // Replace bed with new stylized bed asset if available
  const newBed = prepareAsset(loadedAssets.newBed || loadedAssets.bed);
  if (newBed) {
    newBed.position.set(-1.95, -1.75, -4.5);
    newBed.scale.set(3, 3, 3);
    newBed.rotation.y = 4.75;
    // Boost saturation and darken slightly
    boostSaturationOnGroup(newBed, 100000000000);
    increaseBrightnessOnGroup(newBed, 0.97);
    room.add(newBed);
  } else {
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

  // Create 3D whiteboard for navigation
  createNavigationWhiteboard();

  // Books for decoration on shelves - positioned on the right shelves
  const books = prepareAsset(loadedAssets.books);
  if (books) {
    books.position.set(2, 1.55, -4.0); // Move books slightly up more
    books.scale.set(10.0, 10.0, 10.0); // Make books 10x bigger
    room.add(books);
  }

  // Indoor plant GLB placed on the shelf
  const shelfPlant = prepareAsset(loadedAssets.indoorPlantNew);
  if (shelfPlant) {
    shelfPlant.position.set(1.5, 1.55, -4.35); // left side of shelf
    shelfPlant.scale.set(1, 1, 1);
    shelfPlant.rotation.y = -Math.PI / 12;
    // keep colors rich but not too bright
    boostSaturationOnGroup(shelfPlant, 1.2);
    room.add(shelfPlant);
  }

  // // Owl flowers vase on the shelf next to books
  // const owlVase = prepareAsset(loadedAssets.owlVase);
  // if (owlVase) {
  //   owlVase.position.set(1.4, 1.55, -4.6);
  //   owlVase.scale.set(2.75, 2.75, 2.75);
  //   boostSaturationOnGroup(owlVase, 50);
  //   increaseBrightnessOnGroup(owlVase, 1.75);

  //   room.add(owlVase);
  // }

  // // Modern three-panel painting on the back wall
  // const painting = prepareAsset(loadedAssets.modernPainting);
  // if (painting) {
  //   painting.position.set(1.5, 1.6, -4.95);
  //   painting.scale.set(2, 2, 2);
  //   painting.rotation.y = 0;
  //   room.add(painting);
  // }

  // // Replace procedural string lights with GLB if available
  // const strLights = prepareAsset(loadedAssets.stringLightsNew);
  // if (strLights) {
  //   strLights.position.set(-2.2, 3.4, -4.8);
  //   strLights.scale.set(0.6, 0.6, 0.6);
  //   strLights.rotation.y = 0;
  //   room.add(strLights);
  // }

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
    cake.position.set(-3.9, 0, 3); // Position on the second table
    cake.scale.set(0.5, 0.75, 0.5); // Make cake appropriately sized
    cake.rotation.y = Math.PI / 4; // Rotate cake for better presentation
    increaseBrightnessOnGroup(cake, 1.2);

    // Disable shadows for the cake
    cake.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    room.add(cake);
  }

  // Bunny plush on the bed
  const bunny = prepareAsset(loadedAssets.bunny);
  if (bunny) {
    // Position roughly on the top of the bed mattress
    // Bed center near (-5, -2, 1). Raise Y slightly above mattress.
    bunny.position.set(-2.15, 0.15, -1.5);
    bunny.scale.set(2, 2, 2);
    bunny.rotation.y = Math.PI / 6;
    increaseBrightnessOnGroup(bunny, 7);
    // Ensure plush has soft look: no shadows and softer material
    if (bunny.traverse) {
      bunny.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          if (child.material) {
            // Prefer keeping texture map while switching to Lambert for softer shading
            const textureMap = Array.isArray(child.material)
              ? child.material[0]?.map
              : child.material.map;
            const softMaterial = new THREE.MeshLambertMaterial({
              color: 0xffffff,
              map: textureMap || null,
            });
            child.material = softMaterial;
          }
        }
      });
    }
    room.add(bunny);
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

  // add plant on the shelf
  createPlant(1.5, 1.6, -4.5); // Light green
}

// Generate a warm wood planks texture using a canvas, suitable for repeating
function createWoodPlanksTexture({
  planks = 6,
  baseColor = "#c9916a",
  variation = 12,
  seamColor = "#7b4f34",
} = {}) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Helper to clamp values
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Convert hex color to rgb
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
      ? {
          r: parseInt(m[1], 16),
          g: parseInt(m[2], 16),
          b: parseInt(m[3], 16),
        }
      : { r: 201, g: 145, b: 106 };
  }

  const base = hexToRgb(baseColor);

  // Draw planks as horizontal bands with subtle per-plank color variation
  const plankHeight = size / planks;
  for (let i = 0; i < planks; i++) {
    const dv = (Math.random() * 2 - 1) * variation;
    const r = clamp(base.r + dv, 0, 255);
    const g = clamp(base.g + dv * 0.7, 0, 255);
    const b = clamp(base.b + dv * 0.4, 0, 255);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, i * plankHeight, size, plankHeight);

    // Add subtle grain lines within the plank
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#000";
    for (let x = 0; x < size; x += 6 + Math.random() * 10) {
      const y = i * plankHeight + Math.random() * plankHeight;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + Math.random() * 40, y + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Plank seam
    if (i > 0) {
      ctx.fillStyle = seamColor;
      ctx.fillRect(0, i * plankHeight - 2, size, 2);
    }
  }

  // Vertical seams to suggest staggered joints
  ctx.fillStyle = seamColor;
  for (let x = 0; x < size; x += size / 4) {
    ctx.fillRect(x, 0, 1, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function createWalls() {
  // Darker, warmer wall tones
  const backWallMaterial = new THREE.MeshLambertMaterial({ color: 0xb89477 });
  const leftWallMaterial = new THREE.MeshLambertMaterial({ color: 0xa97f65 });
  const trimMaterial = new THREE.MeshLambertMaterial({ color: 0xff91a4 });

  // Floor
  const floorGeometry = new THREE.PlaneGeometry(10, 10);
  const woodTexture = createWoodPlanksTexture({
    planks: 8,
    baseColor: "#a46d49", // darker, warmer base
    variation: 18,
    seamColor: "#6b442c",
  });
  woodTexture.repeat.set(2, 3);
  const floorMaterial = new THREE.MeshLambertMaterial({
    map: woodTexture,
    color: 0x7a5136, // tint darker to counter overexposure
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  floor.receiveShadow = true;
  room.add(floor);

  // Back wall
  const backWallGeometry = new THREE.PlaneGeometry(10, 6);
  const backWall = new THREE.Mesh(backWallGeometry, backWallMaterial);
  backWall.position.z = -5;
  backWall.position.y = 1;
  room.add(backWall);

  // Left wall with window cutout
  const leftWallGeometry = new THREE.PlaneGeometry(10, 6);
  const leftWall = new THREE.Mesh(leftWallGeometry, leftWallMaterial);
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

// Create 3D navigation sign using wet floor sign asset
function createNavigationWhiteboard() {
  // Use the wet floor sign asset
  const wetFloorSign = prepareAsset(loadedAssets.wetFloorSign);
  if (wetFloorSign) {
    wetFloorSign.position.set(5.5, 0.15, -3.5);
    wetFloorSign.scale.set(0.75, 0.75, 0.75);
    increaseBrightnessOnGroup(wetFloorSign, 1);
    wetFloorSign.rotation.y = Math.PI / 11; // Angle it toward the room
    room.add(wetFloorSign);
  }

  // Create white rectangle overlay for menu items
  createMenuOverlay();
}

// Create white rectangle overlay with clickable menu items
function createMenuOverlay() {
  // Create white rectangle background (thicker)
  const overlayGeometry = new THREE.BoxGeometry(1, 2, 0.1); // Added depth for thickness
  const overlayMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
  });
  const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
  overlay.position.set(5.6, -0.2, -3.05);
  overlay.rotation.y = Math.PI / 8; // Match the sign angle
  overlay.rotation.x = -Math.PI / 17;
  overlay.name = "menu-overlay";
  room.add(overlay);

  // Create name header
  createNameHeader();

  // Create clickable menu items
  createClickableMenuItems();
}

// Create name header for the board
function createNameHeader() {
  // Create name text overlay
  createMenuTextOverlay("Sabrina Do", 5.6, 0.4, "name-header", -1);
}

// Create clickable menu items
function createClickableMenuItems() {
  const menuItems = [
    { text: "about me", section: "about" },
    { text: "projects", section: "projects" },
    { text: "work experience", section: "experience" },
    { text: "education", section: "education" },
    { text: "contact me", section: "contact" },
  ];

  menuItems.forEach((item, index) => {
    // Create clickable button with better proportions
    const itemGeometry = new THREE.BoxGeometry(0.9, 0.12, 0.02);
    const itemMaterial = new THREE.MeshLambertMaterial({
      color: 0xf8bbd9, // Light pink background
      transparent: true,
      opacity: 0.95,
    });
    const menuItem = new THREE.Mesh(itemGeometry, itemMaterial);

    // Position items vertically on the overlay (matching white background coordinates)
    const yOffset = 0.3 - index * 0.25; // Increased spacing from 0.17 to 0.25
    menuItem.position.set(5.6, -0.2 + yOffset, -3.05); // Same as white background
    menuItem.rotation.y = Math.PI / 8; // Match the sign angle
    menuItem.rotation.x = -Math.PI / 17; // Match the overlay tilt
    menuItem.name = `menu-item-${item.section}`;
    menuItem.userData = { section: item.section };

    room.add(menuItem);

    // Create subtle shadow/outline for depth
    const shadowGeometry = new THREE.BoxGeometry(0.92, 0.14, 0.01);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.15,
    });
    const shadowItem = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadowItem.position.set(5.6, -0.2 + yOffset, -3.06); // Behind the button
    shadowItem.rotation.y = Math.PI / 8;
    shadowItem.rotation.x = -Math.PI / 17;
    room.add(shadowItem);

    // Create HTML text overlay for each menu item with index
    createMenuTextOverlay(item.text, 5.6, -0.2 + yOffset, item.section, index);
  });
}

// Create HTML text overlay for menu items
function createMenuTextOverlay(text, x, y, section, index) {
  // Create a div element for the text
  const textDiv = document.createElement("div");
  textDiv.className = "menu-text-overlay";
  textDiv.textContent = text;
  textDiv.style.position = "absolute";
  textDiv.style.color = "#2c2c2c";
  textDiv.style.fontSize = section === "name-header" ? "18px" : "14px"; // Larger font for name
  textDiv.style.fontWeight = "bold";
  textDiv.style.fontFamily = "Arial, sans-serif";
  textDiv.style.pointerEvents = "none";
  textDiv.style.zIndex = "1000";
  textDiv.style.textAlign = "center";
  textDiv.style.width = "120px";
  textDiv.style.height = section === "name-header" ? "30px" : "25px"; // Taller for name
  textDiv.style.lineHeight = section === "name-header" ? "30px" : "25px";
  textDiv.style.userSelect = "none";

  // Store the section, coordinates, and index for positioning
  textDiv.dataset.section = section;
  textDiv.dataset.x = x;
  textDiv.dataset.y = y;
  textDiv.dataset.index = index;

  // Add to the page
  document.body.appendChild(textDiv);

  // Position the text statically on the board
  positionTextOverlay(textDiv, x, y);

  // Store reference for updates
  if (!window.menuTextOverlays) {
    window.menuTextOverlays = [];
  }
  window.menuTextOverlays.push(textDiv);
}

// Position text overlay on the 3D board
function positionTextOverlay(textDiv, x, y) {
  // Convert 3D board coordinates to screen coordinates
  const vector = new THREE.Vector3(x, y, -3.0);
  vector.project(camera);

  const canvas = document.getElementById("room-canvas");
  const canvasRect = canvas.getBoundingClientRect();

  // Position text on the board (not moving with camera rotation)
  const boardX = (vector.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left;
  const boardY = (vector.y * -0.5 + 0.5) * canvasRect.height + canvasRect.top;

  textDiv.style.left = boardX - 60 + "px"; // Center the text
  textDiv.style.top = boardY - 10 + "px";
}

// Update all text overlay positions when camera moves
function updateTextOverlays() {
  if (window.menuTextOverlays) {
    window.menuTextOverlays.forEach((textDiv) => {
      // Get the 3D position from the text element's data
      const x = parseFloat(textDiv.dataset.x || 5.6);
      const y = parseFloat(textDiv.dataset.y || -0.2);
      positionTextOverlay(textDiv, x, y);
    });
  }
}

function createShelves() {
  // Top shelf - cute pastel blue
  const shelfGeometry = new THREE.BoxGeometry(3, 0.1, 1);
  const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff }); // Light blue
  const topShelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
  topShelf.position.set(2.5, 1.5, -4.5);
  topShelf.castShadow = true;
  room.add(topShelf);
}

function createPlant(x, y, z, plantColor = 0x2e7d32) {
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
  // Replace created window with GLB window asset if available
  const win = prepareAsset(loadedAssets.windowAsset);
  if (win) {
    win.position.set(-7.5, -0.5, 1.5);
    win.rotation.y = Math.PI;
    win.scale.set(0.05, 0.05, 0.05);
    room.add(win);
  } else {
    // Fallback simple window plane
    const windowGeometry = new THREE.PlaneGeometry(2, 2);
    const windowMaterial = new THREE.MeshLambertMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.7,
    });
    const window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(-4.8, 1.4, 0.1);
    window.rotation.y = Math.PI / 2;
    room.add(window);
  }

  // Optional sky-blue pane behind the window opening for a pleasant view
  const skyPaneGeometry = new THREE.PlaneGeometry(1.5, 3);
  const skyPaneMaterial = new THREE.MeshLambertMaterial({
    color: 0x87ceeb,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const skyPane = new THREE.Mesh(skyPaneGeometry, skyPaneMaterial);
  // Place slightly behind the left wall so it's visible through the opening
  skyPane.position.set(-4.8, 2, -1.5);
  skyPane.rotation.y = Math.PI / 2;
  room.add(skyPane);
}

function createAdditionalWindows() {
  // All additional windows removed since we only have two walls now
  // The main window on the left wall is still there from createWindow()
  // Additional windows removed for two-wall corner design
}

function createLights() {
  // Use GLB string lights if available
  const strLights = prepareAsset(loadedAssets.stringLightsNew);
  if (strLights) {
    const s1 = strLights.clone();
    increaseBrightnessOnGroup(s1, 10);
    s1.position.set(-1.75, 3.45, -4.8);
    s1.scale.set(0.5, 1, 2);
    room.add(s1);

    // const s2 = strLights.clone();
    // s2.position.set(-4.75, 3.45, -2.0);
    // s2.rotation.y = Math.PI / 2;
    // s2.scale.set(0.7, 0.7, 0.7);
    // room.add(s2);
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

  // Update text overlay positions
  updateTextOverlays();

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

  // Hide CSS modal since we're using 3D whiteboard
  if (modal) {
    modal.style.display = "none";
  }

  // Handle navigation clicks
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href").substring(1);
      showContentSection(targetId);
    });
  });

  // Handle close button (if it exists)
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      hideAllContentSections();
    });
  }

  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideAllContentSections();
      }
    });
  }

  // Handle scrapbook modal click outside to close
  const scrapbookModal = document.querySelector(".scrapbook-modal");
  if (scrapbookModal) {
    scrapbookModal.addEventListener("click", (e) => {
      if (e.target === scrapbookModal) {
        // Small delay to prevent immediate closing during transition
        setTimeout(() => {
          hideAllContentSections();
        }, 100);
      }
    });
  }

  // Handle desktop modal click outside to close
  const desktopModal = document.querySelector(".desktop-modal");
  if (desktopModal) {
    desktopModal.addEventListener("click", (e) => {
      if (e.target === desktopModal) {
        // Small delay to prevent immediate closing during transition
        setTimeout(() => {
          hideAllContentSections();
        }, 100);
      }
    });
  }

  // Handle resume preview modal click outside to close
  const resumePreviewModal = document.querySelector(".resume-preview-modal");
  if (resumePreviewModal) {
    resumePreviewModal.addEventListener("click", (e) => {
      if (e.target === resumePreviewModal) {
        // Small delay to prevent immediate closing during transition
        setTimeout(() => {
          hideAllContentSections();
        }, 100);
      }
    });
  }

  // Handle education modal click outside to close
  const educationModal = document.querySelector(".education-modal");
  if (educationModal) {
    educationModal.addEventListener("click", (e) => {
      if (e.target === educationModal) {
        // Small delay to prevent immediate closing during transition
        setTimeout(() => {
          hideAllContentSections();
        }, 100);
      }
    });
  }

  // Handle contact modal click outside to close
  const contactModal = document.querySelector(".contact-modal");
  if (contactModal) {
    contactModal.addEventListener("click", (e) => {
      if (e.target === contactModal) {
        // Small delay to prevent immediate closing during transition
        setTimeout(() => {
          hideAllContentSections();
        }, 100);
      }
    });
  }
}

function showContentSection(sectionId) {
  // Hide all content sections
  hideAllContentSections();

  // Small delay to ensure smooth transition
  setTimeout(() => {
    // Show the selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add("active");
    }
  }, 50);
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
  initMusicPlayer();

  window.addEventListener("resize", onWindowResize);
});

// Spotify API Integration
class SpotifyMusicPlayer {
  constructor() {
    this.clientId = "b3629d1eb6a34dbd91aed2ef24c497f1"; // Replace with your Spotify Client ID
    // Use the exact origin so it works on localhost and GitHub Pages
    // Make sure to whitelist this exact value (including trailing slash) in Spotify Dashboard
    this.redirectUri = window.location.origin + "/";
    this.accessToken = null;
    this.currentTrack = null;
    this.audio = null;
    this.isPlaying = false;
    this.isExpanded = false;
    // Default track to auto-load after login
    // seasons — wave to earth (user-selected)
    this.defaultTrackId = "5VBjyOQzqlPNgdRPMM6prF";

    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.musicToggle = document.getElementById("music-toggle");
    this.musicContent = document.getElementById("music-content");
    console.log("Music toggle found:", this.musicToggle);
    console.log("Music content found:", this.musicContent);
    this.musicTitle = document.querySelector(".music-title");
    this.spotifyLogin = document.getElementById("spotify-login");
    this.musicPlayerContent = document.getElementById("music-player-content");
    this.spotifyLoginBtn = document.getElementById("spotify-login-btn");
    this.searchInput = document.getElementById("search-input");
    this.searchBtn = document.getElementById("search-btn");
    this.searchResults = document.getElementById("search-results");
    this.resultsList = document.getElementById("results-list");
    this.trackTitle = document.getElementById("track-title");
    this.trackArtist = document.getElementById("track-artist");
    this.albumArt = document.getElementById("album-art");
    this.playPauseBtn = document.getElementById("play-pause");
    this.rewindBtn = document.getElementById("rewind");
    this.forwardBtn = document.getElementById("forward");
    this.volumeSlider = document.getElementById("volume");
    this.progressBar = document.getElementById("progress");
    this.currentTimeSpan = document.getElementById("current-time");
    this.durationSpan = document.getElementById("duration");
  }

  setupEventListeners() {
    // Toggle music player
    this.musicToggle.addEventListener("click", (e) => {
      console.log("Music toggle clicked!");
      e.stopPropagation();
      this.toggleExpanded();
    });

    // Spotify login
    this.spotifyLoginBtn.addEventListener("click", () => {
      this.loginToSpotify();
    });

    // Search functionality
    this.searchBtn.addEventListener("click", () => {
      this.searchTracks();
    });

    this.searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.searchTracks();
      }
    });

    // Music controls
    this.playPauseBtn.addEventListener("click", () => {
      this.togglePlayPause();
    });

    this.rewindBtn.addEventListener("click", () => {
      this.previousTrack();
    });

    this.forwardBtn.addEventListener("click", () => {
      this.nextTrack();
    });

    // Volume control
    this.volumeSlider.addEventListener("input", (e) => {
      this.setVolume(e.target.value);
    });

    // Progress bar
    this.progressBar.addEventListener("click", (e) => {
      this.seekTo(e);
    });

    // Check for access token in URL
    this.checkForAccessToken();
  }

  toggleExpanded() {
    console.log("Toggle expanded called, current state:", this.isExpanded);
    console.log("Music content element:", this.musicContent);
    this.isExpanded = !this.isExpanded;

    if (this.isExpanded) {
      this.musicContent.classList.add("show");
      this.musicToggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
      console.log("Music player expanded");
    } else {
      this.musicContent.classList.remove("show");
      this.musicToggle.innerHTML = '<i class="fas fa-music"></i>';
      console.log("Music player collapsed");
    }
  }

  async loginToSpotify() {
    const scopes =
      "user-read-private user-read-email user-top-read user-read-recently-played";

    // PKCE: generate verifier and challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    sessionStorage.setItem("spotify_code_verifier", codeVerifier);

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      scope: scopes,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async checkForAccessToken() {
    // First: handle PKCE code in query string
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    if (code) {
      try {
        await this.exchangeCodeForToken(code);
        this.showMusicPlayer();
        // Clean URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
        return;
      } catch (e) {
        console.error("PKCE token exchange failed:", e);
      }
    }

    // Fallback: legacy implicit flow hash fragment (if previously used)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get("access_token");
    if (token) {
      this.accessToken = token;
      this.showMusicPlayer();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  async exchangeCodeForToken(code) {
    const verifier = sessionStorage.getItem("spotify_code_verifier");
    if (!verifier)
      throw new Error("Missing PKCE code_verifier in sessionStorage");

    const body = new URLSearchParams({
      client_id: this.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      code_verifier: verifier,
    });

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || JSON.stringify(data));
    }

    this.accessToken = data.access_token;
  }

  generateCodeVerifier() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(digest);
    let str = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  showMusicPlayer() {
    this.spotifyLogin.style.display = "none";
    this.musicPlayerContent.style.display = "block";
    this.updateHeaderNowPlaying();
    // Auto-load a default song if none selected yet
    if (!this.currentTrack && this.accessToken && this.defaultTrackId) {
      this.playTrack(this.defaultTrackId);
    }
  }

  async searchTracks() {
    const query = this.searchInput.value.trim();
    if (!query || !this.accessToken) return;

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(
          query
        )}&type=track&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const data = await response.json();
      this.displaySearchResults(data.tracks.items);
    } catch (error) {
      console.error("Search error:", error);
    }
  }

  displaySearchResults(tracks) {
    this.resultsList.innerHTML = "";
    this.searchResults.style.display = "block";

    tracks.forEach((track) => {
      const resultItem = document.createElement("div");
      resultItem.className = "result-item";
      resultItem.innerHTML = `
        <img src="${
          track.album.images[0]?.url || ""
        }" alt="Album Art" onerror="this.style.display='none'">
        <div class="result-info">
          <div class="result-title">${track.name}</div>
          <div class="result-artist">${track.artists[0].name}</div>
        </div>
        <button class="play-preview" onclick="musicPlayer.playTrack('${
          track.id
        }')">
          <i class="fas fa-play"></i>
        </button>
      `;
      this.resultsList.appendChild(resultItem);
    });
  }

  async playTrack(trackId) {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const track = await response.json();
      this.currentTrack = track;
      this.updateTrackDisplay();

      // Play preview if available
      if (track.preview_url) {
        this.playPreview(track.preview_url);
        this.removeEmbedIfAny();
      } else {
        // Fallback: show Spotify embed widget for full track
        this.showEmbed(track.id);
      }
    } catch (error) {
      console.error("Track fetch error:", error);
    }
  }

  playPreview(previewUrl) {
    if (this.audio) {
      this.audio.pause();
    }

    this.audio = new Audio(previewUrl);
    this.audio.volume = this.volumeSlider.value / 100;

    this.audio.addEventListener("loadedmetadata", () => {
      this.durationSpan.textContent = this.formatTime(this.audio.duration);
    });

    this.audio.addEventListener("timeupdate", () => {
      this.updateProgress();
    });

    this.audio.addEventListener("ended", () => {
      this.isPlaying = false;
      this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    });

    // Autoplay the preview
    this.audio.play().catch((error) => {
      console.log("Autoplay prevented:", error);
      // If autoplay fails, just update the UI to show it's ready to play
      this.isPlaying = false;
      this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    });

    this.isPlaying = true;
    this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  }

  updateTrackDisplay() {
    if (!this.currentTrack) return;

    this.trackTitle.textContent = this.currentTrack.name;
    this.trackArtist.textContent = this.currentTrack.artists[0].name;
    this.updateHeaderNowPlaying(this.currentTrack.name);

    const albumImage = this.albumArt.querySelector("img");
    if (albumImage) {
      albumImage.src = this.currentTrack.album.images[0]?.url || "";
    } else {
      this.albumArt.innerHTML = `<img src="${
        this.currentTrack.album.images[0]?.url || ""
      }" alt="Album Art" onerror="this.innerHTML='🎵'">`;
    }
  }

  updateHeaderNowPlaying(trackName) {
    if (!this.musicTitle) return;
    if (trackName && trackName.trim().length > 0) {
      this.musicTitle.textContent = `Now Playing — ${trackName}`;
    } else {
      this.musicTitle.textContent = "Now Playing";
    }
  }

  showEmbed(trackId) {
    // Create or update an iframe embed for the track
    let embed = document.getElementById("spotify-embed");
    if (!embed) {
      embed = document.createElement("iframe");
      embed.id = "spotify-embed";
      embed.style.borderRadius = "12px";
      embed.width = "100%";
      embed.height = "152"; // compact height
      embed.frameBorder = "0";
      embed.allow =
        "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      embed.loading = "lazy";
      // Insert near the top of the player content
      this.musicPlayerContent.prepend(embed);
    }
    embed.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;

    // Hide custom UI to avoid double UI
    this.toggleCustomPlayerVisibility(false);
  }

  removeEmbedIfAny() {
    const embed = document.getElementById("spotify-embed");
    if (embed && embed.parentNode) {
      embed.parentNode.removeChild(embed);
    }
    // Show custom UI again when embed is removed
    this.toggleCustomPlayerVisibility(true);
  }

  toggleCustomPlayerVisibility(visible) {
    const sections = [
      document.querySelector(".track-info"),
      document.querySelector(".music-controls"),
      document.querySelector(".volume-control"),
      document.querySelector(".progress-container"),
    ];
    sections.forEach((el) => {
      if (el) el.style.display = visible ? "" : "none";
    });
  }

  togglePlayPause() {
    if (!this.audio) return;

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
      this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else {
      this.audio.play();
      this.isPlaying = true;
      this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
  }

  previousTrack() {
    // For now, just restart current track
    if (this.audio) {
      this.audio.currentTime = 0;
    }
  }

  nextTrack() {
    // For now, just restart current track
    if (this.audio) {
      this.audio.currentTime = 0;
    }
  }

  setVolume(volume) {
    if (this.audio) {
      this.audio.volume = volume / 100;
    }

    const volumeIcon = document.querySelector(".volume-control i");
    if (volume == 0) {
      volumeIcon.className = "fas fa-volume-mute";
    } else if (volume < 50) {
      volumeIcon.className = "fas fa-volume-down";
    } else {
      volumeIcon.className = "fas fa-volume-up";
    }
  }

  seekTo(event) {
    if (!this.audio) return;

    const rect = this.progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * this.audio.duration;

    this.audio.currentTime = newTime;
  }

  updateProgress() {
    if (!this.audio) return;

    const progress = this.progressBar.querySelector(".progress");
    const percentage = (this.audio.currentTime / this.audio.duration) * 100;
    progress.style.width = `${percentage}%`;

    this.currentTimeSpan.textContent = this.formatTime(this.audio.currentTime);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

// Initialize music player
let musicPlayer;

function initMusicPlayer() {
  musicPlayer = new SpotifyMusicPlayer();
}

// Prevent SDK global callback error if the Web Playback SDK script is loaded
// We are not using the SDK player here (only Web API + HTML5 Audio for previews),
// so define a no-op to satisfy the script's expected global.
window.onSpotifyWebPlaybackSDKReady =
  window.onSpotifyWebPlaybackSDKReady || function () {};

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});
