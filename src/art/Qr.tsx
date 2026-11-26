import { encode } from 'uqr';

/** A square code for a phone's camera, drawn here on the device: nothing is asked of any service to make it. */
export function Qr({ text, label, size = 180 }: { text: string; label: string; size?: number }) {
  const { size: cells, data } = encode(text, { ecc: 'M', border: 2 });
  const path: string[] = [];
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return (
    <svg
      viewBox={`0 0 ${cells} ${cells}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      style={{ borderRadius: 10, display: 'block' }}
    >
      <rect width={cells} height={cells} fill="#fff" />
      <path d={path.join('')} fill="#3a2e4d" />
    </svg>
  );
}
