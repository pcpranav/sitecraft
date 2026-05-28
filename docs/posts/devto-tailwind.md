---
title: I gave up on making my AI builder write good media queries
published: false
description: Two weeks of prompt tuning to fix desktop output didn't work. Switching the generation to Tailwind via CDN did.
tags: ai, llm, webdev, tailwindcss
canonical_url:
---

Every site my AI website builder produced looked great on a phone and weak on a desktop. The hero stretched edge-to-edge in a single anemic column. Features grids stayed at one column on a 27" monitor. Section padding that felt generous on mobile felt empty at desktop widths.

I spent two weeks trying to fix this from the prompt side. None of it worked the way I wanted. Then I gave up on the approach entirely and switched the generation to **Tailwind via CDN**. The desktop problem disappeared.

This is the writeup of why the original approach was wrong, what I tried first, and the specific change that mattered.

## The symptom

The system prompt told the model to write mobile-first CSS:

> Default CSS targets mobile (≤480px); layer up with `@media (min-width: 768px)` and `(min-width: 1024px)`.

Models followed the instruction. They wrote good mobile rules. Then they wrote thin, half-hearted desktop overrides — a max-width here, a media query for two-column layout there. Critical things were missing: bounded container widths, real multi-column grids, typography that genuinely scaled up, deliberate section padding rhythm. Desktop wasn't broken — it was *underdesigned*. The mobile rules absorbed most of the model's attention budget.

This wasn't a one-model problem. I [tested four](https://dev.to/pcpranav/i-tested-4-free-70b-class-llm-endpoints-for-real-production-work-heres-what-each-is-actually-1if9) (Cerebras GPT-OSS 120B, Groq Llama 4 Scout, Cloudflare Qwen3 30B, OpenRouter free auto-router). All four showed the same pattern. The strongest model produced the most polished mobile experience and still had thin desktop.

## What I tried first

**Round 1: explicit desktop rules in the prompt.**

```
Desktop must be a designed experience, not a stretched mobile view:
- Every major section uses a bounded container (max-width 1100–1280px).
- Multi-column grids on desktop (3-col features, not 1-col).
- Typography scales up: hero ≥ clamp(2rem, 6vw, 5rem), body 16–18px.
- Section padding visibly larger on desktop.
- Real horizontal nav on desktop (no permanent hamburger).
```

Helped, maybe 20% better. Not enough. Models still hand-wrote breakpoints one at a time, often forgot the container, often kept padding mobile-sized.

**Round 2: an anti-patterns list.**

```
- Desktop that looks like a stretched mobile view.
- Hero full-width on a 1440px screen with content centered in a phone column.
- Single-column features grid on desktop.
```

Marginal again. The fundamental problem was that the model had to re-invent responsive CSS from scratch on every generation. With finite tokens of attention, it allocated effort to whatever was first and most reinforced — which was mobile.

## The realization

Asking an LLM to hand-write mobile-first responsive CSS is a bad task to ask an LLM. It's brittle, repetitive, and the model has to make the same dozen decisions every time.

But LLMs are *great* at Tailwind. They've seen millions of `class="grid grid-cols-1 md:grid-cols-3"` examples in their training data. The responsive prefix system is mobile-first *by definition* — every `md:` and `lg:` utility is a desktop affordance the model adds deliberately, one piece at a time, because the syntax forces it.

I switched the generation system to require [Tailwind via CDN](https://wiz-craft.vercel.app/). The desktop problem solved itself.

## The change — three pieces

**1. Mandate the CDN script and inline config in `<head>`:**

```html
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          brand: '#3b82f6',
          accent: '#f43f5e',
          surface: '#0a0a14',
        },
        fontFamily: {
          display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
          body: ['Inter', 'system-ui', 'sans-serif'],
        },
      }
    }
  }
</script>
<script src="https://cdn.tailwindcss.com"></script>
```

Order matters — the config has to be parsed before the CDN script initializes, otherwise custom colors silently fail.

**2. Make desktop equally first-class in the prompt:**

```
## RESPONSIVE — MOBILE-FIRST, DESKTOP EQUALLY FIRST-CLASS
Tailwind is mobile-first by default. Responsive prefixes (sm: md: lg:) are
how desktop gets designed deliberately — not as an afterthought.

- Container: <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
- Multi-column grids: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
- Hero: lg:grid-cols-2 (split) or lg:grid-cols-5 (asymmetric)
- Type: text-3xl sm:text-5xl lg:text-7xl for headlines
- Padding: py-12 sm:py-20 lg:py-28 for section spacing
- Nav: hidden md:flex on the menu, md:hidden on the hamburger
```

Notice every rule has an `md:` or `lg:` prefix. The prompt isn't asking the model to invent breakpoint logic — it's asking the model to *append responsive prefixes to utilities it already knows*. That's a much smaller task. And smaller tasks for LLMs produce dramatically more consistent output.

**3. A final-check block at the end of the prompt:**

```
## FINAL CHECK
Before emitting your response, verify that <head> contains BOTH:
  1. <script>tailwind.config = { ... }</script>
  2. <script src="https://cdn.tailwindcss.com"></script>
If either is missing, every Tailwind class in your output renders nothing.
```

This last one matters. Without it, my first round of Tailwind output had models that wrote Tailwind classes but skipped the CDN script. The page rendered as raw unstyled HTML — every class a silent no-op. The final-check section dropped that failure mode close to zero.

## The result

Desktop output went from a recurring complaint to a non-issue. Single-page sites now have:

- Bounded content widths instead of edge-to-edge sprawl
- Three-column features grids on desktop, single-column on mobile, two-column on tablet — automatic
- Hero layouts that use the horizontal space (split, asymmetric, full-bleed) instead of a centered phone column
- Typography that actually scales up
- Real horizontal navigation on desktop with the hamburger reserved for mobile

None of this is the model "trying harder." It's the model being asked to do something it's good at instead of something it's mediocre at.

## The generalization

When an LLM is producing mediocre output on a task, the first instinct is to fix the prompt. Add more rules. Add examples. Add anti-patterns. Each helps marginally.

The higher-leverage move is to ask whether the *task* is wrong. Is there a primitive the model is **already great at** that maps to your problem?

- Tailwind utility classes are that primitive for responsive web design.
- Markdown is that primitive for structured prose.
- JSON Schema is that primitive for structured data extraction.
- React/JSX is that primitive for component output.

If the answer is yes, the rewrite tends to be smaller than the prompt-tuning rabbit hole you were heading down, and the quality ceiling is much higher.

I lost two weeks before making this switch. The prompt-side fixes felt productive — each one moved the needle a little. The structural fix took a few hours and moved it more than all the prompt fixes combined.

---

*Try it live: [wiz-craft.vercel.app](https://wiz-craft.vercel.app/) — open source on [GitHub](https://github.com/pcpranav/sitecraft). Four free open-source models, generates Tailwind-styled single-page sites from a prompt, streams the iframe live as the model writes. Built with Claude.*

*More on the four providers I'm using: [I tested 4 free 70B-class LLM endpoints for real production work](https://dev.to/pcpranav/i-tested-4-free-70b-class-llm-endpoints-for-real-production-work-heres-what-each-is-actually-1if9).*
