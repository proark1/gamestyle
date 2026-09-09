export const metadata = {
  title: 'Brick by Hand materials & credits — Jumbleyard',
};
export default function Credits() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '60px auto',
        padding: 24,
        lineHeight: 1.8,
      }}
    >
      <a href="/first-person">← Back to the site</a>
      <h1 style={{ fontSize: 38 }}>Materials &amp; credits</h1>
      <p>
        The 3D building site, tools and characters use custom geometry. The
        following material textures are from Poly Haven and used under CC0:
      </p>
      <ul>
        <li>
          <a href="https://polyhaven.com/a/red_brick">Red Brick — Rob Tuytel</a>
        </li>
        <li>
          <a href="https://polyhaven.com/a/dirt">Dirt — Charlotte Baglioni</a>
        </li>
        <li>
          <a href="https://polyhaven.com/a/rough_wood">
            Rough Wood — Rob Tuytel
          </a>
        </li>
      </ul>
      <p>
        <a href="https://polyhaven.com/license">Poly Haven license (CC0)</a> ·
        Rendered with Three.js.
      </p>
      <p>
        Brick by Hand is a playable prototype. Its building rules are simplified
        and are not structural calculations for real buildings.
      </p>
    </main>
  );
}
