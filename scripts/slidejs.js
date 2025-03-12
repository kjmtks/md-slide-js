class SlideJS {
    async buildAsync(target, dom, remove_hide_page = true) {
        this.context = {
            variables: { "page_number": 1, },
            is_local: target.main ? true : false,
        };

        const res_md = this.context.is_local ? await fetch(URL.createObjectURL(target.main)) : await fetch(target);
        const content = await res_md.text();
        if (this.context.is_local) {
            this.context.local_files = target.files;
            this.context.wokingdir = target.wokingdir;
        } else {
            let markdown_dir = target;
            try {
                const url = new URL(target);
                markdown_dir = url.origin + url.pathname.substring(0, url.pathname.lastIndexOf("/") + 1);
            } catch (e) {
                markdown_dir = target.replace(/\/[^/]*$/, "/");
            }
            this.context.markdown_dir = markdown_dir;
        }

        marked.use({
            breaks: true,
            gfm: true,
            async: true,
            extensions: [
                this.metaTokenizer(this.context),
                this.referenceVariableTokenizer(this.context),
                this.noteTokenizer(this.context),
                this.inlineMathTokenizer(this.context),
                this.displayMathTokenizer(this.context),
                this.multiColumnTokenizer(this.context)
            ],
            walkTokens : this.slidejsWalkTokens(this.context),
            renderer: this.slidejsRenderer(this.context)
        });
        dom.innerHTML = `<section data-style="content">${await marked.parse(content)}</section>`;
        const slidejs_id = Math.random();
        for (let section of dom.querySelectorAll("section")) {
            section.setAttribute("data-slidejs-id", slidejs_id);
        }
    
        // dynamic add class
        const page_metas = document.querySelectorAll("meta.page-add-class");
        const dom_sections = dom.querySelectorAll(`section`);
        for (let meta of page_metas) {
            const page_number = parseInt(meta.getAttribute("page-number"));
            const add_class = meta.getAttribute("add-class");
            dom_sections[page_number - 1].classList.add(add_class);
        }

        const global_metas = document.querySelectorAll("meta.global-add-class");
        for (let meta of global_metas) {
            const add_class = meta.getAttribute("add-class");
            for (let section of dom_sections) {
                section.classList.add(add_class);
            }
        }

        // Page style
        const page_style_metas = document.querySelectorAll("meta.page-style");
        for (let meta of page_style_metas) {
            const page_number = parseInt(meta.getAttribute("page-number"));
            const style = meta.getAttribute("style");
            dom_sections[page_number - 1].setAttribute("data-style", style)
        }
        
        if (remove_hide_page) {
            const dom_hide_sections = document.querySelectorAll(`section.hide`);
            for (let section of dom_hide_sections) {
                section.remove();
            }
        }

        // Replace local file path
        const replace_local_file_path = (dom, attr_name, context) => {
            const raw_src = dom.getAttribute(attr_name);
            const is_fullurl = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(raw_src);
            if (!is_fullurl) {
                if (context.is_local) {
                    const dummy_path = context.wokingdir ? `${context.wokingdir}/${raw_src}` : raw_src;
                    const dummy_url = new URL(dummy_path, "file://");
                    const path = dummy_url.pathname.replace(/^\/+/, "");
                    dom.setAttribute(attr_name, URL.createObjectURL(context.local_files[path]));
                } else {
                    dom.setAttribute(attr_name, context.markdown_dir + raw_src);
                }
            }
        }
        document.querySelectorAll(`section img, section iframe, section video`).forEach(dom => {
            replace_local_file_path(dom, "src", this.context);
        });
        document.querySelectorAll(`section video`).forEach(dom => {
            replace_local_file_path(dom, "poster", this.context);
        });

        // Page
        const sections = document.querySelectorAll("section");
        for (let [index, section] of sections.entries()) {
            const dom_page = document.createElement("div");
            dom_page.classList.add("page-number");
            dom_page.innerText = `${index + 1} / ${sections.length}`;
            section.appendChild(dom_page);
        }
    }

    metaTokenizer(context) {
        return {
            name: "meta",
            level: "block",
            start(src) { return src.indexOf("[:")?.index; },
            tokenizer(src) {
                const match = /^\[\:\s*([^(\:\])]+?)\s*\:\]/.exec(src);
                if (match) {
                    return {
                        type: 'meta',
                        raw: match[0],
                        text: match[1].trim(),
                        tokens: this.lexer.blockTokens(match[1].trim())
                    };
                }
                return false;
            },
            renderer(token) {
                let md = token.text.match(/\s*([^\=\s]+)\s*\=\s*([^\=]+)\s*/);
                if (md) {
                    context.variables[md[1]] = md[2];
                    return "";
                }

                md = token.text.match(/\s*page\s+(.+)\s*/);
                if (md) {
                    const dom = document.createElement("meta");
                    dom.classList.add("slidejs-meta");
                    dom.classList.add("page-add-class");
                    dom.setAttribute("page-number", context.variables["page_number"]);
                    dom.setAttribute("add-class", md[1]);
                    document.head.appendChild(dom);
                }
        
                md = token.text.match(/\s*global\s+(.+)\s*/);
                if (md) {
                    const dom = document.createElement("meta");
                    dom.classList.add("slidejs-meta");
                    dom.classList.add("global-add-class");
                    dom.setAttribute("add-class", md[1]);
                    document.head.appendChild(dom);
                }

                md = token.text.match(/\s*!([\s\S]+)\s*/);
                if (md && md[1] === "cover") {
                    const dom = document.createElement("meta");
                    dom.classList.add("slidejs-meta");
                    dom.classList.add("page-style");
                    dom.setAttribute("page-number", context.variables["page_number"]);
                    dom.setAttribute("style", "cover");
                    document.head.appendChild(dom);
                    let html = "";
                    if (context.variables["title"]) {
                        html = html + `<div class="title">${context.variables["title"]}</div>`;
                    }
                    if (context.variables["subtitle"]) {
                        html = html + `<div class="subtitle">${context.variables["subtitle"]}</div>`;
                    }
                    if (context.variables["presenter"]) {
                        html = html + `<div class="presenter">${context.variables["presenter"]}</div>`;
                    }
                    if (context.variables["contact"]) {
                        html = html + `<div class="contact">${context.variables["contact"]}</div>`;
                    }
                    if (context.variables["affiliation"]) {
                        html = html + `<div class="affiliation">${context.variables["affiliation"]}</div>`;
                    }
                    return html;
                }
        
                return "";
            }
        };
    }
    
    referenceVariableTokenizer(context) {
        return {
            name: "reference-variable",
            level: "inline",
            start(src) { return src.indexOf("[:")?.index; },
            tokenizer(src) {
                const match = /^\[\:\:\s*([^(\:\:\])]+?)\s*\:\:\]/.exec(src);
                if (match) {
                    return {
                        type: 'reference-variable',
                        raw: match[0],
                        text: match[1].trim(),
                        tokens: this.lexer.blockTokens(match[1].trim())
                    };
                }
                return false;
            },
            renderer(token) {
                return context.variables[token.text]
            }
        };
    }
    
    noteTokenizer(context) {
        return {
            name: "note",
            level: "block",
            start(src) { return src.indexOf("<!--")?.index; },
            tokenizer(src) {
                const match = /^\<\!\-\-\s*note:\s*([^(\-\-\>)]+?)\s*\-\-\>/.exec(src);
                if (match) {
                    return  {
                        type: 'note',
                        raw: match[0],
                        text: match[1].trim(),
                        tokens: this.lexer.blockTokens(match[1].trim())
                    };
                }
                return false;
            },
            renderer(token) {
                return `<div class="note">${this.parser.parse(token.tokens)}</div>`;
            }
        };
    }

    multiColumnTokenizer(context) {
        return {
            name: "multi_column",
            level: "block",
            start(src) { return src.indexOf("[[[")?.index; },
            tokenizer(src) {
                const match = /^\[\[\[\s*([\s\S]+?)\s*\]\]\]/.exec(src);
                if (match) {
                    const cols = match[1].split("||");
                    console.log()
                    return {
                        type: 'multi_column',
                        raw: match[0],
                        text: cols.map(t => t.trim()).join(""),
                        tokens: cols.map(t => this.lexer.blockTokens(t.trim()))
                    };
                }
                return false;
            },
            renderer(token) {
                let html = `<div class="multi-column">`;
                token.tokens.forEach(t => {
                    html = html + `<div class="column">${this.parser.parse(t)}</div>`
                })
                html = html + `</div>`;
                return html;
            }
        };
    }

    inlineMathTokenizer(context) {
        return {
            name: "inline_math",
            level: "inline",
            start(src) { return src.indexOf("\(")?.index; },
            tokenizer(src) {
                const match = /^\\\(\s*(.*?)\s*\\\)/.exec(src);
                if (match) {
                    return {
                        type: 'inline_math',
                        raw: match[0],
                        text: match[1].trim(),
                        tokens: match[1].trim()
                    };
                }
                return false;
            },
            renderer(token) {
                return `<span>\\(${token.text}\\)</span>`;
            }
        };
    }

    displayMathTokenizer(context) {
        return {
            name: "display_math",
            level: "block",
            start(src) { return src.indexOf("\[")?.index; },
            tokenizer(src) {
                const match = /^\\\[\s*(.*?)\s*\\\]/.exec(src);
                if (match) {
                    return {
                        type: 'display_math',
                        raw: match[0],
                        text: match[1].trim(),
                        tokens: match[1].trim()
                    };
                }
                return false;
            },
            renderer(token) {
                return `<div>\\[${token.text}\\]</div>`;
            }
        };
    }

    slidejsRenderer(context) {
        return {
            hr(hr) {
                context.variables["page_number"] = context.variables["page_number"] + 1
                return `</section><section data-style="content">`;
            },
            heading(heading) {
                if (heading.depth == 1) {
                    return `<div class="title">${this.parser.parseInline(heading.tokens)}</div>`;
                    
                }
                if (heading.depth == 2) {
                    return `<div class="subtitle">${this.parser.parseInline(heading.tokens)}</div>`;
                }
                return `<div class="heading${heading.depth}">${this.parser.parseInline(heading.tokens)}</div>`;
            },
            image(image) {
                if (image.text) {
                    return `<figure><img src="${image.href}" alt=${image.text}><figcaption>${image.text}</figcaption></figure>`;
                } else {
                    return `<figure><img src="${image.href}" alt=${image.text}></figure>`;
                }
            },
            table(table) {
                const caption = this.lastTableCaption;
                this.lastTableCaption = "";
                let html = caption ? `<figure><figcaption>${caption}</figcaption>` : "<figure>";
                const header_html = table.header.map(th => this.parser.parseInline(th.tokens)).join("</th><th>")
                html = html + `<table><thead><tr><th>${header_html}</th></tr></thead><tbody>`;
                for (let row of table.rows) {
                    const row_html = row.map(td => this.parser.parseInline(td.tokens)).join("</td><td>")
                    html = html + `<tr><td>${row_html}</td></tr>`
                }
                html = html + `</tbody></table></figure>`
                return html;
            },
            em(em) {
                if (em.raw[0] === "_") {
                    return `<i>${this.parser.parseInline(em.tokens)}</i>`;
                } else {
                    const captionMatch = em.raw.match(/^\*caption:\s*([^\*]+)\*/);
                    if (captionMatch) {
                        this.lastTableCaption = captionMatch[1];
                        return "";
                    }
                    return `<em>${this.parser.parseInline(em.tokens)}</em>`;
                }
            },
            code(code) {
                let lang = code.lang.match(/^([^:]+)/);
                const name = code.lang.match(/[^:]*:(.*)/);
                let classes = ["code-block"];
                if (lang) { classes.push(`language-${lang[1]}`); }
                if (name) { classes.push("has-name"); }
                if (name) {
                    return `<pre><pre class="code-name">${name[1]}</pre><code class="${classes.join(" ")}">${code.text}</code></pre>`;
                }
                else {
                    return `<pre><code class="${classes.join(" ")}">${code.text}</code></pre>`;
                }
            }
        };
    }

    slidejsWalkTokens(context) {
        return async (token) => {
            if (token instanceof Array) {
                for (let t of token) { await this._checkCodeLangAsync(t); }
            } else {
                await this._checkCodeLangAsync(token);
            }
        };
    }

    async _checkCodeLangAsync(token) {
        if (token.type === "code") {
            let lang = token.lang.match(/^([^:]+)/);
            if (lang && !hljs.listLanguages().includes(lang[1])) {
                const url = `./scripts/external/highlight-lang/${lang[1]}.min.js`;
                await this._appendJavaScriptFilesAsync(url);
                console.log(`load: ${url}`);
            }
        }
    }

    _appendStyleSheetFiles(...urls) {
        urls.forEach(url => {
            const style = document.createElement("link");
            style.rel = "stylesheet";
            style.href = url;
            document.head.appendChild(style);
        });
    }

    async _appendJavaScriptFilesAsync(...urls) {
        for (let url of urls) {
            const promise = new Promise((resolve, _) => {
                const script = document.createElement("script");
                script.src = url;
                script.async = true;
                script.onload = () => { resolve(); };
                document.head.appendChild(script);
            })
            await promise;
        }
    }

}

class SlideJSSlideShow {
    constructor(dom_container, target, initial_page_number, afterShowPagecallback = null) {
        this.dom_container = dom_container;
        this.target = target;
        this.current_page_number = initial_page_number;
        this.afterShowPagecallback = afterShowPagecallback;
        this.is_local = target.main ? true : false;
    }
    
    async buildAsync() {
        this.dom_current_page = null;
        this.all_dom_pages = [];
        this.is_active = false;
        
        const slidejs = new SlideJS();
        await slidejs.buildAsync(this.target, this.dom_container);
        this.context = slidejs.context;
        this.all_dom_pages = this.dom_container.querySelectorAll("section");
        this.showPage(this.current_page_number);

        this._selectStartFullscreen = (event) => {
            event.preventDefault();
        };
        this._clickFullscreen = (_) => {
            this.showPage(this.current_page_number + 1);
        }

        this._onMouseMove = (event) => {
            const cursor = document.querySelector(".prenentation_pointer");
            if (cursor) {
                cursor.style.left = `${event.clientX}px`;
                cursor.style.top = `${event.clientY}px`;
            }
        };
        this._keydown = (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                this.showPage(this.current_page_number - 1);
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                this.showPage(this.current_page_number + 1);
            } else if (event.key === "f") {
                this.requestFullscreen();
            }
        };
        this.requestFullscreen = () => {
            if (this.dom_container.requestFullscreen) {
                this.dom_container.requestFullscreen();
            } else if (this.dom_container.mozRequestFullScreen) { // Firefox
                this.dom_container.mozRequestFullScreen();
            } else if (this.dom_container.webkitRequestFullscreen) { // Chrome, Safari, Edge
                this.dom_container.webkitRequestFullscreen();
            } else if (this.dom_container.msRequestFullscreen) { // IE
                this.dom_container.msRequestFullscreen();
            }
        }
        this._onFullscreenChange = () => {
            if (document.fullscreenElement) {
                if (this.dom_current_page) {
                    const scaleX = this.dom_container.clientWidth / this.dom_current_page.offsetWidth;
                    const scaleY = this.dom_container.clientHeight / this.dom_current_page.offsetHeight;
                    const scale = Math.min(scaleX, scaleY);
                    for (let page of this.all_dom_pages) {
                        page.style.zoom = scale;
                    }
                    this.dom_container.classList.add("use_prenentation_pointer");
                    const com_prenentation_pointer = document.createElement("div");
                    com_prenentation_pointer.classList.add("prenentation_pointer");
                    this.dom_container.appendChild(com_prenentation_pointer);
                    
                    this.dom_container.addEventListener("selectstart", this._selectStartFullscreen);
                    this.dom_container.addEventListener("click", this._clickFullscreen);
                }
            }
            if (!document.fullscreenElement) {
                for (let page of this.all_dom_pages) {
                    page.style.zoom = 1;
                }
                this.dom_container.classList.remove("use_prenentation_pointer");
                const com_prenentation_pointer = this.dom_container.querySelector(".prenentation_pointer");
                com_prenentation_pointer.remove();
                    
                this.dom_container.removeEventListener("selectstart", this._selectStartFullscreen);
                this.dom_container.removeEventListener("click", this._clickFullscreen);
            }
        };
    }

    generateThumbnails() {
        let thumbs = [];
        for (let [index, dom_page] of this.all_dom_pages.entries()) {
            const dom_thumb = dom_page.cloneNode(true);
            dom_thumb.setAttribute("data-page-number", index+1);
            dom_thumb.classList.add("show");
            dom_thumb.classList.add("thumbnail-page");
            thumbs.push(dom_thumb);
        }
        return thumbs;
    }

    showPage(page_number) {
        if (page_number < 1 || page_number > this.all_dom_pages.length) {
            return;
        }
        if (this.dom_current_page) {
            this.dom_current_page.classList.remove("show");
        }
        this.current_page_number = page_number;
        this.dom_current_page = this.all_dom_pages[this.current_page_number-1];
        this.dom_current_page.classList.add("show");

        if (this.afterShowPagecallback) {
            this.afterShowPagecallback(page_number, this.dom_current_page);
        }
    }

    attachOnClickFullscreenStartEvent(dom) {
        dom.onclick(() => {
            this.activate();
            this.requestFullscreen();
        });
    }

    activate() {
        document.addEventListener("fullscreenchange", this._onFullscreenChange);
        document.addEventListener("mousemove", this._onMouseMove);
        document.addEventListener("keydown", this._keydown);
        this.is_active = true;
    }

    deactivate() {
        document.removeEventListener("fullscreenchange", this._onFullscreenChange);
        document.removeEventListener("mousemove", this._onMouseMove);
        document.removeEventListener("keydown", this._keydown);
        this.is_active = false;
    }
}

