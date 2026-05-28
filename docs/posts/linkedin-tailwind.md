# LinkedIn condensation — Tailwind switch

Paste-ready post for LinkedIn. ~1400 chars. Designed for the LinkedIn
truncation point: the first two lines do the hook before "see more"
collapses the rest.

Before posting:
1. Replace `[DEV_TO_URL]` with the published dev.to post URL.
2. Post early in the morning on a weekday (Tue/Wed/Thu).
3. Don't edit in the first hour — LinkedIn's algorithm penalizes edits.
4. Reply to comments within 2 hours for the algorithm boost.

---

Every site my AI website builder produced looked great on a phone and weak on a desktop. I spent two weeks fixing this from the prompt side. It barely moved.

Then I gave up and switched the generation system to Tailwind CSS via CDN. The desktop problem disappeared.

Three things I learned:

→ When an LLM is mediocre at a task, change the task. Asking models to hand-write mobile-first responsive CSS every generation is a bad ask. Asking them to append md:/lg: Tailwind utility classes is a great one — they've seen millions of those.

→ Mobile-first prompts produce thin desktop output. Models put their attention budget where the rules concentrate. With Tailwind, every responsive prefix is a deliberate desktop affordance the syntax forces them to add.

→ Add a "final check" block to your prompt. My first round of Tailwind output had models writing utility classes but skipping the CDN script tag — every class a silent no-op. A literal "verify these two scripts are in <head>" reminder at the end of the prompt fixed it.

Full writeup with the prompt diff and code: [DEV_TO_URL]

Background — my earlier post on the four free LLM endpoints this runs on: https://www.linkedin.com/feed/update/urn:li:activity:7460948244672585728/

Repo: github.com/pcpranav/sitecraft
Live: wiz-craft.vercel.app

#AI #WebDevelopment #LLM #TailwindCSS #PromptEngineering
