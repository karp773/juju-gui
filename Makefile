JSFILES=$(shell bzr ls -RV -k file | grep -E -e '.+\.js(on)?$$|generateTemplates$$' | grep -Ev -e '^manifest\.json$$' -e '^test/assets/' -e '^app/assets/javascripts/reconnecting-websocket.js$$' -e '^server.js$$')

# After a successful "make" run, the NODE_TARGETS list can be regenerated with
# this command (and then manually pasted in here):
# find node_modules -maxdepth 1 -mindepth 1 -type d -printf 'node_modules/%f '
NODE_TARGETS=node_modules/minimatch node_modules/cryptojs \
	node_modules/yuidocjs node_modules/chai node_modules/less \
	node_modules/.bin node_modules/node-markdown node_modules/rimraf \
	node_modules/mocha node_modules/d3 node_modules/graceful-fs \
	node_modules/should node_modules/jshint node_modules/expect.js \
	node_modules/express node_modules/yui node_modules/yuidoc \
	node_modules/grunt node_modules/node-spritesheet \
	node_modules/node-minify
TEMPLATE_TARGETS=$(shell bzr ls -k file app/templates)
SPRITE_SOURCE_FILES=$(shell bzr ls -R -k file app/assets/images)
SPRITE_GENERATED_FILES=build/juju-ui/assets/stylesheets/sprite.css build/juju-ui/assets/stylesheets/sprite.png
COMPRESSED_FILES=build/juju-ui/assets/app-debug.js \
	build/juju-ui/assets/app.js \
	build/juju-ui/assets/third.js \
	build/juju-ui/assets/third-debug.js \
	build/juju-ui/assets/yui.js \
	build/juju-ui/assets/stylesheets/all-static.css
DATE=$(shell date -u)
APPCACHE=build/juju-ui/assets/manifest.appcache

all: install

build/juju-ui/templates.js: $(TEMPLATE_TARGETS) bin/generateTemplates
	@test -d "build/juju-ui/assets/stylesheets" || mkdir -p "build/juju-ui/assets/stylesheets"
	@./bin/generateTemplates

yuidoc/index.html: node_modules/yuidocjs $(JSFILES)
	@node_modules/.bin/yuidoc -o yuidoc -x assets app

yuidoc: yuidoc/index.html

$(SPRITE_GENERATED_FILES): node_modules/grunt node_modules/node-spritesheet $(SPRITE_SOURCE_FILES)
	@node_modules/grunt/bin/grunt spritegen

$(NODE_TARGETS): package.json
	@npm install
	@#link depends
	@ln -sf `pwd`/node_modules/yui ./app/assets/javascripts/
	@ln -sf `pwd`/node_modules/d3/d3.v2* ./app/assets/javascripts/

install: appcache $(NODE_TARGETS) build/juju-ui/templates.js yuidoc spritegen combinejs

gjslint: virtualenv/bin/gjslint
	@virtualenv/bin/gjslint --strict --nojsdoc --jslint_error=all \
	    --custom_jsdoc_tags module,main,class,method,event,property,attribute,submodule,namespace,extends,config,constructor,static,final,readOnly,writeOnce,optional,required,param,return,for,type,private,protected,requires,default,uses,example,chainable,deprecated,since,async,beta,bubbles,extension,extensionfor,extension_for \
	    $(JSFILES)

jshint: node_modules/jshint
	@node_modules/jshint/bin/hint $(JSFILES)

yuidoc-lint: $(JSFILES)
	@bin/lint-yuidoc

lint: gjslint jshint yuidoc-lint

virtualenv/bin/gjslint virtualenv/bin/fixjsstyle:
	@virtualenv virtualenv
	@virtualenv/bin/easy_install archives/closure_linter-latest.tar.gz

beautify: virtualenv/bin/fixjsstyle
	@virtualenv/bin/fixjsstyle --strict --nojsdoc --jslint_error=all $(JSFILES)

spritegen: $(SPRITE_GENERATED_FILES)

$(COMPRESSED_FILES): node_modules/yui node_modules/d3/d3.v2.min.js $(JSFILES) ./bin/merge-files
	@rm -f $(COMPRESSED_FILES)
	@test -d "build/juju-ui/assets/stylesheets" || mkdir -p "build/juju-ui/assets/stylesheets"
	@./bin/merge-files

combinejs: $(COMPRESSED_FILES)

prep: beautify lint

test: install
	@./test-server.sh

debug: install
	@echo "Customize config.js to modify server settings"
	@node server.js

server: build
	@echo "Runnning the application from a SimpleHTTPServer"
	@cd build && python -m SimpleHTTPServer 8888

clean:
	@rm -rf node_modules virtualenv
	@make -C docs clean
	@rm -Rf build/

build: install
	@cp -f app/index.html build/
	@cp -rf app/assets/images build/juju-ui/assets/images
	@cp -rf app/assets/svgs build/juju-ui/assets/svgs

$(APPCACHE): manifest.appcache.in
	@test -d "build/juju-ui/assets" || mkdir -p "build/juju-ui/assets"
	@cp manifest.appcache.in $(APPCACHE)
	@sed -re 's/^\# TIMESTAMP .+$$/\# TIMESTAMP $(DATE)/' -i $(APPCACHE)

appcache: $(APPCACHE)

# A target used only for forcibly updating the appcache.
appcache-touch:
	@touch manifest.appcache.in

# This is the real target.  appcache-touch needs to be executed before
# appcache, and this provides the correct order.
appcache-force: appcache-touch appcache

.PHONY: test lint beautify server install clean prep jshint gjslint \
	appcache appcache-touch appcache-force yuidoc spritegen yuidoc-lint \
	combinejs build
