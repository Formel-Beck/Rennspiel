// =====================================================
//  COMIC-LOOK
//  1) Licht in klaren Stufen statt weicher Verläufe (Cel-Shading).
//     Das wird direkt in die Three.js-Shader eingebaut, darum
//     wirkt es auf alle Materialien, ohne dass man sie tauscht.
//  2) Etwas kräftigere Farben.
//  3) Dunkle Umrisslinien um Autos, Fahrer, Bäume, Häuser …
//     Die Linien sind auf dem Bildschirm immer gleich dünn und
//     werden in der Ferne feiner – so bleibt es sauber.
// =====================================================
window.Comic = (() => {
  const ON = true;
  const SAT = 1.35;         // Farbsättigung
  const LINE = 2.6;         // Linienstärke in Bildpunkten (nah)
  const LINE_FAR = 140;     // ab dieser Entfernung (m) verschwinden die Linien

  // ---------- 1+2: Shader anpassen (muss vor dem ersten Zeichnen passieren) ----------
  if (ON) {
    const C = THREE.ShaderChunk;
    // weiche Stufen-Funktion: Schatten / Halbschatten / Licht
    C.common += `
float comicStep(float x) {
  float a = mix(0.42, 0.74, smoothstep(0.04, 0.10, x));
  return mix(a, 1.0, smoothstep(0.40, 0.48, x));
}`;
    // Phong (Autos, Strasse, Häuser …)
    C.lights_phong_pars_fragment = C.lights_phong_pars_fragment
      .replace('float dotNL = saturate( dot( geometry.normal, directLight.direction ) );',
        `#ifdef NO_COMIC
	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
	#else
	float dotNL = comicStep( saturate( dot( geometry.normal, directLight.direction ) ) );
	#endif`)
      .replace('reflectedLight.directSpecular += irradiance * BRDF_Specular_BlinnPhong( directLight, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;',
        `vec3 spc = irradiance * BRDF_Specular_BlinnPhong( directLight, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;
	float sl = dot( spc, vec3( 0.3333 ) );
	reflectedLight.directSpecular += spc / max( sl, 0.0001 ) * smoothstep( 0.30, 0.38, sl ) * 0.45;`);
    // Lambert (Gelände, Bäume, Zuschauer …) – wird pro Eckpunkt gerechnet
    C.lights_lambert_vertex = C.lights_lambert_vertex.split('vLightFront += saturate( dotNL ) * directLightColor_Diffuse;')
      .join(`#ifdef NO_COMIC
		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
		#else
		vLightFront += comicStep( saturate( dotNL ) ) * directLightColor_Diffuse;
		#endif`);
    // kräftigere Farben für alle eingebauten Materialien
    // "Vibrance": blasse Farben werden kräftiger, schon knallige bleiben fast gleich
    C.tonemapping_fragment = `{ vec3 c = gl_FragColor.rgb; float mx = max( c.r, max( c.g, c.b ) ), mn = min( c.r, min( c.g, c.b ) );
  float amt = ${(SAT - 1).toFixed(2)} * clamp( 1.0 - ( mx - mn ) * 1.8, 0.0, 1.0 );
  gl_FragColor.rgb = clamp( mix( vec3( dot( c, vec3( 0.299, 0.587, 0.114 ) ) ), c, 1.0 + amt ), 0.0, 1.0 ); }\n` + C.tonemapping_fragment;
  }

  // ---------- 3: Umrisslinien ----------
  const lineMat = new THREE.ShaderMaterial({
    uniforms: { res: { value: new THREE.Vector2(innerWidth || 1280, innerHeight || 720) }, color: { value: new THREE.Color('#1c1426') } },
    vertexShader: `
      uniform vec2 res;
      attribute vec3 onormal;
      varying float vFade;
      void main() {
        vec4 p = vec4( position, 1.0 );
        vec3 n = onormal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3( instanceMatrix ) * n;
        #endif
        vec4 mv = modelViewMatrix * p;
        vec4 clip = projectionMatrix * mv;
        vec3 vn = normalize( mat3( modelViewMatrix ) * n );
        float dist = -mv.z;
        vFade = 1.0 - smoothstep( ${(LINE_FAR * 0.6).toFixed(1)}, ${LINE_FAR.toFixed(1)}, dist );
        // nah: feste Pixelbreite, weiter weg langsam dünner
        float px = ${LINE.toFixed(2)} * clamp( 35.0 / max( dist, 1.0 ), 0.5, 1.0 ) * vFade;
        vec2 dir = vn.xy; float l = length( dir );
        dir = l > 0.0001 ? dir / l : vec2( 0.0 );
        clip.xy += dir * px * 2.0 / res * clip.w;
        clip.z += 0.0004 * clip.w; // Linie ein wenig nach hinten, damit sie nicht flackert
        gl_Position = clip;
      }`,
    fragmentShader: `
      uniform vec3 color;
      varying float vFade;
      void main() { if ( vFade < 0.02 ) discard; gl_FragColor = vec4( color, 1.0 ); }`,
    side: THREE.BackSide
  });

  // Weiche Normalen fürs Aufblasen: Bei kantigen Modellen hat jede Ecke
  // mehrere Normalen – wir mitteln sie, sonst reisst die Linie an den Kanten.
  function outlineNormals(geo) {
    if (geo.attributes.onormal) return true;
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    if (!pos || !nor || pos.count > 60000) return false;
    const map = new Map(), key = i => Math.round(pos.getX(i) * 500) + '_' + Math.round(pos.getY(i) * 500) + '_' + Math.round(pos.getZ(i) * 500);
    const keys = new Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const k = keys[i] = key(i);
      let v = map.get(k); if (!v) map.set(k, v = [0, 0, 0]);
      v[0] += nor.getX(i); v[1] += nor.getY(i); v[2] += nor.getZ(i);
    }
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const v = map.get(keys[i]), l = Math.hypot(v[0], v[1], v[2]) || 1;
      arr[i * 3] = v[0] / l; arr[i * 3 + 1] = v[1] / l; arr[i * 3 + 2] = v[2] / l;
    }
    geo.setAttribute('onormal', new THREE.BufferAttribute(arr, 3));
    return true;
  }

  const firstMat = o => Array.isArray(o.material) ? o.material[0] : o.material;
  const tmpS = new THREE.Vector3();
  function wants(o) {
    if (!(o.isMesh || o.isInstancedMesh) || o.userData.comicDone || o.userData.noOutline || o.isSprite) return false;
    const m = firstMat(o);
    if (!m || m.isShaderMaterial || m.isMeshBasicMaterial || m.isPointsMaterial || m.isSpriteMaterial) return false;
    if (m.transparent && m.opacity < 0.95 && !(m.userData && m.userData.op)) return false;
    if (m.blending === THREE.AdditiveBlending) return false;
    const geo = o.geometry; if (!geo || !geo.attributes.normal) return false;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    o.getWorldScale(tmpS);
    const r = geo.boundingSphere.radius * Math.max(tmpS.x, tmpS.y, tmpS.z);
    return r > 0.12 && r < 22; // keine winzigen Teile, kein Gelände/Strasse/Tunnel
  }

  const lines = [];
  // Neue Objekte in der Szene suchen und Linien anhängen (läuft alle paar Bilder)
  function scan(root) {
    if (!ON || !root) return;
    const todo = [];
    root.traverse(o => { if (wants(o)) todo.push(o); else if (o.isMesh || o.isInstancedMesh) o.userData.comicDone = true; });
    for (const o of todo) {
      o.userData.comicDone = true;
      if (!outlineNormals(o.geometry)) continue;
      let ol;
      if (o.isInstancedMesh) {
        ol = new THREE.InstancedMesh(o.geometry, lineMat, o.count);
        ol.instanceMatrix = o.instanceMatrix; ol.count = o.count; ol.frustumCulled = o.frustumCulled;
      } else ol = new THREE.Mesh(o.geometry, lineMat);
      ol.userData.comicDone = true; ol.userData.isLine = true; ol.userData.src = o;
      ol.castShadow = ol.receiveShadow = false; ol.raycast = () => {};
      o.add(ol);
      lines.push(ol);
    }
    // Linien ausblenden, wenn ihr Objekt unsichtbar oder durchsichtig ist (z. B. Geist-Item)
    for (let i = lines.length - 1; i >= 0; i--) {
      const ol = lines[i], src = ol.userData.src, m = firstMat(src);
      if (!src.parent) { lines.splice(i, 1); continue; }
      ol.visible = !(m && m.transparent && m.opacity < 0.95) && src.visible;
      if (src.isInstancedMesh) ol.count = src.count;
    }
  }

  // Himmel und Nebel etwas klarer und farbiger
  function boost(c, s, l) { const h = {}; c.getHSL(h); c.setHSL(h.h, Math.min(1, h.s * s + 0.04), Math.min(0.92, h.l * l)); }
  function world(w) {
    if (!ON || !w || w.userData_comic) return;
    w.userData_comic = true;
    const sky = w.scene.children.find(c => c.material && c.material.isShaderMaterial && c.material.uniforms && c.material.uniforms.top);
    const fix = () => {
      if (sky) { boost(sky.material.uniforms.top.value, 1.25, 0.98); boost(sky.material.uniforms.bottom.value, 1.2, 1.02); }
      if (w.scene.fog) boost(w.scene.fog.color, 1.2, 1.02);
    };
    // Gelände (grösstes Objekt) behält weiche Schattierung, sonst wirken die Hügel flach
    let terr = null, most = 0;
    w.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count > most) { most = o.geometry.attributes.position.count; terr = o; } });
    if (terr && most > 3000) for (const m of [].concat(terr.material)) { m.defines = Object.assign({}, m.defines, { NO_COMIC: '' }); m.needsUpdate = true; }
    if (w.scene.fog) { w.scene.fog.near *= 1.25; w.scene.fog.far *= 1.25; }
    const orig = w.setAtmosphere;
    w.setAtmosphere = function () { const r = orig.apply(this, arguments); fix(); return r; };
    fix();
  }
  function resize(wd, ht) { lineMat.uniforms.res.value.set(wd, ht); }
  return { scan, world, resize, on: ON };
})();
