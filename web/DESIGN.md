# PitchPredict design system

**Concept: floodlit matchday at night, with the precision of a data instrument.**
Dark and cinematic (deep green-black and navy-black, floodlight glows, film
grain, pitch markings as line art), with every number set plainly and
legibly. The atmosphere sits behind the content. Data is never decorated.

Everything lives in `src/index.css` (tokens and utilities), `src/lib/motion.ts`
(motion constants) and `src/components/` (primitives).

## Tokens (`@theme` in `src/index.css`)

Names that existed before the revamp still work. Only their values changed.

| Token | Value | Use |
|---|---|---|
| `black` | `#04090a` | page base (`bg-black`) |
| `white` | `#f3f7f5` | primary text (18.5:1) |
| `grey-200` / `400` / `500` | cool-green greys | strong secondary (13.6:1), secondary (8.2:1), smallest muted text (6.1:1; 5.6:1 on `grey-900`, 5.1:1 on `grey-800`) |
| `grey-700` / `800` / `900` | | rules, raised surface, surface (non-text) |
| `night-950`, `night-900`, `navy-900` | | atmosphere gradients only |
| `pitch` | `#3cf08c` | **the one accent**: focus, glow, "hit", live, primary action (13.4:1; black text on a pitch fill is also 13.4:1) |
| `pitch-bright`, `pitch-deep`, `pitch-dim` | | highlight inside glows, fills under white text, washes behind text |
| `miss`, `miss-dim` | `#ff6b70` | misses and errors only (7.2:1). Always with an icon or word. |
| `home`, `draw`, `away` | `#3c9ae8`, `#5f6b74`, `#d27a12` | **mark colours** for probability data (bars, dots, swatches). Validated (dark surface, CVD ΔE 26). Never use them for text. |
| `glass`, `glass-strong`, `hairline`, `hairline-strong` | translucent | glass fills and 1px borders |
| `shadow-glow`, `shadow-lift` | | accent rim + glow, deep lift |
| `ease-out-soft` (UI), `ease-out-expo` (entrances), `ease-in-out-quart` (wipes, draws) | | CSS easings |

Fonts (self-hosted via @fontsource, Latin subsets preloaded in `main.tsx`):

- `font-display`: **Archivo Variable at 72% width** (condensed). Headlines.
- `font-wide`: **Archivo Variable at 125% width** (extended). Small broadcast labels, buttons, nav, tags.
- `font-sans`: **Geist Variable**. Body text.
- `font-mono`: **Geist Mono Variable**. Data labels, ticks, tabular figures.
- `font-script` is a legacy alias of `font-display`. Don't use it in new code.

Archivo's width axis is set through `font-variation-settings` (the token sets it), so `font-stretch-*` utilities have no effect on it. To change the width, use `[font-variation-settings:'wdth'_80]`.

## Type scale (utilities)

| Utility | Face | Size | Use |
|---|---|---|---|
| `type-mega` | display 64% wdth, 850, UPPER | `clamp(3.4rem, 7.6vw, 8.5rem)` | the landing h1 only |
| `type-display` | display 66%, 800, UPPER | `clamp(2.9rem, 7vw, 6.5rem)` | page h1s |
| `type-headline` | display 68%, 800, UPPER | `clamp(2.3rem, 4.8vw, 4.4rem)` | section h2s |
| `type-title` | display 85%, 700 | `clamp(1.5rem, 2.2vw, 2rem)` | card titles, h3 |
| `type-stat` | display 80%, 750 | `clamp(3rem, 5.6vw, 5rem)` | big figures (proportional digits) |
| `type-eyebrow` | wide 125%, 600, UPPER, 0.2em tracking | 0.72rem | the line above a heading |
| `type-label` | mono, UPPER, tabular | 0.75rem | data labels, axis ticks, meta |
| `type-lede` | sans, grey-200 | `clamp(1.075rem, 1.35vw, 1.3rem)`, 1.55 leading | intro paragraphs |
| `text-glow` | | | pitch-green text with a soft glow. One phrase per view. |

Body copy is Tailwind's `text-sm` / `text-base` in `font-sans`, `text-grey-200`, `leading-relaxed`.
Use `tabular-nums` only where numbers line up in columns. Big standalone figures stay proportional.

## Surfaces and layout utilities

- `page-col`: centred column, max 76rem, 16px gutters on phones. `<main>` is already one.
- `bleed`: breaks a block out of `page-col` to the full viewport width.
- `glass`: translucent fill, hairline border, inner top highlight, 14px backdrop blur.
- `grain`: static film-grain texture (put it on an absolute layer at about 4–5% opacity).
- `skeleton`: placeholder block with a shimmer. Give it the final content's size.
- `magnetic`: the transition recipe that pairs with `useMagnetic()`.

## Motion rules

- **Animate `transform` and `opacity` only.** The single exception: SVG pitch lines draw in once on load (`pathLength`).
- Durations (`DURATION` in `lib/motion.ts`): `fast` 0.18s (hover, press), `base` 0.6s (reveals, route fade), `slow` 1.1s (hero), `draw` 1.8s (line art). Stagger 0.07s.
- Easing: `EASE_OUT_EXPO` for anything entering, `EASE_OUT_SOFT` for UI feedback, `EASE_IN_OUT_QUART` for draws and wipes. Pointer-driven motion uses `POINTER_SPRING`.
- Entrances run once (`viewport={{ once: true }}`). Content is never hidden behind an animation that needs a click, and nothing blocks input.
- Hover effects are for fine pointers only. Every hover reveal also happens on `:focus-visible`, and on touch screens the revealed content is visible from the start.
- **Reduced motion:** `MotionConfig reducedMotion="user"` wraps the app. Every primitive also checks `usePrefersReducedMotion()` and renders its final state (`initial={false}`). The global CSS rule cuts CSS animations and transitions. The ticker becomes a static, scrollable list.
- **What never animates:** data values after they have settled, the layout of data (no reflowing tables), text colour for meaning, and anything users have to read while it moves (the ticker pauses on hover and focus).
- Route changes: the page fades up 18px (`PageLayout`). The first page of a visit skips this.
- **Bundle rule:** `PageLayout` wraps the app in `<LazyMotion features={…}>`, and the animation features (`domMax`) load asynchronously. In new code, import components as `import * as m from 'motion/react-m'` and write `<m.div>`. `motion.div` still works, but it pulls the full feature set into that chunk. Hooks such as `useScroll`, `useTransform`, `useSpring`, `useInView` and `animate` come from `motion/react` as usual.

## Primitives (`src/components/`)

| Component | Props | Notes |
|---|---|---|
| `Panel` | `as?` (`div` `section` `article` `li` `aside` `figure`), `tone?` (`glass` \| `solid` \| `accent`), plus that element's props | The card surface. Isolates stacking, so `<PointerLight />` inside it paints behind the content. Use `solid` for dense tables, where blur would hurt legibility. |
| `PointerLight` | `size?` (px, default 420), `color?`, `className?` | A soft light that follows the pointer across its parent. Moves by transform only. Off on touch and under reduced motion. |
| `SectionHeading` | `eyebrow?`, `title`, `lede?`, `as?` (`h1` \| `h2` \| `h3`), `size?` (`headline` \| `display`), `align?` (`start` \| `center`), `id?`, `aside?` | Eyebrow, title and lede, revealed in sequence. Point the section's `aria-labelledby` at `id`. |
| `Reveal` / `RevealItem` | `as?`, `delay?`, `stagger?`, `amount?`, `className?` | Fades content up the first time it scrolls into view. `<Reveal stagger>` makes its `RevealItem` children enter one after another. |
| `CountUp` | `value`, `decimals?`, `prefix?`, `suffix?`, `duration?`, `delay?` | Counts up when it enters view. The final value is in the accessibility tree, and width is reserved so nothing shifts. |
| `StatCard` / `StatCardSkeleton` | `label`, `value`, `caption`, `children?` (mini graphic) | A big figure on glass. |
| `Button` / `ButtonLink` / `ButtonAnchor` | native `button` / router `Link` / `a` props, plus `variant?` (`primary` \| `secondary` \| `ghost`), `size?` (`md` \| `lg`), `icon?` (trailing, nudges on hover) | Magnetic pull on fine pointers, presses down on click, light sheen on hover. One `primary` per view. `buttonClasses()` in `buttonStyles.ts` gives the same look to any element. |
| `Tag` | `children`, `tone?` (`neutral` \| `accent` \| `live` \| `hit` \| `miss`), `icon?` (`null` hides it), `className?` | Pill label. `hit` and `miss` carry a check or cross icon, so meaning never rests on colour alone. `live` has a pulsing dot. |
| `ProbabilityBar` | `forecast` ({H, D, A} shares), `homeName`, `awayName`, `size?` (`sm` \| `md`), `labels?` | Home, draw and away in one bar, home on the left. Widths are exact; labels are whole percentages that sum to 100. Screen readers get a single summary sentence. |
| `PredictedActual` + `PredictedZone` + `ActualZone` | zones take `label?`, `when?` (`false` hides it); `ActualZone` takes `verdict?` (`hit` \| `miss`) | **Pattern: what was predicted and what happened are always two separate, labelled zones.** See below. |
| `TeamMonogram` | `tla`, `name?`, `size?` (`sm` \| `md` \| `lg`) | Glass disc with the 3-letter code in the wide face. No crests. |
| `StatusMessage` | `children`, `action?`, `tone?` (`neutral` \| `error`) | Announced loading, empty and error message. |
| `TextLink` | router `Link` props | Inline link with an underline that turns pitch green on hover. |
| `BarComparison` | `title`, `better` (`higher` \| `lower`), `rows` ({name, detail?, value, emphasis?}[]), `max`, `ticks`, `format`, `tickFormat?`, `valueLabel`, `note?` | Horizontal bars from a zero baseline. The emphasised row is pitch green and the rest are grey; values sit at the bar tips. The better direction is shown as an arrow and text badge, and the best row gets a "Best" tag. Bars grow in on view. Comes with an sr-only value list and a "View as table" disclosure. Put it in a `Panel tone="solid"`. |
| `CompetitionTile` | `to`, `name`, `logo`, `status`, `detail`, `action`, `tone?` (`active` \| `upcoming`) | Landing-page competition chooser. Tilts on hover. |
| `PitchLines` | `delay?`, `stripes?`, `strokeWidth?`, `className?` | Full pitch as line art (10 units per metre). Lines draw themselves in. Colour comes from `currentColor`. |
| `Atmosphere` | none | The fixed night backdrop behind every page (rendered by `PageLayout`). |
| `Icons` | `ArrowRightIcon`, `ArrowUpRightIcon`, `CheckIcon`, `CrossIcon`, `MenuIcon` | 16px line icons in `currentColor`, aria-hidden. |

Hooks: `useMagnetic(ref, strength?, max?)` (add the `magnetic` class to the element) and `usePrefersReducedMotion()`.

### Pattern: Predicted vs Actual

Whenever a forecast is shown next to a result:

```tsx
<PredictedActual>
  <PredictedZone>Arsenal to win <span className="font-mono">54%</span></PredictedZone>
  <ActualZone verdict="hit">Arsenal win <span className="font-mono">2–1</span></ActualZone>
</PredictedActual>
```

- **Predicted** is translucent glass, labelled "PREDICTED · BEFORE KICK-OFF". It was a probability, not a fact.
- **Actual** is a solid surface with a coloured left rim, labelled "ACTUAL · FULL TIME". It carries the verdict `Tag` (a check and "Right", or a cross and "Wrong").
- An arrow sits between the zones on wider screens. On phones they stack.
- Never merge the two into one sentence or one surface. Never show the verdict by colour alone. Before kick-off, leave out `verdict` and put "To be played" in the Actual zone.

### Data colour rules

- Home, draw and away use the `home`, `draw` and `away` mark colours. Position backs them up (home left, away right), and so do H/D/A labels.
- Text stays in `white` and the greys, never in a data colour.
- Green means hit, live or the accent. Red means miss or error. Neither is ever used as a series colour.
- Charts emphasise one series (the model in `pitch`) and keep the others neutral, start bars at a zero baseline, label values at the bar tips, and come with a table view.

## Accessibility checklist

Landmarks (header, nav, main, footer), one h1 per page, a skip link, a visible pitch-green focus ring on everything, AA contrast (figures above), and a reduced-motion path. No information is carried by colour alone. Decorative art is `aria-hidden`. Skeletons and reserved widths prevent layout shift. Pages work at 360px wide without horizontal scroll.
