import type { RestorationPreset } from '../types';

export const RESTORATION_PRESETS: RestorationPreset[] = [
  {
    id: 'natgeo-vogue-master',
    name: 'NatGeo & Vogue Medium Format Master',
    tagline: 'Your custom 20-year Senior Retoucher prompt. Phase One f/2.8 aesthetic with softbox re-lighting.',
    icon: 'Camera',
    badge: 'Your Custom Prompt',
    prompt: `You are a Senior High-End Photo Retoucher and AI Restoration Specialist with 20 years of experience working for top-tier publications like National Geographic and Vogue. You possess expert knowledge of photogrammetry, texture reconstruction, and professional studio lighting setups.

I have a low-quality source image that suffers from severe JPEG compression, digital noise, and lack of definition. It needs to be transformed into a gallery-quality asset suitable for large-format printing.

Perform a forensic restoration and massive upscale of this image to 8K resolution. Specifically:

1. Aggressively strip away all compression artefacts, colour banding, and sensor noise.

2. Reconstruct missing high-frequency details (such as skin pores, fabric weave, or surface textures) to eliminate any "soft" or blurry areas.

3. Re-light the scene to mimic a professional softbox setup, introducing gentle, volumetric shadows that add depth.

The final output must be a hyper-realistic, 8K resolution image. The aesthetic should match a RAW file taken with a high-end medium format camera (like a Phase One) and a prime lens at f/2.8.

Do not alter the fundamental composition or the identity of the subject. Strictly avoid the "waxy," "plastic," or overly smooth look common in AI upscaling. Do not over-saturate colours. Do not introduce over-sharpening halos. Ensure facial features remain anatomically correct and true to the original.`
  },
  {
    id: 'photorealistic-portrait',
    name: 'Natural Studio Portrait & Skin Texture',
    tagline: 'Preserves micro skin pores, natural vellus hair, and true eye reflections without plastic smoothing.',
    icon: 'User',
    badge: 'Portraits',
    prompt: `Act as an elite beauty and editorial portrait retoucher. Restore and upscale this portrait with extreme fidelity.

Requirements:
1. Reconstruct realistic epidermal micro-textures, fine skin pores, eyelashes, and hair strands without introducing waxy AI smoothing or painterly artifacts.
2. Neutralize JPEG macro-blocking, chromatic aberration, and digital sensor noise.
3. Balance tonal values to emulate medium-format digital capture with gentle organic skin tones.
4. Preserve the exact facial geometry, age lines, expressions, and subject identity identically to the original.`
  },
  {
    id: 'landscape-architecture',
    name: 'Landscape, Nature & Architecture',
    tagline: 'Crisp micro-contrast for foliage, stone masonry, architectural lines, and dynamic skies.',
    icon: 'Mountain',
    badge: 'Scenery',
    prompt: `Act as a master landscape and architectural conservator. Perform an ultra-high definition reconstruction of this scene.

Requirements:
1. Reconstruct granular natural textures: foliage leaves, tree bark, stone textures, masonry edges, and subtle water reflections.
2. Eliminate sky pixelation, JPEG banding, and low-bitrate compression artifacts.
3. Calibrate dynamic range to resemble a single-shot high-bitrate HDR exposure with crisp atmospheric clarity.
4. Keep original framing, perspective, and lighting mood intact.`
  },
  {
    id: 'vintage-archival',
    name: 'Archival & Vintage Photo Restoration',
    tagline: 'Repairs scratches, dust, paper creases, and color fading while retaining vintage soul.',
    icon: 'Clock',
    badge: 'Archival',
    prompt: `You are an expert archival photo conservator and restoration chemist. Restore this damaged or vintage photograph.

Requirements:
1. Detect and cleanly remove surface scratches, dust specks, chemical staining, and scan pixelation.
2. Reconstruct lost facial features, clothing weaves, and background elements with historical authenticity.
3. Gently restore natural tonal contrast and realistic period-appropriate color depth without looking artificially colorized.
4. Retain the authentic period atmosphere while producing ultra-crisp modern resolution.`
  }
];

export const DEFAULT_PROMPT = RESTORATION_PRESETS[0].prompt;
