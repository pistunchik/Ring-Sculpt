import * as THREE from 'three';

export interface MaterialPresetInfo {
  id: string;
  name: string;
  colorClass: string;
  colorHex: string;
  isGlow?: boolean;
}

export const MATERIAL_PRESETS_LIST: MaterialPresetInfo[] = [
  { id: 'ice_blue', name: 'Ice Blue', colorClass: 'bg-[#7ecbf2]', colorHex: '#7ecbf2' },
  { id: 'sakura_pink', name: 'Sakura Pink', colorClass: 'bg-[#f88cb0]', colorHex: '#f88cb0' },
  { id: 'mandarin_orange', name: 'Mandarin Orange', colorClass: 'bg-[#ff8f1c]', colorHex: '#ff8f1c' },
  { id: 'two_tone', name: 'Сине-розовый', colorClass: 'bg-gradient-to-r from-[#00b0ff] to-[#ff00a0]', colorHex: '#00b0ff' },
  { id: 'glow_blue', name: 'голубой светящийся', colorClass: 'bg-[#00d8ff] shadow-[0_0_10px_rgba(0,216,255,0.85)] animate-pulse', colorHex: '#00d8ff', isGlow: true },
];

export const materialShaderDefs: Record<string, any> = {
  ice_blue: {
    color: 0x7ecbf2,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
    transmission: 0.05,
    thickness: 0.5,
  },
  sakura_pink: {
    color: 0xf88cb0,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
    transmission: 0.05,
    thickness: 0.5,
  },
  mandarin_orange: {
    color: 0xff8f1c,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
    transmission: 0.05,
    thickness: 0.5,
  },
  two_tone: {
    color: 0xffffff,
    roughness: 0.10,
    metalness: 0.40,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  },
  glow_blue: {
    color: 0x00c4ff,
    emissive: 0x0088dd,
    emissiveIntensity: 0.75,
    roughness: 0.12,
    metalness: 0.05,
  },
  // Backward compatibility fallbacks for legacy preset names
  pastel_blue: {
    color: 0x7ecbf2,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
  },
  pastel_pink: {
    color: 0xf88cb0,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
  },
  pastel_yellow: {
    color: 0xff8f1c,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
  },
  pastel_light_green: {
    color: 0x7ecbf2,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
  },
  pastel_milky: {
    color: 0x7ecbf2,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
  },
};

export const createRingMaterial = (presetName: string): THREE.Material => {
  const params = materialShaderDefs[presetName] || materialShaderDefs.ice_blue;

  if (presetName === 'glow_blue') {
    return new THREE.MeshPhysicalMaterial({
      color: params.color,
      emissive: new THREE.Color(params.emissive),
      emissiveIntensity: params.emissiveIntensity,
      roughness: params.roughness,
      metalness: params.metalness,
      shadowSide: THREE.DoubleSide,
    });
  }

  if (presetName === 'two_tone') {
    const mat = new THREE.MeshPhysicalMaterial({
      roughness: 0.15,
      metalness: 0.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      shadowSide: THREE.DoubleSide,
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vLocalPos;
         varying vec3 vLocalNormal;`
      ).replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLocalPos = position;
         vLocalNormal = normal;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vLocalPos;
         varying vec3 vLocalNormal;`
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 N = vec3(0.0, 0.0, 1.0);
         if (length(vLocalNormal) > 0.001) {
           N = normalize(vLocalNormal);
         }
         // Custom split direction representing the co-extrusion plane.
         // A tilted axis ensures all curvatures of the ring (X, Y, Z axes) display the rich color shift.
         vec3 splitDir = normalize(vec3(1.0, 0.35, 0.2));
         float dotVal = dot(N, splitDir);
         float mixRatio = smoothstep(-0.55, 0.55, dotVal);
         
         // Premium silk co-extruded filament colors (deep vibrant royal cyan-blue and lush neon magenta-pink)
         vec3 blueColor = vec3(0.05, 0.52, 1.0);
         vec3 pinkColor = vec3(1.0, 0.18, 0.72);
         
         diffuseColor.rgb = mix(blueColor, pinkColor, mixRatio);`
      );
    };

    return mat;
  }

  return new THREE.MeshPhysicalMaterial({
    color: params.color,
    roughness: params.roughness,
    metalness: params.metalness,
    clearcoat: params.clearcoat,
    clearcoatRoughness: params.clearcoatRoughness,
    transmission: params.transmission,
    thickness: params.thickness,
    ior: 1.48,
    reflectivity: 0.5,
    specularIntensity: 0.8,
    shadowSide: THREE.DoubleSide,
  });
};
