import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { ToolCard, ToolTitle } from './ToolShell';

export default function QrGeneratorTool() {
  const [value, setValue] = useState('https://www.yolnoma.uz');
  return <ToolCard><ToolTitle icon={QrCode} text="QR Code Generator" subtitle="Generate a QR code from text or a URL." /><div className="mt-6 flex flex-col gap-6 border border-white/[0.06] bg-black/10 p-6 md:flex-row md:items-start"><textarea value={value} onChange={(event) => setValue(event.target.value)} className="min-h-32 flex-1 resize-y border border-white/10 bg-black/20 p-4 text-sm text-white/80 outline-none focus:border-[var(--accent)]" placeholder="Text or URL..." />{value && <img className="h-48 w-48 border-8 border-white bg-white object-contain" alt="Generated QR code" src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(value)}`} />}</div><p className="mt-4 text-xs text-white/35">QR image generation uses the QRServer public endpoint.</p></ToolCard>;
}
