import {
  colors,
  iridescentColors,
  radii,
  semanticColors,
  typography,
} from "@/lib/tokens";

const swatches = [
  { name: "primary", token: "--color-ia-primary", value: colors.primary },
  {
    name: "foreground",
    token: "--color-ia-foreground",
    value: colors.foreground,
  },
  { name: "surface", token: "--color-ia-surface", value: colors.surface },
] as const;

export default function StyleguidePage() {
  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto bg-white px-8 py-12">
      <h1 className="text-3xl font-bold text-ia-foreground">Styleguide</h1>
      <p className="mt-2 text-ia-muted">
        Tokens oficiais do bank.ai (herdados da experiência iarticles). Use
        sempre estes valores ao criar novos componentes.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-ia-foreground">Cores</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {swatches.map((swatch) => (
            <div
              key={swatch.name}
              className="overflow-hidden rounded-2xl border border-ia-border bg-white"
            >
              <div className="h-24" style={{ backgroundColor: swatch.value }} />
              <div className="p-4 text-sm">
                <p className="font-semibold capitalize text-ia-foreground">
                  {swatch.name}
                </p>
                <p className="text-ia-muted">{swatch.value}</p>
                <p className="font-mono text-xs text-ia-muted">{swatch.token}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-ia-border bg-white p-4 text-sm text-ia-muted">
          <p>canvas: {semanticColors.canvas}</p>
          <p>panel: {semanticColors.panel}</p>
          <p>muted: {semanticColors.muted}</p>
          <p>border: {semanticColors.border}</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-ia-foreground">Iridescente</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {Object.entries(iridescentColors).map(([name, value]) => (
            <div
              key={name}
              className="overflow-hidden rounded-2xl border border-ia-border bg-white"
            >
              <div className="h-16" style={{ backgroundColor: value }} />
              <div className="p-3 text-sm">
                <p className="font-semibold capitalize text-ia-foreground">
                  {name}
                </p>
                <p className="text-ia-muted">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-ia-foreground">Tipografia</h2>
        <p className="mt-2 text-sm text-ia-muted">Família: Nunito</p>
        <div className="mt-4 space-y-3 rounded-2xl border border-ia-border bg-white p-6">
          <p
            className="text-ia-foreground"
            style={{
              fontSize: typography.sizes["3xl"],
              fontWeight: typography.weights.bold,
            }}
          >
            Heading 3xl / Bold
          </p>
          <p
            className="text-ia-foreground"
            style={{
              fontSize: typography.sizes["2xl"],
              fontWeight: typography.weights.bold,
            }}
          >
            Heading 2xl / Bold
          </p>
          <p
            className="text-ia-foreground"
            style={{
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.medium,
            }}
          >
            Body base / Medium
          </p>
          <p
            className="text-ia-muted"
            style={{
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
            }}
          >
            Caption sm / Semibold
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-ia-foreground">Raios</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {Object.entries(radii).map(([name, value]) => (
            <div key={name} className="text-center text-sm">
              <div
                className="mb-2 size-16 bg-ia-surface"
                style={{ borderRadius: value }}
              />
              <p className="font-medium text-ia-foreground">{name}</p>
              <p className="text-ia-muted">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
