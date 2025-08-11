(function(){
  console.log("App Started..");

  document.addEventListener('DOMContentLoaded', function(){
    // Upgrade old Font Awesome 3/4 classes to FA6
    document.querySelectorAll('i.icon-ok').forEach(function(el){
      el.classList.remove('icon-ok');
      el.classList.add('fa-solid', 'fa-check');
    });
    document.querySelectorAll('i.fa').forEach(function(el){
      if (!el.className.match(/fa-(solid|regular|brands)/)) {
        el.classList.add('fa-solid');
      }
    });

    // Bootstrap 3 -> 5 responsive image class
    document.querySelectorAll('img.img-responsive').forEach(function(img){
      img.classList.add('img-fluid');
    });

    // Bootstrap 3 offset to BS5 utility class
    document.querySelectorAll('.col-md-offset-2').forEach(function(el){
      el.classList.add('offset-md-2');
    });
  });
})();