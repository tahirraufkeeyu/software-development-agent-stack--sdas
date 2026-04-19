# Platform best practices

Every social platform rewards a different shape of content. Cross-posting the same copy everywhere is the fastest way to underperform on all three. This reference captures what has worked in 2024-2026 for B2B technical audiences.

## LinkedIn

LinkedIn is the primary channel for B2B. The algorithm rewards dwell time, saves, and meaningful comments (not one-word replies). Optimize for "a staff engineer stops scrolling and reads the whole thing."

### Length and shape

- **Target 150-300 words.** Shorter is fine if the post is a single sharp observation. Longer is fine up to roughly 500 words if every line earns its place, but engagement drops past 300.
- **Hook in the first 3 lines.** LinkedIn truncates at roughly 210 characters on mobile (the "see more" cutoff). If the hook does not land before that cutoff, the post is invisible.
- **One idea per line.** Short lines beat paragraphs on LinkedIn specifically. Break at the rhythm.
- **Whitespace is formatting.** A blank line between thoughts doubles dwell time.

### Hook patterns that work

- A counter-intuitive claim: "Ramp cut CI time 62%. They didn't rewrite a single pipeline."
- A specific number with a timeline: "Eight weeks. Zero pipeline changes. 62% faster CI."
- A direct disagreement: "Most platform teams are wrong about portals."
- A confession: "We shipped Runners v1 with a sidecar bug. Here is what we learned."

### Hook patterns that do not work

- Dictionary definitions.
- "In today's fast-paced world..."
- Vague questions like "Have you ever wondered..."
- Anything that reads like a subtitle on a corporate slide.

### Posting time

- **Best windows:** Tuesday, Wednesday, Thursday, 8:00-10:00am local time for the audience's region.
- **Second-best:** the same days, 12:00-1:00pm (lunch scroll).
- **Avoid:** Friday afternoon, weekends, holidays, and anything after 6pm local time.
- **For US + EU audiences:** 8:30am ET is the single best slot — catches EU late-morning and US breakfast.

### Formats ranked

1. **Text + native image** (diagram, screenshot, pull quote card). Highest reach.
2. **Carousel (PDF document post).** Strong reach if the first slide earns the next tap.
3. **Text-only post.** Reliable if the hook is sharp.
4. **Native video, under 90 seconds.** Good for faces-of-founders content; weaker for company accounts.
5. **External link in the post body.** Suppressed by the algorithm. If you must link, put the URL in the first comment or at the very end.

### Hashtags

- **Zero hashtags on a branded company account.** They look amateur and do not help reach.
- **Maximum three on a personal account,** all specific: `#platformengineering` beats `#tech`.
- **Never** stack 10+ hashtags. That is a 2018 playbook and it currently hurts reach.

### Comment engagement

- Reply to every comment in the first 90 minutes. The algorithm treats early comment velocity as a quality signal.
- Replies should add something, not just say "thanks." Ask a follow-up. Share a related number. Link to the docs.
- Do not edit the post after the first hour. Edits suppress reach.

## X (Twitter)

X rewards a sharp lead, a clear payoff, and replies to high-reach accounts. The timeline is faster and less forgiving than LinkedIn — the first tweet either earns the next one or it does not.

### Length and shape

- **Each tweet ≤280 characters.** Target 200-260 for readability.
- **Threads of 7-10 tweets** are the sweet spot for technical content. Under 5 and there is no depth; over 12 and drop-off is brutal.
- **No "1/n" numbering** unless the client prefers it. Modern threads render fine without it and the lead tweet reads cleaner.
- **Lead tweet must stand alone.** Assume 90% of impressions see nothing else. If the lead does not deliver value by itself, rewrite it.

### Thread structure

1. **Hook tweet.** The one-line version of the whole thread.
2. **Setup tweet.** Context that makes the hook land.
3. **3-6 substance tweets.** One point each. At least one with a number, one with code or a screenshot, one with a concrete example.
4. **Payoff tweet.** The "so what." The tweet that makes someone bookmark.
5. **CTA tweet.** Link + a specific reply prompt ("reply with your p95 queue time"). Replies are the strongest engagement signal.

### Posting time

- **Best windows for B2B tech:** Tuesday and Thursday, 10:00am-noon ET, and 2:00-4:00pm ET.
- **Launches:** 9:00am ET on a Wednesday for peak US coverage with EU still awake.
- **Avoid:** before 8am ET and after 7pm ET, weekends (unless the content is off-topic/personal).

### Reply strategy

- Reply under high-reach posts in your space. A thoughtful reply under a 50k-view tweet can outperform an original post.
- Reply must add substance — a number, a counter-point, an extension. Never "great post!"
- Do not reply-bomb. Two or three considered replies a day beats twenty shallow ones.

### Hashtags and mentions

- **Zero or one hashtag per tweet.** The platform does not reward them for B2B.
- **Mention people only when they are part of the story.** Tagging the CEO of a competitor to get attention is amateur.
- **Cashtags ($BRAND)** do nothing unless you are in finance.

## Newsletter

Newsletters reward voice, specificity, and restraint. The best newsletters in B2B read like a smart friend emailing you once a week, not like a company broadcast.

### Subject line

- **4-7 words.** Five is the sweet spot.
- **One idea.** Curiosity or specificity, never both.
- **Sentence case or title case, consistent across the program.**
- **Avoid:** all caps, emoji in subject, question marks that promise a payoff the email does not deliver.

### Subject line patterns that work

- Number + claim: "Ramp cut CI time 62%"
- Counter-intuitive: "Stop rewriting pipelines"
- Specific noun phrase: "Runners v2 is live"
- First-person: "What we got wrong about portals"

### Preview text

- **40-90 characters,** rendered right after the subject on most clients.
- **Extends the subject, does not repeat it.** If the subject is "Ramp cut CI time 62%," the preview is "The bottleneck wasn't the pipeline." — not "Read how Ramp cut CI time 62%."
- **Never** leave preview text blank — email clients will fill it with the first line of the email, which is usually "View in browser."

### Body

- **First sentence pays off the subject.** No "Hope you had a great weekend" before the payoff.
- **80-150 words for a snippet** that promotes a pillar piece.
- **300-600 words for a standalone newsletter issue.**
- **Personal voice.** Use "I" or "we" consistently. Do not narrate in the third person about your own company.
- **One CTA.** Always. Link styled as a sentence ("Read the case study →") not a button labeled "Click here."
- **Single-column layout, 600px max width.** 70%+ of B2B newsletter opens are on mobile.

### Send time

- **Tuesday or Thursday, 10:00-11:00am local time for the audience's primary region.**
- **Avoid Monday** (inbox overload from weekend accumulation).
- **Avoid Friday afternoon** (nobody is reading).
- **For global audiences:** 9:00am ET hits US morning and EU afternoon.

### Frequency

- **Weekly is the default cadence** for B2B content newsletters.
- **Biweekly** is fine if every issue is substantial. Monthly is too slow to build habit.
- **Pick a day and stick to it.** "Every Tuesday morning" is a promise. Breaking it silently hurts open rates more than skipping an issue openly.

## Cross-posting rules

- **Never post identical copy across platforms.** Every platform has a different shape. Identical copy reads as lazy on at least two of them.
- **LinkedIn first, X second, newsletter third** is the usual launch order for a pillar piece. Let LinkedIn engagement inform any last edits to the X thread.
- **Repurpose, do not republish.** The LinkedIn post is a point of view. The X thread is a walkthrough. The newsletter is a story. Same source, three different shapes.
