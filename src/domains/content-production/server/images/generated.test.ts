import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import sharp from "sharp";
import {readFreshGeneratedImage} from "./generated";

test("generated importer accepts only fresh in-root images, preserves alpha and emits WebP",async()=>{
  const root=await mkdtemp(join(tmpdir(),"generated-images-test-"));
  const outside=await mkdtemp(join(tmpdir(),"outside-image-test-"));
  try {
    const subject=await sharp({create:{width:4,height:4,channels:4,background:{r:90,g:80,b:70,alpha:0.5}}}).png().toBuffer();
    const png=await sharp({create:{width:8,height:8,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:subject,left:2,top:2}]).png().toBuffer();
    const file=join(root,"new.png"); await writeFile(file,png);
    const converted=await readFreshGeneratedImage(file,0,root);
    const metadata=await sharp(converted).metadata();
    assert.equal(metadata.format,"webp"); assert.equal(metadata.hasAlpha,true);
    assert.deepEqual(await sharp(converted).raw().toBuffer(),await sharp(png).raw().toBuffer());
    await assert.rejects(readFreshGeneratedImage(file,Date.now()+1000,root),{code:"GENERATED_IMAGE_NOT_FRESH"});
    const other=join(outside,"old.png"); await writeFile(other,png);
    await assert.rejects(readFreshGeneratedImage(other,0,root),{code:"GENERATED_IMAGE_PATH_INVALID"});
    const link=join(root,"escape.png"); await symlink(other,link);
    await assert.rejects(readFreshGeneratedImage(link,0,root),{code:"GENERATED_IMAGE_PATH_INVALID"});
    const opaque=join(root,"opaque.png");
    await writeFile(opaque,await sharp({create:{width:8,height:8,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).png().toBuffer());
    await assert.rejects(readFreshGeneratedImage(opaque,0,root),{code:"GENERATED_IMAGE_NOT_TRANSPARENT"});
    const invalid=join(root,"invalid.png");await writeFile(invalid,"not an image");
    await assert.rejects(readFreshGeneratedImage(invalid,0,root),{code:"GENERATED_IMAGE_INVALID"});
  }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
