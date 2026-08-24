import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { useFadeRise, useSettleZoom, useSpringIn, useTypeBase } from "./motion";

export type AIImageOnGridProps = {
  /** Image src — http(s) URL or staticFile path. The image MUST be generated
   *  with the brand grid background as input (via Higgsfield `medias` field
   *  with role "image") so the grid is baked in and the subject sits inside
   *  the same gradient/grid as the programmatic templates. */
  src: string;
  /** Optional caption that sits on top of the image, bottom-third. */
  caption?: string;
};

const resolveSrc = (s: string): string => /^https?:\/\//i.test(s) ? s : staticFile(s);

/**
 * Hosts an AI-generated image where the brand grid is baked into the image
 * itself (generated with the grid bg passed as init image to gpt_image_2).
 * Displayed edge-to-edge with a soft entrance and settle zoom.
 */
export const AIImageOnGrid: React.FC<AIImageOnGridProps> = ({ src, caption }) => {
  const { width, height } = useVideoConfig();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const enter = useSpringIn(0.00, 0.55);
  const zoom = useSettleZoom(0.55, 1.8, 1.025);
  const captionEnter = useFadeRise(0.50, 0.45, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0F121A" }}>
      <AbsoluteFill style={{
        opacity: enter,
        transform: `scale(${zoom})`,
        transformOrigin: "center",
      }}>
        <Img
          src={resolveSrc(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      {caption && (
        <div style={{
          position: "absolute",
          left: width * 0.06,
          right: width * 0.06,
          bottom: height * 0.10,
          padding: `${width * 0.02}px ${width * 0.03}px`,
          backgroundColor: "rgba(15,18,26,0.75)",
          backdropFilter: "blur(8px)",
          borderLeft: "3px solid #CFFF05",
          fontFamily,
          fontWeight: 600,
          fontSize: Math.round(typeBase * 0.040),
          color: "#FFFFFF",
          opacity: captionEnter.opacity,
          transform: `translateY(${captionEnter.ty}px)`,
        }}>
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
};
