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

    // Starfield along the whole travel path
    (function () {
        var n = 1200, len = GAP * Math.max(1, objs.length) + 6, pos = new Float32Array(n * 3);
        for (var i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 18;
            pos[i * 3 + 1] = 3 - Math.random() * len;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
        }
        var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.7 })));
    })();

    var narrow = false;
    function layout() {
        var w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
        narrow = w < 900;
        objs.forEach(function (g) { g.position.x = narrow ? 1.2 : (g.userData.right ? 2.4 : -2.4); });
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
        objs.forEach(function (g, i) {
            var near = Math.max(0, 1 - Math.abs(cur - i));
            g.rotation.y += (dt * 0.25 + spin * dt * 0.4) * m;
            g.rotation.x = (g.userData.tilt || 0) + Math.sin(t * 0.3 + i) * 0.25 * m;
            if (g.userData.tick && m) g.userData.tick(dt, t);
            g.scale.setScalar((narrow ? 0.75 : 1) * (0.85 + near * 0.15));
        });
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
