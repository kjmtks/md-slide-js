let variables = {
    "page_number": 1
};


/* Tokenizers */
globalThis.metaTokenizer = {
    name: "meta",
    level: "block",
    start(src) { return src.indexOf("[:")?.index; },
    tokenizer(src) {
        const match = /^\[\:\s*([^(\:\])]+?)\s*\:\]/.exec(src);
        if (match) {
            return token = {
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
            variables[md[1]] = md[2];
            return "";
        }

        md = token.text.match(/\s*page\s+(.+)\s*/);
        if (md) {
            const dom = document.createElement("meta");
            dom.classList.add("page-add-class");
            dom.setAttribute("page-number", variables["page_number"]);
            dom.setAttribute("add-class", md[1]);
            document.head.appendChild(dom);
        }

        md = token.text.match(/\s*global\s+(.+)\s*/);
        if (md) {
            const dom = document.createElement("meta");
            dom.classList.add("global-add-class");
            dom.setAttribute("add-class", md[1]);
            document.head.appendChild(dom);
        }
        md = token.text.match(/\s*([^\=]+)\s*/);
        if (md && md[1] === "cover") {
            let html = "";
            if (variables["title"]) {
                html = html + `<div class="title">${variables["title"]}</div>`;
            }
            if (variables["subtitle"]) {
                html = html + `<div class="subtitle">${variables["subtitle"]}</div>`;
            }
            if (variables["presenter"]) {
                html = html + `<div class="presenter">${variables["presenter"]}</div>`;
            }
            if (variables["contact"]) {
                html = html + `<div class="contact">${variables["contact"]}</div>`;
            }
            if (variables["affiliation"]) {
                html = html + `<div class="affiliation">${variables["affiliation"]}</div>`;
            }
            return html;
        }

        return "";
    }
}

globalThis.commentTokenizer = {
    name: "comment",
    level: "block",
    start(src) { return src.indexOf("<!--")?.index; },
    tokenizer(src) {
        const match = /^\<\!\-\-\s*([^(\-\-\>)]+?)\s*\-\-\>/.exec(src);
        if (match) {
            return token = {
                type: 'comment',
                raw: match[0],
                text: match[1].trim(),
                tokens: this.lexer.blockTokens(match[1].trim())
            };
        }
        return false;
    },
    renderer(token) {
        const match = token.text.match(/\s*note:\s*([\s\S]*)\s*$/);
        if (match) {
            return `<div class="note">${this.parser.parse(token.tokens)}</div>`;
        }
        return ""
    }
}

globalThis.multiColumnTokenizer = {
    name: "multi_column",
    level: "block",
    start(src) { return src.indexOf("[|")?.index; },
    tokenizer(src) {
        const match = /^\[\[\[\s*([\s\S]+?)\s*\|\s*([\s\S]+?)\s*\]\]\]/.exec(src);
        if (match) {
            return token = {
                type: 'multi_column',
                raw: match[0],
                text: match.slice(1).map(t => t.trim()).join(""),
                tokens: match.slice(1).map(t => this.lexer.blockTokens(t.trim()))
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
}
globalThis.inlineMathTokenizer = {
    name: "inline_math",
    level: "inline",
    start(src) { return src.indexOf("\(")?.index; },
    tokenizer(src) {
        const match = /^\\\(\s*(.*?)\s*\\\)/.exec(src);
        if (match) {
            return token = {
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
}
globalThis.displayMathTokenizer = {
    name: "display_math",
    level: "block",
    start(src) { return src.indexOf("\[")?.index; },
    tokenizer(src) {
        const match = /^\\\[\s*(.*?)\s*\\\]/.exec(src);
        if (match) {
            return token = {
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
}

globalThis.customRenderer = {
    hr(hr) {
        variables["page_number"] = variables["page_number"] + 1
        return `</section><section data-page-number="${variables["page_number"]}" data-style="content">`;
    },
    heading(heading) {
        if (heading.depth == 1) {
            return `<div class="title">${heading.text}</div>`;
        }
        if (heading.depth == 2) {
            return `<div class="subtitle">${heading.text}</div>`;
        }
        return `<div class="heading${heading.depth}">${heading.text}</div>`;
    },
    image(image) {
        if (image.text) {
            return `<figure><img src=${image.href} alt=${image.text}><figcaption>${image.text}</figcaption></figure>`;
        } else {
            return `<figure><img src=${image.href} alt=${image.text}></figure>`;
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
}

const checkCodeLang = async (token) => {
    if (token.type === "code") {
        let lang = token.lang.match(/^([^:]+)/);
        if (!lang || !hljs.listLanguages().includes(lang[1])) {
            const url = `/scripts/external/highlight-lang/${lang[1]}.min.js`;
            await appendJavaScriptFilesAsync(url);
            console.log(`load: ${url}`)
        }
    }
};
globalThis.customWalkTokens = async (token) => {
    if (token instanceof Array) {
        for (let t of token) { await checkCodeLang(t); }
    } else {
        await checkCodeLang(token);
    }
};


async function buildMarkdwon(markdown_path, dom, remove_hide_page = true) {
    const res_md = await fetch(markdown_path);
    const content = await res_md.text();
    marked.use({
        breaks: true,
        gfm: true,
        async: true,
        extensions: [metaTokenizer, commentTokenizer, inlineMathTokenizer, displayMathTokenizer, multiColumnTokenizer],
        walkTokens : customWalkTokens,
        renderer: customRenderer
    });
    dom.innerHTML = `<section data-page-number="1" data-style="cover">${await marked.parse(content)}</section>`;
    const slidejs_id = Math.random();
    for (let section of dom.querySelectorAll("section")) {
        section.setAttribute("data-slidejs-id", slidejs_id);
    }
    hljs.highlightAll();
    await MathJax.typesetPromise();

    // Page
    const sections = document.querySelectorAll("section");
    for (let section of sections) {
        const page_number = section.getAttribute("data-page-number");
        const dom_page = document.createElement("div");
        dom_page.classList.add("page-number");
        dom_page.innerText = `${page_number} / ${sections.length}`;
        section.appendChild(dom_page);
    }

    // dynamic add class
    const page_metas = document.querySelectorAll("meta.page-add-class");
    for (let meta of page_metas) {
        const page_number = parseInt(meta.getAttribute("page-number"));
        const add_class = meta.getAttribute("add-class");
        const dom_section = dom.querySelector(`section[data-page-number="${page_number}"]`);
        dom_section.classList.add(add_class);
    }
    const global_metas = document.querySelectorAll("meta.global-add-class");
    for (let meta of global_metas) {
        const add_class = meta.getAttribute("add-class");
        const dom_sections = dom.querySelectorAll(`section`);
        for (let section of dom_sections) {
            section.classList.add(add_class);
        }
    }

    if (remove_hide_page) {
        const dom_hide_sections = document.querySelectorAll(`section.hide`);
        for (let section of dom_hide_sections) {
            section.remove();
        }
    }
}

function appendStyleSheetFiles(...urls) {
    urls.forEach(url => {
        const style = document.createElement("link");
        style.rel = "stylesheet";
        style.href = url;
        document.head.appendChild(style);
    });
}

async function appendJavaScriptFilesAsync(...urls) {
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
