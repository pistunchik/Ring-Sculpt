import * as THREE from 'three';

export interface MaterialPresetInfo {
  id: string;
  name: string;
  colorClass: string;
  colorHex: string;
  isGlow?: boolean;
  group: 'pla_matte' | 'silk' | 'glow';
}

export interface MaterialGroup {
  id: string;
  label: string;
  presets: MaterialPresetInfo[];
}

export const MATERIAL_PRESETS_LIST: MaterialPresetInfo[] = [
  // ── PLA Matte ──
  { id: 'ice_blue',        name: 'Ice Blue',              colorClass: 'bg-[#7ecbf2]', colorHex: '#7ecbf2', group: 'pla_matte' },
  { id: 'sakura_pink',     name: 'Sakura Pink',           colorClass: 'bg-[#f88cb0]', colorHex: '#f88cb0', group: 'pla_matte' },
  { id: 'mandarin_orange', name: 'Mandarin Orange',       colorClass: 'bg-[#ff8f1c]', colorHex: '#ff8f1c', group: 'pla_matte' },
  { id: 'matte_charcoal',  name: 'Matte Charcoal',        colorClass: 'bg-[#1c1c1c]', colorHex: '#1c1c1c', group: 'pla_matte' },
  // ── Silk ──
  { id: 'two_tone',        name: 'Сине-розовый',       colorClass: 'bg-gradient-to-r from-[#00b0ff] to-[#ff00a0]', colorHex: '#00b0ff', group: 'silk' },
  { id: 'silk_dark_red',   name: 'Тёмно-красный',      colorClass: 'bg-gradient-to-br from-[#8b0000] to-[#1a0000]', colorHex: '#8b0000', group: 'silk' },
  // ── Glow ──
  { id: 'glow_blue',       name: 'Светящийся голубой',    colorClass: 'bg-[#00d8ff] shadow-[0_0_10px_rgba(0,216,255,0.85)] animate-pulse', colorHex: '#00d8ff', isGlow: true, group: 'glow' },
  { id: 'glow_green',      name: 'Светящийся зелёный',   colorClass: 'bg-[#39ff14] shadow-[0_0_10px_rgba(57,255,20,0.85)] animate-pulse',  colorHex: '#39ff14', isGlow: true, group: 'glow' },
  { id: 'glow_purple',     name: 'Светящийся фиолетовый', colorClass: 'bg-[#cc44ff] shadow-[0_0_10px_rgba(204,68,255,0.85)] animate-pulse', colorHex: '#cc44ff', isGlow: true, group: 'glow' },
];

export const MATERIAL_GROUPS: MaterialGroup[] = [
  {
    id: 'pla_matte',
    label: 'PLA Matte',
    presets: MATERIAL_PRESETS_LIST.filter((m) => m.group === 'pla_matte'),
  },
  {
    id: 'silk',
    label: 'PLA Silk',
    presets: MATERIAL_PRESETS_LIST.filter((m) => m.group === 'silk'),
  },
  {
    id: 'glow',
    label: 'Светящийся',
    presets: MATERIAL_PRESETS_LIST.filter((m) => m.group === 'glow'),
  },
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
  silk_dark_red: {
    // PLA Silk Dual — deep crimson with dark black sheen
    color: 0x8b0000,
    roughness: 0.08,
    metalness: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  },
  matte_charcoal: {
    // Bambu Lab PLA Matte Charcoal (11101)
    color: 0x1c1c1c,
    roughness: 0.92,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 1.0,
  },
  glow_green: {
    // Kingroon PLA glow-in-the-dark green
    color: 0x39ff14,
    emissive: 0x1aaa00,
    emissiveIntensity: 0.80,
    roughness: 0.15,
    metalness: 0.0,
  },
  glow_purple: {
    // Kingroon PLA glow-in-the-dark purple
    color: 0xcc44ff,
    emissive: 0x7700cc,
    emissiveIntensity: 0.80,
    roughness: 0.15,
    metalness: 0.0,
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

  if (presetName === 'glow_blue' || presetName === 'glow_green' || presetName === 'glow_purple') {
    return new THREE.MeshPhysicalMaterial({
      color: params.color,
      emissive: new THREE.Color(params.emissive),
      emissiveIntensity: params.emissiveIntensity,
      roughness: params.roughness,
      metalness: params.metalness,
      shadowSide: THREE.DoubleSide,
    });
  }

  if (presetName === 'silk_dark_red') {
    const mat = new THREE.MeshPhysicalMaterial({
      roughness: 0.08,
      metalness: 0.72,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
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
         // Silk dual-extrusion: deep crimson-red / near-black shift
         vec3 splitDir = normalize(vec3(1.0, 0.35, 0.2));
         float dotVal = dot(N, splitDir);
         float mixRatio = smoothstep(-0.55, 0.55, dotVal);

         // Rich dark red (deep crimson) to almost-black
         vec3 crimsonColor = vec3(0.55, 0.0, 0.0);
         vec3 darkColor    = vec3(0.07, 0.0, 0.0);

         diffuseColor.rgb = mix(darkColor, crimsonColor, mixRatio);`
      );
    };

    return mat;
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
