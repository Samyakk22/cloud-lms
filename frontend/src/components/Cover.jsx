// Every course gets a stable cover generated from its title, so the catalog has identity without image uploads.
const PALETTE = [
  { bg: '#2D3FE0', fg: '#FFD23F' },
  { bg: '#FF6B4A', fg: '#141B34' },
  { bg: '#0E9F8E', fg: '#F6F7FB' },
  { bg: '#7A3FD1', fg: '#FFD23F' },
  { bg: '#FFD23F', fg: '#141B34' },
  { bg: '#141B34', fg: '#FFD23F' },
];

function hash(text) {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function Shapes({ kind }) {
  if (kind === 0) {
    return [90, 62, 34].map((r) => <circle key={r} cx="160" cy="95" r={r} fill="none" stroke="currentColor" strokeWidth="6" opacity="0.5" />);
  }
  if (kind === 1) {
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
      <line key={i} x1={80 + i * 28} y1="-5" x2={i * 28} y2="125" stroke="currentColor" strokeWidth="8" opacity="0.4" />
    ));
  }
  const dots = [];
  for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) dots.push(<circle key={`${x}${y}`} cx={95 + x * 20} cy={22 + y * 26} r="5" fill="currentColor" opacity="0.55" />);
  return dots;
}

export default function Cover({ title, large = false }) {
  const h = hash(title);
  const { bg, fg } = PALETTE[h % PALETTE.length];
  return (
    <div className={`cover${large ? ' cover-large' : ''}`} style={{ background: bg, color: fg }} aria-hidden="true">
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMaxYMid slice">
        <Shapes kind={h % 3} />
      </svg>
      <span className="cover-letter">{title.trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}
