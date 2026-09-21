import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join, normalize, resolve } from "node:path";
import { chromium, type Page } from "playwright-core";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((value): value is string => Boolean(value));
const chromePath = chromeCandidates.find(existsSync);
if (!chromePath) throw new Error("Chrome was not found. Set CHROME_PATH to run browser QA.");

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg", ".json": "application/json; charset=utf-8", ".mp4": "video/mp4", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".xml": "application/xml; charset=utf-8",
};
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const candidate = normalize(join("site-dist", relative));
  const path = existsSync(candidate) && !extname(candidate) ? join(candidate, "index.html") : candidate;
  if (!path.startsWith(normalize("site-dist")) || !existsSync(path)) return void response.writeHead(404).end("Not found");
  response.writeHead(200, { "content-type": mimeTypes[extname(path)] ?? "application/octet-stream" });
  response.end(readFileSync(path));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not start the browser QA server.");
const origin = `http://127.0.0.1:${address.port}`;
const requestedOutputDirectory = process.env.RESUMILIO_QA_OUTPUT_DIR;
const outputDirectory = requestedOutputDirectory
  ? isAbsolute(requestedOutputDirectory) ? requestedOutputDirectory : resolve(requestedOutputDirectory)
  : join(tmpdir(), "resumilio-phase5-qa");
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const viewports = [
  { name: "watch", width: 240, height: 240 },
  { name: "small-mobile", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1024 },
  { name: "full-hd", width: 1920, height: 1080 },
  { name: "wide-short", width: 2572, height: 1233 },
  { name: "four-k", width: 3840, height: 2160 },
];

function overlaps(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y;
}

async function overflowingNodeLabels(page: Page) {
  return page.locator(".claim-node:visible").evaluateAll((nodes) => nodes.flatMap((node) => {
    const nodeBox = node.getBoundingClientRect();
    const textBoxes = [...node.querySelectorAll("strong, small")].map((label) => label.getBoundingClientRect());
    const outside = textBoxes.some((box) => box.left < nodeBox.left - 1 || box.right > nodeBox.right + 1 || box.top < nodeBox.top - 1 || box.bottom > nodeBox.bottom + 1);
    return outside ? [node.getAttribute("data-claim-id") ?? "unknown"] : [];
  }));
}

async function nodeLabelCenterOffsets(page: Page) {
  return page.locator(".claim-node:visible").evaluateAll((nodes) => nodes.map((node) => {
    const nodeBox = node.getBoundingClientRect();
    const labelBox = node.querySelector("strong")!.getBoundingClientRect();
    return {
      claimId: node.getAttribute("data-claim-id"),
      x: Number((labelBox.left + labelBox.width / 2 - (nodeBox.left + nodeBox.width / 2)).toFixed(2)),
      y: Number((labelBox.top + labelBox.height / 2 - (nodeBox.top + nodeBox.height / 2)).toFixed(2)),
    };
  }));
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox"] });
const report = { viewports: [] as Array<Record<string, unknown>>, keyboard: false, reactiveNeighborhood: false, relationshipBridge: false, relationshipBridgeScreenshots: [] as string[], layerPreload: false, backgroundConstellation: false, backgroundShift: false, sharedNodeIdentity: false, previousCenterHandoff: false, incomingReserveMotion: false, singleOwnerTransition: false, mobileTransitionNodeCeiling: false, mobileTransitionSync: false, mobileSpatialContinuity: false, mobileRepositionPhase: false, mobileRestingSlotMath: false, mobileSearchSpatialContinuity: false, mobileSimilarSpatialContinuity: false, mobileTransitionScreenshots: [] as string[], outgoingRetreat: false, latestSelectionQueue: false, searchLayerTransition: false, similarWorkLayerTransition: false, mobileReserveCap: false, localizedResponsiveLabels: false, boundedPreview: false, boundedPreviewScreenshot: "", nodeTransition: false, nodeTransitionScreenshot: "", layerTransitionScreenshots: [] as string[], experienceLinkNewTab: false, classicSectionsCollapsible: false, classicLoadMore: false, avatarReactions: false, avatarPlayback: false, immediateIdlePlayback: false, welcomeAfterLoad: false, ambientAvatarMix: false, avatarInteractionPriority: false, guideCooldown: false, crossfade: false, framing: false, resetSkipsWelcome: false, wideAvatarPlacement: false, responsiveAvatar: false, responsiveAvatarScreenshots: [] as string[], assistiveTechnologyStructureSmoke: false, reducedMotion: false, firstPartyRequests: 0, externalRequests: [] as string[], evidencePageScriptRequests: 0 };
let showcasePresentation = false;
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name} has ${overflow}px of horizontal overflow.`);
    const visibleTargets = await page.locator("button:visible, a:visible, input:visible, select:visible").count();
    if (visibleTargets === 0) throw new Error(`${viewport.name} exposes no interactive targets.`);
    const visibleNodeCount = await page.locator(".claim-node:visible").count();
    const overflowingLabels = await overflowingNodeLabels(page);
    const labelCenterOffsets = await nodeLabelCenterOffsets(page);
    if (["tablet", "desktop", "full-hd", "wide-short", "four-k"].includes(viewport.name) && visibleNodeCount !== 5) throw new Error(`${viewport.name} shows ${visibleNodeCount} active nodes; expected 5.`);
    if (["watch", "small-mobile", "mobile"].includes(viewport.name) && visibleNodeCount !== 3) throw new Error(`${viewport.name} shows ${visibleNodeCount} active nodes; expected the three-node mobile presentation.`);
    if (overflowingLabels.length > 0) throw new Error(`${viewport.name} has overflowing node labels: ${overflowingLabels.join(", ")}.`);
    const offCenterLabels = labelCenterOffsets.filter(({ x, y }) => Math.abs(x) > .75 || Math.abs(y) > .75);
    if (offCenterLabels.length > 0) throw new Error(`${viewport.name} has off-center node labels: ${JSON.stringify(offCenterLabels)}.`);
    const layerCount = Number(await page.locator(".graph-stage").getAttribute("data-layer-count"));
    const reserveCount = Number(await page.locator(".graph-stage").getAttribute("data-reserve-count"));
    const reserveDomCount = await page.locator(".reserve-layers .reserve-node").count();
    const visibleReserveCount = await page.locator(".reserve-layers .reserve-node:visible").count();
    const backgroundNodeCount = Number(await page.locator(".constellation-depth-field").getAttribute("data-background-node-count"));
    const backgroundNodeFloor = Number(await page.locator(".constellation-depth-field").getAttribute("data-background-node-floor"));
    const backgroundEdgeCount = Number(await page.locator(".constellation-depth-field").getAttribute("data-background-edge-count"));
    const backgroundDomCount = await page.locator(".reserve-layers .reserve-node, .depth-echoes .depth-echo-node").count();
    if (visibleNodeCount === 5 && layerCount !== 5) throw new Error(`${viewport.name} preloaded ${layerCount} layers; expected one for every active node.`);
    if (reserveDomCount !== reserveCount) throw new Error(`${viewport.name} reserve DOM count does not match its data plan.`);
    if (backgroundNodeFloor !== 15 || backgroundNodeCount < backgroundNodeFloor || backgroundDomCount !== backgroundNodeCount || backgroundEdgeCount < backgroundNodeCount + 4) throw new Error(`${viewport.name} did not render a connected minimum-density background constellation.`);
    report.backgroundConstellation = true;
    if (viewport.name === "desktop") {
      const owners = await page.locator(".reserve-layers .reserve-node").evaluateAll((nodes) => new Set(nodes.map((node) => node.getAttribute("data-reserve-owner"))).size);
      const reserveLayerIsHidden = await page.locator(".reserve-layers").getAttribute("aria-hidden") === "true";
      const focusableReserves = await page.locator('.reserve-layers button, .reserve-layers a, .reserve-layers input, .reserve-layers [tabindex]').count();
      report.layerPreload = layerCount === 5 && reserveCount > 0 && owners === 5 && reserveLayerIsHidden && focusableReserves === 0;
    }
    if (["watch", "small-mobile", "mobile"].includes(viewport.name) && visibleReserveCount > 8) throw new Error(`${viewport.name} exposes ${visibleReserveCount} reserve ghosts; expected at most 8.`);
    if (viewport.name === "mobile") report.mobileReserveCap = visibleReserveCount <= 8;
    let responsiveAvatarSizing: Record<string, unknown> | undefined;
    if (viewport.name === "wide-short") {
      const avatarBox = await page.locator(".avatar-guide").boundingBox();
      const backdropBox = await page.locator(".avatar-node-backdrop").boundingBox();
      const focusBox = await page.locator(".experience-focus").boundingBox();
      const nodeBoxes = await page.locator(".claim-node").evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }));
      if (!avatarBox || !backdropBox || !focusBox || avatarBox.width < 430) throw new Error("Wide-short layout did not expand the avatar into available space.");
      if (overlaps(backdropBox, focusBox) || nodeBoxes.some((nodeBox) => overlaps(backdropBox, nodeBox))) throw new Error("Responsive avatar growth intrudes into featured or active experience nodes.");
      responsiveAvatarSizing = { avatarWidth: avatarBox.width, backdropWidth: backdropBox.width, collisionFree: true };
    }
    const screenshot = join(outputDirectory, `${viewport.width}x${viewport.height}-${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const external = requests.filter((url) => new URL(url).origin !== origin);
    report.externalRequests.push(...external);
    report.firstPartyRequests += requests.length - external.length;
    report.viewports.push({
      ...viewport,
      overflow,
      visibleTargets,
      visibleNodeCount,
      overflowingLabels,
      labelCenterOffsets,
      layerCount,
      reserveCount,
      visibleReserveCount,
      backgroundNodeCount,
      backgroundNodeFloor,
      backgroundEdgeCount,
      responsiveAvatarSizing,
      screenshot,
    });

    if (viewport.name === "mobile") {
      const initialNodes = page.locator(".claim-node");
      const initialCount = await initialNodes.count();
      if (initialCount !== 3) throw new Error(`Reactive mobile neighborhood rendered ${initialCount} nodes; expected 3.`);
      const initialIds = await initialNodes.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-claim-id")));
      const initialFeature = await page.locator(".experience-focus").getAttribute("data-selected-id");
      const firstClaim = initialNodes.first();
      await firstClaim.focus();
      const before = await firstClaim.getAttribute("data-claim-id");
      await page.keyboard.press("ArrowDown");
      const active = page.locator(".claim-node:focus");
      const after = await active.getAttribute("data-claim-id");
      const outlineStyle = await active.evaluate((element) => getComputedStyle(element).outlineStyle);
      if (!before || !after || before === after || outlineStyle === "none") throw new Error("Directional-key focus or visible focus failed.");
      report.keyboard = true;
      await active.click();
      const nextFeature = await page.locator(".experience-focus").getAttribute("data-selected-id");
      const nextIds = await page.locator(".claim-node").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-claim-id")));
      if (!initialFeature || !nextFeature || initialFeature === nextFeature || initialIds.join("|") === nextIds.join("|")) throw new Error("Selected experience or constellation neighborhood did not change after selecting a node.");
      report.reactiveNeighborhood = true;
      await page.locator(".mobile-search-toggle").click();
      await page.locator(".search-field input").fill("HubSpot");
      await page.locator(".search-controls").press("Enter");
      report.assistiveTechnologyStructureSmoke = await page.locator("main").count() === 1
        && await page.locator('[role="search"]').count() === 1
        && await page.locator('[aria-describedby="graph-help"]').count() === 1
        && await page.locator('[aria-live="polite"]').count() >= 1;
      report.reducedMotion = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
    await context.close();
  }

  const localizedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", locale: "es-CO" });
  const localizedPage = await localizedContext.newPage();
  await localizedPage.goto(`${origin}/es/`, { waitUntil: "networkidle" });
  await localizedPage.locator(".mobile-search-toggle").click();
  await localizedPage.locator(".search-field input").fill("Credenciales de HubSpot Academy");
  await localizedPage.locator(".search-controls").press("Enter");
  await localizedPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle"
    && document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === "claim-hubspot-academy-credentials");
  const localizedOverflowingLabels = await overflowingNodeLabels(localizedPage);
  const localizedDetailFits = await localizedPage.locator(".claim-detail").evaluate((detail) => detail.scrollHeight <= detail.clientHeight + 1);
  if (localizedOverflowingLabels.length > 0 || !localizedDetailFits) throw new Error(`Spanish long-label state overflowed: nodes=${localizedOverflowingLabels.join(", ") || "none"}, detailFits=${localizedDetailFits}.`);
  report.localizedResponsiveLabels = true;
  await localizedContext.close();

  const previewContext = await browser.newContext({ viewport: { width: 768, height: 720 }, reducedMotion: "reduce" });
  const previewPage = await previewContext.newPage();
  await previewPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await previewPage.locator(".search-field input").fill("OpenAI-assisted text completion");
  await previewPage.locator(".search-controls").press("Enter");
  await previewPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle"
    && document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === "claim-professional-ai-text-completion");
  const previewFit = await previewPage.locator(".claim-detail").evaluate((detail) => {
    const title = detail.querySelector("h2");
    const summary = detail.querySelector(".detail-summary");
    if (!title || !summary) return false;
    const detailBox = detail.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const summaryBox = summary.getBoundingClientRect();
    return detail.scrollHeight <= detail.clientHeight + 1
      && title.textContent!.length <= 45
      && summary.textContent!.length <= 127
      && titleBox.left >= detailBox.left && titleBox.right <= detailBox.right
      && summaryBox.left >= detailBox.left && summaryBox.right <= detailBox.right;
  });
  if (!previewFit) throw new Error("The long selected-experience preview did not stay within its compact title and summary bounds.");
  report.boundedPreviewScreenshot = join(outputDirectory, "bounded-selected-preview.png");
  await previewPage.screenshot({ path: report.boundedPreviewScreenshot });
  report.boundedPreview = true;
  await previewContext.close();

  const context = await browser.newContext();
  const page = await context.newPage();
  const scriptRequests: string[] = [];
  page.on("request", (request) => { if (request.resourceType() === "script") scriptRequests.push(request.url()); });
  await page.goto(`${origin}/evidence/claim-professional-ai-text-completion/`, { waitUntil: "networkidle" });
  report.evidencePageScriptRequests = scriptRequests.length;
  await context.close();

  const linkContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "reduce" });
  const constellationPage = await linkContext.newPage();
  await constellationPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const sourceUrl = constellationPage.url();
  const detailPagePromise = linkContext.waitForEvent("page");
  await constellationPage.locator(".detail-actions--dock .button--primary").click();
  const detailPage = await detailPagePromise;
  await detailPage.waitForLoadState("networkidle");
  if (constellationPage.url() !== sourceUrl || !detailPage.url().includes("/classic/#claim-")) throw new Error("Classic View did not preserve the constellation and open the anchored resume in a new tab.");
  const anchoredEntry = detailPage.locator(".resume-entry:target");
  if (await anchoredEntry.count() !== 1 || !(await anchoredEntry.isVisible())) throw new Error("Classic View did not scroll to and highlight the selected resume entry.");
  const educationSection = detailPage.locator('[data-resume-section="education"]');
  const educationSummary = educationSection.locator("summary");
  if (await educationSection.getAttribute("open") === null) throw new Error("Classic resume sections were not expanded by default.");
  await educationSummary.click();
  if (await educationSection.getAttribute("open") !== null || await educationSection.locator(".resume-entry").first().isVisible()) throw new Error("Classic resume section did not collapse.");
  await educationSummary.click();
  if (await educationSection.getAttribute("open") === null || !(await educationSection.locator(".resume-entry").first().isVisible())) throw new Error("Classic resume section did not expand.");
  const experienceSection = detailPage.locator('[data-resume-section="experience"]');
  const experienceLoadMore = experienceSection.locator("[data-resume-load-more]");
  if (await experienceSection.locator(".resume-entry:not([hidden])").count() !== 3 || !(await experienceLoadMore.isVisible())) throw new Error("Long classic resume sections were not limited to three entries initially.");
  await experienceLoadMore.click();
  if (await experienceSection.locator(".resume-entry:not([hidden])").count() !== 6) throw new Error("Classic resume Load more did not reveal the next three entries.");
  const certificationSection = detailPage.locator('[data-resume-section="certification"]');
  await certificationSection.locator("summary").click();
  await detailPage.evaluate(() => { window.location.hash = "claim-how-google-does-machine-learning"; });
  await detailPage.waitForTimeout(100);
  const certificationTarget = detailPage.locator("#claim-how-google-does-machine-learning");
  if (await certificationSection.getAttribute("open") === null || !(await certificationTarget.isVisible())) throw new Error("An anchored resume entry did not reopen its collapsed section.");
  if (await certificationTarget.getAttribute("hidden") !== null) throw new Error("An anchored resume entry remained hidden behind Load more pagination.");
  report.experienceLinkNewTab = true;
  report.classicSectionsCollapsible = true;
  report.classicLoadMore = true;
  await linkContext.close();

  const motionContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const motionPage = await motionContext.newPage();
  const browserProblems: string[] = [];
  motionPage.on("pageerror", (error) => browserProblems.push(error.message));
  motionPage.on("console", (message) => { if (message.type() === "error") browserProblems.push(message.text()); });

  let releasePoster!: () => void;
  const posterGate = new Promise<void>((resolve) => { releasePoster = resolve; });
  let heldPoster = false;
  await motionPage.route("**/daniel-idle-poster.webp", async (route) => {
    if (!heldPoster) {
      heldPoster = true;
      await posterGate;
    }
    await route.continue();
  });
  await motionPage.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  const avatar = motionPage.locator(".avatar-guide");
  const activeVideo = () => motionPage.locator('.avatar-video[data-avatar-video-role="active"]');
  await motionPage.waitForFunction(() => {
    const shell = document.querySelector(".avatar-guide");
    const element = document.querySelector<HTMLVideoElement>('.avatar-video[data-avatar-video-role="active"]');
    return shell?.getAttribute("data-avatar-mode") === "loading"
      && shell.getAttribute("data-avatar-active-state") === "idle"
      && Boolean(element && !element.paused && element.currentTime > 0.1 && element.currentSrc.endsWith("daniel-idle.mp4"));
  });
  const playbackConfiguration = await activeVideo().evaluate((element) => {
    const media = element as HTMLVideoElement;
    return {
      autoPlay: media.autoplay,
      loop: media.loop,
      muted: media.muted,
      playsInline: media.playsInline,
      preload: media.preload,
    };
  });
  if (!playbackConfiguration.autoPlay || playbackConfiguration.loop || !playbackConfiguration.muted || !playbackConfiguration.playsInline || playbackConfiguration.preload !== "auto") {
    throw new Error("Ambient avatar playback configuration does not support natural clip handoffs.");
  }
  report.immediateIdlePlayback = true;

  releasePoster();
  await motionPage.waitForLoadState("load");
  await motionPage.unroute("**/daniel-idle-poster.webp");
  await motionPage.waitForFunction(() => {
    const shell = document.querySelector(".avatar-guide");
    return shell?.getAttribute("data-avatar-mode") === "welcome"
      && shell.getAttribute("data-avatar-state") === "smile"
      && shell.getAttribute("data-avatar-transition") === "crossfade"
      && document.querySelectorAll(".avatar-video").length === 2;
  });
  report.crossfade = true;
  await motionPage.waitForFunction(() => {
    const shell = document.querySelector(".avatar-guide");
    const media = document.querySelector<HTMLVideoElement>('.avatar-video[data-avatar-video-role="active"]');
    return shell?.getAttribute("data-avatar-mode") === "welcome"
      && shell.getAttribute("data-avatar-active-state") === "smile"
      && shell.getAttribute("data-avatar-transition") === "settled"
      && document.querySelectorAll(".avatar-video").length === 1
      && Boolean(media?.currentSrc.endsWith("daniel-smile.mp4"));
  });
  report.welcomeAfterLoad = true;
  const welcomeScreenshot = join(outputDirectory, "avatar-welcome-desktop.png");
  await motionPage.screenshot({ path: welcomeScreenshot });
  report.responsiveAvatarScreenshots.push(welcomeScreenshot);
  const welcomeFrame = await activeVideo().evaluate((element) => ({
    scale: element.style.getPropertyValue("--avatar-video-scale"),
    offsetY: element.style.getPropertyValue("--avatar-video-offset-y"),
  }));
  if (welcomeFrame.scale !== "1.01" || welcomeFrame.offsetY !== "-0.8%") throw new Error("Welcome smile did not receive its normalized framing.");

  await motionPage.evaluate(() => {
    const values = [0.1, 0.7, 0.9];
    let index = 0;
    Math.random = () => values[index++] ?? 0.1;
  });
  for (const expected of ["idle", "waiting", "smile"]) {
    const previousSequence = Number(await avatar.getAttribute("data-avatar-sequence"));
    await activeVideo().evaluate((element) => element.dispatchEvent(new Event("ended", { bubbles: true })));
    await motionPage.waitForFunction(({ reaction, sequence }) => {
      const element = document.querySelector(".avatar-guide");
      return element?.getAttribute("data-avatar-active-state") === reaction
        && element.getAttribute("data-avatar-mode") === "ambient"
        && element.getAttribute("data-avatar-transition") === "settled"
        && Number(element.getAttribute("data-avatar-sequence")) > sequence;
    }, { reaction: expected, sequence: previousSequence });
  }
  report.ambientAvatarMix = true;
  report.framing = await activeVideo().evaluate((element) => element.style.getPropertyValue("--avatar-video-scale") === "1.01"
    && element.style.getPropertyValue("--avatar-video-offset-y") === "-0.8%");
  if (!report.framing) throw new Error("Per-clip avatar framing was not applied to the active layer.");
  const graphBox = await motionPage.locator(".graph-stage").boundingBox();
  const avatarBox = await avatar.boundingBox();
  report.wideAvatarPlacement = Boolean(graphBox && avatarBox
    && avatarBox.x < graphBox.x + graphBox.width * .2
    && avatarBox.y > graphBox.y + graphBox.height * .35);
  if (!report.wideAvatarPlacement) throw new Error("Wide avatar is not anchored in the lower-left supporting position.");
  const previousCenterId = await motionPage.locator(".experience-focus").getAttribute("data-selected-id");
  const transitionTarget = await motionPage.locator(".claim-node").first().getAttribute("data-claim-id");
  await motionPage.locator(".claim-node").first().hover();
  await motionPage.waitForFunction(() => document.querySelector(".avatar-guide")?.getAttribute("data-avatar-active-state") === "nod"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-transition") === "settled");
  await motionPage.locator(".claim-node").first().click();
  await motionPage.waitForFunction((claimId) => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out"
    && document.querySelector('[data-node-role="selected-target"]')?.getAttribute("data-claim-id") === claimId, transitionTarget);
  report.backgroundShift = await motionPage.locator(".constellation-depth-field").evaluate((node) => getComputedStyle(node).animationName === "constellation-field-recede");
  if (!report.backgroundShift) throw new Error("The background constellation did not recede with the selected branch.");
  const sharedNode = motionPage.locator('[data-node-role="shared"]').first();
  const sharedNodeId = await sharedNode.getAttribute("data-claim-id");
  const sharedNodeHandle = await sharedNode.elementHandle();
  const advancingReserve = motionPage.locator(".transition-reserves .reserve-node--advancing").first();
  const reserveMotion = await advancingReserve.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      animationName: style.animationName,
      fromX: style.getPropertyValue("--from-x"),
      fromY: style.getPropertyValue("--from-y"),
      toX: style.getPropertyValue("--to-x"),
      toY: style.getPropertyValue("--to-y"),
    };
  });
  report.incomingReserveMotion = reserveMotion.animationName === "reserve-ready"
    && `${reserveMotion.fromX}|${reserveMotion.fromY}` !== `${reserveMotion.toX}|${reserveMotion.toY}`;
  if (!report.incomingReserveMotion) throw new Error("The chosen reserve layer did not arm its preloaded coordinates.");
  const nodeTransitionScreenshot = join(outputDirectory, "node-transition-out.png");
  await motionPage.screenshot({ path: nodeTransitionScreenshot });
  report.nodeTransitionScreenshot = nodeTransitionScreenshot;
  report.layerTransitionScreenshots.push(nodeTransitionScreenshot);
  await motionPage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId, transitionTarget);
  const advancingReserveCount = await motionPage.locator(".transition-reserves .reserve-node--advancing").count();
  const incomingAnimationNames = await motionPage.locator('[data-node-role="incoming"]').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
  report.singleOwnerTransition = advancingReserveCount === 0 && incomingAnimationNames.every((name) => name === "incoming-node-arrival");
  if (!report.singleOwnerTransition) throw new Error("Reserve and incoming-node actors overlapped after the transition handoff.");
  const previousCenter = motionPage.locator('[data-node-role="previous-center"]');
  report.previousCenterHandoff = await previousCenter.getAttribute("data-claim-id") === previousCenterId
    && await previousCenter.evaluate((node) => getComputedStyle(node).animationName) === "previous-center-out";
  if (!report.previousCenterHandoff) throw new Error("The previous center did not move outward into the selected node's vacated slot.");
  if (!sharedNodeId || !sharedNodeHandle) throw new Error("The transition did not expose a shared node for identity verification.");
  report.sharedNodeIdentity = await motionPage.locator(`.claim-node[data-claim-id="${sharedNodeId}"]`).evaluate((node, previous) => node === previous, sharedNodeHandle);
  if (!report.sharedNodeIdentity) throw new Error("A shared active node was remounted instead of remaining spatially continuous.");
  const layerArrivalScreenshot = join(outputDirectory, "node-transition-in.png");
  await motionPage.screenshot({ path: layerArrivalScreenshot });
  report.layerTransitionScreenshots.push(layerArrivalScreenshot);
  await motionPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle");
  const layerSettledScreenshot = join(outputDirectory, "node-transition-settled.png");
  await motionPage.screenshot({ path: layerSettledScreenshot });
  report.layerTransitionScreenshots.push(layerSettledScreenshot);
  await motionPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-active-state") === "guide"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-transition") === "settled");
  report.nodeTransition = true;
  if (await avatar.getAttribute("data-avatar-state") !== "guide"
    || await avatar.getAttribute("data-avatar-variant") !== "wide"
    || !String(await activeVideo().getAttribute("src")).endsWith("daniel-guide-wide.mp4")) throw new Error("Wide selection did not use the pointing guidance clip.");
  report.avatarReactions = true;
  await motionPage.waitForFunction(() => (document.querySelector<HTMLVideoElement>('.avatar-video[data-avatar-video-role="active"]')?.currentTime ?? 0) > 0.5);
  const wideGuideScreenshot = join(outputDirectory, "responsive-guide-wide.png");
  await motionPage.screenshot({ path: wideGuideScreenshot });
  report.responsiveAvatarScreenshots.push(wideGuideScreenshot);
  const guideSequence = Number(await avatar.getAttribute("data-avatar-sequence"));
  const guideTime = await activeVideo().evaluate((element) => (element as HTMLVideoElement).currentTime);
  const secondNode = motionPage.locator(".claim-node").nth(1);
  const secondNodeId = await secondNode.getAttribute("data-claim-id");
  await secondNode.click();
  await motionPage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId, secondNodeId);
  await motionPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle");
  const guideSequenceAfterSuppressedClick = Number(await avatar.getAttribute("data-avatar-sequence"));
  const guideTimeAfterSuppressedClick = await activeVideo().evaluate((element) => (element as HTMLVideoElement).currentTime);
  if (guideSequenceAfterSuppressedClick !== guideSequence || guideTimeAfterSuppressedClick <= guideTime) throw new Error("A repeated node click restarted active guidance instead of only changing the constellation.");

  await motionPage.evaluate(() => {
    const values = [0, 0.1];
    let index = 0;
    Math.random = () => values[index++] ?? 0.1;
  });
  await activeVideo().evaluate((element) => element.dispatchEvent(new Event("ended", { bubbles: true })));
  await motionPage.waitForFunction((sequence) => {
    const element = document.querySelector(".avatar-guide");
    return element?.getAttribute("data-avatar-active-state") === "idle"
      && element.getAttribute("data-avatar-mode") === "ambient"
      && element.getAttribute("data-avatar-transition") === "settled"
      && Number(element.getAttribute("data-avatar-sequence")) > sequence;
  }, guideSequence);
  report.avatarInteractionPriority = true;

  const cooldownNode = motionPage.locator(".claim-node").nth(1);
  const cooldownNodeId = await cooldownNode.getAttribute("data-claim-id");
  await cooldownNode.click();
  await motionPage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId, cooldownNodeId);
  await motionPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle");
  if (await avatar.getAttribute("data-avatar-state") === "guide") throw new Error("A node click inside the guide cooldown restarted guidance.");
  await motionPage.waitForTimeout(5_100);
  const expiredNode = motionPage.locator(".claim-node").nth(1);
  const expiredNodeId = await expiredNode.getAttribute("data-claim-id");
  await expiredNode.click();
  await motionPage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId, expiredNodeId);
  await motionPage.waitForFunction(() => document.querySelector(".avatar-guide")?.getAttribute("data-avatar-active-state") === "guide"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-transition") === "settled");
  await motionPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle");
  report.guideCooldown = true;

  await motionPage.setViewportSize({ width: 390, height: 844 });
  const guideSequenceBeforeSwap = Number(await avatar.getAttribute("data-avatar-sequence"));
  await motionPage.waitForFunction(() => matchMedia("(max-width: 700px)").matches
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-layout") === "stacked"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-variant") === "stacked"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-active-state") === "guide"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-transition") === "settled"
    && document.querySelector<HTMLVideoElement>('.avatar-video[data-avatar-video-role="active"]')?.currentSrc.endsWith("daniel-guide-stacked.mp4"));
  const selectedNodeTitle = (await motionPage.locator(".experience-focus h2").getAttribute("aria-label"))?.trim();
  const mobileNodeCount = await motionPage.locator(".claim-node:visible").count();
  const mobileFocusVisible = await motionPage.locator(".experience-focus").isVisible();
  const stackedGuideState = {
    sequence: Number(await avatar.getAttribute("data-avatar-sequence")),
    guideSequenceBeforeSwap,
    state: await avatar.getAttribute("data-avatar-state"),
    variant: await avatar.getAttribute("data-avatar-variant"),
    src: await activeVideo().getAttribute("src"),
    selectedNodeTitle,
    mobileNodeCount,
    mobileFocusVisible,
  };
  if (stackedGuideState.sequence !== guideSequenceBeforeSwap
    || stackedGuideState.state !== "guide"
    || stackedGuideState.variant !== "stacked"
    || !String(stackedGuideState.src).endsWith("daniel-guide-stacked.mp4")
    || !selectedNodeTitle
    || stackedGuideState.mobileNodeCount !== 3
    || !stackedGuideState.mobileFocusVisible) throw new Error(`Stacked selection did not use the downward guidance clip and focused three-node mobile layout: ${JSON.stringify(stackedGuideState)}`);
  await avatar.scrollIntoViewIfNeeded();
  const stackedGuideScreenshot = join(outputDirectory, "responsive-guide-stacked.png");
  await motionPage.screenshot({ path: stackedGuideScreenshot });
  report.responsiveAvatarScreenshots.push(stackedGuideScreenshot);
  report.responsiveAvatar = true;

  await motionPage.setViewportSize({ width: 1440, height: 1024 });
  await motionPage.waitForFunction(() => !matchMedia("(max-width: 700px)").matches
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-layout") === "wide"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-transition") === "settled");
  await motionPage.locator(".detail-actions--dock .button--secondary").click();
  await motionPage.waitForFunction(() => document.querySelector(".avatar-guide")?.getAttribute("data-avatar-active-state") === "smile"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-mode") === "interactive"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-transition") === "settled");
  if (!String(await activeVideo().getAttribute("src")).endsWith("daniel-smile.mp4")) throw new Error("Smile playback did not replace guidance after recommendation.");
  const smileSequence = Number(await avatar.getAttribute("data-avatar-sequence"));
  await activeVideo().evaluate((element) => element.dispatchEvent(new Event("ended", { bubbles: true })));
  await motionPage.waitForFunction((sequence) => {
    const element = document.querySelector(".avatar-guide");
    return element?.getAttribute("data-avatar-mode") === "ambient"
      && element.getAttribute("data-avatar-transition") === "settled"
      && Number(element.getAttribute("data-avatar-sequence")) > sequence;
  }, smileSequence);
  report.avatarPlayback = true;

  await motionPage.locator(".reset-control").click();
  await motionPage.waitForFunction(() => document.querySelector(".avatar-guide")?.getAttribute("data-avatar-mode") === "ambient"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-active-state") === "idle"
    && document.querySelector(".avatar-guide")?.getAttribute("data-avatar-transition") === "settled");
  report.resetSkipsWelcome = await avatar.getAttribute("data-avatar-mode") === "ambient";
  if (browserProblems.length > 0) throw new Error(`Browser errors during avatar playback: ${browserProblems.join(" | ")}`);
  await motionContext.close();

  const outgoingContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const outgoingPage = await outgoingContext.newPage();
  await outgoingPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await outgoingPage.locator('[data-claim-id="claim-on-the-fuze-backend-lead"].claim-node').click();
  await outgoingPage.waitForFunction(() => {
    const outgoingNode = document.querySelector('[data-node-role="outgoing"]');
    return document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out"
      && outgoingNode
      && getComputedStyle(outgoingNode).animationName === "node-depart";
  });
  report.outgoingRetreat = true;
  await outgoingContext.close();

  const queueContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const queuePage = await queueContext.newPage();
  await queuePage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const firstQueuedTarget = await queuePage.locator(".claim-node").nth(0).getAttribute("data-claim-id");
  const latestQueuedTarget = await queuePage.locator(".claim-node").nth(1).getAttribute("data-claim-id");
  await queuePage.locator(".claim-node").nth(0).click();
  await queuePage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out");
  await queuePage.locator(".claim-node").nth(1).click();
  await queuePage.waitForFunction((claimId) => document.querySelector(".graph-stage")?.getAttribute("data-queued-claim") === claimId, latestQueuedTarget);
  await queuePage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId
    && document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle", latestQueuedTarget, { timeout: 6000 });
  report.latestSelectionQueue = Boolean(firstQueuedTarget && latestQueuedTarget && firstQueuedTarget !== latestQueuedTarget);
  await queueContext.close();

  const mobileDepthContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const mobileDepthPage = await mobileDepthContext.newPage();
  await mobileDepthPage.goto(`${origin}/`, { waitUntil: "load" });
  const mobileTarget = await mobileDepthPage.locator(".claim-node").first().getAttribute("data-claim-id");
  await mobileDepthPage.locator(".claim-node").first().click();
  await mobileDepthPage.waitForFunction((claimId) => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === claimId, mobileTarget);
  const mobileReserveCount = Number(await mobileDepthPage.locator(".graph-stage").getAttribute("data-reserve-count"));
  const mobileVisibleReserves = await mobileDepthPage.locator(".reserve-layers .reserve-node:visible").count();
  report.mobileReserveCap = mobileReserveCount === 8 && mobileVisibleReserves === 8;
  if (!report.mobileReserveCap) throw new Error(`Mobile reserve pool exposed ${mobileVisibleReserves} of ${mobileReserveCount} ghosts; expected exactly 8 visible.`);
  await mobileDepthContext.close();

  const mobileMotionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  const mobileMotionPage = await mobileMotionContext.newPage();
  await mobileMotionPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const mobileReserveOrigins = new Set(await mobileMotionPage.locator(".reserve-layers .reserve-node:visible").evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return `${style.getPropertyValue("--x").trim()}|${style.getPropertyValue("--y").trim()}`;
  })));
  await mobileMotionPage.locator(".claim-node").first().click();
  type MobileNodeGeometry = { claimId: string | null; distance: number; centerX: number; centerY: number; targetX: number; targetY: number };
  const mobileTransitionSamples: Array<{ phase: string | null; incomingFrame: number | null; labeledNodes: number; advancingReserves: number; incomingLabelOpacity: number | null; mobileMapOpacity: number; incomingOrigins: string[]; nodeGeometry: MobileNodeGeometry[] }> = [];
  let incomingFrame = 0;
  for (let sample = 0; sample < 30; sample += 1) {
    const transitionSample = await mobileMotionPage.evaluate(() => {
      const incoming = document.querySelector<HTMLElement>('.claim-node[data-node-role="incoming"]');
      const stageRect = document.querySelector<HTMLElement>(".graph-stage")!.getBoundingClientRect();
      return {
        phase: document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") ?? null,
        labeledNodes: [...document.querySelectorAll<HTMLElement>(".claim-node")].filter((node) => getComputedStyle(node).display !== "none").length,
        advancingReserves: document.querySelectorAll(".transition-reserves .reserve-node--advancing").length,
        incomingLabelOpacity: incoming ? Number(getComputedStyle(incoming.querySelector("strong")!).opacity) : null,
        mobileMapOpacity: Number(getComputedStyle(document.querySelector(".mobile-relationship-map")!).opacity),
        incomingOrigins: [...document.querySelectorAll<HTMLElement>('.claim-node[data-node-role="incoming"]')]
          .filter((node) => getComputedStyle(node).display !== "none")
          .map((node) => {
            const style = getComputedStyle(node);
            return `${style.getPropertyValue("--mobile-from-x").trim()}|${style.getPropertyValue("--mobile-from-y").trim()}`;
          }),
        nodeGeometry: [...document.querySelectorAll<HTMLElement>(".claim-node")]
          .filter((node) => getComputedStyle(node).display !== "none")
          .map((node) => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            const targetX = stageRect.left + stageRect.width * Number.parseFloat(style.getPropertyValue("--mobile-x")) / 100;
            const targetY = stageRect.top + stageRect.height * Number.parseFloat(style.getPropertyValue("--mobile-y")) / 100;
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            return { claimId: node.getAttribute("data-claim-id"), distance: Math.hypot(centerX - targetX, centerY - targetY), centerX, centerY, targetX, targetY };
          }),
      };
    });
    mobileTransitionSamples.push({ ...transitionSample, incomingFrame: transitionSample.phase === "in" ? incomingFrame++ : null });
    if (transitionSample.phase === "in" && report.mobileTransitionScreenshots.length === 0) {
      const mobileTransitionIn = join(outputDirectory, "mobile-transition-in.png");
      await mobileMotionPage.screenshot({ path: mobileTransitionIn });
      report.mobileTransitionScreenshots.push(mobileTransitionIn);
    }
    if (transitionSample.phase === "reposition" && report.mobileTransitionScreenshots.length === 1) {
      const mobileTransitionReposition = join(outputDirectory, "mobile-transition-reposition.png");
      await mobileMotionPage.screenshot({ path: mobileTransitionReposition });
      report.mobileTransitionScreenshots.push(mobileTransitionReposition);
    }
    await mobileMotionPage.waitForTimeout(80);
  }
  report.mobileTransitionNodeCeiling = mobileTransitionSamples.every((sample) => sample.labeledNodes === 3)
    && mobileTransitionSamples.every((sample) => sample.phase !== "in" || sample.advancingReserves === 0);
  if (!report.mobileTransitionNodeCeiling) throw new Error(`Mobile transition exposed duplicate node actors: ${JSON.stringify(mobileTransitionSamples)}.`);
  const travelingSamples = mobileTransitionSamples.filter((sample) => sample.phase === "in" && sample.incomingFrame !== null && sample.incomingFrame < 4);
  report.mobileTransitionSync = travelingSamples.length > 0
    && travelingSamples.every((sample) => (sample.incomingLabelOpacity ?? 1) <= .05 && sample.mobileMapOpacity <= .05);
  if (!report.mobileTransitionSync) throw new Error(`Mobile labels or settled connections appeared before incoming nodes arrived: ${JSON.stringify(mobileTransitionSamples)}.`);
  const incomingOrigins = new Set(mobileTransitionSamples.flatMap((sample) => sample.incomingOrigins));
  report.mobileSpatialContinuity = incomingOrigins.size > 0 && [...incomingOrigins].every((origin) => mobileReserveOrigins.has(origin));
  if (!report.mobileSpatialContinuity) throw new Error(`Mobile incoming nodes did not originate at visible pre-click reserve bubbles: ${JSON.stringify({ mobileReserveOrigins: [...mobileReserveOrigins], incomingOrigins: [...incomingOrigins] })}.`);
  const repositionSamples = mobileTransitionSamples.filter((sample) => sample.phase === "reposition");
  const firstRepositionGeometry = repositionSamples[0]?.nodeGeometry ?? [];
  const lastRepositionGeometry = repositionSamples.at(-1)?.nodeGeometry ?? [];
  report.mobileRepositionPhase = repositionSamples.length >= 2
    && firstRepositionGeometry.some((node) => node.distance > 1 && node.distance <= 18)
    && lastRepositionGeometry.every((node) => node.distance <= 1.25);
  if (!report.mobileRepositionPhase) throw new Error(`Mobile nodes did not use the bounded finishing slide: ${JSON.stringify(repositionSamples)}.`);
  await mobileMotionPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle");
  await mobileMotionPage.waitForFunction(() => [...document.querySelectorAll<HTMLElement>(".claim-node")]
    .filter((node) => getComputedStyle(node).display !== "none")
    .every((node) => Number(getComputedStyle(node.querySelector("strong")!).opacity) > .9));
  const settledGeometry = await mobileMotionPage.evaluate(() => {
    const stageRect = document.querySelector<HTMLElement>(".graph-stage")!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>(".claim-node")]
      .filter((node) => getComputedStyle(node).display !== "none")
      .map((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const targetX = stageRect.left + stageRect.width * Number.parseFloat(style.getPropertyValue("--mobile-x")) / 100;
        const targetY = stageRect.top + stageRect.height * Number.parseFloat(style.getPropertyValue("--mobile-y")) / 100;
        return { claimId: node.getAttribute("data-claim-id"), distance: Math.hypot(rect.left + rect.width / 2 - targetX, rect.top + rect.height / 2 - targetY) };
      });
  });
  report.mobileRestingSlotMath = settledGeometry.length === 3 && settledGeometry.every((node) => node.distance <= 1.25);
  if (!report.mobileRestingSlotMath) throw new Error(`Mobile nodes did not settle on their assigned slot centers: ${JSON.stringify(settledGeometry)}.`);
  const mobileTransitionSettled = join(outputDirectory, "mobile-transition-settled.png");
  await mobileMotionPage.screenshot({ path: mobileTransitionSettled });
  report.mobileTransitionScreenshots.push(mobileTransitionSettled);
  await mobileMotionContext.close();

  const mobileSearchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  const mobileSearchPage = await mobileSearchContext.newPage();
  await mobileSearchPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await mobileSearchPage.locator(".mobile-search-toggle").click();
  await mobileSearchPage.locator(".search-field input").fill("How Google Does Machine Learning");
  const searchReserveOrigins = new Set(await mobileSearchPage.locator(".reserve-layers .reserve-node:visible").evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return `${style.getPropertyValue("--x").trim()}|${style.getPropertyValue("--y").trim()}`;
  })));
  await mobileSearchPage.locator(".search-field input").press("Enter");
  await mobileSearchPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "in");
  const searchIncomingOrigins = await mobileSearchPage.locator('.claim-node[data-node-role="incoming"]:visible').evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return `${style.getPropertyValue("--mobile-from-x").trim()}|${style.getPropertyValue("--mobile-from-y").trim()}`;
  }));
  report.mobileSearchSpatialContinuity = searchIncomingOrigins.length > 0
    && searchIncomingOrigins.every((origin) => searchReserveOrigins.has(origin));
  if (!report.mobileSearchSpatialContinuity) throw new Error(`Mobile search spawned incoming nodes without visible reserve origins: ${JSON.stringify({ searchReserveOrigins: [...searchReserveOrigins], searchIncomingOrigins })}.`);
  const mobileSearchTransition = join(outputDirectory, "mobile-search-transition-in.png");
  await mobileSearchPage.screenshot({ path: mobileSearchTransition });
  report.mobileTransitionScreenshots.push(mobileSearchTransition);
  await mobileSearchPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle");
  await mobileSearchPage.waitForFunction(() => [...document.querySelectorAll<HTMLElement>(".claim-node")]
    .filter((node) => getComputedStyle(node).display !== "none")
    .every((node) => Number(getComputedStyle(node.querySelector("strong")!).opacity) > .9));
  if (await mobileSearchPage.locator(".experience-focus").getAttribute("data-selected-id") !== "claim-how-google-does-machine-learning") throw new Error("Mobile search did not settle on How Google Does Machine Learning.");
  const mobileSearchSettled = join(outputDirectory, "mobile-search-transition-settled.png");
  await mobileSearchPage.screenshot({ path: mobileSearchSettled });
  report.mobileTransitionScreenshots.push(mobileSearchSettled);
  await mobileSearchContext.close();

  const mobileSimilarContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  const mobileSimilarPage = await mobileSimilarContext.newPage();
  await mobileSimilarPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const similarReserveOrigins = new Set(await mobileSimilarPage.locator(".reserve-layers .reserve-node:visible").evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return `${style.getPropertyValue("--x").trim()}|${style.getPropertyValue("--y").trim()}`;
  })));
  await mobileSimilarPage.locator(".detail-actions--dock .button--secondary").click();
  await mobileSimilarPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "in");
  const similarIncomingOrigins = await mobileSimilarPage.locator('.claim-node[data-node-role="incoming"]:visible').evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return `${style.getPropertyValue("--mobile-from-x").trim()}|${style.getPropertyValue("--mobile-from-y").trim()}`;
  }));
  report.mobileSimilarSpatialContinuity = similarIncomingOrigins.length > 0
    && similarIncomingOrigins.every((origin) => similarReserveOrigins.has(origin));
  if (!report.mobileSimilarSpatialContinuity) throw new Error(`Mobile Similar Work spawned incoming nodes without visible reserve origins: ${JSON.stringify({ similarReserveOrigins: [...similarReserveOrigins], similarIncomingOrigins })}.`);
  await mobileSimilarContext.close();

  const relationshipContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "reduce" });
  const relationshipPage = await relationshipContext.newPage();
  await relationshipPage.goto(`${origin}/`, { waitUntil: "load" });
  await relationshipPage.locator('[data-claim-id="claim-operations-company-integration-specialist"].claim-node').click();
  await relationshipPage.waitForFunction(() => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === "claim-operations-company-integration-specialist"
    && document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle"
    && [...document.querySelectorAll<HTMLElement>(".claim-node")].length === 5
    && [...document.querySelectorAll<HTMLElement>(".claim-node")].every((node) => node.innerText.trim() && Number(getComputedStyle(node).opacity) > .9)
    && [...document.querySelectorAll<HTMLElement>(".claim-node strong, .claim-node small")].every((node) => Number(getComputedStyle(node).opacity) > .9));
  const masgloBridge = relationshipPage.locator('[data-claim-id="claim-masglo-commercial-proposal"].claim-node');
  if (!await masgloBridge.isVisible()) throw new Error("Integration Specialist did not reveal the Masglo relationship bridge.");
  const integrationBridgeScreenshot = join(outputDirectory, "integration-specialist-masglo-bridge.png");
  await relationshipPage.screenshot({ path: integrationBridgeScreenshot });
  report.relationshipBridgeScreenshots.push(integrationBridgeScreenshot);
  await masgloBridge.click();
  await relationshipPage.waitForFunction(() => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === "claim-masglo-commercial-proposal"
    && document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle"
    && [...document.querySelectorAll<HTMLElement>(".claim-node")].length === 5
    && [...document.querySelectorAll<HTMLElement>(".claim-node")].every((node) => node.innerText.trim() && Number(getComputedStyle(node).opacity) > .9)
    && [...document.querySelectorAll<HTMLElement>(".claim-node strong, .claim-node small")].every((node) => Number(getComputedStyle(node).opacity) > .9));
  const aiNeighborhood = new Set(await relationshipPage.locator(".claim-node").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-claim-id"))));
  const semanticAiNeighborhood = [
    "claim-operations-company-integration-specialist",
    "claim-professional-ai-text-completion",
    "claim-google-cloud-big-data-course",
    "claim-how-google-does-machine-learning",
    "claim-mai-full-stack-developer",
  ];
  const semanticMatches = semanticAiNeighborhood.filter((claimId) => aiNeighborhood.has(claimId));
  const traversalBridge = "claim-computer-science-studies";
  report.relationshipBridge = aiNeighborhood.size === 5 && semanticMatches.length >= 4 && aiNeighborhood.has(traversalBridge);
  if (!report.relationshipBridge) throw new Error(`Masglo did not preserve a strong AI neighborhood plus its traversal bridge: ${[...aiNeighborhood].join(", ")}`);
  const masgloAiScreenshot = join(outputDirectory, "masglo-ai-neighborhood.png");
  await relationshipPage.screenshot({ path: masgloAiScreenshot });
  report.relationshipBridgeScreenshots.push(masgloAiScreenshot);
  await relationshipContext.close();

  const searchContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const searchPage = await searchContext.newPage();
  await searchPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await searchPage.waitForFunction(() => Boolean(sessionStorage.getItem("resumilio:discovery:v1")));
  const signalCountBeforeTyping = await searchPage.evaluate(() => JSON.parse(sessionStorage.getItem("resumilio:discovery:v1") ?? "{}").signalCount ?? 0);
  await searchPage.locator(".search-field input").fill("Backend Technical Lead");
  const searchTarget = await searchPage.locator(".claim-node").first().getAttribute("data-claim-id");
  const signalCountAfterTyping = await searchPage.evaluate(() => JSON.parse(sessionStorage.getItem("resumilio:discovery:v1") ?? "{}").signalCount ?? 0);
  const visibleSearchNodes = await searchPage.locator(".claim-node").count();
  const searchLayerCount = Number(await searchPage.locator(".graph-stage").getAttribute("data-layer-count"));
  if (signalCountBeforeTyping !== signalCountAfterTyping || visibleSearchNodes !== searchLayerCount) throw new Error("Typing a search changed discovery state or failed to preload its visible result layers.");
  await searchPage.locator(".search-controls").press("Enter");
  await searchPage.waitForFunction((claimId) => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out"
    && document.querySelector(".graph-stage")?.getAttribute("data-transition-target") === claimId, searchTarget);
  report.searchLayerTransition = true;
  await searchContext.close();

  const similarContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, reducedMotion: "no-preference" });
  const similarPage = await similarContext.newPage();
  await similarPage.goto(`${origin}/`, { waitUntil: "networkidle" });
  await similarPage.locator(".detail-actions--dock .button--secondary").click();
  await similarPage.waitForFunction(() => document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "out"
    && Boolean(document.querySelector(".graph-stage")?.getAttribute("data-transition-target")));
  report.similarWorkLayerTransition = true;
  await similarContext.close();

  const showcaseContext = await browser.newContext({ viewport: { width: 744, height: 554 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const showcasePage = await showcaseContext.newPage();
  await showcasePage.goto(`${origin}/`, { waitUntil: "networkidle" });
  const initialShowcase = await showcasePage.locator(".experience-focus .detail-status").first().evaluate((node) => ({
    kind: node.getAttribute("data-showcase-kind"),
    label: node.textContent?.trim(),
    tag: node.tagName,
    href: node.getAttribute("href"),
  }));
  const initialBorderColors = new Set(await showcasePage.locator(".claim-node:visible").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).borderColor)));
  await showcasePage.locator(".search-field input").fill("Leaf Town");
  await showcasePage.locator(".search-controls").press("Enter");
  await showcasePage.waitForFunction(() => document.querySelector(".experience-focus")?.getAttribute("data-selected-id") === "claim-leaf-town"
    && document.querySelector(".graph-stage")?.getAttribute("data-transition-phase") === "idle");
  const liveShowcase = await showcasePage.locator(".experience-focus .detail-status").first().evaluate((node) => ({
    kind: node.getAttribute("data-showcase-kind"),
    label: node.textContent?.trim(),
    tag: node.tagName,
    href: node.getAttribute("href"),
  }));
  const showcaseScreenshot = join(outputDirectory, "showcase-live-demo-744x554.png");
  await showcasePage.screenshot({ path: showcaseScreenshot });
  showcasePresentation = initialShowcase.kind === "professional-role"
    && initialShowcase.label === "Professional role"
    && initialShowcase.tag === "A"
    && initialShowcase.href?.startsWith("https://") === true
    && initialBorderColors.size >= 2
    && liveShowcase.kind === "live-demo"
    && liveShowcase.label === "Live demo"
    && liveShowcase.tag === "A"
    && liveShowcase.href === "https://dnxgaming.itch.io/leaf-town";
  Object.assign(report, { showcasePresentation, showcaseScreenshot });
  if (!showcasePresentation) throw new Error(`Showcase states were not useful, linked, or color-distinct: ${JSON.stringify({ initialShowcase, initialBorderColors: [...initialBorderColors], liveShowcase })}.`);
  await showcaseContext.close();

  if (report.externalRequests.length > 0) throw new Error(`External runtime requests detected: ${report.externalRequests.join(", ")}`);
  if (!report.keyboard || !report.reactiveNeighborhood || !report.relationshipBridge || !report.layerPreload || !report.backgroundConstellation || !report.backgroundShift || !report.sharedNodeIdentity || !report.previousCenterHandoff || !report.incomingReserveMotion || !report.singleOwnerTransition || !report.mobileTransitionNodeCeiling || !report.mobileTransitionSync || !report.mobileSpatialContinuity || !report.mobileRepositionPhase || !report.mobileRestingSlotMath || !report.mobileSearchSpatialContinuity || !report.mobileSimilarSpatialContinuity || !report.outgoingRetreat || !report.latestSelectionQueue || !report.searchLayerTransition || !report.similarWorkLayerTransition || !report.mobileReserveCap || !report.localizedResponsiveLabels || !report.boundedPreview || !report.nodeTransition || !report.experienceLinkNewTab || !report.classicSectionsCollapsible || !report.classicLoadMore || !report.avatarReactions || !report.avatarPlayback || !report.immediateIdlePlayback || !report.welcomeAfterLoad || !report.ambientAvatarMix || !report.avatarInteractionPriority || !report.guideCooldown || !report.crossfade || !report.framing || !report.resetSkipsWelcome || !report.wideAvatarPlacement || !report.responsiveAvatar || !report.assistiveTechnologyStructureSmoke || !report.reducedMotion) throw new Error("One or more interaction or accessibility structure smoke checks failed.");
  if (report.evidencePageScriptRequests > 0) throw new Error("Static evidence pages loaded JavaScript.");
  writeFileSync(join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
