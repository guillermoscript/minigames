// GLBLite: minimal .glb reader for the LA FIESTA landmark pack (no GLTFLoader needed). Needs the global THREE.
// GLBLite.load(url) -> Promise<{ nodeName: {geo, pos, quat, sc} }>. Geometry has position, optional normal, color (sRGB-converted), Uint32 index.
// glTF COLOR_0 is linear; the board renders with three's default linear output, so colours are converted with pow(1/2.2) to match the terrain palette.
(function(root){
  function read(bin,js,ai){
    const a=js.accessors[ai],bv=js.bufferViews[a.bufferView],cm={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],dv=new DataView(bin);
    const sz={5126:4,5123:2,5125:4,5121:1}[a.componentType],off=(bv.byteOffset||0)+(a.byteOffset||0),st=bv.byteStride||cm*sz,nr=a.normalized?(a.componentType===5123?65535:255):1;
    const g=a.componentType===5126?o=>dv.getFloat32(o,true):a.componentType===5123?o=>dv.getUint16(o,true):a.componentType===5125?o=>dv.getUint32(o,true):o=>dv.getUint8(o);
    const out=a.componentType===5125||a.componentType===5123&&!a.normalized&&cm===1?new Uint32Array(a.count*cm):new Float32Array(a.count*cm);
    for(let i=0;i<a.count;i++)for(let c=0;c<cm;c++)out[i*cm+c]=g(off+i*st+c*sz)/nr;
    return{out:out,cm:cm};
  }
  async function load(url){
    const buf=await(await fetch(url,{cache:'no-cache'})).arrayBuffer(),dv=new DataView(buf),jl=dv.getUint32(12,true);
    const js=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,20,jl))),bin=buf.slice(28+jl),nodes={};
    js.nodes.forEach(function(n){
      if(n.mesh==null)return;
      const pr=js.meshes[n.mesh].primitives[0],g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(read(bin,js,pr.attributes.POSITION).out,3));
      if(pr.attributes.NORMAL!=null)g.setAttribute('normal',new THREE.BufferAttribute(read(bin,js,pr.attributes.NORMAL).out,3));
      if(pr.attributes.COLOR_0!=null){
        const c=read(bin,js,pr.attributes.COLOR_0),cnt=c.out.length/c.cm,col=new Float32Array(cnt*3);
        for(let i=0;i<cnt;i++)for(let k=0;k<3;k++)col[i*3+k]=Math.pow(c.out[i*c.cm+k],1/2.2);
        g.setAttribute('color',new THREE.BufferAttribute(col,3));
      }
      g.setIndex(new THREE.BufferAttribute(read(bin,js,pr.indices).out,1));
      nodes[n.name]={geo:g,pos:new THREE.Vector3(...(n.translation||[0,0,0])),quat:new THREE.Quaternion(...(n.rotation||[0,0,0,1])),sc:new THREE.Vector3(...(n.scale||[1,1,1]))};
    });
    return nodes;
  }
  root.GLBLite={load:load};
})(window);
