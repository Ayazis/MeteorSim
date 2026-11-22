/* Projected meteor ribbons share the sky renderer. Coordinates are CSS pixels so
   the apparent width stays consistent across display densities and zoom levels. */
function createMeteorPass(renderer, camera) {
  const scene = new THREE.Scene();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0, 0,1, 1,0, 1,0, 0,1, 1,1], 2));
  const viewport = new THREE.Vector2();
  const ribbons = [];
  let count = 0;

  const vertexShader = `
    precision highp float;
    in vec2 position;
    uniform vec2 head, tail, viewport;
    uniform float width;
    out vec2 local;
    void main() {
      vec2 delta = head - tail;
      float len = max(length(delta), 0.001);
      vec2 axis = delta / len;
      vec2 normal = vec2(-axis.y, axis.x);
      local = vec2(mix(-len - width, width, position.x), (position.y - 0.5) * 2.0 * width);
      vec2 pixel = head + axis * local.x + normal * local.y;
      gl_Position = vec4(pixel / viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
    }`;
  const fragmentShader = `
    precision highp float;
    out vec4 color;
    uniform vec2 head, tail;
    uniform vec3 headColor, trailColor;
    uniform float opacity, core, width, fire, phase;
    in vec2 local;
    void main() {
      float len = max(distance(head, tail), 0.001);
      float along = clamp(1. + local.x / len, 0., 1.);
      float y = local.y / core;
      float r = length(local) / core;
      float wake = along * along * exp(-y*y / (0.25 + along));
      wake *= 1. - smoothstep(-core, core, local.x);
      float nucleus = exp(-r*r * 1.5);
      float halo = exp(-r * 0.65) * (0.22 + fire * 0.5);
      vec3 light = mix(trailColor, headColor, along * along) * wake;
      light += headColor * halo + vec3(1.) * nucleus;
      if (fire > 0.) {
        for (int i = 1; i <= 4; i++) {
          float n = float(i);
          float f = n * 0.09 + 0.015 * sin(phase + n);
          vec2 offset = vec2(-len * f, sin(phase * 0.35 + n * 4.) * core * n * 0.75);
          vec2 d = (local - offset) / core;
          light += trailColor * exp(-dot(d,d * vec2(0.4, 2.))) * fire * (1. - f);
        }
      }
      float edge = 1. - smoothstep(width * 0.8, width, max(abs(local.y), local.x));
      color = vec4(light * opacity * edge, 1.);
    }`;

  function add(hx, hy, tx, ty, w, opacity, magnitude, meteor) {
    let mesh = ribbons[count++];
    if (!mesh) {
      const uniforms = {};
      for (const key of ['width', 'opacity', 'core', 'fire', 'phase']) uniforms[key] = { value: 0 };
      for (const key of ['head', 'tail']) uniforms[key] = { value: new THREE.Vector2() };
      for (const key of ['headColor', 'trailColor']) uniforms[key] = { value: new Float32Array(3) };
      uniforms.viewport = { value: viewport };
      const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, uniforms, vertexShader, fragmentShader,
        blending: 2 /* THREE.AdditiveBlending */, transparent: true, depthTest: false, depthWrite: false });
      mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      ribbons.push(mesh);
      scene.add(mesh);
    }
    mesh.visible = true;
    const u = mesh.material.uniforms;
    u.head.value.set(hx, hy);
    u.tail.value.set(tx, ty);
    u.core.value = w * 0.65;
    u.width.value = w * 6;
    u.opacity.value = opacity;
    u.fire.value = Math.min(1, Math.max(0, -1 - magnitude));
    u.phase.value = meteor.seed + meteor.age * 12;
    for (let i = 0; i < 3; i++) {
      u.headColor.value[i] = meteor.head[i] / 255;
      u.trailColor.value[i] = meteor.trail[i] / 255;
    }
  }

  function render(width, height) {
    if (!count) return;
    viewport.set(width, height);
    for (let i = count; i < ribbons.length; i++) ribbons[i].visible = false;
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;
    count = 0;
  }
  return { add, render };
}
