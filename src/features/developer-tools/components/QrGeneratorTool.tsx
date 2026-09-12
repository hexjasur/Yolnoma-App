import { useMemo, useState, type ChangeEvent } from 'react';
import { Download, ImagePlus, QrCode } from 'lucide-react';
import { ToolCard, ToolTitle } from './ToolShell';

const buttonClass = 'inline-flex items-center justify-center gap-2 border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[var(--accent)] hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40';

function toHex(value: string) {
  return value.replace('#', '').toUpperCase();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function QrGeneratorTool() {
  const [value, setValue] = useState('https://www.yolnoma.uz');
  const [foreground, setForeground] = useState('#111111');
  const [background, setBackground] = useState('#FFFFFF');
  const [errorCorrection, setErrorCorrection] = useState('M');
  const [logo, setLogo] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const qrUrl = useMemo(() => {
    const params = new URLSearchParams({
      size: '600x600',
      format: 'png',
      color: toHex(foreground),
      bgcolor: toHex(background),
      ecc: errorCorrection,
      qzone: '2',
      data: value,
    });
    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
  }, [background, errorCorrection, foreground, value]);

  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const downloadPng = async () => {
    if (!value || isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(qrUrl);
      const qrBlob = await response.blob();
      if (!logo) {
        downloadBlob(qrBlob, 'yolnoma-qr.png');
        return;
      }
      const [qrImage, logoImage] = await Promise.all([createImageBitmap(qrBlob), loadImage(logo)]);
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(qrImage, 0, 0, 600, 600);
      const logoSize = 120;
      const logoX = (600 - logoSize) / 2;
      context.fillStyle = background;
      context.fillRect(logoX - 10, logoX - 10, logoSize + 20, logoSize + 20);
      context.drawImage(logoImage, logoX, logoX, logoSize, logoSize);
      await new Promise<void>((resolve) => canvas.toBlob((blob) => { if (blob) downloadBlob(blob, 'yolnoma-qr.png'); resolve(); }, 'image/png'));
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadSvg = async () => {
    if (!value || isDownloading) return;
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ size: '600x600', format: 'svg', color: toHex(foreground), bgcolor: toHex(background), ecc: errorCorrection, qzone: '2', data: value });
      const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`);
      let svg = await response.text();
      if (logo && svg.includes('</svg>')) {
        svg = svg.replace('</svg>', `<rect x="240" y="240" width="120" height="120" rx="12" fill="${background}"/><image href="${logo}" x="250" y="250" width="100" height="100" preserveAspectRatio="xMidYMid meet"/></svg>`);
      }
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'yolnoma-qr.svg');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ToolCard>
      <ToolTitle icon={QrCode} text="QR Code Generator" subtitle="Customize colors, add a logo, choose error correction, and download PNG or SVG." />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <textarea value={value} onChange={(event) => setValue(event.target.value)} className="min-h-36 w-full resize-y border border-white/10 bg-black/20 p-4 text-sm text-white/80 outline-none focus:border-[var(--accent)]" placeholder="Text or URL..." />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 border border-white/[0.08] bg-black/10 p-3 text-sm text-white/70">QR color<input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} className="h-9 w-14 cursor-pointer border-0 bg-transparent" /></label>
            <label className="flex items-center justify-between gap-3 border border-white/[0.08] bg-black/10 p-3 text-sm text-white/70">Background<input type="color" value={background} onChange={(event) => setBackground(event.target.value)} className="h-9 w-14 cursor-pointer border-0 bg-transparent" /></label>
            <label className="flex items-center justify-between gap-3 border border-white/[0.08] bg-black/10 p-3 text-sm text-white/70">Error correction<select value={errorCorrection} onChange={(event) => setErrorCorrection(event.target.value)} className="border border-white/10 bg-[#171711] px-3 py-2 text-white outline-none focus:border-[var(--accent)]"><option value="L">L · 7%</option><option value="M">M · 15%</option><option value="Q">Q · 25%</option><option value="H">H · 30%</option></select></label>
            <label className="flex cursor-pointer items-center justify-between gap-3 border border-white/[0.08] bg-black/10 p-3 text-sm text-white/70"><span className="inline-flex items-center gap-2"><ImagePlus size={16} /> {logo ? 'Change logo' : 'Add logo'}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogo} className="hidden" /></label>
          </div>
          {logo && <button type="button" onClick={() => setLogo(null)} className="text-xs text-white/40 underline decoration-white/20 underline-offset-4 hover:text-white">Remove logo</button>}
          <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void downloadPng()} disabled={!value || isDownloading} className={buttonClass}><Download size={16} /> Download PNG</button><button type="button" onClick={() => void downloadSvg()} disabled={!value || isDownloading} className={buttonClass}><Download size={16} /> Download SVG</button></div>
        </div>
        <div className="flex min-h-[280px] items-center justify-center border border-white/[0.08] bg-black/10 p-5"><div className="bg-white p-3 shadow-2xl"><img className="h-56 w-56 object-contain" alt="Generated QR code" src={qrUrl} /></div></div>
      </div>
      <p className="mt-5 text-xs text-white/35">QR image generation uses the QRServer public endpoint. Higher error correction is recommended when using a logo.</p>
    </ToolCard>
  );
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}
