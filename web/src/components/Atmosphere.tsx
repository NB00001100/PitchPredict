/**
 * The night behind every page: a green-black to navy-black gradient, two
 * floodlight pools that breathe very slowly, a vignette and a faint film
 * grain. Fixed, painted once, never intercepts the pointer.
 */
export function Atmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--color-navy-900)_0%,var(--color-black)_45%,var(--color-night-900)_100%)]" />
      {/* Floodlight pools, top left and top right. */}
      <div className="animate-breathe absolute -top-[30vh] -left-[20vw] h-[90vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgb(150_200_255/0.13),transparent)]" />
      <div className="animate-breathe absolute -top-[30vh] -right-[20vw] h-[90vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgb(150_255_200/0.10),transparent)] [animation-delay:-3.5s]" />
      {/* Pitch-level glow along the bottom. */}
      <div className="absolute inset-x-0 -bottom-[40vh] h-[70vh] bg-[radial-gradient(50%_50%_at_50%_50%,rgb(60_240_140/0.07),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,transparent_55%,rgb(0_0_0/0.55))]" />
      <div className="grain absolute inset-0 opacity-[0.045]" />
    </div>
  )
}
