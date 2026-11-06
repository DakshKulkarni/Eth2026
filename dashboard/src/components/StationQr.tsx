import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

// A QR code for the worker check-in page, always black on white so any phone camera reads it.
export function StationQr({ url, size = 188 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: '#0b0b0b', light: '#ffffff' }, errorCorrectionLevel: 'M' })
      .then((d) => live && setSrc(d))
      .catch(() => live && setSrc(''));
    return () => {
      live = false;
    };
  }, [url, size]);
  return src ? (
    <img src={src} width={size} height={size} alt={`QR code for ${url}`} className="block bg-white p-1.5" style={{ borderRadius: 12, imageRendering: 'pixelated' }} />
  ) : (
    <span className="skeleton block" style={{ width: size, height: size }} />
  );
}
