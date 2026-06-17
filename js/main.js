(function() {
    'use strict';

    var revealObserver = null;
    var isNavigating = false;

    function currentPageFromUrl(url) {
        return (new URL(url, window.location.href).pathname.split('/').pop() || 'index.html');
    }

    function updateActiveNav(url) {
        var page = currentPageFromUrl(url || window.location.href);
        document.querySelectorAll('.nav__links a, .mobile-menu a').forEach(function(link) {
            var isActive = link.getAttribute('href') === page;
            link.classList.toggle('active', isActive);
            if (isActive) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }

    function closeMenu() {
        var menu = document.querySelector('.mobile-menu');
        if (menu) menu.classList.remove('open');
        document.body.style.overflow = '';
    }

    function bindPersistentNav() {
        var toggle = document.querySelector('.nav__mobile-toggle');
        var menu = document.querySelector('.mobile-menu');
        var close = document.querySelector('.mobile-menu__close');

        if (toggle && menu) {
            toggle.addEventListener('click', function() {
                menu.classList.add('open');
                document.body.style.overflow = 'hidden';
            });
        }
        if (close) close.addEventListener('click', closeMenu);
        if (menu) menu.querySelectorAll('a').forEach(function(a) { a.addEventListener('click', closeMenu); });
    }

    function getReplaceableBodyChildren(doc) {
        return Array.prototype.filter.call(doc.body.children, function(el) {
            return !el.matches('.nav, .mobile-menu, script');
        });
    }

    function replacePageContent(nextDoc) {
        getReplaceableBodyChildren(document).forEach(function(el) { el.remove(); });

        var script = document.querySelector('script[src="js/main.js"]');
        var fragment = document.createDocumentFragment();
        getReplaceableBodyChildren(nextDoc).forEach(function(el) {
            fragment.appendChild(document.importNode(el, true));
        });

        if (script) {
            document.body.insertBefore(fragment, script);
        } else {
            document.body.appendChild(fragment);
        }
    }

    function navigateTo(href, pushState, force) {
        if (isNavigating) return;

        var target = new URL(href, window.location.href);
        var currentPage = currentPageFromUrl(window.location.href);
        var targetPage = currentPageFromUrl(target.href);

        if (target.origin !== window.location.origin || (!force && targetPage === currentPage)) return;

        isNavigating = true;
        document.body.classList.add('page-exit');

        setTimeout(function() {
            fetch(target.href, { headers: { 'X-Requested-With': 'fetch' } })
                .then(function(response) {
                    if (!response.ok) throw new Error('Navigation failed');
                    return response.text();
                })
                .then(function(html) {
                    var nextDoc = new DOMParser().parseFromString(html, 'text/html');
                    document.title = nextDoc.title;
                    replacePageContent(nextDoc);
                    if (pushState !== false) history.pushState(null, '', target.href);
                    updateActiveNav(target.href);
                    closeMenu();
                    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                    document.body.classList.remove('page-exit');
                    initPageContent();
                })
                .catch(function() {
                    window.location.href = target.href;
                })
                .finally(function() {
                    isNavigating = false;
                });
        }, 200);
    }

    function bindPjaxNavigation() {
        document.addEventListener('click', function(e) {
            var link = e.target.closest('.nav__links a[href$=".html"], .nav__cta[href$=".html"], .mobile-menu a[href$=".html"]');
            if (!link) return;
            if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target) return;

            var href = link.getAttribute('href');
            if (!href || href.startsWith('http') || href.startsWith('#')) return;

            e.preventDefault();
            navigateTo(href, true);
        });

        window.addEventListener('popstate', function() {
            navigateTo(window.location.href, false, true);
        });
    }

    function initReveal() {
        var reveals = document.querySelectorAll('.reveal');
        if (revealObserver) revealObserver.disconnect();

        if (!reveals.length) return;

        revealObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

        reveals.forEach(function(el) { revealObserver.observe(el); });
    }

    function initFaq() {
        document.querySelectorAll('.faq-item__q').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var item = btn.closest('.faq-item');
                var isOpen = item.classList.contains('open');
                document.querySelectorAll('.faq-item.open').forEach(function(i) {
                    i.classList.remove('open');
                    i.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
                });
                if (!isOpen) {
                    item.classList.add('open');
                    btn.setAttribute('aria-expanded', 'true');
                }
            });
        });
    }

    function initChatbot() {
        var chatTrigger = document.querySelector('.chatbot__trigger');
        var chatWindow = document.querySelector('.chatbot__window');
        var chatClose = document.querySelector('.chatbot__w-close');
        var chatTooltip = document.querySelector('.chatbot__tooltip');

        if (chatTrigger && chatWindow) {
            chatTrigger.addEventListener('click', function() {
                chatWindow.classList.toggle('open');
                if (chatTooltip) chatTooltip.style.display = 'none';
            });
            if (chatClose) chatClose.addEventListener('click', function() { chatWindow.classList.remove('open'); });
        }

        if (chatTooltip) {
            setTimeout(function() {
                chatTooltip.style.opacity = '0';
                setTimeout(function() { chatTooltip.style.display = 'none'; }, 300);
            }, 7000);
        }
    }

    function initForms() {
        document.querySelectorAll('form').forEach(function(form) {
            var inputs = form.querySelectorAll('.form-input');

            inputs.forEach(function(input) {
                input.addEventListener('blur', function() { validateField(input); });
                input.addEventListener('input', function() {
                    if (input.classList.contains('invalid') || input.classList.contains('valid')) {
                        validateField(input);
                    }
                });
            });

            form.addEventListener('submit', function(e) {
                e.preventDefault();
                var allValid = true;
                inputs.forEach(function(input) {
                    if (!validateField(input)) allValid = false;
                });
                if (allValid) {
                    var btn = form.querySelector('.form-submit, button[type="submit"]');
                    if (btn) {
                        var orig = btn.textContent;
                        btn.textContent = 'Enviado correctamente';
                        btn.style.background = '#10B981';
                        setTimeout(function() { btn.textContent = orig; btn.style.background = ''; }, 2500);
                    }
                }
            });
        });
    }

    function validateField(input) {
        var tag = input.tagName.toLowerCase();
        var type = input.getAttribute('type');
        var value = input.value.trim();

        if (tag === 'select') {
            if (value === '') { input.classList.remove('valid', 'invalid'); return true; }
            input.classList.add('valid'); input.classList.remove('invalid'); return true;
        }
        if (tag === 'textarea') {
            if (value === '') { input.classList.remove('valid', 'invalid'); return true; }
            input.classList.add('valid'); input.classList.remove('invalid'); return true;
        }
        if (type === 'url') {
            if (value === '') { input.classList.remove('valid', 'invalid'); return true; }
            var urlOk = /^https?:\/\/.+\..+/.test(value);
            input.classList.toggle('valid', urlOk); input.classList.toggle('invalid', !urlOk); return urlOk;
        }
        if (type === 'email') {
            if (value === '') { input.classList.add('invalid'); input.classList.remove('valid'); return false; }
            var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            input.classList.toggle('valid', emailOk); input.classList.toggle('invalid', !emailOk); return emailOk;
        }
        if (value === '') { input.classList.add('invalid'); input.classList.remove('valid'); return false; }
        input.classList.add('valid'); input.classList.remove('invalid'); return true;
    }

    function initCookieBanner() {
        var cookieBanner = document.querySelector('.cookie-banner');
        if (!cookieBanner) return;

        var cookieState = localStorage.getItem('cookies-accepted');
        if (!cookieState) {
            setTimeout(function() {
                cookieBanner.classList.add('visible');
                document.body.classList.add('cookie-visible');
            }, 1500);
        } else {
            cookieBanner.classList.add('hidden');
        }

        function hideBanner() {
            cookieBanner.classList.remove('visible');
            document.body.classList.remove('cookie-visible');
            setTimeout(function() { cookieBanner.classList.add('hidden'); }, 400);
        }

        var acceptBtn = cookieBanner.querySelector('.cookie-banner__btn--accept');
        var rejectBtn = cookieBanner.querySelector('.cookie-banner__btn--reject');
        if (acceptBtn) acceptBtn.addEventListener('click', function() {
            localStorage.setItem('cookies-accepted', 'true');
            hideBanner();
        });
        if (rejectBtn) rejectBtn.addEventListener('click', function() {
            localStorage.setItem('cookies-accepted', 'rejected');
            hideBanner();
        });
    }


    function initPricingCarousel() {
        var carousel = document.querySelector('.pricing-carousel');
        var dots = document.querySelectorAll('.pricing-dots__dot');
        if (!carousel || !dots.length) return;

        var cards = carousel.querySelectorAll('.card');
        if (cards.length > 1) {
            var secondCard = cards[1];
            var scrollTarget = secondCard.offsetLeft - (carousel.offsetWidth - secondCard.offsetWidth) / 2;
            carousel.scrollLeft = scrollTarget;
            dots.forEach(function(dot, i) { dot.classList.toggle('active', i === 1); });
        }

        carousel.addEventListener('scroll', function() {
            var scrollLeft = carousel.scrollLeft;
            var cardWidth = cards[0].offsetWidth;
            var gap = parseInt(getComputedStyle(carousel).gap) || 16;
            var index = Math.round(scrollLeft / (cardWidth + gap));
            dots.forEach(function(dot, i) {
                dot.classList.toggle('active', i === index);
            });
        });
    }

    function initPageContent() {
        initReveal();
        initFaq();
        initChatbot();
        initForms();
        initCookieBanner();
        initPricingCarousel();
    }

    bindPersistentNav();
    bindPjaxNavigation();
    updateActiveNav(window.location.href);
    initPageContent();
})();
