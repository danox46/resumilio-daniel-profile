import { useCallback, useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import type { AvatarLayout, AvatarPlayback, AvatarReaction } from "../avatar-schedule.js";
import { withBase } from "../site.js";

const crossfadeDurationMs = 180;
const incomingFallbackMs = 1_000;

const avatarMedia: Record<Exclude<AvatarReaction, "guide">, string> = {
  idle: withBase("/media/avatar/daniel-idle.mp4"),
  waiting: withBase("/media/avatar/daniel-waiting.mp4"),
  nod: withBase("/media/avatar/daniel-nod.mp4"),
  smile: withBase("/media/avatar/daniel-smile.mp4"),
};
const avatarGuideMedia: Record<AvatarLayout, string> = {
  wide: withBase("/media/avatar/daniel-guide-wide.mp4"),
  stacked: withBase("/media/avatar/daniel-guide-stacked.mp4"),
};

type AvatarVariant = Exclude<AvatarReaction, "guide"> | "guide-wide" | "guide-stacked";
type VideoLayer = AvatarPlayback & {
  id: string;
  source: string;
  variant: AvatarVariant;
  startAt: number;
};

export const avatarFraming: Record<AvatarVariant, { scale: number; offsetY: string }> = {
  idle: { scale: 1, offsetY: "0%" },
  waiting: { scale: 0.99, offsetY: "-0.4%" },
  nod: { scale: 1.01, offsetY: "-0.4%" },
  smile: { scale: 1.01, offsetY: "-0.8%" },
  "guide-wide": { scale: 1, offsetY: "-0.8%" },
  "guide-stacked": { scale: 1, offsetY: "-1%" },
};

function videoLayer(playback: AvatarPlayback, layout: AvatarLayout, startAt = 0): VideoLayer {
  const variant = playback.reaction === "guide" ? `guide-${layout}` as const : playback.reaction;
  return {
    ...playback,
    id: `${playback.sequence}-${variant}`,
    source: playback.reaction === "guide" ? avatarGuideMedia[layout] : avatarMedia[playback.reaction],
    variant,
    startAt,
  };
}

function framingStyle(variant: AvatarVariant): CSSProperties {
  const framing = avatarFraming[variant];
  return { "--avatar-video-scale": framing.scale, "--avatar-video-offset-y": framing.offsetY } as CSSProperties;
}

export default function AvatarGuide({ playback, layout, onComplete }: {
  playback: AvatarPlayback;
  layout: AvatarLayout;
  onComplete: (sequence: number) => void;
}) {
  const initialLayer = useRef(videoLayer(playback, layout));
  const [current, setCurrent] = useState<VideoLayer>(initialLayer.current);
  const [pending, setPending] = useState<VideoLayer | null>(null);
  const [outgoing, setOutgoing] = useState<VideoLayer | null>(null);
  const currentRef = useRef(current);
  const pendingRef = useRef<VideoLayer | null>(null);
  const outgoingRef = useRef<VideoLayer | null>(null);
  const videoElements = useRef(new Map<string, HTMLVideoElement>());
  const fallbackTimer = useRef<number | undefined>(undefined);
  const removalTimer = useRef<number | undefined>(undefined);

  const removeOutgoing = useCallback((expectedId: string) => {
    if (outgoingRef.current?.id !== expectedId) return;
    outgoingRef.current = null;
    setOutgoing(null);
  }, []);

  const activatePending = useCallback((expectedId: string) => {
    const next = pendingRef.current;
    if (!next || next.id !== expectedId) return;
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
    const incomingVideo = videoElements.current.get(next.id);
    if (incomingVideo) {
      if (next.startAt > 0 && Number.isFinite(incomingVideo.duration)) {
        incomingVideo.currentTime = Math.min(next.startAt, Math.max(0, incomingVideo.duration - 0.05));
      }
      void incomingVideo.play().catch(() => { /* The poster remains available if playback is temporarily blocked. */ });
    }
    const previous = currentRef.current;
    outgoingRef.current = previous;
    setOutgoing(previous);
    currentRef.current = next;
    setCurrent(next);
    pendingRef.current = null;
    setPending(null);
    if (removalTimer.current) window.clearTimeout(removalTimer.current);
    removalTimer.current = window.setTimeout(() => removeOutgoing(previous.id), crossfadeDurationMs);
  }, [removeOutgoing]);

  useEffect(() => {
    const desired = videoLayer(playback, layout);
    if (desired.id === currentRef.current.id) {
      if (pendingRef.current && pendingRef.current.id !== desired.id) {
        if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
        pendingRef.current = null;
        setPending(null);
      }
      return;
    }
    if (desired.id === pendingRef.current?.id) return;
    const currentVideo = videoElements.current.get(currentRef.current.id);
    if (playback.reaction === "guide" && currentRef.current.reaction === "guide" && playback.sequence === currentRef.current.sequence) {
      desired.startAt = currentVideo?.currentTime ?? 0;
    }
    pendingRef.current = desired;
    setPending(desired);
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = window.setTimeout(() => activatePending(desired.id), incomingFallbackMs);
  }, [activatePending, layout, playback]);

  useEffect(() => () => {
    if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
    if (removalTimer.current) window.clearTimeout(removalTimer.current);
  }, []);

  const registerVideo = (layer: VideoLayer, element: HTMLVideoElement | null) => {
    if (element) videoElements.current.set(layer.id, element);
    else videoElements.current.delete(layer.id);
  };
  const prepareIncoming = (event: SyntheticEvent<HTMLVideoElement>, layer: VideoLayer) => {
    if (layer.startAt > 0 && Number.isFinite(event.currentTarget.duration)) {
      event.currentTarget.currentTime = Math.min(layer.startAt, Math.max(0, event.currentTarget.duration - 0.05));
    }
  };
  const renderVideo = (layer: VideoLayer, role: "active" | "pending" | "outgoing") => (
    <video
      key={layer.id}
      ref={(element) => registerVideo(layer, element)}
      className={`avatar-video avatar-video--${role}`}
      data-avatar-video-role={role}
      data-avatar-video-state={layer.reaction}
      data-avatar-video-variant={layer.variant}
      src={layer.source}
      style={framingStyle(layer.variant)}
      poster={withBase("/media/avatar/daniel-idle-poster.webp")}
      muted
      playsInline
      autoPlay={role !== "pending"}
      preload="auto"
      onLoadedMetadata={role === "pending" ? (event) => prepareIncoming(event, layer) : undefined}
      onCanPlay={role === "pending" ? () => activatePending(layer.id) : undefined}
      onEnded={role === "active" ? () => onComplete(layer.sequence) : undefined}
    />
  );
  const transition = pending ? "pending" : outgoing ? "crossfade" : "settled";

  return <figure className="avatar-guide" data-avatar-state={playback.reaction} data-avatar-mode={playback.mode} data-avatar-sequence={playback.sequence} data-avatar-active-state={current.reaction} data-avatar-transition={transition} data-avatar-layout={layout} data-avatar-variant={current.variant.startsWith("guide-") ? current.variant.slice("guide-".length) : "shared"} aria-hidden="true">
    <div className="avatar-node-backdrop"/>
    <div className="avatar-media">
      <img className="avatar-poster" src={withBase("/media/avatar/daniel-idle-poster.webp")} alt="" width="360" height="640" decoding="async" loading="eager" fetchPriority="high"/>
      {outgoing && renderVideo(outgoing, "outgoing")}
      {renderVideo(current, "active")}
      {pending && renderVideo(pending, "pending")}
    </div>
  </figure>;
}
