import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Palette } from 'lucide-react';
import { ToolCard, ToolTitle } from '@/features/developer-tools/components/ToolShell';

export default function ColorPickerTool() {
  const [color, setColor] = useState('#D97757');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');

  const pickFromScreen = async () => {
    setError('');
    if (/Windows/i.test(navigator.userAgent)) {
      setPicking(true);
      try { setColor(await invoke<string>('pick_screen_color')); }
      catch (value) {
        const message = value instanceof Error ? value.message : String(value);
        if (!message.toLowerCase().includes('cancel')) setError(message);
      } finally { setPicking(false); }
      return;
    }
    const eyeDropper = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!eyeDropper) { setError('Global screen picking is currently available on Windows only.'); return; }
    try { setColor((await new eyeDropper().open()).sRGBHex); } catch { /* picker cancelled */ }
  };

  return <ToolCard><ToolTitle icon={Palette} text="Color Picker" subtitle="Pick a color from any Windows window, Chrome tab, or the desktop." /><div className="mt-6 flex min-h-72 flex-wrap items-center gap-8 border border-white/[0.06] bg-black/10 p-8"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-28 w-28 cursor-pointer border-0 bg-transparent" /><div><p className="font-mono text-4xl text-white">{color}</p><button type="button" disabled={picking} onClick={() => void pickFromScreen()} className="mt-4 inline-flex items-center gap-2 border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-50"><Palette size={15} /> {picking ? 'Select a pixel...' : 'Pick from screen'}</button><p className="mt-3 text-xs text-white/35">Windows mode hides Yolnoma temporarily. Click any visible pixel, or press Esc to cancel.</p>{error && <p className="mt-3 max-w-md border-l-2 border-red-400/70 pl-3 text-xs text-red-300">{error}</p>}</div></div></ToolCard>;
}
