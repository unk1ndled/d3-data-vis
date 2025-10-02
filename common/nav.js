fetch("/common/nav.html")
  .then((res) => res.text())
  .then((data) => {
    document.getElementById("navbar").innerHTML = data;

    // Highlight active link
    const currentPath = window.location.pathname;
    document.querySelectorAll("#navbar nav a").forEach((link) => {
      if (currentPath.endsWith(link.getAttribute("href"))) {
        link.classList.add("active");
      }
    });
  })
  .catch((err) => console.error("Error loading nav:", err));
