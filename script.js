// Three.js 3D Room Setup
let scene, camera, renderer, room;
let animationId;
let composer, bloomPass;
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
  // Ensure correct color space and brighter, filmic tonemapping
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Setup bloom postprocessing for glow effects
  setupBloomEffect();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffe8cc, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffe6cc, 1.0);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // Create basic room structure first
  createBasicRoom();
  animate();
  addMouseControls();

  // Wait for loaders to be available, then load assets
  waitForLoadersAndLoadAssets();

  // Hide loading screen after critical assets are loaded
  setTimeout(() => {
    hideLoadingScreen();
  }, 1500);
}

// Hide loading screen when 3D scene is ready
function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    // Hide loading screen much faster since we're loading progressively
    setTimeout(() => {
      loadingScreen.classList.add("hidden");
      // Remove loading class and re-enable scrolling when loading screen is hidden
      document.body.classList.remove("loading");
      enableBodyScroll();
      // Remove from DOM after fade out
      setTimeout(() => {
        if (loadingScreen.parentNode) {
          loadingScreen.parentNode.removeChild(loadingScreen);
        }
      }, 500);
    }, 2000); // Reduced from 5 seconds to 2 seconds
  }
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

// Wait for loaders to be available and then load assets
function waitForLoadersAndLoadAssets() {
  const checkLoaders = () => {
    // Check if GLTFLoader is available (most important for our assets)
    if (typeof THREE.GLTFLoader !== "undefined") {
      console.log("GLTF Loader is now available, initializing loaders...");
      initLoaders();

      // Load assets progressively and update room as they load
      loadAssets().then(() => {
        // Update room with newly loaded assets
        updateRoomWithNewAssets();
      });
    } else {
      console.log("Waiting for GLTF Loader to be available...");
      setTimeout(checkLoaders, 100); // Check again in 100ms
    }
  };

  checkLoaders();
}

// Progress tracking
let totalAssets = 0;
let loadedAssetsCount = 0;

function updateProgress() {
  const progressFill = document.getElementById("progress-fill");
  const progressText = document.getElementById("progress-text");

  if (progressFill && progressText) {
    const percentage = Math.round((loadedAssetsCount / totalAssets) * 100);
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;
  }
}

// Load critical 3D assets first, then load others progressively
async function loadAssets() {
  console.log("Loading 3D assets progressively...");

  // Critical assets that are immediately visible
  const criticalAssets = [
    {
      name: "table",
      path: "asset_glb/table.glb",
      type: "gltf",
      priority: "high",
    },
    {
      name: "laptop",
      path: "asset_glb/laptop.glb",
      type: "gltf",
      priority: "high",
    },
    {
      name: "chair",
      path: "asset_glb/chairDesk.glb",
      type: "gltf",
      priority: "high",
    },
  ];

  // Secondary assets that can load after critical ones
  const secondaryAssets = [
    {
      name: "table2",
      path: "asset_glb/table.glb",
      type: "gltf",
      priority: "medium",
    },
    {
      name: "lamp",
      path: "asset_glb/lampRoundTable.glb",
      type: "gltf",
      priority: "medium",
    },
    {
      name: "books",
      path: "asset_glb/books.glb",
      type: "gltf",
      priority: "medium",
    },
    {
      name: "newBed",
      path: "asset_glb/cute_stylized_bed_-_low_poly_-_game_ready.glb",
      type: "gltf",
      priority: "medium",
    },
  ];

  // Decorative assets that can load last
  const decorativeAssets = [
    {
      name: "cake",
      path: "asset_glb/strawberry_cake.glb",
      type: "gltf",
      priority: "low",
    },
    {
      name: "bunny",
      path: "asset_glb/bunny_plush_toy.glb",
      type: "gltf",
      priority: "low",
    },
    {
      name: "indoorPlantNew",
      path: "asset_glb/indoor_plant.glb",
      type: "gltf",
      priority: "low",
    },
    {
      name: "stringLightsNew",
      path: "asset_glb/simple_string_lights.glb",
      type: "gltf",
      priority: "low",
    },
    {
      name: "windowAsset",
      path: "asset_glb/window.glb",
      type: "gltf",
      priority: "low",
    },
  ];

  // Calculate total assets for progress tracking
  totalAssets =
    criticalAssets.length + secondaryAssets.length + decorativeAssets.length;
  loadedAssetsCount = 0;

  // Load critical assets first
  try {
    console.log("Loading critical assets...");
    await Promise.all(
      criticalAssets.map((asset) => loadAssetWithProgress(asset))
    );
    console.log("Critical assets loaded successfully!");

    // Start loading secondary assets in background
    setTimeout(() => {
      console.log("Loading secondary assets...");
      secondaryAssets.forEach((asset) => loadAssetWithProgress(asset));
    }, 100);

    // Start loading decorative assets after a delay
    setTimeout(() => {
      console.log("Loading decorative assets...");
      decorativeAssets.forEach((asset) => loadAssetWithProgress(asset));
    }, 500);
  } catch (error) {
    console.warn("Some critical assets failed to load:", error);
  }
}

// Load asset with progress tracking
function loadAssetWithProgress(asset) {
  return loadAsset(asset)
    .then(() => {
      loadedAssetsCount++;
      updateProgress();
      // Update room with the newly loaded asset
      updateRoomWithNewAssets();
    })
    .catch(() => {
      loadedAssetsCount++;
      updateProgress();
    });
}

// Update room with newly loaded assets
function updateRoomWithNewAssets() {
  console.log("Updating room with newly loaded assets...");

  // Only add assets that aren't already in the room
  addMissingAssetsToRoom();

  // Update the mirror room to include new assets
  updateMirrorRoom();
}

// Update mirror room with new assets
function updateMirrorRoom() {
  if (!window.mirroredRoom) {
    console.warn("Mirrored room not found, recreating...");
    createMirrorReflection();
    return;
  }

  // Find all assets in the main room that don't exist in the mirror room
  const mainRoomAssets = [];
  room.traverse((child) => {
    if (child.name && child.name !== "" && child !== room) {
      mainRoomAssets.push(child);
    }
  });

  // Add missing assets to mirror
  mainRoomAssets.forEach((asset) => {
    // Check if this asset already exists in the mirror room
    const existingMirrorAsset = window.mirroredRoom.getObjectByName(asset.name);
    if (!existingMirrorAsset) {
      addAssetToMirror(asset);
    }
  });
}

// Add only missing assets to the room (optimized version)
function addMissingAssetsToRoom() {
  // Use the cute stylized bed if available, otherwise use regular bed
  let bedToUse = null;
  if (loadedAssets.newBed && !room.getObjectByName("bed")) {
    bedToUse = prepareAsset(loadedAssets.newBed);
    console.log("Using cute stylized bed");
  } else if (loadedAssets.bed && !room.getObjectByName("bed")) {
    bedToUse = prepareAsset(loadedAssets.bed);
    console.log("Using regular bed");
  }

  if (bedToUse) {
    bedToUse.name = "bed";
    bedToUse.position.set(-1.95, -1.75, -4.5);
    bedToUse.scale.set(3, 3, 3);
    bedToUse.rotation.y = 4.75;
    room.add(bedToUse);
    increaseBrightnessOnGroup(bedToUse, 0.97);
    console.log("Added bed to room");
  }

  // Desk against the back wall
  const desk = prepareAsset(loadedAssets.table);
  if (desk && !room.getObjectByName("desk")) {
    desk.name = "desk";
    desk.position.set(1.5, -2.2, -3.5);
    desk.scale.set(3.0, 6.75, 3.0);
    desk.rotation.y = 0;
    room.add(desk);
    console.log("Added desk to room");
  }

  // Laptop on desk
  const laptop = prepareAsset(loadedAssets.laptop);
  if (laptop && !room.getObjectByName("laptop")) {
    laptop.name = "laptop";
    laptop.position.set(2.0, 0.0, -3.8);
    laptop.scale.set(4.0, 4.0, 4.0);
    laptop.rotation.y = 0;

    // Add glow effect to laptop
    addGlowEffectToBooks(laptop);

    room.add(laptop);
    console.log("Added laptop to room");
  }

  // Chair in front of desk
  const chair = prepareAsset(loadedAssets.chair);
  if (chair && !room.getObjectByName("chair")) {
    chair.name = "chair";
    chair.position.set(3.5, -2.0, -3.5);
    chair.scale.set(4.5, 4.5, 4.5);
    chair.rotation.y = Math.PI;
    boostSaturationOnGroup(chair, 1.05);
    room.add(chair);
    console.log("Added chair to room");
  }

  // Lamp for decoration
  const lamp = prepareAsset(loadedAssets.lamp);
  if (lamp && !room.getObjectByName("lamp")) {
    lamp.name = "lamp";
    lamp.position.set(3.2, 0.0, -4.0);
    lamp.scale.set(3.75, 3.75, 3.75);
    room.add(lamp);
    console.log("Added lamp to room");
  }

  // Books for decoration on shelves
  const books = prepareAsset(loadedAssets.books);
  if (books && !room.getObjectByName("books")) {
    books.name = "books";
    books.position.set(2, 1.55, -4.0);
    books.scale.set(10.0, 10.0, 10.0);
    boostSaturationOnGroup(books, 1.45); // Add saturation to decorative books
    addGlowEffectToBooks(books);
    room.add(books);
    console.log("Added books to room");
  }

  // Indoor plant GLB placed on the shelf
  const shelfPlant = prepareAsset(loadedAssets.indoorPlantNew);
  if (shelfPlant && !room.getObjectByName("shelfPlant")) {
    shelfPlant.name = "shelfPlant";
    shelfPlant.position.set(1.5, 1.55, -4.35);
    shelfPlant.scale.set(1, 1, 1);
    shelfPlant.rotation.y = -Math.PI / 12;
    boostSaturationOnGroup(shelfPlant, 1.4); // Enhanced saturation for plant
    room.add(shelfPlant);
    console.log("Added shelf plant to room");
  }

  // Second table
  const table2 = prepareAsset(loadedAssets.table2);
  if (table2 && !room.getObjectByName("table2")) {
    table2.name = "table2";
    table2.position.set(-4.8, -2.2, 3.75);
    table2.scale.set(1.75, 7, 3.5);
    table2.rotation.y = 0;
    room.add(table2);
    console.log("Added second table to room");
  }

  // Create shelves above the desk
  createShelves();

  // Add decorative assets (cake, bunny, etc.)
  addDecorativeAssets();
}

// Add decorative assets to the room
function addDecorativeAssets() {
  // Add cake on the second table
  if (loadedAssets.cake && !room.getObjectByName("cake")) {
    const cake = prepareAsset(loadedAssets.cake);
    if (cake) {
      cake.name = "cake";
      cake.position.set(-3.9, 0, 3); // Position on the second table
      cake.scale.set(0.5, 0.75, 0.5); // Make cake appropriately sized
      cake.rotation.y = Math.PI / 4; // Rotate cake for better presentation

      // Disable shadows for the cake
      cake.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      // Add subtle glowing effect to cake
      addCakeGlowEffect(cake);

      room.add(cake);
      console.log("Added cake to room");
    }
  }

  // Add bunny plush on the bed
  if (loadedAssets.bunny && !room.getObjectByName("bunny")) {
    const bunny = prepareAsset(loadedAssets.bunny);
    if (bunny) {
      bunny.name = "bunny";
      // Position roughly on the top of the bed mattress
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

      // Add glowing effect to bunny
      addGlowEffectToBooks(bunny);

      room.add(bunny);
      console.log("Added bunny to room");
    }
  }

  // Add string lights
  if (loadedAssets.stringLightsNew && !room.getObjectByName("stringLights")) {
    const strLights = prepareAsset(loadedAssets.stringLightsNew);
    if (strLights) {
      const s1 = strLights.clone();
      s1.name = "stringLights";
      increaseBrightnessOnGroup(s1, 10);
      s1.position.set(-1.75, 3.45, -4.8);
      s1.scale.set(0.5, 1, 2);
      addGlowEffectToBooks(s1);
      room.add(s1);
      //addAssetToMirror(s1);
      console.log("Added string lights to room");
    }
  }

  // Add window asset
  if (loadedAssets.windowAsset && !room.getObjectByName("windowAsset")) {
    const windowAsset = prepareAsset(loadedAssets.windowAsset);
    if (windowAsset) {
      windowAsset.name = "windowAsset";
      windowAsset.position.set(-7.71, -0.5, 1.5);
      windowAsset.rotation.y = Math.PI;
      windowAsset.scale.set(0.05, 0.05, 0.05);
      room.add(windowAsset);
      console.log("Added window asset to room");
    }
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

      // Limit vertical angle to prevent going below 90 degrees with ground
      targetCameraAngleX = Math.max(
        0.1, // Minimum angle (slightly above 90 degrees)
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
function createBasicRoom() {
  console.log("Creating basic 3D room structure...");
  room = new THREE.Group();

  // Room walls
  createWalls();

  // Additional decorations (these don't require assets)
  createWindow();
  createSunlightBeams();

  // Create room reflection underneath the floor
  createMirrorReflection();

  scene.add(room);
  console.log("Basic 3D room created successfully!");
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

  // Don't apply saturation boost to all assets - let individual assets handle their own styling
  // boostSaturationOnGroup(cloned, 1.2);

  return cloned;
}

// Create mirror reflection of the scene
function createMirrorReflection() {
  // Clone the entire room
  const mirroredRoom = room.clone();

  // Flip the mirrored room vertically around the floor plane (y = -2.25)
  mirroredRoom.scale.y = -1;
  // Position the mirrored room so it reflects across the floor plane (y = -2.25)
  // This was working correctly for manually created items
  mirroredRoom.position.y = -5.5;

  // Make the mirrored room look like a water reflection
  // Exclude glow meshes from the reflection
  mirroredRoom.traverse((child) => {
    // Skip glow meshes - they shouldn't appear in the reflection
    if (child.userData && child.userData.isGlowMesh) {
      child.visible = false;
      return;
    }

    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => {
          // Create a new material to avoid affecting the original
          const reflectionMaterial = material.clone();
          reflectionMaterial.transparent = true;
          reflectionMaterial.opacity = 0.25; // More subtle water-like reflection
          reflectionMaterial.depthWrite = false; // Prevent z-fighting

          // Add water-like blue tint and darken
          if (reflectionMaterial.color) {
            reflectionMaterial.color.multiplyScalar(0.4); // Darker
            // Add subtle blue tint for water effect
            reflectionMaterial.color.r *= 0.8;
            reflectionMaterial.color.g *= 0.9;
            reflectionMaterial.color.b *= 1.1;
          }

          // Apply the new material
          child.material = reflectionMaterial;
        });
      } else {
        // Create a new material to avoid affecting the original
        const reflectionMaterial = child.material.clone();
        reflectionMaterial.transparent = true;
        reflectionMaterial.opacity = 0.25; // More subtle water-like reflection
        reflectionMaterial.depthWrite = false; // Prevent z-fighting

        // Add water-like blue tint and darken
        if (reflectionMaterial.color) {
          reflectionMaterial.color.multiplyScalar(0.4); // Darker
          // Add subtle blue tint for water effect
          reflectionMaterial.color.r *= 0.8;
          reflectionMaterial.color.g *= 0.9;
          reflectionMaterial.color.b *= 1.1;
        }

        // Apply the new material
        child.material = reflectionMaterial;
      }
    }
  });

  // Add the mirrored room to the scene
  scene.add(mirroredRoom);

  // Store reference to mirrored room for adding new assets later
  window.mirroredRoom = mirroredRoom;

  console.log("Room reflection created successfully (glow meshes excluded)!");
}

// Add new asset to mirror reflection
function addAssetToMirror(asset) {
  if (!window.mirroredRoom) {
    console.warn("Mirrored room not found, cannot add asset to mirror");
    return;
  }

  // Clone the asset for the mirror
  const mirroredAsset = asset.clone();
  mirroredAsset.scale.y = asset.scale.y; // Flip vertically
  mirroredAsset.scale.x = asset.scale.x;
  mirroredAsset.scale.z = asset.scale.z;

  // Apply mirror transformation - flip vertically and position correctly
  // Position the mirrored asset to create a proper reflection across the floor plane (y = -2.25)
  // Since the mirrored room is positioned at y = -4.5, we need to position assets relative to that
  // For proper mirror reflection: mirroredY = -4.5 - assetY (relative to mirrored room position)
  mirroredAsset.position.y = -1 + asset.position.y;

  // Apply reflection material to the mirrored asset
  mirroredAsset.traverse((child) => {
    // Skip glow meshes - they shouldn't appear in the reflection
    if (child.userData && child.userData.isGlowMesh) {
      child.visible = false;
      return;
    }

    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => {
          const reflectionMaterial = material.clone();
          reflectionMaterial.transparent = true;
          reflectionMaterial.opacity = 0.25;
          reflectionMaterial.depthWrite = false;

          if (reflectionMaterial.color) {
            reflectionMaterial.color.multiplyScalar(0.4);
            reflectionMaterial.color.r *= 0.8;
            reflectionMaterial.color.g *= 0.9;
            reflectionMaterial.color.b *= 1.1;
          }

          child.material = reflectionMaterial;
        });
      } else {
        const reflectionMaterial = child.material.clone();
        reflectionMaterial.transparent = true;
        reflectionMaterial.opacity = 0.25;
        reflectionMaterial.depthWrite = false;

        if (reflectionMaterial.color) {
          reflectionMaterial.color.multiplyScalar(0.4);
          reflectionMaterial.color.r *= 0.8;
          reflectionMaterial.color.g *= 0.9;
          reflectionMaterial.color.b *= 1.1;
        }

        child.material = reflectionMaterial;
      }
    }
  });

  // Add to mirrored room
  window.mirroredRoom.add(mirroredAsset);
  console.log(
    `Added ${asset.name} to mirror at position (${mirroredAsset.position.x}, ${mirroredAsset.position.y}, ${mirroredAsset.position.z})`
  );
}

// Create shelves above the desk
function createShelves() {
  const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff }); // White color

  // Top shelf
  const shelfGeometry = new THREE.BoxGeometry(3, 0.1, 1);
  const topShelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
  topShelf.position.set(2.5, 1.5, -4.5);
  topShelf.castShadow = true;
  room.add(topShelf);

  // Add plant on the shelf
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

  // Floor - made thicker with box geometry
  const floorGeometry = new THREE.BoxGeometry(10, 0.5, 10); // Added thickness of 0.5 units
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
  // No rotation needed for box geometry - it's already oriented correctly
  floor.position.y = -2.25; // Adjusted position to account for thickness
  floor.receiveShadow = true;
  floor.castShadow = true; // Floor can now cast shadows too
  room.add(floor);

  // Darker base layer underneath the wooden floor
  const floorBaseGeometry = new THREE.BoxGeometry(10.5, 0.3, 10.2); // Slightly larger and thinner
  const floorBaseMaterial = new THREE.MeshLambertMaterial({
    color: 0x2c1810, // Very dark brown/black base
  });
  const floorBase = new THREE.Mesh(floorBaseGeometry, floorBaseMaterial);
  floorBase.position.y = -2.6; // Positioned below the wooden floor
  floorBase.receiveShadow = true;
  floorBase.castShadow = true;
  room.add(floorBase);

  // Back wall - made thicker and slightly taller
  const backWallGeometry = new THREE.BoxGeometry(10.5, 8.4, 0.3); // Increased height to 7.5 units
  const backWall = new THREE.Mesh(backWallGeometry, backWallMaterial);
  backWall.position.z = -5.15; // Adjusted position to account for thickness
  backWall.position.x = -0.10; // Adjusted position to account for thickness
  backWall.position.y = 1.5; // Centered between floor bottom (-2.75) and new top (4.5): (-2.75 + 4.5) / 2 = 0.875
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  room.add(backWall);

  // Create left wall with actual window opening
  // Build the wall in sections to create a real opening
  const leftWallTopGeometry = new THREE.BoxGeometry(0.3, 2.2, 10);
  const leftWallTop = new THREE.Mesh(leftWallTopGeometry, leftWallMaterial);
  leftWallTop.position.x = -5.15;
  leftWallTop.position.y = 4.4; // Position above the window
  leftWallTop.castShadow = true;
  leftWallTop.receiveShadow = true;
  room.add(leftWallTop);

  const leftWallBottomGeometry = new THREE.BoxGeometry(0.3, 3.5, 10);
  const leftWallBottom = new THREE.Mesh(
    leftWallBottomGeometry,
    leftWallMaterial
  );
  leftWallBottom.position.x = -5.15;
  leftWallBottom.position.y = -1; // Position below the window
  leftWallBottom.castShadow = true;
  leftWallBottom.receiveShadow = true;
  room.add(leftWallBottom);

  // Left section of wall (to the left of window) - shifted left
  const leftWallLeftGeometry = new THREE.BoxGeometry(0.3, 3, 2.9); // Height of window, wider to left edge
  const leftWallLeft = new THREE.Mesh(leftWallLeftGeometry, leftWallMaterial);
  leftWallLeft.position.x = -5.15;
  leftWallLeft.position.y = 2;
  leftWallLeft.position.z = -3.55; // Position further left
  leftWallLeft.castShadow = true;
  leftWallLeft.receiveShadow = true;
  room.add(leftWallLeft);

  // Right section of wall (to the right of window) - smaller since window is shifted left
  const leftWallRightGeometry = new THREE.BoxGeometry(0.3, 3, 6); // Height of window, narrower to right edge
  const leftWallRight = new THREE.Mesh(leftWallRightGeometry, leftWallMaterial);
  leftWallRight.position.x = -5.15;
  leftWallRight.position.y = 2;
  leftWallRight.position.z = 2; // Position closer to center
  leftWallRight.castShadow = true;
  leftWallRight.receiveShadow = true;
  room.add(leftWallRight);

  // Top border/trim for back wall
  const backWallTrimGeometry = new THREE.BoxGeometry(10.6, 0.3, 0.6); // Dark brown trim
  const backWallTrimMaterial = new THREE.MeshLambertMaterial({
    color: 0x654321,
  }); // Rich dark brown color
  const backWallTrim = new THREE.Mesh(
    backWallTrimGeometry,
    backWallTrimMaterial
  );
  backWallTrim.position.z = -5.1; // Positioned at the front edge of the wall
  backWallTrim.position.x = -0.12; // Adjusted position to account for thickness
  backWallTrim.position.y = 5.65; // Positioned at the top of the wall
  backWallTrim.castShadow = true;
  backWallTrim.receiveShadow = true;
  room.add(backWallTrim);

  // Top border/trim for left wall
  const leftWallTrimGeometry = new THREE.BoxGeometry(0.6, 0.3, 10); // Dark brown trim
  const leftWallTrimMaterial = new THREE.MeshLambertMaterial({
    color: 0x654321,
  }); // Rich dark brown color
  const leftWallTrim = new THREE.Mesh(
    leftWallTrimGeometry,
    leftWallTrimMaterial
  );
  leftWallTrim.position.x = -5.1; // Positioned at the front edge of the wall
  leftWallTrim.position.y = 5.65; // Positioned at the top of the wall
  leftWallTrim.castShadow = true;
  leftWallTrim.receiveShadow = true;
  room.add(leftWallTrim);
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

// Setup bloom postprocessing effect
function setupBloomEffect() {
  // Currently using simpler glow method instead of bloom postprocessing
  // This function is kept for future bloom implementation if needed
}

// Add glowing effect to books using controlled glow meshes
function addGlowEffectToBooks(books) {
  // Mark this object as processed to prevent infinite loops
  books.userData = {
    glowProcessed: true,
    glowMeshes: [],
  };

  books.traverse((child) => {
    if (
      child.isMesh &&
      child.material &&
      !child.userData.glowProcessed &&
      !child.userData.isGlowMesh
    ) {
      // Mark this child as processed
      child.userData = { glowProcessed: true };

      // Create very subtle, natural glow
      const glowLayers = [
        {
          scale: 1.01,
          opacity: 0.04,
          color: 0xf8bbd9,
          blending: THREE.AdditiveBlending,
        },
        {
          scale: 1.03,
          opacity: 0.025,
          color: 0xf0a8c8,
          blending: THREE.AdditiveBlending,
        },
        {
          scale: 1.05,
          opacity: 0.015,
          color: 0xe898b8,
          blending: THREE.AdditiveBlending,
        },
      ];

      glowLayers.forEach((layer, index) => {
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          side: THREE.BackSide,
          blending: layer.blending,
          depthWrite: false, // Prevent z-fighting
          depthTest: false, // Always render on top
        });

        const glowMesh = new THREE.Mesh(child.geometry, glowMaterial);
        glowMesh.scale.set(layer.scale, layer.scale, layer.scale);

        // Add subtle position variation for more natural look
        const offset = (index + 1) * 0.001; // Very small offset
        glowMesh.position.set(
          child.position.x + (Math.random() - 0.5) * offset,
          child.position.y + (Math.random() - 0.5) * offset,
          child.position.z + (Math.random() - 0.5) * offset
        );

        glowMesh.rotation.copy(child.rotation);
        glowMesh.userData = {
          isGlowMesh: true,
          layerIndex: index,
          originalOpacity: layer.opacity,
        };

        child.add(glowMesh);
        books.userData.glowMeshes.push(glowMesh);
      });
    }
  });

  // Store reference for animation
  if (!window.glowingBooks) {
    window.glowingBooks = [];
  }
  window.glowingBooks.push(books);
}

// Add subtle glow effect specifically for cake
function addCakeGlowEffect(cake) {
  // Mark this object as processed to prevent infinite loops
  cake.userData = {
    glowProcessed: true,
    glowMeshes: [],
  };

  cake.traverse((child) => {
    if (
      child.isMesh &&
      child.material &&
      !child.userData.glowProcessed &&
      !child.userData.isGlowMesh
    ) {
      // Mark this child as processed
      child.userData = { glowProcessed: true };

      // Create very subtle, natural glow for cake
      const glowLayers = [
        {
          scale: 1.01,
          opacity: 0.02,
          color: 0xf8bbd9,
          blending: THREE.AdditiveBlending,
        },
        {
          scale: 1.02,
          opacity: 0.01,
          color: 0xf0a8c8,
          blending: THREE.AdditiveBlending,
        },
      ];

      glowLayers.forEach((layer, index) => {
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          side: THREE.BackSide,
          blending: layer.blending,
          depthWrite: false,
          depthTest: false,
        });

        const glowMesh = new THREE.Mesh(child.geometry, glowMaterial);
        glowMesh.scale.set(layer.scale, layer.scale, layer.scale);

        // Add subtle position variation for more natural look
        const offset = (index + 1) * 0.0005; // Even smaller offset for cake
        glowMesh.position.set(
          child.position.x + (Math.random() - 0.5) * offset,
          child.position.y + (Math.random() - 0.5) * offset,
          child.position.z + (Math.random() - 0.5) * offset
        );

        glowMesh.rotation.copy(child.rotation);
        glowMesh.userData = {
          isGlowMesh: true,
          layerIndex: index,
          originalOpacity: layer.opacity,
        };

        child.add(glowMesh);
        cake.userData.glowMeshes.push(glowMesh);
      });
    }
  });

  // Store reference for animation
  if (!window.glowingBooks) {
    window.glowingBooks = [];
  }
  window.glowingBooks.push(cake);
}

// Control glow visibility with smooth transitions
function setGlowVisibility(visible) {
  if (window.glowingBooks) {
    window.glowingBooks.forEach((books) => {
      if (books.userData && books.userData.glowMeshes) {
        books.userData.glowMeshes.forEach((glowMesh) => {
          // Animate opacity instead of toggling visibility
          const targetOpacity = visible ? glowMesh.userData.originalOpacity : 0;
          animateGlowOpacity(glowMesh, targetOpacity);
        });
      }
    });
  }
}

// Animate glow opacity smoothly
function animateGlowOpacity(glowMesh, targetOpacity, duration = 300) {
  if (!glowMesh.material) return;

  // Cancel any existing animation for this mesh
  if (glowMesh.userData.animationId) {
    cancelAnimationFrame(glowMesh.userData.animationId);
  }

  const startOpacity = glowMesh.material.opacity;
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Use easeInOutCubic for smooth transition
    const easeProgress =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const currentOpacity =
      startOpacity + (targetOpacity - startOpacity) * easeProgress;
    glowMesh.material.opacity = currentOpacity;

    // Make sure the mesh is visible during animation
    glowMesh.visible = true;

    if (progress < 1) {
      glowMesh.userData.animationId = requestAnimationFrame(animate);
    } else {
      // Clear animation ID and hide mesh completely when opacity reaches 0
      glowMesh.userData.animationId = null;
      if (targetOpacity === 0) {
        glowMesh.visible = false;
      }
    }
  }

  animate();
}

// Animate the glowing books effect
function animateGlowingBooks() {
  if (window.glowingBooks) {
    window.glowingBooks.forEach((books) => {
      // The emissive glow effect is now handled by the material itself
      // No additional animation needed for constant glow
    });
  }
}

// Animate the sunlight beams effect
function animateSunlightBeams() {
  if (window.sunlightBeams) {
    window.sunlightBeams.forEach((sunlightGroup) => {
      sunlightGroup.children.forEach((beam) => {
        if (beam.userData && beam.material) {
          // Create a gentle periodic glow effect
          const time = Date.now() * 0.001; // Convert to seconds
          const glow =
            Math.sin(
              time * beam.userData.animationSpeed +
                beam.userData.animationOffset
            ) *
              0.3 +
            0.7; // Glow between 0.4 and 1.0 opacity

          // Update opacity with gentle glow effect
          beam.material.opacity = beam.userData.originalOpacity * glow;
        }
      });
    });
  }
}

function createWindow() {
  // Window asset is now added in addDecorativeAssets() when assets load
  // This function creates the basic window structure and sky pane

  // Optional sky-blue pane behind the window opening for a pleasant view
  const skyPaneGeometry = new THREE.PlaneGeometry(1.2, 3);
  const skyPaneMaterial = new THREE.MeshLambertMaterial({
    color: 0x87ceeb,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const skyPane = new THREE.Mesh(skyPaneGeometry, skyPaneMaterial);
  // Place slightly behind the left wall so it's visible through the opening
  skyPane.position.set(-5.15, 2, -1.5);
  skyPane.rotation.y = Math.PI / 2;
  room.add(skyPane);
}

function createSunlightBeams() {
  // Create a group to hold all sunlight beams
  const sunlightGroup = new THREE.Group();
  sunlightGroup.name = "sunlightBeams";

  // Window position and dimensions (from createWindow function)
  const windowX = -5.15;
  const windowY = 2;
  const windowZ = -1.5;
  const windowWidth = 1.2;
  const windowHeight = 3;

  // Create streamlined beams - fewer, more focused
  const numBeams = 4; // Fewer beams for more natural look
  const beamLength = 2.5; // Shorter beams for more natural look
  const beamWidth = 0.03; // Much thinner for subtle effect
  const beamHeight = 0.05; // Shorter for more natural appearance

  for (let i = 0; i < numBeams; i++) {
    // Add natural variation to beam length
    const lengthVariation = 0.7 + Math.random() * 0.6; // 70% to 130% of base length
    const currentBeamLength = beamLength * lengthVariation;

    // Create beam geometry - a long, streamlined box
    const beamGeometry = new THREE.BoxGeometry(
      beamWidth,
      beamHeight,
      currentBeamLength
    );

    // Create beam material with softer, more natural sunlight
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff8f0, // Softer, warmer sunlight color
      transparent: true,
      opacity: 0.1 + Math.random() * 0.15, // Much lower opacity for subtlety (0.1 to 0.25)
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending, // Normal blending for softer look
      depthWrite: false, // Prevent z-fighting
    });

    const beam = new THREE.Mesh(beamGeometry, beamMaterial);

    // Position beams to target the bed area
    const xOffset = (Math.random() - 0.5) * windowWidth * 0.6; // Focus on center of window
    const yOffset = (Math.random() - 0.5) * windowHeight * 0.4; // Focus on upper portion of window

    beam.position.set(
      windowX + 1, // Much further in front of the window for dramatic streaming effect
      windowY + yOffset,
      windowZ + xOffset + 0.25
    );

    // Calculate angle to target the bed area
    // Bed is positioned around (-1.95, -1.75, -4.5) based on the code
    const bedX = -25;
    const bedY = -300;
    const bedZ = -20;

    // Calculate direction from window to bed
    const directionX = bedX - beam.position.x;
    const directionY = bedY - beam.position.y;
    const directionZ = bedZ - beam.position.z;

    // Calculate rotation angles to point toward bed with natural variation
    const yAngle = Math.atan2(directionX, directionZ) + 0.5 * 0.3; // Add slight horizontal variation
    const xAngle =
      -Math.atan2(
        directionY,
        Math.sqrt(directionX * directionX + directionZ * directionZ)
      ) -
      Math.PI / 5 +
      (Math.random() - 0.5) * 0.2; // Add slight vertical variation

    beam.rotation.set(xAngle, yAngle, 0); // Point toward bed with natural variation

    // Consistent scale for streamlined appearance
    beam.scale.set(1, 1, 1);

    // Store animation data for glow effect only
    beam.userData = {
      originalOpacity: beamMaterial.opacity,
      animationOffset: (i / numBeams) * Math.PI * 2, // Staggered phase for wave effect
      animationSpeed: 0.3, // Slower, more gentle animation
    };

    sunlightGroup.add(beam);
  }

  // Add the sunlight group to the room
  room.add(sunlightGroup);

  // Store reference for animation
  if (!window.sunlightBeams) {
    window.sunlightBeams = [];
  }
  window.sunlightBeams.push(sunlightGroup);

  console.log("Streamlined sunlight beams created successfully!");
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

  // Animate glowing books
  animateGlowingBooks();

  // Animate sunlight beams
  animateSunlightBeams();

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

  // Update composer size if it exists
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Modal functionality
function initModal() {
  const modal = document.getElementById("navigation-modal");
  const navLinks = document.querySelectorAll(".nav-link");
  const contentSections = document.querySelectorAll(".content-section");
  const closeBtn = document.getElementById("close-modal");

  // Add hover functionality to hide/show glow
  if (modal) {
    modal.addEventListener("mouseenter", () => {
      setGlowVisibility(false); // Hide glow when hovering over menu
    });

    modal.addEventListener("mouseleave", () => {
      setGlowVisibility(true); // Show glow when not hovering over menu
    });
  }

  // Also add hover to individual nav links
  navLinks.forEach((link) => {
    link.addEventListener("mouseenter", () => {
      setGlowVisibility(false);
    });

    link.addEventListener("mouseleave", () => {
      setGlowVisibility(true);
    });
  });

  // Show modal on page load
  if (modal) {
    modal.style.display = "block";
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
      if (
        e.target === desktopModal ||
        e.target.classList.contains("close-instruction")
      ) {
        hideAllContentSections();
      }
    });
  }

  // Handle project folder clicks
  initProjectFolders();

  // Handle resume preview modal click outside to close
  const resumePreviewModal = document.querySelector(".resume-preview-modal");
  if (resumePreviewModal) {
    resumePreviewModal.addEventListener("click", (e) => {
      if (
        e.target === resumePreviewModal ||
        e.target.classList.contains("close-instruction")
      ) {
        hideAllContentSections();
      }
    });
  }

  // Handle education modal click outside to close
  const educationModal = document.querySelector(".education-modal");
  if (educationModal) {
    educationModal.addEventListener("click", (e) => {
      if (
        e.target === educationModal ||
        e.target.classList.contains("close-instruction")
      ) {
        hideAllContentSections();
      }
    });
  }

  // Handle contact modal click outside to close
  const contactModal = document.querySelector(".contact-modal");
  if (contactModal) {
    contactModal.addEventListener("click", (e) => {
      if (
        e.target === contactModal ||
        e.target.classList.contains("close-instruction")
      ) {
        hideAllContentSections();
      }
    });
  }

  // Universal click outside handler for all modals
  document.addEventListener("click", (e) => {
    // Check if any modal is active
    const activeModal = document.querySelector(".content-section.active");
    if (activeModal) {
      const modalContent = activeModal.querySelector(
        ".scrapbook-content, .desktop-window, .resume-preview-content, .education-content, .contact-content"
      );

      // If click is outside the modal content and not on a nav link
      if (
        modalContent &&
        !modalContent.contains(e.target) &&
        !e.target.closest(".nav-link")
      ) {
        hideAllContentSections();
      }
    }
  });
}

function showContentSection(sectionId) {
  // Hide all content sections
  hideAllContentSections();

  // Hide music player when modal opens
  hideMusicPlayer();

  // Prevent scrolling when modal opens
  preventBodyScroll();

  // Small delay to ensure smooth transition
  setTimeout(() => {
    // Show the selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add("active");

      // Special handling for experience section
      if (sectionId === "experience") {
        console.log(
          "Experience section opened - music player should be hidden"
        );
      }
    }
  }, 50);
}

function hideAllContentSections() {
  const contentSections = document.querySelectorAll(".content-section");
  contentSections.forEach((section) => {
    if (section.classList.contains("active")) {
      // Add fade-out animation to the modal content first
      const modalContent = section.querySelector(
        ".scrapbook-content, .desktop-window, .briefcase-container, .education-content, .contact-content"
      );

      if (modalContent) {
        modalContent.style.animation =
          "modalFadeOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      }

      // Hide the backdrop immediately by removing active class and setting display
      section.classList.remove("active");
      section.style.display = "none";

      // Clear animation after it completes
      if (modalContent) {
        setTimeout(() => {
          modalContent.style.animation = "";
          section.style.display = ""; // Reset display property
        }, 300);
      } else {
        section.style.display = ""; // Reset display property immediately if no modal content
      }

      // Show music player when modal closes
      showMusicPlayer();

      // Re-enable scrolling when modal closes
      enableBodyScroll();
    }
  });
}

// Prevent scrolling when modals are open
function preventBodyScroll() {
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.width = "100%";
  document.body.style.top = `-${window.scrollY}px`;
}

function enableBodyScroll() {
  const scrollY = document.body.style.top;
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.width = "";
  document.body.style.top = "";
  if (scrollY) {
    window.scrollTo(0, parseInt(scrollY || "0") * -1);
  }
}

// Music player visibility functions
function hideMusicPlayer() {
  const musicPlayer = document.querySelector(".music-player");
  if (musicPlayer) {
    musicPlayer.style.display = "none";
  }
}

function showMusicPlayer() {
  const musicPlayer = document.querySelector(".music-player");
  if (musicPlayer) {
    musicPlayer.style.display = "block";
  }
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

  // Add loading class to body and prevent scrolling during loading
  document.body.classList.add("loading");
  preventBodyScroll();

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
    this.isLoggedIn = false;
    // Default track to auto-load after login
    // seasons — wave to earth (user-selected)
    this.defaultTrackId = "5VBjyOQzqlPNgdRPMM6prF";
    // Default 30-second track for non-logged in users
    // Using Spotify's preview API - this should work for most tracks
    this.defaultAudioUrl =
      "https://p.scdn.co/mp3-preview/5VBjyOQzqlPNgdRPMM6prF?cid=b3629d1eb6a34dbd91aed2ef24c497f1";

    this.initializeElements();
    this.setupEventListeners();
    this.initializeDefaultMusic();
    this.setupResponsiveHandling();
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

    // Toggle music player when clicking "Now Playing" text
    this.musicTitle.addEventListener("click", (e) => {
      console.log("Now Playing clicked!");
      e.stopPropagation();
      this.toggleExpanded();
    });

    // Make "Now Playing" text look clickable
    this.musicTitle.style.cursor = "pointer";
    this.musicTitle.style.userSelect = "none";

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

  initializeDefaultMusic() {
    // Check if device is mobile or has small width screen
    const isMobile =
      window.innerWidth <= 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // Check if screen width is small (less than 1024px)
    const isSmallWidth = window.innerWidth < 1024;

    if (isMobile || isSmallWidth) {
      // On mobile or small width screens, start with music player closed
      this.isExpanded = false;
      this.musicContent.classList.remove("show");
      this.musicToggle.innerHTML = '<i class="fas fa-music"></i>';
      // Don't show the embed by default on mobile or small screens
    } else {
      // On desktop with larger screens, set initial state as expanded since we want to show the embed
      this.isExpanded = true;
      // Show the default embed immediately when the page loads
      this.showDefaultEmbed();
    }
  }

  playDefaultTrack() {
    // Update track display for default track
    this.trackTitle.textContent = "seasons";
    this.trackArtist.textContent = "wave to earth";
    this.updateHeaderNowPlaying("seasons");

    // Show Spotify embed for the 30-second preview
    this.showDefaultEmbed();
  }

  showDefaultEmbed() {
    // Make sure music content is visible
    this.musicContent.classList.add("show");

    // Update toggle button to show expanded state
    this.musicToggle.innerHTML = '<i class="fas fa-chevron-up"></i>';

    // Create or update an iframe embed for the default track
    let embed = document.getElementById("spotify-default-embed");
    if (!embed) {
      embed = document.createElement("iframe");
      embed.id = "spotify-default-embed";
      embed.setAttribute("data-testid", "embed-iframe");
      embed.style.borderRadius = "12px";
      embed.width = "100%";
      embed.height = "152";
      embed.frameBorder = "0";
      embed.allowFullscreen = true;
      embed.allow =
        "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      embed.loading = "lazy";
      // Insert in the music content area
      this.musicContent.appendChild(embed);
    }
    embed.src = `https://open.spotify.com/embed/track/${this.defaultTrackId}?utm_source=generator`;

    // Hide the custom music player and original login section
    this.musicPlayerContent.style.display = "none";
    this.spotifyLogin.style.display = "none";

    // Create a compact login button directly below the embed
    this.createCompactLoginButton();
  }

  createCompactLoginButton() {
    // Remove any existing compact login button
    const existingBtn = document.getElementById("compact-login-btn");
    if (existingBtn) {
      existingBtn.remove();
    }

    // Create a new compact login button
    const loginBtn = document.createElement("button");
    loginBtn.id = "compact-login-btn";
    loginBtn.innerHTML = '<i class="fab fa-spotify"></i> Login to Spotify';
    loginBtn.style.background = "rgba(255, 255, 255, 0.9)";
    loginBtn.style.color = "#ff69b4";
    loginBtn.style.border = "none";
    loginBtn.style.borderRadius = "20px";
    loginBtn.style.padding = "8px 16px";
    loginBtn.style.fontWeight = "600";
    loginBtn.style.fontSize = "13px";
    loginBtn.style.cursor = "pointer";
    loginBtn.style.transition = "all 0.3s ease";
    loginBtn.style.boxShadow = "0 2px 8px rgba(255, 105, 180, 0.2)";
    loginBtn.style.margin = "10px auto";
    loginBtn.style.display = "block";

    // Add hover effects
    loginBtn.addEventListener("mouseenter", () => {
      loginBtn.style.background = "white";
      loginBtn.style.color = "#ff1493";
      loginBtn.style.transform = "translateY(-2px)";
      loginBtn.style.boxShadow = "0 4px 12px rgba(255, 105, 180, 0.3)";
    });

    loginBtn.addEventListener("mouseleave", () => {
      loginBtn.style.background = "rgba(255, 255, 255, 0.9)";
      loginBtn.style.color = "#ff69b4";
      loginBtn.style.transform = "translateY(0)";
      loginBtn.style.boxShadow = "0 2px 8px rgba(255, 105, 180, 0.2)";
    });

    // Add click handler
    loginBtn.addEventListener("click", () => {
      this.loginToSpotify();
    });

    // Insert the button right after the embed
    const embed = document.getElementById("spotify-default-embed");
    if (embed && embed.parentNode) {
      embed.parentNode.insertBefore(loginBtn, embed.nextSibling);
    }
  }

  setupResponsiveHandling() {
    // Handle window resize and orientation changes
    window.addEventListener("resize", () => {
      const isMobile =
        window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      // Check if screen width is small (less than 1024px)
      const isSmallWidth = window.innerWidth < 1024;

      if ((isMobile || isSmallWidth) && this.isExpanded) {
        // If switching to mobile or small width screen and music player is open, close it
        this.toggleExpanded();
      }
    });
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
    } else {
      // No access token found, show login interface
      this.showLoginInterface();
    }
  }

  showLoginInterface() {
    this.isLoggedIn = false;
    this.spotifyLogin.style.display = "block";
    this.musicPlayerContent.style.display = "none";

    // Reset login styling to default
    this.spotifyLogin.style.padding = "";
    this.spotifyLogin.style.textAlign = "";
    this.spotifyLogin.style.background = "";
    this.spotifyLogin.style.borderRadius = "";
    this.spotifyLogin.style.marginTop = "";
    this.spotifyLogin.style.border = "";
    this.spotifyLogin.style.boxShadow = "";

    // Reset button styling
    const loginBtn = this.spotifyLogin.querySelector("button");
    if (loginBtn) {
      loginBtn.style.background = "";
      loginBtn.style.color = "";
      loginBtn.style.border = "";
      loginBtn.style.borderRadius = "";
      loginBtn.style.padding = "";
      loginBtn.style.fontWeight = "";
      loginBtn.style.fontSize = "";
      loginBtn.style.cursor = "";
      loginBtn.style.transition = "";
      loginBtn.style.boxShadow = "";
      loginBtn.style.transform = "";
    }

    // Remove the default embed if it exists
    this.removeDefaultEmbed();
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
    this.isLoggedIn = true;
    this.spotifyLogin.style.display = "none";
    this.musicPlayerContent.style.display = "block";

    // Remove the default embed when user logs in
    this.removeDefaultEmbed();

    this.updateHeaderNowPlaying();
    // Auto-load a default song if none selected yet
    if (!this.currentTrack && this.accessToken && this.defaultTrackId) {
      this.playTrack(this.defaultTrackId);
    }
  }

  removeDefaultEmbed() {
    const embed = document.getElementById("spotify-default-embed");
    if (embed && embed.parentNode) {
      embed.parentNode.removeChild(embed);
    }

    // Remove the compact login button
    const compactBtn = document.getElementById("compact-login-btn");
    if (compactBtn && compactBtn.parentNode) {
      compactBtn.parentNode.removeChild(compactBtn);
    }

    // Show custom UI again when embed is removed
    this.toggleCustomPlayerVisibility(true);
  }

  async searchTracks() {
    const query = this.searchInput.value.trim();
    if (!query || !this.isLoggedIn || !this.accessToken) return;

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
    if (!this.isLoggedIn || !this.accessToken) {
      console.log("User not logged in, cannot play track");
      return;
    }

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

// Project folder functionality
function initProjectFolders() {
  const projectFolders = document.querySelectorAll(".project-folder");

  const projectUrls = {
    goldenbook: "https://goldenbookofficial.vercel.app/",
    "triangle-completion":
      "https://github.com/sabpdo/Unity-Triangle_Completion",
    "leftover-love": "https://leftover-love.vercel.app/welcome",
    "eco-calc": "https://devpost.com/software/eco-calc",
    qoom: "https://kindswan26.qoom.space/edit/Unnamed/index.html",
    portfolio: "#", // Current page
    more: "https://github.com/sabpdo",
  };

  projectFolders.forEach((folder) => {
    folder.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const projectType = folder.getAttribute("data-project");
      const url = projectUrls[projectType];

      if (url && url !== "#") {
        // Add a nice click animation
        folder.style.transform = "scale(0.95)";
        setTimeout(() => {
          folder.style.transform = "";
          window.open(url, "_blank");
        }, 150);
      } else if (projectType === "portfolio") {
        // For portfolio, just close the modal since we're already here
        hideAllContentSections();
      }
    });

    // Add keyboard accessibility
    folder.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        folder.click();
      }
    });

    // Make folders focusable
    folder.setAttribute("tabindex", "0");
    folder.setAttribute("role", "button");
    folder.setAttribute(
      "aria-label",
      `Open ${folder.querySelector(".folder-name").textContent} project`
    );
  });
}

// Briefcase Experience Animations
function initBriefcaseAnimations() {
  const briefcaseModal = document.querySelector(".briefcase-modal");
  const experienceCards = document.querySelectorAll(".experience-card");
  const statBadges = document.querySelectorAll(".stat-badge");
  const companyLogos = document.querySelectorAll(".company-logo");
  const techTags = document.querySelectorAll(".tech-tag");
  const highlightItems = document.querySelectorAll(".highlight-item");

  // Add staggered animation to experience cards on hover
  experienceCards.forEach((card, index) => {
    card.addEventListener("mouseenter", () => {
      // Add a subtle glow effect
      card.style.boxShadow =
        "0 25px 50px rgba(102, 126, 234, 0.2), 0 0 0 1px rgba(102, 126, 234, 0.3)";

      // Animate the company logo
      const logo = card.querySelector(".company-logo");
      if (logo) {
        logo.style.transform = "scale(1.15) rotate(10deg)";
        logo.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      }

      // Animate tech tags
      const tags = card.querySelectorAll(".tech-tag");
      tags.forEach((tag, tagIndex) => {
        setTimeout(() => {
          tag.style.transform = "translateY(-3px) scale(1.05)";
          tag.style.transition = "transform 0.2s ease";
        }, tagIndex * 50);
      });

      // Animate highlight items
      const highlights = card.querySelectorAll(".highlight-item");
      highlights.forEach((item, itemIndex) => {
        setTimeout(() => {
          item.style.transform = "translateY(-2px) scale(1.02)";
          item.style.transition = "transform 0.2s ease";
        }, itemIndex * 100);
      });
    });

    card.addEventListener("mouseleave", () => {
      // Reset all animations
      card.style.boxShadow = "";

      const logo = card.querySelector(".company-logo");
      if (logo) {
        logo.style.transform = "";
      }

      const tags = card.querySelectorAll(".tech-tag");
      tags.forEach((tag) => {
        tag.style.transform = "";
      });

      const highlights = card.querySelectorAll(".highlight-item");
      highlights.forEach((item) => {
        item.style.transform = "";
      });
    });
  });

  // Add click animation to stat badges
  statBadges.forEach((badge) => {
    badge.addEventListener("click", () => {
      badge.style.transform = "scale(0.95)";
      setTimeout(() => {
        badge.style.transform = "";
      }, 150);
    });
  });

  // Add ripple effect to company logos
  companyLogos.forEach((logo) => {
    logo.addEventListener("click", (e) => {
      const ripple = document.createElement("div");
      const rect = logo.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      `;

      logo.style.position = "relative";
      logo.style.overflow = "hidden";
      logo.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });

  // Add CSS for ripple animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes ripple {
      to {
        transform: scale(2);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Add floating animation to tech tags
  techTags.forEach((tag, index) => {
    tag.addEventListener("mouseenter", () => {
      tag.style.transform = "translateY(-4px) scale(1.1)";
      tag.style.boxShadow = "0 8px 20px rgba(102, 126, 234, 0.3)";
    });

    tag.addEventListener("mouseleave", () => {
      tag.style.transform = "";
      tag.style.boxShadow = "";
    });
  });

  // Add typewriter effect to achievement descriptions
  const achievementDescriptions = document.querySelectorAll(
    ".achievement-description p"
  );
  achievementDescriptions.forEach((desc, index) => {
    const originalText = desc.textContent;
    desc.textContent = "";
    desc.style.borderRight = "2px solid #667eea";
    desc.style.animation = "blink 1s infinite";

    setTimeout(() => {
      let i = 0;
      const typeWriter = () => {
        if (i < originalText.length) {
          desc.textContent += originalText.charAt(i);
          i++;
          setTimeout(typeWriter, 20);
        } else {
          desc.style.borderRight = "none";
          desc.style.animation = "none";
        }
      };
      typeWriter();
    }, 2000 + index * 1000);
  });

  // Add blink animation for typewriter effect
  const blinkStyle = document.createElement("style");
  blinkStyle.textContent = `
    @keyframes blink {
      0%, 50% { border-color: #667eea; }
      51%, 100% { border-color: transparent; }
    }
  `;
  document.head.appendChild(blinkStyle);
}

// Collapsible Section Functionality
function toggleSection(sectionName) {
  const content = document.getElementById(sectionName + "-content");
  const button = document.querySelector(
    `[onclick="toggleSection('${sectionName}')"]`
  );
  const icon = button.querySelector("i");

  if (content.classList.contains("collapsed")) {
    // Expand section
    content.classList.remove("collapsed");
    button.classList.remove("collapsed");
    // Delay icon rotation slightly for smoother animation
    setTimeout(() => {
      icon.style.transform = "rotate(0deg)";
    }, 50);
  } else {
    // Collapse section
    content.classList.add("collapsed");
    button.classList.add("collapsed");
    icon.style.transform = "rotate(-90deg)";
  }
}

// Close Briefcase Modal Function
function closeBriefcaseModal() {
  const experienceSection = document.getElementById("experience");
  if (experienceSection) {
    experienceSection.classList.remove("active");
    experienceSection.style.display = "none";
    // Show music player when experience modal closes
    showMusicPlayer();
    // Re-enable scrolling when modal closes
    enableBodyScroll();
  }
}

// Initialize briefcase animations when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initBriefcaseAnimations();
});

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});
