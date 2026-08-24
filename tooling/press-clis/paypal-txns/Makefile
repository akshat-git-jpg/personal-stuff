.PHONY: build test lint install clean

build:
	go build -o bin/paypal-txns-pp-cli ./cmd/paypal-txns-pp-cli

test:
	go test ./...

lint:
	golangci-lint run

install:
	go install ./cmd/paypal-txns-pp-cli

clean:
	rm -rf bin/

build-mcp:
	go build -o bin/paypal-txns-pp-mcp ./cmd/paypal-txns-pp-mcp

install-mcp:
	go install ./cmd/paypal-txns-pp-mcp

build-all: build build-mcp
