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
    function glowSprite(color, size, opacity) {
        var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        s.scale.set(size, size, 1);
        return s;
    }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // A living neural network, loosely modelled on real neurons. Used for the home hero and for the
    // background layer that runs down every page. Neurons are wired to their nearest neighbours by curved
    // fibres. Firing sends action potentials down the fibres (a bright head with a fading trail). Arrivals add
    // charge to the target; past threshold it fires too, then rests (refractory) while charge leaks away, so a
    // cascade spreads for a while and dies out. Spontaneous spikes keep it alive; click or tap to fire one.
    function makeNeural(g, o) {
        var pts = [], tries = 0;
        while (pts.length < o.count && tries++ < o.count * 40) {
            var p = o.sample(), ok = true;
            for (var i = 0; i < pts.length; i++) if (pts[i].distanceToSquared(p) < o.minD2) { ok = false; break; }
            if (ok) pts.push(p);
        }
        var n = pts.length;
        var act = new Float32Array(n), pot = new Float32Array(n), refr = new Float32Array(n);
        var hoverIdx = -1;

        var BASE = new THREE.Color(o.base), HOT = new THREE.Color('#e6f6ff'), GLOWBASE = new THREE.Color(o.glowBase);
        var c = new THREE.Color(), m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3();

        // Cell bodies: one instanced mesh, coloured per neuron
        var soma = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8),
            new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.1, emissive: '#16254a', emissiveIntensity: 0.6, fog: false }), n);
        pts.forEach(function (p, i) {
            var r = o.somaR[0] + Math.random() * o.somaR[1];
            m4.compose(p, q0, sv.set(r, r, r)); soma.setMatrixAt(i, m4); soma.setColorAt(i, BASE);
        });
        g.add(soma);

        // Soft glow per neuron (per-vertex colour so firing brightens it)
        var gpos = new Float32Array(n * 3), gcol = new Float32Array(n * 3);
        pts.forEach(function (p, i) { p.toArray(gpos, i * 3); GLOWBASE.toArray(gcol, i * 3); });
        var gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
        gg.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
        g.add(new THREE.Points(gg, new THREE.PointsMaterial({ size: o.glow, map: GLOW, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));

        // Fibres: curved links to the k nearest neighbours, plus a few longer-range ones
        var edges = [], adj = pts.map(function () { return []; }), seen = {}, SEG = 10;
        function link(i, j) {
            var key = i < j ? i + '-' + j : j + '-' + i;
            if (i === j || seen[key]) return; seen[key] = 1;
            var a = pts[i], b = pts[j], mid = a.clone().add(b).multiplyScalar(0.5);
            mid.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(a.distanceTo(b) * 0.45));
            var cp = new THREE.QuadraticBezierCurve3(a, mid, b);
            var e = { a: i, b: j, pts: cp.getPoints(SEG), len: cp.getLength(), w: 0.45 + Math.random() * 0.6, off: edges.length * SEG * 2 };
            edges.push(e); adj[i].push(e); adj[j].push(e);
        }
        pts.forEach(function (p, i) {
            var near = [];
            for (var j = 0; j < n; j++) if (j !== i) near.push([j, p.distanceToSquared(pts[j])]);
            near.sort(function (x, y) { return x[1] - y[1]; });
            for (var k = 0; k < o.k; k++) link(i, near[k][0]);
            if (Math.random() < 0.12) link(i, near[6 + Math.floor(Math.random() * 14)][0]);
        });
        var lv = new Float32Array(edges.length * SEG * 2 * 3), lbase = new Float32Array(lv.length), lcol = new Float32Array(lv.length);
        var fA = new THREE.Color(o.fibreA), fB = new THREE.Color(o.fibreB);
        edges.forEach(function (e) {
            for (var k = 0; k < SEG; k++) {
                var v0 = (e.off + k * 2) * 3, v1 = v0 + 3;
                e.pts[k].toArray(lv, v0); e.pts[k + 1].toArray(lv, v1);
                fA.clone().lerp(fB, k / SEG).toArray(lbase, v0); fA.clone().lerp(fB, (k + 1) / SEG).toArray(lbase, v1);
            }
        });
        lcol.set(lbase);
        var lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.BufferAttribute(lv, 3));
        lg.setAttribute('color', new THREE.BufferAttribute(lcol, 3));
        g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));

        // Action potentials travelling down fibres
        var MAXP = o.maxPulses, SPEED = 1.5, pulses = [];
        var ppos = new Float32Array(MAXP * 3), pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3)); pg.setDrawRange(0, 0);
        g.add(glowPoints(pg, '#e8f7ff', 0.22, 1));

        // Firing flash: a pool of sprites that bloom outward and fade
        var flashes = [];
        for (var f = 0; f < 48; f++) {
            var sp = glowSprite('#bfe6ff', 0.3, 0); sp.visible = false; g.add(sp);
            flashes.push({ s: sp, t: 1, k: 1 });
        }
        var nextFlash = 0;
        function bloom(i, strength) {
            var fl = flashes[nextFlash = (nextFlash + 1) % flashes.length];
            fl.s.position.copy(pts[i]); fl.t = 0; fl.k = strength; fl.s.visible = true;
        }

        var queue = [];   // neurons about to fire after a short synaptic delay
        function fire(i, gen, from) {
            if (refr[i] > 0) return;
            refr[i] = 1.3; act[i] = 1; pot[i] = 0;
            bloom(i, gen === 0 ? 1.3 : 0.8);
            if (gen >= 9) return;
            adj[i].forEach(function (e) {
                if (e === from || pulses.length >= MAXP) return;
                if (gen > 0 && Math.random() > 0.8) return;
                pulses.push({ e: e, fwd: e.a === i, u: 0, v: SPEED / e.len, gen: gen + 1, delay: Math.random() * 0.12 });
            });
        }
        function arrive(p) {
            var j = p.fwd ? p.e.b : p.e.a;
            if (refr[j] > 0) return;
            pot[j] += p.e.w;
            act[j] = Math.max(act[j], 0.35);           // sub-threshold glimmer
            if (pot[j] >= 1) queue.push({ i: j, t: 0.06, gen: p.gen, e: p.e });
        }
        function lightFibre(p) {
            // bright head at the pulse, fading trail behind it
            var t = p.fwd ? p.u : 1 - p.u, head = t * SEG;
            for (var k = 0; k < SEG; k++) {
                var mid = k + 0.5, d = p.fwd ? head - mid : mid - head;
                if (d < -0.6 || d > 3.5) continue;
                var I = d < 0 ? 1 + d / 0.6 : 1 - d / 3.5;
                I = I * I * 1.1;
                for (var v = 0; v < 2; v++) {
                    var oo = (p.e.off + k * 2 + v) * 3;
                    lcol[oo] += 0.9 * I; lcol[oo + 1] += 1.3 * I; lcol[oo + 2] += 1.6 * I;
                }
            }
        }

        var spont = 1;
        var tick = function (dt) {
            spont -= dt;
            if (spont <= 0) {
                spont = o.spont[0] + Math.random() * o.spont[1];
                var s = o.spontPick ? o.spontPick(pts) : Math.floor(Math.random() * n);
                if (s >= 0) fire(s, 6, null);
            }
            for (var qi = queue.length - 1; qi >= 0; qi--) {
                var qq = queue[qi]; qq.t -= dt;
                if (qq.t <= 0) { queue.splice(qi, 1); fire(qq.i, qq.gen, qq.e); }
            }

            lcol.set(lbase);
            for (var pi = pulses.length - 1; pi >= 0; pi--) {
                var p = pulses[pi];
                if (p.delay > 0) { p.delay -= dt; continue; }
                p.u += p.v * dt;
                if (p.u >= 1) { arrive(p); pulses.splice(pi, 1); continue; }
                lightFibre(p);
            }
            var live = 0;
            pulses.forEach(function (p) {
                if (p.delay > 0) return;
                var P = p.e.pts, t = p.fwd ? p.u : 1 - p.u, fpos = t * SEG, k = Math.min(SEG - 1, Math.floor(fpos));
                sv.lerpVectors(P[k], P[k + 1], fpos - k).toArray(ppos, live * 3); live++;
            });
            pg.setDrawRange(0, live);
            pg.attributes.position.needsUpdate = true;
            lg.attributes.color.needsUpdate = true;

            for (var i = 0; i < n; i++) {
                act[i] = Math.max(0, act[i] - dt * 1.5);
                refr[i] = Math.max(0, refr[i] - dt);
                pot[i] *= Math.exp(-dt * 1.2);           // membrane leak
                var a = Math.max(act[i], i === hoverIdx ? 0.45 : 0), k2 = a * a * (3 - 2 * a);
                c.copy(BASE).lerp(HOT, k2); soma.setColorAt(i, c);
                c.copy(GLOWBASE).lerp(HOT, k2); c.toArray(gcol, i * 3);
            }
            soma.instanceColor.needsUpdate = true;
            gg.attributes.color.needsUpdate = true;

            flashes.forEach(function (fl) {
                if (!fl.s.visible) return;
                fl.t += dt / 0.75;
                if (fl.t >= 1) { fl.s.visible = false; return; }
                var e = 1 - Math.pow(1 - fl.t, 3), s = (0.25 + 1.25 * e) * fl.k;
                fl.s.scale.set(s, s, 1);
                fl.s.material.opacity = (1 - fl.t) * (1 - fl.t);
            });
        };

        // Screen-space picking, so clicks work even though page content sits above the canvas
        var pv = new THREE.Vector3();
        g.userData.pick = function (x, y, radius) {
            var best = -1, bd = radius * radius, w = window.innerWidth, h = window.innerHeight;
            for (var i = 0; i < n; i++) {
                pv.copy(pts[i]); g.localToWorld(pv); pv.project(camera);
                if (pv.z < -1 || pv.z > 1) continue;
                var dx = (pv.x + 1) / 2 * w - x, dy = (1 - pv.y) / 2 * h - y, d = dx * dx + dy * dy;
                if (d < bd) { bd = d; best = i; }
            }
            return best;
        };
        g.userData.fire = function (i) { refr[i] = 0; fire(i, 0, null); };
        g.userData.hover = function (i) { hoverIdx = i; };
        return tick;
    }

    // Each builder returns a Group and may set group.userData.tick(dt, t) for its own motion.
    var builders = {
        // Hero: a wide, dense neural network behind the headline (see makeNeural)
        neural: function (g) {
            var R = [4.1, 2.3, 1.7];
            g.userData.tick = makeNeural(g, {
                count: 300, minD2: 0.05, k: 4, maxPulses: 300, glow: 0.26, somaR: [0.026, 0.03],
                base: '#5d7fb4', glowBase: '#233b66', fibreA: '#1f3660', fibreB: '#3e3474', spont: [0.7, 1.2],
                sample: function () {
                    var p;
                    do { p = new THREE.Vector3((Math.random() * 2 - 1) * R[0], (Math.random() * 2 - 1) * R[1], (Math.random() * 2 - 1) * R[2]); }
                    while (p.x * p.x / (R[0] * R[0]) + p.y * p.y / (R[1] * R[1]) + p.z * p.z / (R[2] * R[2]) > 1);
                    return p;
                }
            });
            g.userData.wide = true;
            g.userData.spinScale = 0.25;
        },
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

    // 3) Living neural network down the whole page, behind the section objects (dimmer than the hero)
    var bgNet = new THREE.Group(); bgNet.position.z = -2.6;
    var bgTick = makeNeural(bgNet, {
        count: Math.round(LEN * 17), minD2: 0.12, k: 3, maxPulses: 220, glow: 0.22, somaR: [0.018, 0.022],
        base: '#3f5a88', glowBase: '#182847', fibreA: '#142443', fibreB: '#2a2452', spont: [0.35, 0.6],
        sample: function () { return new THREE.Vector3((Math.random() - 0.5) * 17, 3 - Math.random() * LEN, (Math.random() - 0.5) * 2.4); },
        // fire spontaneously near what is on screen, so the activity is seen
        spontPick: function (pts) {
            for (var t = 0; t < 10; t++) {
                var i = Math.floor(Math.random() * pts.length);
                if (Math.abs(pts[i].y - camera.position.y) < 3.2) return i;
            }
            return -1;
        }
    });
    bgNet.userData.emptyOnly = true;      // only clickable on empty background, never over text
    ticks.push(function (dt) { bgTick(dt); });
    scene.add(bgNet);

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
        var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: i % 2 ? VIOLET : ICE, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
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
        objs.forEach(function (g) { g.position.x = g.userData.wide ? (narrow ? 0.4 : 1.5) : narrow ? 2.1 : (g.userData.right ? 2.4 : -2.4); });
    }
    window.addEventListener('resize', layout); layout();

    var mouse = { x: 0, y: 0 };
    window.addEventListener('pointermove', function (e) {
        mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    var idx = scrollIndex(), cur = idx, spin = 0;
    window.addEventListener('scroll', function () {
        var n = scrollIndex(); spin += (n - idx) * 2.5; idx = n; updateUI(idx);
    }, { passive: true });
    updateUI(idx);

    // Click / tap a neuron to fire it; the cursor becomes a pointer over one.
    var pickers = objs.filter(function (g) { return g.userData.pick; }).concat([bgNet]);
        var content = '.col, .site-header, .site-footer, .index';
        var allowed = function (g, t) { return !(g.userData.emptyOnly && t.closest && t.closest(content)); };
    if (pickers.length) {
        var down = null, skip = 'a,button,input,textarea,select,label,summary';
        window.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; }, { passive: true });
        window.addEventListener('pointerup', function (e) {
            if (!down) return;
            var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y); down = null;
            if (moved > 10 || (e.target.closest && e.target.closest(skip))) return;
            var r = e.pointerType === 'mouse' ? 26 : 42;
            pickers.forEach(function (g) { if (!allowed(g, e.target)) return; var i = g.userData.pick(e.clientX, e.clientY, r); if (i >= 0) g.userData.fire(i); });
        });
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            var hit = false, onControl = e.target.closest && e.target.closest(skip);
            pickers.forEach(function (g) {
                var i = (onControl || !allowed(g, e.target)) ? -1 : g.userData.pick(e.clientX, e.clientY, 26);
                g.userData.hover(i); if (i >= 0) hit = true;
            });
            document.body.style.cursor = hit ? 'pointer' : '';
        }, { passive: true });
    }

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
            g.rotation.y += (dt * 0.25 + spin * dt * 0.4) * m * (g.userData.spinScale || 1);
            g.rotation.x = (g.userData.tilt || 0) + Math.sin(t * 0.3 + i) * 0.25 * m;
            if (g.userData.tick && m) g.userData.tick(dt, t);
            g.scale.setScalar((narrow ? 0.62 : 1) * (0.95 + near * 0.05));
        });
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
