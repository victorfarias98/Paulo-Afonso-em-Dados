import { registerRoot, Composition } from "remotion";
import { ProjectVideo } from "./ProjectVideo";
import { durationInFrames, fps } from "./story.mjs";

const Root = () => (
  <>
    <Composition
      id="Vertical"
      component={ProjectVideo}
      width={1080}
      height={1920}
      fps={fps}
      durationInFrames={durationInFrames}
    />
    <Composition
      id="Horizontal"
      component={ProjectVideo}
      width={1920}
      height={1080}
      fps={fps}
      durationInFrames={durationInFrames}
    />
  </>
);
registerRoot(Root);
