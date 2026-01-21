class SlideJS {


    async buildAsync(target, dom, remove_hide_page = true) {
        const pagepath = window.location.pathname;
        this.context = {
            variables: { "page_number": 1, },
            is_local: target.main ? true : false,
            pagepath: pagepath,
            pagedir: pagepath.substring(0, pagepath.lastIndexOf('/') + 1)
        };

        document.querySelectorAll("link[data-dynamically=\"true\"]").forEach(dom => {
            dom.remove();
        })

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
                this.displayMathTokenizer(this.context)
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

        const get_actual_path = (raw_path, context) => {
            const md = /^\/(.+)/.exec(raw_path);
            if (md) {
                return `${this.context.pagedir}${md[1]}`;
            }
            const is_fullurl = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(raw_path);
            if (!is_fullurl) {
                if (context.is_local) {
                    const dummy_path = context.wokingdir ? `${context.wokingdir}/${raw_path}` : raw_path;
                    const dummy_url = new URL(dummy_path, "file://");
                    const path = dummy_url.pathname.replace(/^\/+/, "");
                    return URL.createObjectURL(context.local_files[path]);
                } else {
                    return context.markdown_dir + raw_path;
                }
            } else {
                return raw_path;
            }
        };

        // Replace local file path
        document.querySelectorAll(`section img, section iframe, section video`).forEach(dom => {
            const raw_path = dom.getAttribute("src");
            const path = get_actual_path(raw_path, this.context);
            dom.setAttribute("src", path);
        });
        document.querySelectorAll(`section video`).forEach(dom => {
            const raw_path = dom.getAttribute("poster");
            const path = get_actual_path(raw_path, this.context);
            dom.setAttribute("poster", path);
        });

        // Import css
        const import_css_metas = document.querySelectorAll("meta.import-css");
        import_css_metas.forEach(meta => {
            const raw_path = meta.getAttribute("data-file");
            const path = get_actual_path(raw_path, this.context);
            this._appendStyleSheetFiles(path);
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
                const match = /^<!--\s*@note:\s*(.*?)\s*-->/.exec(src);
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
            html(html) {
                const match = html.raw.match(/<!--\s*@(.+?):\s*(.+?)\s*-->\s*$/);
                if (match) {
                    if (match[1] === "caption") {
                        this.caption = match[2];
                        return "";
                    }
                    if (match[1] === "multicolumn") {
                        this.multicolumn = match[2].split(":").map(x => Number(x));
                        this.columnIndex = 0;
                        return `<div class="multi-column"><div class="column" style="flex: ${this.multicolumn[this.columnIndex]}">`;
                    }
                    if (match[1] === "ul-class") {
                        (this.ulClass ?? (this.ulClass = [])).push(match[2]);
                        return "";
                    }
                    if (match[1] === "ol-class") {
                        (this.olClass ?? (this.olClass = [])).push(match[2]);
                        return "";
                    }
                    if (match[1] === "li-class") {
                        (this.liClass ?? (this.liClass = [])).push(match[2]);
                        return "";
                    }
                    if (match[1] === "li-attr") {
                        const [label, value] = match[2].includes(":") ? match[2].split(/:\s*(.+)/).slice(0, 2) : [match[2], ""];
                        (this.liAttrs ?? (this.liAttrs = {}))[label] = value;
                        return "";
                    }
                    if (match[1] === "blockquote-class") {
                        (this.blockquoteClass ?? (this.blockquoteClass = [])).push(match[2]);
                        return "";
                    }
                    if (match[1] === "image-class") {
                        (this.imageClass ?? (this.imageClass = [])).push(match[2]);
                        return "";
                    }
                    if (match[1] === "image-style") {
                        (this.imageStyle ?? (this.imageStyle = [])).push(match[2]);
                        return "";
                    }
                    if (match[1] === "presenter") {
                        this.presenter = match[2];
                        return "";
                    }
                    if (match[1] === "contact") {
                        this.contact = match[2];
                        return "";
                    }
                    if (match[1] === "affiliation") {
                        this.affiliation = match[2];
                        context.variables["affiliation"] = match[2];
                        return "";
                    }
                    if (match[1] === "title") {
                        this.title = match[2];
                        context.variables["title"] = match[2];
                        return "";
                    }
                    if (match[1] === "subtitle") {
                        this.subtitle = match[2];
                        context.variables["subtitle"] = match[2];
                        return "";
                    }
                    if (match[1] === "date") {
                        this.date = match[2];
                        context.variables["date"] = match[2];
                        return "";
                    }
                    if (match[1] === "css") {
                        const dom = document.createElement("meta");
                        dom.classList.add("slidejs-meta");
                        dom.classList.add("import-css");
                        dom.setAttribute("data-file", match[2]);
                        document.head.appendChild(dom);
                        return "";
                    }
                    if (match[1] === "page") {
                        const dom = document.createElement("meta");
                        dom.classList.add("slidejs-meta");
                        dom.classList.add("page-add-class");
                        dom.setAttribute("page-number", context.variables["page_number"]);
                        dom.setAttribute("add-class", match[2]);
                        document.head.appendChild(dom);
                        return "";
                    }
                    if (match[1] === "global") {
                        const dom = document.createElement("meta");
                        dom.classList.add("slidejs-meta");
                        dom.classList.add("global-add-class");
                        dom.setAttribute("add-class", match[2]);
                        document.head.appendChild(dom);
                        return "";
                    }
                }
                const match1 = html.raw.match(/<!--\s*@(.+?)\s*-->\s*$/);
                if (match1) {
                    if (match1[1] === "nextcolumn") {
                        this.columnIndex++;
                        return `</div><div class="column" style="flex: ${this.multicolumn[this.columnIndex]}">`;
                    }
                    if (match1[1] === "endmulticolumn") {
                        this.multicolumn = null;
                        this.columnIndex = -1;
                        return `</div></div>`;
                    }
                    if (match1[1] === "cover") {
                        const dom = document.createElement("meta");
                        dom.classList.add("slidejs-meta");
                        dom.classList.add("page-style");
                        dom.setAttribute("page-number", context.variables["page_number"]);
                        dom.setAttribute("style", "cover");
                        document.head.appendChild(dom);
                        let html = "";
                        if (this.title) {
                            html = html + `<div class="title">${this.title}</div>`;
                        }
                        if (this.subtitle) {
                            html = html + `<div class="subtitle">${this.subtitle}</div>`;
                        }
                        if (this.presenter) {
                            html = html + `<div class="presenter">${this.presenter}</div>`;
                        }
                        if (this.contact) {
                            html = html + `<div class="contact">${this.contact}</div>`;
                        }
                        if (this.affiliation) {
                            html = html + `<div class="affiliation">${this.affiliation}</div>`;
                        }
                        return html;
                    }
                }
                return html.raw;
            },
            hr(hr) {
                let retval = "";
                if (this.multicolumn) {
                    this.multicolumn = null;
                    this.columnIndex = -1;
                    retval = retval + `</div></div>`;
                }

                context.variables["page_number"] = context.variables["page_number"] + 1
                retval = retval + `</section><section data-style="content">`;
                return retval;
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
            list(token) {
                const tag = token.ordered ? "ol" : "ul";
                const className = token.ordered ? (this.olClass ?? []).join(" ") : (this.ulClass ?? []).join(" ");
                if (token.ordered) {
                    this.olClass = [];
                } else {
                    this.ulClass = [];
                }
                const body = token.items.map(item => {
                    const className = (this.liClass ?? []).join(" ");
                    this.liClass = [];
                    const attrs = this.liAttrs ? Object.entries(this.liAttrs).map(([k, v]) => ` data-${k}="${String(v)}"`).join("") : "";
                    this.liAttrs = {};
                    const inner = this.parser.parse(item.tokens);
                    return `<li ${attrs} class="${className}">${inner}</li>`;
                }).join("");
                const start = token.start;
                const startAttr = token.ordered && start != null && start !== "" && start !== 1 ? ` start="${start}"` : "";
                return `<${tag} class="${className}"${startAttr}>${body}</${tag}>`;
            },
            blockquote(token) {
                const inner = this.parser.parse(token.tokens);
                const className = (this.blockquoteClass ?? []).join(" ");
                this.blockquoteClass = [];
                return `<blockquote class="${className}">${inner}</blockquote>`;
            },
            image(image) {
                const caption = image.text ? image.text : this.caption;
                this.caption = null;
                const className = (this.imageClass ?? []).join(" ");
                const style = (this.imageStyle ?? []).join(" ");
                this.imageClass = [];
                this.imageStyle = [];
                let html = `<img src="${image.href}" class="${className}" style="${style}" />`;
                if (caption) {
                    html = html + `<span class="figcaption">${caption}</span>`;
                }
                return html;
            },
            table(table) {
                const caption = this.caption;
                this.caption = null;
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
                const url = `./node_modules/@highlightjs/cdn-assets/languages/${lang[1]}.min.js`;
                try {
                    await this._appendJavaScriptFilesAsync(url);
                    console.log(`load: ${url}`);
                } catch (e) {
                    console.log(`Can't load: ${url}`);
                }
            }
        }
    }

    _appendStyleSheetFiles(...urls) {
        urls.forEach(url => {
            const style = document.createElement("link");
            style.rel = "stylesheet";
            style.href = url;
            style.setAttribute("data-dynamically", "true");
            document.head.appendChild(style);
        });
    }

    async _appendJavaScriptFilesAsync(...urls) {
        for (let url of urls) {
            const promise = new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = url;
                script.async = true;
                script.onload = () => { resolve(); };
                script.onerror = (e) => { reject(e); };
                script.setAttribute("data-dynamically", "true");
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
        this.using_canvas = false;
        this.current_pen_color = "black";
        
        const slidejs = new SlideJS();
        await slidejs.buildAsync(this.target, this.dom_container);
        this.context = slidejs.context;
        this.all_dom_pages = this.dom_container.querySelectorAll("section");

        for (let page of this.all_dom_pages) {
            const dom_canvas = document.createElement("canvas");
            dom_canvas.classList.add("canvas");
            page.appendChild(dom_canvas);

            const ctx = dom_canvas.getContext('2d');
            function resizeCanvas() {
                dom_canvas.width = document.body.clientWidth;
                dom_canvas.height = document.body.clientHeight;
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);

            let drawing = false;
            let lastX = 0;
            let lastY = 0;

            dom_canvas.addEventListener('pointerdown', e => {
                if (!this.using_canvas) return;  // 描画モードでないなら無視
                drawing = true;
                [lastX, lastY] = [e.offsetX, e.offsetY];
            });

            dom_canvas.addEventListener('pointermove', e => {
                if (!this.using_canvas || !drawing) return;
                ctx.strokeStyle = this.current_pen_color;
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(e.offsetX, e.offsetY);
                ctx.stroke();
                [lastX, lastY] = [e.offsetX, e.offsetY];
            });

            dom_canvas.addEventListener('pointerup', () => drawing = false);
            dom_canvas.addEventListener('pointerout', () => drawing = false);
        }

        this.showPage(this.current_page_number);

        this._selectStartFullscreen = (event) => {
            event.preventDefault();
        };
        this._clickFullscreen = (_) => {
            if (!this.using_canvas) {
                this.showPage(this.current_page_number + 1);
                return;
            }
        }

        this._onMouseMove = (event) => {
            const pp_cursor = document.querySelector(".prenentation_pointer");
            const cp_cursor = document.querySelector(".canvas_pointer");
            if (pp_cursor) {
                pp_cursor.style.left = `${event.clientX}px`;
                pp_cursor.style.top = `${event.clientY}px`;
            }
            if (cp_cursor) {
                cp_cursor.style.left = `${event.clientX}px`;
                cp_cursor.style.top = `${event.clientY}px`;
            }
        };
        this._keydown = (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
                this.goBackPage();
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
                this.goNextPage();
            } else if (event.key === "f" || event.key === "p") {
                this.requestFullscreen();
            } else if (event.key === "b") {
                this.togglePointer();
            } else if (event.key === "c") {
                this.toggleCanvas();
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
                    const dom_prenentation_pointer = document.createElement("div");
                    dom_prenentation_pointer.classList.add("prenentation_pointer");
                    this.dom_container.appendChild(dom_prenentation_pointer);
                    dom_prenentation_pointer.style.visibility = "hidden";
                    
                    this.dom_container.classList.add("use_canvas_pointer");
                    const dom_canvas_pointer = document.createElement("div");
                    dom_canvas_pointer.classList.add("canvas_pointer");
                    this.dom_container.appendChild(dom_canvas_pointer);
                    dom_canvas_pointer.style.visibility = "hidden";

                    const tmp = document.querySelector("#tmp-paint-tool")
                    const frg_paint_tool = tmp.content.cloneNode(true);
                    this.dom_container.appendChild(frg_paint_tool);
                    const dom_paint_tool = this.dom_container.querySelector(".paint-tool");
                    dom_paint_tool.style.visibility = "hidden";

                    this.dom_container.addEventListener("selectstart", this._selectStartFullscreen);
                    this.dom_container.addEventListener("click", this._clickFullscreen);
                }
            }
            if (!document.fullscreenElement) {
                for (let page of this.all_dom_pages) {
                    page.style.zoom = 1;
                }
                this.dom_container.classList.remove("use_prenentation_pointer");
                const dom_prenentation_pointer = this.dom_container.querySelector(".prenentation_pointer");
                dom_prenentation_pointer.remove();
                
                this.dom_container.classList.remove("use_canvas_pointer");
                const dom_canvas_pointer = this.dom_container.querySelector(".canvas_pointer");
                dom_canvas_pointer.remove();
                
                const dom_paint_tool = this.dom_container.querySelector(".paint-tool");
                dom_paint_tool.remove();

                this.using_canvas = false;
                    
                this.dom_container.removeEventListener("selectstart", this._selectStartFullscreen);
                this.dom_container.removeEventListener("click", this._clickFullscreen);
            }
        };
    }

    goNextPage() {
        this.showPage(this.current_page_number + 1);
    }
    goBackPage() {
        this.showPage(this.current_page_number - 1);
    }
    togglePointer() {
        const p = document.querySelector(".prenentation_pointer");
        if (p.style.visibility === "hidden") {
            p.style.visibility = "visible";
        } else if(p) {
            p.style.visibility = "hidden";
        }
    }
    toggleCanvas() {
        const p = document.querySelector(".canvas_pointer");
        if (p.style.visibility === "hidden") {
            p.style.color = this.current_pen_color;
            p.style.visibility = "visible";
            
            const dom_paint_tool = this.dom_container.querySelector(".paint-tool");
            dom_paint_tool.style.visibility = "visible";

            this.using_canvas = true;
        } else if(p) {
            p.style.visibility = "hidden";

            const dom_paint_tool = this.dom_container.querySelector(".paint-tool");
            dom_paint_tool.style.visibility = "hidden";

            this.using_canvas = false;
        }
    }
    setPenColor(color) {
        this.current_pen_color = color;
        const p = document.querySelector(".canvas_pointer");
        if (p) {
            p.style.backgroundColor = this.current_pen_color;
        }
    }
    claerCurrentCanvas() {
        const canvas = document.querySelector(".preview-area section.show canvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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


