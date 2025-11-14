let context;
let renderCanvas;
let geometryBuffer;
let posAttr;
let lightUniform;
let modeUniform;
let lightSlider;
let lightPosition = [-5.0, 3.0, 5.0];
let renderMode = 4;

const VERTEX_SRC = `#version 300 es
in vec3 aPosition;

void main() {
    gl_Position = vec4(aPosition, 1.0);
}`;

const FRAGMENT_SRC = `#version 300 es
precision mediump float;

uniform vec3 uLightPosition;
uniform int choice;

out vec4 fragColor;

struct Sphere {
    vec3 center;
    float radius;
    vec3 color;
    float shininess;
};

struct Ray {
    vec3 origin;
    vec3 direction;
};

vec3 cameraPos = vec3(0.0, 0.0, 1.0);
float sphereScaleFactor = 1.0;

float intersectSphere(vec3 rayOrg, vec3 rayDir, Sphere sphere) {
    vec3 v = rayOrg - sphere.center;
    float a = dot(rayDir, rayDir);
    float b = 2.0 * dot(v, rayDir);
    float c = dot(v, v) - sphere.radius * sphere.radius;
    float D = b * b - 4.0 * a * c;

    if (D < 0.0) {
        return 0.0;
    }
    
    float pt1 = (-b - sqrt(D)) / (2.0 * a);
    float pt2 = (-b + sqrt(D)) / (2.0 * a);
    return min(pt1, pt2);
}

vec3 phongShading(vec3 normal, vec3 intPt, vec3 diffuseTerm, float AlphaSpecular) {
    vec3 L = normalize(uLightPosition - intPt);
    vec3 n = normalize(normal);
    vec3 v = normalize(cameraPos - intPt);
    vec3 r = normalize(reflect(-L, n));

    float intensity = 1.0;
    float diffuse = intensity * max(dot(L, n), 0.0);
    float specular = intensity * pow(max(dot(v, r), 0.0), AlphaSpecular);
    float ambient = intensity * 0.3;

    return diffuse * diffuseTerm + ambient * diffuseTerm + specular * vec3(1.0, 1.0, 1.0);
}

vec3 phongShadingNoSpec(vec3 normal, vec3 intPt, vec3 diffuseTerm) {
    vec3 L = normalize(uLightPosition - intPt);
    vec3 n = normalize(normal);

    float intensity = 1.0;
    float diffuse = intensity * max(dot(L, n), 0.0);
    float ambient = intensity * 0.3;

    return diffuse * diffuseTerm + ambient * diffuseTerm;
}

void main() {
    Sphere spheres[7];
    spheres[0] = Sphere(vec3(-0.2, -0.35, 0.1), 0.2 * sphereScaleFactor, vec3(0.0, 0.76, 0.0), 10.0);
    spheres[1] = Sphere(vec3(0.15, -0.3, 0.0), 0.2 * sphereScaleFactor, vec3(0.0, 0.42, 0.23), 12.0);
    spheres[2] = Sphere(vec3(0.3, 0.04, 0.0), 0.2 * sphereScaleFactor, vec3(0.0, 0.58, 0.58), 20.0);
    spheres[3] = Sphere(vec3(0.15, 0.38, -0.2), 0.22 * sphereScaleFactor, vec3(0.0, 0.44, 0.73), 15.0);
    spheres[4] = Sphere(vec3(-0.25, 0.7, -0.7), 0.28 * sphereScaleFactor, vec3(0.0, 0.23, 0.73), 25.0);
    spheres[5] = Sphere(vec3(-0.65, 0.45, -0.9), 0.28 * sphereScaleFactor, vec3(0.3, 0.15, 0.6), 17.0);
    spheres[6] = Sphere(vec3(-0.45, 0.08, -1.5), 0.4 * sphereScaleFactor, vec3(0.46, 0.13, 0.46), 14.0);

    Ray ray;
    ray.origin = cameraPos;
    vec2 screenPos = gl_FragCoord.xy / vec2(500.0, 500.0);
    ray.direction = normalize(vec3(screenPos * 2.0 - 1.0, -1.0));

    float leastT = 1e8;
    int closestSph = -1;

    for (int i = 0; i < 7; i++) {
        float t = intersectSphere(ray.origin, ray.direction, spheres[i]);
        if (t > 0.0 && t < leastT) {
            leastT = t;
            closestSph = i;
        }
    }

    if (closestSph == -1) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        vec3 intersectionPoint = ray.origin + leastT * ray.direction;
        vec3 normal = normalize(intersectionPoint - spheres[closestSph].center);
        vec3 phongColor = phongShading(normal, intersectionPoint, spheres[closestSph].color, spheres[closestSph].shininess);
        vec3 phongColorNoSpec = phongShadingNoSpec(normal, intersectionPoint, spheres[closestSph].color);

        bool shadow = false;
        for (int i = 0; i < 7; i++) {
            if (i == closestSph) continue;
            float t = intersectSphere(intersectionPoint, normalize(uLightPosition - intersectionPoint), spheres[i]);
            if (t > 0.0) {
                shadow = true;
                break;
            }
        }

        Ray reflRay;
        reflRay.origin = intersectionPoint + 0.001 * normal;
        reflRay.direction = normalize(reflect(ray.direction, normal));

        leastT = 1e8;
        closestSph = -1;

        for (int i = 0; i < 7; i++) {
            float t = intersectSphere(reflRay.origin, reflRay.direction, spheres[i]);
            if (t > 0.0 && t < leastT) {
                leastT = t;
                closestSph = i;
            }
        }

        vec3 reflColor = vec3(0.0, 0.0, 0.0);
        vec3 reflColorNoSpec = vec3(0.0, 0.0, 0.0);
        if (closestSph != -1) {
            intersectionPoint = reflRay.origin + leastT * reflRay.direction;
            normal = normalize(intersectionPoint - spheres[closestSph].center);
            reflColor = phongShading(normal, intersectionPoint, spheres[closestSph].color, spheres[closestSph].shininess);
            reflColorNoSpec = phongShadingNoSpec(normal, intersectionPoint, spheres[closestSph].color);
        }

        if (choice == 1 || (choice == 3 && shadow == false)) {
            fragColor = vec4(phongColor, 1.0);
        } else if (choice == 2 || (choice == 4 && shadow == false)) {
            fragColor = vec4(phongColor + 0.5 * reflColor, 1.0);
        } else if (choice == 3 && shadow == true) {
            fragColor = vec4(0.4 * phongColorNoSpec, 1.0);
        } else {
            fragColor = vec4(0.4 * (phongColorNoSpec + 0.5 * reflColorNoSpec), 1.0);
        }
    }
}`;

function compileShader(type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    alert(context.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function createProgram(vertexSrc, fragmentSrc) {
  const program = context.createProgram();
  const vShader = compileShader(context.VERTEX_SHADER, vertexSrc);
  const fShader = compileShader(context.FRAGMENT_SHADER, fragmentSrc);

  context.attachShader(program, vShader);
  context.attachShader(program, fShader);
  context.linkProgram(program);

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    console.log(context.getShaderInfoLog(vShader));
    console.log(context.getShaderInfoLog(fShader));
  }

  context.useProgram(program);
  return program;
}

function setupContext(canvas) {
  try {
    context = canvas.getContext("webgl2");
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } catch (e) {}

  if (!context) {
    alert("WebGL initialization failed");
  }
}

function initGeometry() {
  geometryBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, geometryBuffer);
  const vertices = new Float32Array([-1, 1, 0, 1, 1, 0, -1, -1, 0, -1, -1, 0, 1, 1, 0, 1, -1, 0]);
  context.bufferData(context.ARRAY_BUFFER, vertices, context.STATIC_DRAW);
}

function render() {
  context.viewport(0, 0, context.viewportWidth, context.viewportHeight);
  context.clearColor(0.0, 0.0, 0.0, 1.0);
  context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);

  context.bindBuffer(context.ARRAY_BUFFER, geometryBuffer);
  context.vertexAttribPointer(posAttr, 3, context.FLOAT, false, 0, 0);
  context.uniform3fv(lightUniform, lightPosition);
  context.uniform1i(modeUniform, renderMode);
  context.drawArrays(context.TRIANGLES, 0, 6);
}

function updateMode(mode) {
  renderMode = mode;
  render();
}

function onLightUpdate() {
  lightPosition = [parseFloat(lightSlider.value), 3.0, 5.0];
  render();
}

function init() {
  renderCanvas = document.getElementById("RayTracing");
  setupContext(renderCanvas);

  const program = createProgram(VERTEX_SRC, FRAGMENT_SRC);

  posAttr = context.getAttribLocation(program, "aPosition");
  lightUniform = context.getUniformLocation(program, "uLightPosition");
  modeUniform = context.getUniformLocation(program, "choice");

  context.enableVertexAttribArray(posAttr);

  lightSlider = document.getElementById("LightSlider");
  lightSlider.addEventListener("input", onLightUpdate);

  initGeometry();
  render();
}
