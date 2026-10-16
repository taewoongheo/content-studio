import assert from "node:assert/strict";
import test from "node:test";
import { validateVideoUpload } from "../media/upload";

test("업로드는 HTML·다른 형식의 바이트를 선언한 영상/이미지 형식으로 저장하지 않는다", () => {
  assert.throws(() => validateVideoUpload("video/mp4", Buffer.from("<html>not video</html>")));
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.doesNotThrow(() => validateVideoUpload("image/png", png));
  assert.throws(() => validateVideoUpload("image/jpeg", png));
  const wav = Buffer.from("RIFF0000WAVE");
  assert.doesNotThrow(() => validateVideoUpload("audio/wav", wav));
  assert.doesNotThrow(() => validateVideoUpload("audio/x-wav", wav));
  assert.throws(() => validateVideoUpload("audio/mpeg", wav));
  const mp4 = Buffer.from("0000ftypisom0000mp42"); mp4.writeUInt32BE(mp4.length, 0);
  assert.doesNotThrow(() => validateVideoUpload("video/mp4", mp4));
  assert.throws(() => validateVideoUpload("video/quicktime", mp4));
  const mov = Buffer.from(mp4); mov.write("qt  ", 8);
  assert.doesNotThrow(() => validateVideoUpload("video/quicktime", mov));
  assert.throws(() => validateVideoUpload("video/mp4", mov));
  const aac = Buffer.from([0xff, 0xf1, 0x50, 0x80]);
  assert.doesNotThrow(() => validateVideoUpload("audio/aac", aac));
  assert.throws(() => validateVideoUpload("audio/mpeg", aac));
  assert.doesNotThrow(() => validateVideoUpload("audio/mpeg", Buffer.from([0xff, 0xfb, 0x90, 0x00])));
});
