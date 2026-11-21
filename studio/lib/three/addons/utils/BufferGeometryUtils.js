/* Minimal stub of three.js r170 BufferGeometryUtils — only toTrianglesDrawMode,
   which GLTFLoader.js imports. The official file is MIT (three.js authors).
   Our brain GLB uses TRIANGLES exclusively, so this function is not exercised. */
export function toTrianglesDrawMode(geometry /*, drawMode */) {
  return geometry;
}
