import type { WebGLProgramParametersWithUniforms } from "three";

export const NOISE = `
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){float n=0.0,a=0.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.07+vec3(7.1);a*=0.5;}return n;}
`;

export function basaltShader(shader: WebGLProgramParametersWithUniforms) {
  shader.vertexShader = "varying vec3 vStone;\n" + shader.vertexShader.replace(
    "#include <begin_vertex>", "#include <begin_vertex>\nvStone=position;",
  );
  shader.fragmentShader = "varying vec3 vStone;\n" + NOISE + shader.fragmentShader.replace(
    "#include <color_fragment>", `#include <color_fragment>
      float grain=noise(vStone*9.0);
      float strata=sin(vStone.y*18.0+noise(vStone*2.1)*8.0);
      float fissure=smoothstep(0.48,0.58,noise(vStone*5.0));
      diffuseColor.rgb*=0.72+grain*0.24+strata*0.06+fissure*0.08;
    `,
  );
}

export const LAVA_VERTEX = `
varying vec2 vUv;
#include <fog_pars_vertex>
void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;

export const LAVA_FRAGMENT = `
uniform float uTime;varying vec2 vUv;
#include <fog_pars_fragment>
${NOISE}
void main(){
  float n=fbm(vec3(vUv.x*7.0,vUv.y*1.7-uTime*0.22,uTime*0.035));
  float edge=smoothstep(0.32,0.50,abs(vUv.x-0.5));
  float crust=smoothstep(0.46,0.67,n+edge*0.3);
  vec3 hot=mix(vec3(1.3,0.018,0.001),vec3(1.8,0.15,0.003),smoothstep(0.22,0.49,n));
  gl_FragColor=vec4(mix(hot,vec3(0.035,0.022,0.02),crust*0.96),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export const FIRE_FRAGMENT = `
uniform float uTime;varying vec2 vUv;
${NOISE}
void main(){
  vec2 p=vec2((vUv.x-0.5)*2.0,vUv.y);
  float n=fbm(vec3(p.x*4.0,p.y*5.0-uTime*2.7,uTime*0.3));
  float width=(1.0-p.y)*0.8+sin(p.y*14.0-uTime*4.0)*0.09;
  float flame=1.0-smoothstep(width-0.28,width+0.07,abs(p.x)+(n-0.45)*0.5);
  float alpha=flame*smoothstep(0.0,0.08,p.y)*(1.0-smoothstep(0.65,1.0,p.y));
  vec3 c=mix(vec3(1.0,0.07,0.003),vec3(1.7,0.64,0.1),flame*(1.0-p.y));
  gl_FragColor=vec4(c,alpha*0.95);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
