(function () {
  function initProjectThumbnails() {
    var images = document.querySelectorAll(".project-thumb--gif img[data-still-src][data-animated-src]");

    images.forEach(function (image) {
      var row = image.closest(".project-row");
      var stillSrc = image.dataset.stillSrc;
      var animatedSrc = image.dataset.animatedSrc;

      if (!row || !stillSrc || !animatedSrc) {
        return;
      }

      function play() {
        image.src = animatedSrc;
      }

      function pause() {
        image.src = stillSrc;
      }

      row.addEventListener("mouseenter", play);
      row.addEventListener("mouseleave", pause);
      row.addEventListener("focusin", play);
      row.addEventListener("focusout", function (event) {
        if (!row.contains(event.relatedTarget)) {
          pause();
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProjectThumbnails);
  } else {
    initProjectThumbnails();
  }
})();
