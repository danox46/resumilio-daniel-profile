import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { pickAmbientAvatarReaction, pickGuideCooldownMs, shouldStartGuide, shouldStartWelcome, type AvatarLayout, type AvatarPlayback } from "../avatar-schedule.js";
import {
  buildLayerPlan,
  buildSuccessorLayer,
  constellationFocus,
  constellationSlots,
  mobileConstellationSlots,
  mobileReservePool,
  type ConstellationDrift,
  type ConstellationPoint,
  type SuccessorLayerPlan,
} from "../constellation-layers.js";
import {
  applySignal,
  constellationNeighborhoodSize,
  emptyDiscoveryState,
  mobileConstellationNeighborhoodSize,
  normalizeTerm,
  rankConstellationRecommendations,
  searchClaims,
  type DiscoveryState,
} from "../discovery.js";
import type { Locale, ResumilioProfile } from "../profile.js";
import { marketClaimSummary, marketEvidenceTitle } from "../presentation.js";
import { claimShowcase, claimShowcases } from "../showcase.js";
import { classicClaimPath, localeRoot, withBase } from "../site.js";
import AvatarGuide from "./AvatarGuide.js";

const sessionKey = "resumilio:discovery:v1";
const visibleNeighborhoodSize = constellationNeighborhoodSize;
type Claim = ResumilioProfile["claims"][number];
type InteractiveAvatarReaction = "nod" | "smile";
type TransitionPhase = "idle" | "out" | "in" | "reposition";
type SelectionSignal = { kind: "search" | "more-like-this"; topics: string[]; claimId?: string };
type SelectionIntent = { claimId: string; reaction: "guide" | "smile"; precedingSignal?: SelectionSignal };
type ActiveTransition = {
  phase: Exclude<TransitionPhase, "idle">;
  layer: SuccessorLayerPlan;
  fromSelectedId: string;
  fromNeighborhoodIds: string[];
};
type TransitionState = { phase: "idle" } | ActiveTransition;
type RetiredNode = { claimId: string; point: ConstellationPoint };
const stackedAvatarQuery = "(max-width: 700px)";
const transitionCommitMs = 864;
const transitionRepositionMs = 1_728;
const transitionSettleMs = 2_208;
const minimumBackgroundNodeCount = 15;

const copy = {
  en: {
    eyebrow: "Constellation of experience",
    placeholder: "Search roles, skills, or projects",
    search: "Search experience",
    selected: "Selected experience",
    view: "Classic View",
    more: "Similar Work",
    reset: "Reset",
    empty: "No experience matches that search. Try a skill, company, or project.",
    graphHelp: "A small set of related experience appears at a time. Select a circle to reform the constellation around it. Use arrow keys to move between visible circles.",
    neighborhood: "Related experience",
    about: "About Resumilio",
  },
  es: {
    eyebrow: "Constelación de experiencia",
    placeholder: "Busca cargos, habilidades o proyectos",
    search: "Buscar experiencia",
    selected: "Experiencia seleccionada",
    view: "Vista clásica",
    more: "Trabajo similar",
    reset: "Reiniciar",
    empty: "No encontramos experiencia con esa búsqueda. Prueba una habilidad, empresa o proyecto.",
    graphHelp: "Mostramos un grupo pequeño de experiencia relacionada. Elige un círculo para reorganizar la constelación. Usa las flechas para recorrer los círculos visibles.",
    neighborhood: "Experiencia relacionada",
    about: "Sobre Resumilio",
  },
} as const;

const featuredClaimIds = [
  "claim-alphahub-hubspot-specialist",
  "claim-operations-company-integration-specialist",
  "claim-on-the-fuze-backend-lead",
  "claim-professional-ai-text-completion",
  "claim-hubspot-sms-app",
  "claim-mai-full-stack-developer",
  "claim-masglo-commercial-proposal",
  "claim-computer-science-studies",
];

const decorativeNodes: Array<{ point: [number, number]; size: number; tone: "quiet" | "outlined" }> = [
  { point: [4, 18], size: 144, tone: "quiet" },
  { point: [97, 18], size: 210, tone: "outlined" },
  { point: [94, 64], size: 310, tone: "quiet" },
];

const perimeterEdges: Array<{ key: string; from: ConstellationPoint; to: ConstellationPoint; avatar?: boolean }> = [
  { key: "north-west-anchor", from: [4, 18], to: constellationSlots[1].point },
  { key: "north-east-anchor", from: [97, 18], to: constellationSlots[2].point },
  { key: "south-east-anchor", from: [94, 64], to: constellationSlots[4].point },
  { key: "avatar-anchor", from: [13, 82], to: constellationSlots[3].point, avatar: true },
];

const depthEchoOrigins: Array<{ point: ConstellationPoint; scale: number }> = [
  { point: [9, 9], scale: .54 },
  { point: [5, 52], scale: .57 },
  { point: [18, 27], scale: .7 },
  { point: [27, 8], scale: .46 },
  { point: [43, 18], scale: .62 },
  { point: [58, 7], scale: .52 },
  { point: [73, 15], scale: .68 },
  { point: [88, 8], scale: .48 },
  { point: [92, 43], scale: .58 },
  { point: [89, 88], scale: .72 },
  { point: [73, 94], scale: .5 },
  { point: [58, 91], scale: .66 },
  { point: [44, 95], scale: .47 },
  { point: [29, 89], scale: .61 },
  { point: [12, 92], scale: .53 },
];

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (const character of value) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return (hash >>> 0) % length;
}

function graphTitle(title: string) { return title.split(" — ")[0]; }
function previewText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength).trimEnd();
  const bounded = /\s/.test(value[maxLength] ?? "") ? slice : slice.replace(/\s+\S*$/, "");
  return `${bounded || slice}…`;
}
function nodeTitle(title: string) {
  const clean = graphTitle(title);
  if (clean.length <= 42) return clean;
  return `${clean.slice(0, 39).replace(/\s+\S*$/, "")}…`;
}
function organizationFor(profile: ResumilioProfile, claim: Claim) {
  return claim.organizationId ? profile.organizations.find((item) => item.id === claim.organizationId) : undefined;
}
function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>;
}
function ResetIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5"/><path d="M5.8 17.2A8 8 0 1 0 4.3 9"/></svg>;
}
function ExternalLinkIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 6 10"/><path d="M11 9v4H3V5h4"/></svg>;
}
function ClaimActions({ claim, locale, onMoreLike }: {
  claim: Claim; locale: Locale; onMoreLike: () => void;
}) {
  const t = copy[locale];
  return <div className="detail-actions detail-actions--dock" aria-label={t.selected}>
    <a className="button button--primary" href={classicClaimPath(claim.id, locale)} target="_blank" rel="noopener noreferrer">{t.view}</a>
    <button className="button button--secondary" type="button" onClick={onMoreLike}>{t.more}</button>
  </div>;
}

function ClaimDetail({ profile, claim, locale }: {
  profile: ResumilioProfile; claim: Claim; locale: Locale;
}) {
  const t = copy[locale];
  const organization = organizationFor(profile, claim);
  const title = graphTitle(claim.title[locale]);
  const summary = marketClaimSummary(claim, locale);
  const previewTitle = previewText(title, 44);
  const previewSummary = previewText(summary, 126);
  const detailDensity = title.length > 28 || summary.length > 190 ? " claim-detail--dense" : "";
  const showcases = claimShowcases(profile, claim, locale);
  return <section className={`claim-detail${detailDensity}`} aria-label={`${t.selected}: ${claim.title[locale]}`} aria-live="polite">
    <h2 aria-label={title} title={title}>{previewTitle}</h2>
    {organization && <p className="detail-organization">{organization.name[locale]}</p>}
    <div className="detail-statuses">{showcases.map((showcase) => showcase.href
      ? <a key={`${showcase.kind}:${showcase.href}`} className="detail-status detail-status--linked" data-showcase-kind={showcase.kind} href={showcase.href} target="_blank" rel="noopener noreferrer">{showcase.label}<ExternalLinkIcon/></a>
      : <span key={showcase.kind} className="detail-status" data-showcase-kind={showcase.kind}>{showcase.label}</span>)}</div>
    <p className="detail-summary" aria-label={summary} title={summary}>{previewSummary}</p>
  </section>;
}

export default function EvidenceExplorer({ profile, initialLocale = profile.profile.defaultLocale }: { profile: ResumilioProfile; initialLocale?: Locale }) {
  const defaultClaimId = profile.claims.find((claim) => claim.id === featuredClaimIds[0])?.id ?? profile.claims[0].id;
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [selectedId, setSelectedId] = useState(defaultClaimId);
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveryState>(emptyDiscoveryState);
  const [storageReady, setStorageReady] = useState(false);
  const [avatarLayout, setAvatarLayout] = useState<AvatarLayout>("wide");
  const [avatar, setAvatar] = useState<AvatarPlayback>({ reaction: "idle", sequence: 0, mode: "loading" });
  const avatarRef = useRef(avatar);
  const guideCooldownUntil = useRef(0);
  const welcomeHandled = useRef(false);
  const [slotByClaimId, setSlotByClaimId] = useState<Record<string, number>>({});
  const [mobileSlotByClaimId, setMobileSlotByClaimId] = useState<Record<string, number>>({});
  const [transition, setTransition] = useState<TransitionState>({ phase: "idle" });
  const [queuedSelection, setQueuedSelection] = useState<SelectionIntent>();
  const [retiredNodes, setRetiredNodes] = useState<RetiredNode[]>([]);
  const [hasTransitioned, setHasTransitioned] = useState(false);
  const transitionTimers = useRef<number[]>([]);
  const requestSelectionRef = useRef<(intent: SelectionIntent) => void>(() => undefined);
  const t = copy[locale];

  useEffect(() => {
    try { const stored = sessionStorage.getItem(sessionKey); if (stored) setDiscovery(JSON.parse(stored) as DiscoveryState); }
    catch { /* Session adaptation remains optional. */ }
    setStorageReady(true);
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { sessionStorage.setItem(sessionKey, JSON.stringify(discovery)); } catch { /* Keep the public experience usable. */ }
  }, [discovery, storageReady]);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => () => transitionTimers.current.forEach((timer) => window.clearTimeout(timer)), []);
  useEffect(() => {
    const media = window.matchMedia(stackedAvatarQuery);
    const syncLayout = () => setAvatarLayout(media.matches ? "stacked" : "wide");
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  const signal = useCallback((kind: Parameters<typeof applySignal>[1], topics: string[], claimId?: string) => {
    setDiscovery((current) => applySignal(current, kind, topics, claimId));
  }, []);
  const commitAvatar = useCallback((reaction: AvatarPlayback["reaction"], mode: AvatarPlayback["mode"]) => {
    const next = { reaction, mode, sequence: avatarRef.current.sequence + 1 };
    avatarRef.current = next;
    setAvatar(next);
  }, []);
  const beginGuideCooldown = useCallback(() => {
    guideCooldownUntil.current = Date.now() + pickGuideCooldownMs();
  }, []);
  const showReaction = useCallback((reaction: InteractiveAvatarReaction) => {
    if (avatarRef.current.mode === "interactive" && avatarRef.current.reaction === "guide") beginGuideCooldown();
    commitAvatar(reaction, "interactive");
  }, [beginGuideCooldown, commitAvatar]);
  const showGuide = useCallback(() => {
    if (!shouldStartGuide(avatarRef.current, Date.now(), guideCooldownUntil.current)) return false;
    commitAvatar("guide", "interactive");
    return true;
  }, [commitAvatar]);
  const advanceAmbientReaction = useCallback(() => {
    commitAvatar(pickAmbientAvatarReaction(), "ambient");
  }, [commitAvatar]);
  const acknowledgeNode = useCallback(() => {
    if (avatarRef.current.mode !== "interactive") showReaction("nod");
  }, [showReaction]);
  const resetAvatar = useCallback(() => {
    welcomeHandled.current = true;
    guideCooldownUntil.current = 0;
    commitAvatar("idle", "ambient");
  }, [commitAvatar]);
  const completeAvatarReaction = useCallback((sequence: number) => {
    const current = avatarRef.current;
    if (current.sequence !== sequence) return;
    if (current.mode === "loading") {
      commitAvatar("idle", "loading");
      return;
    }
    if (current.mode === "interactive" && current.reaction === "guide") beginGuideCooldown();
    advanceAmbientReaction();
  }, [advanceAmbientReaction, beginGuideCooldown, commitAvatar]);
  useEffect(() => {
    let listening = true;
    const announceReady = () => {
      if (!listening) return;
      const handled = welcomeHandled.current;
      welcomeHandled.current = true;
      if (shouldStartWelcome(avatarRef.current, handled)) commitAvatar("smile", "welcome");
    };
    if (document.readyState === "complete") queueMicrotask(announceReady);
    else window.addEventListener("load", announceReady, { once: true });
    return () => { listening = false; window.removeEventListener("load", announceReady); };
  }, [commitAvatar]);

  const selected = profile.claims.find((claim) => claim.id === selectedId) ?? profile.claims[0];
  useEffect(() => {
    if (transition.phase !== "idle") return;
    const timer = window.setTimeout(() => signal("dwell", selected.tags, selected.id), 8000);
    return () => window.clearTimeout(timer);
  }, [selected.id, selected.tags, signal, transition.phase]);

  const normalizedQuery = useMemo(() => normalizeTerm(query), [query]);
  const queryTopics = useMemo(() => normalizedQuery.split(" ").filter(Boolean), [normalizedQuery]);
  const planningDiscovery = useMemo(
    () => normalizedQuery ? applySignal(discovery, "search", queryTopics) : discovery,
    [discovery, normalizedQuery, queryTopics],
  );
  const neighborhood = useMemo(() => {
    if (normalizedQuery) {
      return searchClaims(profile, normalizedQuery).map((result) => result.claim).filter((claim) => claim.id !== selected.id).slice(0, visibleNeighborhoodSize);
    }
    const contextualState = applySignal(discovery, "open", selected.tags, selected.id);
    return rankConstellationRecommendations(profile, contextualState, selected.id, visibleNeighborhoodSize).map((result) => result.claim);
  }, [profile, normalizedQuery, selected.id, selected.tags, discovery]);
  const neighborhoodIds = useMemo(() => neighborhood.map((claim) => claim.id), [neighborhood]);
  const layerPlan = useMemo(
    () => buildLayerPlan(profile, planningDiscovery, selected.id, neighborhoodIds, slotByClaimId, mobileSlotByClaimId),
    [profile, planningDiscovery, selected.id, neighborhoodIds, slotByClaimId, mobileSlotByClaimId],
  );

  const requestSelection = useCallback((intent: SelectionIntent) => {
    const claim = profile.claims.find((candidate) => candidate.id === intent.claimId);
    if (!claim) return;
    if (transition.phase !== "idle") {
      setQueuedSelection(intent);
      return;
    }

    let discoveryBeforeOpen = discovery;
    if (intent.precedingSignal) {
      discoveryBeforeOpen = applySignal(
        discoveryBeforeOpen,
        intent.precedingSignal.kind,
        intent.precedingSignal.topics,
        intent.precedingSignal.claimId,
      );
    }
    if (claim.id === selected.id) {
      if (intent.precedingSignal) setDiscovery(discoveryBeforeOpen);
      setQuery("");
      showReaction("smile");
      return;
    }

    const preloaded = intent.precedingSignal?.kind === "more-like-this"
      ? undefined
      : layerPlan.successors.find((candidate) => candidate.targetId === claim.id);
    const layer = preloaded ?? buildSuccessorLayer(
      profile,
      discoveryBeforeOpen,
      selected.id,
      neighborhoodIds,
      layerPlan.slotByClaimId,
      claim.id,
      layerPlan.mobileSlotByClaimId,
    );
    if (intent.reaction === "guide") showGuide();
    else showReaction(intent.reaction);
    setHasTransitioned(true);
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDiscovery(layer.nextDiscovery);
      setSelectedId(claim.id);
      setQuery("");
      setSlotByClaimId(layer.nextSlotByClaimId);
      setMobileSlotByClaimId(layer.nextMobileSlotByClaimId);
      setRetiredNodes([]);
      setTransition({ phase: "idle" });
      return;
    }

    const snapshot: ActiveTransition = {
      phase: "out",
      layer,
      fromSelectedId: selected.id,
      fromNeighborhoodIds: [...neighborhoodIds],
    };
    setTransition(snapshot);
    transitionTimers.current = [
      window.setTimeout(() => {
        setDiscovery(layer.nextDiscovery);
        setSelectedId(claim.id);
        setQuery("");
        setSlotByClaimId(layer.nextSlotByClaimId);
        setMobileSlotByClaimId(layer.nextMobileSlotByClaimId);
        setTransition((current) => current.phase === "idle" ? current : { ...current, phase: "in" });
      }, transitionCommitMs),
      window.setTimeout(() => {
        setTransition((current) => current.phase === "idle" ? current : { ...current, phase: "reposition" });
      }, transitionRepositionMs),
      window.setTimeout(() => {
        const nextRetired = layer.outgoingIds.map((claimId) => ({ claimId, point: layer.retreatPointByClaimId[claimId] }));
        if (!layer.previousCenterRetained) nextRetired.push({ claimId: selected.id, point: [96, 88] });
        setRetiredNodes(nextRetired);
        setTransition({ phase: "idle" });
      }, transitionSettleMs),
    ];
  }, [discovery, layerPlan, neighborhoodIds, profile, selected.id, showGuide, showReaction, transition.phase]);
  useEffect(() => { requestSelectionRef.current = requestSelection; }, [requestSelection]);
  useEffect(() => {
    if (transition.phase !== "idle" || !queuedSelection) return;
    const next = queuedSelection;
    setQueuedSelection(undefined);
    requestSelectionRef.current(next);
  }, [queuedSelection, transition.phase]);

  const selectClaim = (claim: Claim, reaction: "guide" | "smile" = "guide") => requestSelection({ claimId: claim.id, reaction });
  const moveClaimFocus = (event: KeyboardEvent<HTMLButtonElement>, claim: Claim) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    const keyboardNeighborhood = avatarLayout === "stacked" ? neighborhood.slice(0, mobileConstellationNeighborhoodSize) : neighborhood;
    if (!keys.includes(event.key) || keyboardNeighborhood.length === 0) return;
    event.preventDefault();
    const current = Math.max(0, keyboardNeighborhood.findIndex((item) => item.id === claim.id));
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? keyboardNeighborhood.length - 1 : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + keyboardNeighborhood.length) % keyboardNeighborhood.length;
    document.getElementById(`claim-node-${keyboardNeighborhood[nextIndex].id}`)?.focus();
  };
  const moreLike = () => {
    const nextState = applySignal(discovery, "more-like-this", selected.tags, selected.id);
    const recommendations = rankConstellationRecommendations(profile, nextState, selected.id, visibleNeighborhoodSize);
    const recommendation = recommendations.find((item) => !nextState.openedClaimIds.includes(item.claim.id))?.claim
      ?? recommendations[0]?.claim;
    if (recommendation) requestSelection({
      claimId: recommendation.id,
      reaction: "smile",
      precedingSignal: { kind: "more-like-this", topics: selected.tags, claimId: selected.id },
    });
    else { setDiscovery(nextState); showReaction("smile"); }
  };
  const submitSearch = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const firstMatch = searchClaims(profile, query)[0]?.claim;
    const topics = normalizeTerm(query).split(" ").filter(Boolean);
    if (firstMatch) requestSelection({ claimId: firstMatch.id, reaction: "smile", precedingSignal: { kind: "search", topics } });
    else { setDiscovery((current) => applySignal(current, "search", topics)); showReaction("smile"); }
  };
  const reset = () => {
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer));
    setDiscovery(emptyDiscoveryState()); setQuery(""); setMobileSearchOpen(false); setSelectedId(defaultClaimId); setSlotByClaimId({}); setMobileSlotByClaimId({});
    setTransition({ phase: "idle" }); setQueuedSelection(undefined); setRetiredNodes([]); setHasTransitioned(false); resetAvatar();
    try { sessionStorage.removeItem(sessionKey); } catch { /* Nothing else to reset. */ }
  };
  const transitionLayer = transition.phase === "idle" ? undefined : transition.layer;
  const backgroundLayers = layerPlan.successors
    .filter((layer) => transition.phase !== "out" || layer.targetId !== transition.layer.targetId);
  const pointKey = (point: ConstellationPoint) => `${point[0]}:${point[1]}`;
  const transitionReserveOrigins = new Set(
    (avatarLayout === "stacked" ? transitionLayer?.mobileReserveNodes : transitionLayer?.reserveNodes)
      ?.map((node) => pointKey(node.origin)) ?? [],
  );
  const mobilePoolReserves = mobileReservePool.map((origin, index) => ({
    key: `mobile-pool:${index}`,
    ownerId: "mobile-reserve-pool",
    claimId: `mobile-reserve-${index}`,
    origin,
    scale: .5 + (index % 3) * .08,
  }));
  const backgroundReserves = (avatarLayout === "stacked"
    ? mobilePoolReserves
    : backgroundLayers.flatMap((layer) => layer.reserveNodes))
    .filter((node) => transition.phase === "idle" || !transitionReserveOrigins.has(pointKey(node.origin)));
  const echoStart = stableIndex(selectedId, depthEchoOrigins.length);
  const backgroundEchoes = Array.from({ length: Math.max(0, minimumBackgroundNodeCount - backgroundReserves.length) }, (_, index) => {
    const sourceIndex = (echoStart + index) % depthEchoOrigins.length;
    const source = depthEchoOrigins[sourceIndex];
    return { key: `echo:${selectedId}:${index}:${sourceIndex}`, point: source.point, scale: source.scale };
  });
  const backgroundEdges = avatarLayout === "stacked"
    ? backgroundReserves.map((node, nodeIndex) => ({
      key: `depth:${node.key}`,
      from: nodeIndex === 0 ? mobileReservePool[mobileReservePool.length - 1] : backgroundReserves[nodeIndex - 1].origin,
      to: node.origin,
      branchIndex: 0,
      nodeIndex,
    }))
    : backgroundLayers.flatMap((layer, branchIndex) => {
      const ownerSlot = constellationSlots[layerPlan.slotByClaimId[layer.targetId] ?? layer.targetSlot];
      return layer.reserveNodes.map((node, nodeIndex) => ({
        key: `depth:${node.key}`,
        from: nodeIndex === 0 ? ownerSlot.point : layer.reserveNodes[nodeIndex - 1].origin,
        to: node.origin,
        branchIndex,
        nodeIndex,
      }));
    });
  const backgroundEchoEdges = backgroundEchoes.map((node, index) => ({
    key: `edge:${node.key}`,
    from: index === 0 ? decorativeNodes[echoStart % decorativeNodes.length].point : backgroundEchoes[index - 1].point,
    to: node.point,
    nodeIndex: index,
  }));
  const transitioningReserves = avatarLayout === "stacked"
    ? transitionLayer?.mobileReserveNodes ?? []
    : transitionLayer?.reserveNodes ?? [];
  const transitionTargetPoint = transitionLayer
    ? avatarLayout === "stacked"
      ? mobileConstellationSlots[layerPlan.mobileSlotByClaimId[transitionLayer.targetId] ?? 0]?.point
      : constellationSlots[transitionLayer.targetSlot]?.point
    : constellationFocus;
  const depthFieldStyle = {
    "--field-shift-x": `${((constellationFocus[0] - transitionTargetPoint[0]) * .16).toFixed(2)}%`,
    "--field-shift-y": `${((constellationFocus[1] - transitionTargetPoint[1]) * .16).toFixed(2)}%`,
  } as CSSProperties;
  const queuedTargetOrigin = transition.phase !== "idle" && !transition.fromNeighborhoodIds.includes(transition.layer.targetId)
    ? retiredNodes.find((node) => node.claimId === transition.layer.targetId)?.point ?? [43, 5] as ConstellationPoint
    : undefined;
  const renderedNodes = neighborhood.map((claim, index) => {
    let slotIndex = layerPlan.slotByClaimId[claim.id] ?? index;
    let mobileSlotIndex = layerPlan.mobileSlotByClaimId[claim.id] ?? index % mobileConstellationSlots.length;
    let drift: ConstellationDrift = layerPlan.driftByClaimId[claim.id] ?? [0, 0];
    let role = hasTransitioned ? "settled" : "initial";
    const sharedIds = avatarLayout === "stacked" ? transitionLayer?.mobileSharedIds : transitionLayer?.sharedIds;
    const incomingIds = avatarLayout === "stacked" ? transitionLayer?.mobileIncomingIds : transitionLayer?.incomingIds;
    const outgoingIds = avatarLayout === "stacked" ? transitionLayer?.mobileOutgoingIds : transitionLayer?.outgoingIds;
    const previousCenterRetained = avatarLayout === "stacked"
      ? transitionLayer?.mobilePreviousCenterRetained
      : transitionLayer?.previousCenterRetained;
    if (transition.phase === "out") {
      if (transition.layer.targetId === claim.id) role = "selected-target";
      else if (outgoingIds?.includes(claim.id)) role = "outgoing";
      else if (sharedIds?.includes(claim.id)) {
        role = "shared";
        slotIndex = transition.layer.nextSlotByClaimId[claim.id];
        mobileSlotIndex = transition.layer.nextMobileSlotByClaimId[claim.id] ?? mobileSlotIndex;
        drift = transition.layer.nextDriftByClaimId[claim.id];
      }
    } else if (transition.phase === "in" || transition.phase === "reposition") {
      slotIndex = transition.layer.nextSlotByClaimId[claim.id] ?? slotIndex;
      mobileSlotIndex = transition.layer.nextMobileSlotByClaimId[claim.id] ?? mobileSlotIndex;
      drift = transition.layer.nextDriftByClaimId[claim.id] ?? drift;
      if (previousCenterRetained && claim.id === transition.fromSelectedId) role = "previous-center";
      else if (incomingIds?.includes(claim.id)) role = "incoming";
      else if (sharedIds?.includes(claim.id)) role = "shared";
    }
    const slot = constellationSlots[slotIndex] ?? constellationSlots[index];
    const mobileSlot = mobileConstellationSlots[mobileSlotIndex] ?? mobileConstellationSlots[index % mobileConstellationSlots.length];
    const reserveSource = transitionLayer?.reserveNodes.find((node) => node.claimId === claim.id);
    const mobileReserveSource = transitionLayer?.mobileReserveNodes.find((node) => node.claimId === claim.id);
    return { claim, slot, mobileSlot, drift, role, reserveSource, mobileReserveSource };
  });
  const visibleRenderedNodes = avatarLayout === "stacked" ? renderedNodes.slice(0, mobileConstellationNeighborhoodSize) : renderedNodes;

  return <div className="experience-shell">
    <header className="constellation-header">
      <a className="constellation-wordmark" href={localeRoot(locale)}><strong>{profile.profile.name[locale]}</strong><span>{profile.profile.headline[locale]}</span></a>
      <form className={`search-controls${mobileSearchOpen ? " search-controls--open" : ""}`} role="search" onSubmit={(event) => { submitSearch(event); setMobileSearchOpen(false); }}>
        <button className="mobile-search-toggle" type="button" aria-label={t.search} aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen((current) => !current)}><SearchIcon/></button>
        <label className="search-field"><span className="sr-only">{t.search}</span><SearchIcon/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder}/></label>
      </form>
      <div className="constellation-actions">
        <a className="resumilio-about-link" href={withBase(locale === "en" ? "/about/" : "/es/acerca/")}>{t.about}</a>
        <a className="locale-control" href={localeRoot(locale === "en" ? "es" : "en")} onClick={(event) => { event.preventDefault(); setLocale(locale === "en" ? "es" : "en"); }} aria-label={locale === "en" ? "Cambiar a español" : "Switch to English"}><strong className={locale === "en" ? "is-active" : ""}>EN</strong><span>/</span><strong className={locale === "es" ? "is-active" : ""}>ES</strong></a>
        <button className="reset-control" type="button" onClick={reset}><ResetIcon/><span>{t.reset}</span></button>
      </div>
    </header>

    <main className="constellation-main">
      <section className="constellation" aria-label={t.eyebrow} aria-describedby="graph-help">
        <p className="sr-only" id="graph-help">{t.graphHelp}</p>
        <div
          className="graph-stage"
          data-transition-phase={transition.phase}
          data-transition-target={transitionLayer?.targetId}
          data-layer-count={layerPlan.successors.length}
          data-reserve-count={backgroundReserves.length}
          data-queued-claim={queuedSelection?.claimId}
          aria-busy={transition.phase !== "idle"}
        >
          <div
            className="constellation-depth-field"
            data-background-node-count={backgroundReserves.length + backgroundEchoes.length}
            data-background-node-floor={minimumBackgroundNodeCount}
            data-background-edge-count={backgroundEdges.length + backgroundEchoEdges.length + perimeterEdges.length}
            style={depthFieldStyle}
            aria-hidden="true"
          >
            <div className="ambient-nodes" aria-hidden="true">
              {decorativeNodes.map((node, index) => <span key={index} className={`ambient-node ambient-node--${node.tone}`} style={{ "--x": `${node.point[0]}%`, "--y": `${node.point[1]}%`, "--size": `${node.size}px`, "--order": index } as CSSProperties}/>) }
              {retiredNodes.map((node, index) => <span key={`${node.claimId}:${index}`} className="retired-node" data-claim-id={node.claimId} style={{ "--x": `${node.point[0]}%`, "--y": `${node.point[1]}%`, "--order": index } as CSSProperties}/>) }
            </div>
            <svg className="background-constellation" viewBox="0 0 100 100" preserveAspectRatio="none">
              {perimeterEdges.map((edge) => <line
                key={edge.key}
                className={`background-edge background-edge--perimeter${edge.avatar ? " background-edge--avatar" : ""}`}
                x1={edge.from[0]} y1={edge.from[1]} x2={edge.to[0]} y2={edge.to[1]}
              />)}
              {backgroundEdges.map((edge) => <line
                key={edge.key}
                className="background-edge background-edge--reserve"
                x1={edge.from[0]} y1={edge.from[1]} x2={edge.to[0]} y2={edge.to[1]}
                style={{ "--edge-delay": `${244 + edge.branchIndex * 36 + edge.nodeIndex * 24}ms` } as CSSProperties}
              />)}
              {backgroundEchoEdges.map((edge) => <line
                key={edge.key}
                className="background-edge background-edge--echo"
                x1={edge.from[0]} y1={edge.from[1]} x2={edge.to[0]} y2={edge.to[1]}
                style={{ "--edge-delay": `${352 + edge.nodeIndex * 28}ms` } as CSSProperties}
              />)}
            </svg>
            <div className="reserve-layers" aria-hidden="true">
              {backgroundReserves.map((node, index) => <span
                key={node.key}
                className="reserve-node"
                data-reserve-owner={node.ownerId}
                data-claim-id={node.claimId}
                style={{
                  "--x": `${node.origin[0]}%`, "--y": `${node.origin[1]}%`,
                  "--reserve-scale": node.scale, "--order": index,
                } as CSSProperties}
              />)}
            </div>
            <div className="depth-echoes" aria-hidden="true">
              {backgroundEchoes.map((node, index) => <span
                key={node.key}
                className="depth-echo-node"
                style={{
                  "--x": `${node.point[0]}%`, "--y": `${node.point[1]}%`,
                  "--echo-scale": node.scale, "--order": backgroundReserves.length + index,
                } as CSSProperties}
              />)}
            </div>
          </div>
          {transition.phase === "out" && transitionLayer && <div className="transition-reserves" aria-hidden="true">
            {transitioningReserves.map((node, index) => <span
              key={`transition:${node.key}`}
              className="reserve-node reserve-node--advancing"
              data-reserve-owner={node.ownerId}
              data-claim-id={node.claimId}
              style={{
                "--from-x": `${node.origin[0]}%`, "--from-y": `${node.origin[1]}%`,
                "--to-x": `${node.destination[0]}%`, "--to-y": `${node.destination[1]}%`,
                "--drift-x": `${node.drift[0]}px`, "--drift-y": `${node.drift[1]}px`,
                "--reserve-scale": node.scale, "--order": index,
              } as CSSProperties}
            />)}
            {queuedTargetOrigin && <span className="queued-target-node" data-claim-id={transitionLayer.targetId} style={{
              "--from-x": `${queuedTargetOrigin[0]}%`, "--from-y": `${queuedTargetOrigin[1]}%`,
              "--to-x": `${constellationFocus[0]}%`, "--to-y": `${constellationFocus[1]}%`,
            } as CSSProperties}/>}
          </div>}
          <svg className="relationship-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {visibleRenderedNodes.flatMap(({ claim, slot }) => {
              return [
                <line key={`${claim.id}-wide`} x1={constellationFocus[0]} y1={constellationFocus[1]} x2={slot.point[0]} y2={slot.point[1]} className="relation relation--claim relation--wide"/>,
                <line key={`${claim.id}-mid`} x1="59" y1={constellationFocus[1]} x2={slot.midPoint[0]} y2={slot.midPoint[1]} className="relation relation--claim relation--mid"/>,
              ];
            })}
          </svg>
          <svg className="mobile-relationship-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="96,13 84,29 93,42 15,67 63,81 89,72"/>
            <circle cx="96" cy="13" r=".7"/>
            <circle cx="84" cy="29" r=".8"/>
            <circle cx="93" cy="42" r=".62"/>
            <circle cx="15" cy="67" r=".8"/>
            <circle cx="63" cy="81" r=".72"/>
            <circle cx="89" cy="72" r=".55"/>
          </svg>
          <AvatarGuide playback={avatar} layout={avatarLayout} onComplete={completeAvatarReaction}/>
          <div className="claim-graph" role="group" aria-label={t.neighborhood}>
            {visibleRenderedNodes.map(({ claim, slot, mobileSlot, drift, role, reserveSource, mobileReserveSource }, index) => {
              const fullTitle = graphTitle(claim.title[locale]);
              const visibleTitle = nodeTitle(claim.title[locale]);
              const textDensity = visibleTitle.length > 34 ? "dense" : visibleTitle.length > 24 ? "compact" : "standard";
              const showcase = claimShowcase(profile, claim, locale);
              const retreat = transitionLayer?.retreatPointByClaimId[claim.id];
              const claimStyle = {
                "--x": `${slot.point[0]}%`, "--y": `${slot.point[1]}%`, "--order": index,
                "--mobile-x": `${mobileSlot.point[0]}%`, "--mobile-y": `${mobileSlot.point[1]}%`,
                "--drift-x": `${drift[0]}px`, "--drift-y": `${drift[1]}px`,
                ...(retreat ? { "--retreat-x": `${retreat[0]}%`, "--retreat-y": `${retreat[1]}%` } : {}),
                ...(reserveSource ? {
                  "--from-x": `${reserveSource.origin[0]}%`, "--from-y": `${reserveSource.origin[1]}%`,
                  "--approach-x": `${reserveSource.approach[0]}%`, "--approach-y": `${reserveSource.approach[1]}%`,
                  "--reserve-scale": reserveSource.scale,
                } : {}),
                ...(mobileReserveSource ? {
                  "--mobile-from-x": `${mobileReserveSource.origin[0]}%`, "--mobile-from-y": `${mobileReserveSource.origin[1]}%`,
                  "--mobile-approach-x": `${mobileReserveSource.approach[0]}%`, "--mobile-approach-y": `${mobileReserveSource.approach[1]}%`,
                  "--reserve-scale": mobileReserveSource.scale,
                } : {}),
              } as CSSProperties;
              return <button
                key={claim.id}
                className={`claim-node claim-node--${slot.className} claim-node--${role} claim-node--text-${textDensity} showcase--${showcase.kind}`}
                id={`claim-node-${claim.id}`}
                data-claim-id={claim.id}
                data-node-role={role}
                aria-label={fullTitle}
                lang={locale}
                style={claimStyle}
                type="button"
                onFocus={acknowledgeNode}
                onMouseEnter={acknowledgeNode}
                onKeyDown={(event) => moveClaimFocus(event, claim)}
                onClick={() => selectClaim(claim)}
              ><strong title={fullTitle}>{visibleTitle}</strong></button>;
            })}
          </div>
          <div className={`experience-focus showcase--${claimShowcase(profile, selected, locale).kind}`} key={selected.id} data-selected-id={selected.id}><ClaimDetail profile={profile} claim={selected} locale={locale}/></div>
          <ClaimActions claim={selected} locale={locale} onMoreLike={moreLike}/>
          {query && neighborhood.length === 0 && <p className="empty-state" aria-live="polite">{t.empty}</p>}
        </div>
      </section>
      <nav hidden aria-hidden="true">
        {profile.claims.map((claim) => <a key={claim.id} id={claim.id} href={classicClaimPath(claim.id, locale)}>{claim.title[locale]}</a>)}
        {profile.evidence.map((item) => <span key={item.id}>{marketEvidenceTitle(item, locale)}</span>)}
      </nav>
    </main>
  </div>;
}
