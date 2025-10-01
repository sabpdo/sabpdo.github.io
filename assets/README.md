# 3D Assets for Personal Website

This folder contains all the 3D models for your personal website room.

## Current Assets:

- `MacBook_Air_13_.blend` - MacBook laptop model
- `TABLE.blend` - Table furniture
- `tv_table.blend` - TV stand/table
- `LP_Furniture.blend` - Low poly furniture pack
- `indoorplant.fbx` - Indoor plant model
- `Flower vase_hipoly.max` - Flower vase
- `Vase 2016.max` - Another vase model
- `KidChair_KC002_2015.max` - Chair model
- `Pack_2.blend` - Additional furniture pack

## Converting to Web Format:

To use these assets in your Three.js website, you need to convert them to web-compatible formats:

### Option 1: Convert to GLTF (Recommended)

1. **Blender files (.blend):**

   - Open in Blender
   - File → Export → glTF 2.0 (.glb/.gltf)
   - Choose .glb for single file or .gltf for separate files

2. **3ds Max files (.max):**

   - Export as FBX first
   - Then convert FBX to GLTF using online converters or Blender

3. **FBX files (.fbx):**
   - Can be used directly with FBXLoader
   - Or convert to GLTF for better performance

### Option 2: Use Online Converters

- **glTF Converter:** https://products.aspose.app/3d/conversion/fbx-to-gltf
- **Three.js Editor:** https://threejs.org/editor/ (import and export)

### Option 3: Use Blender (Free)

1. Download Blender (free)
2. Import your .blend, .max, or .fbx files
3. Export as .glb or .gltf
4. Place converted files in this assets folder

## File Naming Convention:

After conversion, rename files to be web-friendly:

- `macbook.glb`
- `table.glb`
- `tv_table.glb`
- `furniture.glb`
- `plant.glb`
- `vase1.glb`
- `vase2.glb`
- `chair.glb`
- `pack.glb`

## Current Implementation:

The website currently uses placeholder objects that represent your assets. Once you convert the files to .glb or .gltf format, the website will automatically load and display the actual 3D models instead of the placeholders.

## Performance Tips:

- Keep file sizes under 5MB for web use
- Use .glb format for single files
- Optimize textures and reduce polygon count if needed
- Test loading times on slower connections
