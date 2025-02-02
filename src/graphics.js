// graphics.js -- the core rendering engine, updated for a modern, cell‐shaded cyberpunk look
//
// Copyright (C) 2019, Nicholas Carlini <nicholas@carlini.com>.
// Modified for modern JS and cyberpunk cell shading.
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

const fragmentShaderHeader = `#version 300 es
precision mediump float;

in vec4 v_normal, world_position, v_color, v_angle, v_project_onto_light[5];

uniform bool u_render_direct;
uniform bool u_is_light_shadow[5];
uniform int u_which_shadow_light, u_texture_mux, u_render_texture;
uniform vec4 u_shift_color;
uniform vec4 u_light_position[5];
uniform float u_ambient_light;
uniform float u_light_brightness[5];
uniform sampler2D u_texture[9];

// NEW UNIFORMS FOR CELL SHADING / CYBERPUNK VIBE
uniform bool u_cell_shading;
uniform vec3 u_neonColor; // A neon tint (e.g. vec3(0.0,1.0,1.0) for a cyan glow)

out vec4 out_color;

vec4 get_shader(int i, vec2 texpos) {
  switch(i) {
    case 0: return texture(u_texture[0], texpos);
    case 1: return texture(u_texture[1], texpos);
    case 2: return texture(u_texture[2], texpos);
    case 3: return texture(u_texture[3], texpos);
    case 4: return texture(u_texture[4], texpos);
    case 5: return texture(u_texture[5], texpos);
    case 6: return texture(u_texture[6], texpos);
    case 7: return texture(u_texture[7], texpos);
    case 8: return texture(u_texture[8], texpos);
    default: return vec4(1.0);
  }
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source); 
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }
  console.log(source.split("\n").map((x, i) => (i+1)+": "+x).join("\n"));
  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return undefined;
}

function createProgram(gl, fragmentShaderSource) {
  const program = gl.createProgram();
  const vertexShaderSource = `#version 300 es
precision mediump float;

in vec4 a_position, a_normal, a_color, a_angle;
out vec4 v_normal, world_position, v_color, v_angle;
out vec4 v_project_onto_light[5];

uniform vec4 u_world_position;
uniform vec4 u_light_position[5];
uniform mat4 u_world_rotation;
uniform mat4 u_light_matrix[5];

void main() {
  world_position = a_position * u_world_rotation - u_world_position;
  v_normal = a_normal * u_world_rotation;
  for (int i = 0; i < 5; i++) {
    v_project_onto_light[i] = u_light_matrix[i] * world_position;
  }
  v_color = a_color;
  v_angle = a_angle;
  gl_Position = world_position; // Placeholder; actual clip-space will be set elsewhere.
}
`;
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShaderSource));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderHeader + fragmentShaderSource));
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const locations = {};
    // A simple extractor for attributes and uniforms:
    const extractTokens = src => {
      const regex = /(?:in|uniform)\s+\w+\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\[[0-9]+\])?)/g;
      let match, tokens = [];
      while ((match = regex.exec(src)) !== null) {
        tokens.push(match[1]);
      }
      return tokens;
    };
    extractTokens(fragmentShaderHeader + vertexShaderSource).forEach(tok => {
      locations[tok] = tok.indexOf("a_") === 0
        ? gl.getAttribLocation(program, tok)
        : gl.getUniformLocation(program, tok);
    });
    return [program, locations];
  }
  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return undefined;
}

function make_proj_matrix(fov, aspect, rotation, position) {
  const f = Math.tan(Math.PI/2 - fov/2);
  // A simple perspective matrix
  const proj = [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, -1, -1,
    0, 0, -0.2, 0
  ];
  const matrices = [proj, rotation, matrix_translate(position.negate()._xyz())];
  return matrices.reduce((a, b) => multiply(a, b));
}

class Camera {
  constructor(position, dimensions, fov, camera_is_light, texture_id, theta, theta2) {
    this.position = position;
    this.dimensions = dimensions;
    this.theta = theta || 0;
    this.theta2 = theta2 || 0;
    this.theta3 = 0;
    this.cull = gl.FRONT;
    this.camera_is_light = camera_is_light;
    this.fov = fov;
    this.aspect = dimensions[0] / dimensions[1];
    this.shadow_camera = this;
    this.texture_id = texture_id;
    [this._texture, this.framebuffer] = setup_framebuffer(texture_id, camera_is_light, ...dimensions);
  }

  draw_scene() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    all_textures.map((tex, i) => {
      gl.activeTexture(gl.TEXTURE19 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(locations[`u_texture[${i+4}]`], i+19);
    });
    [...lights.slice(0,4), this].map((light, i) => {
      gl.uniform4fv(locations[`u_light_position[${i}]`], light.position._xyzw());
      gl.uniformMatrix4fv(locations[`u_light_matrix[${i}]`], true,
        make_proj_matrix(
          light.shadow_camera.fov,
          light.shadow_camera.aspect,
          multiply(matrix_rotate_xz(light.shadow_camera.theta3),
            multiply(matrix_rotate_yz(light.shadow_camera.theta2), matrix_rotate_xy(light.shadow_camera.theta))
          ),
          light.shadow_camera.position
        )
      );
      if (i != 4 && !this.camera_is_light) {
        gl.activeTexture(gl.TEXTURE0+light.id);
        gl.bindTexture(gl.TEXTURE_2D, light.filter._texture);
        gl.uniform1i(locations[`u_texture[${i}]`], light.id);
      }
      gl.uniform1i(locations[`u_is_light_shadow[${i}]`], light.shadow);
      gl.uniform1f(locations[`u_light_brightness[${i}]`], light.brightness);
    });

    if (!going_back || framecount++ % 200 < 10) {
      gl.uniform1f(locations.u_ambient_light, 0.05);
      lights[0].brightness = 1.2;
      lights[1].brightness = 1.2;
      lights[2].brightness = 1.5;
      lights[3].brightness = 4;
    } else {
      gl.uniform1f(locations.u_ambient_light, 1e-4);
      lights[0].brightness = 7;
      lights[1].brightness = 0;
      lights[2].brightness = 8;
      lights[3].brightness = 30;
    }
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    if (this.cull) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(this.cull);
    }
    gl.viewport(0, 0, this.dimensions[0], this.dimensions[1]);
    objects.map(obj => { if (!this.camera_is_light || !obj.gc) obj.render(); });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

var framecount = 0;

class Filter {
  constructor(code, W, H, type, extra_code) {
    this.sprite = new Sprite(lathe([5, 0], 4, 0, 1), ZERO, null, false);
    const shaderSource = fragmentShaderHeader + `//SHADER
vec4 get_tex(int i, vec2 xy_pos) {
  return get_shader(i, (world_position.xy * 0.5 + 0.5) + xy_pos/vec2(${W|0}.0, ${H|0}.0));
}
vec4 get_tex() { return get_tex(0, vec2(0)); }
void main(void) {
${code}
}`;
    const [shaderProgram, prog_locations] = createProgram(gl, shaderSource);
    this._program = shaderProgram;
    this.prog_locations = prog_locations;
    [this._texture, this.framebuffer] = setup_framebuffer(31, type === gl.RG, W, H);
    this.post_filter = (source_texture, other_texture) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.useProgram(shaderProgram);
      gl.uniform4fv(prog_locations.u_shift_color, global_screen_color);
      [
        [source_texture, "u_texture[0]", 30],
        [other_texture, "u_texture[1]", 29]
      ].map(arg => {
        if (arg[0]) {
          gl.activeTexture(gl.TEXTURE0+arg[2]);
          gl.bindTexture(gl.TEXTURE_2D, arg[0]);
          gl.uniform1i(prog_locations[arg[1]], arg[2]);
        }
      });
      gl.uniform4fv(prog_locations.u_world_position, [0,0,0,0]);
      gl.uniformMatrix4fv(prog_locations.u_world_rotation, false, IDENTITY);
      gl.uniformMatrix4fv(prog_locations["u_light_matrix[4]"], false, IDENTITY);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.viewport(0, 0, W, H);
      locations = prog_locations;
      this.sprite.render();
      return this._texture;
    }
  }
}

const gaussian_2d = `//SHADER
vec4 the_res = vec4(0.0);
for (float i = -6.0; i < 7.0; i++) {
  for (float j = -6.0; j < 7.0; j++) {
    the_res += exp(-(i*i+j*j)/9.0) * get_tex(0, vec2(j, i));
  }
}
out_color = the_res / 28.17;
`;

function DrawToScreen$() {
  const W = gl.canvas.width, H = gl.canvas.height;
  const filters = [
    new Filter(`//SHADER
out_color = dot(get_tex(), vec4(21,72,7,0)) > 100.0 ? get_tex() : vec4(0,0,0,1);
`, W, H, gl.RGBA),
    new Filter("out_color = get_tex();", W/4, H/4, gl.RGBA),
    new Filter(gaussian_2d, W/4, H/4, gl.RGBA),
    new Filter("out_color = get_tex();", W, H, gl.RGBA),
    new Filter("out_color = vec4(u_shift_color.rgb + u_shift_color.w*(get_tex(1,vec2(0)) + get_tex()).rgb, 1.0);", W, H, gl.RGBA),
    new Filter("out_color = get_tex();", W, H, gl.RGBA)
  ];
  filters[5].framebuffer = null;
  if (GRAPHICS > 3) {
    camera.framebuffer = null;
    return () => range;
  }
  return source_texture => filters.reduce((prev, cur) => cur.post_filter(prev, source_texture), source_texture);
}

function make_gl_texture(texture_id, texture_types, H, W, data) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + texture_id);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, texture_types ? gl.RG32F : gl.RGBA32F,
                H, W, 0,
                texture_types ? gl.RG : gl.RGBA, gl.FLOAT, data);
  return texture;
}

function setup_framebuffer(texture_id, texture_types, H, W) {
  const texture = make_gl_texture(texture_id, texture_types, H, W);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  
  const depthBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, H, W);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
  
  return [texture, framebuffer];
}

let light_id = 0;
class Light {
  constructor(position, theta, theta2, is_shadow) {
    const N = 1024 >> GRAPHICS;
    this.position = position;
    this.shadow_camera = new Camera(position, [N, N], light_id ? 2.5 : 1, true, this.id = light_id++, theta, theta2);
    this.shadow = is_shadow;
    this._texture = this.shadow_camera._texture;
    this.brightness = 2;
    this.filter = new Filter(gaussian_2d, N/2, N/2, gl.RG);
  }
  compute_shadowmap() {
    this.shadow_camera.position = this.position;
    gl.useProgram(program2);
    locations = locations2;
    gl.activeTexture(gl.TEXTURE0 + this.id);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(locations.u_which_shadow_light, this.id);
    this.shadow_camera.draw_scene();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.filter.post_filter(this._texture);
  }
}

var all_textures = [];
function make_texture(arr) {
  all_textures.push(make_gl_texture(10, 0, 256, 256, new Float32Array(arr)));
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

function setup_graphics() {
  gl.getExtension("EXT_color_buffer_float");
  gl.getExtension("OES_texture_float_linear");
  
  // Program1: main render shader with cyberpunk cell shading option.
  // When u_cell_shading is true, light intensity is quantized and a neon tint is blended.
  const program1Shader = `//SHADER
void main() {
  if(u_render_direct) {
    out_color = v_color;
    return;
  }
  vec3 normal = normalize(v_normal.xyz);
  // Basic diffuse with a directional light from u_light_position[0]
  float lightIntensity = max(dot(normal, normalize(u_light_position[0].xyz - world_position.xyz)), 0.0);
  
  if(u_cell_shading) {
    // Quantize light intensity for a cell-shaded look.
    float levels = 4.0;
    lightIntensity = floor(lightIntensity * levels) / levels;
  }
  
  vec3 baseColor = v_color.rgb * (u_ambient_light + lightIntensity * u_light_brightness[0]);
  
  if(u_cell_shading) {
    // Mix in a neon cyberpunk tint
    baseColor = mix(baseColor, u_neonColor, 0.3);
  }
  
  if(u_render_texture > 0) {
      baseColor *= get_shader(u_texture_mux+5, world_position.xy/32.0).rgb;
  }
  out_color = vec4(baseColor, 1.0);
}
`;
  [program1, locations1] = createProgram(gl, program1Shader);
  [program2, locations2] = createProgram(gl, fragmentShaderHeader + `//SHADER
void main() {
    out_color.r = distance(u_light_position[u_which_shadow_light], world_position);
    out_color.g = out_color.r*out_color.r;
}
`);
  
  // Set up Perlin noise textures for cyberpunk surfaces.
  const lerp = (x,y,r) => { r = r*r*(3-2*r); return x*(1-r)+y*r; };
  const random_points = range(16).map(_=> range(16).map(_=> NewVector(urandom(), urandom(), 0)._normalize()));
  const perlin_noise = cartesian_product_map(range(256), range(256), (y, x) => {
    y /= 16; x /= 16;
    const up_left = NewVector(Math.floor(x), Math.floor(y), 0);
    const out = cartesian_product_map(range(2), range(2), (dy, dx) =>
      random_points[(Math.floor(y)+dy)&15][(Math.floor(x)+dx)&15].dot(
        up_left.add(NewVector(dx - x, dy - y, 0))
      )
    );
    const lerp1 = lerp(out[0], out[1], x - up_left.x);
    const lerp2 = lerp(out[2], out[3], x - up_left.x);
    return 2 * lerp(lerp1, lerp2, y - up_left.y) + 0.2;
  });
  
  // Build textures.
  make_texture(perlin_noise.map(x=> [x,x,x,1]).flat());
  make_texture(perlin_noise.map(x=> [x,0,0,1]).flat());
  make_texture(cartesian_product_map(range(256), range(256), (y, x) => {
    if ((y % 64) <= 2 || Math.abs(x - (((Math.floor(y/64)) % 2)*128)) <= 2) {
      return [0,0,0,1];
    } else {
      const r = 0.9 - perlin_noise[x*256+y]/20;
      return [r, r, r, 1];
    }
  }).flat());
  
  const r = cartesian_product_map(range(16), range(8), (y, x) => [32*y, 64*(x+(y%2)/2), 1+(y%2)]);
  make_texture(cartesian_product_map(range(256), range(256), (y,x) => {
    const tmp = r.map(p => [p[2]*(Math.abs(p[0]-x)+Math.abs(p[1]-y)), p[2]]).sort((a,b)=> a[0]-b[0]);
    if (Math.abs(tmp[0][0]-tmp[1][0]) < 4) {
      return [1,1,1,1];
    }
    return [0.1,0.1,0.1,1];
  }).flat());
  make_texture(perlin_noise.map(x=> [x,0,0,1]).flat());
}
