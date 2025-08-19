# md-slide-js

## Features
* Write slides in **extended Markdown** (project-specific extensions supported)
* Run a **slideshow** in the browser and **export to PDF**
* Load **local files** (no server-side code required)
* Runs entirely in the **browser** (served over a static HTTP server)
* **Presenter view** included

## How to use

### Get the code
```sh
$ git clone https://github.com/kjmtks/md-slide-js.git
$ cd md-slide-js
$ npm install
```

### Start a local HTTP server
```sh
$ npm start
```

Then open: `http://127.0.0.1:3000/slideshow.html?md=slides/manual.md`

### Recommended usage
* Create your own slide directory and a slide file:
```sh
$ mkdir ~/myslides
$ vim ~/myslide/slide01.md
```

* Expose it inside this project (symlink):
```sh
$ ln -s ~/myslides slides/myslides
```

* Now you can access for example: `http://127.0.0.1:3000/slideshow.html?md=slides/myslides/slide01.md`

* Open the project in VS Code:
```sh
$ code .
```

