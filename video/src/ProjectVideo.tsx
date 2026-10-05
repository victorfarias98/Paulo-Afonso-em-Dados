import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  delayRender,
  continueRender,
  cancelRender,
} from "remotion";
import { Audio } from "@remotion/media";
import { useGsapTimeline } from "@remotion/gsap";
import { useEffect, useState, type CSSProperties } from "react";
import { scenes } from "./story.mjs";

const C = {
  cream: "#f4efe4",
  ink: "#182d40",
  blue: "#226da9",
  pale: "#d9e9f0",
  gold: "#edbb68",
  muted: "#53606a",
};
type SceneData = (typeof scenes)[number];

function Icon({
  kind,
  size = 76,
  color = C.blue,
}: {
  kind: string;
  size?: number;
  color?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    money: (
      <>
        <rect x="6" y="12" width="52" height="38" rx="7" />
        <circle cx="32" cy="31" r="10" />
        <path d="M11 23h5m32 16h5" />
      </>
    ),
    file: (
      <>
        <path d="M17 6h23l10 11v41H17zM40 6v13h10M24 30h18M24 39h18M24 48h12" />
      </>
    ),
    work: (
      <>
        <path d="M8 51h48M14 42V27a18 18 0 0 1 36 0v15M25 9v20M39 9v20M8 42h48" />
      </>
    ),
    search: (
      <>
        <circle cx="27" cy="27" r="17" />
        <path d="m40 40 15 15" />
      </>
    ),
    check: (
      <>
        <circle cx="32" cy="32" r="25" />
        <path d="m19 32 9 9 17-19" />
      </>
    ),
    people: (
      <>
        <circle cx="24" cy="19" r="9" />
        <circle cx="47" cy="22" r="7" />
        <path d="M6 56v-8a18 18 0 0 1 36 0v8M45 38a13 13 0 0 1 14 13v5" />
      </>
    ),
    arrow: (
      <>
        <path d="M8 32h46M37 15l17 17-17 17" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={color}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[kind] ?? paths.file}
    </svg>
  );
}

const card: CSSProperties = {
  background: "#fffdf8",
  border: "2px solid #d0d8d8",
  borderRadius: 28,
  boxShadow: "0 16px 40px #182d4010",
};
const animated = { "data-visual": true };

function City({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        {...animated}
        style={{
          position: "absolute",
          top: -22,
          right: 14,
          zIndex: 2,
          ...card,
          padding: "18px 24px",
          fontSize: 25,
          color: C.ink,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Icon kind="people" size={38} /> Nossa cidade. Nossa informação.
      </div>
      <Img
        {...animated}
        src={staticFile("civic-city.webp")}
        style={{
          width: "100%",
          borderRadius: 36,
          border: dark ? "2px solid #ffffff30" : "2px solid #d0cabe",
        }}
      />
      <div
        {...animated}
        style={{
          position: "absolute",
          bottom: -30,
          left: 26,
          ...card,
          padding: "19px 26px",
          color: C.ink,
          fontSize: 27,
          fontWeight: 700,
        }}
      >
        Paulo Afonso · Bahia
      </div>
    </div>
  );
}

function Spending() {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      {[
        ["money", "Gastos públicos", "Conheça os pagamentos e os fornecedores."],
        ["file", "Contratos", "Entenda o que está sendo comprado."],
        ["work", "Obras", "Acompanhe o andamento informado."],
      ].map(([kind, title, detail], i) => (
        <div
          {...animated}
          key={title}
          style={{ ...card, padding: "28px 30px", display: "flex", alignItems: "center", gap: 24 }}
        >
          <div style={{ padding: 15, borderRadius: 22, background: i === 1 ? "#f7e5c8" : C.pale }}>
            <Icon kind={kind} size={64} />
          </div>
          <div>
            <div style={{ fontSize: 37, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 27, marginTop: 9, lineHeight: 1.35, color: C.muted }}>
              {detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Sources() {
  return (
    <div style={{ position: "relative", padding: "12px 18px" }}>
      <div {...animated} style={{ ...card, padding: 44, transform: "rotate(-3deg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Icon kind="file" size={85} />
          <div style={{ fontSize: 23, color: C.blue, fontWeight: 800 }}>DADOS PÚBLICOS</div>
        </div>
        <div style={{ fontSize: 43, fontWeight: 800, marginTop: 34 }}>Você pode conferir.</div>
        <div style={{ height: 2, background: "#d0cabe", margin: "28px 0" }} />
        {["Origem do registro", "Data da consulta", "Link para a fonte oficial"].map((text) => (
          <div
            key={text}
            style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 30, marginTop: 23 }}
          >
            <Icon kind="check" size={36} />
            {text}
          </div>
        ))}
      </div>
      <div
        {...animated}
        style={{
          background: C.blue,
          color: C.cream,
          borderRadius: 20,
          padding: "23px 28px",
          fontSize: 33,
          fontWeight: 800,
          margin: "30px 22px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        Fonte oficial <Icon kind="arrow" color={C.cream} size={42} />
      </div>
    </div>
  );
}

function Council() {
  return (
    <div {...animated} style={{ ...card, padding: 34 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          background: C.cream,
          border: "2px solid #d0cabe",
          borderRadius: 18,
          padding: "22px 24px",
          fontSize: 32,
          color: C.muted,
        }}
      >
        <Icon kind="search" size={38} /> Nome do vereador{" "}
        <span style={{ width: 2, height: 32, background: C.blue }} />
      </div>
      <div
        {...animated}
        style={{
          background: C.blue,
          color: "white",
          borderRadius: 40,
          padding: "17px 23px",
          fontSize: 27,
          marginTop: 25,
          display: "inline-flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Icon kind="check" color="white" size={32} /> Com projetos apresentados
      </div>
      <div style={{ height: 2, background: "#d0cabe", margin: "29px 0" }} />
      {["Projetos apresentados", "Pedidos registrados", "Links para as propostas"].map((t, i) => (
        <div
          {...animated}
          key={t}
          style={{ display: "flex", alignItems: "center", gap: 21, marginTop: 23, fontSize: 33 }}
        >
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: i === 1 ? C.gold : C.blue,
            }}
          />
          {t}
        </div>
      ))}
      <div style={{ fontSize: 23, color: C.muted, marginTop: 35, lineHeight: 1.4 }}>
        Consulta datada · Fonte: SAPL da Câmara
      </div>
    </div>
  );
}

function Context() {
  return (
    <div style={{ display: "grid", gap: 26 }}>
      <div
        {...animated}
        style={{ ...card, padding: 32, display: "flex", alignItems: "center", gap: 24 }}
      >
        <Icon kind="file" size={76} />
        <div style={{ fontSize: 37, fontWeight: 800 }}>
          Proposta
          <br />
          apresentada
        </div>
      </div>
      <div
        {...animated}
        style={{
          textAlign: "center",
          fontSize: 75,
          fontWeight: 800,
          color: C.gold,
          lineHeight: 0.9,
        }}
      >
        ≠
      </div>
      <div
        {...animated}
        style={{ ...card, padding: 32, display: "flex", alignItems: "center", gap: 24 }}
      >
        <Icon kind="work" size={76} />
        <div style={{ fontSize: 37, fontWeight: 800 }}>
          Obra
          <br />
          executada
        </div>
      </div>
      <div
        {...animated}
        style={{
          background: "#d9e9f0",
          color: C.ink,
          borderRadius: 20,
          padding: 26,
          fontSize: 28,
          lineHeight: 1.45,
        }}
      >
        A ausência de projetos não resume todo o trabalho do mandato.
      </div>
    </div>
  );
}

function Participation() {
  return (
    <div style={{ position: "relative" }}>
      <City />
      <div
        {...animated}
        style={{
          ...card,
          position: "absolute",
          bottom: 28,
          right: 22,
          padding: "24px 26px",
          maxWidth: 390,
          fontSize: 32,
          lineHeight: 1.25,
          fontWeight: 800,
        }}
      >
        Informação clara.
        <br />
        <span style={{ color: C.blue }}>Participação de verdade.</span>
      </div>
    </div>
  );
}

function Scene({ scene, index }: { scene: SceneData; index: number }) {
  const { width, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const vertical = width < 1500;
  const dark = index === 0 || index === 7;
  const scope = useGsapTimeline<HTMLDivElement>(
    ({ timeline, selector }) => {
      timeline
        .fromTo(
          selector("[data-label]"),
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" },
          0.12,
        )
        .fromTo(
          selector("[data-line]"),
          { autoAlpha: 0, y: 75 },
          { autoAlpha: 1, y: 0, stagger: 0.1, duration: 0.8, ease: "power3.out" },
          0.25,
        )
        .fromTo(
          selector("[data-subtitle]"),
          { autoAlpha: 0, y: 28 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" },
          0.8,
        )
        .fromTo(
          selector("[data-visual]"),
          { autoAlpha: 0, y: 40, scale: 0.97 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.85, stagger: 0.13, ease: "power3.out" },
          0.4,
        );
    },
    { dependencies: [index] },
  );
  const opacity = interpolate(
    frame,
    [0, 7, scene.duration - 9, scene.duration - 1],
    [0, 1, 1, index === 7 ? 1 : 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const visual =
    scene.key === "spending" ? (
      <Spending />
    ) : scene.key === "sources" ? (
      <Sources />
    ) : scene.key === "council" ? (
      <Council />
    ) : scene.key === "context" ? (
      <Context />
    ) : scene.key === "citizen" ? (
      <Participation />
    ) : (
      <City dark={dark} />
    );
  const titleSize = vertical
    ? scene.key === "brand"
      ? 112
      : scene.key === "sources" || scene.key === "context"
        ? 94
        : 112
    : scene.key === "sources" || scene.key === "context" || scene.key === "end"
      ? 94
      : 116;
  return (
    <AbsoluteFill
      ref={scope}
      style={{
        background: dark ? C.ink : C.cream,
        color: dark ? C.cream : C.ink,
        opacity,
        overflow: "hidden",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={vertical ? "0 0 1080 1920" : "0 0 1920 1080"}
        style={{ position: "absolute", opacity: dark ? 0.18 : 0.11 }}
        fill="none"
        stroke={dark ? "#b2d8ed" : C.blue}
        strokeWidth="2"
      >
        <path
          d={
            vertical
              ? "M-120 1450C260 950 610 1950 1220 1180M-120 1500C260 1000 610 2000 1220 1230M-120 1550C260 1050 610 2050 1220 1280"
              : "M920 -200C460 280 1640 500 1790 1300M970 -200C510 280 1690 500 1840 1300M1020 -200C560 280 1740 500 1890 1300"
          }
        />
        <circle cx={vertical ? 940 : 1780} cy={vertical ? 390 : 180} r="200" />
        <circle cx={vertical ? 940 : 1780} cy={vertical ? 390 : 180} r="230" />
      </svg>
      <div
        style={{
          position: "absolute",
          top: vertical ? 180 : 78,
          left: vertical ? 86 : 100,
          right: vertical ? 115 : 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 24,
          letterSpacing: 2,
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              display: "inline-block",
              width: 22,
              height: 22,
              background: dark ? C.gold : C.blue,
              borderRadius: 5,
              transform: "rotate(-10deg)",
            }}
          />{" "}
          PAULO AFONSO EM DADOS
        </div>
        <div style={{ fontSize: 21, opacity: 0.7 }}>0{index + 1} / 08</div>
      </div>
      <div
        style={{
          position: "absolute",
          top: vertical ? 340 : 218,
          left: vertical ? 86 : 100,
          right: vertical ? 115 : undefined,
          width: vertical ? undefined : 820,
        }}
      >
        <div
          data-label
          style={{
            fontSize: vertical ? 26 : 25,
            fontWeight: 800,
            letterSpacing: 3,
            color: dark ? C.gold : C.blue,
            marginBottom: 32,
          }}
        >
          {scene.label}
        </div>
        <div
          style={{ fontSize: titleSize, lineHeight: 1.04, fontWeight: 900, letterSpacing: -4.5 }}
        >
          {scene.title.split("\n").map((line, i) => (
            <div
              key={line}
              data-line
              style={{
                color:
                  scene.key === "brand" && i === 1
                    ? C.blue
                    : scene.key === "citizen" && i === 2
                      ? C.blue
                      : "inherit",
              }}
            >
              {line}
            </div>
          ))}
        </div>
        <div
          data-subtitle
          style={{
            fontSize: vertical ? 37 : 36,
            lineHeight: 1.4,
            marginTop: 38,
            maxWidth: vertical ? 840 : 740,
            color: dark ? "#c4d4df" : C.muted,
          }}
        >
          {scene.subtitle}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: vertical ? 86 : 1030,
          right: vertical ? 115 : 100,
          top: vertical
            ? scene.key === "context"
              ? 1030
              : scene.key === "sources"
                ? 960
                : scene.key === "end"
                  ? 970
                  : ["question", "brand", "citizen"].includes(scene.key)
                    ? 1000
                    : 1070
            : scene.key === "context"
              ? 225
              : 278,
        }}
      >
        {visual}
      </div>
      {scene.key === "end" && (
        <div
          data-visual
          style={{
            position: "absolute",
            left: vertical ? 86 : 100,
            bottom: vertical ? 235 : 150,
            display: "flex",
            alignItems: "center",
            gap: 22,
          }}
        >
          <span style={{ fontSize: 26, color: "#c4d4df" }}>Uma iniciativa</span>
          <Img
            src={staticFile("baius-logo-light.png")}
            style={{ width: 148, height: 61, objectFit: "contain" }}
          />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: vertical ? 86 : 100,
          right: vertical ? 115 : 100,
          bottom: vertical ? (scene.key === "end" ? 150 : 250) : 78,
          fontSize: vertical ? 25 : 23,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: dark ? "#c4d4df" : C.muted,
        }}
      >
        <span>Independente · Apartidário</span>
        <span style={{ fontWeight: 700 }}>BAIUS</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 8,
          background: dark ? "#30495c" : "#d0cabe",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background: dark ? C.gold : C.blue,
            transformOrigin: "left",
            transform: `scaleX(${(scene.from + frame) / (60 * fps)})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

export function ProjectVideo() {
  const { fps } = useVideoConfig();
  const [fontHandle] = useState(() => delayRender("Loading local Lato fonts"));
  useEffect(() => {
    Promise.all([
      new FontFace("Lato", `url(${staticFile("Lato-Regular.ttf")})`, { weight: "400" }).load(),
      new FontFace("Lato", `url(${staticFile("Lato-Heavy.ttf")})`, { weight: "700 900" }).load(),
    ])
      .then((fonts) => {
        fonts.forEach((f) => document.fonts.add(f));
        continueRender(fontHandle);
      })
      .catch(cancelRender);
  }, [fontHandle]);
  return (
    <AbsoluteFill style={{ background: C.ink, fontFamily: "Lato, sans-serif" }}>
      <Audio src={staticFile("music.wav")} volume={0.22} />
      {scenes.map((scene, index) => (
        <Sequence
          key={`voice-${scene.key}`}
          from={scene.from + 10}
          durationInFrames={scene.duration - 20}
          premountFor={fps}
        >
          <Audio src={staticFile(`narration-${index + 1}.mp3`)} volume={1} />
        </Sequence>
      ))}
      {scenes.map((scene, index) => (
        <Sequence
          key={scene.key}
          from={scene.from}
          durationInFrames={scene.duration}
          premountFor={fps}
        >
          <Scene scene={scene} index={index} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
