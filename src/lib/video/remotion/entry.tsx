import { Composition, registerRoot } from "remotion";
import { VideoComposition, type VideoCompositionProps } from "./composition";
import { newVideoDocument, videoDuration } from "../domain/model";
function Root() {
  return <Composition id="ContentStudioVideo" component={VideoComposition} width={1080} height={1920} fps={30} durationInFrames={150}
    defaultProps={{ document: newVideoDocument(), projectId: "" } as VideoCompositionProps}
    calculateMetadata={({ props }) => ({ width: props.document.width, height: props.document.height, fps: props.document.fps, durationInFrames: videoDuration(props.document) })} />;
}
registerRoot(Root);
