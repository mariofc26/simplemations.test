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

    function bindInternalAnchors() {
        document.addEventListener('click', function(e) {
            var link = e.target.closest('a[href^="#"]');
            if (!link) return;
            if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            var hash = link.getAttribute('href');
            if (!hash || hash === '#') return;

            var target = document.querySelector(hash);
            if (!target) return;

            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', hash);
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

    var CHATBOT_WEBHOOK_URL = 'https://mariofc26.app.n8n.cloud/webhook/simplemations-chatbot';
    var CHATBOT_LEAD_WEBHOOK_URL = 'https://mariofc26.app.n8n.cloud/webhook/simplemations-chatbot-lead';
    var CHATBOT_STORAGE_KEY = 'simplemations-chat-history-v3';
    var CHATBOT_LEAD_STORAGE_KEY = 'simplemations-chat-leads-sent-v1';
    var CHATBOT_AUDIT_PROMPT_KEY = 'simplemations-chat-audit-prompted-v1';
    var CHATBOT_SESSION_KEY = 'simplemations-chat-session-id';
    var CHATBOT_VISITOR_KEY = 'simplemations-visitor-id';
    var chatRuntimeHistory = [];

    try {
        localStorage.removeItem(CHATBOT_STORAGE_KEY);
    } catch (e) {}

    function getStoredId(key, prefix) {
        var existing = localStorage.getItem(key);
        if (existing) return existing;
        var value = prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(key, value);
        return value;
    }

    function readChatHistory() {
        return chatRuntimeHistory.slice();
    }

    function saveChatHistory(history) {
        chatRuntimeHistory = history.slice(-20);
    }

    function readSentChatLeads() {
        try {
            return JSON.parse(localStorage.getItem(CHATBOT_LEAD_STORAGE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function recentUserContext(history) {
        return history
            .filter(function(item) { return item.role === 'user'; })
            .slice(-6)
            .map(function(item) { return item.text; })
            .join('\n')
            .trim();
    }

    function extractLeadDetails(text) {
        var emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        var phoneMatch = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
        var textWithoutContact = text
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, ' ')
            .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, ' ');
        var nameMatch = textWithoutContact.match(/(?:me llamo|mi nombre es|nombre(?: y apellidos)?\s*[:\-]?)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){1,4})/i);
        var fullName = nameMatch ? nameMatch[1].trim() : findStandaloneFullName(textWithoutContact);

        return {
            email: emailMatch ? emailMatch[0].toLowerCase() : '',
            phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : '',
            fullName: fullName
        };
    }

    function findStandaloneFullName(text) {
        var blocked = /\b(chatbot|chatbots|servicio|servicios|producto|productos|informacion|info|interesado|interesada|quiero|necesito|necesitas|necesario|auditoria|presupuesto|telefono|email|mail|correo|empresa|automatizar|proceso|web|whatsapp|leads|soporte|captacion|enviado|enviar|recibido|falta|datos|solicitud|coordinar|hola|gracias|vale|si|no)\b/i;
        var lines = text
            .split(/\n+/)
            .map(function(line) { return line.trim(); })
            .filter(Boolean)
            .reverse();

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('@') !== -1 || /\d/.test(line) || /[?¿!¡.,:;]/.test(line) || blocked.test(line)) continue;
            var words = line.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) || [];
            if (words.length >= 2 && words.length <= 5 && words.join(' ').length >= 6) {
                return words.join(' ');
            }
        }

        return '';
    }

    function hasFullName(name) {
        return name && name.split(/\s+/).filter(Boolean).length >= 2;
    }

    function hasUsefulBusinessContext(text) {
        var cleaned = text
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '')
            .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '')
            .trim();

        return cleaned.length >= 70 ||
            /\b(proceso|tarea|crm|whatsapp|email|formulario|factura|lead|cliente|ventas|reserva|documento|informe|chatbot|ia|administracion|soporte|seguimiento)\b/i.test(cleaned);
    }

    function shouldCaptureChatLead(history) {
        var context = recentUserContext(history);
        var details = extractLeadDetails(context);

        return Boolean(details.email) &&
            Boolean(details.phone) &&
            hasFullName(details.fullName) &&
            hasUsefulBusinessContext(context);
    }

    function maybeSendChatLead(history) {
        if (!CHATBOT_LEAD_WEBHOOK_URL || !shouldCaptureChatLead(history)) return Promise.resolve(false);

        var context = recentUserContext(history);
        var details = extractLeadDetails(context);
        var contactKey = getStoredId(CHATBOT_SESSION_KEY, 'session') + '|' + details.email + '|' + details.phone + '|' + details.fullName;
        if (!contactKey) return Promise.resolve(false);

        var sent = readSentChatLeads();
        var leadKey = contactKey.toLowerCase();
        if (sent[leadKey]) return Promise.resolve(false);

        return fetch(CHATBOT_LEAD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: context,
                name: details.fullName,
                full_name: details.fullName,
                email: details.email,
                phone: details.phone,
                conversation_context: context,
                lead_stage: 'complete_contact',
                session_id: getStoredId(CHATBOT_SESSION_KEY, 'session'),
                visitor_id: getStoredId(CHATBOT_VISITOR_KEY, 'visitor'),
                source_url: window.location.href
            })
        })
            .then(function(response) {
                if (!response.ok) return false;
                sent[leadKey] = true;
                localStorage.setItem(CHATBOT_LEAD_STORAGE_KEY, JSON.stringify(sent));
                return true;
            })
            .catch(function() { return false; });
    }

    function maybeAskForAudit(messages, previousAnswer) {
        if (localStorage.getItem(CHATBOT_AUDIT_PROMPT_KEY) === 'true') return;
        if (previousAnswer && /auditor[ií]a gratuita/i.test(previousAnswer)) return;
        localStorage.setItem(CHATBOT_AUDIT_PROMPT_KEY, 'true');

        var text = 'Gracias, ya tengo suficiente contexto para trasladar tu caso. ¿Te gustaria que lo enfoquemos como una auditoria gratuita para revisar que automatizar primero?';
        appendChatMessage(messages, 'assistant', text);

        var history = readChatHistory();
        history.push({ role: 'assistant', text: text });
        saveChatHistory(history);
    }

    function appendInlineFormattedText(parent, text) {
        String(text || '').split(/(\*\*[^*]+\*\*)/g).forEach(function(part) {
            if (!part) return;
            if (part.indexOf('**') === 0 && part.lastIndexOf('**') === part.length - 2) {
                var strong = document.createElement('strong');
                strong.textContent = part.slice(2, -2);
                parent.appendChild(strong);
                return;
            }
            parent.appendChild(document.createTextNode(part.replace(/\*/g, '')));
        });
    }

    function renderFormattedAssistantText(container, text) {
        container.innerHTML = '';

        var lines = String(text || '').split(/\n+/).map(function(line) {
            return line.trim();
        }).filter(Boolean);

        if (!lines.length) return;

        var list = null;
        var listType = '';

        function closeList() {
            list = null;
            listType = '';
        }

        lines.forEach(function(line) {
            var numbered = line.match(/^\d+[.)]\s+(.+)$/);
            var bullet = line.match(/^[-*]\s+(.+)$/);

            if (numbered || bullet) {
                var nextType = numbered ? 'ol' : 'ul';
                if (!list || listType !== nextType) {
                    list = document.createElement(nextType);
                    listType = nextType;
                    container.appendChild(list);
                }
                var item = document.createElement('li');
                appendInlineFormattedText(item, numbered ? numbered[1] : bullet[1]);
                list.appendChild(item);
                return;
            }

            closeList();
            var paragraph = document.createElement('p');
            appendInlineFormattedText(paragraph, line);
            container.appendChild(paragraph);
        });
    }

    function setChatBubbleText(bubble, role, text) {
        if (role === 'assistant') {
            renderFormattedAssistantText(bubble, text);
        } else {
            bubble.textContent = text;
        }
    }

    function appendChatMessage(messages, role, text, options) {
        var bubble = document.createElement('div');
        bubble.className = 'chatbot__bubble chatbot__bubble--' + role;
        if (options && options.loading) bubble.classList.add('chatbot__bubble--loading');
        if (options && options.error) bubble.classList.add('chatbot__bubble--error');
        setChatBubbleText(bubble, role, text);
        messages.appendChild(bubble);
        if (messages.children.length > 1) {
            var root = messages.closest('.chatbot');
            if (root) root.classList.add('chatbot--expanded');
        }
        messages.scrollTop = messages.scrollHeight;
        return bubble;
    }

    function renderChatHistory(messages) {
        var history = readChatHistory();
        messages.innerHTML = '';
        if (!history.length) {
            appendChatMessage(messages, 'assistant', 'Hola. Soy el asistente de Simplemations. Puedo ayudarte con servicios, automatizaciones, chatbots, IA y auditoria gratuita.');
            return;
        }
        history.forEach(function(item) {
            appendChatMessage(messages, item.role, item.text);
        });
    }

    function setChatBusy(root, busy) {
        var input = root.querySelector('.chatbot__input');
        var send = root.querySelector('.chatbot__send');
        var status = root.querySelector('.chatbot__w-status');
        if (input) input.disabled = busy;
        if (send) send.disabled = busy;
        if (status) status.textContent = busy ? 'Pensando...' : 'En linea';
    }

    function sendChatMessage(root) {
        var input = root.querySelector('.chatbot__input');
        var messages = root.querySelector('.chatbot__messages');
        if (!input || !messages) return;

        var message = input.value.trim();
        if (!message) return;

        var history = readChatHistory();
        history.push({ role: 'user', text: message });
        saveChatHistory(history);
        appendChatMessage(messages, 'user', message);
        var leadPromise = maybeSendChatLead(history);
        input.value = '';

        var loading = appendChatMessage(messages, 'assistant', 'Revisando la informacion...', { loading: true });
        setChatBusy(root, true);

        fetch(CHATBOT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                session_id: getStoredId(CHATBOT_SESSION_KEY, 'session'),
                visitor_id: getStoredId(CHATBOT_VISITOR_KEY, 'visitor'),
                source_url: window.location.href
            })
        })
            .then(function(response) {
                if (!response.ok) throw new Error('Chatbot request failed');
                return response.json();
            })
            .then(function(data) {
                var answer = data.answer || data.message || 'He recibido tu mensaje, pero no he podido generar una respuesta completa.';
                loading.classList.remove('chatbot__bubble--loading');
                setChatBubbleText(loading, 'assistant', answer);
                history = readChatHistory();
                history.push({ role: 'assistant', text: answer });
                saveChatHistory(history);
                if (data.session_id) localStorage.setItem(CHATBOT_SESSION_KEY, data.session_id);
                leadPromise.then(function(saved) {
                    if (saved) maybeAskForAudit(messages, answer);
                });
            })
            .catch(function() {
                var fallback = 'Estoy terminando de conectarme con la base de conocimiento. Mientras tanto, puedo orientarte mejor si me escribes a info@simplemations.com o pides la auditoria gratuita desde Contacto.';
                loading.classList.remove('chatbot__bubble--loading');
                loading.classList.add('chatbot__bubble--notice');
                setChatBubbleText(loading, 'assistant', fallback);
                history = readChatHistory();
                history.push({ role: 'assistant', text: fallback });
                saveChatHistory(history);
            })
            .finally(function() {
                setChatBusy(root, false);
                if (input) input.focus();
            });
    }

    function initChatbot() {
        var root = document.querySelector('.chatbot');
        if (!root || root.getAttribute('data-chat-ready') === 'true') return;
        root.setAttribute('data-chat-ready', 'true');

        var chatTrigger = root.querySelector('.chatbot__trigger');
        var chatWindow = root.querySelector('.chatbot__window');
        var chatClose = root.querySelector('.chatbot__w-close');
        var chatTooltip = root.querySelector('.chatbot__tooltip');
        var messages = root.querySelector('.chatbot__messages');
        var input = root.querySelector('.chatbot__input');
        var send = root.querySelector('.chatbot__send');

        if (messages) renderChatHistory(messages);

        if (chatTrigger && chatWindow) {
            chatTrigger.addEventListener('click', function() {
                chatWindow.classList.toggle('open');
                chatTrigger.setAttribute('aria-expanded', chatWindow.classList.contains('open') ? 'true' : 'false');
                if (chatTooltip) chatTooltip.style.display = 'none';
                if (chatWindow.classList.contains('open') && input) setTimeout(function() { input.focus(); }, 120);
            });
        }
        if (chatClose && chatWindow) {
            chatClose.addEventListener('click', function() {
                chatWindow.classList.remove('open');
                if (chatTrigger) chatTrigger.setAttribute('aria-expanded', 'false');
            });
        }
        if (send) send.addEventListener('click', function() { sendChatMessage(root); });
        if (input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage(root);
                }
            });
        }

        if (chatTooltip) {
            function hideTooltip() {
                chatTooltip.style.opacity = '0';
                setTimeout(function() { chatTooltip.style.display = 'none'; }, 300);
            }
            setTimeout(hideTooltip, 7000);
            window.addEventListener('scroll', function onScroll() {
                hideTooltip();
                window.removeEventListener('scroll', onScroll);
            });
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
                if (!allValid) return;

                var endpoint = form.getAttribute('data-webhook-url') || form.getAttribute('action');
                var btn = form.querySelector('.form-submit, button[type="submit"]');
                var hint = form.querySelector('.form-hint');

                if (!endpoint || endpoint.indexOf('TU_N8N_DOMINIO') !== -1) {
                    showFormMessage(btn, hint, 'Webhook pendiente de configurar', false);
                    return;
                }

                submitWebhookForm(form, endpoint, btn, hint, inputs);
            });
        });
    }

    function submitWebhookForm(form, endpoint, btn, hint, inputs) {
        var originalText = btn ? (btn.getAttribute('data-original-text') || btn.textContent) : '';
        if (btn && !btn.getAttribute('data-original-text')) btn.setAttribute('data-original-text', originalText);
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Enviando...';
            btn.style.background = '';
        }
        if (hint) hint.textContent = 'Estamos enviando tu solicitud...';

        var payload = new URLSearchParams(new FormData(form));
        payload.set('source_page', window.location.href);

        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: payload.toString()
        })
            .then(function(response) {
                if (!response.ok) throw new Error('Form submission failed');
                return response.text();
            })
            .then(function() {
                showFormMessage(btn, hint, 'Solicitud enviada correctamente', true);
                form.reset();
                inputs.forEach(function(input) { input.classList.remove('valid', 'invalid'); });
            })
            .catch(function() {
                showFormMessage(btn, hint, 'No se pudo enviar. Escríbenos a info@simplemations.com.', false);
            })
            .finally(function() {
                if (btn) {
                    setTimeout(function() {
                        btn.disabled = false;
                        btn.textContent = btn.getAttribute('data-original-text') || originalText;
                        btn.style.background = '';
                    }, 3000);
                }
            });
    }

    function showFormMessage(btn, hint, message, success) {
        if (btn) {
            btn.textContent = message;
            btn.style.background = success ? '#10B981' : '#EF4444';
        }
        if (hint) hint.textContent = success ? 'Gracias. Hemos recibido tus datos y te contactaremos en menos de 24h laborables.' : message;
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


    function initStepsCarousel() {
        var carousel = document.querySelector('.steps-carousel');
        var dots = document.querySelectorAll('.steps-dots__dot');
        if (!carousel || !dots.length) return;

        carousel.addEventListener('scroll', function() {
            var scrollLeft = carousel.scrollLeft;
            var cardWidth = carousel.querySelector('.card').offsetWidth;
            var gap = parseInt(getComputedStyle(carousel).gap) || 16;
            var index = Math.round(scrollLeft / (cardWidth + gap));
            dots.forEach(function(dot, i) {
                dot.classList.toggle('active', i === index);
            });
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

    function initMobileCarousels() {
        document.querySelectorAll('.mobile-carousel').forEach(function(carousel) {
            var dots = [];
            var next = carousel.nextElementSibling;
            if (next && next.classList.contains('mobile-dots')) {
                dots = Array.prototype.slice.call(next.querySelectorAll('.mobile-dots__dot'));
            }
            if (!dots.length) return;

            var cards = carousel.children;
            if (!cards.length) return;

            function updateDots() {
                var cardWidth = cards[0].offsetWidth;
                var gap = parseInt(getComputedStyle(carousel).gap) || 16;
                var index = Math.round(carousel.scrollLeft / (cardWidth + gap));
                index = Math.max(0, Math.min(index, dots.length - 1));
                dots.forEach(function(dot, i) {
                    dot.classList.toggle('active', i === index);
                });
            }

            carousel.addEventListener('scroll', updateDots);
            updateDots();
        });
    }

    function initCarouselArrows() {
        document.querySelectorAll('.slider-arrows').forEach(function(controls) {
            var carousel = findPreviousCarousel(controls);
            if (!carousel) return;

            var prev = controls.querySelector('.slider-arrow--prev');
            var next = controls.querySelector('.slider-arrow--next');
            var items = Array.prototype.filter.call(carousel.children, function(child) {
                return child.classList.contains('card') || child.classList.contains('sector-card');
            });
            if (!items.length) return;

            function go(direction) {
                var gap = parseInt(getComputedStyle(carousel).gap) || 16;
                var step = items[0].offsetWidth + gap;
                var currentIndex = Math.round(carousel.scrollLeft / step);
                var targetIndex = (currentIndex + direction + items.length) % items.length;
                var target = items[targetIndex].offsetLeft - (carousel.offsetWidth - items[targetIndex].offsetWidth) / 2;

                carousel.scrollTo({
                    left: Math.max(0, target),
                    behavior: 'smooth'
                });
            }

            if (prev) prev.addEventListener('click', function() { go(-1); });
            if (next) next.addEventListener('click', function() { go(1); });
        });
    }

    function findPreviousCarousel(element) {
        var node = element.previousElementSibling;
        while (node) {
            if (node.matches('.steps-carousel, .pricing-carousel, .mobile-carousel')) {
                return node;
            }
            node = node.previousElementSibling;
        }
        return null;
    }

    function initPageContent() {
        initReveal();
        initFaq();
        initChatbot();
        initForms();
        initCookieBanner();
        initStepsCarousel();
        initPricingCarousel();
        initMobileCarousels();
        initCarouselArrows();
    }

    bindPersistentNav();
    bindPjaxNavigation();
    bindInternalAnchors();
    updateActiveNav(window.location.href);
    initPageContent();
})();
