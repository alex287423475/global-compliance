const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const contactForm = document.querySelector(".contact-form");
const formNote = document.querySelector("[data-form-note]");

function setHeaderState() {
  if (window.scrollY > 24) {
    header.classList.add("is-solid");
  } else {
    header.classList.remove("is-solid");
  }
}

function closeNav() {
  nav.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("nav-open");
}

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

navToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("nav-open", isOpen);
});

nav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    closeNav();
  }
});

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formNote.textContent = "已记录评估信息。正式接入后将发送到安全表单或 CRM。";
});
