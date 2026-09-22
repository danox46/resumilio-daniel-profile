import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const component = readFileSync("src/components/EvidenceExplorer.tsx", "utf8");
const avatarComponent = readFileSync("src/components/AvatarGuide.tsx", "utf8");
const avatarSchedule = readFileSync("src/avatar-schedule.ts", "utf8");
const styles = readFileSync("src/styles/global.css", "utf8");
const siteSource = readFileSync("src/site.ts", "utf8");
const entryPages = readFileSync("src/pages/index.astro", "utf8") + readFileSync("src/pages/es/index.astro", "utf8");

test("claim controls expose directional keyboard navigation", () => {
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) {
    assert.match(component, new RegExp(`\\\"${key}\\\"`));
  }
  assert.match(component, /onKeyDown=\{\(event\) => moveClaimFocus\(event, claim\)\}/);
  assert.match(component, /visibleNeighborhoodSize = constellationNeighborhoodSize/);
  assert.match(component, /slice\(0, visibleNeighborhoodSize\)/);
  assert.doesNotMatch(component, /evidence-table|allTypes|allStatuses|allSkills/);
  assert.match(component, /data-transition-phase=\{transition\.phase\}/);
  assert.match(component, /data-node-role=\{role\}/);
  assert.match(component, /data-layer-count=\{layerPlan\.successors\.length\}/);
  assert.match(component, /data-reserve-count=\{backgroundReserves\.length\}/);
  assert.match(component, /className="reserve-layers" aria-hidden="true"/);
  assert.match(component, /className="transition-reserves" aria-hidden="true"/);
  assert.match(component, /setQueuedSelection\(intent\)/);
  assert.match(component, /className="ambient-nodes" aria-hidden="true"/);
  assert.match(component, /href=\{classicClaimPath\(claim\.id, locale\)\} target="_blank" rel="noopener noreferrer"/);
  assert.match(entryPages, /client:load/);
});

test("visual motion and focus have accessible alternatives", () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.avatar-video \{ display: none; \}/);
  assert.match(component, /aria-describedby="graph-help"/);
  assert.match(component, /className="sr-only" id="graph-help"/);
});

test("the constellation preloads semantic reserve layers with a quiet mobile presentation", () => {
  assert.match(component, /transitionCommitMs = 864/);
  assert.match(component, /transitionRepositionMs = 1_728/);
  assert.match(component, /transitionSettleMs = 2_208/);
  assert.match(component, /minimumBackgroundNodeCount = 15/);
  assert.match(component, /mobilePoolReserves = mobileReservePool\.map/);
  assert.match(component, /backgroundLayers\.flatMap\(\(layer\) => layer\.reserveNodes\)/);
  assert.match(component, /className="depth-echoes"/);
  assert.match(component, /className="constellation-depth-field"/);
  assert.match(component, /className="background-constellation"/);
  assert.match(component, /data-background-edge-count=/);
  assert.match(component, /data-reserve-owner=\{node\.ownerId\}/);
  assert.match(component, /data-node-role=\{role\}/);
  assert.match(styles, /@keyframes reserve-ready/);
  assert.match(styles, /@keyframes previous-center-out/);
  assert.match(styles, /constellation-field-recede 864ms/);
  assert.match(styles, /constellation-field-align 864ms/);
  assert.match(styles, /experience-focus \{ animation: feature-depart 432ms/);
  assert.match(styles, /experience-focus \{ animation: feature-arrival 432ms/);
  assert.match(component, /claim-node--text-\$\{textDensity\}/);
  assert.match(component, /previewText\(title, 44\)/);
  assert.match(component, /previewText\(summary, 126\)/);
  assert.match(component, /renderedNodes\.slice\(0, mobileConstellationNeighborhoodSize\)/);
  assert.doesNotMatch(component, /<small>\{lifecycleLabel\}<\/small>/);
  assert.match(styles, /container-type: inline-size/);
  assert.match(styles, /place-content: center;\s*place-items: center/);
  assert.match(styles, /position: absolute;\s*inset-inline: 14%;\s*top: 50%;[\s\S]*?transform: translateY\(-50%\);[\s\S]*?text-align: center/);
  assert.match(readFileSync("scripts/verify-browser-quality.ts", "utf8"), /off-center node labels/);
  assert.match(styles, /width: clamp\(126px, 9\.8vw, 168px\)/);
  assert.match(styles, /width: clamp\(82px, 26vw, 108px\)/);
  assert.match(styles, /width: clamp\(80px, 25vw, 104px\)/);
  assert.match(styles, /width: clamp\(76px, 24vw, 98px\)/);
  assert.match(styles, /font-size: clamp\(12\.5px, 12\.5cqi, 17px\)/);
  assert.match(styles, /font-size: clamp\(11\.5px, 12\.5cqi, 15\.5px\)/);
  assert.match(styles, /width: clamp\(94px, 27vw, 112px\)/);
  assert.match(styles, /-webkit-line-clamp: 3/);
  assert.match(styles, /claim-detail h2 \{ -webkit-line-clamp: 2/);
  assert.match(styles, /claim-detail--dense/);
  assert.match(styles, /\.reserve-layers \.reserve-node:nth-child\(n \+ 9\) \{ display: none; \}/);
  assert.match(styles, /\.experience-shell \.claim-node:nth-child\(n \+ 4\) \{ display: none; \}/);
  assert.match(styles, /@keyframes mobile-incoming-node-arrival/);
  assert.match(styles, /@keyframes mobile-incoming-node-reposition/);
  assert.match(styles, /claim-node\.claim-node--incoming:not\(\.claim-node--previous-center\) \{ animation: mobile-incoming-node-arrival 864ms/);
  assert.match(styles, /claim-node\.claim-node--incoming:not\(\.claim-node--previous-center\) \{ animation: mobile-incoming-node-reposition 400ms/);
  assert.match(styles, /left: var\(--mobile-from-x\); top: var\(--mobile-from-y\)/);
  assert.match(styles, /left: var\(--mobile-approach-x\); top: var\(--mobile-approach-y\)/);
  assert.match(styles, /left: var\(--mobile-x\); top: var\(--mobile-y\)/);
  assert.doesNotMatch(styles, /claim-node:nth-child\(1\) \{ left:/);
  assert.match(styles, /incoming-node-label-arrival 280ms 584ms/);
  assert.match(styles, /mobile-relation-arrival 240ms 624ms/);
  assert.match(styles, /data-transition-phase="reposition"/);
  assert.match(component, /transition\.phase === "out" && transitionLayer && <div className="transition-reserves"/);
  assert.equal(component.match(/size: (144|210|310), tone:/g)?.length, 3);
});

test("the avatar uses bounded local media for shared and responsive reactions", () => {
  for (const name of ["daniel-idle.mp4", "daniel-waiting.mp4", "daniel-nod.mp4", "daniel-smile.mp4", "daniel-guide-wide.mp4", "daniel-guide-stacked.mp4", "daniel-idle-poster.webp"]) {
    const path = `public/media/avatar/${name}`;
    assert.ok(existsSync(path), `${path} is missing`);
    assert.ok(statSync(path).size > 0, `${path} is empty`);
  }
  assert.match(avatarComponent, /data-avatar-state=\{playback\.reaction\}/);
  assert.match(avatarComponent, /data-avatar-mode=\{playback\.mode\}/);
  assert.match(component, /onFocus=\{acknowledgeNode\}/);
  assert.match(component, /onMouseEnter=\{acknowledgeNode\}/);
  assert.match(component, /avatarRef\.current\.mode !== "interactive"/);
  assert.match(component, /const selectClaim = \(claim: Claim, reaction: "guide" \| "smile" = "guide"\)/);
  assert.match(component, /intent\.reaction === "guide"\) showGuide\(\)/);
  assert.match(component, /stackedAvatarQuery = "\(max-width: 700px\)"/);
  assert.match(component, /media\.addEventListener\("change", syncLayout\)/);
  assert.match(avatarComponent, /data-avatar-variant=\{current\.variant\.startsWith\("guide-"\) \? current\.variant\.slice\("guide-"\.length\) : "shared"\}/);
  assert.doesNotMatch(avatarComponent, /avatar-mobile-callout/);
  assert.match(styles, /\.experience-shell \.avatar-guide \{\s*left: clamp\(105px, 13vw, 220px\);\s*bottom: -7%;/);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*?width: clamp\(300px, min\(18vw, 38svh, calc\(30vw - 300px\)\), 470px\)/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.experience-shell \.avatar-guide \{\s*position: absolute;\s*left: 31%;\s*top: -10px;/);
  assert.match(component, /mobile-relationship-map[\s\S]*?96,13 84,29 93,42 15,67 63,81 89,72/);
  assert.match(styles, /\.avatar-media \{[\s\S]*?-webkit-mask-image:[\s\S]*?linear-gradient[\s\S]*?radial-gradient/);
  assert.match(styles, /\.avatar-node-backdrop \{[\s\S]*?border-radius: 50%;/);
  assert.match(component, /x1=\{constellationFocus\[0\]\} y1=\{constellationFocus\[1\]\}/);
  assert.match(component, /showReaction\("smile"\)/);
  assert.match(avatarSchedule, /reaction: "idle", weight: 0\.6/);
  assert.match(avatarSchedule, /reaction: "waiting", weight: 0\.2/);
  assert.match(avatarSchedule, /reaction: "smile", weight: 0\.2/);
  assert.match(avatarComponent, /onEnded=\{role === "active" \? \(\) => onComplete\(layer\.sequence\)/);
  assert.doesNotMatch(component, /waitingReactionDelayMs|loop=|showReaction\("waiting"\)/);
  assert.match(avatarComponent, /autoPlay=\{role !== "pending"\}/);
  assert.match(avatarComponent, /preload="auto"/);
  assert.doesNotMatch(component, /beginMotion|mediaReady/);
  assert.equal(entryPages.match(/rel="preload" as="image" type="image\/webp" href=\{withBase\("\/media\/avatar\/daniel-idle-poster\.webp"\)\} fetchpriority="high"/g)?.length, 2);
  assert.doesNotMatch(component + avatarComponent, /flow\.google|labs\.google|generativelanguage|\bveo\b/i);
  assert.match(component, /mode: "loading"/);
  assert.match(component, /commitAvatar\("smile", "welcome"\)/);
  assert.match(component, /shouldStartGuide\(avatarRef\.current, Date\.now\(\), guideCooldownUntil\.current\)/);
  assert.match(avatarComponent, /crossfadeDurationMs = 180/);
  assert.match(avatarComponent, /incomingFallbackMs = 1_000/);
  assert.match(avatarComponent, /data-avatar-video-role=\{role\}/);
  for (const framing of [
    /idle: \{ scale: 1, offsetY: "0%" \}/,
    /waiting: \{ scale: 0\.99, offsetY: "-0\.4%" \}/,
    /nod: \{ scale: 1\.01, offsetY: "-0\.4%" \}/,
    /smile: \{ scale: 1\.01, offsetY: "-0\.8%" \}/,
    /"guide-wide": \{ scale: 1, offsetY: "-0\.8%" \}/,
    /"guide-stacked": \{ scale: 1, offsetY: "-1%" \}/,
  ]) assert.match(avatarComponent, framing);
  assert.match(styles, /transition: opacity 180ms cubic-bezier\(\.22, \.8, \.25, 1\)/);
});

test("personalization remains session-local and network-independent", () => {
  assert.match(component, /sessionStorage/);
  assert.doesNotMatch(component, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|document\.cookie/);
  assert.doesNotMatch(siteSource, /\bprocess\.env\b/);
  assert.match(siteSource, /viteEnvironment\?\.PUBLIC_SITE_ORIGIN \?\? nodeEnvironment\?\.PUBLIC_SITE_ORIGIN/);
});

test("public labels use job-market language while internal contracts stay unchanged", () => {
  for (const label of ["Constellation of experience", "Related experience", "Classic View", "Similar Work"]) {
    assert.match(component + readFileSync("src/presentation.ts", "utf8"), new RegExp(label));
  }
  for (const retiredLabel of ["Now exploring", "View experience", "Show similar work"]) {
    assert.doesNotMatch(component, new RegExp(retiredLabel));
  }
  for (const internalLabel of ["Selected claim", "Evidence strength", "Source visibility", "Evidence / source"]) {
    assert.doesNotMatch(component, new RegExp(internalLabel));
  }
});

test("constellation showcase states replace generic lifecycle copy", () => {
  assert.match(component, /data-showcase-kind=\{showcase\.kind\}/);
  assert.match(component, /showcase--\$\{showcase\.kind\}/);
  assert.match(component, /detail-status--linked/);
  assert.doesNotMatch(component, /marketLabel\(claim\.lifecycle/);
  assert.doesNotMatch(readFileSync("src/components/EvidenceRecord.astro", "utf8"), /marketLabel\(claim\.lifecycle/);
  for (const state of ["professional-role", "live-demo", "public-source", "external-preview", "certificate", "nda-protected", "private-context"]) {
    assert.match(styles, new RegExp(`showcase--${state}`));
  }
});

test("focused constellation actions stay outside the main display node", () => {
  assert.match(component, /<ClaimDetail profile=\{profile\} claim=\{selected\} locale=\{locale\}\/>/);
  assert.match(component, /<ClaimActions claim=\{selected\} locale=\{locale\} onMoreLike=\{moreLike\}\/>/);
  assert.match(component, /detail-actions detail-actions--dock/);
  assert.doesNotMatch(component, /showActions|detail-actions--mobile/);
  assert.match(styles, /\.experience-shell \.detail-actions--dock \{[\s\S]*position: fixed;[\s\S]*bottom:/);
});

test("classic view targets one anchored print-ready resume instead of node pages", () => {
  const classicResume = readFileSync("src/components/ClassicResume.astro", "utf8");
  const classicStyles = readFileSync("src/styles/classic-resume.css", "utf8");
  assert.match(siteSource, /classicClaimPath/);
  assert.match(classicResume, /class="resume-entry" id=\{claim\.id\}/);
  assert.match(classicResume, /groups\.map/);
  assert.match(classicResume, /<details class="resume-section"[\s\S]*open>/);
  assert.match(classicResume, /<summary class="resume-section-summary">/);
  assert.match(classicResume, /section instanceof HTMLDetailsElement[\s\S]*section\.open = true/);
  assert.match(classicResume, /loadMore: "Load more"/);
  assert.match(classicResume, /loadMore: "Cargar más"/);
  assert.match(classicResume, /const pageSize = 3/);
  assert.match(classicResume, /data-resume-load-more/);
  assert.match(classicResume, /<noscript><style>\.resume-entry\[hidden\]/);
  assert.match(classicResume, /Math\.ceil\(\(entryIndex \+ 1\) \/ pageSize\) \* pageSize/);
  assert.match(classicStyles, /\.resume-entry:target/);
  assert.match(classicStyles, /\.resume-entry\[hidden\] \{ display: block !important; \}/);
  assert.match(classicStyles, /\.resume-section:not\(\[open\]\) > \.resume-section-content \{ display: block !important; \}/);
  assert.match(classicStyles, /@media print/);
  assert.match(classicStyles, /@page \{ size: A4/);
});
