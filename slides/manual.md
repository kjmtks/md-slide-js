[: presenter = Takeshi Kojima :]
[: contact = kojima@tokushima-u.ac.jp :]
[: affiliation = Tokushima University :]
[: title = Create slides using Markdown and slideshow in web browser :]
[: subtitle = md-slide.js :]
[: date = 2025/3/6 :]

[: !cover :]
[: page no-page-number :]

<!-- note: 
This is the presenter notes section.
-->

---
# Introduction

* I want to create slides using Markdown.
* Marp is a strong candidate, especially with its VSCode extension. However, I find some inconveniences:
  * The precision of page preview scrolling is not very good.
  * It lacks high customizability. In particular, I frequently use multi-column layouts, but customizing them for smooth usage is difficult.
* Therefore, I developed an application that allows previewing in a web browser and running slideshows.

---
# Grammer
## Page separation
* Use a horizontal line `---` to separate pages.
* In Marp, pages are divided by either a horizontal line or a heading 1 (#).
  * Using the same specification as Marp is not particularly inconvenient, but now it's possible to include multiple heading 1 elements within a single page.

## Multi-column Layout
You can create a multi-column layout by writing as follows. There is no limit on the number of columns.
```
[[[
1st
||
2nd
||
3rd
]]]
```


---
[: page hide :]
# Hidden slide

---

## Code
Syntax highlighting is done using `highlight.js`. Language settings are loaded as needed.

[[[
```python:Python
print("Hello")
```
||
```latex:LaTeX
\frac{dx}{dt} = x(x-1)
```
]]]

## Figures and Tables
Captions can be easily set for each.

[[[
### Figure
![Figure 1: foo](https://illustration-free.net/thumb/svg/ifn0603.svg)
||
### Table
*caption: Table1: bar*
| aaaa | b| a | b| a | b| a | b| a | b|
|---|--|---|--|---|--|---|--|---|--|
| a | b| a | b| a | b| a | b| a | b|
| aaaa | baaa| a | b| a | b| a | b| a | b|
| a | b| a | b| a | b| a | b| a | b|
| a | b| a | b| a | b| a | b| a | b|
]]]

---
## Mathematical Expressions
Both inline and display formats are supported.

[[[
### Inline math
* Enclosing with `\\( ・ \\)` renders inline math: \\(x = \frac{1}{2}\\)
* Also, enclosing with `\( ・ \)` renders inline math: \(f(x, y, z(t))\)
||
### display math
* Enclosing with `\\[ ・ \\]` renders display math:
\\[
\frac{1}{2}
\\]
* Also, enclosing with `\[ ・ \]` renders display math:
\[
\frac{1}{2}[1]
\]
]]]

# Text Formatting and Decoration
* Link: This is a link.
* Emphasis: This is emphasized text.
* Italic: This is italic text.
* Bold: This is bold text.
* Strikethrough: This is strikethrough text.
* Blockquote:

> aaaa

---
## Variables
* Preassigned values can be referenced at any time: [:: date ::]
[: date = 2025/3/7 :]
* Reassignment is also possible: [:: date ::]
