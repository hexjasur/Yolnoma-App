import { useMemo, useState, type ChangeEvent } from 'react';
import { Download, ImagePlus, QrCode } from 'lucide-react';
import { BaseDirectory } from '@tauri-apps/api/path';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from '@/shared/ui/Toast';
import { ToolCard, ToolTitle } from './ToolShell';

const buttonClass = 'inline-flex items-center justify-center gap-2 border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[var(--accent)] hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40';

function toHex(value: string) {
  return value.replace('#', '').toUpperCase();
}

async function saveToDownloads(data: Uint8Array, filename: string, mimeType: string) {
  try {
    await writeFile(filename, data, { baseDir: BaseDirectory.Download });
    toast.success(`${filename} Downloads papkasiga yuklandi.`);
  } catch {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${filename} browser Downloads papkasiga yuklandi.`);
  }
}

export default function QrGeneratorTool() {
  const [value, setValue] = useState('https://www.yolnoma.uz');
  const [foreground, setForeground] = useState('#111111');
  const [errorCorrection, setErrorCorrection] = useState('M');
  const [logo, setLogo] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const qrUrl = useMemo(() => {
    const params = new URLSearchParams({
      size: '600x600',
      format: 'png',
      color: toHex(foreground),
      bgcolor: 'FFFFFF',
      ecc: errorCorrection,
      qzone: '4',
      data: value,
    });
    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
  }, [errorCorrection, foreground, value]);

  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogo(reader.result);
        toast.success('Logo added to the QR preview.');
      } else toast.error('Could not read this logo file.');
    };
    reader.onerror = () => toast.error('Could not read this logo file.');
    reader.readAsDataURL(file);
  };

  const preparePng = async () => {
    if (!value || isPreparing) return;
    setIsPreparing(true);
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error('QR image request failed');
      let pngData: Uint8Array;
      if (!logo) {
        pngData = new Uint8Array(await response.arrayBuffer());
      } else {
        const [qrImage, logoImage] = await Promise.all([createImageBitmap(await response.blob()), loadImage(logo)]);
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is not available');
        context.drawImage(qrImage, 0, 0, 600, 600);
        const logoSize = 120;
        const logoX = (600 - logoSize) / 2;
        context.fillStyle = '#FFFFFF';
        context.fillRect(logoX - 12, logoX - 12, logoSize + 24, logoSize + 24);
        context.drawImage(logoImage, logoX, logoX, logoSize, logoSize);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG conversion failed')), 'image/png'));
        pngData = new Uint8Array(await blob.arrayBuffer());
      }
      await saveToDownloads(pngData, 'yolnoma-qr.png', 'image/png');
    } catch {
      toast.error('PNG yuklab bo‘lmadi. Internet yoki logo faylini tekshirib qayta urinib ko‘ring.');
    } finally {
      setIsPreparing(false);
    }
  };

  const prepareSvg = async () => {
    if (!value || isPreparing) return;
    setIsPreparing(true);
    try {
      const params = new URLSearchParams({ size: '600x600', format: 'svg', color: toHex(foreground), bgcolor: 'FFFFFF', ecc: errorCorrection, qzone: '4', data: value });
      const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`);
      if (!response.ok) throw new Error('QR SVG request failed');
      let svg = await response.text();
      if (logo && svg.includes('</svg>')) {
        svg = svg.replace('</svg>', `<rect x="230" y="230" width="140" height="140" rx="12" fill="#FFFFFF"/><image href="${logo}" x="250" y="250" width="100" height="100" preserveAspectRatio="xMidYMid meet"/></svg>`);
      }
      await saveToDownloads(new TextEncoder().encode(svg), 'yolnoma-qr.svg', 'image/svg+xml');
    } catch {
      toast.error('SVG yuklab bo‘lmadi. Internet yoki logo faylini tekshirib qayta urinib ko‘ring.');
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <ToolCard>
      <ToolTitle icon={QrCode} text="QR Code Generator" subtitle="Customize QR color, add a logo, choose error correction, and save directly to Downloads." />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <textarea value={value} onChange={(event) => setValue(event.target.value)} className="min-h-36 w-full resize-y border border-white/10 bg-black/20 p-4 text-sm text-white/80 outline-none focus:border-[var(--accent)]" placeholder="Text or URL..." />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 border border-white/[0.08] bg-black/10 p-3 text-sm text-white/70">QR color<input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} className="h-9 w-14 cursor-pointer border-0 bg-transparent" /></label>
            <label className="flex items-center justify-between gap-3 border border-white/[0.08] bg-black/10 p-3 text-sm text-white/70">Error correction<select value={errorCorrection} onChange={(event) => setErrorCorrection(event.target.value)} className="border border-white/10 bg-[#171711] px-3 py-2 text-white outline-none focus:border-[var(--accent)]"><option value="L">L · 7%</option><option value="M">M · 15%</option><option value="Q">Q · 25%</option><option value="H">H · 30%</option></select></label>
            <label className="flex cursor-pointer items-center justify-between gap-3 border border-white/[0.08] bg-black/10 p-3 text-sm text-white/70"><span className="inline-flex items-center gap-2"><ImagePlus size={16} /> {logo ? 'Change logo' : 'Add logo'}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogo} className="hidden" /></label>
          </div>
          {logo && <button type="button" onClick={() => { setLogo(null); toast.success('Logo removed.'); }} className="text-xs text-white/40 underline decoration-white/20 underline-offset-4 hover:text-white">Remove logo</button>}
          <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void preparePng()} disabled={!value || isPreparing} className={buttonClass}><Download size={16} /> {isPreparing ? 'Saving...' : 'Download PNG'}</button><button type="button" onClick={() => void prepareSvg()} disabled={!value || isPreparing} className={buttonClass}><Download size={16} /> {isPreparing ? 'Saving...' : 'Download SVG'}</button></div>
          <p className="text-xs text-white/35">QR background is fixed to white for reliable camera scanning. Files are saved to Downloads.</p>
        </div>
        <div className="flex min-h-[280px] items-center justify-center border border-white/[0.08] bg-black/10 p-5"><div className="relative bg-white p-3 shadow-2xl"><img className="h-56 w-56 object-contain" alt="Generated QR code" src={qrUrl} />{logo && <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-white p-1.5 shadow-md"><img src={logo} alt="QR logo" className="h-full w-full rounded object-contain" /></div>}</div></div>
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
