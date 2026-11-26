export default function Stats({ items }) {
  return (
    <div className="stats">
      {items.map((item) => (
        <div key={item.label} className="stat">
          <strong>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
