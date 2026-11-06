// Decorative animated backdrop (hidden from screen readers)
export default function Background() {
  return (
    <div aria-hidden="true" className="scene">
      <span className="orb orb-a" />
      <span className="orb orb-b" />
      <span className="orb orb-c" />
      <span className="dots" />
    </div>
  );
}