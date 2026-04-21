# Makefile for the skillskit Go CLI.
#
# Nothing here runs the site or the Astro build — that's in site/ and
# uses npm scripts. This Makefile is purely for the Go CLI binary.
#
# Common workflows:
#   make build              compile a local binary to ./bin/skillskit
#   make run ARGS="list"    run without building (go run)
#   make install            go install to $GOBIN/skillskit
#   make test               go test ./...
#   make release-snapshot   goreleaser dry-run build (no publish)
#   make fmt                gofmt + goimports
#   make clean              rm -rf bin/ dist/

BIN_DIR := bin
BINARY  := skillskit
VERSION ?= dev
COMMIT  := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
DATE    := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

LDFLAGS := -s -w \
  -X main.Version=$(VERSION) \
  -X main.Commit=$(COMMIT) \
  -X main.Date=$(DATE)

.PHONY: build run install test release-snapshot release fmt clean

build:
	mkdir -p $(BIN_DIR)
	go build -trimpath -ldflags "$(LDFLAGS)" -o $(BIN_DIR)/$(BINARY) .

run:
	go run -ldflags "$(LDFLAGS)" . $(ARGS)

install:
	go install -trimpath -ldflags "$(LDFLAGS)" .

test:
	go test -race ./...

release-snapshot:
	goreleaser release --snapshot --clean

release:
	goreleaser release --clean

fmt:
	gofmt -w -s .

clean:
	rm -rf $(BIN_DIR) dist/
