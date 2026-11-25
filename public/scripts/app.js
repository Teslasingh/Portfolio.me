/*
File name: app.js
Author's name: Anubhav Kumar Singh
file description: Site behaviour shared by every page: mobile menu, section index, scroll progress,
copy-to-clipboard, and the scroll-driven three.js scene. Each <section class="panel-section"> with a
data-shape attribute gets its own 3D object; the camera travels down to it as the page scrolls.
*/
(function () {
    'use strict';
    document.documentElement.classList.add('js');

    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sections = [].slice.call(document.querySelectorAll('main .panel-section'));
    var progress = document.getElementById('progress');

    /* ---------- Mobile menu ---------- */
    var menuBtn = document.getElementById('menuBtn');
    var siteNav = document.getElementById('siteNav');
    if (menuBtn && siteNav) {
        menuBtn.addEventListener('click', function () {
            var open = siteNav.classList.toggle('open');
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        siteNav.addEventListener('click', function (e) {
            if (e.target.tagName === 'A') { siteNav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
        });
    }

    /* ---------- Section index (right-hand dots) ---------- */
    var index = document.getElementById('sectionIndex');
    var indexLinks = [];
    if (index && sections.length > 1) {
        sections.forEach(function (s) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = '#' + s.id;
            a.innerHTML = '<span></span><b></b>';
            a.firstChild.textContent = s.getAttribute('data-label') || s.id;
            li.appendChild(a); index.appendChild(li); indexLinks.push(a);
        });
    } else if (index) { index.hidden = true; }

    /* ---------- Copy buttons ---------- */
    [].forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
        btn.addEventListener('click', function () {
            var src = document.getElementById(btn.getAttribute('data-copy'));
            var toast = document.getElementById(btn.getAttribute('data-toast'));
            if (!src) return;
            var say = function (m) { if (toast) toast.textContent = m; };
            var fallback = function () {
                var r = document.createRange(); r.selectNodeContents(src);
                var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
                say('Selected. Press Ctrl+C to copy.');
            };
            try {
                navigator.clipboard.writeText(src.textContent.trim()).then(function () { say('Copied to clipboard'); }, fallback);
            } catch (e) { fallback(); }
        });
    });

    /* ---------- Entrance nudge (content is visible without it) ---------- */
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
            es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('seen'); });
        }, { threshold: 0.12 });
        sections.forEach(function (s) { io.observe(s); });
    } else {
        sections.forEach(function (s) { s.classList.add('seen'); });
    }
    if (sections[0]) sections[0].classList.add('seen');

    /* ---------- Scroll position as a fractional section index ---------- */
    function scrollIndex() {
        if (!sections.length) return 0;
        var mid = window.scrollY + window.innerHeight * 0.5;
        for (var i = 0; i < sections.length; i++) {
            var top = sections[i].offsetTop, h = sections[i].offsetHeight;
            if (mid < top + h) return Math.max(0, i + (mid - top) / h - 0.5);
        }
        return sections.length - 1;
    }
    function updateUI(idx) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
        var active = Math.min(indexLinks.length - 1, Math.round(idx));
        indexLinks.forEach(function (a, i) { a.classList.toggle('on', i === active); });
    }

    var canvas = document.getElementById('stage');
    var webgl = false;
    try { webgl = !!(window.WebGLRenderingContext && document.createElement('canvas').getContext('webgl')); } catch (e) { }
    if (typeof THREE === 'undefined' || !canvas || !webgl) {
        window.addEventListener('scroll', function () { updateUI(scrollIndex()); }, { passive: true });
        updateUI(scrollIndex());
        return;
    }

    /* ---------- 3D stage ---------- */
    var ICE = new THREE.Color('#8fd3ff'), VIOLET = new THREE.Color('#b49cff'), INK = new THREE.Color('#0a0d1a');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(INK, 1);
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(INK, 6, 16);
    var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.z = 8;
    var rig = new THREE.Group(); rig.add(camera); scene.add(rig);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    var keyLight = new THREE.DirectionalLight(ICE, 1.2); keyLight.position.set(3, 4, 5); scene.add(keyLight);
    var rim = new THREE.PointLight(VIOLET, 2.2, 20); scene.add(rim);

    var GAP = 5;
    function solid(c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.55, flatShading: true, emissive: c, emissiveIntensity: 0.08 }); }
    function wire(c) { return new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.55 }); }

    // Each builder returns a Group and may set group.userData.tick(dt, t) for its own motion.
    var builders = {
        // Hero: torus knot inside a wire icosahedron
        knot: function (g) {
            g.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.32, 140, 18), solid(ICE)));
            var halo = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), wire(VIOLET)); g.add(halo);
            g.userData.tick = function (dt) { halo.rotation.z -= dt * 0.3; };
        },
        // Profile: nested solids
        nested: function (g) {
            g.add(new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), solid(VIOLET)));
            var o = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), wire(ICE)); g.add(o);
            g.userData.tick = function (dt) { o.rotation.z -= dt * 0.25; };
        },
        // Hardware: a circuit chip with pins
        chip: function (g) {
            var body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 1.8), solid(VIOLET)); g.add(body);
            var die = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.8), solid(ICE)); die.position.y = 0.19; g.add(die);
            var pinGeo = new THREE.BoxGeometry(0.1, 0.06, 0.34), pinMat = solid(ICE);
            for (var s = 0; s < 4; s++) for (var k = 0; k < 6; k++) {
                var p = new THREE.Mesh(pinGeo, pinMat), off = -0.65 + k * 0.26;
                if (s === 0) p.position.set(off, -0.08, 1.05);
                if (s === 1) p.position.set(off, -0.08, -1.05);
                if (s === 2) { p.position.set(1.05, -0.08, off); p.rotation.y = Math.PI / 2; }
                if (s === 3) { p.position.set(-1.05, -0.08, off); p.rotation.y = Math.PI / 2; }
                g.add(p);
            }
            g.add(new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.01, 6, 120), wire(ICE)).rotateX(Math.PI / 2));
            g.rotation.x = 0.5;
            g.userData.tilt = 0.5;
        },
        // Projects / services: cubes orbiting a ring
        cubes: function (g) {
            var orbit = new THREE.Group(); g.add(orbit);
            for (var i = 0; i < 5; i++) {
                var m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), solid(i % 2 ? VIOLET : ICE));
                var a = i / 5 * Math.PI * 2;
                m.position.set(Math.cos(a) * 1.6, Math.sin(a * 2) * 0.3, Math.sin(a) * 1.6);
                orbit.add(m);
            }
            g.add(new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.015, 8, 90), wire(ICE)).rotateX(Math.PI / 2));
            g.userData.tick = function (dt) { orbit.children.forEach(function (m) { m.rotation.x += dt; m.rotation.y += dt * 0.7; }); };
        },
        // AI / data: a point-cloud sphere around a core ("neural" look)
        sphere: function (g) {
            var n = 800, pos = new Float32Array(n * 3);
            for (var i = 0; i < n; i++) {
                var y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
                pos[i * 3] = Math.cos(th) * r * 1.7; pos[i * 3 + 1] = y * 1.7; pos[i * 3 + 2] = Math.sin(th) * r * 1.7;
            }
            var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: ICE, size: 0.045 })));
            g.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), solid(VIOLET)));
        },
        // Process / timeline: stacked rings
        rings: function (g) {
            var rs = [];
            for (var i = 0; i < 4; i++) {
                var m = new THREE.Mesh(new THREE.TorusGeometry(1.4 - i * 0.25, 0.06, 12, 80), solid(i % 2 ? ICE : VIOLET));
                m.position.y = (i - 1.5) * 0.45; m.rotation.x = Math.PI / 2; g.add(m); rs.push(m);
            }
            g.userData.tick = function (dt, t) { rs.forEach(function (m, k) { m.rotation.y = Math.sin(t * 0.6 + k) * 0.4; }); };
        },
        // Contact: torus portal
        portal: function (g) {
            g.add(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.38, 24, 100), solid(ICE)));
            var o = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.01, 6, 120), wire(VIOLET)); g.add(o);
            g.userData.tick = function (dt) { o.rotation.z -= dt * 0.3; };
        }
    };

    var objs = sections.map(function (s, i) {
        var g = new THREE.Group();
        (builders[s.getAttribute('data-shape')] || builders.nested)(g);
        g.position.y = -i * GAP;
        g.userData.right = !s.classList.contains('r'); // text left -> object right
        scene.add(g);
        return g;
    });

    /* ================= Background art ================= */
    var LEN = GAP * Math.max(1, objs.length) + 8;   // vertical length of the camera's travel path
    var ticks = [];                                   // per-frame animators for the art layers

    // Soft round glow texture, drawn once on a canvas and shared by every sprite and point layer.
    var GLOW = (function () {
        var c = document.createElement('canvas'); c.width = c.height = 64;
        var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    })();
    function glowPoints(geo, color, size, opacity) {
        return new THREE.Points(geo, new THREE.PointsMaterial({
            color: color, size: size, map: GLOW, transparent: true, opacity: opacity,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false
        }));
    }

    // 1) Nebula: a full-screen shader of domain-warped noise. It drifts slowly, follows the pointer a little,
    //    and its colour shifts from violet to teal as you scroll down the page.
    var nebula = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: {
            uTime: { value: 0 }, uScroll: { value: 0 }, uAspect: { value: 1 }, uMouse: { value: new THREE.Vector2() },
            cA: { value: new THREE.Color('#0a0d1a') }, cB: { value: new THREE.Color('#1c2c62') },
            cC: { value: new THREE.Color('#5a3aa8') }, cD: { value: new THREE.Color('#13708a') }
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
        fragmentShader: [
            'precision mediump float;',
            'uniform float uTime, uScroll, uAspect; uniform vec2 uMouse; uniform vec3 cA, cB, cC, cD; varying vec2 vUv;',
            'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
            'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
            '  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }',
            'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*n(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }',
            'void main(){',
            '  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.4;',
            '  p.y += uScroll * 0.55; p += uMouse * 0.25;',
            '  float t = uTime * 0.035;',
            '  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));',
            '  float f = fbm(p + 2.2*q);',
            '  vec3 tint = mix(cC, cD, 0.5 + 0.5*sin(uScroll * 1.1));',
            '  vec3 col = mix(cA, cB, smoothstep(0.30, 0.85, f));',
            '  col = mix(col, tint, smoothstep(0.45, 1.0, q.x * f * 1.7));',
            '  col += tint * 0.35 * pow(smoothstep(0.55, 0.95, f), 3.0);',
            '  float vig = smoothstep(1.35, 0.15, length((vUv - 0.5) * vec2(1.25, 1.0)));',
            '  gl_FragColor = vec4(col * (0.5 + 0.5*vig), 1.0);',
            '}'
        ].join('\n')
    }));
    nebula.frustumCulled = false; nebula.renderOrder = -10;
    scene.add(nebula);

    // 2) Circuit board: procedural PCB traces (straight runs with 45-degree bends, pads at the ends)
    //    on a plane behind everything, with glowing signals travelling along them.
    (function () {
        var STEP = 0.42, traces = [], verts = [], pads = [];
        var dirs = [[1, 0], [0, -1], [-1, 0], [0, 1], [1, -1], [-1, -1]];
        var count = Math.round(LEN * 2.6);
        for (var k = 0; k < count; k++) {
            var x = Math.round((Math.random() - 0.5) * 40) * STEP, y = 3 - Math.round(Math.random() * LEN / STEP) * STEP;
            var pts = [new THREE.Vector3(x, y, 0)], d = dirs[Math.floor(Math.random() * 4)];
            var segs = 2 + Math.floor(Math.random() * 4);
            for (var s = 0; s < segs; s++) {
                var steps = 2 + Math.floor(Math.random() * 7);
                x += d[0] * steps * STEP; y += d[1] * steps * STEP;
                pts.push(new THREE.Vector3(x, y, 0));
                // turn by 45 degrees: from an axis direction to a diagonal or back
                var axis = d[0] === 0 || d[1] === 0;
                d = axis ? (d[0] !== 0 ? [d[0], Math.random() < 0.5 ? 1 : -1] : [Math.random() < 0.5 ? 1 : -1, d[1]])
                         : (Math.random() < 0.5 ? [d[0], 0] : [0, d[1]]);
            }
            for (var i = 1; i < pts.length; i++) verts.push(pts[i - 1].x, pts[i - 1].y, 0, pts[i].x, pts[i].y, 0);
            pads.push(pts[0].x, pts[0].y, 0, pts[pts.length - 1].x, pts[pts.length - 1].y, 0);
            var lens = [0];
            for (var j = 1; j < pts.length; j++) lens.push(lens[j - 1] + pts[j].distanceTo(pts[j - 1]));
            traces.push({ pts: pts, lens: lens, total: lens[lens.length - 1] });
        }
        var board = new THREE.Group(); board.position.z = -6;
        var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        board.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#5d93d6', transparent: true, opacity: 0.36, fog: false, depthWrite: false })));
        var pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pads, 3));
        board.add(glowPoints(pg, ICE, 0.22, 0.45));

        // Signals: a pool of glowing dots, each running along a random trace and hopping to another when done.
        var N = Math.min(70, traces.length), spos = new Float32Array(N * 3), sig = [];
        for (var q = 0; q < N; q++) sig.push({ tr: traces[Math.floor(Math.random() * traces.length)], u: Math.random(), v: 0.6 + Math.random() * 1.2 });
        var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
        var sigIce = glowPoints(sg, ICE, 0.42, 0.95); board.add(sigIce);
        var tmp = new THREE.Vector3();
        ticks.push(function (dt, t, boost) {
            for (var q = 0; q < N; q++) {
                var s = sig[q];
                s.u += dt * s.v * (1 + boost) / Math.max(1, s.tr.total) * 2.2;
                if (s.u >= 1) { s.u = 0; s.tr = traces[Math.floor(Math.random() * traces.length)]; }
                var dist = s.u * s.tr.total, L = s.tr.lens, k = 1;
                while (k < L.length - 1 && L[k] < dist) k++;
                var segLen = L[k] - L[k - 1] || 1;
                tmp.lerpVectors(s.tr.pts[k - 1], s.tr.pts[k], (dist - L[k - 1]) / segLen);
                spos[q * 3] = tmp.x; spos[q * 3 + 1] = tmp.y; spos[q * 3 + 2] = 0.01;
            }
            sg.attributes.position.needsUpdate = true;
        });
        scene.add(board);
    })();

    // 3) Neural constellation: floating nodes joined to their near neighbours, gently breathing.
    (function () {
        var n = Math.round(LEN * 9), pos = new Float32Array(n * 3), lines = [];
        for (var i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 16;
            pos[i * 3 + 1] = 3 - Math.random() * LEN;
            pos[i * 3 + 2] = -3.2 + Math.random() * 2.4;
        }
        for (var a = 0; a < n; a++) {
            var links = 0;
            for (var b = a + 1; b < n && links < 3; b++) {
                var dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2];
                if (dx * dx + dy * dy + dz * dz < 1.5) {
                    lines.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]); links++;
                }
            }
        }
        var net = new THREE.Group();
        var ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        var nodes = glowPoints(ng, VIOLET, 0.16, 0.8); net.add(nodes);
        var eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
        var edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        net.add(edges);
        ticks.push(function (dt, t) {
            nodes.material.opacity = 0.6 + 0.3 * Math.sin(t * 1.3);
            edges.material.opacity = 0.09 + 0.06 * Math.sin(t * 0.9 + 1);
            net.position.x = Math.sin(t * 0.07) * 0.4;
        });
        scene.add(net);
    })();

    // 4) Fine dust in two depths for parallax
    [[0.035, 0.75, 4], [0.018, 0.5, -1.5]].forEach(function (layer) {
        var n = Math.round(LEN * 45), pos = new Float32Array(n * 3);
        for (var i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 1] = 3 - Math.random() * LEN;
            pos[i * 3 + 2] = layer[2] + (Math.random() - 0.5) * 3;
        }
        var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        scene.add(glowPoints(g, 0xffffff, layer[0] * 3, layer[1]));
    });

    // 5) Coloured halo behind every section object
    objs.forEach(function (g, i) {
        var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: i % 2 ? VIOLET : ICE, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        halo.scale.set(7, 7, 1); halo.position.z = -1.2;
        g.add(halo);
    });

    var narrow = false;
    function layout() {
        var w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        nebula.material.uniforms.uAspect.value = w / h;
        narrow = w < 900;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 1.75));
        renderer.setSize(w, h, false);
        objs.forEach(function (g) { g.position.x = narrow ? 2.1 : (g.userData.right ? 2.4 : -2.4); });
    }
    window.addEventListener('resize', layout); layout();

    var mouse = { x: 0, y: 0 };
    window.addEventListener('pointermove', function (e) {
        mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    var idx = scrollIndex(), cur = idx, spin = 0;
    window.addEventListener('scroll', function () {
        var n = scrollIndex(); spin += (n - idx) * 6; idx = n; updateUI(idx);
    }, { passive: true });
    updateUI(idx);

    ticks.forEach(function (fn) { fn(0, 0, 0); });   // place signals once, so a still frame looks right too

    var clock = new THREE.Clock(), running = true;
    document.addEventListener('visibilitychange', function () {
        running = !document.hidden;
        if (running) { clock.getDelta(); requestAnimationFrame(frame); }
    });

    function frame() {
        if (!running) return;
        var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, m = reduce ? 0 : 1;
        cur += (idx - cur) * (reduce ? 1 : Math.min(1, dt * 4));
        camera.position.y = -cur * GAP;
        rim.position.set(0, camera.position.y + 2, 4);
        if (!reduce) {
            rig.position.x += (mouse.x * 0.5 - rig.position.x) * dt * 3;
            rig.position.y += (-mouse.y * 0.4 - rig.position.y) * dt * 3;
        }
        spin *= Math.pow(0.05, dt);
        var u = nebula.material.uniforms;
        u.uTime.value += dt * m;
        u.uScroll.value = cur;
        u.uMouse.value.set(rig.position.x, rig.position.y);
        var boost = Math.min(4, Math.abs(spin)) * m;   // signals speed up while you scroll
        if (m) ticks.forEach(function (fn) { fn(dt, t, boost); });
        objs.forEach(function (g, i) {
            var near = Math.max(0, 1 - Math.abs(cur - i));
            g.rotation.y += (dt * 0.25 + spin * dt * 0.4) * m;
            g.rotation.x = (g.userData.tilt || 0) + Math.sin(t * 0.3 + i) * 0.25 * m;
            if (g.userData.tick && m) g.userData.tick(dt, t);
            g.scale.setScalar((narrow ? 0.62 : 1) * (0.85 + near * 0.15));
        });
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
