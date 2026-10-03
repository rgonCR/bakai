export function GradientSpinner() {
  return (
    // SVG estático em /public — a rotação é só via CSS no elemento inteiro
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/spinner.svg"
      width={16}
      height={16}
      alt=""
      aria-hidden
      className="ia-spinner size-4 shrink-0"
    />
  );
}
