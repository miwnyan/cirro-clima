(() => {
  'use strict';
  const canvas = document.getElementById('atmosphere-canvas');
  const toggle = document.getElementById('motion-toggle');
  if (!canvas || !toggle) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) {
    document.documentElement.classList.add('webgl-unavailable');
    toggle.textContent = 'Ambiente estático';
    toggle.disabled = true;
    return;
  }

  const vertexSource = `attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}`;
  const fragmentSource = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform float mode;
    uniform float precipitation;
    uniform float wind;
    uniform float daylight;

    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0)),f.x),f.y);
    }
    float fbm(vec2 p){
      float value=0.0,amp=0.5;
      for(int i=0;i<5;i++){value+=amp*noise(p);p=p*2.03+17.17;amp*=0.5;}
      return value;
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution.xy;
      vec2 p=(gl_FragCoord.xy*2.0-resolution.xy)/resolution.y;
      float day=clamp(daylight,0.0,1.0);
      vec3 nightBottom=vec3(0.018,0.055,0.10);
      vec3 nightTop=vec3(0.01,0.022,0.055);
      vec3 dayBottom=vec3(0.24,0.54,0.66);
      vec3 dayTop=vec3(0.045,0.17,0.32);
      vec3 sky=mix(mix(nightBottom,nightTop,uv.y),mix(dayBottom,dayTop,uv.y),day);
      float storm=step(3.5,mode);
      sky=mix(sky,vec3(0.035,0.065,0.09),storm*0.72);

      float sunX=0.1+0.8*daylight;
      float sunY=0.58+0.22*sin(daylight*3.14159);
      float sun=exp(-48.0*distance(uv,vec2(sunX,sunY)));
      sky+=vec3(1.0,0.66,0.28)*sun*day*(1.0-storm);
      float moon=exp(-70.0*distance(uv,vec2(0.72,0.76)));
      sky+=vec3(0.5,0.68,0.82)*moon*(1.0-day);

      vec2 cloudUv=vec2(uv.x*3.0+time*wind*0.03,uv.y*4.1-time*0.006);
      float cloud=fbm(cloudUv+fbm(cloudUv*1.7));
      cloud=smoothstep(0.48,0.77,cloud+0.05*sin(uv.y*9.0));
      float cloudAmount=mode<0.5?0.24:mode<1.5?0.62:0.83;
      vec3 cloudColor=mix(vec3(0.72,0.84,0.86),vec3(0.14,0.19,0.24),smoothstep(1.5,4.0,mode));
      sky=mix(sky,cloudColor,cloud*cloudAmount*(0.25+uv.y*0.75));

      if(mode>1.5&&mode<2.5||mode>3.5){
        vec2 rainUv=uv*vec2(75.0,1.0);
        float column=floor(rainUv.x);
        float speed=1.8+hash(vec2(column,2.0))*2.3;
        float drop=fract(uv.y*1.8+time*speed+hash(vec2(column,8.0)));
        float line=smoothstep(0.035,0.0,abs(fract(rainUv.x)-0.5))*smoothstep(0.17,0.0,drop);
        sky+=vec3(0.42,0.77,0.92)*line*(0.28+precipitation*0.8);
      }
      if(mode>2.5&&mode<3.5){
        vec2 snowUv=uv*vec2(42.0,28.0);
        vec2 cell=floor(snowUv);
        vec2 local=fract(snowUv)-0.5;
        local.x+=sin(time*0.65+cell.y)*0.22;
        local.y=fract(local.y+time*(0.16+hash(cell)*0.18))-0.5;
        float flake=smoothstep(0.095,0.0,length(local))*step(0.52,hash(cell));
        sky+=vec3(0.82,0.94,1.0)*flake*0.8;
      }
      if(storm>0.5){
        float flash=pow(max(0.0,sin(time*0.57+noise(vec2(floor(time*.57),2.0))*8.0)),46.0);
        sky+=vec3(0.54,0.64,1.0)*flash*0.52;
      }
      float haze=exp(-7.0*abs(uv.y-0.17))*mix(0.05,0.2,step(0.5,mode));
      sky=mix(sky,vec3(0.56,0.71,0.73),haze);
      sky*=1.0-0.18*length(p)*length(p);
      float grain=(hash(gl_FragCoord.xy+time)-0.5)*0.025;
      gl_FragColor=vec4(max(sky+grain,0.0),1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) {
    toggle.textContent = 'Ambiente estático';
    toggle.disabled = true;
    return;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    toggle.textContent = 'Ambiente estático';
    toggle.disabled = true;
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['resolution','time','mode','precipitation','wind','daylight'].map(name => [name, gl.getUniformLocation(program, name)]));

  let state = { mode: 1, precipitation: 0, wind: .15, daylight: new Date().getHours() / 24 };
  let paused = reduced;
  let frame = 0;
  let start = performance.now();
  const modes = { clear: 0, cloudy: 1, rain: 2, snow: 3, storm: 4 };

  function resize() {
    const quality = (navigator.hardwareConcurrency || 4) <= 4 ? .85 : Math.min(devicePixelRatio || 1, 1.25);
    const width = Math.max(1, Math.round(innerWidth * quality));
    const height = Math.max(1, Math.round(innerHeight * quality));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function render(now = performance.now()) {
    frame = 0;
    resize();
    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, (now - start) / 1000);
    gl.uniform1f(uniforms.mode, state.mode);
    gl.uniform1f(uniforms.precipitation, state.precipitation);
    gl.uniform1f(uniforms.wind, state.wind);
    gl.uniform1f(uniforms.daylight, state.daylight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!paused && !document.hidden) frame = requestAnimationFrame(render);
  }

  function resume() {
    if (!frame && !paused && !document.hidden) frame = requestAnimationFrame(render);
  }

  function update(detail) {
    const timeText = detail.current.time || '';
    const hourMatch = timeText.match(/T(\d{2}):/);
    const hour = hourMatch ? Number(hourMatch[1]) : new Date().getHours();
    state = {
      mode: modes[detail.state.tone] ?? 1,
      precipitation: Math.min(1, Math.max(0, Number(detail.current.precipitation || 0) / 12)),
      wind: Math.min(1, Math.max(.05, Number(detail.current.wind_speed_10m || 0) / 80)),
      daylight: hour / 24
    };
    document.body.dataset.weather = detail.state.tone;
    render();
    resume();
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    document.body.classList.toggle('motion-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Retomar ambiente' : 'Pausar ambiente';
    if (paused && frame) { cancelAnimationFrame(frame); frame = 0; render(); }
    else resume();
  });
  if (reduced) {
    document.body.classList.add('motion-paused');
    toggle.textContent = 'Movimento reduzido';
    toggle.disabled = true;
    toggle.setAttribute('aria-pressed', 'true');
  }
  window.addEventListener('cirro:data', event => update(event.detail));
  addEventListener('resize', () => render(), { passive: true });
  document.addEventListener('visibilitychange', resume);
  if (window.CirroVisualData) update(window.CirroVisualData);
  else render();
  resume();
})();
