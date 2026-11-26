export default function Skeletons({ count = 3 }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading courses">
      {Array.from({ length: count }, (_, i) => <div key={i} className="tile skeleton" />)}
    </div>
  );
}
