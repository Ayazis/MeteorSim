// Transparent replay overlay. All distances in the fragment shader are CSS pixels.
function createImpactPass(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, depth: false, antialias: false });
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const uniforms = {};
  for (const key of ['size', 'viewport', 'start', 'end']) uniforms[key] = { value: new THREE.Vector2() };
  for (const key of ['time', 'duration', 'horizon', 'power', 'graze', 'fragments', 'cloud', 'ejecta', 'flash', 'fade']) {
    uniforms[key] = { value: 0 };
  }
  uniforms.toAnchor = { value: new Float32Array(9) };
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms, depthTest: false, depthWrite: false,
    vertexShader: `
      in vec2 position;
      out vec2 screen;
      void main() {
        screen = position * vec2(.5,-.5) + .5;
        gl_Position = vec4(position,0.,1.);
      }`,
    fragmentShader: `
      precision highp float;
      in vec2 screen;
      out vec4 color;
      uniform vec2 size, viewport, start, end;
      uniform mat3 toAnchor;
      uniform float time, duration, horizon, power, graze, fragments, cloud, ejecta, flash, fade;

      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                   mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
      }
      vec2 path(float p) {
        vec2 pos=mix(start,end,p);
        pos.y += graze * size.y * .1 * sin(3.14159*p);
        return pos;
      }
      // Front-to-back appearance is composed in premultiplied alpha.
      void layer(vec3 rgb,float a) {
        a=clamp(a,0.,1.);
        color=vec4(rgb*a,a)+color*(1.-a);
      }
      void main() {
        vec3 ray = toAnchor * vec3(screen*viewport,1.);
        if (ray.z <= .001) {
          color = vec4(vec3(1.,.96,.87)*flash,flash)*fade;
          return;
        }
        vec2 pixel = ray.xy/ray.z;
        float p=clamp(time/duration,0.,1.), after=time-duration;
        float scale=clamp(min(size.x,size.y)/720.,.55,2.);
        vec2 head=path(p);
        vec2 axis=normalize(path(p+.001)-head);
        vec2 delta=pixel-head;
        float x=dot(delta,axis)/scale, y=dot(delta,vec2(-axis.y,axis.x))/scale;
        float loc=clamp((pixel.x-start.x)/(end.x-start.x),0.,p);
        vec2 origin=path(loc);
        float age=max(0.,time-loc*duration);
        float crossDist=dot(pixel-origin,vec2(-axis.y,axis.x))/scale;
        float turbulence=noise(vec2(loc*22.-time*.09,age*.24));
        float width=2.+age*2.2;
        float offset=age*(turbulence-.35)*6.;
        float smoke=exp(-pow((crossDist-offset)/width,2.))
          * exp(-length(pixel-origin)/(scale*(width*4.+1.))) * exp(-age*.11);
        color=vec4(0.);
        layer(vec3(.92,.88,.82),smoke*(.22+.4*turbulence));
        float bright=mix(.15+pow(p,2.),sin(p*3.14159),graze);
        float flight=1.-smoothstep(0.,.16,after);
        float core=1.5+bright*(1.5+power*4.);
        float tail=exp(-abs(y)/(core*.55))*exp(min(0.,x)/(20.+bright*60.))*step(x,0.);
        float headGlow=exp(-length(delta)/(scale*core*2.));
        layer(vec3(1.,.58,.25),flight*bright*(tail+headGlow));
        layer(vec3(1.,.97,.87),flight*(exp(-length(delta)/(scale*core)) + tail*.65));
        for (int i=0;i<16;i++) {
          if(float(i)>=fragments) break;
          float n=float(i)+1., birth=.52+.42*hash(vec2(n,4));
          float ageF=time-birth*duration;
          if(ageF<0. || ageF>2.) continue;
          vec2 pos=path(birth)+(path(birth+.01)-path(birth))*(ageF*100./duration)*(.5+.4*hash(vec2(n,3)));
          pos+=scale*vec2((hash(vec2(n,1))-.5)*25.*ageF,12.*ageF*ageF);
          vec2 d=(pixel-pos)/scale;
          float f=exp(-abs(dot(d,vec2(-axis.y,axis.x)))/1.6-abs(dot(d,axis))/6.);
          layer(vec3(1.,.77,.42),f*(1.-ageF*.5));
        }
        if(after>=0. && graze<.5) {
          vec2 d=(pixel-end)/scale;
          float burst=exp(-length(d)/(6.+power*65.+after*11.))*exp(-after*1.65);
          layer(vec3(1.,.85,.58),burst);
          if(cloud>0. && pixel.y<horizon) {
            float radius=.01+(10.+cloud*22.)*sqrt(min(after,3.)) + after*2.;
            vec2 q=vec2(d.x,(pixel.y-horizon)/scale);
            float height=after*(4.+cloud*5.);
            float grain=noise(q*.045+vec2(0.,time*.24))+.45*noise(q*.12);
            float cap=length((q+vec2(0,height))/(radius*vec2(1.,.62)));
            float stem=length((q+vec2(0,height*.45))/vec2(radius*.32,height*.65+.1));
            float density=1.-smoothstep(.58,1.2,min(cap,stem)+.38*(grain-.7));
            float heat=exp(-after*.23);
            layer(mix(vec3(.23,.19,.17),vec3(1.,.61,.22),heat)*(.65+.5*grain),density*.88);
          }
          if(ejecta>0. && pixel.y<horizon && after>2.) {
            vec2 cell=(pixel/scale-vec2(-42.,155.)*after)/vec2(86.,78.);
            vec2 dCell=(fract(cell)-.5)*vec2(86.,78.);
            float streak=exp(-abs(dCell.x+.27*dCell.y)*1.3-abs(dCell.y)*.17);
            float rain=ejecta*smoothstep(2.,10.,after);
            layer(vec3(.8,.23,.08),rain*(.18+.82*streak*hash(floor(cell))));
          }
        }
        layer(vec3(1.,.96,.87),flash);
        color*=fade;
      }`
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    resize(w,h,dpr) { renderer.setSize(Math.round(w*dpr), Math.round(h*dpr), false); },
    clear() { renderer.clear(); },
    draw(c,w,h,flash,toAnchor) {
      const u=uniforms, e=c.e;
      u.size.value.set(c.anchor.width,c.anchor.height);
      u.viewport.value.set(w,h);
      u.toAnchor.value.set(toAnchor);
      u.start.value.set(c.sx,c.sy);
      u.end.value.set(c.bx,e.kind === 'graze' ? c.sy : c.by);
      u.time.value=c.t;
      u.duration.value=e.dur;
      u.horizon.value=c.hy;
      u.power.value=Math.min(1,Math.max(0,(Math.log10(e.peakSun)+3)/9));
      u.graze.value=Number(e.kind === 'graze');
      u.fragments.value=e.frags;
      u.cloud.value=e.cloud || (e.altKm === 0 ? .3 : 0);
      u.ejecta.value=e.ejecta || 0;
      u.flash.value=flash;
      u.fade.value=Math.min(1,Math.max(0,(c.end-c.t)/2));
      renderer.render(scene,camera);
    }
  };
}
