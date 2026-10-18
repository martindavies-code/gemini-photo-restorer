export interface SampleChallenge {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  badge: string;
  generator: () => File;
}

export const SAMPLE_CHALLENGES: SampleChallenge[] = [
  {
    id: 'vintage-sepia',
    title: '1968 Archival Portrait',
    subtitle: 'Suffering from heavy silver halide grain, paper creasing & dynamic range loss.',
    category: 'Archival',
    badge: 'Film Grain & Scratches',
    generator: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // Sepia vintage gradient
      const grad = ctx.createLinearGradient(0, 0, 512, 640);
      grad.addColorStop(0, '#2d221c');
      grad.addColorStop(0.3, '#5c4333');
      grad.addColorStop(0.7, '#8f6e54');
      grad.addColorStop(1, '#1f1611');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 640);

      // Vintage vignette
      const radGrad = ctx.createRadialGradient(256, 320, 100, 256, 320, 360);
      radGrad.addColorStop(0, 'rgba(0,0,0,0)');
      radGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, 512, 640);

      // Subject Silhouette
      ctx.fillStyle = '#caa589';
      ctx.beginPath();
      ctx.ellipse(256, 300, 105, 135, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#211712';
      ctx.beginPath();
      ctx.ellipse(256, 210, 115, 80, 0, 0, Math.PI * 2);
      ctx.fill();

      // Clothing shoulders
      ctx.fillStyle = '#3a2b22';
      ctx.beginPath();
      ctx.ellipse(256, 520, 190, 130, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#3d2b20';
      ctx.beginPath();
      ctx.arc(215, 290, 9, 0, Math.PI * 2);
      ctx.arc(297, 290, 9, 0, Math.PI * 2);
      ctx.fill();

      // Simulated chemical degradation & grain
      const imgData = ctx.getImageData(0, 0, 512, 640);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 60;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 0.85));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.6));
      }
      ctx.putImageData(imgData, 0, 0);

      // Physical paper crease scratches
      ctx.strokeStyle = 'rgba(255, 245, 230, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(40, 20);
      ctx.lineTo(480, 600);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(460, 40);
      ctx.lineTo(80, 580);
      ctx.stroke();
      // Synthetic sync return
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new File([ab], '1968_archival_sepia_portrait.jpg', { type: 'image/jpeg' });
    }
  },
  {
    id: 'compressed-jpeg',
    title: 'Low-Bitrate 360p Landscape',
    subtitle: 'Suffering from severe 8x8 macro-blocking, sky banding & ringing artifacts.',
    category: 'Digital Noise',
    badge: 'JPEG Compression',
    generator: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // Sunset Sky with Banding
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 240);
      skyGrad.addColorStop(0, '#0c2242');
      skyGrad.addColorStop(0.5, '#452b57');
      skyGrad.addColorStop(0.85, '#a34841');
      skyGrad.addColorStop(1, '#e3843b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 640, 240);

      // Mountain Ridges
      ctx.fillStyle = '#1c1724';
      ctx.beginPath();
      ctx.moveTo(0, 240);
      ctx.lineTo(120, 140);
      ctx.lineTo(260, 190);
      ctx.lineTo(410, 110);
      ctx.lineTo(540, 180);
      ctx.lineTo(640, 130);
      ctx.lineTo(640, 360);
      ctx.lineTo(0, 360);
      ctx.fill();

      // Foreground lake reflection
      const lakeGrad = ctx.createLinearGradient(0, 240, 0, 360);
      lakeGrad.addColorStop(0, '#59323a');
      lakeGrad.addColorStop(1, '#0e121f');
      ctx.fillStyle = lakeGrad;
      ctx.fillRect(0, 240, 640, 120);

      // Simulated low-bitrate 8x8 pixel quantization
      const imgData = ctx.getImageData(0, 0, 640, 360);
      const data = imgData.data;
      const blockSize = 8;
      for (let y = 0; y < 360; y += blockSize) {
        for (let x = 0; x < 640; x += blockSize) {
          const idx = (y * 640 + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          for (let by = 0; by < blockSize && y + by < 360; by++) {
            for (let bx = 0; bx < blockSize && x + bx < 640; bx++) {
              const bIdx = ((y + by) * 640 + (x + bx)) * 4;
              data[bIdx] = r + (Math.random() - 0.5) * 18;
              data[bIdx + 1] = g + (Math.random() - 0.5) * 18;
              data[bIdx + 2] = b + (Math.random() - 0.5) * 18;
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.35);
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new File([ab], 'low_bitrate_compressed_landscape.jpg', { type: 'image/jpeg' });
    }
  },
  {
    id: 'editorial-fashion',
    title: 'Editorial Vogue Fashion Shot',
    subtitle: 'Blown highlights, soft f/5.6 kit lens blur & digital chromatic fringing.',
    category: 'Vogue & Studio',
    badge: 'Softness & Halos',
    generator: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 680;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // Studio High-Key backdrop
      const grad = ctx.createLinearGradient(0, 0, 512, 680);
      grad.addColorStop(0, '#151722');
      grad.addColorStop(0.5, '#2e3447');
      grad.addColorStop(1, '#0e111a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 680);

      // Model silhouette with dramatic lighting
      ctx.fillStyle = '#ecc7b0';
      ctx.beginPath();
      ctx.ellipse(256, 310, 95, 130, 0, 0, Math.PI * 2);
      ctx.fill();

      // High-fashion dark hair
      ctx.fillStyle = '#121318';
      ctx.beginPath();
      ctx.ellipse(256, 210, 110, 95, 0, 0, Math.PI * 2);
      ctx.fill();

      // High-fashion red lip accent
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.ellipse(256, 360, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // High-fashion silk dress
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.ellipse(256, 560, 170, 140, 0, 0, Math.PI * 2);
      ctx.fill();

      // Simulated blur & chromatic fringing
      ctx.filter = 'blur(3px)';
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';

      const dataUrl = canvas.toDataURL('image/jpeg', 0.45);
      const byteString = atob(dataUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new File([ab], 'editorial_vogue_fashion_sample.jpg', { type: 'image/jpeg' });
    }
  }
];
