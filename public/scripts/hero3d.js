(function () {
  const canvas = document.getElementById('hero3d');
  if (!canvas || !window.THREE) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 6;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(5, 10, 7.5);
  scene.add(dir);

  const geometry = new THREE.IcosahedronGeometry(1.5, 1);
  const wireMaterial = new THREE.MeshStandardMaterial({
    color: 0x66ccff,
    wireframe: true,
    transparent: true,
    opacity: 0.6
  });
  const solidMaterial = new THREE.MeshStandardMaterial({
    color: 0x0077ff,
    metalness: 0.2,
    roughness: 0.4,
    transparent: true,
    opacity: 0.35
  });

  const solid = new THREE.Mesh(geometry, solidMaterial);
  scene.add(solid);
  const wire = new THREE.Mesh(geometry, wireMaterial);
  wire.scale.setScalar(1.01);
  scene.add(wire);

  const stars = new THREE.Group();
  const starGeom = new THREE.SphereGeometry(0.02, 6, 6);
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 250; i++) {
    const star = new THREE.Mesh(starGeom, starMat);
    const radius = 20 + Math.random() * 30;
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    star.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );
    stars.add(star);
  }
  scene.add(stars);

  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    mouseX = x; mouseY = y;
  });

  function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);

  let last = 0;
  function animate(ts) {
    const dt = (ts - last) / 1000 || 0.016;
    last = ts;

    solid.rotation.x += 0.2 * dt;
    solid.rotation.y += 0.35 * dt;
    wire.rotation.x = solid.rotation.x * 1.15;
    wire.rotation.y = solid.rotation.y * 1.15;

    camera.position.x += (mouseX * 0.8 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 0.5 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    stars.rotation.y += 0.02 * dt;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();