import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.115.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.115.0/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.115.0/examples/jsm/loaders/OBJLoader.js';
import { MeshSurfaceSampler } from 'https://cdn.jsdelivr.net/npm/three@0.115.0/examples/jsm/math/MeshSurfaceSampler.js';

// soundcloud widget section
var widget = SC.Widget(scWidget);
widget.bind(SC.Widget.Events.PLAY, ()=>{
  veil.style.display = "none";
  scWidget.style.display = "none";
  /*scWidget.style.height = "20vh";
  scWidget.style.left = "0px";
  scWidget.style.top = "0px";*/
  sequence();
});
////////////////////////////

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  1,
  1000
);
camera.position.set(0, 5, 10);
//camera.lookAt(0, 5, 0);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
let bc = new THREE.Color(0xffaacc);
renderer.setClearColor(bc);
//console.log(new THREE.Color(0xff88aa));
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", onWindowResize, false);

var controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = -0.5;
controls.minPolarAngle = THREE.Math.DEG2RAD * 80;
controls.maxPolarAngle = THREE.Math.DEG2RAD * 100;
controls.minDistance = 5;
controls.maxDistance = 12.5;
controls.target.set(0, 4, 0);
controls.update();

var baseGeom = new THREE.CircleBufferGeometry(6, 64);
baseGeom.rotateX(-Math.PI * 0.5);
var baseMat = new THREE.MeshBasicMaterial({color: 0xff0088});
baseMat.defines = {"USE_UV" : ""};
baseMat.onBeforeCompile = shader => {
  //console.log(shader.fragmentShader);
  shader.fragmentShader = shader.fragmentShader.replace(
    `gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,
    `
      vec3 col = vec3(${bc.r}, ${bc.g}, ${bc.b});
      vec2 uv = vUv - 0.5;
      uv *= 2.;
      col = mix(outgoingLight, col, length(uv));
      gl_FragColor = vec4(col, diffuseColor.a);
    `
  );
}
var base = new THREE.Mesh(baseGeom, baseMat);
base.position.y = -0.15
scene.add(base);

// tree
var uniformsTree = {
  time: {value: 0}
};
var loader = new OBJLoader();
loader.load( 'https://threejs.org/examples/models/obj/tree.obj', object => {
  
  //object.children[0].visible = false;
  
  let mat = new THREE.MeshBasicMaterial({color: 0xff2266, wireframe: false, transparent: true, opacity: 0.75});
  object.children[0].material = mat;
  
  let sampler = new MeshSurfaceSampler( object.children[0] )
					.setWeightAttribute( null )
					.build();
  let pts = [];
  let angle = [];
  let idx = [];
  let n = new THREE.Vector3();
  for (let i = 0; i < 1250; i++){
    let p = new THREE.Vector3();
    sampler.sample(p, n);
    pts.push(p);
    angle.push(Math.random() * Math.PI * 2 / 5);
    idx.push(i);
  }

  let treePoints = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({color:0xffbbff, size: 0.25}));
  treePoints.geometry.setAttribute("angle", new THREE.BufferAttribute(new Float32Array(angle), 1));
  treePoints.geometry.setAttribute("idx", new THREE.BufferAttribute(new Float32Array(idx), 1));
  treePoints.material.onBeforeCompile = shader => {
    //console.log(shader.vertexShader);
    shader.uniforms.time = uniformsTree.time;
    shader.vertexShader = `
    uniform float time;

    attribute float angle;
    attribute float idx;
    
    varying float vAngle;
` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `#include <begin_vertex>
       vAngle = angle;
`
    );
    shader.vertexShader = shader.vertexShader.replace(
      `gl_PointSize = size;`,
      `float halfSize = size * 0.5;
      float tIdx = idx + time;
gl_PointSize = size + (sin(tIdx) * cos(tIdx * 2.5) * 0.5 + 0.5) * halfSize * 0.5;`
    );
    
    shader.fragmentShader = `
      varying float vAngle;
` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
    `#include <clipping_planes_fragment>`,
    `
    vec2 uv = gl_PointCoord - 0.5;

    float a = atan(uv.y, uv.x) + vAngle;
    float f = 0.4 + 0.1 * cos(a * 5.);
    f = 1. - step(f, length(uv));
    if (f < 0.5) discard;  // shape function

    #include <clipping_planes_fragment>`
  );
    shader.fragmentShader = shader.fragmentShader.replace(
      `vec4 diffuseColor = vec4( diffuse, opacity );`,
      `
        vec3 col = vec3(1, 1, 0.8);
        uv *= 2.;
        float d = clamp(length(uv), 0., 1.);
        vec4 diffuseColor = vec4(mix(col, diffuse, pow(d, 2.)), 1.);
`
    );
    //console.log(shader.fragmentShader);
  }
  
  object.add(treePoints);
  
  object.rotation.y = THREE.Math.DEG2RAD * 20;
  object.scale.setScalar(5);
  scene.add(object);
// interface
  percentage.style.display = "none";
  scWidget.style.display = "block";
},
function ( xhr ) {
  percentage.innerText = (xhr.loaded / xhr.total * 100).toFixed(0) + '%';
});


// petals

var r = 4.5; // radius
var MAX_POINTS = 15000;
var pointsCount = 0;
let points = []; //3
let delay = [];  //1
let speed = [];  //2
let color = [];  //3
let c = new THREE.Color();
while( pointsCount < MAX_POINTS){
  let vec = new THREE.Vector3(THREE.Math.randFloat(-r, r), 0, THREE.Math.randFloat(-r, r));
  let rRatio = vec.length() / r;
  if (vec.length() <= r && Math.random() < (1. - rRatio)) {
    points.push(vec);
    c.set(0xffffcc);
    color.push(c.r,c.g - Math.random() * 0.1,c.b + Math.random() * 0.2);
    delay.push(THREE.Math.randFloat(-10,0));
    let val = THREE.Math.randFloat(1, 2);
    val = Math.random() < 0.25 ? 0 : val;
    speed.push(Math.PI * val * 0.125, val); // angle, height
    pointsCount++;
  }
}
console.log(points.length);
let pointsGeom = new THREE.BufferGeometry().setFromPoints(points);
pointsGeom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(color), 3));
pointsGeom.setAttribute("delay", new THREE.BufferAttribute(new Float32Array(delay), 1));
pointsGeom.setAttribute("speed", new THREE.BufferAttribute(new Float32Array(speed), 2));

// 2020 texture ////////////////////////////////////////////////
var cnvs = document.createElement("canvas");
cnvs.width = 128;
cnvs.height = 64;
var ctx = cnvs.getContext("2d");

ctx.fillStyle = "transparent";
ctx.fillRect(0, 0, cnvs.width, cnvs.height);
ctx.fillStyle = "#f00";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.font = "bold 56px Arial";
ctx.fillText("2026", cnvs.width * 0.5, cnvs.height * 0.5);
var tex2020 = new THREE.CanvasTexture(cnvs);
/////////////////////////////////////////////////////////////////

var uniforms = {
  time: {value: 0},
  upperLimit: {value: 10},
  upperRatio: {value: 1.25},
  spiralRadius: {value: 1},
  spiralTurns: {value: 1.},
  tex2020: {value: tex2020},
  azimuth: {value: 0}
}
var pointsMat = new THREE.PointsMaterial({/*color: 0xffddaa,*/ vertexColors: THREE.VertexColors, size: 0.2});
pointsMat.onBeforeCompile = shader => {
  
  shader.uniforms.time = uniforms.time;
  shader.uniforms.upperLimit = uniforms.upperLimit;
  shader.uniforms.upperRatio = uniforms.upperRatio;
  shader.uniforms.spiralRadius = uniforms.spiralRadius;
  shader.uniforms.spiralTurns = uniforms.spiralTurns;
  shader.uniforms.tex2020 = uniforms.tex2020;
  shader.uniforms.azimuth = uniforms.azimuth;
  
  shader.vertexShader = `
  uniform float time;
  uniform float upperLimit;
  uniform float upperRatio;
  uniform float spiralRadius;
  uniform float spiralTurns;
  uniform sampler2D tex2020;
  uniform float azimuth;

  attribute float delay;
  attribute vec2 speed;

  varying float vRatio;
  varying vec2 vSpeed;
  varying float vIsEffect;

  mat2 rot( float a){
    return mat2(cos(a), -sin(a), sin(a), cos(a));
  }

` + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    `#include <begin_vertex>`,
    `#include <begin_vertex>

    float t = time + delay;
    t = t < 0. ? 0. : t;
    
    float h = mod(speed.y * t, upperLimit);
    float hRatio = clamp(h / upperLimit, 0., 1.);
    vRatio = hRatio;
    vSpeed = speed;
    
    transformed.y = h;
    
    float a = atan(position.x, position.z);
    a += speed.x * t;
    float initLength = length(position.xz);
    float finalLength = initLength * upperRatio;
    float ratio = mix(initLength, finalLength, hRatio);
    transformed.x = cos(a) * ratio;
    transformed.z = sin(a) * -ratio;
    
    float sTurns = sin(time * 0.5) * 0.5 + spiralTurns;

    float spiralA = hRatio * sTurns * PI * 2.;
    float sRadius = mix(spiralRadius, 0., hRatio);
    transformed.x += cos(spiralA) * sRadius;
    transformed.z += sin(spiralA) * -sRadius;

    // 2020 effect
    vec3 efcPos = vec3(0, 6, 0.5);
    vec3 efcClamp = vec3(1., 0.75, 0.25) * 3.5;
    vec3 efcMin = efcPos - efcClamp;
    vec3 efcMax = efcPos + efcClamp;
    vec3 UVTransformed = vec3(transformed);
    UVTransformed.xz *= rot(azimuth); // following the camera's azimuthal angle    
    vec3 efcUV = (UVTransformed - efcMin) / (efcMax - efcMin);
    
    float isEffect = texture2D(tex2020, efcUV.xy).r;
    isEffect *= (efcUV.z > 0. && efcUV.z < 1.) ? 1. : 0.;
    vIsEffect = isEffect;
`
  );
  shader.vertexShader = shader.vertexShader.replace(
    `gl_PointSize = size;`,
    `bool cond = floor(speed.y + 0.5) == 0.;
gl_PointSize = size * ( cond ? 0.75 : ((1. - hRatio) * (smoothstep(0., 0.01, hRatio) * 0.25) + 0.75));
    gl_PointSize = mix(gl_PointSize, size * 2., isEffect);
    `
  );
  shader.fragmentShader = `
  uniform float time;

  varying float vRatio;
  varying vec2 vSpeed;
  varying float vIsEffect;
  mat2 rot( float a){
    return mat2(cos(a), -sin(a), sin(a), cos(a));
  }
` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <clipping_planes_fragment>`,
    `
    if (vRatio == 1.) discard;

    vec2 uv = gl_PointCoord - 0.5;

    float a = (time * vSpeed.x + vSpeed.x) * 10.;
    
    uv *= rot(a);
    uv.y *= floor(a + 0.5) == 0. ? 1.25 : 2. + sin(a * PI);

    if (length(uv) > 0.5) discard;  // shape function

    #include <clipping_planes_fragment>`
  );
  shader.fragmentShader = shader.fragmentShader.replace(
      `vec4 diffuseColor = vec4( diffuse, opacity );`,
      `
        vec3 col = vec3(1, 0.7, 0.9);
        float d = clamp(uv.x + .5, 0., 1.);
        vec4 diffuseColor = vec4(mix(diffuse, col, pow(d, 2.)), 1.);
        diffuseColor = vec4(mix(diffuseColor.rgb, vec3(0.95, 0, 0.45), vIsEffect), 1.);
`
    );
  //console.log(shader.fragmentShader);
}

var p = new THREE.Points(pointsGeom, pointsMat);
scene.add(p);

var clock = new THREE.Clock();
var t = 0;

function sequence() {

  renderer.setAnimationLoop(() => {

    t += clock.getDelta()*0.5;
    uniforms.time.value = t;
    uniforms.azimuth.value = controls.getAzimuthalAngle();
    uniformsTree.time.value = t * 5;
    controls.update();
    renderer.render(scene, camera);

  });
  
}

//btnRepeat.addEventListener("click", event => {t = 0;}, false);



function onWindowResize() {
  
  var width = window.innerWidth;
  var height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  
}